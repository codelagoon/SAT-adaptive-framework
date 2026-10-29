#!/bin/bash
# Use a clean arm64 macOS runner to build a self-contained offline-first DMG.
# Requirements ON THE BUILDER ONLY: git, node/npm 22, uv, Swift/Xcode, network.
set -euo pipefail
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || {
  echo 'An Apple Silicon macOS builder is required.' >&2; exit 1;
}
for tool in git node npm uv xcrun hdiutil rsync codesign; do
  command -v "$tool" >/dev/null || { echo "Build prerequisite missing: ${tool}" >&2; exit 1; }
done
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/mastery-macos-portable-build"
INSTALL_DIR="${BUILD_DIR}/OpenTutor"
APP="${SOURCE_DIR}/build/Mastery Engine 2.app"
RES="${APP}/Contents/Resources"
DIST="${SOURCE_DIR}/dist"
UPSTREAM_SHA="dbaab74ffe76d167427ddc4448e4e81dfc38b2a9"
rm -rf "${BUILD_DIR}" "${APP}"
mkdir -p "${BUILD_DIR}" "${RES}" "${APP}/Contents/MacOS" "${DIST}"

git clone --filter=blob:none --no-checkout https://github.com/zijinz456/OpenTutor.git "${INSTALL_DIR}"
git -C "${INSTALL_DIR}" fetch --depth 1 origin "${UPSTREAM_SHA}"
git -C "${INSTALL_DIR}" checkout --detach "${UPSTREAM_SHA}"
[[ "$(git -C "${INSTALL_DIR}" rev-parse HEAD)" == "${UPSTREAM_SHA}" ]] || { echo 'Upstream SHA mismatch' >&2; exit 1; }
python3 "${SOURCE_DIR}/scripts/apply_overlay.py" "${INSTALL_DIR}"

# Bundle an independent, relocatable managed Python distribution, not a venv
# pointing at the GitHub runner or to somebody's local Homebrew installation.
export UV_PYTHON_INSTALL_DIR="${BUILD_DIR}/managed-python"
uv python install 3.11
MANAGED_BIN="$(uv python find --managed-python 3.11)"
[[ -x "${MANAGED_BIN}" ]] || { echo 'Cannot find managed Python 3.11' >&2; exit 1; }
MANAGED_DIR="$(cd "$(dirname "${MANAGED_BIN}")/.." && pwd)"
rsync -a "${MANAGED_DIR}/" "${RES}/python/"
[[ -x "${RES}/python/bin/python3.11" ]] || { echo 'Portable Python missing in app' >&2; exit 1; }
uv pip install --python "${RES}/python/bin/python3.11" --target "${RES}/pylibs" \
  -r "${INSTALL_DIR}/apps/api/requirements-core.txt"
PYTHONPATH="${RES}/pylibs:${INSTALL_DIR}/apps/api" "${RES}/python/bin/python3.11" - <<'PY'
import uvicorn,fastapi,sqlalchemy,pydantic,aiosqlite
print('PASS: bundled Python imports')
PY

# Compile the real OpenTutor production web UI for the fixed local API port.
WEB="${INSTALL_DIR}/apps/web"
cd "${WEB}"
npm ci --no-audit --no-fund
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL='http://127.0.0.1:18765/api' \
  NODE_OPTIONS='--max-old-space-size=4096' npm run build
[[ -f "${WEB}/.next/BUILD_ID" ]] || { echo 'Next.js production build failed' >&2; exit 1; }
if [[ "${TENET_LINT:-0}" == 1 ]]; then
  # Keep the native build usable for diagnostics; CI gates publication on the
  # recorded lint status after also exercising real learner interactions.
  mkdir -p "${SOURCE_DIR}/build"
  if npm run lint > "${SOURCE_DIR}/build/tenet-eslint.log" 2>&1; then
    echo 0 > "${SOURCE_DIR}/build/tenet-eslint.status"
  else
    echo 1 > "${SOURCE_DIR}/build/tenet-eslint.status"
  fi
fi
npm prune --omit=dev --no-audit --no-fund
# Avoid shipping build caches, VCS, backups, and any configuration secrets.
rm -rf "${WEB}/.next/cache"
rsync -a --exclude '.git/' --exclude '*.mastery-backup' --exclude '__pycache__/' \
  --exclude '*.pyc' --exclude '.env' --exclude 'uploads/' \
  "${INSTALL_DIR}/" "${RES}/opentutor/"
