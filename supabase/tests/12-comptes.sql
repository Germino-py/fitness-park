-- Comptes : invitations, reprise d'un compte du site (clé, code de 27 / 28 caractères, lien), fusion, date
-- limite, transfert d'appareil, suppression en cascade, export, RPC v2, ménage
select set_config('tests.fichier', '12-comptes', false);
reset role;
select tests.horloge(null);
\set U1 '00000000-0000-0000-0000-0000000b0001'
\set U2 '00000000-0000-0000-0000-0000000b0002'
\set U3 '00000000-0000-0000-0000-0000000b0003'
\set U4 '00000000-0000-0000-0000-0000000b0004'
\set U5 '00000000-0000-0000-0000-0000000b0005'
\set C1 '00000000-0000-0000-0000-0000000c0001'
\set C2 '00000000-0000-0000-0000-0000000c0002'
\set C3 '00000000-0000-0000-0000-0000000c0003'
\set C4 '00000000-0000-0000-0000-0000000c0004'
\set C5 '00000000-0000-0000-0000-0000000c0005'
\set M '00000000-0000-0000-0000-0000000d0001'
\set ADMIN '00000000-0000-0000-0000-00000000ad00'
\set L1 '0123456789abcdef0123456789abcdef'
\set L2 'fedcba9876543210fedcba9876543210'
\set L3 '33333333333333333333333333333333'
\set L4 '44444444444444444444444444444444'

-- 1. Invitations ------------------------------------------------------------------------------------------
select app.add_invite('Test-Invit-2026', 'Testeurs', 2, 30);
select tests.compte(:'U1', false), tests.compte(:'U2', false), tests.compte(:'U3', false), tests.compte(:'U4', false), tests.compte(:'U5', false);
select tests.ok('invitation : seule l''empreinte du code est gardée', not exists (select 1 from invites where label = 'Testeurs' and code_hash ilike '%invit%'));
select tests.comme(:'U1');
set role authenticated;
select tests.egal('invitation : mauvais code', public.redeem_invite('mauvais-code') ->> 'why', 'code');
select tests.ok('invitation : bon code (casse, tirets et espaces ignorés)', (public.redeem_invite(' test invit 2026 ') ->> 'ok')::boolean);
select tests.ok('invitation : has_access() vrai ensuite', public.has_access());
select tests.egal('invitation : une 2e fois → deja', public.redeem_invite('test-invit-2026') ->> 'why', 'deja');
select tests.egal('account_status', public.account_status()::jsonb - 'mode', '{"access": true, "player": false, "no": null, "anonymous": true, "admin": false}'::jsonb);
reset role;
select tests.comme(:'U2'); set role authenticated; select public.redeem_invite('TEST-INVIT-2026'); reset role;
select tests.comme(:'U3'); set role authenticated;
select tests.egal('invitation : nombre d''utilisations atteint', public.redeem_invite('test-invit-2026') ->> 'why', 'code');
reset role;
select tests.comme(:'U4'); set role authenticated;
select public.redeem_invite('faux-' || g) from generate_series(1, 5) g;
select tests.egal('invitation : 5 échecs par heure au plus', public.redeem_invite('test-invit-2026') ->> 'why', 'limite');
select tests.erreur('invitation : créer un code est réservé à l''admin', 'select public.admin_create_invite(''x'')', 'admin');
reset role;
select tests.comme(:'ADMIN'); set role authenticated;
select public.admin_create_invite('Amis', 3, 10) ->> 'code' as code_amis \gset
select tests.ok('admin : lien d''invitation', public.admin_create_invite('Lien', 1, 10) ->> 'link' like 'https://hmgfitness.fr/invite/?c=%');
reset role;
select left(app.code_hash(:'code_amis'), 12) as id_amis \gset
select tests.comme(:'ADMIN'); set role authenticated;
select tests.ok('admin : révoquer une invitation', (public.admin_revoke_invite(:'id_amis') ->> 'ok')::boolean);
reset role;
select tests.comme(:'U5'); set role authenticated;
select tests.egal('invitation révoquée : refusée', public.redeem_invite(:'code_amis') ->> 'why', 'code');
reset role;

-- 2. Reprise d'un compte du site -----------------------------------------------------------------------------
select tests.compte(:'C1', false), tests.compte(:'C2', false), tests.compte(:'C3', false), tests.compte(:'C4', false), tests.compte(:'C5', false);
select tests.comme(:'C1'); set role authenticated;
select public.claim_legacy_account('04HMASW9NF6YY0938NKRKAYDXW5R') as r \gset
select tests.ok('reprise par le code de 28 caractères', (:'r'::json ->> 'ok')::boolean);
select tests.egal('reprise : le numéro du site est gardé', (:'r'::json ->> 'no')::int, 45678);
select tests.egal('reprise : le héros du code', (:'r'::json ->> 'hero')::int, 5);
select tests.ok('reprise d''un compte d''avant la migration : entre sans invitation', public.has_access());
select tests.egal('reprise : les 3 séances du site sont là', (public.my_state() ->> 'steps')::int, 3);
select tests.egal('reprise : même graine que le site (même aventure)', public.my_state() ->> 'seed', :'L1');
select tests.egal('reprise : le pseudo suit', public.my_state() ->> 'pseudo', 'Leo_77');
select tests.egal('reprise : pas encore d''objectif', (public.my_state() ->> 'onboarded')::boolean, false);
select tests.egal('reprise : une 2e fois → deja', public.claim_legacy_account(:'L1') ->> 'why', 'deja');
reset role;
select tests.egal('reprise : accès noté « legacy »', (select via from access_grants where user_id = :'C1'), 'legacy');

