// Réglages natifs, appliqués après « cap add » (npm run ios / npm run android) : on peut le relancer sans risque.
//   node native-setup.js ios      → Info.plist (textes d'autorisation en français, schéma hmgfitness, Plans / Google Maps / Waze,
//                                    portrait), App.entitlements (liens universels) et PrivacyInfo.xcprivacy (manifeste de confidentialité)
//   node native-setup.js android  → AndroidManifest.xml (position, appareil photo, liens https://hmgfitness.fr/…, schéma hmgfitness, portrait)
// Référence : appli/conception/2-appli-ios.md §1.6, §2.2, §2.3, §2.4. ios-setup.rb ajoute ensuite PrivacyInfo et les droits au projet Xcode.
const fs = require("fs"), path = require("path"), plist = require("plist");
const os = process.argv[2];
const DOMAINE = "hmgfitness.fr", SCHEMA = "hmgfitness", ID = "fr.hmgfitness.app";
const CHEMINS = ["/compte", "/invite", "/salle"];   // les liens universels (2-appli-ios §1.6)

/* Les textes que l'iPhone montre quand l'appli demande une autorisation (tutoiement, comme l'appli).
   La position sert aussi à trouver les salles autour de toi (bouton de la carte, accueil des nouveaux) : le texte le dit,
   sinon il ne décrirait pas tout l'usage (règle 5.1.1 d'Apple). */
const TEXTE_POSITION = "HMG utilise ta position seulement quand tu le demandes : pour trouver les salles autour de toi et, quand tu touches « Je suis à la salle », pour vérifier que tu es bien dans ta salle et valider ta séance. Ta position n'est jamais montrée aux autres ni suivie en arrière-plan.";
const PLIST = {
  CFBundleDevelopmentRegion: "fr",
  CFBundleLocalizations: ["fr"],
  CFBundleDisplayName: "HMG Fitness",
  NSLocationWhenInUseUsageDescription: TEXTE_POSITION,
  // exigée par le module de position, mais HMG ne demande jamais l'accès « Toujours »
  NSLocationAlwaysAndWhenInUseUsageDescription: TEXTE_POSITION,
  NSCameraUsageDescription: "Pour prendre en photo ta salle et l'ajouter à sa fiche. Chaque photo est vérifiée avant d'être publiée.",
  NSPhotoLibraryUsageDescription: "Pour choisir une photo de ta salle à ajouter à sa fiche.",
  // sans elle, l'appli plante quand on touche « Enregistrer l'image » dans le menu Partager
  NSPhotoLibraryAddUsageDescription: "Pour enregistrer l'image de ton héros dans tes photos, si tu le choisis dans le menu Partager.",
  ITSAppUsesNonExemptEncryption: false,   // HTTPS seulement : pas de question sur l'export à chaque envoi
  LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],   // proposer Google Maps et Waze pour l'itinéraire s'ils sont installés
  UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
};
// à ne jamais mettre (règle 2.5.4, aucun pistage, rien d'inutile) : retirées si un module les avait ajoutées
const INTERDITES = ["UIBackgroundModes", "NSMotionUsageDescription", "NSUserTrackingUsageDescription", "NSContactsUsageDescription",
  "NSMicrophoneUsageDescription", "NSLocationAlwaysUsageDescription"];

const DROITS = {
  "com.apple.developer.associated-domains": ["applinks:" + DOMAINE],
  // V1.1 notifications à distance : "aps-environment": "production"
  // V1.1 Se connecter avec Apple : "com.apple.developer.applesignin": ["Default"]
  // V2 widget (App Group) : "com.apple.security.application-groups": ["group.fr.hmgfitness.app"]
  // Chaque droit ajouté doit AUSSI être coché sur l'App ID (developer.apple.com), puis le profil recréé.
};

/* Manifeste de confidentialité : obligatoire (erreur ITMS-91053 sinon). Les modules sont intégrés à l'appli par SPM,
   l'appli déclare donc les API « à motif requis » qu'ils utilisent. Les données collectées = la fiche « App Privacy » (§3.4). */
const collecte = type => ({
  NSPrivacyCollectedDataType: "NSPrivacyCollectedDataType" + type,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
});
const CONFIDENTIALITE = {
  NSPrivacyTracking: false,
  NSPrivacyTrackingDomains: [],
  NSPrivacyAccessedAPITypes: [
    { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },   // Preferences
    { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },  // Filesystem (stat)
  ],
  NSPrivacyCollectedDataTypes: ["PreciseLocation", "UserID", "Fitness", "PhotosorVideos", "OtherUserContent", "GameplayContent"].map(collecte),
};

function ecrire(f, contenu, quoi) {
  const avant = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  if (avant !== contenu) fs.writeFileSync(f, contenu);
  console.log(`  ${avant === contenu ? "=" : "✓"} ${quoi}`);
}

