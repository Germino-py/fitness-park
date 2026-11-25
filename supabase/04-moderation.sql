-- =====================================================================================================
-- HMG Fitness · 04 · Modération (App Store 1.2 : contenu créé par les utilisateurs) : signaler un avis, une
-- photo ou un membre ; masquer un membre pour soi ; masquage automatique après N signalements de personnes
-- différentes, en attendant la décision de l'admin (à prendre sous 24 h) ; comptes bannis.
-- À coller dans Supabase → SQL Editor → Run, APRÈS 03. Transactionnel, rejouable, additif.
-- Les anciennes RPC du site (p_voter) ne changent pas ; un compte banni ne peut plus rien publier par l'appli,
-- et les avis du site signés de son numéro sont refusés (politique restrictive sur reviews).
-- =====================================================================================================
begin;

insert into public.game_config (key, value) values
  ('report_hide_threshold', '3'),          -- signalements de personnes différentes avant masquage automatique
  ('reports_per_day', '20')                -- signalements par personne et par jour au plus
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------------------------------
-- Membre masqué par la modération (signalements) : retiré du classement, pseudo mis de côté
alter table public.players add column if not exists hidden_at timestamptz;

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter text not null references public.players on delete cascade,
  target_kind text not null check (target_kind in ('review', 'photo', 'member')),
  target_id text not null check (char_length(target_id) between 1 and 64),   -- uuid de l'avis ou de la photo, numéro du membre
  target_voter text references public.players on delete cascade,             -- l'auteur, quand on le connaît (jamais renvoyé)
  reason text not null check (reason in ('spam', 'insulte', 'harcelement', 'haine', 'sexuel', 'violence', 'danger', 'faux', 'perso', 'autre')),
  note text check (char_length(note) <= 500),
  snapshot jsonb not null default '{}'::jsonb,                               -- le contenu signalé, tel qu'il était
  status text not null default 'ouvert' check (status in ('ouvert', 'traite', 'rejete')),
  decision text check (decision in ('retirer', 'garder', 'bannir')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (reporter, target_kind, target_id)
);
create index if not exists reports_target on public.reports (target_kind, target_id);
create index if not exists reports_open on public.reports (created_at) where status = 'ouvert';

-- Contenus masqués automatiquement : l'état d'avant, pour le rendre si l'admin garde le contenu
create table if not exists public.moderation_holds (
  target_kind text not null check (target_kind in ('review', 'photo', 'member')),
  target_id text not null,
  prev jsonb not null default '{}'::jsonb,
  held_at timestamptz not null default now(),
  primary key (target_kind, target_id)
);

-- Membres masqués pour soi (« Ne plus voir ce membre ») : ses avis, ses photos et sa place au classement
create table if not exists public.blocks (
  voter text not null references public.players on delete cascade,
  blocked text not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (voter, blocked),
  check (voter <> blocked)
);

