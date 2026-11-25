// Copie de secours du site dans l'appli (www/). (Sera remplacé par build-www.js : appli embarquée.)
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, ".."), www = path.join(__dirname, "www");
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of ["index.html", "manifest.webmanifest", "apple-touch-icon.png", "hmg-logo-complet.png"]) fs.copyFileSync(path.join(root, f), path.join(www, f));
for (const d of ["icons", "css", "js"]) fs.cpSync(path.join(root, d), path.join(www, d), { recursive: true });
console.log("www prêt :", fs.readdirSync(www).join(", "));
