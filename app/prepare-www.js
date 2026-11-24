// Copie de secours du site dans l'appli (www/). L'appli ouvre hmgfitness.fr en direct
// (capacitor.config.json > server.url) : chaque mise à jour du site arrive dans l'appli sans la republier.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), www = path.join(__dirname, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, "icons"), { recursive: true });
for (const f of ["index.html", "manifest.webmanifest", "apple-touch-icon.png", "hmg-logo-complet.png"]) fs.copyFileSync(path.join(root, f), path.join(www, f));
for (const f of fs.readdirSync(path.join(root, "icons"))) fs.copyFileSync(path.join(root, "icons", f), path.join(www, "icons", f));
console.log("www prêt :", fs.readdirSync(www).join(", "));
