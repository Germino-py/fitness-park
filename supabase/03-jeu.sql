-- =====================================================================================================
-- HMG Fitness · 03 · Le jeu (1-jeu-vies.md) : objectif hebdo, séance en 2 temps, bilan du lundi, cœurs,
-- maladie et guérison, semaines d'essai et de reprise, gels, pauses et hibernation, mode doux, quêtes,
-- étoiles, coffres, my_state(), classement plafonné, prev_week, sauvegarde du jeu.
-- À coller dans Supabase → SQL Editor → Run, APRÈS 02. Transactionnel, rejouable, additif.
-- Le miroir JavaScript de ces règles est js/vies-regles.js (HMGV) : toute règle changée ici doit l'être là-bas
-- (les scénarios croisés de supabase/tests/lancer.sh le vérifient).
--
-- ARBITRAGES (1-jeu-vies.md fait foi pour les RÈGLES, 4-backend.md pour la PLOMBERIE) :
--  A1 Identité : les tables du jeu sont rattachées au joueur (players.voter, clé interne) et pas directement à
--     auth.users : la reprise d'un compte du site ou un transfert déplace tout d'un coup (players.user_id).
--     La suppression du compte efface auth.users → players → tout le reste, en cascade.
--  A2 Séances : « checkins » reste le registre des séances VALIDÉES (points, classement, anciennes RPC du site) ;
--     « sessions » porte le cycle en 2 temps (ouverte, validee, courte, rejetee). Une séance validée écrit sa
--     ligne dans checkins ; une séance du site (ancienne RPC checkin) compte aussi comme validée.
--  A3 Cœurs : 3 au départ, 3 au maximum, ils ne bougent qu'au bilan du lundi (et à la guérison) : on ne garde pas
--     le « +1 cœur par séance en plus » ni le « retour à 1 cœur à l'objectif » de 4-backend (annexe A, life_*).
--  A4 Pauses : 6 semaines par 52 semaines glissantes + hibernation (1-jeu-vies), pas 4 par an / 2 d'affilée.
--  A5 Quêtes : 3 quêtes par semaine et par joueur, tirées par le serveur, terminées automatiquement, payées
--     en étoiles (pas de « claim_quest » ni de quêtes globales comme dans 4-backend).
--  A6 Position simulée (iOS) : signal et non refus ; une séance au score de signal ≥ 2 compte pour le joueur
--     (cœurs, héros) mais pas pour le classement.
--  A7 Fuseaux : le jour d'une séance suit le fuseau de la salle (outre-mer) ; le bilan suit le fuseau du profil,
--     celui de la salle principale (set_home_club), Europe/Paris par défaut.
--  A8 Noms : leaderboard_v2 et prev_week_v2 (les noms leaderboard/prev_week sont pris par les anciennes RPC à
--     p_voter, qui doivent rester appelables : une surcharge rendrait les appels ambigus pour l'API).
--  A9 my_state() rend toutes les clés du §14.10 (mêmes noms), plus week.days, unseen_bilan détaillé, onboarded
--     et quelques clés utiles (no, pseudo, seed…), listées dans js/serveur.js.
--  A10 Semaine d'essai : 2 quêtes (premiere + objectif), donc pas de coffre de la semaine (le tableau du profil A
--     au §5.11 en compte 3 : il ne suit pas la règle du §7.1, c'est la règle qui est appliquée).
-- =====================================================================================================
begin;

-- -----------------------------------------------------------------------------------------------------
-- 1. Réglages par défaut (1-jeu-vies.md §13.4). Modifiables : update game_config set value = '4' where key = 'hearts_max';
-- -----------------------------------------------------------------------------------------------------
insert into public.game_config (key, value) values
  ('hearts_max', '3'), ('hearts_start', '3'),
  ('goal_min', '2'), ('goal_max', '5'), ('goal_default', '3'), ('goal_change_days', '28'), ('goal_free_change_days', '14'),
  ('session_min_minutes', '20'), ('session_max_minutes', '180'),
  ('radius_base_m', '200'), ('radius_acc_bonus_max_m', '100'), ('acc_max_m', '150'),
  ('points_per_session', '10'), ('points_max_sessions_per_week', '6'), ('courte_max_per_week', '1'),
  ('gels_max', '2'), ('gel_min_streak', '2'), ('gel_every_streak_weeks', '4'), ('gel_price_stars', '150'),
  ('stars_full_heart', '10'), ('stars_milestone_overflow', '30'), ('stars_empty_chest', '25'), ('stars_empty_big_chest', '50'),
  ('stars_week_chest_full', '40'), ('stars_per_old_star', '25'),
  ('heal_sessions', '2'), ('heal_window_days', '7'), ('heal_hearts', '1'),
  ('pause_weeks_per_52', '6'), ('pause_same_week_until_isodow', '3'), ('reprise_after_pause_weeks', '2'),
  ('settle_hour_local', '3'),
  ('quest_rewards', '{"tot":10,"matin":10,"meme_heure":15,"weekend":10,"repos":15,"fidele":15,"explo":25,"objectif":20,"remise":10,"premiere":20}'),
  ('week_chest_odds', '{"R":0.60,"E":0.30,"L":0.10}'),
  ('streak_items', '{"8":"flamme_bleue","26":"echarpe_six_mois","52":"couronne_fer"}'),
  ('mus_thresholds', '[0,5,15,30,50,80]'),
  ('notif_auto_max_per_week', '3'), ('notif_quiet_start', '"21:00"'), ('notif_quiet_end', '"08:00"'),
  ('notif_fatigue_ignored', '3'), ('notif_fatigue_days', '14'),
  ('adult_age', '18'), ('min_age', '15'),
  ('start_refused_per_day', '8'), ('flag_score_exclude', '2'), ('leaderboard_verified_only', 'false'),
  ('pionnier_until', 'null')                                -- date de sortie de l'appli : après, plus d'Écharpe Pionnier
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------------------------------
-- 2.1 Fuseau de chaque salle (outre-mer), déduit de sa position ; tenu à jour par un déclencheur
alter table public.club_geo add column if not exists tz text not null default 'Europe/Paris';
create or replace function app.tz_for(lat double precision, lon double precision) returns text language sql immutable as $$
  select case
    when lat between 15.8 and 16.6 and lon between -61.9 and -60.9 then 'America/Guadeloupe'
    when lat between 14.3 and 14.95 and lon between -61.3 and -60.75 then 'America/Martinique'
    when lat between 2 and 6 and lon between -55 and -51 then 'America/Cayenne'
    when lat between -21.5 and -20.8 and lon between 55.1 and 56 then 'Indian/Reunion'
    when lat between -13.1 and -12.6 and lon between 44.9 and 45.4 then 'Indian/Mayotte'
    else 'Europe/Paris' end
$$;
create or replace function app.trg_club_tz() returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lon is not null then new.tz := app.tz_for(new.lat, new.lon); end if;
  return new;
end $$;
drop trigger if exists club_geo_tz on public.club_geo;
create trigger club_geo_tz before insert or update of lat, lon on public.club_geo for each row execute function app.trg_club_tz();
update public.club_geo set tz = app.tz_for(lat, lon) where lat is not null and lon is not null and tz is distinct from app.tz_for(lat, lon);

-- 2.2 Séances validées : quelques colonnes de plus (les anciennes RPC du site les laissent à leur valeur par défaut)
alter table public.checkins add column if not exists flags text[] not null default '{}';
alter table public.checkins add column if not exists started_at timestamptz;   -- début de la séance (null = séance du site)
alter table public.checkins add column if not exists session_id bigint;

-- 2.3 Profil de jeu (un par joueur, créé quand il choisit son objectif)
create table if not exists public.profiles (
  voter text primary key references public.players on delete cascade,
  tz text not null default 'Europe/Paris',
  home_club_id text references public.club_geo on delete set null,
  birth_year smallint check (birth_year between 1900 and 2100),
  soft_mode boolean not null default false,              -- « Jouer sans cœurs » (imposé aux moins de 18 ans)
  created_at timestamptz not null,
  first_week date not null check (extract(isodow from first_week) = 1),   -- lundi de la semaine d'inscription
  created_isodow smallint not null check (created_isodow between 1 and 7),
  hearts smallint not null check (hearts between 0 and 10),
  streak integer not null default 0 check (streak >= 0),
  best_streak integer not null default 0,
  weeks_ok integer not null default 0,                   -- total des semaines réussies (mode doux, statistiques)
  gels smallint not null default 0 check (gels between 0 and 10),
  first_gel_done boolean not null default false,
  sick_since date,                                       -- non nul = héros malade depuis ce lundi
  healed_count smallint not null default 0,
  reprise_week date,                                     -- lundi d'une semaine de reprise
  last_settled_week date,                                -- dernier lundi dont le bilan est fait
  phoenix boolean not null default false,                -- badge « Phénix » (1re guérison)
  goal_changed_at timestamptz,                           -- dernière demande de changement d'objectif
  updated_at timestamptz not null default now()
);
create table if not exists public.goal_history (           -- l'objectif choisi, à partir d'un lundi
  voter text not null references public.players on delete cascade,
  effective_week date not null check (extract(isodow from effective_week) = 1),
  goal smallint not null check (goal between 1 and 7),
  requested_at timestamptz not null,
  primary key (voter, effective_week)
);

-- 2.4 Séances en 2 temps : « Je suis à la salle » puis « J'ai fini » 20 min à 3 h plus tard, sur place.
--     Jamais de coordonnées : la salle, les distances arrondies, la précision, et une empreinte chiffrée (HMAC
--     avec un secret du serveur) des coordonnées, seulement pour repérer une position recopiée à l'identique.
create table if not exists public.sessions (
  id bigint generated always as identity primary key,
  voter text not null references public.players on delete cascade,
  club_id text not null check (club_id ~ '^[a-z0-9-]{1,80}$'),
  day date not null,                                     -- date locale (fuseau de la salle) du démarrage
  week date not null check (extract(isodow from week) = 1),
  started_at timestamptz not null,
  start_dist_m integer not null,
  start_acc_m integer not null,
  confirmed_at timestamptz,
  confirm_dist_m integer,
  confirm_acc_m integer,
  status text not null default 'ouverte' check (status in ('ouverte', 'validee', 'courte', 'rejetee')),
  week_rank smallint,
  points smallint not null default 0,
  loc_hash text,
  flags text[] not null default '{}',
  unique (voter, day)
);
create index if not exists sessions_voter_week on public.sessions (voter, week);
create index if not exists sessions_open on public.sessions (voter) where status = 'ouverte';
create table if not exists public.session_attempts (       -- essais (limites, signaux), purgés à 30 jours
  id bigint generated always as identity primary key,
  voter text not null references public.players on delete cascade,
  at timestamptz not null,
  why text not null,
  club_id text,
  dist_m integer,
  acc_m integer
);
create index if not exists session_attempts_voter_at on public.session_attempts (voter, at desc);
create table if not exists app.secret (id smallint primary key default 1 check (id = 1), k bytea not null);
insert into app.secret (id, k) values (1, extensions.gen_random_bytes(32)) on conflict (id) do nothing;
revoke all on app.secret from public;

-- 2.5 Bilans, pauses, quêtes, étoiles, coffres
create table if not exists public.weekly_results (
  voter text not null references public.players on delete cascade,
  week date not null check (extract(isodow from week) = 1),
  goal smallint not null,                    -- objectif choisi
  goal_eff smallint not null,                -- objectif effectif (essai, reprise)
  safe smallint not null,                    -- seuil « cœur sauvé »
  v_count smallint not null,                 -- validées
  c_count smallint not null,                 -- courtes (toutes)
  s_count smallint not null,                 -- S = validées + min(1, courtes)
  outcome text not null check (outcome in ('atteint', 'sauve', 'rate', 'malade', 'pause', 'hibernation', 'doux')),
  met boolean not null,                      -- S ≥ objectif effectif (sert à l'Ange, au mode doux)
  kind text not null check (kind in ('normale', 'essai', 'reprise')),
  hearts_before smallint not null, hearts_after smallint not null,
  streak_before integer not null, streak_after integer not null,
  gel_used boolean not null default false,
  gels_after smallint not null,
  stars_earned integer not null default 0,
  fell_sick boolean not null default false,
  settled_at timestamptz not null default now(),
  seen_at timestamptz,                       -- animation du bilan déjà montrée (ack_bilan)
  primary key (voter, week)
);
create table if not exists public.pauses (
  id bigint generated always as identity primary key,
  voter text not null references public.players on delete cascade,
  kind text not null check (kind in ('pause', 'hibernation')),   -- jamais la raison (donnée de santé possible)
  start_week date not null check (extract(isodow from start_week) = 1),
  end_week date check (end_week is null or extract(isodow from end_week) = 1),  -- dernier lundi couvert ; null = hibernation ouverte
  created_at timestamptz not null default now(),
  check (end_week is null or end_week >= start_week),
  check (kind = 'hibernation' or end_week is not null)
);
create index if not exists pauses_voter on public.pauses (voter, start_week);
create table if not exists public.quests (
  voter text not null references public.players on delete cascade,
  week date not null,
  slot smallint not null check (slot between 1 and 3),
  quest_key text not null,
  reward smallint not null,
  done_at timestamptz,
  primary key (voter, week, slot)
);
create table if not exists public.star_ledger (            -- grand livre des étoiles : chaque gain une seule fois
  id bigint generated always as identity primary key,
  voter text not null references public.players on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('quete', 'coeur_plein', 'palier', 'coffre_vide', 'semaine_vide', 'achat', 'migration', 'admin')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (voter, reason, ref)
);
create table if not exists public.chest_grants (           -- droits aux coffres hors pas (les pas viennent du nombre de séances)
  voter text not null references public.players on delete cascade,
  chest_key text not null,                   -- 'semaine:2026-11-23', 'palier:8', 'pionnier', 'pas:13' (ouverture notée)
  kind text not null check (kind in ('semaine', 'palier', 'pionnier', 'pas')),
  item_id text,                              -- objet fixe (palier 8 : 'flamme_bleue'…) ; null = tirage par l'appli
  granted_at timestamptz not null default now(),
  opened_at timestamptz,
  primary key (voter, chest_key)
);
-- 2.6 Sauvegarde du jeu (héros, tenue, collection) et des préférences, d'un appareil à l'autre (4-backend §5)
create table if not exists public.game_saves (
  voter text not null references public.players on delete cascade,
  slot text not null check (slot in ('game', 'prefs')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (voter, slot)
);

-- -----------------------------------------------------------------------------------------------------
-- 3. Fonctions internes : temps, distances, hasard déterministe (identique à gmHash / gmRng de js/app.js)
-- -----------------------------------------------------------------------------------------------------
create or replace function app.monday(d date) returns date language sql immutable
  as $$ select d - (extract(isodow from d)::int - 1) $$;
create or replace function app.safe(g integer) returns integer language sql immutable
  as $$ select (g + 1) / 2 $$;                              -- 2→1, 3→2, 4→2, 5→3
create or replace function app.local_day(p_tz text) returns date language sql stable
  as $$ select (app.now() at time zone p_tz)::date $$;
-- dernier lundi dont le bilan est possible : le bilan de la semaine W s'ouvre le lundi W+7 à 3 h, heure locale
create or replace function app.settle_upto(p_tz text) returns date language sql stable
  as $$ select app.monday(((app.now() at time zone p_tz) - make_interval(hours => app.cfgi('settle_hour_local', 3)))::date) - 7 $$;
create or replace function app.dist_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
  returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(least(1, sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
         + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))))
$$;
create or replace function app.loc_hash(lat double precision, lon double precision) returns text language sql stable set search_path = public as $$
  select left(encode(extensions.hmac(convert_to(round(lat::numeric, 6)::text || ',' || round(lon::numeric, 6)::text, 'UTF8'),
                                     (select k from app.secret where id = 1), 'sha256'::text), 'hex'), 16)
$$;
-- FNV-1a 32 bits, comme gmHash(s) de js/app.js
create or replace function app.gm_hash(s text) returns bigint language plpgsql immutable as $$
declare h bigint := 2166136261; i int;
begin
  for i in 1 .. coalesce(length(s), 0) loop
    h := ((h # ascii(substr(s, i, 1))) * 16777619) % 4294967296;
  end loop;
  return h;
end $$;
create or replace function app.imul(a bigint, b bigint) returns bigint language sql immutable
  as $$ select ((a::numeric * b::numeric) % 4294967296)::bigint $$;
-- mulberry32, comme gmRng(seed) de js/app.js : les n premiers tirages dans [0, 1)
create or replace function app.gm_rng(p_seed bigint, n int) returns double precision[] language plpgsql immutable as $$
declare a bigint := p_seed % 4294967296; t bigint; r double precision[] := '{}'; i int;
begin
  for i in 1 .. n loop
    a := (a + 1831565813) % 4294967296;
    t := app.imul(a # (a >> 15), 1 | a);
    t := ((t + app.imul(t # (t >> 7), 61 | t)) % 4294967296) # t;
    r := r || ((t # (t >> 14)) / 4294967296.0)::double precision;
  end loop;
  return r;
end $$;
create or replace function app.mus_level(n integer) returns integer language sql stable as $$
  select greatest(0, (select count(*) from jsonb_array_elements_text(coalesce(app.cfg('mus_thresholds'), '[0,5,15,30,50,80]')) t
                       where t::int <= n)::int - 1)
$$;
-- Score de signal d'une séance (anti-triche, non bloquant)
create or replace function app.flag_score(f text[]) returns integer language sql immutable as $$
  select coalesce(sum(case x when 'sim' then 2 when 'meme_pos' then 2 when 'vitesse' then 2 else 1 end), 0)::int
    from unnest(coalesce(f, '{}')) x
$$;

-- -----------------------------------------------------------------------------------------------------
-- 4. Fonctions internes : objectif, semaine, séances comptées, pauses, étoiles
-- -----------------------------------------------------------------------------------------------------
create or replace function app.goal_at(p_voter text, p_week date) returns integer language sql stable set search_path = public as $$
  select coalesce((select goal from goal_history where voter = p_voter and effective_week <= p_week
                    order by effective_week desc limit 1), app.cfgi('goal_default', 3))
$$;
create or replace function app.week_kind(p public.profiles, w date) returns text language sql stable as $$
  select case when w = p.first_week then 'essai' when w = p.reprise_week then 'reprise' else 'normale' end
$$;
create or replace function app.g_eff(p public.profiles, w date, g integer) returns integer language sql stable as $$
  select case app.week_kind(p, w)
           when 'essai' then greatest(1, ceil(g * (8 - p.created_isodow) / 7.0)::int)
           when 'reprise' then app.safe(g)
           else g end
$$;
create or replace function app.safe_eff(k text, ge integer) returns integer language sql immutable
  as $$ select case when k = 'reprise' then ge else app.safe(ge) end $$;
create or replace function app.v_count(p_voter text, w date) returns integer language sql stable set search_path = public
  as $$ select count(*)::int from checkins where voter = p_voter and day >= w and day < w + 7 $$;
create or replace function app.c_count(p_voter text, w date) returns integer language sql stable set search_path = public
  as $$ select count(*)::int from sessions s where s.voter = p_voter and s.week = w and s.status = 'courte'
          and not exists (select 1 from checkins c where c.voter = p_voter and c.day = s.day) $$;
-- Séances qui comptent (cœurs, guérison) : les validées, et au plus 1 courte par semaine
create or replace function app.counted(p_voter text) returns table (day date, st text) language sql stable set search_path = public as $$
  select c.day, 'validee'::text from checkins c where c.voter = p_voter
  union all
  select x.day, 'courte'::text from (
    select s.day, row_number() over (partition by s.week order by s.day) rn from sessions s
     where s.voter = p_voter and s.status = 'courte'
       and not exists (select 1 from checkins c where c.voter = p_voter and c.day = s.day)) x
   where x.rn <= app.cfgi('courte_max_per_week', 1)
$$;
create or replace function app.pause_at(p_voter text, w date) returns public.pauses language sql stable set search_path = public as $$
  select * from pauses where voter = p_voter and start_week <= w and (end_week is null or w <= end_week)
   order by start_week desc limit 1
$$;
-- semaines de pause (pas d'hibernation) dans la fenêtre glissante de 52 semaines autour de la semaine cw
create or replace function app.pause_used_52(p_voter text, cw date) returns integer language sql stable set search_path = public as $$
  select count(distinct wk)::int from pauses p, generate_series(p.start_week, p.end_week, interval '7 days') g(wk)
   where p.voter = p_voter and p.kind = 'pause' and wk::date between cw - 357 and cw + 364
$$;
-- Une étoile n'est jamais créditée deux fois (clé raison + référence) ; rend ce qui a vraiment été crédité
create or replace function app.star(p_voter text, p_delta integer, p_reason text, p_ref text) returns integer
  language plpgsql set search_path = public as $$
begin
  if coalesce(p_delta, 0) = 0 then return 0; end if;
  insert into star_ledger (voter, delta, reason, ref) values (p_voter, p_delta, p_reason, p_ref) on conflict do nothing;
  return case when found then p_delta else 0 end;
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 5. Fonctions internes : guérison, séances expirées, quêtes, bilan
-- -----------------------------------------------------------------------------------------------------
-- La guérison (§14.4) : 2 séances comptées à moins de 7 jours d'écart depuis le début de la maladie
create or replace function app.after_counted(p_voter text, p_day date) returns boolean language plpgsql set search_path = public as $$
declare p public.profiles; n int;
begin
  select * into p from profiles where voter = p_voter for update;
  if not found or p.sick_since is null then return false; end if;
  select count(*) into n from app.counted(p_voter) c
   where c.day >= p.sick_since and c.day >= p_day - (app.cfgi('heal_window_days', 7) - 1) and c.day <= p_day;
  if n < app.cfgi('heal_sessions', 2) then return false; end if;
  update profiles set hearts = least(app.cfgi('hearts_max', 3), app.cfgi('heal_hearts', 1)), sick_since = null,
                      healed_count = healed_count + 1, reprise_week = app.monday(p_day), phoenix = true, updated_at = now()
   where voter = p_voter;
  return true;
end $$;

-- Séances ouvertes depuis plus de 3 h → « courte » (elle compte pour l'objectif, pas pour les points)
create or replace function app.expire_open(p_voter text) returns void language plpgsql set search_path = public as $$
declare s record;
begin
  for s in select id, day from sessions where voter = p_voter and status = 'ouverte'
             and started_at + make_interval(mins => app.cfgi('session_max_minutes', 180)) < app.now()
           order by started_at for update loop
    update sessions set status = 'courte' where id = s.id;
    perform app.after_counted(p_voter, s.day);
  end loop;
end $$;

-- Une quête est-elle remplie ? (séances VALIDÉES de la semaine w, heures locales du profil)
create or replace function app.week_done(p_voter text, w date, p_tz text) returns table (day date, club text, m int)
  language sql stable set search_path = public as $$
  select c.day, c.club_id, (extract(hour from coalesce(c.started_at, c.created_at) at time zone p_tz) * 60
                            + extract(minute from coalesce(c.started_at, c.created_at) at time zone p_tz))::int
    from checkins c where c.voter = p_voter and c.day >= w and c.day < w + 7
$$;
create or replace function app.quest_done(p_voter text, p public.profiles, w date, k text) returns boolean
  language plpgsql stable set search_path = public as $$
begin
  if k = 'premiere' then return exists (select 1 from app.week_done(p_voter, w, p.tz));
  elsif k = 'tot' then return exists (select 1 from app.week_done(p_voter, w, p.tz) q where q.day <= w + 2);
  elsif k = 'matin' then return exists (select 1 from app.week_done(p_voter, w, p.tz) q where q.m >= 300 and q.m < 600);
  elsif k = 'weekend' then return exists (select 1 from app.week_done(p_voter, w, p.tz) q where q.day >= w + 5);
  elsif k = 'meme_heure' then
    return exists (select 1 from app.week_done(p_voter, w, p.tz) a, app.week_done(p_voter, w, p.tz) b
                    where a.day < b.day and abs(a.m - b.m) < 60);
  elsif k = 'repos' then
    return exists (select 1 from (select q.day - lag(q.day) over (order by q.day) gap from app.week_done(p_voter, w, p.tz) q) x
                    where x.gap >= 2);
  elsif k = 'fidele' then
    return p.home_club_id is not null and (select count(*) from app.week_done(p_voter, w, p.tz) q where q.club = p.home_club_id) >= 2;
  elsif k = 'explo' then
    return exists (select 1 from app.week_done(p_voter, w, p.tz) q where not exists (
                     select 1 from checkins c where c.voter = p_voter and c.club_id = q.club and c.day < w));
  elsif k = 'objectif' then
    return (select count(*) from app.week_done(p_voter, w, p.tz)) >= app.g_eff(p, w, app.goal_at(p_voter, w));
  elsif k = 'remise' then return p.reprise_week = w and p.sick_since is null;
  end if;
  return false;
end $$;

-- Les 3 quêtes de la semaine w (§7, §14.8), tirées une fois, de façon déterministe (graine + semaine)
create or replace function app.ensure_quests(p_voter text, w date) returns void language plpgsql set search_path = public as $$
declare p public.profiles; seed text; r double precision[]; rw jsonb := app.cfg('quest_rewards'); prev text;
        pa text[]; pb text[]; a text; b text;
begin
  if exists (select 1 from quests where voter = p_voter and week = w) then return; end if;
  select * into p from profiles where voter = p_voter;
  if not found or w < p.first_week or (app.pause_at(p_voter, w)).id is not null then return; end if;
  select coalesce(game_seed, voter) into seed from players where voter = p_voter;
  r := app.gm_rng(app.gm_hash(seed || ':q:' || w::text), 2);
  if w = p.first_week then                                   -- semaine d'essai : « Première séance » et « Objectif tenu »
    insert into quests (voter, week, slot, quest_key, reward) values
      (p_voter, w, 1, 'premiere', (rw ->> 'premiere')::int), (p_voter, w, 3, 'objectif', (rw ->> 'objectif')::int);
    return;
  end if;
  select quest_key into prev from quests where voter = p_voter and week = w - 7 and slot = 1;
  if p.sick_since is not null then
    a := 'remise';
  else
    pa := array_remove(array['tot', 'matin', 'meme_heure', 'weekend'], prev);
    a := pa[floor(r[1] * array_length(pa, 1))::int + 1];
  end if;
  pb := array['repos', 'weekend'];
  if p.home_club_id is not null then
    pb := pb || 'fidele'::text;
    if extract(week from w)::int % 4 = app.gm_hash(seed) % 4
       and exists (select 1 from club_geo h, club_geo o where h.club_id = p.home_club_id and o.club_id <> h.club_id
                     and o.lat is not null and app.dist_m(h.lat, h.lon, o.lat, o.lon) < 20000) then
      pb := pb || 'explo'::text;
    end if;
  end if;
  pb := array_remove(pb, a);
  b := pb[floor(r[2] * array_length(pb, 1))::int + 1];
  insert into quests (voter, week, slot, quest_key, reward) values
    (p_voter, w, 1, a, (rw ->> a)::int), (p_voter, w, 2, b, (rw ->> b)::int), (p_voter, w, 3, 'objectif', (rw ->> 'objectif')::int);
end $$;

-- Met à jour les quêtes de la semaine w ; les 3 réussies donnent le coffre de la semaine
create or replace function app.refresh_quests(p_voter text, w date) returns void language plpgsql set search_path = public as $$
declare p public.profiles; q record;
begin
  select * into p from profiles where voter = p_voter;
  if not found or (app.pause_at(p_voter, w)).id is not null then return; end if;
  for q in select * from quests where voter = p_voter and week = w and done_at is null order by slot loop
    if app.quest_done(p_voter, p, w, q.quest_key) then
      update quests set done_at = app.now() where voter = p_voter and week = w and slot = q.slot;
      perform app.star(p_voter, q.reward, 'quete', w::text || ':' || q.slot);
    end if;
  end loop;
  if (select count(*) filter (where done_at is not null) from quests where voter = p_voter and week = w) = 3 then
    insert into chest_grants (voter, chest_key, kind, granted_at) values (p_voter, 'semaine:' || w::text, 'semaine', app.now())
      on conflict do nothing;
  end if;
end $$;

-- Le bilan d'une semaine (§5.3, §14.5). Idempotent : une seule ligne weekly_results par (joueur, semaine),
-- étoiles et objets sous clé d'unicité. À appeler dans l'ordre des semaines (app.settle_due le fait).
create or replace function app.settle_week(p_voter text, w date) returns void language plpgsql set search_path = public as $$
declare p public.profiles; g int; k text; ge int; se int; nv int; nc int; s int; pz public.pauses; plen int;
        hb int; sb int; gb int; h int; st int; gl int; wok int; best int; sick date; rep date;
        st_extra int := 0; gel_used boolean := false; fell boolean := false; outcome text; met boolean;
        hmax int := app.cfgi('hearts_max', 3); gmax int := app.cfgi('gels_max', 2); item text;
begin
  if exists (select 1 from weekly_results where voter = p_voter and week = w) then return; end if;
  select * into p from profiles where voter = p_voter for update;
  if not found or w < p.first_week then return; end if;
  perform app.expire_open(p_voter);
  perform app.refresh_quests(p_voter, w);
  select * into p from profiles where voter = p_voter;      -- relu : la guérison a pu passer
  g := app.goal_at(p_voter, w); k := app.week_kind(p, w); ge := app.g_eff(p, w, g); se := app.safe_eff(k, ge);
  nv := app.v_count(p_voter, w); nc := app.c_count(p_voter, w); s := nv + least(app.cfgi('courte_max_per_week', 1), nc);
  pz := app.pause_at(p_voter, w);
  hb := p.hearts; sb := p.streak; gb := p.gels; h := hb; st := sb; gl := gb; wok := p.weeks_ok; best := p.best_streak;
  sick := p.sick_since; rep := p.reprise_week; met := s >= ge;
  if p.soft_mode then
    outcome := 'doux';
    if met then wok := wok + 1; end if;
  elsif pz.kind = 'pause' then
    outcome := 'pause';                                       -- cœurs et série gelés
  elsif pz.kind = 'hibernation' then
    outcome := 'hibernation';
    if nv >= 1 then update pauses set end_week = w where id = pz.id; pz.end_week := w; end if;   -- une séance la termine
  elsif h = 0 then
    outcome := 'malade';
  elsif met then
    outcome := 'atteint'; wok := wok + 1;
    if h < hmax then h := h + 1;
    else st_extra := st_extra + app.star(p_voter, app.cfgi('stars_full_heart', 10), 'coeur_plein', w::text); end if;
    st := st + 1;
    if st % app.cfgi('gel_every_streak_weeks', 4) = 0 then
      if gl < gmax then gl := gl + 1;
      else st_extra := st_extra + app.star(p_voter, app.cfgi('stars_milestone_overflow', 30), 'palier', w::text); end if;
    end if;
    item := app.cfg('streak_items') ->> st::text;
    if item is not null then
      insert into chest_grants (voter, chest_key, kind, item_id, granted_at)
        values (p_voter, 'palier:' || st, 'palier', item, app.now()) on conflict do nothing;
    end if;
  else
    outcome := case when s >= se then 'sauve' else 'rate' end;
    if outcome = 'rate' and k = 'normale' then h := h - 1; end if;
    if h = 0 then st := 0; sick := w + 7; fell := true;      -- le héros tombe malade (les gels sont gardés)
    elsif st >= app.cfgi('gel_min_streak', 2) and gl > 0 then gl := gl - 1; gel_used := true;
    else st := 0; end if;
  end if;
  best := greatest(best, st);
  -- semaine de reprise après une pause ou une hibernation d'au moins 2 semaines qui se termine en w
  if pz.id is not null and pz.end_week = w then
    plen := (w - pz.start_week) / 7 + 1;
    if plen >= app.cfgi('reprise_after_pause_weeks', 2) then rep := w + 7; end if;
  end if;
  insert into weekly_results (voter, week, goal, goal_eff, safe, v_count, c_count, s_count, outcome, met, kind,
                              hearts_before, hearts_after, streak_before, streak_after, gel_used, gels_after, stars_earned, fell_sick)
  values (p_voter, w, g, ge, se, nv, nc, s, outcome, met, k, hb, h, sb, st, gel_used, gl,
          st_extra + coalesce((select sum(delta) from star_ledger where voter = p_voter and reason = 'quete' and ref like w::text || ':%'), 0),
          fell);
  update profiles set hearts = h, streak = st, best_streak = best, gels = gl, weeks_ok = wok, sick_since = sick,
                      reprise_week = rep, last_settled_week = w, updated_at = now()
   where voter = p_voter;
end $$;

-- Rattrape tous les bilans en retard, dans l'ordre (au premier passage du joueur après le lundi 3 h)
create or replace function app.settle_due(p_voter text) returns void language plpgsql set search_path = public as $$
declare p public.profiles; w date; upto date;
begin
  select * into p from profiles where voter = p_voter;
  if not found then return; end if;
  upto := app.settle_upto(p.tz);
  w := coalesce(p.last_settled_week + 7, p.first_week);
  while w <= upto loop
    perform app.settle_week(p_voter, w);
    w := w + 7;
  end loop;
end $$;

-- Tout ce qu'il faut faire à chaque passage d'un joueur (lazy, idempotent)
create or replace function app.touch(p_voter text) returns void language plpgsql set search_path = public as $$
declare p public.profiles; cw date;
begin
  perform app.expire_open(p_voter);
  perform app.settle_due(p_voter);
  select * into p from profiles where voter = p_voter;
  if not found then return; end if;
  cw := app.monday(app.local_day(p.tz));
  perform app.ensure_quests(p_voter, cw);
  perform app.refresh_quests(p_voter, cw);
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 6. Classement plafonné (6 séances par semaine au plus, signaux exclus, bannis/mineurs/masqués exclus)
-- -----------------------------------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('app.lb_hidden(text,text)') is null then      -- rempli par 04-moderation.sql
    execute 'create function app.lb_hidden(p_viewer text, p_voter text) returns boolean language sql as $f$ select false $f$';
  end if;
end $$;
create or replace function app.is_minor(p_birth smallint) returns boolean language sql stable
  as $$ select p_birth is not null and extract(year from app.now())::int - p_birth < app.cfgi('adult_age', 18) $$;
-- points plafonnés par joueur depuis p_from (rang dans la semaine calculé sur toute la semaine)
create or replace function app.capped_points(p_from date, p_lb boolean) returns table (voter text, points int, clubs int, last timestamptz)
  language sql stable set search_path = public as $$
  with c as (
    select c.voter, c.day, c.club_id, c.points, c.flags, coalesce(c.started_at, c.created_at) t,
           row_number() over (partition by c.voter, app.monday(c.day) order by coalesce(c.started_at, c.created_at), c.day) rk
      from checkins c)
  select voter, sum(case when rk <= app.cfgi('points_max_sessions_per_week', 6)
                          and (not p_lb or app.flag_score(flags) < app.cfgi('flag_score_exclude', 2)) then points else 0 end)::int,
         count(distinct club_id)::int, max(t)
    from c where day >= p_from group by voter
$$;
create or replace function app.lb_rows(p_from date, p_viewer text) returns table (voter text, no int, points int, clubs int, last timestamptz)
  language sql stable set search_path = public as $$
  select x.voter, p.visitor_no, x.points, x.clubs, x.last
    from app.capped_points(p_from, true) x join players p on p.voter = x.voter
    left join profiles pr on pr.voter = x.voter
    left join auth.users u on u.id = p.user_id
   where x.points > 0 and not app.is_banned(x.voter) and not app.is_minor(pr.birth_year)
     and (not coalesce((app.cfg('leaderboard_verified_only') #>> '{}')::boolean, false) or u.is_anonymous is false)
     and not app.lb_hidden(p_viewer, x.voter)
$$;

-- -----------------------------------------------------------------------------------------------------
-- 7. L'état complet renvoyé à l'appli (contrat du §14.10 de 1-jeu-vies.md, détaillé en tête de js/serveur.js)
-- -----------------------------------------------------------------------------------------------------
create or replace function app.state_json(p_voter text) returns json language plpgsql stable set search_path = public as $$
declare p public.profiles; has_p boolean := false; pno int; ppseudo text; pseed text; tz text := 'Europe/Paris'; today date; cw date; isod int;
        hmax int := app.cfgi('hearts_max', 3); steps int := 0; stars int := 0; lvl int; g int; gnext int; k text; ge int; se int;
        nv int := 0; nc int := 0; s int; days json; sess json; tod json; pz public.pauses; pzj json; qj json := '[]'; ub json; ch json := '[]';
        uh text := '18:00'; mois date; ptsm int := 0; lbp int; rkm int; conva int := 0; gfrom date; minor boolean := false;
begin
  if p_voter is not null then
    select pp.visitor_no, coalesce(pp.game_seed, pp.voter), ps.pseudo into pno, pseed, ppseudo
      from players pp left join pseudos ps on ps.voter = pp.voter where pp.voter = p_voter;
    select * into p from profiles where voter = p_voter;
    has_p := found;
    if has_p then tz := p.tz; minor := app.is_minor(p.birth_year); end if;
    select count(*) into steps from checkins where voter = p_voter;
    select coalesce(sum(delta), 0) into stars from star_ledger where voter = p_voter;
  end if;
  today := (app.now() at time zone tz)::date; cw := app.monday(today); isod := extract(isodow from today)::int;
  mois := date_trunc('month', today::timestamp)::date;
  lvl := app.mus_level(steps);
  if p_voter is not null then
    nv := app.v_count(p_voter, cw); nc := app.c_count(p_voter, cw);
    select coalesce(json_agg(json_build_object('d', d, 'st', st) order by d), '[]') into days from (
      select day d, 'validee' st from checkins where voter = p_voter and day >= cw and day < cw + 7
      union all
      select s2.day, s2.status from sessions s2 where s2.voter = p_voter and s2.week = cw and s2.status = 'courte'
         and not exists (select 1 from checkins c where c.voter = p_voter and c.day = s2.day)) x;
    select json_build_object('id', id, 'status', status, 'started_at', app.iso(started_at),
                             'confirm_from', app.iso(started_at + make_interval(mins => app.cfgi('session_min_minutes', 20))),
                             'confirm_until', app.iso(started_at + make_interval(mins => app.cfgi('session_max_minutes', 180))),
                             'club', club_id) into sess
      from sessions where voter = p_voter and status = 'ouverte' order by started_at desc limit 1;
    select json_build_object('club', club_id, 'status', 'validee', 'points', points) into tod from checkins where voter = p_voter and day = today;
    if tod is null then
      select json_build_object('club', club_id, 'status', status, 'points', 0) into tod
        from sessions where voter = p_voter and day = today and status in ('courte', 'rejetee');
    end if;
    with t as (select (extract(hour from l) * 60 + extract(minute from l))::int m from (
                 select coalesce(started_at, created_at) at time zone tz l from checkins where voter = p_voter
                  order by coalesce(started_at, created_at) desc limit 8) y)
    select lpad((m / 60)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0') into uh
      from t order by m offset (select (count(*) - 1) / 2 from t) limit 1;
    uh := coalesce(uh, '18:00');
    select coalesce(x.points, 0) into ptsm from app.capped_points(mois, false) x where x.voter = p_voter;
    ptsm := coalesce(ptsm, 0);
    select r.points into lbp from app.lb_rows(mois, null) r where r.voter = p_voter;
    if lbp is not null then
      select count(*) + 1 into rkm from app.lb_rows(mois, null) r where r.points > lbp;
    end if;
  else
    days := '[]';
  end if;
  s := nv + least(app.cfgi('courte_max_per_week', 1), nc);
  if has_p then
    g := app.goal_at(p_voter, cw); k := app.week_kind(p, cw); ge := app.g_eff(p, cw, g); se := app.safe_eff(k, ge);
    select goal into gnext from goal_history where voter = p_voter and effective_week > cw order by effective_week limit 1;
    if gnext = g then gnext := null; end if;
    if app.now() >= p.created_at + make_interval(days => app.cfgi('goal_free_change_days', 14))
       and p.goal_changed_at + make_interval(days => app.cfgi('goal_change_days', 28)) > app.now() then
      gfrom := ((p.goal_changed_at + make_interval(days => app.cfgi('goal_change_days', 28))) at time zone tz)::date;
    end if;
    if p.sick_since is not null then
      select count(*) into conva from app.counted(p_voter) c
       where c.day >= p.sick_since and c.day >= today - (app.cfgi('heal_window_days', 7) - 1) and c.day <= today;
    end if;
    select * into pz from pauses where voter = p_voter and (end_week is null or end_week >= cw) order by start_week limit 1;
    if pz.id is not null then pzj := json_build_object('kind', pz.kind, 'start_week', pz.start_week, 'end_week', pz.end_week); end if;
    if (app.pause_at(p_voter, cw)).id is null then
      select coalesce(json_agg(json_build_object('slot', slot, 'key', quest_key, 'reward', reward, 'done', done_at is not null) order by slot), '[]')
        into qj from quests where voter = p_voter and week = cw;
    end if;
    select json_build_object('week', week, 'outcome', outcome, 'kind', kind, 'met', met,
                             'hearts_before', hearts_before, 'hearts_after', hearts_after,
                             'streak_before', streak_before, 'streak_after', streak_after,
                             'gel_used', gel_used, 'gels_after', gels_after, 'fell_sick', fell_sick,
                             'v', v_count, 'c', c_count, 's', s_count, 'g', goal_eff, 'safe', safe, 'goal', goal,
                             'stars', stars_earned, 'ange', met and outcome in ('atteint', 'doux')) into ub
      from weekly_results where voter = p_voter and seen_at is null order by week desc limit 1;
    select coalesce(json_agg(json_build_object('key', chest_key, 'kind', kind, 'item', item_id) order by granted_at, chest_key), '[]')
      into ch from chest_grants where voter = p_voter and opened_at is null and kind <> 'pas';
  end if;
  return json_build_object(
    'hearts', case when has_p then p.hearts else app.cfgi('hearts_start', 3) end,
    'hearts_max', hmax,
    'sick', has_p and p.sick_since is not null,
    'conva', json_build_object('n', conva, 'need', app.cfgi('heal_sessions', 2)),
    'streak', case when has_p then p.streak else 0 end,
    'best_streak', case when has_p then p.best_streak else 0 end,
    'gels', case when has_p then p.gels else 0 end,
    'stars', stars, 'steps', steps, 'mus_level', lvl,
    'mus_display', greatest(0, lvl - case when has_p and p.sick_since is not null then 1 else 0 end),
    'soft_mode', has_p and p.soft_mode,
    'goal', g, 'goal_next', gnext, 'goal_change_from', gfrom,
    'week', json_build_object('start', cw, 'kind', coalesce(k, 'essai'), 'g', ge, 'safe', se, 'v', nv, 'c', nc, 's', s,
                              'days_left', 8 - isod, 'days', days),
    'session', sess, 'today', tod,
    'pause', pzj,
    'pause_left_52', greatest(0, app.cfgi('pause_weeks_per_52', 6) - case when has_p then app.pause_used_52(p_voter, cw) else 0 end),
    'quests', qj, 'unseen_bilan', ub, 'chests', ch,
    'usual_hour', uh, 'points_month', ptsm, 'rank_month', rkm,
    -- en plus du §14.10
    'onboarded', has_p, 'player', p_voter is not null, 'no', pno, 'pseudo', ppseudo, 'seed', pseed,
    'weeks_ok', case when has_p then p.weeks_ok else 0 end, 'phoenix', has_p and p.phoenix,
    'healed_count', case when has_p then p.healed_count else 0 end,
    'birth_year', case when has_p then p.birth_year end, 'minor', minor,
    'home_club', case when has_p then p.home_club_id end, 'tz', tz,
    'banned', p_voter is not null and app.is_banned(p_voter),
    'server_now', app.iso(app.now()), 'contract', 1);
end $$;
create or replace function app.state_of(p_voter text) returns json language sql set search_path = public
  as $$ select app.state_json(p_voter) $$;

-- Reprise d'un compte du site : les anciennes étoiles (1 par coffre vide) valent 25 ⭐, une seule fois, bornées
create or replace function app.after_claim(p_voter text, p_old_stars integer) returns void language plpgsql set search_path = public as $$
declare n int; b int;
begin
  select count(*) into n from checkins where voter = p_voter;
  b := least(greatest(coalesce(p_old_stars, 0), 0), ceil(n * 0.4)::int + 1);
  if b > 0 then perform app.star(p_voter, b * app.cfgi('stars_per_old_star', 25), 'migration', 'site'); end if;
end $$;

-- Fusion (reprise / transfert) : l'état du jeu suit le joueur gardé ; les étoiles et coffres gagnés ne se perdent pas
create or replace function app.merge_game(p_src text, p_dst text) returns void language plpgsql set search_path = public as $$
begin
  insert into checkins (voter, day, club_id, points, dist_m, created_at, flags, started_at, session_id)
    select p_dst, day, club_id, points, dist_m, created_at, flags, started_at, session_id from checkins where voter = p_src
    on conflict do nothing;
  update sessions s set voter = p_dst where s.voter = p_src
     and not exists (select 1 from sessions d where d.voter = p_dst and d.day = s.day);
  update session_attempts set voter = p_dst where voter = p_src;
  if not exists (select 1 from profiles where voter = p_dst) then
    update profiles set voter = p_dst where voter = p_src;
    update goal_history set voter = p_dst where voter = p_src;
    update weekly_results set voter = p_dst where voter = p_src;
    update pauses set voter = p_dst where voter = p_src;
    update quests set voter = p_dst where voter = p_src;
  end if;
  update star_ledger s set voter = p_dst where s.voter = p_src
     and not exists (select 1 from star_ledger d where d.voter = p_dst and d.reason = s.reason and d.ref = s.ref);
  update chest_grants s set voter = p_dst where s.voter = p_src
     and not exists (select 1 from chest_grants d where d.voter = p_dst and d.chest_key = s.chest_key);
  update game_saves s set voter = p_dst where s.voter = p_src
     and not exists (select 1 from game_saves d where d.voter = p_dst and d.slot = s.slot);
end $$;

create or replace function app.export_game(p_voter text) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'profil', (select to_jsonb(p) - 'voter' from profiles p where voter = p_voter),
    'objectifs', (select coalesce(jsonb_agg(jsonb_build_object('from_week', effective_week, 'goal', goal, 'at', requested_at) order by effective_week), '[]') from goal_history where voter = p_voter),
    'seances', (select coalesce(jsonb_agg(to_jsonb(s) - 'voter' - 'loc_hash' order by s.started_at), '[]') from sessions s where voter = p_voter),
    'essais_30j', (select coalesce(jsonb_agg(to_jsonb(a) - 'voter' - 'id' order by a.at), '[]') from session_attempts a where voter = p_voter),
    'bilans', (select coalesce(jsonb_agg(to_jsonb(w) - 'voter' order by w.week), '[]') from weekly_results w where voter = p_voter),
    'pauses', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'start_week', start_week, 'end_week', end_week) order by start_week), '[]') from pauses where voter = p_voter),
    'quetes', (select coalesce(jsonb_agg(to_jsonb(q) - 'voter' order by q.week, q.slot), '[]') from quests q where voter = p_voter),
    'etoiles', (select coalesce(jsonb_agg(jsonb_build_object('delta', delta, 'raison', reason, 'ref', ref, 'at', created_at) order by id), '[]') from star_ledger where voter = p_voter),
    'coffres', (select coalesce(jsonb_agg(to_jsonb(c) - 'voter' order by c.granted_at), '[]') from chest_grants c where voter = p_voter),
    'sauvegardes', (select coalesce(jsonb_object_agg(slot, data), '{}'::jsonb) from game_saves where voter = p_voter))
$$;

-- -----------------------------------------------------------------------------------------------------
-- 8. RPC du jeu (le joueur vient du jeton ; chacune rend l'état complet dans « state »)
-- -----------------------------------------------------------------------------------------------------
-- 8.1 Tout l'état en un appel (au lancement, au retour au premier plan, après une action)
create or replace function public.my_state() returns json language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return app.state_json(null); end if;
  perform app.lock_player(v);
  perform app.touch(v);
  return app.state_json(v);
end $$;

-- 8.2 Choisir l'objectif (inscription : crée le profil) ou le changer (effet le lundi suivant ; pendant la semaine
--     d'inscription, effet immédiat ; après 14 jours, une demande toutes les 4 semaines)
create or replace function public.set_goal(p_goal integer) returns json language plpgsql security definer set search_path = public as $$
declare v text; p public.profiles; today date; cw date; cur int; legacy boolean; pion jsonb;
begin
  v := app.ensure_player();
  perform app.lock_player(v);
  if p_goal is null or p_goal < app.cfgi('goal_min', 2) or p_goal > app.cfgi('goal_max', 5) then
    return json_build_object('ok', false, 'why', 'hors_limites', 'min', app.cfgi('goal_min', 2), 'max', app.cfgi('goal_max', 5));
  end if;
  select * into p from profiles where voter = v;
  if not found then
    today := app.local_day('Europe/Paris'); cw := app.monday(today);
    legacy := exists (select 1 from checkins where voter = v);      -- joueur du site : 1 gel offert d'office
    insert into profiles (voter, created_at, first_week, created_isodow, hearts, gels, first_gel_done, goal_changed_at)
      values (v, app.now(), cw, extract(isodow from today)::int, app.cfgi('hearts_start', 3),
              case when legacy then 1 else 0 end, legacy, app.now());
    insert into goal_history (voter, effective_week, goal, requested_at) values (v, cw, p_goal, app.now());
    pion := app.cfg('pionnier_until');
    if pion is null or pion = 'null'::jsonb or app.now() < (pion #>> '{}')::timestamptz then
      insert into chest_grants (voter, chest_key, kind, item_id, granted_at) values (v, 'pionnier', 'pionnier', 'echarpe_pionnier', app.now())
        on conflict do nothing;
    end if;
    perform app.touch(v);
    return json_build_object('ok', true, 'state', app.state_json(v));
  end if;
  perform app.touch(v);
  today := app.local_day(p.tz); cw := app.monday(today); cur := app.goal_at(v, cw);
  if cw = p.first_week then                                    -- semaine d'inscription : on se calibre, effet immédiat
    insert into goal_history (voter, effective_week, goal, requested_at) values (v, cw, p_goal, app.now())
      on conflict (voter, effective_week) do update set goal = excluded.goal, requested_at = excluded.requested_at;
    delete from goal_history where voter = v and effective_week > cw;
  elsif p_goal = cur then                                      -- annule un changement prévu
    delete from goal_history where voter = v and effective_week > cw;
    return json_build_object('ok', true, 'state', app.state_json(v));
  else
    if app.now() >= p.created_at + make_interval(days => app.cfgi('goal_free_change_days', 14))
       and p.goal_changed_at + make_interval(days => app.cfgi('goal_change_days', 28)) > app.now() then
      return json_build_object('ok', false, 'why', 'trop_tot', 'next_date',
        ((p.goal_changed_at + make_interval(days => app.cfgi('goal_change_days', 28))) at time zone p.tz)::date);
    end if;
    delete from goal_history where voter = v and effective_week > cw + 7;
    insert into goal_history (voter, effective_week, goal, requested_at) values (v, cw + 7, p_goal, app.now())
      on conflict (voter, effective_week) do update set goal = excluded.goal, requested_at = excluded.requested_at;
  end if;
  update profiles set goal_changed_at = app.now(), updated_at = now() where voter = v;
  perform app.refresh_quests(v, cw);
  return json_build_object('ok', true, 'state', app.state_json(v));
end $$;

-- 8.3 « Je suis à la salle » (§14.2) : le serveur choisit lui-même la salle la plus proche.
--     p_meta (facultatif, plugin natif) : {"simulated":bool,"accessory":bool,"app":"1.0.0"} (signaux, pas des refus)
create or replace function public.session_start(p_lat double precision, p_lon double precision, p_acc double precision,
                                                p_meta jsonb default '{}'::jsonb) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; p public.profiles; c record; d double precision; jour date; fl text[] := '{}'; s record; meta jsonb := coalesce(p_meta, '{}');
        lh text; nref int; last_at timestamptz; prev record; km double precision; nid bigint; t0 timestamptz := app.now();
begin
  perform app.require_access();
  v := app.ensure_player();
  perform app.lock_player(v);
  select * into p from profiles where voter = v;
  if not found then return json_build_object('ok', false, 'why', 'objectif'); end if;
  if app.is_banned(v) then return json_build_object('ok', false, 'why', 'bloque'); end if;
  perform app.touch(v);
  select count(*) filter (where why in ('precision', 'loin', 'position')), max(at) into nref, last_at from session_attempts
   where voter = v and at >= (app.local_day(p.tz)::timestamp at time zone p.tz);
  if nref >= app.cfgi('start_refused_per_day', 8) then return json_build_object('ok', false, 'why', 'quota'); end if;
  if last_at > t0 - interval '3 seconds' then return json_build_object('ok', false, 'why', 'vite'); end if;
  if p_lat is null or p_lon is null or not (p_lat between -90 and 90) or not (p_lon between -180 and 180) then
    insert into session_attempts (voter, at, why) values (v, t0, 'position');
    return json_build_object('ok', false, 'why', 'position');
  end if;
  if p_acc is null or not (p_acc > 0 and p_acc <= app.cfgi('acc_max_m', 150)) then
    insert into session_attempts (voter, at, why, acc_m) values (v, t0, 'precision', least(round(coalesce(p_acc, 9999)), 9999));
    return json_build_object('ok', false, 'why', 'precision', 'acc', least(round(coalesce(p_acc, 9999)), 9999));
  end if;
  -- une séance déjà ouverte (même d'hier soir, encore dans sa fenêtre) ?
  select id, status, started_at, club_id into s from sessions where voter = v and status = 'ouverte' order by started_at desc limit 1;
  if found then
    return json_build_object('ok', false, 'why', 'en_cours', 'session', (app.state_json(v) -> 'session'));
  end if;
  select club_id, lat, lon, tz, app.dist_m(p_lat, p_lon, lat, lon) dd into c from club_geo
   where lat is not null and lon is not null order by 5 limit 1;
  if not found then return json_build_object('ok', false, 'why', 'salle'); end if;
  d := c.dd;
  if d > app.cfgi('radius_base_m', 200) + least(p_acc, app.cfgi('radius_acc_bonus_max_m', 100)) then
    insert into session_attempts (voter, at, why, club_id, dist_m, acc_m)
      values (v, t0, 'loin', c.club_id, case when d < 2000 then (round(d / 10) * 10)::int end, round(p_acc));
    return json_build_object('ok', false, 'why', 'loin', 'dist', round(d), 'club', c.club_id);
  end if;
  jour := (t0 at time zone c.tz)::date;
  if exists (select 1 from checkins where voter = v and day = jour) or exists (select 1 from sessions where voter = v and day = jour) then
    insert into session_attempts (voter, at, why, club_id, acc_m) values (v, t0, 'deja', c.club_id, round(p_acc));
    return json_build_object('ok', false, 'why', 'deja',
      'club', coalesce((select club_id from checkins where voter = v and day = jour), (select club_id from sessions where voter = v and day = jour)));
  end if;
  -- signaux faibles, notés, jamais bloquants
  lh := app.loc_hash(p_lat, p_lon);
  if meta -> 'simulated' = 'true'::jsonb then fl := fl || 'sim'::text; end if;
  if meta -> 'accessory' = 'true'::jsonb then fl := fl || 'accessoire'::text; end if;
  if d < 1 then fl := fl || 'exact'::text; end if;
  if p_acc <= 3 then fl := fl || 'precis'::text; end if;
  if extract(hour from (t0 at time zone c.tz)) < 5 then fl := fl || 'nuit'::text; end if;
  if exists (select 1 from sessions where voter = v and loc_hash = lh) then fl := fl || 'meme_pos'::text; end if;
  select x.started_at, g.lat, g.lon into prev from sessions x join club_geo g on g.club_id = x.club_id
   where x.voter = v and x.started_at > t0 - interval '3 hours' and x.club_id <> c.club_id order by x.started_at desc limit 1;
  if found then
    km := app.dist_m(prev.lat, prev.lon, c.lat, c.lon) / 1000;
    if km > 30 and km / greatest(extract(epoch from t0 - prev.started_at) / 3600, 1.0 / 60) > 250 then fl := fl || 'vitesse'::text; end if;
  end if;
  insert into sessions (voter, club_id, day, week, started_at, start_dist_m, start_acc_m, loc_hash, flags)
    values (v, c.club_id, jour, app.monday(jour), t0, round(d), round(p_acc), lh, fl) returning id into nid;
  insert into session_attempts (voter, at, why, club_id, dist_m, acc_m) values (v, t0, 'ok', c.club_id, (round(d / 10) * 10)::int, round(p_acc));
  return json_build_object('ok', true, 'dist', round(d), 'club', c.club_id, 'session', (app.state_json(v) -> 'session'),
                           'state', app.state_json(v));
end $$;

-- 8.4 « J'ai fini » (§14.3) : entre +20 min et +3 h, toujours près de la même salle
create or replace function public.session_confirm(p_session bigint, p_lat double precision, p_lon double precision,
                                                  p_acc double precision, p_meta jsonb default '{}'::jsonb) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; p public.profiles; s public.sessions; c record; d double precision; fl text[]; lh text; rk int; pts int;
        healed boolean; t0 timestamptz := app.now(); last_at timestamptz; meta jsonb := coalesce(p_meta, '{}'); n int;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  perform app.lock_player(v);
  select * into p from profiles where voter = v;
  select * into s from sessions where id = p_session and voter = v for update;
  if not found then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  if s.status = 'validee' then return json_build_object('ok', false, 'why', 'deja', 'state', app.state_json(v)); end if;
  if s.status <> 'ouverte' then return json_build_object('ok', false, 'why', 'expiree', 'state', app.state_json(v)); end if;
  if t0 > s.started_at + make_interval(mins => app.cfgi('session_max_minutes', 180)) then
    perform app.touch(v);                                     -- elle devient « courte »
    return json_build_object('ok', false, 'why', 'expiree', 'state', app.state_json(v));
  end if;
  if t0 < s.started_at + make_interval(mins => app.cfgi('session_min_minutes', 20)) then
    return json_build_object('ok', false, 'why', 'trop_tot',
      'wait_s', ceil(extract(epoch from s.started_at + make_interval(mins => app.cfgi('session_min_minutes', 20)) - t0))::int);
  end if;
  select max(at) into last_at from session_attempts where voter = v;
  if last_at > t0 - interval '3 seconds' then return json_build_object('ok', false, 'why', 'vite'); end if;
  if p_lat is null or p_lon is null or not (p_lat between -90 and 90) or not (p_lon between -180 and 180) then
    return json_build_object('ok', false, 'why', 'position');
  end if;
  if p_acc is null or not (p_acc > 0 and p_acc <= app.cfgi('acc_max_m', 150)) then
    insert into session_attempts (voter, at, why, club_id, acc_m) values (v, t0, 'fin_precision', s.club_id, least(round(coalesce(p_acc, 9999)), 9999));
    return json_build_object('ok', false, 'why', 'precision', 'acc', least(round(coalesce(p_acc, 9999)), 9999));
  end if;
  select lat, lon into c from club_geo where club_id = s.club_id;
  d := app.dist_m(p_lat, p_lon, c.lat, c.lon);
  if d > app.cfgi('radius_base_m', 200) + least(p_acc, app.cfgi('radius_acc_bonus_max_m', 100)) then
    insert into session_attempts (voter, at, why, club_id, dist_m, acc_m)
      values (v, t0, 'fin_loin', s.club_id, case when d < 2000 then (round(d / 10) * 10)::int end, round(p_acc));
    return json_build_object('ok', false, 'why', 'loin', 'dist', round(d), 'club', s.club_id,
                             'until', app.iso(s.started_at + make_interval(mins => app.cfgi('session_max_minutes', 180))));
  end if;
  lh := app.loc_hash(p_lat, p_lon); fl := s.flags;
  if lh = s.loc_hash and not ('meme_pos' = any (fl)) then fl := fl || 'meme_pos'::text; end if;
  if meta -> 'simulated' = 'true'::jsonb and not ('sim' = any (fl)) then fl := fl || 'sim'::text; end if;
  if p_acc <= 3 and s.start_acc_m <= 3 and not ('precis' = any (fl)) then fl := fl || 'precis'::text; end if;
  rk := app.v_count(v, s.week) + 1;
  pts := case when rk <= app.cfgi('points_max_sessions_per_week', 6) then app.cfgi('points_per_session', 10) else 0 end;
  insert into checkins (voter, day, club_id, points, dist_m, created_at, flags, started_at, session_id)
    values (v, s.day, s.club_id, pts, round(d), t0, fl, s.started_at, s.id) on conflict do nothing;
  if not found then pts := 0; end if;                        -- (une séance du site le même jour : déjà comptée)
  update sessions set status = 'validee', confirmed_at = t0, confirm_dist_m = round(d), confirm_acc_m = round(p_acc),
                      week_rank = rk, points = pts, flags = fl where id = s.id;
  insert into session_attempts (voter, at, why, club_id, dist_m, acc_m) values (v, t0, 'fin_ok', s.club_id, (round(d / 10) * 10)::int, round(p_acc));
  if not p.first_gel_done then                               -- 1 gel offert à la 1re séance validée
    update profiles set gels = least(app.cfgi('gels_max', 2), gels + 1), first_gel_done = true where voter = v;
  end if;
  healed := app.after_counted(v, s.day);
  perform app.ensure_quests(v, s.week);
  perform app.refresh_quests(v, s.week);
  perform app.touch(v);
  select count(*) into n from checkins where voter = v;
  return json_build_object('ok', true, 'points', pts, 'steps', n,
                           'chest_due', n % 10 in (0, 3, 6),
                           'heal', healed, 'hearts', (select hearts from profiles where voter = v),
                           'state', app.state_json(v));
end $$;

-- 8.5 Pause (semaines entières, 6 par 52 semaines) ou hibernation (sans limite, série remise à 0)
--     Du lundi au mercredi, elle couvre la semaine en cours ; du jeudi au dimanche, elle commence lundi prochain.
create or replace function public.pause_start(p_kind text, p_weeks integer default 1) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; p public.profiles; today date; cw date; st date; used int; lim int := app.cfgi('pause_weeks_per_52', 6);
begin
  perform app.require_access();
  v := app.me();
  if v is null or not exists (select 1 from profiles where voter = v) then return json_build_object('ok', false, 'why', 'objectif'); end if;
  perform app.lock_player(v);
  perform app.touch(v);
  select * into p from profiles where voter = v;
  if p_kind is null or p_kind not in ('pause', 'hibernation') then return json_build_object('ok', false, 'why', 'type'); end if;
  today := app.local_day(p.tz); cw := app.monday(today);
  st := case when extract(isodow from today) <= app.cfgi('pause_same_week_until_isodow', 3) then cw else cw + 7 end;
  if exists (select 1 from pauses where voter = v and (end_week is null or end_week >= st)) then
    return json_build_object('ok', false, 'why', 'deja', 'state', app.state_json(v));
  end if;
  if p_kind = 'pause' then
    if p_weeks is null or p_weeks < 1 or p_weeks > lim then return json_build_object('ok', false, 'why', 'duree', 'max', lim); end if;
    used := app.pause_used_52(v, cw);
    if used + p_weeks > lim then return json_build_object('ok', false, 'why', 'quota', 'reste', greatest(lim - used, 0)); end if;
    insert into pauses (voter, kind, start_week, end_week) values (v, 'pause', st, st + 7 * (p_weeks - 1));
  else
    insert into pauses (voter, kind, start_week, end_week) values (v, 'hibernation', st, null);
    update profiles set streak = 0, updated_at = now() where voter = v;     -- prévenu dans l'interface
  end if;
  if st = cw then delete from quests where voter = v and week = cw and done_at is null; end if;   -- pas de quêtes en pause
  return json_build_object('ok', true, 'from', st, 'state', app.state_json(v));
end $$;

-- Fin anticipée : la semaine en cours reste couverte, la suite est annulée (et rendue au quota)
create or replace function public.pause_end() returns json language plpgsql security definer set search_path = public as $$
declare v text; p public.profiles; cw date; z public.pauses;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('ok', false, 'why', 'aucune'); end if;
  perform app.lock_player(v);
  perform app.touch(v);
  select * into p from profiles where voter = v;
  if not found then return json_build_object('ok', false, 'why', 'aucune'); end if;
  cw := app.monday(app.local_day(p.tz));
  select * into z from pauses where voter = v and (end_week is null or end_week >= cw) order by start_week limit 1;
  if z.id is null then return json_build_object('ok', false, 'why', 'aucune', 'state', app.state_json(v)); end if;
  if z.start_week > cw then delete from pauses where id = z.id;
  else update pauses set end_week = cw where id = z.id; end if;
  return json_build_object('ok', true, 'state', app.state_json(v));
end $$;

-- 8.6 Mode doux, âge, salle principale
create or replace function public.set_soft_mode(p_on boolean) returns json language plpgsql security definer set search_path = public as $$
declare v text; p public.profiles;
begin
  perform app.require_access();
  v := app.me();
  select * into p from profiles where voter = v;
  if not found then return json_build_object('ok', false, 'why', 'objectif'); end if;
  perform app.lock_player(v);
  perform app.touch(v);
  if not coalesce(p_on, false) and app.is_minor(p.birth_year) then return json_build_object('ok', false, 'why', 'mineur'); end if;
  update profiles set soft_mode = coalesce(p_on, false), updated_at = now() where voter = v;
  return json_build_object('ok', true, 'state', app.state_json(v));
end $$;

create or replace function public.set_birth_year(p_year integer) returns json language plpgsql security definer set search_path = public as $$
declare v text; y int := extract(year from app.now())::int;
begin
  perform app.require_access();
  v := app.me();
  if v is null or not exists (select 1 from profiles where voter = v) then return json_build_object('ok', false, 'why', 'objectif'); end if;
  perform app.lock_player(v);
  if p_year is null or p_year < 1900 or p_year > y then return json_build_object('ok', false, 'why', 'invalide'); end if;
  if y - p_year < app.cfgi('min_age', 15) then return json_build_object('ok', false, 'why', 'age', 'min_age', app.cfgi('min_age', 15)); end if;
  update profiles set birth_year = p_year, soft_mode = soft_mode or (y - p_year < app.cfgi('adult_age', 18)), updated_at = now() where voter = v;
  perform app.touch(v);
  return json_build_object('ok', true, 'state', app.state_json(v));
end $$;

create or replace function public.set_home_club(p_club text) returns json language plpgsql security definer set search_path = public as $$
declare v text; z text;
begin
  perform app.require_access();
  v := app.me();
  if v is null or not exists (select 1 from profiles where voter = v) then return json_build_object('ok', false, 'why', 'objectif'); end if;
  perform app.lock_player(v);
  if p_club is null then
    update profiles set home_club_id = null, tz = 'Europe/Paris', updated_at = now() where voter = v;
  else
    select tz into z from club_geo where club_id = p_club;
    if not found then return json_build_object('ok', false, 'why', 'salle'); end if;
    update profiles set home_club_id = p_club, tz = z, updated_at = now() where voter = v;
  end if;
  perform app.touch(v);
  return json_build_object('ok', true, 'state', app.state_json(v));
end $$;

-- 8.7 Bilan vu (animation montrée une fois) : marque la semaine et toutes les précédentes
create or replace function public.ack_bilan(p_week date) returns json language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('ok', false); end if;
  update weekly_results set seen_at = now() where voter = v and week <= p_week and seen_at is null;
  return json_build_object('ok', true, 'state', app.state_json(v));
end $$;

-- 8.8 Ouvrir un coffre. Clés : 'semaine:AAAA-MM-JJ', 'palier:8', 'pionnier' (droits donnés par le serveur), ou
--     'pas:N' (coffres du chemin, N ≤ séances validées). Le tirage cosmétique est fait par l'appli (V1) ;
--     p_empty = true si la collection n'avait plus rien à donner : étoiles à la place, une seule fois par coffre.
create or replace function public.open_chest(p_key text, p_empty boolean default false) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; cg public.chest_grants; n int; steps int; gain int := 0;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  perform app.lock_player(v);
  if p_key ~ '^pas:[0-9]{1,5}$' then
    n := substr(p_key, 5)::int;
    select count(*) into steps from checkins where voter = v;
    if n < 1 or n > steps or n % 10 not in (0, 3, 5, 6) then return json_build_object('ok', false, 'why', 'introuvable'); end if;
    insert into chest_grants (voter, chest_key, kind, granted_at, opened_at) values (v, p_key, 'pas', app.now(), app.now())
      on conflict (voter, chest_key) do nothing;
    if coalesce(p_empty, false) then
      gain := app.star(v, case when n % 10 = 0 then app.cfgi('stars_empty_big_chest', 50) else app.cfgi('stars_empty_chest', 25) end,
                       'coffre_vide', p_key);
    end if;
    return json_build_object('ok', true, 'key', p_key, 'stars', gain, 'state', app.state_json(v));
  end if;
  select * into cg from chest_grants where voter = v and chest_key = p_key for update;
  if not found or cg.kind = 'pas' then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  if cg.opened_at is null then update chest_grants set opened_at = app.now() where voter = v and chest_key = p_key; end if;
  if coalesce(p_empty, false) and cg.kind = 'semaine' then
    gain := app.star(v, app.cfgi('stars_week_chest_full', 40), 'semaine_vide', p_key);
  end if;
  return json_build_object('ok', true, 'key', p_key, 'kind', cg.kind, 'item', cg.item_id, 'already', cg.opened_at is not null,
                           'stars', gain, 'state', app.state_json(v));
end $$;

-- 8.9 Classement plafonné (6 séances par semaine, comptes bannis, mineurs, masqués et séances signalées exclus)
--     p_period : 'month' (mois en cours, heure de Paris) ou 'all'. « steps » sert à placer les fantômes.
create or replace function public.leaderboard_v2(p_period text default 'month') returns json
  language plpgsql stable security definer set search_path = public as $$
declare v text; d0 date;
begin
  perform app.require_access();
  v := app.me();
  d0 := case when p_period = 'all' then date '2000-01-01' else date_trunc('month', app.local_day('Europe/Paris')::timestamp)::date end;
  return (select coalesce(json_agg(json_build_object('no', r.no, 'pseudo', ps.pseudo, 'points', r.points, 'clubs', r.clubs,
                                                     'steps', (select count(*) from checkins c where c.voter = r.voter),
                                                     'me', r.voter = v) order by r.points desc, r.last), '[]'::json)
            from (select * from app.lb_rows(d0, v) order by points desc, last limit 50) r left join pseudos ps on ps.voter = r.voter);
end $$;

-- 8.10 Le dernier bilan (Ange de la semaine = objectif personnel atteint). Mêmes clés n et week que prev_week(p_voter).
create or replace function public.prev_week_v2() returns json language plpgsql security definer set search_path = public as $$
declare v text; r public.weekly_results;
begin
  perform app.require_access();
  v := app.me();
  if v is not null then perform app.lock_player(v); perform app.touch(v); end if;
  select * into r from weekly_results where voter = v order by week desc limit 1;
  if r.week is null then
    return json_build_object('n', 0, 'week', to_char(app.monday(app.local_day('Europe/Paris')), 'IYYY-IW'), 'ange', false);
  end if;
  return json_build_object('n', r.s_count, 'week', to_char(r.week + 7, 'IYYY-IW'), 'bilan_week', r.week, 'outcome', r.outcome,
                           'met', r.met, 'g', r.goal_eff, 'ange', r.met and r.outcome in ('atteint', 'doux'));
end $$;

-- 8.11 Sauvegarde du jeu (4-backend §5) : verrouillage optimiste entre appareils
create or replace function public.load_game() returns json language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('player', false); end if;
  return json_build_object(
    'player', true,
    'seed', (select coalesce(game_seed, voter) from players where voter = v),
    'steps', (select count(*) from checkins where voter = v),
    'game', (select json_build_object('data', data, 'version', version, 'updated_at', app.iso(updated_at)) from game_saves where voter = v and slot = 'game'),
    'prefs', (select json_build_object('data', data, 'version', version, 'updated_at', app.iso(updated_at)) from game_saves where voter = v and slot = 'prefs'),
    'chests', (select coalesce(json_agg(json_build_object('key', chest_key, 'kind', kind, 'item', item_id, 'opened', opened_at is not null) order by granted_at), '[]')
                 from chest_grants where voter = v));
end $$;

create or replace function public.save_game(p_slot text, p_data jsonb, p_version integer) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; cur public.game_saves; nb int; nv int;
begin
  perform app.require_access();
  v := app.ensure_player();
  perform app.lock_player(v);
  if p_slot is null or p_slot not in ('game', 'prefs') then return json_build_object('ok', false, 'why', 'emplacement'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return json_build_object('ok', false, 'why', 'invalide'); end if;
  if octet_length(p_data::text) > 32768 then return json_build_object('ok', false, 'why', 'trop_gros'); end if;
  if p_slot = 'game' and jsonb_typeof(p_data -> 'seen') = 'number' and not is_admin() then
    select count(*) into nb from checkins where voter = v;  -- le héros ne marche pas plus loin que les séances validées
    if (p_data ->> 'seen')::numeric > nb then p_data := jsonb_set(p_data, '{seen}', to_jsonb(nb)); end if;
  end if;
  select * into cur from game_saves where voter = v and slot = p_slot;
  if not found then
    insert into game_saves (voter, slot, data) values (v, p_slot, p_data);
    return json_build_object('ok', true, 'version', 1);
  end if;
  if p_version is distinct from cur.version then
    return json_build_object('ok', false, 'why', 'conflit', 'version', cur.version, 'data', cur.data, 'updated_at', app.iso(cur.updated_at));
  end if;
  if cur.updated_at > now() - interval '2 seconds' then return json_build_object('ok', false, 'why', 'vite', 'version', cur.version); end if;
  update game_saves set data = p_data, version = version + 1, updated_at = now()
   where voter = v and slot = p_slot returning version into nv;
  return json_build_object('ok', true, 'version', nv);
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 9. Admin et tâches planifiées
-- -----------------------------------------------------------------------------------------------------
create or replace function public.admin_suspects(p_days integer default 30) returns json
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  return (select coalesce(json_agg(t order by t.score desc), '[]'::json) from (
    select p.visitor_no as no, ps.pseudo, count(*) as sessions, sum(app.flag_score(s.flags)) as score,
           (select array_agg(distinct f) from sessions s2, unnest(s2.flags) f where s2.voter = p.voter
             and s2.started_at > now() - make_interval(days => p_days)) as kinds,
           json_agg(json_build_object('id', s.id, 'day', s.day, 'club', s.club_id, 'status', s.status, 'flags', s.flags) order by s.started_at desc) as list
      from sessions s join players p on p.voter = s.voter left join pseudos ps on ps.voter = p.voter
     where s.started_at > now() - make_interval(days => p_days) and s.flags <> '{}'
     group by p.voter, p.visitor_no, ps.pseudo) t);
end $$;

-- Refuser une séance après examen (elle ne compte plus nulle part ; les bilans déjà faits restent figés)
create or replace function public.admin_reject_session(p_id bigint) returns json
  language plpgsql security definer set search_path = public as $$
declare s public.sessions;
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  select * into s from sessions where id = p_id for update;
  if not found then return json_build_object('ok', false); end if;
  update sessions set status = 'rejetee', points = 0 where id = p_id;
  delete from checkins where voter = s.voter and day = s.day and session_id = p_id;
  return json_build_object('ok', true);
end $$;

-- Tous les bilans en retard (pour pg_cron, utile le jour où l'on enverra des push ; sinon tout se fait au passage)
create or replace function app.settle_all(p_limit integer default 500) returns integer language plpgsql set search_path = public as $$
declare v text; n int := 0;
begin
  for v in select voter from profiles where coalesce(last_settled_week + 7, first_week) <= app.settle_upto(tz)
            order by last_settled_week nulls first limit p_limit loop
    perform app.lock_player(v);
    perform app.settle_due(v);
    n := n + 1;
  end loop;
  return n;
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 10. DROITS : tout fermé, puis ouverture explicite (voir 02-comptes.sql §7)
-- -----------------------------------------------------------------------------------------------------
do $$
declare t text; f regprocedure; s text;
begin
  foreach t in array array['profiles', 'goal_history', 'sessions', 'session_attempts', 'weekly_results', 'pauses',
                           'quests', 'star_ledger', 'chest_grants', 'game_saves'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'id') then
      s := pg_get_serial_sequence('public.' || t, 'id');
      if s is not null then execute format('revoke all on sequence %s from public, anon, authenticated', s); end if;
    end if;
  end loop;
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'app'::regnamespace loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.my_state()', 'public.set_goal(integer)',
    'public.session_start(double precision, double precision, double precision, jsonb)',
    'public.session_confirm(bigint, double precision, double precision, double precision, jsonb)',
    'public.pause_start(text, integer)', 'public.pause_end()', 'public.set_soft_mode(boolean)', 'public.set_birth_year(integer)',
    'public.set_home_club(text)', 'public.ack_bilan(date)', 'public.open_chest(text, boolean)', 'public.leaderboard_v2(text)',
    'public.prev_week_v2()', 'public.load_game()', 'public.save_game(text, jsonb, integer)',
    'public.admin_suspects(integer)', 'public.admin_reject_session(bigint)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
