-- Le jeu, ce que les scénarios croisés ne couvrent pas : bilan rejoué à la main, classement plafonné et ses
-- exclusions, prev_week_v2, sauvegarde du jeu, admin, salles (club_geo → gyms, import OSM, recherche), signaux
select set_config('tests.fichier', '13-jeu', false);
reset role;
\set J1 '00000000-0000-0000-0000-0000000f0001'
\set J2 '00000000-0000-0000-0000-0000000f0002'
\set J3 '00000000-0000-0000-0000-0000000f0003'
\set J4 '00000000-0000-0000-0000-0000000f0004'
\set J5 '00000000-0000-0000-0000-0000000f0005'
\set ADMIN '00000000-0000-0000-0000-00000000ad00'
select tests.compte(:'J1'), tests.compte(:'J2'), tests.compte(:'J3'), tests.compte(:'J4'), tests.compte(:'J5');


-- 1. Bilan rejoué : une seule ligne, étoiles une seule fois ---------------------------------------------------
select tests.comme(:'J1'); select tests.horloge('2026-11-02T10:00:00+01');
set role authenticated;
select public.set_goal(3);
select tests.seance('2026-11-02T18:00:00+01', 48.8354, 2.63), tests.seance('2026-11-04T18:00:00+01', 48.8354, 2.63),
       tests.seance('2026-11-06T07:30:00+01', 48.8354, 2.63);
select tests.horloge('2026-11-09T09:00:00+01');
select tests.egal('bilan du lundi : atteint', public.my_state() -> 'unseen_bilan' ->> 'outcome', 'atteint');
reset role;
select voter as v1 from players where user_id = :'J1' \gset
select count(*) as etoiles_avant from star_ledger where voter = :'v1' \gset
select app.settle_week(:'v1', '2026-11-02'), app.settle_due(:'v1'), app.settle_all();
select tests.egal('bilan rejoué : une seule ligne weekly_results', (select count(*) from weekly_results where voter = :'v1' and week = '2026-11-02'), 1::bigint);
select tests.egal('bilan rejoué : aucune étoile en double', (select count(*) from star_ledger where voter = :'v1'), :etoiles_avant::bigint);
select tests.egal('settle_all : rien à rattraper', app.settle_all(), 0);

-- 2. prev_week_v2 (Ange de la semaine) -------------------------------------------------------------------------
select tests.comme(:'J1');
set role authenticated;
select public.prev_week_v2() as pw \gset
select tests.egal('prev_week_v2 : n', (:'pw'::json ->> 'n')::int, 3);
select tests.egal('prev_week_v2 : week (même format que prev_week)', :'pw'::json ->> 'week', '2026-46');
select tests.egal('prev_week_v2 : Ange', (:'pw'::json ->> 'ange')::boolean, true);
select tests.egal('ack_bilan', (public.ack_bilan('2026-11-02') -> 'state' ->> 'unseen_bilan') is null, true);
reset role;

-- 3. Classement plafonné et exclusions ------------------------------------------------------------------------------
select tests.comme(:'J2'); select tests.horloge('2026-11-02T10:00:00+01'); set role authenticated; select public.set_goal(5);
select tests.seance(('2026-11-09T18:00:00+01'::timestamptz + make_interval(days => g)), 48.8502, 2.6508) from generate_series(0, 6) g;
reset role;
select tests.comme(:'J3'); select tests.horloge('2026-11-02T10:00:00+01'); set role authenticated; select public.set_goal(3);
select public.set_birth_year(2010);
select tests.seance('2026-11-10T18:00:00+01', 48.8354, 2.63);
reset role;
select tests.comme(:'J4'); select tests.horloge('2026-11-02T10:00:00+01'); set role authenticated; select public.set_goal(3);
select tests.seance('2026-11-10T18:00:00+01', 48.8354, 2.63);
reset role;
insert into bans (voter, reason) select voter, 'test' from players where user_id = :'J4';
select tests.comme(:'J5'); select tests.horloge('2026-11-02T10:00:00+01'); set role authenticated; select public.set_goal(3);
select tests.seance('2026-11-10T18:00:00+01', 48.8354, 2.63, '{"simulated": true}');
select tests.seance('2026-11-11T03:30:00+01', 48.8354, 2.63);
reset role;
select tests.ok('signal : position simulée notée (sim), sans refus', exists (select 1 from sessions s join players p using (voter) where p.user_id = :'J5' and 'sim' = any (s.flags) and s.status = 'validee'));
select tests.ok('signal : séance de nuit notée', exists (select 1 from sessions s join players p using (voter) where p.user_id = :'J5' and 'nuit' = any (s.flags)));
select tests.comme(:'J2'); select tests.horloge('2026-11-20T12:00:00+01'); set role authenticated;
select public.leaderboard_v2('month') as lb \gset
reset role;
select tests.egal('classement : 7 séances dans la semaine → 60 points (plafond de 6)',
  (select (e ->> 'points')::int from json_array_elements(:'lb'::json) e where (e ->> 'me')::boolean), 60);
