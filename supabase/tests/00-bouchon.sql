-- =====================================================================================================
-- BOUCHON « Supabase » pour les tests locaux (Postgres 16 jetable). JAMAIS sur la vraie base.
-- Reproduit ce dont les migrations ont besoin : rôles anon / authenticated / service_role, schéma auth
-- (auth.users, auth.uid() et auth.jwt() lus dans des réglages de session), pgcrypto dans « extensions »,
-- les droits par défaut de Supabase (toute nouvelle table ou fonction de public est donnée à anon et
-- authenticated : c'est le piège F12 de 4-backend.md), et les tables existantes relevées sur le vrai projet
-- (admins, settings, club_geo, reviews, review_votes, photos, visits, is_admin, vote_review, déclencheurs).
-- Les 3 scripts supabase-*.sql du dépôt sont joués juste après par lancer.sh.
-- =====================================================================================================
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create schema extensions;
create schema storage;
create extension pgcrypto schema extensions;

-- auth.users (seulement les colonnes utiles)
create table auth.users (
  id uuid primary key,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
-- Comme sur Supabase : le jeton est lu dans des réglages de session posés par l'API (ici par les tests)
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(coalesce(current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claims', true)::jsonb ->> 'sub'), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema auth, extensions, storage to anon, authenticated;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Droits par défaut de Supabase (pg_default_acl du projet) : le piège F12
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- ---- Schéma existant reconstitué (lu sur le vrai projet) ----
create table public.admins (user_id uuid primary key references auth.users on delete cascade);
create table public.settings (key text primary key, value jsonb);
create table public.club_geo (club_id text primary key check (club_id ~ '^[a-z0-9-]{1,80}$'), lat double precision, lon double precision);
create table public.reviews (id uuid primary key default gen_random_uuid(), club_id text not null,
  rating smallint not null check (rating between 1 and 10), comment text, hidden boolean not null default false,
  created_at timestamptz not null default now(), up integer not null default 0, down integer not null default 0);
create table public.review_votes (review_id uuid references public.reviews on delete cascade, voter text check (voter ~ '^[0-9a-f]{32}$'),
  value smallint check (value in (-1, 1)), created_at timestamptz not null default now(), primary key (review_id, voter));
create table public.photos (id uuid primary key default gen_random_uuid(), club_id text, path text unique,
  approved boolean default false, by_admin boolean default false, created_at timestamptz default now());
create table public.visits (club_id text primary key, visited_on date default current_date, note text);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
create function public.reviews_flood() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reviews where club_id = new.club_id and created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Trop d''avis récents pour cette salle, réessaie plus tard.';
  end if;
  return new;
end $$;
create function public.reviews_zero_votes() returns trigger language plpgsql as $$ begin new.up := 0; new.down := 0; return new; end $$;
create trigger reviews_flood before insert on public.reviews for each row execute function public.reviews_flood();
create trigger reviews_zero_votes before insert on public.reviews for each row execute function public.reviews_zero_votes();
alter table public.reviews enable row level security;
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.club_geo enable row level security;
alter table public.review_votes enable row level security;
alter table public.photos enable row level security;
alter table public.visits enable row level security;
revoke all on public.review_votes, public.admins from anon, authenticated;
create policy "avis: lecture publique" on public.reviews for select using ((not hidden) or is_admin());
create policy "avis: tout le monde peut noter" on public.reviews for insert to anon, authenticated
  with check (is_admin() or (hidden = (comment is not null)));
create policy "avis: admin modifie" on public.reviews for update using (is_admin());
create policy "réglages: lecture" on public.settings for select using (true);
create policy "réglages: admin" on public.settings for all using (is_admin()) with check (is_admin());
create policy "positions: lecture" on public.club_geo for select using (true);
create policy "positions: admin" on public.club_geo for all using (is_admin()) with check (is_admin());
create policy "photos: lecture" on public.photos for select using (approved or is_admin());
create policy "photos: envoi" on public.photos for insert to anon, authenticated
  with check (is_admin() or ((approved = false) and (by_admin = false) and (path like 'pending/%')));
create policy "photos: admin" on public.photos for update using (is_admin());
create policy "visites: lecture" on public.visits for select using (true);
create function public.vote_review(p_review uuid, p_voter text, p_value integer) returns json
  language plpgsql security definer set search_path = public as $function$
declare old smallint; res json;
begin
  if p_voter is null or p_voter !~ '^[0-9a-f]{32}$' or p_value not in (-1, 0, 1) then raise exception 'Vote invalide'; end if;
  perform 1 from reviews where id = p_review and not hidden and comment is not null for update;
  if not found then raise exception 'Commentaire introuvable'; end if;
  select value into old from review_votes where review_id = p_review and voter = p_voter;
  if old is distinct from p_value::smallint and not (old is null and p_value = 0) then
    if old is not null then
      delete from review_votes where review_id = p_review and voter = p_voter;
      update reviews set up = greatest(up - (old = 1)::int, 0), down = greatest(down - (old = -1)::int, 0) where id = p_review;
    end if;
    if p_value <> 0 then
      insert into review_votes (review_id, voter, value) values (p_review, p_voter, p_value);
      update reviews set up = up + (p_value = 1)::int, down = down + (p_value = -1)::int where id = p_review;
    end if;
  end if;
  select json_build_object('up', up, 'down', down) into res from reviews where id = p_review;
  return res;
end $function$;

-- Données : fonctionnalités allumées, quelques salles (dont la Guadeloupe) et un admin
insert into public.settings values ('feat_points', 'true'), ('feat_pseudo', 'true'), ('feat_angel', 'true');
insert into public.club_geo values
  ('lognes', 48.8354, 2.63), ('melun-patton', 48.5457, 2.6536), ('lagny-sur-marne', 48.8667, 2.7167),
  ('torcy', 48.8502, 2.6508), ('guadeloupe-jarry', 16.2674, -61.5854), ('guadeloupe-bergevin', 16.2364, -61.5346);
insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-00000000ad00', false);
insert into public.admins values ('00000000-0000-0000-0000-00000000ad00');
