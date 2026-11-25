#!/usr/bin/env python3
"""HMG Fitness · les salles où une séance peut être validée (table gyms, supabase/03-jeu.sql).

Deux usages, sans dépendance (Python 3.8+), sans réseau :

  python3 outils/salles.py fitness-park
      Lit js/data/clubs.js (les 375 Fitness Park du site : nom, adresse, position approchée PRE, « ouverture
      prochaine ») et écrit supabase/05-salles-fitness-park.sql. Les positions précises déjà enregistrées par
      l'admin (club_geo) ne sont jamais remplacées par une position approchée.

  python3 outils/salles.py osm export.json [fichier.sql]
      Lit un export JSON d'Overpass (requête ci-dessous, à lancer sur https://overpass-turbo.eu puis
      « Exporter » → « données brutes (JSON) ») et écrit supabase/06-salles-osm.sql (par défaut).
      Une Fitness Park d'OSM à moins de 150 m d'une Fitness Park connue n'est pas ajoutée (doublon).

Les deux fichiers SQL se collent dans Supabase → SQL Editor → Run, après 03-jeu.sql, et se rejouent sans risque.
Données OpenStreetMap : © les contributeurs OpenStreetMap, licence ODbL (citer la source dans l'appli, ce
qu'« À propos » fait déjà ; la table gyms, publique, reste sous ODbL).
"""
import json
import re
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

REQUETE_OVERPASS = """[out:json][timeout:600];
area["ISO3166-1"~"^(FR|GP|MQ|GF|RE|YT)$"]["admin_level"="2"]->.fr;
(
  nwr["leisure"="fitness_centre"](area.fr);
  nwr["leisure"="sports_centre"]["sport"~"fitness|crossfit|bodybuilding|weightlifting"](area.fr);
);
out center tags;"""


def lire_js(chemin, nom):
    """La valeur JSON d'une constante « const NOM = … ; » d'un fichier de js/data."""
    texte = chemin.read_text(encoding="utf-8")
    m = re.search(r"const " + nom + r"\s*=\s*", texte)
    if not m:
        raise SystemExit(f"{nom} introuvable dans {chemin}")
    valeur, _ = json.JSONDecoder().raw_decode(texte[m.end():])
    return valeur


def coupe(texte, n):
    texte = re.sub(r"\s+", " ", str(texte or "")).strip()
    return texte[:n] or None


def sql_import(lignes, titre):
    """Un fichier SQL qui passe les salles à app.import_gyms par paquets de 400."""
    morceaux = [
        "-- " + "=" * 101,
        f"-- HMG Fitness · {titre}",
        "-- Fichier GÉNÉRÉ par outils/salles.py : ne pas retoucher à la main. Après 03-jeu.sql ; se rejoue sans risque.",
        "-- " + "=" * 101,
        "begin;",
    ]
    for i in range(0, len(lignes), 400):
        paquet = json.dumps(lignes[i:i + 400], ensure_ascii=False, separators=(",", ":"))
        morceaux.append("select app.import_gyms($salles$" + paquet + "$salles$::jsonb);")
    morceaux += ["commit;", ""]
    return "\n".join(morceaux)


def fitness_park():
    clubs = lire_js(RACINE / "js/data/clubs.js", "CLUBS")
    pre = lire_js(RACINE / "js/data/clubs.js", "PRE")
    lignes = []
    for c in clubs:
        p = pre.get(c["id"])
        if not p or not re.fullmatch(r"[a-z0-9-]{1,80}", c["id"]):
            continue
        lignes.append({
            "id": c["id"], "name": coupe("Fitness Park " + c["n"], 120), "brand": "Fitness Park",
            "address": coupe(c.get("a"), 200), "postcode": coupe(c.get("cp"), 10), "city": coupe(c.get("c"), 80),
            "lat": p[0], "lon": p[1], "source": "fitnesspark", "precise": False, "active": not c.get("s"),
        })
    sortie = RACINE / "supabase/05-salles-fitness-park.sql"
    sortie.write_text(sql_import(lignes, f"05 · Les {len(lignes)} Fitness Park du site (js/data/clubs.js) dans la table gyms"), encoding="utf-8")
    print(f"{len(lignes)} salles → {sortie.relative_to(RACINE)}")


def osm(entree, sortie):
    donnees = json.loads(Path(entree).read_text(encoding="utf-8"))
    lettre = {"node": "n", "way": "w", "relation": "r"}
    lignes, vus, ignores = [], set(), 0
    for e in donnees.get("elements", []):
        t = e.get("tags") or {}
        lat = e.get("lat", (e.get("center") or {}).get("lat"))
        lon = e.get("lon", (e.get("center") or {}).get("lon"))
        nom = coupe(t.get("name") or t.get("brand"), 120)
        if e.get("type") not in lettre or lat is None or lon is None or not nom or t.get("access") in ("private", "no"):
            ignores += 1
            continue
        ident = f"osm-{lettre[e['type']]}{e['id']}"
        if ident in vus:
            continue
        vus.add(ident)
        rue = " ".join(x for x in (t.get("addr:housenumber"), t.get("addr:street")) if x)
        lignes.append({
            "id": ident, "name": nom, "brand": coupe(t.get("brand"), 60), "address": coupe(rue, 200),
            "postcode": coupe(t.get("addr:postcode"), 10), "city": coupe(t.get("addr:city"), 80),
            "lat": round(float(lat), 7), "lon": round(float(lon), 7), "source": "osm",
            "osm_ref": f"{e['type']}/{e['id']}", "precise": True,
            "active": t.get("disused") != "yes" and not t.get("disused:leisure"),
        })
    sortie = Path(sortie) if sortie else RACINE / "supabase/06-salles-osm.sql"
    sortie.write_text(sql_import(lignes, f"06 · {len(lignes)} salles de sport d'OpenStreetMap (© contributeurs OSM, ODbL)"), encoding="utf-8")
    print(f"{len(lignes)} salles → {sortie} ({ignores} éléments ignorés : sans nom, sans position ou privés)")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "fitness-park":
        fitness_park()
    elif len(sys.argv) >= 3 and sys.argv[1] == "osm":
        osm(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
    elif len(sys.argv) >= 2 and sys.argv[1] == "requete":
        print(REQUETE_OVERPASS)
    else:
        print(__doc__)
        print("Requête Overpass (python3 outils/salles.py requete) :\n" + REQUETE_OVERPASS)
        sys.exit(1)
