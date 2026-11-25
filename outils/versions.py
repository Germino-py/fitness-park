#!/usr/bin/env python3
"""Met à jour les ?v=… des fichiers css/ et js/ appelés par les pages HTML (empreinte du contenu).
À lancer avant chaque publication : python3 outils/versions.py
Ainsi un navigateur (ou le service worker) ne garde jamais une ancienne version d'un fichier modifié."""
import hashlib, pathlib, re, sys
racine = pathlib.Path(__file__).resolve().parent.parent
motif = re.compile(r'((?:href|src)=")((?:\.\./)*(?:css|js)/[^"?]+)\?v=[0-9a-z]*(")')
changes = 0
for page in [racine / "index.html", *racine.glob("*/index.html")]:
    if "app/" in str(page.relative_to(racine)) or "node_modules" in str(page): continue
    txt = page.read_text(encoding="utf-8")
    def tampon(m):
        f = (page.parent / m.group(2)).resolve()
        if not f.exists(): sys.exit(f"Fichier manquant : {m.group(2)} (dans {page.name})")
        return f'{m.group(1)}{m.group(2)}?v={hashlib.sha1(f.read_bytes()).hexdigest()[:8]}{m.group(3)}'
    neuf = motif.sub(tampon, txt)
    if neuf != txt:
        page.write_text(neuf, encoding="utf-8"); changes += 1
print(f"versions à jour ({changes} page(s) modifiée(s))")
