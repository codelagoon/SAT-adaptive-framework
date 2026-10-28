#!/bin/bash
# Local-only production runtime. No installation, code download or dev server.
set -euo pipefail
ROOT="${1:?OpenTutor installation directory required}"
RESOURCE_DIR="${2:?Application resources directory required}"
API_DIR="${ROOT}/apps/api"
WEB_DIR="${ROOT}/apps/web"
PYTHON="${API_DIR}/.venv/bin/python"
NODE_FILE="${RESOURCE_DIR}/node-path.txt"
FAIL='Mastery Engine startup failed'
[[ -x "${PYTHON}" ]] || { echo "${FAIL}: installed Python runtime missing" >&2;exit 1; }
[[ -f "${WEB_DIR}/.next/BUILD_ID" ]] || { echo "${FAIL}: compiled Next.js frontend missing" >&2;exit 1; }
[[ -x "${WEB_DIR}/node_modules/.bin/next" ]] || { echo "${FAIL}: Node dependencies missing" >&2;exit 1; }
[[ -f "${NODE_FILE}" ]] || { echo "${FAIL}: Node installation path record missing" >&2;exit 1; }
NODE_BIN="$(cat "${NODE_FILE}")"
[[ -x "${NODE_BIN}" ]] || { echo "${FAIL}: Node executable has moved; re-run installer" >&2;exit 1; }
export PATH="$(dirname "${NODE_BIN}"):${API_DIR}/.venv/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export PYTHONUNBUFFERED=1 NEXT_TELEMETRY_DISABLED=1
export NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost"
# Load optional user configuration without executing .env as shell code.
# Python dotenv is already installed by requirements-core.txt. Values can
# contain spaces/quotes/metacharacters without becoming shell expressions.
if [[ -f "${ROOT}/.env" ]]; then
  while IFS= read -r -d '' entry; do
    export "$entry"
  done < <("${PYTHON}" - "${ROOT}/.env" <<'PY'
import re, sys
from dotenv import dotenv_values
for key, value in dotenv_values(sys.argv[1]).items():
    if re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key) and value is not None:
        if '\x00' not in value:
            sys.stdout.buffer.write(f'{key}={value}'.encode()+b'\0')
PY
)
fi
# These boundaries are enforced even if the user has a conflicting .env.
export ENVIRONMENT=development DEPLOYMENT_MODE=single_user AUTH_ENABLED=false
export NEXT_PUBLIC_API_URL='http://127.0.0.1:18765/api'
export CORS_ORIGINS='http://127.0.0.1:18766'
export APP_RUN_SCHEDULER=false APP_RUN_ACTIVITY_ENGINE=false
# A fixed localhost port in use could be another service or an earlier app.
# Never attach our unauthenticated UI to an unrelated service.
"${PYTHON}" - <<'PY'
import socket, sys
for port in (18765,18766):
    with socket.socket() as sock:
        sock.settimeout(0.4)
        if sock.connect_ex(('127.0.0.1',port)) == 0:
            print(f'Mastery Engine startup failed: localhost port {port} is in use; close the other instance.',file=sys.stderr)
            sys.exit(2)
PY
API_PID=''; WEB_PID=''
cleanup(){
  trap - INT TERM EXIT
  if [[ -n "${WEB_PID}" ]]; then kill "${WEB_PID}" 2>/dev/null || true;fi
  if [[ -n "${API_PID}" ]]; then kill "${API_PID}" 2>/dev/null || true;fi
  if [[ -n "${WEB_PID}" ]]; then wait "${WEB_PID}" 2>/dev/null || true;fi
  if [[ -n "${API_PID}" ]]; then wait "${API_PID}" 2>/dev/null || true;fi
}
trap cleanup EXIT INT TERM
cd "${API_DIR}"
"${PYTHON}" -m uvicorn main:app --host 127.0.0.1 --port 18765 & API_PID=$!
cd "${WEB_DIR}"
"${WEB_DIR}/node_modules/.bin/next" start --hostname 127.0.0.1 --port 18766 & WEB_PID=$!
# Do not report success on an HTML 200 alone; both the actual OpenTutor API
# and the Mastery Engine extension must be healthy through the production proxy.
READY=0
for attempt in {1..120}; do
  if ! kill -0 "${API_PID}" 2>/dev/null || ! kill -0 "${WEB_PID}" 2>/dev/null; then
    echo "${FAIL}: one server exited during initialization" >&2;exit 1
  fi
  if curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1:18765/api/health >/dev/null 2>&1 && \
     curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1:18766/api/mastery/health | grep -q '"status":"ok"'; then
    READY=1;break
  fi
  sleep 1
done
if [[ "$READY" != 1 ]]; then
  echo "${FAIL}: API or production frontend did not become healthy. Check ~/Library/Logs/MasteryEngine2/launch.log" >&2
  exit 1
fi
echo 'Mastery Engine: local API and production frontend are healthy'
# Keep both child processes attached to app lifetime.
while kill -0 "${API_PID}" 2>/dev/null && kill -0 "${WEB_PID}" 2>/dev/null;do sleep 2;done
echo "${FAIL}: one server exited unexpectedly" >&2
exit 1
