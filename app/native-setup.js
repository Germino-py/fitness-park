// Réglages natifs ajoutés après « cap add » : autorisations (position pour « Je suis à la salle », photos),
// textes affichés par iPhone quand il demande l'autorisation.
const fs = require("fs"), path = require("path");
const os = process.argv[2];
if (os === "android") {
  const f = path.join(__dirname, "android/app/src/main/AndroidManifest.xml");
  let s = fs.readFileSync(f, "utf8");
  const perms = ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"]
    .filter(p => !s.includes(p)).map(p => `    <uses-permission android:name="android.permission.${p}" />`).join("\n");
  s = s.replace("</manifest>", perms + '\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
  fs.writeFileSync(f, s);
  console.log("Android : autorisations position + appareil photo ajoutées");
} else if (os === "ios") {
  const f = path.join(__dirname, "ios/App/App/Info.plist");
  let s = fs.readFileSync(f, "utf8");
  const keys = {
    NSLocationWhenInUseUsageDescription: "HMG vérifie que tu es bien à la salle pour valider ta séance et tes points.",
    NSCameraUsageDescription: "Pour prendre en photo ta salle et la partager avec la communauté HMG.",
    NSPhotoLibraryUsageDescription: "Pour choisir une photo de ta salle à partager.",
    ITSAppUsesNonExemptEncryption: false
  };
  let add = "";
  for (const [k, v] of Object.entries(keys)) if (!s.includes(`<key>${k}</key>`)) add += `\t<key>${k}</key>\n\t${v === false ? "<false/>" : `<string>${v}</string>`}\n`;
  s = s.replace(/<dict>\n/, m => m + add);
  // portrait seulement sur iPhone
  s = s.replace(/(<key>UISupportedInterfaceOrientations<\/key>\s*<array>)[\s\S]*?(<\/array>)/, "$1\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t$2");
  fs.writeFileSync(f, s);
  console.log("iPhone : textes d'autorisation ajoutés");
}
