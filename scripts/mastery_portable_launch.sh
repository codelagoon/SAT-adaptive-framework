#!/bin/bash
# Self-contained macOS runtime: all executable dependencies are inside the .app.
set -euo pipefail
RESOURCE_DIR="${2:?Application resources directory required}"
ROOT="${RESOURCE_DIR}/opentutor"
API_DIR="${ROOT}/apps/api"
WEB_DIR="${ROOT}/apps/web"
PYTHON="${RESOURCE_DIR}/python/bin/python3.11"
NODE="${RESOURCE_DIR}/node"
FAIL='Mastery Engine startup failed'
[[ -x "${PYTHON}" && -x "${NODE}" ]] || { echo "${FAIL}: missing bundled runtimes" >&2; exit 1; }
[[ -f "${WEB_DIR}/.next/BUILD_ID" ]] || { echo "${FAIL}: missing production frontend" >&2; exit 1; }
[[ -f "${WEB_DIR}/node_modules/next/dist/bin/next" ]] || { echo "${FAIL}: missing bundled frontend dependencies" >&2; exit 1; }
[[ -f "${API_DIR}/main.py" && -d "${API_DIR}/mastery_ext" ]] || { echo "${FAIL}: missing bundled API or Mastery integration" >&2; exit 1; }
USER_DATA="${HOME}/Library/Application Support/MasteryEngine2"
mkdir -p "${USER_DATA}/uploads"
export PATH="${RESOURCE_DIR}:${RESOURCE_DIR}/python/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PYTHONPATH="${RESOURCE_DIR}/pylibs:${API_DIR}"
export PYTHONUNBUFFERED=1 NEXT_TELEMETRY_DISABLED=1
export NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost"
export ENVIRONMENT=development DEPLOYMENT_MODE=single_user AUTH_ENABLED=false
export APP_AUTO_CREATE_TABLES=true APP_AUTO_SEED_SYSTEM=true
export APP_RUN_SCHEDULER=false APP_RUN_ACTIVITY_ENGINE=false
export AMBIENT_MONITOR_ENABLED=false
export NEXT_PUBLIC_API_URL='http://127.0.0.1:18765/api'
export CORS_ORIGINS='http://127.0.0.1:18766'
export MASTERY_DATA_DIR="${USER_DATA}"
export DATABASE_URL="sqlite+aiosqlite:///${USER_DATA}/opentutor.sqlite3"
export UPLOAD_DIR="${USER_DATA}/uploads"
# Local-only API ports. Refuse to connect an unauthenticated app to unrelated services.
"${PYTHON}" - <<'PY'
import socket, sys
for port in (18765, 18766):
    with socket.socket() as sock:
        sock.settimeout(0.4)
        if sock.connect_ex(('127.0.0.1', port)) == 0:
            print(f'Mastery Engine startup failed: port {port} already used. Close the other instance.',file=sys.stderr)
            sys.exit(2)
PY
API_PID=''; WEB_PID=''
cleanup() {
  trap - EXIT INT TERM
  if [[ -n "${WEB_PID}" ]]; then kill "${WEB_PID}" 2>/dev/null || true; fi
  if [[ -n "${API_PID}" ]]; then kill "${API_PID}" 2>/dev/null || true; fi
  if [[ -n "${WEB_PID}" ]]; then wait "${WEB_PID}" 2>/dev/null || true; fi
  if [[ -n "${API_PID}" ]]; then wait "${API_PID}" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM
cd "${API_DIR}"
"${PYTHON}" -m uvicorn main:app --host 127.0.0.1 --port 18765 & API_PID=$!
cd "${WEB_DIR}"
"${NODE}" "${WEB_DIR}/node_modules/next/dist/bin/next" start --hostname 127.0.0.1 --port 18766 & WEB_PID=$!
READY=0
for attempt in {1..120}; do
  if ! kill -0 "${API_PID}" 2>/dev/null || ! kill -0 "${WEB_PID}" 2>/dev/null; then
    echo "${FAIL}: a local service exited during initialization" >&2; exit 1
  fi
  if curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1:18765/api/health >/dev/null 2>&1 && \
     curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1:18766/api/mastery/health | grep -q '"status":"ok"'; then
    READY=1; break
  fi
  sleep 1
done
[[ "${READY}" == 1 ]] || { echo "${FAIL}: health checks timed out" >&2; exit 1; }
echo 'Mastery Engine: bundled API and frontend healthy'
while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${WEB_PID}" 2>/dev/null; do sleep 2; done
echo "${FAIL}: one service exited unexpectedly" >&2
exit 1