select tests.comme(:'C2'); set role authenticated;
select tests.egal('reprise : un compte déjà repris ailleurs → pris (clé)', public.claim_legacy_account(:'L1') ->> 'why', 'pris');
select tests.egal('reprise : pris (code de 27 caractères)', public.claim_legacy_account('04HMASW9NF6YY0938NKRKAYDXWK') ->> 'why', 'pris');
select tests.ok('reprise refusée : aucun accès donné', not public.has_access());
select tests.egal('reprise : code au contrôle faux → invalide', public.claim_legacy_account('04HMASW9NF6YY0938NKRKAYDXW5S') ->> 'why', 'invalide');
select tests.egal('reprise : clé inconnue → inconnu', public.claim_legacy_account('ffffffffffffffffffffffffffffffff') ->> 'why', 'inconnu');
reset role;

select tests.comme(:'C3'); set role authenticated;
select public.claim_legacy_account('https://hmgfitness.fr/#compte=eyJ2IjoiZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTAiLCJnIjp7Imhlcm8iOiJsZW8ifSwibSI6WyJsb2duZXMiXX0') as r \gset
select tests.ok('reprise par le lien #compte=…', (:'r'::json ->> 'ok')::boolean and (:'r'::json ->> 'no')::int = 51234);
reset role;

-- date limite : un compte du site créé APRÈS la migration ne fait pas entrer sans invitation
set role anon;
select public.checkin(:'L4', 44444, 'lognes', 48.8356, 2.6302, 12);
reset role;
select tests.comme(:'C4'); set role authenticated;
select tests.erreur('reprise d''un compte d''après la migration sans invitation → invitation demandée',
                    format('select public.claim_legacy_account(%L)', :'L4'), 'invite');
reset role;

-- fusion : un joueur de l'appli reprend un compte du site ; rien n'est perdu
select tests.compte(:'M');
set role anon;
select public.checkin(:'L3', 33333, 'lognes', 48.8356, 2.6302, 12);
reset role;
select tests.comme(:'M'); set role authenticated;
select public.set_goal(4);
select public.save_game('game', '{"x": 1}', null);
select public.session_start(48.8504, 2.6510, 20);
reset role;
select tests.horloge((now() + interval '30 minutes')::text);
select max(id) as sid_m from sessions where voter = (select voter from players where user_id = :'M') \gset
set role authenticated;
select tests.ok('fusion : séance de l''appli validée', (public.session_confirm(:sid_m, 48.8504, 2.6511, 20) ->> 'ok')::boolean);
select public.claim_legacy_account(:'L3', 5) as r \gset
select tests.ok('fusion : reprise acceptée', (:'r'::json ->> 'ok')::boolean);
select tests.egal('fusion : le numéro du site est gardé', (public.my_state() ->> 'no')::int, 33333);
select tests.egal('fusion : l''objectif choisi dans l''appli suit', (public.my_state() ->> 'goal')::int, 4);
select tests.egal('fusion : la sauvegarde du jeu suit', public.load_game() -> 'game' -> 'data' ->> 'x', '1');
select tests.egal('fusion : une séance par jour au plus (le même jour des deux côtés)', (public.my_state() ->> 'steps')::int, 1);
reset role;
select tests.egal('fusion : un seul joueur pour ce compte', (select count(*) from players where user_id = :'M'), 1::bigint);
select tests.egal('fusion : anciennes étoiles du site converties une fois, bornées (2 × 25)',
  (select sum(delta) from star_ledger where voter = :'L3' and reason = 'migration')::int, 50);
select tests.horloge(null);

-- 3. Changer de téléphone sans Apple -------------------------------------------------------------------------
select tests.comme(:'C1'); set role authenticated;
select public.create_transfer_code() as r \gset
select tests.ok('transfert : code XXXXX-XXXXX valable 15 minutes', :'r'::json ->> 'code' ~ '^[0-9A-Z]{5}-[0-9A-Z]{5}$');
reset role;
select :'r'::json ->> 'code' as code_tr \gset
select tests.ok('transfert : seule l''empreinte est gardée', not exists (select 1 from transfer_codes where code_hash like '%' || replace(:'code_tr', '-', '') || '%'));
select tests.comme(:'C1', false); set role authenticated;
select tests.egal('transfert : compte relié à Apple → il suffit de se connecter avec Apple', public.create_transfer_code() ->> 'why', 'apple');
reset role;
select tests.comme(:'C5'); set role authenticated;
select tests.egal('transfert : mauvais code', public.redeem_transfer_code('AAAAA-AAAAA') ->> 'why', 'code');
select tests.ok('transfert : bon code (minuscules acceptées)', (public.redeem_transfer_code(lower(:'code_tr')) ->> 'ok')::boolean);
select tests.egal('transfert : le joueur a changé de téléphone', (public.my_state() ->> 'no')::int, 45678);
select tests.ok('transfert : l''accès au test suit', public.has_access());
select tests.egal('transfert : code à usage unique', public.redeem_transfer_code(:'code_tr') ->> 'why', 'code');
reset role;
select tests.comme(:'C1'); set role authenticated;
select tests.egal('transfert : l''ancien téléphone n''a plus le joueur', (public.account_status() ->> 'player')::boolean, false);
reset role;

