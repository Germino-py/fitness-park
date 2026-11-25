-- Données « d'avant la migration » : ce que le site a déjà créé avec les anciennes RPC à p_voter.
-- (players, checkins et pseudos ont été vidés ce matin sur le vrai projet ; on recrée 2 sportifs du site
--  et des avis, gardés eux, pour vérifier que les migrations n'y touchent pas et que la reprise marche.)
set role anon;
-- L1 : un sportif du site, 3 séances (dont une aujourd'hui par la vraie RPC), un pseudo
select public.checkin('0123456789abcdef0123456789abcdef', 45678, 'lognes', 48.8356, 2.6302, 12);
select public.set_pseudo('0123456789abcdef0123456789abcdef', 45678, 'Leo_77');
-- L2 : un autre sportif du site, une séance aujourd'hui à Torcy
select public.checkin('fedcba9876543210fedcba9876543210', 51234, 'torcy', 48.8504, 2.6510, 20);
reset role;
insert into public.checkins (voter, day, club_id, dist_m, created_at) values
  ('0123456789abcdef0123456789abcdef', current_date - 8, 'lognes', 20, now() - interval '8 days'),
  ('0123456789abcdef0123456789abcdef', current_date - 15, 'torcy', 30, now() - interval '15 days');
-- des avis gardés (dont un signé du numéro de L1, comme le fait le site : …-000000045678)
set role anon;
insert into public.reviews (id, club_id, rating, comment, hidden) values
  ('11111111-1111-4111-8111-000000045678', 'lognes', 9, 'Super salle, coachs au top', true);
insert into public.reviews (id, club_id, rating) values ('22222222-2222-4222-8222-000000051234', 'torcy', 7);
reset role;
update public.reviews set hidden = false;   -- (l'admin a validé le commentaire)
insert into public.review_votes values ('11111111-1111-4111-8111-000000045678', 'fedcba9876543210fedcba9876543210', 1, now());
update public.reviews set up = 1 where id = '11111111-1111-4111-8111-000000045678';
