-- =====================================================================================================
-- HMG Fitness · RETOUR EN ARRIÈRE : enlève tout ce qu'ont ajouté 02-comptes, 03-jeu, 04-moderation et 05/06 (salles).
-- À n'utiliser qu'en cas de gros problème (voir supabase/LISEZMOI.md). Transactionnel (tout ou rien), rejouable.
--
-- Ce qui RESTE : 01-correctifs (sécurité), les tables et fonctions du site (players, checkins, pseudos, reviews,
-- photos, club_geo, settings…), et leurs données : les séances validées dans l'appli restent dans checkins (avec
-- leurs points), les avis restent dans reviews. Les anciennes RPC à p_voter (checkin, my_score, leaderboard,
-- set_pseudo…) marchent comme avant.
-- Ce qui est PERDU : l'état du jeu (cœurs, objectifs, pauses, bilans, quêtes, étoiles, coffres, sauvegardes),
-- les comptes anonymes reliés aux joueurs, les invitations, les signalements, les bannissements, la table gyms.
-- L'appli s'en aperçoit toute seule : js/serveur.js repasse à l'ancien fonctionnement (« serveur_ancien »).
-- Vérifié par supabase/tests/lancer.sh : après ce script, le catalogue est identique à celui d'avant 02, les
-- anciennes RPC marchent, et 02 à 05 se réappliquent sans erreur.
-- =====================================================================================================
begin;

-- 1. Déclencheurs posés sur les tables du site
drop trigger if exists players_retire_no on public.players;
drop trigger if exists players_forget_reports on public.players;
drop trigger if exists pseudos_moderation on public.pseudos;
drop trigger if exists reviews_forget_reports on public.reviews;
drop trigger if exists photos_forget_reports on public.photos;
drop trigger if exists club_geo_gym on public.club_geo;

-- 2. Politique ajoutée sur les avis
drop policy if exists "avis: pas de compte banni" on public.reviews;

-- 3. Fonctions publiques (RPC) de 02, 03 et 04
drop function if exists public.account_status();
drop function if exists public.ack_bilan(date);
drop function if exists public.admin_ban(integer, boolean, text, integer);
drop function if exists public.admin_create_invite(text, integer, integer);
drop function if exists public.admin_list_invites();
drop function if exists public.admin_reject_session(bigint);
drop function if exists public.admin_report_decide(bigint, text);
drop function if exists public.admin_reports(text);
drop function if exists public.admin_revoke_invite(text);
drop function if exists public.admin_suspects(integer);
drop function if exists public.block_member(integer);
drop function if exists public.claim_legacy_account(text, integer);
drop function if exists public.create_transfer_code();
drop function if exists public.delete_account();
drop function if exists public.gyms_near(double precision, double precision, integer);
drop function if exists public.gyms_search(text, integer);
drop function if exists public.has_access();
drop function if exists public.leaderboard_v2(text);
drop function if exists public.load_game();
drop function if exists public.my_blocks();
drop function if exists public.my_export();
drop function if exists public.my_score_v2();
drop function if exists public.my_state();
drop function if exists public.open_chest(text, boolean);
drop function if exists public.pause_end();
drop function if exists public.pause_start(text, integer);
drop function if exists public.post_review_v2(text, integer, text);
drop function if exists public.prev_week_v2();
drop function if exists public.pseudo_check_v2(text);
drop function if exists public.redeem_invite(text);
drop function if exists public.redeem_transfer_code(text);
drop function if exists public.report_content(text, text, text, text);
drop function if exists public.review_signer_banned(uuid);
drop function if exists public.save_game(text, jsonb, integer);
drop function if exists public.session_confirm(bigint, double precision, double precision, double precision, jsonb);
drop function if exists public.session_start(double precision, double precision, double precision, jsonb);
drop function if exists public.set_birth_year(integer);
drop function if exists public.set_goal(integer);
drop function if exists public.set_home_club(text);
drop function if exists public.set_pseudo_v2(text);
drop function if exists public.set_soft_mode(boolean);
drop function if exists public.unblock_member(integer);
drop function if exists public.vote_review_v2(uuid, integer);

-- 4. Tables ajoutées (avec leurs données)
drop table if exists public.reports, public.moderation_holds, public.blocks, public.bans,
                     public.game_saves, public.chest_grants, public.star_ledger, public.quests, public.pauses,
                     public.weekly_results, public.session_attempts, public.sessions, public.goal_history, public.profiles,
                     public.gyms, public.review_authors, public.transfer_codes, public.auth_attempts, public.access_grants,
                     public.invites, public.retired_visitor_nos, public.game_config cascade;

-- 5. Colonnes et index ajoutés aux tables du site
alter table public.checkins drop column if exists flags, drop column if exists started_at, drop column if exists session_id;
alter table public.players drop column if exists user_id, drop column if exists claimed_at,
                           drop column if exists game_seed, drop column if exists hidden_at;
drop index if exists public.reviews_visitor_suffix;

-- 6. Schéma interne et réglage de l'accès privé
drop schema if exists app cascade;
delete from public.settings where key = 'access_mode';

-- 7. (Facultatif, à décommenter) les comptes anonymes Supabase Auth, qui ne servent plus à rien :
-- delete from auth.users where is_anonymous;

commit;
notify pgrst, 'reload schema';