-- Comptes bannis par l'admin (until null = définitif)
create table if not exists public.bans (
  voter text primary key references public.players on delete cascade,
  reason text check (char_length(reason) <= 200),
  until timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------------------------------
-- 2. Fonctions internes (remplacent les points d'accroche vides de 02 et 03)
-- -----------------------------------------------------------------------------------------------------
create or replace function app.is_banned(p_voter text) returns boolean language sql stable set search_path = public
  as $$ select exists (select 1 from bans where voter = p_voter and (until is null or until > now())) $$;

-- Classement : les membres masqués par la modération, et ceux que l'on a masqués pour soi
create or replace function app.lb_hidden(p_viewer text, p_voter text) returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from players where voter = p_voter and hidden_at is not null)
      or (p_viewer is not null and exists (select 1 from blocks where voter = p_viewer and blocked = p_voter))
$$;

-- Le numéro de visiteur caché dans l'identifiant d'un avis (…-000000045678), comme le fait le site
create or replace function app.review_no(p_id uuid) returns integer language sql immutable
  as $$ select case when right(p_id::text, 12) ~ '^0{7}[1-9][0-9]{4}$' then right(p_id::text, 12)::int end $$;
create or replace function app.review_author(p_id uuid) returns text language sql stable set search_path = public as $$
  select coalesce((select voter from review_authors where review_id = p_id),
                  (select voter from players where visitor_no = app.review_no(p_id)))
$$;

-- La reprise d'un compte ou un transfert emporte aussi les signalements, les masquages et un bannissement
create or replace function app.merge_moderation(p_src text, p_dst text) returns void language plpgsql set search_path = public as $$
begin
  update reports r set reporter = p_dst where r.reporter = p_src
     and not exists (select 1 from reports d where d.reporter = p_dst and d.target_kind = r.target_kind and d.target_id = r.target_id);
  update reports set target_voter = p_dst where target_voter = p_src;
  insert into blocks (voter, blocked, created_at) select p_dst, blocked, created_at from blocks where voter = p_src and blocked <> p_dst
    on conflict do nothing;
  insert into blocks (voter, blocked, created_at) select voter, p_dst, created_at from blocks where blocked = p_src and voter <> p_dst
    on conflict do nothing;
  insert into bans (voter, reason, until, created_at) select p_dst, reason, until, created_at from bans where voter = p_src
    on conflict (voter) do update set until = case when bans.until is null or excluded.until is null then null
                                                   else greatest(bans.until, excluded.until) end;
  update players d set hidden_at = coalesce(d.hidden_at, s.hidden_at) from players s where s.voter = p_src and d.voter = p_dst;
end $$;

create or replace function app.export_moderation(p_voter text) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'signalements_envoyes', (select coalesce(jsonb_agg(jsonb_build_object('type', target_kind, 'cible', target_id, 'raison', reason,
                               'note', note, 'le', created_at, 'statut', status) order by created_at), '[]') from reports where reporter = p_voter),
    'membres_masques', (select coalesce(jsonb_agg(jsonb_build_object('no', p.visitor_no, 'le', b.created_at) order by b.created_at), '[]')
                          from blocks b join players p on p.voter = b.blocked where b.voter = p_voter),
    'bannissement', (select jsonb_build_object('raison', reason, 'jusqu_au', until, 'le', created_at) from bans where voter = p_voter),
    'masque_par_la_moderation', (select hidden_at from players where voter = p_voter))
$$;

-- Masquage automatique d'un contenu (en attendant l'admin), en gardant l'état d'avant
create or replace function app.hold(p_kind text, p_id text, p_author text) returns void language plpgsql set search_path = public as $$
declare prev jsonb;
begin
  if exists (select 1 from moderation_holds where target_kind = p_kind and target_id = p_id) then return; end if;
  if p_kind = 'review' then
    select jsonb_build_object('hidden', hidden) into prev from reviews where id = p_id::uuid;
    update reviews set hidden = true where id = p_id::uuid;
  elsif p_kind = 'photo' then
    select jsonb_build_object('approved', approved) into prev from photos where id = p_id::uuid;
    update photos set approved = false where id = p_id::uuid;
  elsif p_kind = 'member' and p_author is not null then
    select jsonb_build_object('pseudo', pseudo, 'pseudo_key', pseudo_key) into prev from pseudos where voter = p_author;
    delete from pseudos where voter = p_author;                -- le pseudo disparaît des listes publiques
    update players set hidden_at = now() where voter = p_author;
  end if;
  insert into moderation_holds (target_kind, target_id, prev) values (p_kind, p_id, coalesce(prev, '{}'));
end $$;

-- Le contenu est gardé : on rend l'état d'avant le masquage automatique
create or replace function app.release(p_kind text, p_id text, p_author text) returns void language plpgsql set search_path = public as $$
declare h public.moderation_holds;
begin
  select * into h from moderation_holds where target_kind = p_kind and target_id = p_id;
  if not found then return; end if;
  if p_kind = 'review' and h.prev ? 'hidden' then update reviews set hidden = (h.prev ->> 'hidden')::boolean where id = p_id::uuid;
  elsif p_kind = 'photo' and h.prev ? 'approved' then update photos set approved = (h.prev ->> 'approved')::boolean where id = p_id::uuid;
  elsif p_kind = 'member' and p_author is not null then
    update players set hidden_at = null where voter = p_author;
    if h.prev ? 'pseudo' then
      insert into pseudos (voter, pseudo, pseudo_key) values (p_author, h.prev ->> 'pseudo', h.prev ->> 'pseudo_key') on conflict do nothing;
    end if;
  end if;
  delete from moderation_holds where target_kind = p_kind and target_id = p_id;
