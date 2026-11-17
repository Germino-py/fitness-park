-- 8. Compétition « Je suis à la salle » (ajouté le 17/11/2026)
-- À coller UNE fois dans Supabase → SQL Editor → New query → Run. Sans danger si on le relance.
-- Rien n'est visible du public tant que tu n'actives pas « Je suis à la salle » dans Admin → Fonctionnalités.

-- Joueurs : l'identifiant secret de l'appareil (jamais affiché) et son numéro public de visiteur.
create table if not exists public.players (
  voter text primary key check (voter ~ '^[0-9a-f]{32}$'),
  visitor_no integer not null unique check (visitor_no between 10000 and 99999),
  created_at timestamptz not null default now()
);

-- Passages validés : un seul par appareil et par jour, donc 10 points maximum par jour.
create table if not exists public.checkins (
  voter text not null references public.players on delete cascade,
  day date not null,
  club_id text not null check (club_id ~ '^[a-z0-9-]{1,80}$'),
  points smallint not null default 10,
  dist_m integer,
  created_at timestamptz not null default now(),
  primary key (voter, day)
);
create index if not exists checkins_club_day on public.checkins (club_id, day);
create index if not exists checkins_day on public.checkins (day);

-- Tables fermées au public : on n'y passe que par les fonctions ci-dessous.
alter table public.players enable row level security;
alter table public.checkins enable row level security;
revoke all on public.players from anon, authenticated;
revoke all on public.checkins from anon, authenticated;

-- Une option est-elle activée par l'admin ?
create or replace function public.feature_on(k text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select coalesce((select value = 'true'::jsonb from settings where key = k), false) $$;

-- Retrouve le numéro du joueur, ou l'enregistre. Si le numéro est déjà pris par un autre appareil, il en reçoit un nouveau.
create or replace function public.player_no(p_voter text, p_no integer) returns integer
  language plpgsql security definer set search_path = public as $$
declare n integer; tries integer := 0;
begin
  select visitor_no into n from players where voter = p_voter;
  if found then return n; end if;
  n := case when p_no between 10000 and 99999 then p_no else 10000 + floor(random() * 90000)::int end;
  loop
    begin
      insert into players (voter, visitor_no) values (p_voter, n);
      return n;
    exception when unique_violation then
      select visitor_no into n from players where voter = p_voter;
      if found then return n; end if;
      tries := tries + 1;
      if tries > 30 then raise exception 'Réessaie dans un instant.'; end if;
      n := 10000 + floor(random() * 90000)::int;
    end;
  end loop;
end $$;

-- « Je suis à la salle » : vérifie la position côté serveur (moins de 200 m de la salle, GPS précis),
-- puis donne 10 points, une seule fois par jour (heure de Paris).
create or replace function public.checkin(p_voter text, p_no integer, p_club text,
                                          p_lat double precision, p_lon double precision, p_acc double precision)
returns json language plpgsql security definer set search_path = public as $$
declare g record; d double precision; n integer; jour date := (now() at time zone 'Europe/Paris')::date; deja text; ici integer;
begin
  if p_voter is null or p_voter !~ '^[0-9a-f]{32}$' then raise exception 'Appareil non reconnu.'; end if;
  if not (feature_on('feat_points') or is_admin()) then raise exception 'Cette fonction n''est pas encore ouverte.'; end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'Position invalide.';
  end if;
  if p_acc is null or p_acc > 150 then
    return json_build_object('ok', false, 'why', 'precision', 'acc', round(coalesce(p_acc, 9999)));
  end if;
  select lat, lon into g from club_geo where club_id = p_club;
  if not found then return json_build_object('ok', false, 'why', 'salle'); end if;
  d := 2 * 6371000 * asin(sqrt(power(sin(radians(p_lat - g.lat) / 2), 2)
       + cos(radians(g.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lon - g.lon) / 2), 2)));
  if d > 200 + least(p_acc, 100) then
    return json_build_object('ok', false, 'why', 'loin', 'dist', round(d));
  end if;
  if (select count(*) from checkins where created_at > now() - interval '1 minute') >= 120 then
    raise exception 'Trop de monde en même temps, réessaie dans une minute.';
  end if;
  n := player_no(p_voter, p_no);
  select club_id into deja from checkins where voter = p_voter and day = jour;
  if found then return json_build_object('ok', false, 'why', 'deja', 'club', deja, 'no', n); end if;
  insert into checkins (voter, day, club_id, dist_m) values (p_voter, jour, p_club, round(d)) on conflict do nothing;
  if not found then return json_build_object('ok', false, 'why', 'deja', 'no', n); end if;
  select count(*) into ici from checkins where club_id = p_club and day = jour;
  return json_build_object('ok', true, 'no', n, 'dist', round(d), 'ici', ici);
