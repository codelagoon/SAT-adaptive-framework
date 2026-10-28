#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/build"
APP="${OUT}/Mastery Engine 2.app"
INSTALL_DIR="${MASTERY_HOME:-${HOME}/MasteryEngine2}"
if [[ "$(uname -s)" != Darwin || "$(uname -m)" != arm64 ]]; then
  echo 'This native build must run on an Apple Silicon Mac.' >&2; exit 1
fi
command -v xcrun >/dev/null || { echo 'Install Apple Command Line Tools: xcode-select --install' >&2; exit 1; }
[[ -f "${INSTALL_DIR}/OpenTutor/scripts/quickstart.sh" ]] || { echo "Missing OpenTutor checkout at ${INSTALL_DIR}/OpenTutor" >&2; exit 1; }
mkdir -p "${APP}/Contents/MacOS" "${APP}/Contents/Resources" "${OUT}/dist"
cat > "${APP}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>MasteryEngine2</string>
<key>CFBundleIdentifier</key><string>app.masteryengine.mac</string>
<key>CFBundleName</key><string>Mastery Engine 2</string>
<key>CFBundleDisplayName</key><string>Mastery Engine 2</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.6.1</string>
<key>CFBundleVersion</key><string>6</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
printf '%s\n' "${INSTALL_DIR}/OpenTutor" > "${APP}/Contents/Resources/opentutor-path.txt"
command -v node > "${APP}/Contents/Resources/node-path.txt"
cp "${ROOT}/scripts/mastery_launch.sh" "${APP}/Contents/Resources/mastery_launch.sh"
xcrun swiftc -parse-as-library -O -target arm64-apple-macos13 -framework Cocoa -framework WebKit \
  "${ROOT}/macos/MasteryApp.swift" -o "${APP}/Contents/MacOS/MasteryEngine2"
chmod +x "${APP}/Contents/MacOS/MasteryEngine2"
if command -v hdiutil >/dev/null; then
  hdiutil create -volname 'Mastery Engine 2' -srcfolder "${APP}" \
    -ov -format UDZO "${OUT}/dist/MasteryEngine2-AppleSilicon.dmg" >/dev/null
fi
echo "Built: ${APP}"
echo "DMG: ${OUT}/dist/MasteryEngine2-AppleSilicon.dmg (unsigned, references installed dependencies; not standalone/notarized)"