end $$;

-- Retirer pour de bon (décision de l'admin)
create or replace function app.remove_content(p_kind text, p_id text, p_author text) returns void language plpgsql set search_path = public as $$
begin
  if p_kind = 'review' then
    delete from reviews where id = p_id::uuid;
  elsif p_kind = 'photo' then
    delete from photos where id = p_id::uuid;                 -- le fichier reste dans Storage : à supprimer dans le tableau de bord
  elsif p_kind = 'member' and p_author is not null then
    delete from pseudos where voter = p_author;
    update players set hidden_at = null where voter = p_author;   -- le membre peut choisir un autre pseudo (il reste signalable)
  end if;
  delete from moderation_holds where target_kind = p_kind and target_id = p_id;
end $$;

-- Un avis ou une photo supprimés n'ont plus de signalements (le contenu signalé ne doit pas survivre ailleurs)
create or replace function app.trg_forget_reports() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from reports where target_kind = tg_argv[0] and target_id = old.id::text;
  delete from moderation_holds where target_kind = tg_argv[0] and target_id = old.id::text;
  return old;
end $$;
drop trigger if exists reviews_forget_reports on public.reviews;
create trigger reviews_forget_reports after delete on public.reviews for each row execute function app.trg_forget_reports('review');
drop trigger if exists photos_forget_reports on public.photos;
create trigger photos_forget_reports after delete on public.photos for each row execute function app.trg_forget_reports('photo');
-- un membre supprimé : ses signalements reçus partent en cascade (target_voter) ; ceux visant son numéro aussi
create or replace function app.trg_forget_member() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from reports where target_kind = 'member' and target_id = old.visitor_no::text;
  delete from moderation_holds where target_kind = 'member' and target_id = old.visitor_no::text;
  return old;
end $$;
drop trigger if exists players_forget_reports on public.players;
create trigger players_forget_reports after delete on public.players for each row execute function app.trg_forget_member();

-- Pas de nouveau pseudo pour un compte banni ou masqué par la modération (ni par l'appli, ni par le site)
create or replace function app.trg_pseudo_mod() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if app.is_banned(new.voter) or exists (select 1 from players where voter = new.voter and hidden_at is not null) then
    raise exception 'Ce compte ne peut pas changer de pseudo pour le moment.' using hint = 'bloque';
  end if;
  return new;
end $$;
drop trigger if exists pseudos_moderation on public.pseudos;
create trigger pseudos_moderation before insert or update of pseudo on public.pseudos for each row execute function app.trg_pseudo_mod();

-- Avis du site (insertion directe, clé publique) : refusé si le numéro qui le signe est banni.
-- Fonction publique, appelable par anon, qui ne révèle qu'un oui ou non sur un identifiant d'avis.
create or replace function public.review_signer_banned(p_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from players p join bans b on b.voter = p.voter
                  where p.visitor_no = app.review_no(p_id) and (b.until is null or b.until > now()))
$$;
drop policy if exists "avis: pas de compte banni" on public.reviews;
create policy "avis: pas de compte banni" on public.reviews as restrictive for insert to anon, authenticated
  with check (not public.review_signer_banned(id));

-- -----------------------------------------------------------------------------------------------------
-- 3. RPC des joueurs
-- -----------------------------------------------------------------------------------------------------
-- 3.1 Signaler un avis (p_target = son uuid), une photo (uuid) ou un membre (son numéro de visiteur).
--     Raisons : spam, insulte, harcelement, haine, sexuel, violence, danger, faux, perso (données personnelles), autre.
--     Après N signalements de personnes différentes, le contenu est masqué en attendant l'admin.
create or replace function public.report_content(p_kind text, p_target text, p_reason text, p_note text default null) returns json
  language plpgsql security definer set search_path = public as $$
declare v text; author text; snap jsonb; tid text := btrim(coalesce(p_target, '')); n int; held boolean := false;
        note text := nullif(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), '');
begin
  perform app.require_access();
  v := app.ensure_player();
  perform app.lock_player(v);
  if app.is_banned(v) then return json_build_object('ok', false, 'why', 'bloque'); end if;
  if p_kind is null or p_kind not in ('review', 'photo', 'member') then return json_build_object('ok', false, 'why', 'type'); end if;
  if p_reason is null or p_reason not in ('spam', 'insulte', 'harcelement', 'haine', 'sexuel', 'violence', 'danger', 'faux', 'perso', 'autre') then
    return json_build_object('ok', false, 'why', 'raison');
  end if;
  if note is not null and char_length(note) > 500 then note := left(note, 500); end if;
  if p_kind in ('review', 'photo') and tid !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return json_build_object('ok', false, 'why', 'introuvable');
  end if;
  if p_kind = 'review' then
    select jsonb_build_object('club', club_id, 'rating', rating, 'comment', comment, 'at', created_at) into snap from reviews where id = tid::uuid;
    author := app.review_author(tid::uuid);
  elsif p_kind = 'photo' then
    select jsonb_build_object('club', club_id, 'path', path, 'at', created_at) into snap from photos where id = tid::uuid;
  else
    if tid !~ '^[1-9][0-9]{4}$' then return json_build_object('ok', false, 'why', 'introuvable'); end if;
    select p.voter, jsonb_build_object('no', p.visitor_no, 'pseudo', s.pseudo) into author, snap
      from players p left join pseudos s on s.voter = p.voter where p.visitor_no = tid::int;
  end if;
  if snap is null then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  if author = v then return json_build_object('ok', false, 'why', 'soi'); end if;
  if exists (select 1 from reports where reporter = v and target_kind = p_kind and target_id = tid) then
    return json_build_object('ok', true, 'why', 'deja');
  end if;
  if (select count(*) from reports where reporter = v and created_at > now() - interval '1 day') >= app.cfgi('reports_per_day', 20) then
    return json_build_object('ok', false, 'why', 'limite');
  end if;
  insert into reports (reporter, target_kind, target_id, target_voter, reason, note, snapshot)
    values (v, p_kind, tid, author, p_reason, note, snap);
  select count(distinct reporter) into n from reports where target_kind = p_kind and target_id = tid and status = 'ouvert';
  if n >= app.cfgi('report_hide_threshold', 3) then
    perform app.hold(p_kind, tid, author);
    held := true;
  end if;
  return json_build_object('ok', true, 'hidden', held);
end $$;

-- 3.2 Ne plus voir un membre (et l'inverse) ; la liste sert à l'appli pour filtrer avis et photos
create or replace function public.block_member(p_no integer) returns json language plpgsql security definer set search_path = public as $$
declare v text; b text;
begin
  perform app.require_access();
  v := app.ensure_player();
  select voter into b from players where visitor_no = p_no;
  if b is null then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  if b = v then return json_build_object('ok', false, 'why', 'soi'); end if;
  if (select count(*) from blocks where voter = v) >= 500 then return json_build_object('ok', false, 'why', 'limite'); end if;
  insert into blocks (voter, blocked) values (v, b) on conflict do nothing;
  return json_build_object('ok', true, 'blocked', public.my_blocks());
end $$;

create or replace function public.unblock_member(p_no integer) returns json language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform app.require_access();
  v := app.me();
  if v is null then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  delete from blocks b using players p where b.voter = v and b.blocked = p.voter and p.visitor_no = p_no;
  return json_build_object('ok', true, 'blocked', public.my_blocks());
end $$;

-- [{ "no": 48213, "pseudo": "…", "at": "…" }] ; jamais l'identifiant interne
create or replace function public.my_blocks() returns json language plpgsql stable security definer set search_path = public as $$
begin
  perform app.require_access();
  return (select coalesce(json_agg(json_build_object('no', p.visitor_no, 'pseudo', s.pseudo, 'at', app.iso(b.created_at)) order by b.created_at desc), '[]'::json)
            from blocks b join players p on p.voter = b.blocked left join pseudos s on s.voter = p.voter
           where b.voter = app.me());
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 4. RPC de l'admin (vérifié côté serveur) : traiter les signalements sous 24 h, bannir
-- -----------------------------------------------------------------------------------------------------
-- Les signalements regroupés par contenu (les plus anciens d'abord)
create or replace function public.admin_reports(p_status text default 'ouvert') returns json
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  return (select coalesce(json_agg(t order by t.first_at), '[]'::json) from (
    select r.target_kind kind, r.target_id target, min(r.id) id, count(*) n, min(r.created_at) first_at,
           array_agg(distinct r.reason) reasons, (array_agg(r.snapshot order by r.id))[1] snapshot,
           json_agg(json_build_object('reason', r.reason, 'note', r.note, 'at', r.created_at) order by r.id) list,
           (select p.visitor_no from players p where p.voter = max(r.target_voter)) author_no,
           exists (select 1 from moderation_holds h where h.target_kind = r.target_kind and h.target_id = r.target_id) hidden,
           (select app.is_banned(max(r.target_voter))) author_banned
      from reports r where r.status = coalesce(p_status, 'ouvert')
     group by r.target_kind, r.target_id) t);
end $$;

-- Décider : 'retirer' (supprimé), 'garder' (rendu visible si masqué automatiquement), 'bannir' (retiré + auteur banni)
create or replace function public.admin_report_decide(p_id bigint, p_decision text) returns json
  language plpgsql security definer set search_path = public as $$
declare r public.reports; author text;
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  if p_decision is null or p_decision not in ('retirer', 'garder', 'bannir') then raise exception 'Décision : retirer, garder ou bannir.'; end if;
  select * into r from reports where id = p_id;
  if not found then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  author := coalesce(r.target_voter, (select max(target_voter) from reports where target_kind = r.target_kind and target_id = r.target_id));
  -- (un avis ou une photo supprimés emportent aussi leurs signalements et la copie de leur contenu)
  update reports set status = case when p_decision = 'garder' then 'rejete' else 'traite' end, decision = p_decision, decided_at = now()
   where target_kind = r.target_kind and target_id = r.target_id and status = 'ouvert';
  if p_decision = 'garder' then
    perform app.release(r.target_kind, r.target_id, author);
  else
    perform app.remove_content(r.target_kind, r.target_id, author);
    if p_decision = 'bannir' and author is not null then
      insert into bans (voter, reason) values (author, 'Signalement : ' || r.reason) on conflict (voter) do update set until = null;
    end if;
  end if;
  return json_build_object('ok', true);
end $$;

-- Bannir (ou gracier) un membre par son numéro ; p_days null = définitif
create or replace function public.admin_ban(p_no integer, p_ban boolean default true, p_reason text default null, p_days integer default null) returns json
  language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not is_admin() then raise exception 'Réservé à l''admin.'; end if;
  select voter into v from players where visitor_no = p_no;
  if v is null then return json_build_object('ok', false, 'why', 'introuvable'); end if;
  if coalesce(p_ban, true) then
    insert into bans (voter, reason, until) values (v, left(p_reason, 200), case when p_days is not null then now() + make_interval(days => p_days) end)
      on conflict (voter) do update set reason = excluded.reason, until = excluded.until, created_at = now();
    delete from pseudos where voter = v;
  else
    delete from bans where voter = v;
  end if;
  return json_build_object('ok', true, 'banned', app.is_banned(v));
end $$;

-- -----------------------------------------------------------------------------------------------------
-- 5. DROITS : tout fermé, puis ouverture explicite (voir 02-comptes.sql §7)
-- -----------------------------------------------------------------------------------------------------
do $$
declare t text; f regprocedure; s text;
begin
  foreach t in array array['reports', 'moderation_holds', 'blocks', 'bans'] loop
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
    'public.report_content(text, text, text, text)', 'public.block_member(integer)', 'public.unblock_member(integer)',
    'public.my_blocks()', 'public.admin_reports(text)', 'public.admin_report_decide(bigint, text)',
    'public.admin_ban(integer, boolean, text, integer)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
-- appelée par la politique des avis : le site insère avec la clé publique (anon)
revoke all on function public.review_signer_banned(uuid) from public, anon, authenticated;
grant execute on function public.review_signer_banned(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
