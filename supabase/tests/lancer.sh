#!/usr/bin/env bash
# =====================================================================================================
# Tests du serveur HMG sur un Postgres 16 LOCAL et JETABLE (jamais sur Supabase).
#   bash supabase/tests/lancer.sh            → tout : base neuve, migrations jouées 2 fois, tests SQL, scénarios croisés,
#                                              client js/serveur.js contre le serveur, fichiers de données (05…),
#                                              retour en arrière (retour-arriere.sql) puis nouvelle application
#   GARDER=1 bash supabase/tests/lancer.sh   → garde la base à la fin (pour fouiller), affiche comment s'y connecter
# Il faut : Postgres 16 (initdb, pg_ctl, psql) et Node 18+. Aucun réseau. La base vit dans un dossier temporaire,
# n'écoute que sur un fichier socket (pas de port réseau), puis est arrêtée et supprimée.
# =====================================================================================================
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/16/bin 2>/dev/null || dirname "$(command -v initdb)")}"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/hmg-pg-XXXXXX")"
PORT=54329
# initdb refuse de tourner en root : on passe par l'utilisateur postgres s'il le faut
if [ "$(id -u)" = "0" ]; then chown postgres "$TMP"; COMME=(runuser -u postgres --); else COMME=(); fi
fin() {
  "${COMME[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  if [ "${GARDER:-0}" != "1" ]; then rm -rf "$TMP"; fi
}
trap fin EXIT
"${COMME[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust --locale=C.UTF-8 -E UTF8 >/dev/null
"${COMME[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -l "$TMP/pg.log" -w \
  -o "-c listen_addresses='' -k $TMP -p $PORT -c timezone=UTC -c fsync=off" start >/dev/null
export PGHOST="$TMP" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

echo "== Base jetable prête ($TMP)"
"${PSQL[@]}" -f "$ICI/00-bouchon.sql" >/dev/null
for f in supabase-competition.sql supabase-pseudos.sql supabase-ange.sql; do "${PSQL[@]}" -f "$RACINE/$f" >/dev/null; done
echo "== Schéma actuel reconstitué (bouchon + scripts supabase-*.sql du dépôt)"
"${PSQL[@]}" -f "$ICI/01-donnees-avant.sql" >/dev/null
MIG=("$RACINE"/supabase/0[1-4]-*.sql)              # la structure (01 à 04) ; les données (05, 06…) à la fin
for tour in 1 2; do
  for f in "${MIG[@]}"; do
    "${PSQL[@]}" -f "$f" >/dev/null
    # relevé du catalogue juste après 01 (avant 02) : le retour en arrière doit y revenir exactement
    if [ "$tour" = 1 ] && [ "$(basename "$f")" = "01-correctifs.sql" ]; then "${PSQL[@]}" -At -f "$ICI/catalogue.sql" > "$TMP/catalogue-01.txt"; fi
  done
  echo "== Migrations appliquées (tour $tour sur 2 : elles se rejouent sans erreur) : $(basename -a "${MIG[@]}" | tr '\n' ' ')"
done

# Tests SQL : chaque fichier enregistre ses vérifications dans tests.resultats
"${PSQL[@]}" -f "$ICI/02-outils-tests.sql" >/dev/null
ARRET=0
for f in "$ICI"/[1-9][0-9]-*.sql; do
  echo "-- $(basename "$f")"
  if ! "${PSQL[@]}" -f "$f" >/dev/null 2>"$TMP/erreur.txt"; then
    ARRET=1; echo "   ÉCHEC  $(basename "$f") s'est arrêté en route :"; sed 's/^/          /' "$TMP/erreur.txt" | head -5
  fi
done
"${PSQL[@]}" -At -c "select case when ok then '   ok  ' else '   ÉCHEC' end || '  ' || fichier || ' · ' || nom || case when ok then '' else '  → ' || coalesce(detail, '') end from tests.resultats order by id"
ECH=$("${PSQL[@]}" -At -c "select count(*) filter (where not ok) from tests.resultats")
TOT=$("${PSQL[@]}" -At -c "select count(*) from tests.resultats")

# Scénarios partagés avec le miroir JavaScript (js/vies-regles.js) : même entrée, même JSON attendu
echo "== Scénarios croisés serveur ↔ miroir JavaScript"
set +e
node "$ICI/scenarios-sql.js"
CROISE=$?
# Le vrai client js/serveur.js (HMGS) contre ce serveur, à travers un petit Supabase de test (Auth + PostgREST)
echo "== Client js/serveur.js ↔ serveur"
node "$ICI/client-sql.js"
CLIENT=$?
set -e

