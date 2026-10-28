#!/bin/bash
# Install the optional, lighter DeepTutor CLI rather than its entire Web app.
set -euo pipefail
[[ "$(uname -s)" == Darwin ]] || { echo 'Run on your Mac' >&2;exit 1; }
HOME_DIR="${MASTERY_HOME:-${HOME}/MasteryEngine2}"
PYTHON="$(command -v python3.11 || command -v python3.12 || command -v python3.13 || true)"
[[ -n "${PYTHON}" ]] || { echo 'Python 3.11–3.13 required' >&2;exit 1; }
command -v git >/dev/null || { echo 'Git required' >&2;exit 1; }
mkdir -p "${HOME_DIR}"
if [[ ! -d "${HOME_DIR}/DeepTutor/.git" ]]; then
  git clone --depth 1 --branch v1.6.15 https://github.com/HKUDS/DeepTutor.git "${HOME_DIR}/DeepTutor"
fi
[[ -f "${HOME_DIR}/DeepTutor/packaging/deeptutor-cli/pyproject.toml" ]] || {
  echo 'Unsupported DeepTutor checkout; expected the CLI-only package' >&2;exit 1;
}
if [[ ! -x "${HOME_DIR}/deeptutor-venv/bin/python" ]];then
  "${PYTHON}" -m venv "${HOME_DIR}/deeptutor-venv"
fi
"${HOME_DIR}/deeptutor-venv/bin/python" -m pip install -e "${HOME_DIR}/DeepTutor/packaging/deeptutor-cli"
export DEEPTUTOR_HOME="${HOME_DIR}/deeptutor-data"
mkdir -p "${DEEPTUTOR_HOME}"
printf '\nCLI installed. Configure your chosen AI provider or local model:\n'
printf '  DEEPTUTOR_HOME="%s" "%s/deeptutor-venv/bin/deeptutor" init --cli\n' "$DEEPTUTOR_HOME" "$HOME_DIR"
printf '\nModel-backed tutoring is optional; the offline coach works without DeepTutor.\n'
