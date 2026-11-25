-- Petits outils de test (schéma « tests », seulement dans la base jetable)
create schema if not exists tests;
grant usage on schema tests to public;
create table if not exists tests.resultats (id serial primary key, fichier text, nom text, ok boolean, detail text);
-- l'horloge de test est autorisée dans CETTE base seulement (voir app.now())
insert into public.game_config (key, value) values ('horloge_test', 'true') on conflict (key) do update set value = 'true';

create or replace function tests.ok(p_nom text, p_cond boolean, p_detail text default null) returns void
  language sql security definer as $$
  insert into tests.resultats (fichier, nom, ok, detail)
  values (coalesce(current_setting('tests.fichier', true), '?'), p_nom, coalesce(p_cond, false), p_detail)
$$;
create or replace function tests.egal(p_nom text, p_recu anyelement, p_attendu anyelement) returns void
  language sql as $$ select tests.ok(p_nom, p_recu is not distinct from p_attendu, format('reçu %s, attendu %s', p_recu, p_attendu)) $$;
-- Exécute p_sql avec le rôle courant et vérifie qu'il ÉCHOUE avec un message (ou un hint) contenant p_attendu
create or replace function tests.erreur(p_nom text, p_sql text, p_attendu text) returns void language plpgsql as $$
declare m text; h text;
begin
  execute p_sql;
  perform tests.ok(p_nom, false, 'aucune erreur');
exception when others then
  get stacked diagnostics m = message_text, h = pg_exception_hint;
  perform tests.ok(p_nom, m ilike '%' || p_attendu || '%' or coalesce(h, '') = p_attendu, 'erreur : ' || m || ' / hint ' || coalesce(h, ''));
end $$;
-- Se faire passer pour un compte (le jeton que l'API poserait)
create or replace function tests.comme(p_user uuid, p_anonyme boolean default true) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false),
         set_config('request.jwt.claims', case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anonyme)::text end, false)
$$;
create or replace function tests.horloge(p_t text) returns void language sql
  as $$ select set_config('hmg.horloge', coalesce(p_t, ''), false) $$;
-- Crée un compte anonyme (comme POST /auth/v1/signup) avec ou sans invitation
create or replace function tests.compte(p_user uuid, p_invite boolean default true, p_anonyme boolean default true) returns void
  language sql security definer as $$
  insert into auth.users (id, is_anonymous) values (p_user, p_anonyme) on conflict (id) do nothing;
  insert into public.access_grants (user_id, via) select p_user, 'admin' where p_invite on conflict do nothing;
$$;
grant execute on all functions in schema tests to public;
-- La dernière séance commencée par le compte connecté (pour « J'ai fini » dans les scénarios)
create or replace function tests.derniere_seance() returns bigint language sql security definer
  as $$ select max(id) from public.sessions where voter = (select voter from public.players where user_id = auth.uid()) $$;
grant execute on function tests.derniere_seance() to public;

-- Une séance complète à l'heure de test t (début), validée 45 minutes plus tard, à côté de la salle (lat, lon) ;
-- la position varie un peu d'une séance à l'autre (sinon le signal « même position » écarte la séance du classement)
create or replace function tests.seance(p_t timestamptz, p_lat float8, p_lon float8, p_meta jsonb default '{}') returns json language plpgsql as $$
declare r json; e float8 := (extract(epoch from p_t)::bigint / 3600 % 997) * 0.000001;
begin
  perform tests.horloge(p_t::text);
  r := public.session_start(p_lat + 0.0002 + e, p_lon + 0.0001, 20, p_meta);
  if not (r ->> 'ok')::boolean then return r; end if;
  perform tests.horloge((p_t + interval '45 minutes')::text);
  return public.session_confirm((r -> 'session' ->> 'id')::bigint, p_lat + 0.0003, p_lon + 0.0002, 20);
end $$;
grant execute on function tests.seance(timestamptz, float8, float8, jsonb) to public;