select tests.egal('classement : 7 pas pour les fantômes', (select (e ->> 'steps')::int from json_array_elements(:'lb'::json) e where (e ->> 'me')::boolean), 7);
select tests.ok('classement : les clés no, pseudo, points, clubs, steps, me et rien d''autre',
  (select bool_and((select array_agg(k order by k) from json_object_keys(e) k) = array['clubs', 'me', 'no', 'points', 'pseudo', 'steps'])
     from json_array_elements(:'lb'::json) e));
select tests.ok('classement : les mineurs n''y sont pas',
  not exists (select 1 from json_array_elements(:'lb'::json) e join players p on p.visitor_no = (e ->> 'no')::int where p.user_id = :'J3'));
select tests.ok('classement : les bannis n''y sont pas',
  not exists (select 1 from json_array_elements(:'lb'::json) e join players p on p.visitor_no = (e ->> 'no')::int where p.user_id = :'J4'));
select tests.egal('classement : une séance à position simulée ne rapporte pas de points au classement',
  (select (e ->> 'points')::int from json_array_elements(:'lb'::json) e join players p on p.visitor_no = (e ->> 'no')::int where p.user_id = :'J5'), 10);
select tests.ok('classement : trié par points', (select bool_and(a >= b) from (select (e ->> 'points')::int a, lead((e ->> 'points')::int) over () b
                                                   from json_array_elements(:'lb'::json) e) x where b is not null));
select tests.comme(:'J5'); set role authenticated;
select tests.egal('les points du joueur, eux, comptent toutes ses séances', (public.my_state() ->> 'points_month')::int, 20);
reset role;
select tests.comme(:'J4'); set role authenticated;
select tests.egal('banni : plus de séance', public.session_start(48.8356, 2.6301, 20) ->> 'why', 'bloque');
select tests.egal('banni : my_state le dit', (public.my_state() ->> 'banned')::boolean, true);
reset role;
delete from bans where voter = (select voter from players where user_id = :'J4');

-- 4. Sauvegarde du jeu ------------------------------------------------------------------------------------------------
select tests.comme(:'J1'); set role authenticated;
select tests.egal('save_game : 1re sauvegarde', public.save_game('game', '{"seen": 99, "eq": {"hero": "leo"}}', null) ->> 'version', '1');
select tests.egal('save_game : le héros ne marche pas plus loin que les séances validées', public.load_game() -> 'game' -> 'data' ->> 'seen', '3');
select tests.egal('save_game : mauvaise version → conflit (avec la version du serveur)', public.save_game('game', '{"seen": 1}', 7) ->> 'why', 'conflit');
select tests.egal('save_game : trop vite', public.save_game('game', '{"seen": 1}', 1) ->> 'why', 'vite');
select tests.egal('save_game : emplacement inconnu', public.save_game('autre', '{}', null) ->> 'why', 'emplacement');
select tests.egal('save_game : 32 Ko au plus', public.save_game('prefs', jsonb_build_object('x', repeat('a', 40000)), null) ->> 'why', 'trop_gros');
reset role;
update game_saves set updated_at = now() - interval '1 minute' where voter = :'v1';
select tests.comme(:'J1'); set role authenticated;
select tests.egal('save_game : bonne version', public.save_game('game', '{"seen": 2}', 1) ->> 'version', '2');
reset role;

-- 5. Admin : séances suspectes, refuser une séance ------------------------------------------------------------------
select tests.comme(:'J1'); set role authenticated;
select tests.erreur('admin_suspects réservé à l''admin', 'select public.admin_suspects(30)', 'admin');
reset role;
select id as sid_j5 from sessions where voter = (select voter from players where user_id = :'J5') and 'sim' = any (flags) \gset
select tests.comme(:'ADMIN'); set role authenticated;
select tests.ok('admin_suspects : la séance simulée y est', position('"sim"' in public.admin_suspects(3650)::text) > 0);
select tests.ok('admin_reject_session', (public.admin_reject_session(:sid_j5) ->> 'ok')::boolean);
reset role;
select tests.ok('séance refusée : elle ne compte plus', not exists (select 1 from checkins c join sessions s on s.id = :sid_j5 where c.voter = s.voter and c.day = s.day)
                and (select status from sessions where id = :sid_j5) = 'rejetee');

-- 6. Les salles : toutes les salles de France ---------------------------------------------------------------------
select tests.comme(:'ADMIN'); set role authenticated;
insert into public.club_geo (club_id, lat, lon) values ('noisy-le-grand', 48.8400, 2.5500), ('martinique-lamentin', 14.6100, -61.0000);
update public.club_geo set lat = 48.8401 where club_id = 'noisy-le-grand';
reset role;
select tests.ok('club_geo → gyms : une position enregistrée par l''admin sur le site crée la salle',
  exists (select 1 from gyms where id = 'noisy-le-grand' and source = 'fitnesspark' and lat = 48.8401 and precise));
