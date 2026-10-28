#!/bin/bash
# Run only on the Apple Silicon CI builder, against the actual packaged runtimes.
set -euo pipefail
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
APP="$SOURCE/build/Mastery Engine 2.app"
RES="$APP/Contents/Resources"
DMG="$SOURCE/dist/MasteryEngine2-AppleSilicon-Standalone.dmg"
PORT1=18765; PORT2=18766
[[ -x "$APP/Contents/MacOS/MasteryEngine2" && -x "$RES/node" && -x "$RES/python/bin/python3.11" && -s "$DMG" ]] || {
  echo 'Missing compiled native app, bundled runtimes, or DMG' >&2; exit 1;
}
[[ -f "$RES/opentutor/apps/web/.next/BUILD_ID" ]] || { echo 'Production web assets missing' >&2; exit 1; }
[[ -f "$RES/opentutor/apps/api/mastery_ext/router.py" ]] || { echo 'Mastery extension missing' >&2; exit 1; }
LOG="${CM_BUILD_DIR:-${RUNNER_TEMP:-/tmp}}/mastery-codemagic-smoke.log"
# Health test deliberately avoids relying on system Node/Python.
export PATH='/usr/bin:/bin:/usr/sbin:/sbin'
"$RES/python/bin/python3.11" -c 'import sys; assert sys.version_info[:2] == (3,11)'
"$RES/node" -e 'if (process.arch !== "arm64") process.exit(1)'
bash "$RES/mastery_launch.sh" "$RES/opentutor" "$RES" >"$LOG" 2>&1 &
PID=$!
cleanup() {
  if [[ -n "${PID:-}" ]]; then
    # Kill the process group via launcher cleanup trap; best-effort fallback.
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM
READY=0
for i in {1..120}; do
  if ! kill -0 "$PID" 2>/dev/null; then cat "$LOG" >&2; echo 'Bundled app exited during startup' >&2; exit 1; fi
  if curl --noproxy '*' -fsS --max-time 2 'http://127.0.0.1:18765/api/health' >/dev/null 2>&1 &&
     curl --noproxy '*' -fsS --max-time 2 'http://127.0.0.1:18766/api/mastery/health' | grep -q '"status":"ok"'; then
    READY=1; break
  fi
  sleep 1
done
if [[ "$READY" != 1 ]]; then cat "$LOG" >&2; echo 'Bundled API/UI readiness timed out' >&2; exit 1; fi
"$RES/python/bin/python3.11" - <<'PY'
import json, urllib.request, uuid
base = 'http://127.0.0.1:18766/api'
def call(path, method='GET', body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if raw else None
course = None
try:
    course = call('/courses/', 'POST', {
        'name': 'Codemagic smoke ' + uuid.uuid4().hex[:10],
        'description': 'Temporary verification course',
        'metadata': {'mastery_track': 'SAT Math'}
    })['id']
    seeded = call(f'/mastery/courses/{course}/starter-questions', 'POST')
    assert seeded['added'] >= 100, seeded
    next_item = call(f'/mastery/courses/{course}/next')['question']
    assert next_item and next_item['options'] and 'correct_answer' not in next_item
    call('/mastery/prepare', 'POST', {
        'course_id': course, 'problem_id': next_item['id'],
        'confidence': 2, 'reasoning': 'Codemagic end-to-end test', 'mode': 'challenge'
    })
    graded = call('/quiz/submit', 'POST', {
        'problem_id': next_item['id'], 'user_answer': 'Z', 'answer_time_ms': 1800
    })
    assert graded['is_correct'] is False and graded.get('result_id'), graded
    overview = call(f'/mastery/courses/{course}/overview')
    assert overview['recent_errors'] and overview['skills'], overview
    print('PASS: real OpenTutor, bundled Python/Node, local study, grading and mastery history')
finally:
    if course is not None:
        call(f'/courses/{course}', 'DELETE')
print('PASS: temporary learning course deleted')
PY
# Ensure the DMG mountable on the actual macOS host, without touching /Applications.
MOUNT_DIR="$(mktemp -d /tmp/mastery-codemagic-mount.XXXXXX)"
trap 'hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 || true; rmdir "$MOUNT_DIR" 2>/dev/null || true; cleanup' EXIT INT TERM
hdiutil attach -quiet -nobrowse -readonly -mountpoint "$MOUNT_DIR" "$DMG"
test -x "$MOUNT_DIR/Mastery Engine 2.app/Contents/MacOS/MasteryEngine2"
/usr/bin/codesign --verify --deep --strict "$MOUNT_DIR/Mastery Engine 2.app"
echo 'PASS: DMG mounts and contains an ad-hoc-signed native arm64 app'
