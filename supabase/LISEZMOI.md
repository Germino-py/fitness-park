# Serveur HMG Fitness (Supabase) : mode d'emploi

Ce dossier contient tout le serveur de l'appli : comptes, jeu (cœurs, séances, bilans), modération, salles.
Rien n'est appliqué tout seul : c'est toi qui colles les fichiers dans Supabase, dans l'ordre ci-dessous.
Projet : `zjuabjlhktmptbgdgzke`.

| Fichier | Ce qu'il fait |
|---|---|
| `01-correctifs.sql` | Correctifs de sécurité (avis datés par le serveur, fonctions internes fermées). Ne change rien pour les visiteurs. |
| `02-comptes.sql` | Comptes anonymes (Supabase Auth), reprise des comptes du site, invitations, changement de téléphone, suppression, export. |
| `03-jeu.sql` | Le jeu : toutes les salles (table `gyms`), séance en 2 temps, bilan du lundi, cœurs, maladie, pauses, quêtes, étoiles, coffres, `my_state()`. |
| `04-moderation.sql` | Signaler un avis, une photo ou un membre ; masquage automatique à 3 signalements ; masquer un membre pour soi ; bannir. |
| `05-salles-fitness-park.sql` | Les 375 Fitness Park du site dans la table `gyms` (fichier généré par `outils/salles.py`). |
| `06-salles-osm.sql` | (plus tard) Toutes les salles de France depuis OpenStreetMap : voir « Ajouter toutes les salles ». |
| `retour-arriere.sql` | En cas de gros problème : enlève 02 à 06 (voir la fin de ce document). |
| `tests/` | Les tests automatiques (Postgres local jetable). |

Tout est **additif** : aucune table du site n'est vidée ni réécrite, et les anciennes fonctions du site (`checkin`,
`my_score`, `leaderboard`, `set_pseudo`…) continuent de marcher. Chaque fichier est une transaction (tout ou rien)
et se rejoue sans risque.

---

## 1. Avant de commencer (5 minutes)

1. **Sauvegarde** : [Database › Backups](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/database/backups/scheduled).
   Vérifie qu'une sauvegarde récente existe. (Sur l'offre gratuite, il n'y en a pas : le retour en arrière se fait alors
   avec `retour-arriere.sql`, testé, qui garde toutes les données du site.)
2. **Seau `transfert`** (faille de sécurité, voir `01-correctifs.sql` §0.3) : récupère le fichier qui s'y trouve s'il te
   sert, puis [Storage › Buckets](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/storage/buckets) › `transfert` › Delete bucket.
3. **Mots de passe piratés** (ton compte admin) :
   [Authentication › Attack Protection](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/auth/protection)
   › « Leaked password protection » : ON. **Ne mets pas de CAPTCHA** pour l'instant : l'appli ne sait pas encore en
   afficher, et plus personne ne pourrait créer de compte.

## 2. Coller le SQL (10 minutes)

Ouvre le [SQL Editor](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/sql/new). Pour **chaque** fichier, dans
cet ordre : ouvre-le, copie **tout**, colle, **Run**. Attends « Success » avant de passer au suivant.

1. `01-correctifs.sql`
2. `02-comptes.sql`
3. `03-jeu.sql`
4. `04-moderation.sql`
5. `05-salles-fitness-park.sql`

Si un fichier s'arrête sur une erreur, rien de ce fichier n'est appliqué : envoie-moi le message, ne force rien.

**Vérification** (colle dans un nouvel onglet du SQL Editor, puis Run) :

```sql
select (select count(*) from public.gyms)               as salles,         -- 375 ou plus
       (select value from public.settings where key = 'access_mode') as acces,   -- "invite"
       (select count(*) from pg_proc where proname = 'my_state') as my_state; -- 1
```

Puis ouvre le [conseiller de sécurité](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/advisors/security) :
il ne doit signaler aucune table « RLS disabled ».

## 3. Le tableau de bord (5 minutes)

1. **Connexions anonymes** : [Authentication › Sign In / Providers](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/auth/providers)
   - « **Allow anonymous sign-ins** » : ON. C'est ce qui allume le nouveau serveur dans l'appli et sur le site.
     Tant que c'est OFF, tout marche comme avant (la console du navigateur le dit clairement).
   - « **Allow manual linking** » : ON (servira à « Se connecter avec Apple », plus tard).
2. **Limite de création de comptes** : [Authentication › Rate Limits](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/auth/rate-limits)
   › « Rate limit for anonymous users » : 30 par heure et par adresse IP (la valeur par défaut) suffit. Monte à 60 si
   beaucoup de testeurs s'inscrivent au même endroit (même Wi-Fi).
3. **Schémas exposés** : [Settings › Data API](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/settings/api) :
   laisse `public` (et `graphql_public`). **N'ajoute jamais `app`** : c'est le schéma interne, fermé exprès.
