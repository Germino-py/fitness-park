-- =====================================================================================================
-- HMG Fitness · 02 · Comptes v2 (Supabase Auth anonyme), reprise des comptes du site, accès privé,
-- transfert d'appareil, suppression, export, ménage. D'après 4-backend.md (annexe A §1 à §4, §9, §10).
-- À coller dans Supabase → SQL Editor → Run, APRÈS 01. Transactionnel (tout ou rien), rejouable.
-- Additif : aucune table existante n'est vidée ni réécrite ; les anciennes fonctions à p_voter (checkin,
-- my_score, leaderboard, set_pseudo, pseudo_check, pseudo_list, my_pseudo, prev_week, vote_review)
-- ne sont PAS touchées et continuent de marcher pour le site.
-- Prérequis dans le tableau de bord : voir supabase/LISEZMOI.md (connexions anonymes, etc.).
-- Règle d'or : le joueur vient TOUJOURS du jeton (auth.uid()), jamais d'un paramètre.
-- =====================================================================================================
begin;

-- -----------------------------------------------------------------------------------------------------
-- 1. Schéma interne « app » : fonctions internes, jamais exposées par l'API
--    (ne pas l'ajouter dans Settings → API → Exposed schemas)
-- -----------------------------------------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public;
alter default privileges for role postgres in schema app revoke execute on functions from public;

-- -----------------------------------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------------------------------
-- 2.1 Joueurs : « voter » devient un identifiant INTERNE ; le propriétaire est le compte Supabase Auth.
alter table public.players add column if not exists user_id uuid unique references auth.users on delete cascade;
alter table public.players add column if not exists claimed_at timestamptz;
-- graine des tirages de l'aventure : null = la clé « voter » (joueurs du site : tirages identiques)
alter table public.players add column if not exists game_seed text check (game_seed ~ '^[0-9a-f]{32}$');

-- Réglages internes (fermés à l'API). Le jeu y ajoute ses règles (03-jeu.sql).
create table if not exists public.game_config (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Date de la migration : un compte du site créé AVANT peut être repris dans l'appli sans invitation
-- (il a forcément passé la porte du site) ; après, il faut une invitation.
insert into public.game_config (key, value) values ('legacy_cutoff', to_jsonb(now())) on conflict (key) do nothing;

-- Numéros de visiteur jamais réattribués (sinon un nouveau joueur « hériterait » des avis d'un ancien)
create table if not exists public.retired_visitor_nos (
  visitor_no integer primary key,
  retired_at timestamptz not null default now()
);
create index if not exists reviews_visitor_suffix on public.reviews (right(id::text, 12));

-- 2.2 Accès privé pendant le test : invitations (seule l'empreinte SHA-256 du code est gardée) et accès accordés
create table if not exists public.invites (
  code_hash text primary key,
  label text not null check (char_length(label) between 1 and 60),
  max_uses smallint not null default 1 check (max_uses between 1 and 1000),
  uses smallint not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.access_grants (
  user_id uuid primary key references auth.users on delete cascade,
  code_hash text references public.invites on delete set null,
  via text not null default 'invite' check (via in ('invite', 'legacy', 'transfer', 'admin')),
  granted_at timestamptz not null default now()
);
-- Tentatives sur les secrets (invitation, transfert, ancien compte) : limite le forçage
create table if not exists public.auth_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('invite', 'transfer', 'legacy')),
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists auth_attempts_user on public.auth_attempts (user_id, kind, at desc);
insert into public.settings (key, value) values ('access_mode', '"invite"') on conflict (key) do nothing;  -- "public" à la sortie

-- 2.3 Changer de téléphone sans Apple : code à usage unique, 15 minutes, empreinte seulement
create table if not exists public.transfer_codes (
  code_hash text primary key,
  voter text not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists transfer_codes_voter on public.transfer_codes (voter, created_at desc);

-- 2.4 Auteur réel des avis postés par l'appli (fermée : l'identifiant interne ne doit jamais être lisible)
create table if not exists public.review_authors (
  review_id uuid primary key references public.reviews on delete cascade,
  voter text not null references public.players on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists review_authors_voter on public.review_authors (voter, created_at desc);

-- -----------------------------------------------------------------------------------------------------
-- 3. Fonctions internes
-- -----------------------------------------------------------------------------------------------------
-- Réglages
create or replace function app.cfg(k text) returns jsonb language sql stable set search_path = public
  as $$ select value from public.game_config where key = k $$;
create or replace function app.cfgi(k text, d integer) returns integer language sql stable set search_path = public
  as $$ select coalesce((select (value #>> '{}')::integer from public.game_config where key = k), d) $$;

-- L'heure du serveur. Pour les tests seulement : si game_config.horloge_test vaut true ET que le réglage de
-- session hmg.horloge est posé, on le prend (l'API ne peut poser ni l'un ni l'autre). En production : now().
create or replace function app.now() returns timestamptz language plpgsql stable set search_path = public as $$
declare h text := current_setting('hmg.horloge', true);
begin
  if h is not null and h <> '' and exists (select 1 from public.game_config where key = 'horloge_test' and value = 'true'::jsonb) then
    return h::timestamptz;
  end if;
  return now();
end $$;
create or replace function app.iso(t timestamptz) returns text language sql immutable
  as $$ select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') $$;

-- Codes lisibles (base 32 de Crockford : pas de I, L, O, U) et leur empreinte
create or replace function app.random_code(n int) returns text language plpgsql volatile set search_path = public as $$
declare a constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; b bytea := extensions.gen_random_bytes(n); s text := ''; i int;
begin
  for i in 0 .. n - 1 loop s := s || substr(a, (get_byte(b, i) % 32) + 1, 1); end loop;
  return s;
end $$;
create or replace function app.code_norm(p text) returns text language sql immutable
  as $$ select translate(regexp_replace(upper(coalesce(p, '')), '[^0-9A-Z]', '', 'g'), 'ILOU', '110V') $$;
create or replace function app.code_hash(p text) returns text language sql immutable
  as $$ select encode(extensions.digest(app.code_norm(p), 'sha256'), 'hex') $$;

-- Qui appelle ?
create or replace function app.uid() returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise : relance l''appli.' using hint = 'auth';
  end if;
  return auth.uid();
end $$;
create or replace function app.me() returns text language sql stable set search_path = public
  as $$ select voter from public.players where user_id = auth.uid() $$;

-- Accès privé : vrai si l'appli est ouverte à tous, si c'est l'admin, ou si ce compte a une invitation
create or replace function public.has_access() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select value = '"public"'::jsonb from settings where key = 'access_mode'), false)
      or is_admin()
      or exists (select 1 from access_grants where user_id = auth.uid())
$$;
create or replace function app.require_access() returns void language plpgsql stable as $$
begin
  perform app.uid();
  if not public.has_access() then
    raise exception 'HMG est en test privé : entre ton code d''invitation.' using hint = 'invite';
  end if;
end $$;

-- Limite de forçage : trop d'échecs récents pour ce compte ?
create or replace function app.too_many(p_kind text, p_max int, p_window interval) returns boolean
  language sql stable set search_path = public as $$
  select count(*) >= p_max from auth_attempts where user_id = auth.uid() and kind = p_kind and not ok and at > now() - p_window
$$;
create or replace function app.log_attempt(p_kind text, p_ok boolean) returns void language sql set search_path = public
  as $$ insert into auth_attempts (user_id, kind, ok) values (auth.uid(), p_kind, p_ok) $$;

-- Verrou par joueur : les RPC qui modifient un joueur passent l'une après l'autre
create or replace function app.lock_player(p_voter text) returns void language sql set search_path = public
  as $$ select 1 from public.players where voter = p_voter for no key update $$;

-- Le joueur du compte connecté, créé au besoin (numéro tiré par le SERVEUR, jamais par le client)
create or replace function app.ensure_player() returns text language plpgsql set search_path = public as $$
declare me uuid := app.uid(); v text; n integer; tries integer := 0;
begin
  select voter into v from players where user_id = me;
  if found then return v; end if;
  perform app.require_access();
  loop
    tries := tries + 1;
    if tries > 40 then raise exception 'Réessaie dans un instant.'; end if;
    n := 10000 + floor(random() * 90000)::int;
    continue when exists (select 1 from retired_visitor_nos where visitor_no = n)
               or exists (select 1 from reviews where right(id::text, 12) = lpad(n::text, 12, '0'));
    v := replace(gen_random_uuid()::text, '-', '');
    begin
      insert into players (voter, visitor_no, user_id, claimed_at, game_seed)
        values (v, n, me, now(), replace(gen_random_uuid()::text, '-', ''));
      return v;
    exception when unique_violation then
      select voter into v from players where user_id = me;   -- deux appels en même temps
      if found then return v; end if;
    end;
  end loop;
end $$;

-- Un joueur supprimé libère son numéro… qui n'est plus jamais redonné
create or replace function app.trg_retire_no() returns trigger language plpgsql set search_path = public as $$
begin
  insert into retired_visitor_nos (visitor_no) values (old.visitor_no) on conflict do nothing;
  return old;
end $$;
drop trigger if exists players_retire_no on public.players;
create trigger players_retire_no after delete on public.players for each row execute function app.trg_retire_no();

-- Points d'accroche remplis par 03-jeu.sql et 04-moderation.sql (créés vides ici seulement s'ils n'existent pas,
-- pour qu'on puisse rejouer ce fichier après les suivants sans rien écraser)
do $$
begin
  if to_regprocedure('app.merge_game(text,text)') is null then
    execute 'create function app.merge_game(p_src text, p_dst text) returns void language sql as $f$ select $f$';
  end if;
  if to_regprocedure('app.merge_moderation(text,text)') is null then
    execute 'create function app.merge_moderation(p_src text, p_dst text) returns void language sql as $f$ select $f$';
  end if;
  if to_regprocedure('app.export_game(text)') is null then
    execute 'create function app.export_game(p_voter text) returns jsonb language sql as $f$ select ''{}''::jsonb $f$';
  end if;
  if to_regprocedure('app.export_moderation(text)') is null then
    execute 'create function app.export_moderation(p_voter text) returns jsonb language sql as $f$ select ''{}''::jsonb $f$';
  end if;
  if to_regprocedure('app.is_banned(text)') is null then
    execute 'create function app.is_banned(p_voter text) returns boolean language sql as $f$ select false $f$';
  end if;
  if to_regprocedure('app.state_of(text)') is null then
    execute 'create function app.state_of(p_voter text) returns json language sql as $f$ select null::json $f$';
  end if;
  if to_regprocedure('app.after_claim(text,integer)') is null then
    execute 'create function app.after_claim(p_voter text, p_old_stars integer) returns void language sql as $f$ select $f$';
  end if;
end $$;

-- Fusion de deux joueurs (src → dst ; dst gagne en cas de conflit), puis suppression de src
create or replace function app.merge_players(p_src text, p_dst text) returns void language plpgsql set search_path = public as $$
declare ids uuid[];
begin
  if p_src is null or p_dst is null or p_src = p_dst then return; end if;
  perform app.merge_game(p_src, p_dst);                    -- état du jeu (03), avant les séances
  insert into checkins (voter, day, club_id, points, dist_m, created_at)
    select p_dst, day, club_id, points, dist_m, created_at from checkins where voter = p_src
    on conflict do nothing;
  if not exists (select 1 from pseudos where voter = p_dst) then
    update pseudos set voter = p_dst where voter = p_src;
  end if;
  update review_authors set voter = p_dst where voter = p_src;
  select array_agg(review_id) into ids from review_votes where voter = p_src;
  insert into review_votes (review_id, voter, value, created_at)
    select review_id, p_dst, value, created_at from review_votes where voter = p_src on conflict do nothing;
  delete from review_votes where voter = p_src;
  update reviews r set up = (select count(*) from review_votes x where x.review_id = r.id and x.value = 1),
                       down = (select count(*) from review_votes x where x.review_id = r.id and x.value = -1)
   where r.id = any (coalesce(ids, '{}'));
  perform app.merge_moderation(p_src, p_dst);
  delete from players where voter = p_src;                  -- le reste part en cascade
end $$;

-- Rattache un joueur existant (ancien compte du site, ou joueur d'un autre téléphone) au compte connecté.
-- Si ce compte avait déjà un joueur, les deux sont fusionnés et on garde le plus avancé (le plus de séances).
create or replace function app.adopt(p_other text) returns text language plpgsql set search_path = public as $$
declare me uuid := app.uid(); cur text; keep text; gone text;
begin
  select voter into cur from players where user_id = me;
  perform 1 from players where voter in (cur, p_other) order by voter for no key update;   -- ordre fixe : pas d'interblocage
  update players set user_id = null where voter = p_other;
  if cur is null or cur = p_other then
    keep := p_other;
  else
    if (select count(*) from checkins where voter = cur) > (select count(*) from checkins where voter = p_other)
      then keep := cur; gone := p_other; else keep := p_other; gone := cur; end if;
    update players set user_id = null where voter = cur;
    perform app.merge_players(gone, keep);
  end if;
  update players set user_id = me, claimed_at = coalesce(claimed_at, now()) where voter = keep;
  return keep;
end $$;

-- Décode ce que la personne a collé : la clé hmg-voter (32 caractères hexadécimaux), le code de 27 ou 28
-- caractères (acctCode / acctDecode de js/app.js : base 32, contrôle, héros), ou le lien « #compte=… ».
-- Rend la clé et l'indice du héros (0 si aucun), ou rien si ce n'est pas valide.
create or replace function app.legacy_key(p text, out voter text, out hero integer) returns record
  language plpgsql immutable as $$
declare a constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; t text := btrim(coalesce(p, '')); m text[]; j jsonb;
        s text; n int; ck int := 7; i int; x int; bits text := ''; hex text := '';
begin
  hero := 0;
  if lower(t) ~ '^[0-9a-f]{32}$' then voter := lower(t); return; end if;
  m := regexp_match(t, '(?:#|^)compte=([A-Za-z0-9_-]+)');
  if m is not null then
    begin
      s := translate(m[1], '-_', '+/');
      s := s || repeat('=', (4 - length(s) % 4) % 4);
      j := convert_from(decode(s, 'base64'), 'UTF8')::jsonb;
      if j ->> 'v' ~ '^[0-9a-f]{32}$' then voter := j ->> 'v'; end if;
    exception when others then voter := null;
    end;
    return;
  end if;
  s := regexp_replace(translate(upper(t), 'ILOU', '110V'), '[^0-9A-Z]', '', 'g');
  if length(s) not in (27, 28) then return; end if;
  n := length(s) - 1;
  for i in 1 .. n loop
    x := position(substr(s, i, 1) in a) - 1;
    if x < 0 then return; end if;
    ck := (ck * 33 + x) % 32;
  end loop;
  if substr(a, ck + 1, 1) <> substr(s, n + 1, 1) then return; end if;
  for i in 1 .. 26 loop bits := bits || ((position(substr(s, i, 1) in a) - 1)::bit(5))::text; end loop;
  for i in 0 .. 31 loop hex := hex || to_hex(substring(bits from i * 4 + 1 for 4)::bit(4)::int); end loop;
  voter := hex;
  if n = 27 then hero := position(substr(s, 27, 1) in a) - 1; end if;
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 4. RPC : compte, accès, transfert, suppression, export
-- -----------------------------------------------------------------------------------------------------
-- 4.1 Entrer un code d'invitation (5 échecs par heure et par compte au maximum)
create or replace function public.redeem_invite(p_code text) returns json
  language plpgsql security definer set search_path = public as $$
declare h text := app.code_hash(p_code); ok boolean;
begin
  perform app.uid();
  if has_access() then return json_build_object('ok', true, 'why', 'deja'); end if;
  if app.too_many('invite', 5, interval '1 hour') then return json_build_object('ok', false, 'why', 'limite'); end if;
  update invites set uses = uses + 1
   where code_hash = h and revoked_at is null and (expires_at is null or expires_at > now()) and uses < max_uses;
  ok := found;
  perform app.log_attempt('invite', ok);
  if ok then insert into access_grants (user_id, code_hash, via) values (auth.uid(), h, 'invite') on conflict do nothing; end if;
  return json_build_object('ok', ok, 'why', case when not ok then 'code' end);
end $$;

-- 4.2 Où en est ce compte ? (écran d'accueil de l'appli) : accès, joueur, compte anonyme ou non
create or replace function public.account_status() returns json
  language plpgsql stable security definer set search_path = public as $$
declare v text; n int;
begin
  perform app.uid();
  select voter, visitor_no into v, n from players where user_id = auth.uid();
  return json_build_object('access', has_access(), 'player', v is not null, 'no', n,
                           'anonymous', coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true),
                           'admin', is_admin(),
                           'mode', coalesce((select value #>> '{}' from settings where key = 'access_mode'), 'invite'));
end $$;

-- 4.3 Retrouver un compte du site : clé hmg-voter, code de 28 caractères ou lien #compte=…
--     p_old_stars : étoiles de l'ancienne collection (déclarées par l'appareil, bornées), converties une fois.
create or replace function public.claim_legacy_account(p_key text, p_old_stars integer default 0) returns json
  language plpgsql security definer set search_path = public as $$
declare me uuid := app.uid(); k record; t record; keep text; cut timestamptz;
begin
  if app.too_many('legacy', 10, interval '1 hour') then return json_build_object('ok', false, 'why', 'limite'); end if;
  k := app.legacy_key(p_key);
  if k.voter is null then
    perform app.log_attempt('legacy', false); return json_build_object('ok', false, 'why', 'invalide');
  end if;
  select voter, user_id, visitor_no, created_at into t from players where voter = k.voter for no key update;
  if not found then perform app.log_attempt('legacy', false); return json_build_object('ok', false, 'why', 'inconnu'); end if;
  perform app.log_attempt('legacy', true);
  if t.user_id is not null and t.user_id <> me then return json_build_object('ok', false, 'why', 'pris'); end if;   -- déjà repris ailleurs
  if not has_access() then
    -- un compte du site d'avant la migration a passé la porte du site : il entre sans invitation
    cut := coalesce((app.cfg('legacy_cutoff') #>> '{}')::timestamptz, '-infinity');
    if t.created_at < cut then
      insert into access_grants (user_id, via) values (me, 'legacy') on conflict do nothing;
    else
      perform app.require_access();                         -- erreur « invitation » (hint = 'invite')
    end if;
  end if;
  if t.user_id = me then
    return json_build_object('ok', true, 'why', 'deja', 'no', t.visitor_no, 'hero', k.hero, 'state', app.state_of(t.voter));
  end if;
  keep := app.adopt(t.voter);                                -- ce qui a été fait dans l'appli avant n'est pas perdu
  perform app.after_claim(keep, p_old_stars);
  return json_build_object('ok', true, 'no', (select visitor_no from players where voter = keep), 'hero', k.hero,
                           'state', app.state_of(keep));
end $$;

-- 4.4 Changer de téléphone sans Apple : code à usage unique (10 caractères ≈ 50 bits, valable 15 minutes)
create or replace function public.create_transfer_code() returns json
  language plpgsql security definer set search_path = public as $$
declare v text; c text; exp timestamptz := now() + interval '15 minutes';
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('ok', false, 'why', 'vide'); end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) is false then
    return json_build_object('ok', false, 'why', 'apple');  -- compte relié à Apple : il suffit de se connecter avec Apple
  end if;
  if (select count(*) from transfer_codes where voter = v and created_at > now() - interval '1 hour') >= 5 then
    return json_build_object('ok', false, 'why', 'limite');
  end if;
  delete from transfer_codes where voter = v and used_at is null;
  c := app.random_code(10);
  insert into transfer_codes (code_hash, voter, expires_at) values (app.code_hash(c), v, exp);
  return json_build_object('ok', true, 'code', substr(c, 1, 5) || '-' || substr(c, 6, 5), 'expires_at', app.iso(exp));
end $$;

create or replace function public.redeem_transfer_code(p_code text) returns json
  language plpgsql security definer set search_path = public as $$
declare me uuid := app.uid(); h text := app.code_hash(p_code); t record; keep text;
begin
  if app.too_many('transfer', 5, interval '1 hour') then return json_build_object('ok', false, 'why', 'limite'); end if;
  select tc.voter, p.user_id into t from transfer_codes tc join players p on p.voter = tc.voter
   where tc.code_hash = h and tc.used_at is null and tc.expires_at > now()
   for update of tc;
  if not found then perform app.log_attempt('transfer', false); return json_build_object('ok', false, 'why', 'code'); end if;
  perform app.log_attempt('transfer', true);
  update transfer_codes set used_at = now() where code_hash = h;
  if t.user_id = me then return json_build_object('ok', true, 'why', 'deja'); end if;
  -- l'accès au test suit le joueur
  insert into access_grants (user_id, code_hash, via) select me, code_hash, 'transfer' from access_grants where user_id = t.user_id
    on conflict do nothing;
  perform app.require_access();
  keep := app.adopt(t.voter);                               -- l'ancien téléphone perd le compte
  return json_build_object('ok', true, 'no', (select visitor_no from players where voter = keep), 'state', app.state_of(keep));
end $$;

-- 4.5 Supprimer son compte (App Store 5.1.1(v), RGPD art. 17) : tout est effacé tout de suite, en cascade
--     (joueur, séances, jeu, quêtes, étoiles, sauvegardes, pseudo, signalements envoyés, accès, sessions de connexion),
--     ainsi que ses avis (ceux de l'appli et ceux du site signés de son numéro) et ses pouces.
--     Si un jour le compte est relié à Apple : passer par l'Edge Function qui révoque d'abord le jeton Apple.
create or replace function public.delete_account() returns json
  language plpgsql security definer set search_path = public as $$
declare me uuid := app.uid(); v text; n int; ids uuid[];
begin
  if is_admin() then raise exception 'Le compte admin ne se supprime pas depuis l''appli.'; end if;
  select voter, visitor_no into v, n from players where user_id = me;
  if v is not null then
    delete from reviews r using review_authors a where a.review_id = r.id and a.voter = v;
    delete from reviews where right(id::text, 12) = lpad(n::text, 12, '0');   -- avis du site signés de ce numéro
    select array_agg(review_id) into ids from review_votes where voter = v;
    delete from review_votes where voter = v;
    update reviews r set up = (select count(*) from review_votes x where x.review_id = r.id and x.value = 1),
                         down = (select count(*) from review_votes x where x.review_id = r.id and x.value = -1)
     where r.id = any (coalesce(ids, '{}'));
  end if;
  delete from auth.users where id = me;                     -- la cascade emporte tout le reste
  return json_build_object('ok', true);
end $$;

-- 4.6 Mes données (RGPD art. 15 et 20) : tout ce que le serveur garde sur ce compte
create or replace function public.my_export() returns json
  language plpgsql stable security definer set search_path = public as $$
declare v text; n int; base jsonb;
begin
  perform app.uid();
  select voter, visitor_no into v, n from players where user_id = auth.uid();
  if v is null then return json_build_object('exported_at', app.iso(now()), 'player', null); end if;
  base := jsonb_build_object(
    'exported_at', app.iso(now()),
    'compte', jsonb_build_object('user_id', auth.uid(), 'anonyme', coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true),
                                 'acces', (select jsonb_build_object('via', via, 'le', granted_at) from access_grants where user_id = auth.uid())),
    'player', (select jsonb_build_object('no', visitor_no, 'created_at', created_at, 'claimed_at', claimed_at) from players where voter = v),
    'pseudo', (select pseudo from pseudos where voter = v),
    'checkins', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'club', club_id, 'points', points, 'dist_m', dist_m, 'at', created_at) order by day), '[]') from checkins where voter = v),
    'reviews', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'club', r.club_id, 'rating', r.rating, 'comment', r.comment, 'at', r.created_at, 'hidden', r.hidden)), '[]')
                  from reviews r where r.id in (select review_id from review_authors where voter = v)
                                    or right(r.id::text, 12) = lpad(n::text, 12, '0')),
    'votes', (select coalesce(jsonb_agg(jsonb_build_object('review', review_id, 'value', value, 'at', created_at)), '[]') from review_votes where voter = v));
  return (base || app.export_game(v) || app.export_moderation(v))::json;
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 5. RPC v2 des fonctions existantes (sans p_voter ni p_no) : score, pseudo, pouces, avis
-- -----------------------------------------------------------------------------------------------------
create or replace function public.my_score_v2() returns json
  language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('points', 0, 'month', 0, 'clubs', 0, 'days', 0, 'streak', 0); end if;
  return public.my_score(v);
end $$;

create or replace function public.pseudo_check_v2(p_pseudo text) returns text
  language plpgsql stable security definer set search_path = public as $$
begin
  perform app.require_access();
  return public.pseudo_check(p_pseudo, app.me());
end $$;

create or replace function public.set_pseudo_v2(p_pseudo text) returns json
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  v := app.ensure_player();
  perform app.lock_player(v);
  if app.is_banned(v) then return json_build_object('ok', false, 'why', 'bloque'); end if;
  return public.set_pseudo(v, null, p_pseudo);
end $$;

create or replace function public.vote_review_v2(p_review uuid, p_value integer) returns json
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  v := app.ensure_player();
  if app.is_banned(v) then return json_build_object('ok', false, 'why', 'bloque'); end if;
  return public.vote_review(p_review, v, p_value);
end $$;

-- Avis signés par le serveur : le numéro de visiteur dans l'identifiant vient du compte, plus du client (faille F5)
create or replace function public.post_review_v2(p_club text, p_rating integer, p_comment text default null) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; n int; rid uuid; c text := nullif(btrim(regexp_replace(coalesce(p_comment, ''), '\s+', ' ', 'g')), '');
begin
  v := app.ensure_player();
  perform app.lock_player(v);
  if p_club is null or p_club !~ '^[a-z0-9-]{1,80}$' then raise exception 'Salle invalide.'; end if;
  if p_rating is null or p_rating not between 1 and 10 then raise exception 'Note entre 1 et 10.'; end if;
  if c is not null and char_length(c) > 1000 then return json_build_object('ok', false, 'why', 'long'); end if;
  if app.is_banned(v) then return json_build_object('ok', false, 'why', 'bloque'); end if;
  if (select count(*) from review_authors where voter = v and created_at > now() - interval '1 day') >= 10 then
    return json_build_object('ok', false, 'why', 'limite');
  end if;
  if exists (select 1 from review_authors a join reviews r on r.id = a.review_id
              where a.voter = v and r.club_id = p_club and a.created_at > now() - interval '7 days') then
    return json_build_object('ok', false, 'why', 'deja');
  end if;
  select visitor_no into n from players where voter = v;
  rid := (left(gen_random_uuid()::text, 24) || lpad(n::text, 12, '0'))::uuid;
  -- un commentaire attend la validation de l'admin (comme sur le site) ; une note seule est publiée
  insert into reviews (id, club_id, rating, comment, hidden) values (rid, p_club, p_rating, c, c is not null);
  insert into review_authors (review_id, voter) values (rid, v);
  return json_build_object('ok', true, 'id', rid, 'hidden', c is not null);
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 6. Admin (vérifié côté serveur) : invitations
-- -----------------------------------------------------------------------------------------------------
create or replace function public.admin_create_invite(p_label text, p_max_uses integer default 1, p_days integer default 60) returns json
  language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  c := app.random_code(10);
  insert into invites (code_hash, label, max_uses, expires_at)
    values (app.code_hash(c), left(coalesce(nullif(btrim(p_label), ''), 'Invitation'), 60), greatest(1, least(coalesce(p_max_uses, 1), 1000)),
            now() + make_interval(days => greatest(1, least(coalesce(p_days, 60), 365))));
  return json_build_object('code', lower(c), 'link', 'https://hmgfitness.fr/invite/?c=' || lower(c));
end $$;

create or replace function public.admin_list_invites() returns json
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  return (select coalesce(json_agg(json_build_object('id', left(code_hash, 12), 'label', label, 'uses', uses, 'max_uses', max_uses,
                                                     'expires_at', expires_at, 'revoked', revoked_at is not null) order by created_at desc), '[]')
            from invites);
end $$;

create or replace function public.admin_revoke_invite(p_id text) returns json
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  if p_id is null or p_id !~ '^[0-9a-f]{12}$' then raise exception 'Identifiant invalide.'; end if;
  update invites set revoked_at = now() where left(code_hash, 12) = p_id and revoked_at is null;
  return json_build_object('ok', found);
end $$;

-- Pour Mino, dans le SQL Editor seulement : enregistrer un code déjà envoyé (ex. ceux du test actuel du site)
--   select app.add_invite('le-code', 'Testeurs', 50, 90);
create or replace function app.add_invite(p_code text, p_label text, p_max_uses integer default 50, p_days integer default 90)
  returns void language sql set search_path = public as $$
  insert into invites (code_hash, label, max_uses, expires_at)
  values (app.code_hash(p_code), p_label, p_max_uses, now() + make_interval(days => p_days))
  on conflict (code_hash) do update set label = excluded.label, max_uses = excluded.max_uses,
                                        expires_at = excluded.expires_at, revoked_at = null
$$;

-- Ménage (à brancher sur pg_cron, voir LISEZMOI.md). Les tables du jeu (03) sont nettoyées si elles existent.
create or replace function app.purge() returns void language plpgsql set search_path = public as $$
begin
  delete from auth_attempts where at < now() - interval '7 days';
  delete from transfer_codes where expires_at < now() - interval '1 day';
  if to_regclass('public.session_attempts') is not null then
    execute 'delete from public.session_attempts where at < now() - interval ''30 days''';
  end if;
  -- comptes anonymes jamais utilisés (30 j), ou sans invitation pendant le test (7 j)
  delete from auth.users u
   where u.is_anonymous and not exists (select 1 from players p where p.user_id = u.id)
     and not exists (select 1 from admins a where a.user_id = u.id)
     and (u.created_at < now() - interval '30 days'
          or (u.created_at < now() - interval '7 days' and not exists (select 1 from access_grants g where g.user_id = u.id)));
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 7. DROITS : tout fermé, puis ouverture explicite. Sur Supabase, toute nouvelle table ou fonction du schéma
--    public est donnée par défaut à anon et authenticated (pg_default_acl) : on referme tout ce qu'on crée.
-- -----------------------------------------------------------------------------------------------------
do $$
declare t text; f regprocedure; s text;
begin
  foreach t in array array['game_config', 'retired_visitor_nos', 'invites', 'access_grants', 'auth_attempts',
                           'transfer_codes', 'review_authors'] loop
    execute format('alter table public.%I enable row level security', t);       -- aucune politique : fermé à l'API
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
  -- RPC réservées aux comptes connectés (un compte anonyme Supabase est « authenticated ») : jamais la seule clé publique
  foreach f in array array[
    'public.redeem_invite(text)', 'public.account_status()', 'public.claim_legacy_account(text, integer)',
    'public.create_transfer_code()', 'public.redeem_transfer_code(text)', 'public.delete_account()', 'public.my_export()',
    'public.my_score_v2()', 'public.pseudo_check_v2(text)', 'public.set_pseudo_v2(text)',
    'public.vote_review_v2(uuid, integer)', 'public.post_review_v2(text, integer, text)',
    'public.admin_create_invite(text, integer, integer)', 'public.admin_list_invites()', 'public.admin_revoke_invite(text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function public.has_access() from public, anon, authenticated;
grant execute on function public.has_access() to anon, authenticated;   -- l'écran d'accueil peut demander « suis-je invité ? »

notify pgrst, 'reload schema';
commit;