function ios() {
  const dir = path.join(__dirname, "ios/App/App");
  if (!fs.existsSync(path.join(dir, "Info.plist"))) throw new Error("ios/App/App/Info.plist introuvable : lancer d'abord « npx cap add ios »");
  console.log("iPhone :");
  const f = path.join(dir, "Info.plist");
  const p = plist.parse(fs.readFileSync(f, "utf8"));
  Object.assign(p, PLIST);
  for (const k of INTERDITES) delete p[k];
  // schéma hmgfitness:// (widget, secours), sans toucher aux autres schémas éventuels
  const types = (p.CFBundleURLTypes || []).filter(t => !(t.CFBundleURLSchemes || []).includes(SCHEMA));
  types.push({ CFBundleURLName: ID, CFBundleTypeRole: "Viewer", CFBundleURLSchemes: [SCHEMA] });
  p.CFBundleURLTypes = types;
  ecrire(f, plist.build(p, { indent: "\t" }) + "\n", "Info.plist : français, textes d'autorisation, schéma " + SCHEMA + "://, Plans / Google Maps / Waze, portrait");
  ecrire(path.join(dir, "App.entitlements"), plist.build(DROITS, { indent: "\t" }) + "\n", "App.entitlements : applinks:" + DOMAINE);
  ecrire(path.join(dir, "PrivacyInfo.xcprivacy"), plist.build(CONFIDENTIALITE, { indent: "\t" }) + "\n", "PrivacyInfo.xcprivacy : UserDefaults CA92.1, FileTimestamp C617.1, 6 types de données, aucun pistage");
}

function android() {
  const f = path.join(__dirname, "android/app/src/main/AndroidManifest.xml");
  if (!fs.existsSync(f)) throw new Error("AndroidManifest.xml introuvable : lancer d'abord « npx cap add android »");
  console.log("Android :");
  let s = fs.readFileSync(f, "utf8");
  const avant = s;
  if (!/xmlns:tools=/.test(s)) s = s.replace(/<manifest\b/, '<manifest xmlns:tools="http://schemas.android.com/tools"');
  // l'activité : portrait seulement
  s = s.replace(/<activity\b[^>]*android:name="\.MainActivity"[^>]*>/, m => (m.includes("screenOrientation") ? m
    : m.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"')));
  // liens https://hmgfitness.fr/compte|invite|salle (App Links vérifiés) et schéma hmgfitness://
  if (!s.includes(`android:host="${DOMAINE}"`)) {
    const filtres = `
            <!-- liens universels : https://${DOMAINE}/compte/…, /invite/…, /salle/… (vérifiés par /.well-known/assetlinks.json) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${DOMAINE}" />
${CHEMINS.map(c => `                <data android:pathPrefix="${c}" />`).join("\n")}
            </intent-filter>
            <!-- schéma personnalisé ${SCHEMA}:// (secours, widget) -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${SCHEMA}" />
            </intent-filter>
`;
    s = s.replace(/(<category android:name="android\.intent\.category\.LAUNCHER" \/>\s*<\/intent-filter>\n)/, `$1${filtres}`);
    if (!s.includes(`android:host="${DOMAINE}"`)) throw new Error("AndroidManifest.xml : filtre LAUNCHER introuvable, liens non ajoutés");
  }
  // autorisations : position (« Je suis à la salle », salles autour de toi), appareil photo (photos des salles)
  const lignes = [];
  for (const p of ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"])
    if (!s.includes(`android.permission.${p}"`)) lignes.push(`    <uses-permission android:name="android.permission.${p}" />`);
  // alarmes exactes : réservées par Google Play aux réveils et agendas ; les rappels HMG n'ont pas besoin d'être à la minute
  if (!s.includes("SCHEDULE_EXACT_ALARM")) lignes.push('    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" tools:node="remove" />');
  for (const [nom] of [["android.hardware.location.gps"], ["android.hardware.camera"]])
    if (!s.includes(`"${nom}"`)) lignes.push(`    <uses-feature android:name="${nom}" android:required="false" />`);
  if (lignes.length) s = s.replace(/<\/manifest>\s*$/, lignes.join("\n") + "\n</manifest>\n");
  if (s !== avant) fs.writeFileSync(f, s);
  console.log(`  ${s === avant ? "=" : "✓"} AndroidManifest.xml : position, appareil photo, liens https://${DOMAINE}${CHEMINS.join("|")}, schéma ${SCHEMA}://, portrait, pas d'alarmes exactes`);
}

try {
  if (os === "ios") ios();
  else if (os === "android") android();
  else { console.error("usage : node native-setup.js ios|android"); process.exit(2); }
} catch (e) { console.error("✗ native-setup.js : " + e.message); process.exit(1); }
