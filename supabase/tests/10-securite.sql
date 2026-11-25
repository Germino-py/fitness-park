-- Sécurité : droits (piège F12 des droits par défaut), RLS, schéma interne, jeton, invitation, cloisonnement
select set_config('tests.fichier', '10-securite', false);
reset role;
select tests.horloge(null);

-- 1. Les droits, vus du catalogue ------------------------------------------------------------------------
select tests.ok('schéma app : aucun droit pour anon ni authenticated',
  not has_schema_privilege('anon', 'app', 'usage') and not has_schema_privilege('authenticated', 'app', 'usage'));
select tests.ok('fonctions internes (app.*) : aucune exécutable par anon ou authenticated (' || count(*) || ' vérifiées)',
  count(*) filter (where has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) = 0)
  from pg_proc p where p.pronamespace = 'app'::regnamespace;
select tests.egal('fonctions publiques ouvertes à anon : les anciennes du site, has_access et review_signer_banned, rien d''autre',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
    where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')),
  'checkin,feature_on,has_access,is_admin,leaderboard,my_pseudo,my_score,prev_week,pseudo_check,pseudo_key,pseudo_list,review_signer_banned,set_pseudo,vote_review');
select tests.ok('RPC ouverte aux comptes connectés : ' || x,
  exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = x
            and has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')))
  from unnest(array['my_state', 'set_goal', 'session_start', 'session_confirm', 'pause_start', 'pause_end', 'set_soft_mode',
                    'set_birth_year', 'set_home_club', 'ack_bilan', 'open_chest', 'leaderboard_v2', 'prev_week_v2', 'load_game',
                    'save_game', 'gyms_near', 'gyms_search', 'redeem_invite', 'account_status', 'claim_legacy_account',
                    'create_transfer_code', 'redeem_transfer_code', 'delete_account', 'my_export', 'my_score_v2', 'pseudo_check_v2',
                    'set_pseudo_v2', 'vote_review_v2', 'post_review_v2', 'report_content', 'block_member', 'unblock_member',
                    'my_blocks', 'admin_create_invite', 'admin_list_invites', 'admin_revoke_invite', 'admin_suspects',
                    'admin_reject_session', 'admin_reports', 'admin_report_decide', 'admin_ban']) x;
select tests.ok('table fermée à l''API : ' || t,
  not has_table_privilege('anon', 'public.' || t, 'select,insert,update,delete,truncate,references,trigger')
  and not has_table_privilege('authenticated', 'public.' || t, 'select,insert,update,delete,truncate,references,trigger'))
  from unnest(array['game_config', 'retired_visitor_nos', 'invites', 'access_grants', 'auth_attempts', 'transfer_codes', 'review_authors',
                    'profiles', 'goal_history', 'sessions', 'session_attempts', 'weekly_results', 'pauses', 'quests', 'star_ledger',
                    'chest_grants', 'game_saves', 'reports', 'moderation_holds', 'blocks', 'bans', 'players', 'checkins', 'pseudos']) t;
select tests.ok('gyms : lisible par tous, jamais modifiable par l''API',
  has_table_privilege('anon', 'public.gyms', 'select') and has_table_privilege('authenticated', 'public.gyms', 'select')
  and not has_table_privilege('anon', 'public.gyms', 'insert,update,delete') and not has_table_privilege('authenticated', 'public.gyms', 'insert,update,delete'));
select tests.ok('RLS activée sur toutes les tables de public',
  not exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity));
select tests.ok('séquences fermées',
  not exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'
                 and (has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('authenticated', c.oid, 'usage'))));
