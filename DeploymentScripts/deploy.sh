#!/bin/bash
#
# Push updated server code from this repo to the Arbutus VM and restart the
# inference service. Use this when you change inference_server.py or the
# systemd unit and want the VM to pick it up without re-running setup_vm.sh.
#
#   bash arbutus_scripts/deploy.sh
#
# Configurable via env or .env (ARBUTUS_HOST, ARBUTUS_SSH_USER, ARBUTUS_SSH_KEY).

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." &> /dev/null && pwd)"

# Allow loading from .env at repo root
if [[ -f "${REPO_ROOT}/.env" ]]; then
    # shellcheck disable=SC1091
    set -a; source "${REPO_ROOT}/.env"; set +a
fi

VM_HOST="${ARBUTUS_HOST:-}"
VM_USER="${ARBUTUS_SSH_USER:-ubuntu}"
SSH_KEY="${ARBUTUS_SSH_KEY:-$HOME/.ssh/id_rsa}"

if [[ -z "${VM_HOST}" ]]; then
    echo "ERROR: ARBUTUS_HOST is not set. Put it in .env or export it." >&2
    exit 1
fi

SSH_OPTS=(-i "${SSH_KEY}" -o StrictHostKeyChecking=accept-new)

echo "Deploying to ${VM_USER}@${VM_HOST}..."

# Push the inference server code and systemd unit
scp "${SSH_OPTS[@]}" \
    "${SCRIPT_DIR}/inference_server.py" \
    "${SCRIPT_DIR}/genai-inference.service" \
    "${VM_USER}@${VM_HOST}:/tmp/"

# Move into place and restart
ssh "${SSH_OPTS[@]}" "${VM_USER}@${VM_HOST}" bash -s <<'REMOTE_EOF'
set -euo pipefail
sudo install -m 0644 -o ubuntu -g ubuntu /tmp/inference_server.py /opt/genai/inference_server.py
sudo install -m 0644 /tmp/genai-inference.service /etc/systemd/system/genai-inference.service
sudo systemctl daemon-reload
sudo systemctl restart genai-inference
sudo systemctl status genai-inference --no-pager --lines=10
REMOTE_EOF

echo "Deploy complete. Tail logs with:"
echo "  ssh -i ${SSH_KEY} ${VM_USER}@${VM_HOST} 'journalctl -u genai-inference -f'"