4. **Contrat de traitement (RGPD)** : dans les réglages de l'organisation Supabase › Legal documents, signe le DPA.
   Vérifie aussi la région du projet (Settings › General) : la politique de confidentialité dit « Union européenne ».

## 4. Les invitations du test privé

Le site garde seulement l'empreinte des codes, le serveur ne peut pas les deviner. Pour chaque code d'invitation que
tes testeurs utilisent déjà, colle dans le SQL Editor (remplace `ton-code` ; 50 personnes au plus, valable 90 jours) :

```sql
select app.add_invite('ton-code', 'Testeurs', 50, 90);
```

Les majuscules, espaces et tirets ne comptent pas. Les comptes du site créés **avant** l'application de `02` sont
repris dans l'appli sans invitation (ils avaient déjà passé la porte). Un code se retire avec :
`update public.invites set revoked_at = now() where label = 'Testeurs';`

## 5. Ménage automatique (facultatif, conseillé)

1. [Database › Extensions](https://supabase.com/dashboard/project/zjuabjlhktmptbgdgzke/database/extensions) : active `pg_cron`.
2. Dans le SQL Editor :

```sql
-- chaque nuit : comptes anonymes jamais utilisés, essais de séance de plus de 30 jours, codes périmés
select cron.schedule('hmg-menage', '17 3 * * *', $$select app.purge()$$);
-- chaque heure : les bilans du lundi de tout le monde (ils se font aussi tout seuls à l'ouverture de l'appli)
select cron.schedule('hmg-bilans', '10 * * * *', $$select app.settle_all()$$);
```

## 6. Les signalements (à traiter sous 24 heures)

L'écran admin de l'appli s'en servira (`admin_reports`, `admin_report_decide`). En attendant, dans le SQL Editor :

```sql
-- les signalements ouverts
select id, target_kind as quoi, target_id as cible, reason as motif, note, snapshot as contenu, created_at
  from public.reports where status = 'ouvert' order by created_at;

-- décider (12 = l'id du signalement ; 'retirer', 'garder' ou 'bannir'), en tant qu'admin :
begin;
select set_config('request.jwt.claims', (select json_build_object('sub', user_id)::text from public.admins limit 1), true);
select public.admin_report_decide(12, 'retirer');
commit;
```

Un contenu signalé par 3 membres différents est déjà masqué en attendant ta décision.

## 7. Le jour de la sortie publique

```sql
-- l'appli s'ouvre à tous (ne supprime JAMAIS cette ligne : l'appli s'en sert pour savoir que le serveur est là)
update public.settings set value = '"public"' where key = 'access_mode';
-- l'Écharpe Pionnier n'est plus donnée aux nouveaux après cette date
update public.game_config set value = to_jsonb(now()) where key = 'pionnier_until';
```

## 8. Ajouter toutes les salles de France (OpenStreetMap)

1. `python3 outils/salles.py requete` affiche la requête. Colle-la sur [overpass-turbo.eu](https://overpass-turbo.eu),
   Exécuter, puis Exporter › « données brutes (JSON) ».
2. `python3 outils/salles.py osm export.json` écrit `supabase/06-salles-osm.sql` (les Fitness Park déjà connues ne sont
   pas ajoutées en double).
3. Colle `06-salles-osm.sql` dans le SQL Editor, Run. Il se rejoue sans risque (mise à jour des salles).

Les données OpenStreetMap sont sous licence **ODbL** : la mention « © contributeurs OpenStreetMap » doit rester visible
(À propos, Aide et Règles la donnent déjà).

## 9. Revenir en arrière

- **Couper vite, sans rien effacer** : remets « Allow anonymous sign-ins » sur OFF. Les nouveaux visiteurs restent sur
  l'ancien fonctionnement ; ceux qui ont déjà un compte anonyme continuent sur le nouveau serveur.
- **Tout enlever** : colle `retour-arriere.sql` dans le SQL Editor, Run. Il enlève tout ce qu'ont ajouté 02 à 06 et
  garde le site intact : joueurs, séances (avec leurs points, y compris celles de l'appli), pseudos, avis. L'état du
  jeu (cœurs, bilans, étoiles…), les invitations et les signalements sont perdus. L'appli repasse toute seule à
  l'ancien fonctionnement. On peut ensuite réappliquer 02 à 05 sans erreur (c'est testé).
- `01-correctifs.sql` n'a pas besoin d'être enlevé (correctifs de sécurité).

---

## Pour les développeurs

**Tests** : `bash supabase/tests/lancer.sh` (Postgres 16 et Node 18+, aucun réseau). Base jetable sur un fichier
socket, migrations jouées 2 fois, 317 vérifications SQL (sécurité et droits, anciennes RPC, comptes, jeu, modération),
38 scénarios joués à l'identique sur Postgres et sur le miroir `js/vies-regles.js`, le vrai `js/serveur.js` contre le
serveur (55 vérifications), les données 05, puis le retour en arrière (catalogue identique à celui d'avant 02).
Tests Node : `node --test outils/tests/vies.test.js outils/tests/serveur.test.js`.

**Règles du serveur** : toute RPC nouvelle est `security definer`, `search_path` fixé, `grant execute` à
`authenticated` seulement (sauf `has_access` et `review_signer_banned`, aussi à `anon`) ; le joueur vient toujours du
jeton (`auth.uid()`), jamais d'un paramètre ; RLS active sur toutes les tables, aucune lecture directe sauf `gyms`
(publique). Erreurs : `hint = 'auth'` (relancer la session), `hint = 'invite'` (écran d'invitation).

**RPC** (toutes `POST /rest/v1/rpc/<nom>`, jeton obligatoire ; le client `js/serveur.js` les enveloppe toutes) :

| RPC | Arguments | Réponse |
|---|---|---|
| `has_access` | — | booléen (aussi pour `anon`) |
| `account_status` | — | `{access, player, no, anonymous, admin, mode}` |
| `redeem_invite` | `p_code` | `{ok}` ou `why: code, limite, deja` |
| `claim_legacy_account` | `p_key` (clé de 32 caractères, code de 28 ou lien `#compte=`), `p_old_stars` | `{ok, no, hero, state}` ou `why: invalide, inconnu, pris, limite` |
| `create_transfer_code` | — | `{ok, code, expires_at}` ou `why: vide, apple, limite` |
| `redeem_transfer_code` | `p_code` | `{ok, no, state}` ou `why: code, limite` |
| `delete_account` | — | `{ok}` |
| `my_export` | — | toutes les données du compte |
| `my_state` | — | l'état complet (contrat §14.10, documenté en tête de `js/serveur.js`) |
| `set_goal` | `p_goal` (2 à 5) | `{ok, state}` ou `why: trop_tot (next_date), hors_limites` |
| `session_start` | `p_lat, p_lon, p_acc, p_meta {club, simulated, accessory}` | `{ok, dist, club, club_name, session, state}` ou `why: loin, precision, deja, en_cours, position, salle, quota, vite, objectif, bloque` |
| `session_confirm` | `p_session, p_lat, p_lon, p_acc, p_meta` | `{ok, points, steps, chest_due, heal, hearts, state}` ou `why: trop_tot (wait_s), loin (until), precision, expiree, deja, introuvable, position, salle, vite` |
| `pause_start` | `p_kind` (`pause` ou `hibernation`), `p_weeks` | `{ok, from, state}` ou `why: duree, quota, deja, objectif, type` |
| `pause_end` | — | `{ok, state}` ou `why: aucune` |
| `set_soft_mode` | `p_on` | `{ok, state}` ou `why: mineur, objectif` |
| `set_birth_year` | `p_year` | `{ok, state}` ou `why: age, invalide, objectif` |
| `set_home_club` | `p_club` | `{ok, state}` ou `why: salle, objectif` |
| `ack_bilan` | `p_week` (lundi) | `{ok, state}` |
| `open_chest` | `p_key`, `p_empty` | `{ok, key, kind, item, already, stars, state}` ou `why: introuvable` |
| `load_game` / `save_game` | — / `p_slot` (`game`, `prefs`), `p_data`, `p_version` | sauvegarde ; `why: conflit, vite, trop_gros, invalide, emplacement` |
| `gyms_near` / `gyms_search` | `p_lat, p_lon, p_limit` / `p_q, p_limit` | liste de salles |
| `my_score_v2`, `leaderboard_v2(p_period)`, `prev_week_v2`, `pseudo_check_v2(p_pseudo)`, `set_pseudo_v2(p_pseudo)`, `vote_review_v2(p_review, p_value)`, `post_review_v2(p_club, p_rating, p_comment)` | comme les anciennes, sans `p_voter` | comme les anciennes |
| `report_content` | `p_kind` (`review`, `photo`, `member`), `p_target`, `p_reason`, `p_note` | `{ok, hidden}` ou `why: deja, limite, soi, introuvable, raison, type, bloque` |
| `block_member` / `unblock_member` / `my_blocks` | `p_no` / `p_no` / — | `{ok}` / `{ok}` / `[{no, pseudo, at}]` |
| `admin_reports`, `admin_report_decide`, `admin_ban`, `admin_suspects`, `admin_reject_session`, `admin_create_invite`, `admin_list_invites`, `admin_revoke_invite` | voir `04-moderation.sql` et `02-comptes.sql` | admin seulement (vérifié par le serveur) |