select tests.ok('SECURITY DEFINER : search_path toujours fixé',
  not exists (select 1 from pg_proc p where p.pronamespace in ('public'::regnamespace, 'app'::regnamespace) and p.prosecdef
                 and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')));
select tests.ok('les séances ne gardent aucune coordonnée (pas de colonne lat / lon)',
  not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name in ('sessions', 'session_attempts', 'checkins')
                 and column_name ~ '^(lat|lon|latitude|longitude)'));
select tests.ok('jamais l''extension http', not exists (select 1 from pg_extension where extname in ('http', 'pg_net')));

-- 2. Sans jeton, sans invitation ----------------------------------------------------------------------------
select tests.comme(null);
set role anon;
select tests.erreur('anon (clé publique seule) : my_state refusé', 'select public.my_state()', 'permission denied');
select tests.erreur('anon : session_start refusé', 'select public.session_start(48.8, 2.6, 20)', 'permission denied');
select tests.erreur('anon : lecture directe de profiles refusée', 'select * from public.profiles', 'permission denied');
select tests.erreur('anon : lecture de game_config refusée', 'select * from public.game_config', 'permission denied');
select tests.erreur('anon : fonction interne refusée', 'select app.state_json(null)', 'permission denied');
select tests.ok('anon : la liste des salles est publique', (select count(*) from public.gyms) >= 6);
reset role;

set role authenticated;
select tests.erreur('authenticated sans jeton (sub vide) : « connexion requise »', 'select public.my_state()', 'auth');
reset role;

select tests.compte('00000000-0000-0000-0000-00000000a001', false);      -- compte anonyme, sans invitation
select tests.comme('00000000-0000-0000-0000-00000000a001');
set role authenticated;
select tests.ok('sans invitation : has_access() = false', not public.has_access());
select tests.erreur('sans invitation : my_state refusé (hint invite)', 'select public.my_state()', 'invite');
select tests.erreur('sans invitation : set_goal refusé', 'select public.set_goal(3)', 'invite');
select tests.erreur('sans invitation : report_content refusé', 'select public.report_content(''member'', ''45678'', ''spam'')', 'invite');
select tests.egal('sans invitation : account_status répond quand même', (public.account_status() ->> 'access'), 'false');
select tests.erreur('authenticated : écriture directe dans gyms refusée', 'insert into public.gyms (id, name, lat, lon) values (''x'', ''x'', 1, 1)', 'permission denied');
select tests.erreur('authenticated : lecture directe de sessions refusée', 'select * from public.sessions', 'permission denied');
select tests.erreur('authenticated : RPC admin refusée', 'select public.admin_reports()', 'admin');
reset role;
select tests.ok('sans invitation : aucun joueur créé', not exists (select 1 from players where user_id = '00000000-0000-0000-0000-00000000a001'));

-- 3. Cloisonnement entre deux joueurs -------------------------------------------------------------------
select tests.horloge('2026-11-23T10:00:00+01');
select tests.compte('00000000-0000-0000-0000-00000000a002');
select tests.compte('00000000-0000-0000-0000-00000000a003');
select tests.comme('00000000-0000-0000-0000-00000000a002');
set role authenticated;
select public.set_goal(3);
select public.session_start(48.8356, 2.6301, 20);
reset role;
select max(id) as sid_a from sessions where voter = (select voter from players where user_id = '00000000-0000-0000-0000-00000000a002') \gset
select voter as voter_a from players where user_id = '00000000-0000-0000-0000-00000000a002' \gset
select tests.comme('00000000-0000-0000-0000-00000000a003');
select tests.horloge('2026-11-23T10:40:00+01');
set role authenticated;
select public.set_goal(3);
select tests.egal('B ne peut pas finir la séance de A', public.session_confirm(:sid_a, 48.8356, 2.6302, 20) ->> 'why', 'introuvable');
select tests.ok('l''état de B ne contient rien de A', position(:'voter_a' in public.my_state()::text) = 0 and (public.my_state() ->> 'session') is null);
select tests.ok('l''export de B ne contient rien de A', position(:'voter_a' in public.my_export()::text) = 0);
reset role;
select tests.comme('00000000-0000-0000-0000-00000000a002');
set role authenticated;
select tests.ok('A finit sa séance', (public.session_confirm(:sid_a, 48.8356, 2.6302, 20) ->> 'ok')::boolean);
select tests.ok('my_state ne contient jamais la clé interne (voter) d''un nouveau joueur', position(:'voter_a' in public.my_state()::text) = 0);
select tests.ok('le classement ne contient aucune clé interne', position(:'voter_a' in public.leaderboard_v2('all')::text) = 0
                and position('"voter"' in public.leaderboard_v2('all')::text) = 0);
reset role;

-- 4. L'horloge de test n'existe que dans une base de test --------------------------------------------------
update game_config set value = 'false' where key = 'horloge_test';
select tests.horloge('2000-01-01T00:00:00Z');
select tests.ok('horloge de test ignorée quand game_config.horloge_test n''est pas true', app.now() > '2020-01-01');
update game_config set value = 'true' where key = 'horloge_test';
select tests.ok('horloge de test active dans la base de test', app.now() = '2000-01-01T00:00:00Z');
select tests.horloge(null);
