-- Modération (App Store 1.2) : signaler, masquage automatique à 3 personnes, décision de l'admin, masquer un
-- membre pour soi, bannir ; effacement des signalements avec le contenu ou le compte
select set_config('tests.fichier', '14-moderation', false);
reset role;
select tests.horloge(null);
\set A '00000000-0000-0000-0000-0000000a0a01'
\set R1 '00000000-0000-0000-0000-0000000a0b01'
\set R2 '00000000-0000-0000-0000-0000000a0b02'
\set R3 '00000000-0000-0000-0000-0000000a0b03'
\set R4 '00000000-0000-0000-0000-0000000a0b04'
\set ADMIN '00000000-0000-0000-0000-00000000ad00'
select tests.compte(:'A'), tests.compte(:'R1'), tests.compte(:'R2'), tests.compte(:'R3'), tests.compte(:'R4');

-- l'auteur : un pseudo, un avis commenté (validé par l'admin), une séance ce mois-ci
select tests.comme(:'A'); set role authenticated;
select public.set_pseudo_v2('Auteur_1');
select public.post_review_v2('torcy', 3, 'Un commentaire à signaler') ->> 'id' as rid \gset
select public.post_review_v2('lognes', 2, 'Un autre commentaire') ->> 'id' as rid2 \gset
select public.set_goal(3);
select tests.seance(now(), 48.8354, 2.63);
reset role;
select tests.horloge(null);
update reviews set hidden = false where id in (:'rid'::uuid, :'rid2'::uuid);
select visitor_no as ano, voter as av from players where user_id = :'A' \gset

-- 1. Signaler un avis -----------------------------------------------------------------------------------------------
select tests.comme(:'R1'); set role authenticated;
select public.report_content('review', :'rid', 'insulte', '  propos   blessants ') as r \gset
select tests.ok('signaler un avis', (:'r'::json ->> 'ok')::boolean and not (:'r'::json ->> 'hidden')::boolean);
select tests.egal('signaler : une seule fois par personne', public.report_content('review', :'rid', 'spam') ->> 'why', 'deja');
select tests.egal('signaler : raison inconnue', public.report_content('review', :'rid', 'bof') ->> 'why', 'raison');
select tests.egal('signaler : type inconnu', public.report_content('avis', :'rid', 'spam') ->> 'why', 'type');
select tests.egal('signaler : avis inconnu', public.report_content('review', '00000000-0000-4000-8000-000000000000', 'spam') ->> 'why', 'introuvable');
select tests.egal('signaler : identifiant malformé', public.report_content('review', 'x''; drop table reviews; --', 'spam') ->> 'why', 'introuvable');
select tests.erreur('signaler : la table des signalements est fermée', 'select * from public.reports', 'permission denied');
reset role;
select tests.comme(:'A'); set role authenticated;
select tests.egal('signaler son propre avis : non', public.report_content('review', :'rid', 'spam') ->> 'why', 'soi');
reset role;
select tests.egal('signalement : l''auteur et le contenu sont notés', (select target_voter = :'av' and snapshot ->> 'comment' = 'Un commentaire à signaler' and note = 'propos blessants'
                                                                     from reports where target_id = :'rid'), true);
select tests.comme(:'R2'); set role authenticated; select public.report_content('review', :'rid', 'insulte'); reset role;
select tests.ok('2 signalements : encore visible', not (select hidden from reviews where id = :'rid'::uuid));
select tests.comme(:'R3'); set role authenticated;
select tests.egal('3e signalement d''une autre personne : masqué automatiquement', public.report_content('review', :'rid', 'haine') ->> 'hidden', 'true');
reset role;
select tests.ok('l''avis masqué n''est plus public', (select hidden from reviews where id = :'rid'::uuid));
set role anon;
select tests.egal('anon ne le voit plus', (select count(*) from public.reviews where id = :'rid'::uuid), 0::bigint);
reset role;

-- 2. L'admin décide -------------------------------------------------------------------------------------------------
select tests.comme(:'R1'); set role authenticated;
select tests.erreur('admin_reports réservé à l''admin', 'select public.admin_reports()', 'admin');
reset role;
select tests.comme(:'ADMIN'); set role authenticated;
select public.admin_reports() as ar \gset
select tests.ok('admin_reports : le contenu, 3 signalements, masqué, numéro de l''auteur',
  exists (select 1 from json_array_elements(:'ar'::json) e where e ->> 'target' = :'rid' and (e ->> 'n')::int = 3 and (e ->> 'hidden')::boolean
                                                            and (e ->> 'author_no')::int = :ano));
