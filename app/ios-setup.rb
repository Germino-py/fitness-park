# Réglages du projet Xcode, lancé sur le Mac de GitHub après « npm run ios » (cap add ios + native-setup.js ios).
# Seulement sur la cible App : passer PROVISIONING_PROFILE_SPECIFIER à xcodebuild l'appliquerait aussi aux paquets SPM
# des modules, qui le refusent (« does not support provisioning profiles »). Référence : 2-appli-ios.md §5.5.
#
#   TEAM_ID       Team ID Apple (10 caractères). Vide ou absent : pas de réglages de signature (IPA non signée, simulateur).
#   PROFILE_NAME  nom exact du profil App Store (défaut « HMG Fitness App Store »).
#   APP_VERSION   version publique (défaut : "version" de app/package.json, ex. 1.0.0).
#   BUILD_NUMBER  numéro de build, doit toujours augmenter pour TestFlight (défaut : 100 + GITHUB_RUN_NUMBER, sinon 1).
require 'json'
require 'xcodeproj'

team    = ENV.fetch('TEAM_ID', '').strip
profile = ENV.fetch('PROFILE_NAME', '').strip
profile = 'HMG Fitness App Store' if profile.empty?
version = ENV.fetch('APP_VERSION', '').strip
version = JSON.parse(File.read(File.join(__dir__, 'package.json')))['version'] if version.empty?
build   = ENV.fetch('BUILD_NUMBER', '').strip
build   = (ENV['GITHUB_RUN_NUMBER'] ? (100 + ENV['GITHUB_RUN_NUMBER'].to_i).to_s : '1') if build.empty?
abort("ios-setup.rb : TEAM_ID « #{team} » invalide (10 lettres ou chiffres)") unless team.empty? || team.match?(/\A[A-Z0-9]{10}\z/)

chemin = File.join(__dir__, 'ios/App/App.xcodeproj')
abort("ios-setup.rb : #{chemin} introuvable (lancer d'abord « npm run ios »)") unless File.directory?(chemin)
proj = Xcodeproj::Project.open(chemin)
app  = proj.targets.find { |t| t.name == 'App' } or abort('ios-setup.rb : cible App introuvable')
grp  = proj.main_group['App'] or abort('ios-setup.rb : groupe App introuvable')

# fichiers écrits par native-setup.js : ils doivent exister
%w[PrivacyInfo.xcprivacy App.entitlements].each do |f|
  abort("ios-setup.rb : ios/App/App/#{f} manque (lancer « node native-setup.js ios »)") unless File.exist?(File.join(__dir__, 'ios/App/App', f))
end
# PrivacyInfo.xcprivacy dans « Copy Bundle Resources » (sinon Apple refuse l'envoi : ITMS-91053)
unless grp.files.any? { |f| f.path == 'PrivacyInfo.xcprivacy' }
  ref = grp.new_reference('PrivacyInfo.xcprivacy'); ref.last_known_file_type = 'text.xml'
  app.resources_build_phase.add_file_reference(ref, true)
end
# App.entitlements visible dans le projet (il n'est pas une ressource : il sert à la signature)
grp.new_reference('App.entitlements') unless grp.files.any? { |f| f.path == 'App.entitlements' }

app.build_configurations.each do |c|
  s = c.build_settings
  s['TARGETED_DEVICE_FAMILY']  = '1'                       # iPhone seulement (pas de captures iPad à fournir)
  s['MARKETING_VERSION']       = version
  s['CURRENT_PROJECT_VERSION'] = build
  s['CODE_SIGN_ENTITLEMENTS']  = 'App/App.entitlements'
  s['SUPPORTS_MACCATALYST']    = 'NO'
  s['SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD'] = 'NO'        # pas sur Mac (à décocher aussi dans App Store Connect)
  s['SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD']  = 'NO'        # pas sur Vision Pro
  next unless c.name == 'Release' && !team.empty?
  s['CODE_SIGN_STYLE']                   = 'Manual'
  s['DEVELOPMENT_TEAM']                  = team
  s['CODE_SIGN_IDENTITY']                = 'Apple Distribution'
  s['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
  s['PROVISIONING_PROFILE_SPECIFIER']    = profile
end
proj.save
signature = team.empty? ? 'sans signature' : "signature manuelle, équipe #{team}, profil « #{profile} »"
puts "Xcode : iPhone seul, v#{version} (#{build}), #{signature}, PrivacyInfo + entitlements"