# Les fichiers de données (05-salles-fitness-park.sql, puis 06-salles-osm.sql s'il existe) : 2 fois, sans erreur
DONNEES=0
for f in "$RACINE"/supabase/0[5-9]-*.sql; do
  [ -e "$f" ] || continue
  if "${PSQL[@]}" -f "$f" >/dev/null && "${PSQL[@]}" -f "$f" >/dev/null; then
    echo "== Données $(basename "$f") appliquées 2 fois : $("${PSQL[@]}" -At -c "select count(*) || ' salles (' || count(*) filter (where source = 'fitnesspark') || ' Fitness Park, ' || count(*) filter (where not active) || ' pas encore ouvertes, ' || count(*) filter (where not precise) || ' positions approchées)' from public.gyms")"
  else DONNEES=1; echo "   ÉCHEC  $(basename "$f")"; fi
done

# Retour en arrière (supabase/retour-arriere.sql, 2 fois) : catalogue identique à celui d'avant 02, anciennes RPC
# toujours là avec les données du site, puis 02 à 05 se réappliquent sans erreur
RETOUR=0
echo "== Retour en arrière"
if "${PSQL[@]}" -f "$RACINE/supabase/retour-arriere.sql" >/dev/null && "${PSQL[@]}" -f "$RACINE/supabase/retour-arriere.sql" >/dev/null; then
  "${PSQL[@]}" -At -f "$ICI/catalogue.sql" > "$TMP/catalogue-retour.txt"
  if diff "$TMP/catalogue-01.txt" "$TMP/catalogue-retour.txt" > "$TMP/catalogue-diff.txt"; then
    echo "   ok     catalogue identique à celui d'avant 02 ($(wc -l < "$TMP/catalogue-01.txt") objets)"
  else RETOUR=1; echo "   ÉCHEC  le catalogue diffère :"; sed 's/^/          /' "$TMP/catalogue-diff.txt" | head -20; fi
  NEUF=$(head -c16 /dev/urandom | od -An -tx1 | tr -d ' \n')     # un sportif du site tout neuf
  ANC=$("${PSQL[@]}" -At -c "set role anon; select (public.my_score('0123456789abcdef0123456789abcdef') ->> 'days') is not null
          and json_typeof(public.leaderboard('month', '0123456789abcdef0123456789abcdef')) = 'array'
          and (public.checkin('$NEUF', 0, 'torcy', 48.8504, 2.6510, 20) ->> 'ok')::boolean;
          reset role; select count(*) > 1 from public.checkins;" 2>&1 | tr '\n' ' ' | sed 's/ $//' || true)
  if [ "$ANC" = "t t" ]; then echo "   ok     anciennes RPC (my_score, leaderboard, checkin) et séances gardées"; else RETOUR=1; echo "   ÉCHEC  anciennes RPC : $ANC"; fi
  if ( for f in "$RACINE"/supabase/0[2-9]-*.sql; do "${PSQL[@]}" -f "$f" >/dev/null || exit 1; done ); then
    echo "   ok     02 à $(basename -a "$RACINE"/supabase/0[2-9]-*.sql | tail -1 | cut -c1-2) réappliquées sans erreur après le retour en arrière"
  else RETOUR=1; echo "   ÉCHEC  les migrations ne se réappliquent pas"; fi
else RETOUR=1; echo "   ÉCHEC  retour-arriere.sql s'est arrêté en route"; fi

echo
echo "== Bilan SQL : $((TOT - ECH)) / $TOT vérifications réussies$([ $ARRET = 0 ] || echo ' (un fichier s est arrêté)') ; scénarios croisés : $([ $CROISE = 0 ] && echo 'ok' || echo 'ÉCHEC') ; client : $([ $CLIENT = 0 ] && echo 'ok' || echo 'ÉCHEC') ; retour en arrière : $([ $RETOUR = 0 ] && echo 'ok' || echo 'ÉCHEC')"
if [ "${GARDER:-0}" = "1" ]; then echo "   Base gardée : PGHOST=$TMP PGPORT=$PORT psql -U postgres"; trap - EXIT; fi
[ "$ECH" = "0" ] && [ "$CROISE" = "0" ] && [ "$CLIENT" = "0" ] && [ "$RETOUR" = "0" ] && [ "$ARRET" = "0" ] && [ "$DONNEES" = "0" ]