-- 4. RPC v2 (sans p_voter) ----------------------------------------------------------------------------------
select tests.comme(:'C3'); set role authenticated;
select tests.egal('my_score_v2', (public.my_score_v2() ->> 'days')::int, 1);
select public.post_review_v2('lognes', 9, '  Très   bonne salle  ') as r \gset
select tests.ok('post_review_v2 : l''avis est signé du numéro du compte (pas du client)', (:'r'::json ->> 'id') like '%-000000051234');
select tests.egal('post_review_v2 : un commentaire attend la validation', (:'r'::json ->> 'hidden')::boolean, true);
select tests.egal('post_review_v2 : un avis par salle et par semaine', public.post_review_v2('lognes', 8) ->> 'why', 'deja');
select tests.erreur('post_review_v2 : note entre 1 et 10', 'select public.post_review_v2(''torcy'', 11)', 'Note');
select tests.egal('pseudo_check_v2', public.pseudo_check_v2('Leo_77'), 'pris');
select tests.ok('set_pseudo_v2', (public.set_pseudo_v2('Laura_971') ->> 'ok')::boolean);
reset role;
update reviews set hidden = false where id = (:'r'::json ->> 'id')::uuid;
select tests.egal('review_authors : l''auteur réel est gardé (fermé à l''API)', (select voter from review_authors where review_id = (:'r'::json ->> 'id')::uuid), :'L2');
select tests.comme(:'C5'); set role authenticated;
select tests.egal('vote_review_v2', public.vote_review_v2((:'r'::json ->> 'id')::uuid, 1) ->> 'up', '1');
reset role;

-- 5. Export (RGPD art. 15 et 20) --------------------------------------------------------------------------------
select tests.comme(:'C3'); set role authenticated;
select public.my_export() as ex \gset
reset role;
select tests.ok('export : clé ' || k, :'ex'::jsonb ? k)
  from unnest(array['exported_at', 'compte', 'player', 'pseudo', 'checkins', 'reviews', 'votes', 'profil', 'objectifs', 'seances',
                    'bilans', 'pauses', 'quetes', 'etoiles', 'coffres', 'sauvegardes', 'signalements_envoyes', 'membres_masques']) k;
select tests.ok('export : aucune clé interne ni empreinte de position', position(:'L2' in :'ex') = 0 and position('loc_hash' in :'ex') = 0);

-- 6. Supprimer son compte -----------------------------------------------------------------------------------------
select tests.comme(:'ADMIN'); set role authenticated;
select tests.erreur('le compte admin ne se supprime pas depuis l''appli', 'select public.delete_account()', 'admin');
reset role;
select tests.comme(:'C5'); set role authenticated;
select tests.ok('suppression', (public.delete_account() ->> 'ok')::boolean);
reset role;
select tests.ok('suppression : le compte Supabase est effacé', not exists (select 1 from auth.users where id = :'C5'));
select tests.ok('suppression : le joueur et ses séances', not exists (select 1 from players where voter = :'L1') and not exists (select 1 from checkins where voter = :'L1'));
select tests.ok('suppression : le pseudo est libéré', not exists (select 1 from pseudos where pseudo = 'Leo_77'));
select tests.ok('suppression : les avis signés de son numéro (site) sont effacés', not exists (select 1 from reviews where id = '11111111-1111-4111-8111-000000045678'));
select tests.ok('suppression : ses pouces sont effacés', not exists (select 1 from review_votes where voter = :'L1'));
select tests.ok('suppression : son accès au test', not exists (select 1 from access_grants where user_id = :'C5'));
select tests.ok('suppression : le numéro 45678 ne sera jamais redonné', exists (select 1 from retired_visitor_nos where visitor_no = 45678));
select tests.ok('suppression : les avis des autres restent', exists (select 1 from reviews where id = '22222222-2222-4222-8222-000000051234'));

-- 7. Ménage ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, is_anonymous, created_at) values ('00000000-0000-0000-0000-0000000e0001', true, now() - interval '40 days'),
                                                              ('00000000-0000-0000-0000-0000000e0002', true, now() - interval '8 days');
select app.purge();
select tests.ok('ménage : comptes anonymes jamais utilisés (30 j) ou sans invitation (7 j) effacés',
  not exists (select 1 from auth.users where id in ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000e0002')));
select tests.ok('ménage : les comptes qui jouent sont gardés', exists (select 1 from auth.users where id = :'C3'));
