#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="${MASTERY_HOME:-${HOME}/MasteryEngine2}"
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || { echo 'Requires an Apple Silicon Mac' >&2;exit 1; }
for bin in git node npm python3 curl;do command -v "$bin" >/dev/null || { echo "Missing required tool: $bin" >&2; exit 1; };done
PY_BIN="$(command -v python3.11 || true)"
[[ -n "$PY_BIN" ]] || { echo 'Python 3.11 is required by OpenTutor upstream. Install a compatible Python first.' >&2; exit 1; }
NODE_MAJOR="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
[[ "$NODE_MAJOR" -ge 20 ]] || { echo 'Node.js >=20 is required.' >&2; exit 1; }
# Tested patch anchors correspond to this known OpenTutor commit.
# A floating main checkout can silently change upstream API contracts.
UPSTREAM_SHA="dbaab74ffe76d167427ddc4448e4e81dfc38b2a9"
if [[ ! -d "${HOME_DIR}/OpenTutor/.git" ]];then
  mkdir -p "$HOME_DIR"
  git clone --depth 1 https://github.com/zijinz456/OpenTutor.git "${HOME_DIR}/OpenTutor"
  if [[ "$(git -C "${HOME_DIR}/OpenTutor" rev-parse HEAD)" != "$UPSTREAM_SHA" ]];then
    git -C "${HOME_DIR}/OpenTutor" fetch --depth 1 origin "$UPSTREAM_SHA"
  fi
  git -C "${HOME_DIR}/OpenTutor" checkout --detach "$UPSTREAM_SHA"
else
  echo 'Existing OpenTutor checkout detected; will preserve its current commit and fail closed if incompatible.'
fi
"${PY_BIN}" "${ROOT}/scripts/apply_overlay.py" "${HOME_DIR}/OpenTutor"
if [[ ! -f "${HOME_DIR}/OpenTutor/.env" ]];then
  cp "${HOME_DIR}/OpenTutor/.env.example" "${HOME_DIR}/OpenTutor/.env"
fi
API_DIR="${HOME_DIR}/OpenTutor/apps/api"
WEB_DIR="${HOME_DIR}/OpenTutor/apps/web"
if [[ ! -x "${API_DIR}/.venv/bin/python" ]];then
  "${PY_BIN}" -m venv "${API_DIR}/.venv"
fi
"${API_DIR}/.venv/bin/python" -m pip install -r "${API_DIR}/requirements-core.txt"
cd "${WEB_DIR}"
if [[ -f package-lock.json ]];then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL='http://127.0.0.1:18765/api' npm run build
[[ -f "${WEB_DIR}/.next/BUILD_ID" ]] || { echo 'Production web build missing BUILD_ID' >&2;exit 1; }
bash -n "${ROOT}/scripts/mastery_launch.sh"
bash "${ROOT}/scripts/build_macos.sh"
printf '\nInstallation complete. Open: %s\n' "${ROOT}/build/Mastery Engine 2.app"
printf 'Python/npm dependencies and production frontend were installed now. Normal app launches perform no downloads.\n'