end $$;

-- Le score d'un appareil : points, rang, série de jours, salles différentes.
create or replace function public.my_score(p_voter text) returns json
  language plpgsql stable security definer set search_path = public as $$
declare jour date := (now() at time zone 'Europe/Paris')::date; mois date := date_trunc('month', (now() at time zone 'Europe/Paris'))::date;
        n integer; pts integer; ptsm integer; nb_clubs integer; jours integer; rang integer; rangm integer; serie integer := 0; dern date; auj text;
begin
  if p_voter is null or p_voter !~ '^[0-9a-f]{32}$' then raise exception 'Appareil non reconnu.'; end if;
  if not (feature_on('feat_points') or is_admin()) then raise exception 'Cette fonction n''est pas encore ouverte.'; end if;
  select visitor_no into n from players where voter = p_voter;
  select coalesce(sum(points), 0), coalesce(sum(points) filter (where day >= mois), 0), count(distinct club_id), count(*), max(day)
    into pts, ptsm, nb_clubs, jours, dern from checkins where voter = p_voter;
  select club_id into auj from checkins where voter = p_voter and day = jour;
  select count(*) + 1 into rang from (select voter, sum(points) s from checkins group by voter) t where t.s > pts;
  select count(*) + 1 into rangm from (select voter, sum(points) s from checkins where day >= mois group by voter) t where t.s > ptsm;
  if dern is not null and dern >= jour - 1 then
    select count(*) into serie from (
      select day, day - (row_number() over (order by day))::int as grp from checkins where voter = p_voter
    ) s where grp = (select day - (row_number() over (order by day))::int from checkins where voter = p_voter order by day desc limit 1);
  end if;
  return json_build_object('no', n, 'points', pts, 'month', ptsm, 'clubs', nb_clubs, 'days', jours,
                           'rank', case when pts > 0 then rang end, 'rank_month', case when ptsm > 0 then rangm end,
                           'streak', serie, 'today', auj);
end $$;

-- Le classement : 50 premiers, du mois en cours ou depuis le début. Seuls les numéros de visiteur sont publics.
create or replace function public.leaderboard(p_period text default 'month', p_voter text default null) returns json
  language plpgsql stable security definer set search_path = public as $$
declare mois date := date_trunc('month', (now() at time zone 'Europe/Paris'))::date; res json;
begin
  if not (feature_on('feat_points') or is_admin()) then raise exception 'Cette fonction n''est pas encore ouverte.'; end if;
  select coalesce(json_agg(json_build_object('no', t.no, 'points', t.points, 'clubs', t.clubs, 'me', t.me)
                           order by t.points desc, t.since), '[]'::json) into res from (
    select p.visitor_no as no, sum(c.points)::int as points, count(distinct c.club_id)::int as clubs,
           max(c.created_at) as since, coalesce(c.voter = p_voter, false) as me
    from checkins c join players p using (voter)
    where p_period = 'all' or c.day >= mois
    group by p.visitor_no, c.voter
    order by sum(c.points) desc, max(c.created_at)
    limit 50
  ) t;
  return res;
end $$;

revoke all on function public.player_no(text, integer) from public, anon, authenticated;
revoke all on function public.checkin(text, integer, text, double precision, double precision, double precision) from public;
revoke all on function public.my_score(text) from public;
revoke all on function public.leaderboard(text, text) from public;
grant execute on function public.checkin(text, integer, text, double precision, double precision, double precision) to anon, authenticated;
grant execute on function public.my_score(text) to anon, authenticated;
grant execute on function public.leaderboard(text, text) to anon, authenticated;
grant execute on function public.feature_on(text) to anon, authenticated;

-- Recharge le cache de l'API pour que les nouvelles fonctions soient visibles tout de suite
notify pgrst, 'reload schema';
