#!/bin/bash
# Shared Apple Silicon release gate, used by GitHub Actions and Codemagic.
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
DMG="$SOURCE/dist/MasteryEngine2-AppleSilicon-Standalone.dmg"
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 && -s "$DMG" ]] || {
  echo 'Requires Apple Silicon macOS and a built standalone DMG' >&2; exit 1;
}
LOG_DIR="${CM_BUILD_DIR:-${RUNNER_TEMP:-${TMPDIR:-/tmp}}}"
LOG="$LOG_DIR/mastery-codemagic-smoke.log"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/mastery-release-smoke.XXXXXX")"
MOUNT_DIR="$SCRATCH/mounted"
mkdir -p "$MOUNT_DIR" "$SCRATCH/data"
export MASTERY_DATA_DIR="$SCRATCH/data"
touch "$MASTERY_DATA_DIR/.release-smoke"
PID=''
cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$PID" ]]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 || true
  # These paths belong to this run; never touch the learner's Library data.
  rm -rf "$SCRATCH"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
hdiutil attach -quiet -nobrowse -readonly -mountpoint "$MOUNT_DIR" "$DMG"
# Test an installed copy relocated from the DMG, not the builder's source app.
APP="$SCRATCH/Installed Apps/Mastery Engine 2.app"
mkdir -p "$(dirname "$APP")"
ditto "$MOUNT_DIR/Mastery Engine 2.app" "$APP"
/usr/bin/codesign --verify --deep --strict "$APP"
RES="$APP/Contents/Resources"
[[ -x "$APP/Contents/MacOS/MasteryEngine2" && -x "$RES/node" && -x "$RES/python/bin/python3.11" ]]
lipo -archs "$APP/Contents/MacOS/MasteryEngine2" | grep -qw arm64
[[ -f "$RES/opentutor/apps/web/.next/BUILD_ID" && -f "$RES/opentutor/apps/api/mastery_ext/router.py" ]]
echo 'PASS: DMG mounts; relocated app has a verified ad-hoc signature and native arm64 executable'
# Neither startup nor verification may resolve system Python, Node or Homebrew.
export PATH='/usr/bin:/bin:/usr/sbin:/sbin'
export HTTP_PROXY='http://127.0.0.1:9' HTTPS_PROXY='http://127.0.0.1:9'
export http_proxy="$HTTP_PROXY" https_proxy="$HTTPS_PROXY"
# Dead external proxies are a useful check, not OS-level network isolation.
export NO_PROXY='127.0.0.1,localhost' no_proxy='127.0.0.1,localhost'
"$RES/python/bin/python3.11" -c 'import sys; assert sys.version_info[:2] == (3,11)'
"$RES/node" -e 'if (process.arch !== "arm64") process.exit(1)'
start_services() {
  bash "$RES/mastery_launch.sh" "$RES/opentutor" "$RES" >>"$LOG" 2>&1 &
  PID=$!
  for i in {1..120}; do
    if ! kill -0 "$PID" 2>/dev/null; then cat "$LOG" >&2; return 1; fi
    if curl --noproxy '*' -fsS --max-time 2 'http://127.0.0.1:18765/api/health' >/dev/null 2>&1 &&
       curl --noproxy '*' -fsS --max-time 2 'http://127.0.0.1:18766/api/mastery/health' | grep -q '"status":"ok"'; then
      return 0
    fi
    sleep 1
  done
  cat "$LOG" >&2
  echo 'Bundled API/UI readiness timed out' >&2
  return 1
}
stop_services() {
  kill "$PID"
  wait "$PID" || true
  PID=''
  "$RES/python/bin/python3.11" - <<'PY'
import socket, time
for _ in range(50):
    occupied = []
    for port in (18765, 18766):
        with socket.socket() as sock:
            sock.settimeout(.2)
            if sock.connect_ex(('127.0.0.1', port)) == 0:
                occupied.append(port)
    if not occupied:
        print('PASS: launcher termination leaves no API or web listeners')
        break
    time.sleep(.1)
else:
    raise RuntimeError(f'Child services leaked: {occupied}')
PY
}
start_services
curl --noproxy '*' -fsS --max-time 20 'http://127.0.0.1:18766/mastery' > "$SCRATCH/page.html"
grep -q 'Loading your study workspace' "$SCRATCH/page.html" || {
  echo 'Mastery learner UI failed to render on bundled Next server' >&2; exit 1;
}
"$RES/python/bin/python3.11" "$SOURCE/scripts/verify_bundled_runtime.py" exercise "$SCRATCH/state.json"
stop_services
start_services
"$RES/python/bin/python3.11" "$SOURCE/scripts/verify_bundled_runtime.py" recover "$SCRATCH/state.json"
"$RES/python/bin/python3.11" "$SOURCE/scripts/verify_bundled_runtime.py" cleanup "$SCRATCH/state.json"
if [[ "${TENET_UI_E2E:-0}" == 1 ]]; then
  export TENET_PYTHON="$RES/python/bin/python3.11"
  "$RES/node" "$SOURCE/scripts/verify_tenet_ui.cjs"
fi
stop_services
echo 'PASS: installed bundled runtime, restart recovery and course deletion isolation'
echo 'NOT VERIFIED: physical network disconnection, Cocoa/WebKit interaction, Gatekeeper, notarization or updates'
