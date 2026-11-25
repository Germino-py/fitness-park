#!/usr/bin/env bash
# =====================================================================================================
# Tests du serveur HMG sur un Postgres 16 LOCAL et JETABLE (jamais sur Supabase).
#   bash supabase/tests/lancer.sh            → tout : base neuve, migrations jouées 2 fois, tests SQL, scénarios croisés
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
  for f in "${MIG[@]}"; do "${PSQL[@]}" -f "$f" >/dev/null; done
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
set -e

# Les fichiers de données (05-salles-fitness-park.sql, puis 06-salles-osm.sql s'il existe) : 2 fois, sans erreur
DONNEES=0
for f in "$RACINE"/supabase/0[5-9]-*.sql; do
  [ -e "$f" ] || continue
  if "${PSQL[@]}" -f "$f" >/dev/null && "${PSQL[@]}" -f "$f" >/dev/null; then
    echo "== Données $(basename "$f") appliquées 2 fois : $("${PSQL[@]}" -At -c "select count(*) || ' salles (' || count(*) filter (where source = 'fitnesspark') || ' Fitness Park, ' || count(*) filter (where not active) || ' pas encore ouvertes, ' || count(*) filter (where not precise) || ' positions approchées)' from public.gyms")"
  else DONNEES=1; echo "   ÉCHEC  $(basename "$f")"; fi
done

echo
echo "== Bilan SQL : $((TOT - ECH)) / $TOT vérifications réussies$([ $ARRET = 0 ] || echo ' (un fichier s est arrêté)') ; scénarios croisés : $([ $CROISE = 0 ] && echo 'ok' || echo 'ÉCHEC')"
if [ "${GARDER:-0}" = "1" ]; then echo "   Base gardée : PGHOST=$TMP PGPORT=$PORT psql -U postgres"; trap - EXIT; fi
[ "$ECH" = "0" ] && [ "$CROISE" = "0" ] && [ "$ARRET" = "0" ] && [ "$DONNEES" = "0" ]