select tests.egal('gyms : fuseau déduit de la position (outre-mer)', (select tz from gyms where id = 'martinique-lamentin'), 'America/Martinique');
select tests.egal('import OSM : 2 salles écrites, la Fitness Park en double ignorée', app.import_gyms('[
  {"id": "osm-n2001", "name": "Fitness Park", "brand": "Fitness Park", "lat": 48.8356, "lon": 2.6302, "source": "osm", "osm_ref": "node/2001"},
  {"id": "osm-n2002", "name": "L''Orange Bleue Noisiel", "brand": "L''Orange Bleue", "city": "Noisiel", "postcode": "77186", "lat": 48.8460, "lon": 2.6200, "source": "osm", "osm_ref": "node/2002"},
  {"id": "osm-w2003", "name": "Salle fermée", "lat": 48.8300, "lon": 2.6100, "source": "osm", "osm_ref": "way/2003", "active": false}]'), 2);
select tests.ok('import OSM : pas de doublon de la Fitness Park', not exists (select 1 from gyms where id = 'osm-n2001'));
select app.import_gyms('[{"id": "lognes", "name": "Lognes", "brand": "Fitness Park", "address": "Rue de Paris", "postcode": "77185", "city": "Lognes", "lat": 48.9, "lon": 2.7, "source": "fitnesspark", "precise": false}]');
select tests.ok('import : une position approchée ne remplace jamais une position précise',
  exists (select 1 from gyms where id = 'lognes' and lat = 48.8354 and city = 'Lognes' and name = 'Lognes'));
update gyms set name = 'Fitness Park Lognes' where id = 'lognes';
select tests.comme(:'J1'); select tests.horloge('2026-11-12T18:00:00+01'); set role authenticated;
select tests.egal('gyms_near : la plus proche d''abord', public.gyms_near(48.8354, 2.63, 3) -> 0 ->> 'id', 'lognes');
select tests.egal('gyms_near : distance arrondie', (public.gyms_near(48.8354, 2.63, 3) -> 0 ->> 'dist')::int, 0);
select tests.ok('gyms_search : par ville, sans accents ni casse', position('osm-n2002' in public.gyms_search('noisiel')::text) > 0);
select tests.ok('gyms_search : par code postal', position('osm-n2002' in public.gyms_search('77186')::text) > 0);
select tests.egal('gyms_search : trop court', public.gyms_search('a')::text, '[]');
select tests.egal('une séance dans une salle OSM', tests.seance('2026-11-12T18:00:00+01', 48.8460, 2.6200) -> 'state' -> 'today' ->> 'club', 'osm-n2002');
select tests.horloge('2026-11-13T18:00:00+01');
select tests.egal('une salle fermée n''est jamais choisie', public.session_start(48.8300, 2.6100, 20) ->> 'club', 'lognes');
select tests.egal('set_home_club : une salle OSM', public.set_home_club('osm-n2002') -> 'state' ->> 'home_club', 'osm-n2002');
select tests.egal('set_home_club : salle inconnue', public.set_home_club('nulle-part') ->> 'why', 'salle');
select tests.egal('set_home_club : outre-mer → fuseau du profil', public.set_home_club('martinique-lamentin') -> 'state' ->> 'tz', 'America/Martinique');
select public.set_home_club(null);
reset role;

-- 7. Garde-fous des séances -----------------------------------------------------------------------------------------
select tests.comme(:'J3'); set role authenticated;
select tests.horloge('2026-11-14T10:00:' || lpad((g * 5)::text, 2, '0') || '+01'), public.session_start(48.9, 2.63, 20) from generate_series(0, 7) g;
select tests.horloge('2026-11-14T10:01:00+01');
select tests.egal('8 refus dans la journée → quota', public.session_start(48.9, 2.63, 20) ->> 'why', 'quota');
select tests.horloge('2026-11-15T10:00:00+01');
select tests.egal('le lendemain, ça repart', public.session_start(48.9, 2.63, 20) ->> 'why', 'loin');
select tests.egal('moins de 3 secondes entre deux essais → vite', public.session_start(48.9, 2.63, 20) ->> 'why', 'vite');
select tests.horloge('2026-11-15T10:05:00+01');
select tests.egal('position impossible', public.session_start(95, 2.63, 20) ->> 'why', 'position');
select tests.horloge('2026-11-15T10:06:00+01');
select tests.egal('pause : type inconnu', public.pause_start('vacances', 1) ->> 'why', 'type');
select tests.egal('pause : 6 semaines au plus', public.pause_start('pause', 7) ->> 'why', 'duree');
select tests.ok('pause : ok', (public.pause_start('pause', 1) ->> 'ok')::boolean);
select tests.egal('pause : une seule à la fois', public.pause_start('pause', 1) ->> 'why', 'deja');
select tests.egal('coffre : clé inconnue', public.open_chest('semaine:2000-01-03') ->> 'why', 'introuvable');
select tests.egal('coffre : pas:N au-delà des séances', public.open_chest('pas:30') ->> 'why', 'introuvable');
reset role;
select tests.horloge(null);
-- les salles ajoutées ici repartent (les scénarios croisés travaillent sur leur propre liste)
delete from public.gyms where id in ('noisy-le-grand', 'martinique-lamentin', 'osm-n2002', 'osm-w2003');
delete from public.club_geo where club_id in ('noisy-le-grand', 'martinique-lamentin');
update public.gyms set address = null, postcode = null, city = null where id = 'lognes';