# Copy the actual Mach-O Node executable, not a runner-specific symlink.
cp -L "$(command -v node)" "${RES}/node"
chmod +x "${RES}/node"
file "${RES}/node" "${RES}/python/bin/python3.11"
# Homebrew Node can dynamically link /opt/homebrew libraries not installed on
# the user's Mac. Refuse to ship an apparently portable, actually broken DMG.
if otool -L "${RES}/node" | tail -n +2 | awk '{print $1}' | grep -E '^(/opt/homebrew/|/usr/local/|/Users/|/opt/|@rpath/)'; then
  echo 'Bundled Node depends on external libraries. Use an official standalone Node binary.' >&2
  exit 1
fi
[[ "$(uname -m)" == arm64 ]] && lipo -archs "${RES}/node" | grep -q arm64
# An outside package manager is not necessary on the destination Mac.

# Adapt the existing Cocoa/WebKit desktop launcher to the bundled installation.
"${RES}/python/bin/python3.11" - "${SOURCE_DIR}/macos/MasteryApp.swift" "${BUILD_DIR}/MasteryPortable.swift" <<'PY'
from pathlib import Path
import sys
src=Path(sys.argv[1]).read_text()
old='''        let pathURL = resourceURL.appendingPathComponent("opentutor-path.txt")
        guard let contents = try? String(contentsOf:pathURL, encoding:.utf8) else {
            launchFailure = "OpenTutor installation location is missing"; return
        }
        let root = URL(fileURLWithPath:contents.trimmingCharacters(in:.whitespacesAndNewlines), isDirectory:true)
        let script = resourceURL.appendingPathComponent("mastery_launch.sh")'''
new='''        // Portable app: all dependencies are bundled in Contents/Resources.
        let root = resourceURL.appendingPathComponent("opentutor", isDirectory: true)
        let script = resourceURL.appendingPathComponent("mastery_launch.sh")'''
assert src.count(old)==1, 'Portable Swift launcher anchor changed'
src=src.replace(old,new)
# Do not resolve DeepTutor settings inside the signed (potentially read-only)
# application bundle or inherit Homebrew executables on a clean M1 Mac.
old_env='''        let installRoot = root.deletingLastPathComponent().path
        env["DEEPTUTOR_HOME"] = "\(installRoot)/deeptutor-data"
        let oldPath = env["PATH"] ?? "/usr/bin:/bin"
        env["PATH"] = "\(installRoot)/deeptutor-venv/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\(oldPath)"'''
new_env='''        env["DEEPTUTOR_HOME"] = "\(home)/Library/Application Support/MasteryEngine2/deeptutor-data"
        env["PATH"] = "\(resourceURL.path):\(resourceURL.path)/python/bin:/usr/bin:/bin:/usr/sbin:/sbin"'''
assert src.count(old_env)==1, 'Portable Swift environment anchor changed'
src=src.replace(old_env,new_env)
Path(sys.argv[2]).write_text(src)
PY
cp "${SOURCE_DIR}/scripts/mastery_portable_launch.sh" "${RES}/mastery_launch.sh"
cp "${SOURCE_DIR}/scripts/mac_e2e_smoke.sh" "${RES}/mac_e2e_smoke.sh"
cat > "${APP}/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>MasteryEngine2</string>
<key>CFBundleIdentifier</key><string>app.masteryengine.mac</string>
<key>CFBundleName</key><string>Mastery Engine 2</string>
<key>CFBundleDisplayName</key><string>Mastery Engine 2</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.7.0</string>
<key>CFBundleVersion</key><string>7</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
xcrun swiftc -parse-as-library -O -target arm64-apple-macos13 -framework Cocoa -framework WebKit \
  "${BUILD_DIR}/MasteryPortable.swift" -o "${APP}/Contents/MacOS/MasteryEngine2"
chmod +x "${APP}/Contents/MacOS/MasteryEngine2"
# Ad-hoc signing is NOT Apple notarization: Gatekeeper may still require Open Anyway.
codesign --force --deep --sign - "${APP}"
# Validate app and its contents exist before presenting the package as a build.
[[ -x "${APP}/Contents/MacOS/MasteryEngine2" && -f "${RES}/opentutor/apps/web/.next/BUILD_ID" ]] || exit 1
"${RES}/node" --version
"${RES}/python/bin/python3.11" --version
STAGE="${BUILD_DIR}/dmg-stage"
mkdir -p "${STAGE}"
cp -R "${APP}" "${STAGE}/Mastery Engine 2.app"
ln -s /Applications "${STAGE}/Applications"
hdiutil create -volname 'Mastery Engine 2' -srcfolder "${STAGE}" -ov -format UDZO \
  "${DIST}/MasteryEngine2-AppleSilicon-Standalone.dmg"
[[ -s "${DIST}/MasteryEngine2-AppleSilicon-Standalone.dmg" ]] || exit 1
printf '\nBUILT: %s\n' "${DIST}/MasteryEngine2-AppleSilicon-Standalone.dmg"
printf 'Standalone binaries bundled. Not notarized; M1 install/launch must still pass smoke test.\n'