select tests.ok('admin_reports : jamais d''identifiant interne', position(:'av' in :'ar') = 0);
select (select (e ->> 'id')::bigint from json_array_elements(:'ar'::json) e where e ->> 'target' = :'rid') as rep_id \gset
select tests.ok('décision « garder »', (public.admin_report_decide(:rep_id, 'garder') ->> 'ok')::boolean);
reset role;
select tests.ok('gardé : l''avis est de nouveau visible', not (select hidden from reviews where id = :'rid'::uuid));
select tests.egal('gardé : signalements classés « rejete »', (select string_agg(distinct status, ',') from reports where target_id = :'rid'), 'rejete');
-- le 2e avis : retiré
select tests.comme(:'R1'); set role authenticated; select public.report_content('review', :'rid2', 'faux'); reset role;
select id as rep2 from reports where target_id = :'rid2' \gset
select tests.comme(:'ADMIN'); set role authenticated;
select tests.ok('décision « retirer »', (public.admin_report_decide(:rep2, 'retirer') ->> 'ok')::boolean);
reset role;
select tests.ok('retiré : l''avis est supprimé', not exists (select 1 from reviews where id = :'rid2'::uuid));
select tests.ok('retiré : ses signalements (et la copie du contenu) aussi', not exists (select 1 from reports where target_id = :'rid2'));

-- 3. Signaler un membre (pseudo) -------------------------------------------------------------------------------------
select tests.comme(:'R1'); set role authenticated; select public.report_content('member', :'ano'::text, 'insulte'); reset role;
select tests.comme(:'R2'); set role authenticated; select public.report_content('member', :'ano'::text, 'insulte'); reset role;
select tests.comme(:'R3'); set role authenticated;
select tests.egal('membre signalé 3 fois : masqué', public.report_content('member', :'ano'::text, 'harcelement') ->> 'hidden', 'true');
reset role;
select tests.ok('membre masqué : pseudo retiré des listes publiques', not exists (select 1 from pseudos where voter = :'av') and public.pseudo_list() ->> :'ano'::text is null);
select tests.ok('membre masqué : noté hidden_at', (select hidden_at is not null from players where voter = :'av'));
select tests.comme(:'R4'); set role authenticated;
select tests.ok('membre masqué : absent du classement', position(('"no" : ' || :ano) in public.leaderboard_v2('all')::text) = 0);
reset role;
select tests.comme(:'A'); set role authenticated;
select tests.erreur('membre masqué : pas de nouveau pseudo en attendant l''admin', 'select public.set_pseudo_v2(''Autre_1'')', 'bloque');
reset role;
set role anon;
select tests.erreur('membre masqué : pas de nouveau pseudo par le site non plus', format('select public.set_pseudo(%L, %s, ''Autre_2'')', :'av', :ano), 'bloque');
reset role;
select id as rep3 from reports where target_kind = 'member' and target_id = :'ano'::text limit 1 \gset
select tests.comme(:'ADMIN'); set role authenticated; select public.admin_report_decide(:rep3, 'garder'); reset role;
select tests.egal('membre gardé : son pseudo revient', (select pseudo from pseudos where voter = :'av'), 'Auteur_1');
select tests.ok('membre gardé : hidden_at effacé', (select hidden_at is null from players where voter = :'av'));

-- 4. Masquer un membre pour soi -----------------------------------------------------------------------------------------
select tests.comme(:'R1'); set role authenticated;
select tests.ok('block_member', (public.block_member(:ano) ->> 'ok')::boolean);
select tests.egal('my_blocks : numéro et pseudo, jamais la clé', public.my_blocks() -> 0 ->> 'pseudo', 'Auteur_1');
select tests.ok('masqué pour moi : absent de MON classement', position(('"no" : ' || :ano) in public.leaderboard_v2('all')::text) = 0);
select tests.egal('block_member : soi-même', public.block_member((public.my_state() ->> 'no')::int) ->> 'why', 'soi');
select tests.egal('block_member : numéro inconnu', public.block_member(99999) ->> 'why', 'introuvable');
reset role;
select tests.comme(:'R2'); set role authenticated;
select tests.ok('… mais toujours dans celui des autres', position(('"no" : ' || :ano) in public.leaderboard_v2('all')::text) > 0);
reset role;
select tests.comme(:'R1'); set role authenticated;
select tests.egal('unblock_member', json_array_length(public.unblock_member(:ano) -> 'blocked'), 0);
select tests.ok('démasqué : de retour dans mon classement', position(('"no" : ' || :ano) in public.leaderboard_v2('all')::text) > 0);
select public.block_member(:ano);
reset role;

-- 5. Photos -----------------------------------------------------------------------------------------------------------
insert into photos (id, club_id, path, approved) values ('99999999-9999-4999-8999-999999999999', 'torcy', 'clubs/torcy/a.jpg', true);
select tests.comme(:'R1'); set role authenticated; select public.report_content('photo', '99999999-9999-4999-8999-999999999999', 'sexuel'); reset role;
select tests.comme(:'R2'); set role authenticated; select public.report_content('photo', '99999999-9999-4999-8999-999999999999', 'sexuel'); reset role;
select tests.comme(:'R3'); set role authenticated; select public.report_content('photo', '99999999-9999-4999-8999-999999999999', 'sexuel'); reset role;
select tests.ok('photo signalée 3 fois : plus publique', not (select approved from photos where id = '99999999-9999-4999-8999-999999999999'));
select id as rep4 from reports where target_kind = 'photo' limit 1 \gset
select tests.comme(:'ADMIN'); set role authenticated; select public.admin_report_decide(:rep4, 'retirer'); reset role;
select tests.ok('photo retirée', not exists (select 1 from photos where id = '99999999-9999-4999-8999-999999999999'));

