-- Les anciennes RPC du site (p_voter, clé publique anon) marchent toujours après les migrations,
-- et les données d'avant (01-donnees-avant.sql) sont intactes
select set_config('tests.fichier', '11-anciennes-rpc', false);
reset role;
select tests.horloge(null);
select tests.comme(null);

select tests.egal('données d''avant : 2 avis gardés', (select count(*) from reviews where id in ('11111111-1111-4111-8111-000000045678', '22222222-2222-4222-8222-000000051234')), 2::bigint);
select tests.egal('données d''avant : le commentaire validé est intact', (select comment from reviews where id = '11111111-1111-4111-8111-000000045678'), 'Super salle, coachs au top');
select tests.egal('données d''avant : les 3 séances de L1', (select count(*) from checkins where voter = '0123456789abcdef0123456789abcdef'), 3::bigint);
select tests.egal('données d''avant : le pouce gardé', (select up from reviews where id = '11111111-1111-4111-8111-000000045678'), 1);

set role anon;
select tests.ok('checkin (nouvel appareil du site)',
  (public.checkin('abcdefabcdefabcdefabcdefabcdef01', 23456, 'torcy', 48.8503, 2.6509, 15) ->> 'ok')::boolean);
select tests.egal('checkin : une seule par jour', public.checkin('abcdefabcdefabcdefabcdefabcdef01', 23456, 'torcy', 48.8503, 2.6509, 15) ->> 'why', 'deja');
select tests.ok('checkin : trop loin refusé', (public.checkin('abcdefabcdefabcdefabcdefabcdef02', 23457, 'torcy', 48.9, 2.6509, 15) ->> 'ok')::boolean is false);
select tests.egal('my_score', (public.my_score('0123456789abcdef0123456789abcdef') ->> 'days')::int, 3);
select tests.ok('leaderboard (mois)', json_array_length(public.leaderboard('month', '0123456789abcdef0123456789abcdef')) >= 2);
select tests.egal('pseudo_check : déjà pris', public.pseudo_check('leo77', null), 'pris');
select tests.ok('set_pseudo', (public.set_pseudo('abcdefabcdefabcdefabcdefabcdef01', 23456, 'Nouveau_77') ->> 'ok')::boolean);
select tests.egal('pseudo_list', public.pseudo_list() ->> '45678', 'Leo_77');
select tests.egal('my_pseudo', public.my_pseudo('0123456789abcdef0123456789abcdef') ->> 'pseudo', 'Leo_77');
select tests.ok('prev_week', (public.prev_week('0123456789abcdef0123456789abcdef') ->> 'n') is not null);
select tests.egal('vote_review', public.vote_review('11111111-1111-4111-8111-000000045678', 'abcdefabcdefabcdefabcdefabcdef01', 1) ->> 'up', '2');
insert into public.reviews (id, club_id, rating) values ('33333333-3333-4333-8333-000000023456', 'torcy', 8);
reset role;
select tests.ok('l''avis du site est enregistré', exists (select 1 from reviews where id = '33333333-3333-4333-8333-000000023456'));
select tests.ok('le site n''a créé aucun profil de jeu', not exists (select 1 from profiles where voter = 'abcdefabcdefabcdefabcdefabcdef01'));