-- 6. Limite de signalements par jour --------------------------------------------------------------------------------------
update game_config set value = '1' where key = 'reports_per_day';
select tests.comme(:'R4'); set role authenticated;
select public.report_content('member', (select (public.my_state() ->> 'no'))::text, 'spam');      -- soi : refusé, ne compte pas
select public.report_content('review', '22222222-2222-4222-8222-000000051234', 'spam');
select tests.egal('20 signalements par jour au plus (ici 1)', public.report_content('member', :'ano'::text, 'spam') ->> 'why', 'limite');
reset role;
update game_config set value = '20' where key = 'reports_per_day';

-- 7. Bannir --------------------------------------------------------------------------------------------------------------
select tests.comme(:'ADMIN'); set role authenticated;
select tests.ok('admin_ban', (public.admin_ban(:ano, true, 'test') ->> 'banned')::boolean);
reset role;
select tests.comme(:'A'); set role authenticated;
select tests.egal('banni : plus de séance', public.session_start(48.8356, 2.6301, 20) ->> 'why', 'bloque');
select tests.egal('banni : plus d''avis', public.post_review_v2('melun-patton', 5) ->> 'why', 'bloque');
select tests.egal('banni : plus de signalement', public.report_content('member', '51234', 'spam') ->> 'why', 'bloque');
select tests.egal('banni : plus de pseudo', public.set_pseudo_v2('Encore_1') ->> 'why', 'bloque');
select tests.egal('banni : plus de pouce', public.vote_review_v2('22222222-2222-4222-8222-000000051234', 1) ->> 'why', 'bloque');
select tests.egal('banni : my_state le dit', (public.my_state() ->> 'banned')::boolean, true);
reset role;
select tests.ok('banni : son pseudo est retiré', not exists (select 1 from pseudos where voter = :'av'));
set role anon;
select tests.erreur('banni : un avis du site signé de son numéro est refusé',
  format('insert into public.reviews (id, club_id, rating) values (%L, ''torcy'', 1)', '44444444-4444-4444-8444-0000000' || :ano), 'row-level security');
insert into public.reviews (id, club_id, rating) values ('55555555-5555-4555-8555-000000051234', 'torcy', 6);
reset role;
select tests.ok('… les avis des autres passent toujours', exists (select 1 from reviews where id = '55555555-5555-4555-8555-000000051234'));
select tests.comme(:'ADMIN'); set role authenticated;
select tests.egal('gracier', (public.admin_ban(:ano, false) ->> 'banned')::boolean, false);
reset role;
-- « bannir » depuis un signalement
select tests.comme(:'R2'); set role authenticated; select public.report_content('review', :'rid', 'harcelement'); reset role;
select tests.ok('signaler à nouveau après une décision : non (une fois par personne et par contenu)',
  (select count(*) from reports where target_id = :'rid' and reporter = (select voter from players where user_id = :'R2')) = 1);
select tests.comme(:'R4'); set role authenticated; select public.report_content('review', :'rid', 'harcelement'); reset role;
select id as rep5 from reports where target_id = :'rid' and status = 'ouvert' \gset
select tests.comme(:'ADMIN'); set role authenticated; select public.admin_report_decide(:rep5, 'bannir'); reset role;
select tests.ok('décision « bannir » : contenu retiré et auteur banni', app.is_banned(:'av') and not exists (select 1 from reviews where id = :'rid'::uuid));

-- 8. Export, suppression ---------------------------------------------------------------------------------------------------
select tests.comme(:'R1'); set role authenticated;
select public.my_export() as ex \gset
reset role;
select tests.ok('export : mes signalements et mes membres masqués', jsonb_array_length(:'ex'::jsonb -> 'signalements_envoyes') >= 1
                and (:'ex'::jsonb -> 'membres_masques' -> 0 ->> 'no')::int = :ano);
select voter as r1v from players where user_id = :'R1' \gset
select tests.ok('avant : le signaleur a des signalements', exists (select 1 from reports where reporter = :'r1v'));
select tests.comme(:'R1'); set role authenticated; select public.delete_account(); reset role;
select tests.ok('signaleur supprimé : ses signalements partent avec lui', not exists (select 1 from reports where reporter = :'r1v'));
select tests.comme(:'R2'); set role authenticated; select public.block_member(:ano); reset role;
select tests.ok('avant : l''auteur est banni, masqué par R2, signalé', app.is_banned(:'av') and exists (select 1 from blocks where blocked = :'av')
                and exists (select 1 from reports where target_kind = 'member' and target_id = :'ano'::text));
select tests.comme(:'A'); set role authenticated; select public.delete_account(); reset role;
select tests.ok('auteur supprimé : plus aucun signalement ne parle de lui', not exists (select 1 from reports where target_voter = :'av' or (target_kind = 'member' and target_id = :'ano'::text)));
select tests.ok('auteur supprimé : plus de bannissement ni de masquage qui le vise', not exists (select 1 from bans where voter = :'av') and not exists (select 1 from blocks where blocked = :'av'));
