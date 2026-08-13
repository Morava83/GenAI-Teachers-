#!/bin/bash
#
# One-time provisioning script for an Arbutus GPU VM running the GenAI
# inference server. Run this on the VM (not locally) after the VM is booted
# and the NVIDIA driver is installed.
#
#   curl -O https://.../setup_vm.sh   # or scp it from your laptop
#   chmod +x setup_vm.sh
#   sudo bash setup_vm.sh
#
# What this does:
#   1. Installs system dependencies (python, build tools, git).
#   2. Creates the /opt/genai layout with a Python venv.
#   3. Installs PyTorch + transformers + FastAPI deps.
#   4. Downloads the configured HF model into /opt/genai/model.
#   5. Installs the systemd unit and starts it.
#
# Re-runs are safe; it skips work that is already done.

set -euo pipefail

# ---- Configuration --------------------------------------------------------
GENAI_USER="${GENAI_USER:-ubuntu}"
GENAI_HOME="/opt/genai"
MODEL_DIR="${GENAI_HOME}/model"
VENV_DIR="${GENAI_HOME}/venv"
ENV_FILE="/etc/genai/inference.env"
SERVICE_NAME="genai-inference"

MODEL_ID="${MODEL_ID:-mistralai/Mistral-7B-Instruct-v0.3}"
TORCH_INDEX_URL="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu121}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: must run as root (use sudo)" >&2
    exit 1
fi

echo "============================================================"
echo "Arbutus VM setup for GenAI inference server"
echo "============================================================"
echo "  Target user:  ${GENAI_USER}"
echo "  Install root: ${GENAI_HOME}"
echo "  Model:        ${MODEL_ID}"
echo

# ---- 1. System packages ---------------------------------------------------
echo "[1/6] Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip python3-dev \
    build-essential git curl ca-certificates

# ---- 2. NVIDIA / CUDA sanity check ---------------------------------------
echo "[2/6] Checking GPU visibility..."
if ! command -v nvidia-smi &> /dev/null; then
    echo "WARNING: nvidia-smi not found. The Arbutus image you launched may not"
    echo "         include the NVIDIA driver. Either pick a GPU image that"
    echo "         bundles it, or install the driver before continuing."
    echo "         (See arbutus_scripts/README.md.)"
else
    nvidia-smi || echo "WARNING: nvidia-smi failed - driver may need a reboot."
fi

# ---- 3. Filesystem layout -------------------------------------------------
echo "[3/6] Creating directories..."
mkdir -p "${GENAI_HOME}" "${MODEL_DIR}" "/etc/genai" "/var/log/genai"
chown -R "${GENAI_USER}:${GENAI_USER}" "${GENAI_HOME}" "/var/log/genai"

# Copy server code from this repo into /opt/genai
install -m 0644 -o "${GENAI_USER}" -g "${GENAI_USER}" \
    "${SCRIPT_DIR}/inference_server.py" "${GENAI_HOME}/inference_server.py"

# ---- 4. Python venv + deps -----------------------------------------------
echo "[4/6] Creating Python venv and installing packages..."
if [[ ! -d "${VENV_DIR}" ]]; then
    sudo -u "${GENAI_USER}" python3 -m venv "${VENV_DIR}"
fi

sudo -u "${GENAI_USER}" "${VENV_DIR}/bin/pip" install --upgrade pip wheel
sudo -u "${GENAI_USER}" "${VENV_DIR}/bin/pip" install \
    --extra-index-url "${TORCH_INDEX_URL}" \
    torch
sudo -u "${GENAI_USER}" "${VENV_DIR}/bin/pip" install \
    "transformers>=4.40" \
    accelerate \
    "fastapi>=0.110" \
    "uvicorn[standard]>=0.27" \
    "pydantic>=2.5" \
    huggingface_hub

# ---- 5. Model download ----------------------------------------------------
echo "[5/6] Downloading model ${MODEL_ID}..."
if [[ -n "$(ls -A "${MODEL_DIR}" 2>/dev/null)" ]]; then
    echo "  Model directory already populated - skipping download."
    echo "  (Delete ${MODEL_DIR} and re-run this script to re-download.)"
else
    HF_TOKEN_ARG=""
    if [[ -n "${HF_TOKEN:-}" ]]; then
        HF_TOKEN_ARG="--token ${HF_TOKEN}"
    fi

    sudo -u "${GENAI_USER}" "${VENV_DIR}/bin/python" - <<PYEOF
import os
from huggingface_hub import snapshot_download
token = os.environ.get("HF_TOKEN") or None
path = snapshot_download(
    repo_id="${MODEL_ID}",
    local_dir="${MODEL_DIR}",
    local_dir_use_symlinks=False,
    token=token,
    ignore_patterns=["*.msgpack", "*.h5"],
)
print(f"Model downloaded to: {path}")
PYEOF
fi

# ---- 6. Systemd unit ------------------------------------------------------
echo "[6/6] Installing systemd unit..."

if [[ ! -f "${ENV_FILE}" ]]; then
    cat > "${ENV_FILE}" <<EOF
# Environment for ${SERVICE_NAME}.service
# Edit this file to change runtime settings, then:
#   sudo systemctl restart ${SERVICE_NAME}

MODEL_PATH=${MODEL_DIR}
HOST=0.0.0.0
PORT=8000

# Set a long random string here to require the X-API-Key header on /generate.
# Leave empty to allow unauthenticated requests (fine if the security group
# already restricts source IPs).
ARBUTUS_API_KEY=

# Comma-separated CORS origins, or * for any.
ARBUTUS_CORS_ORIGINS=*
EOF
    chmod 600 "${ENV_FILE}"
    echo "  Wrote default ${ENV_FILE} - edit it and set ARBUTUS_API_KEY before exposing the VM."
fi

install -m 0644 "${SCRIPT_DIR}/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"

# Patch the User= line if the operator set GENAI_USER to something other than ubuntu
if [[ "${GENAI_USER}" != "ubuntu" ]]; then
    sed -i "s/^User=ubuntu/User=${GENAI_USER}/" "/etc/systemd/system/${SERVICE_NAME}.service"
    sed -i "s/^Group=ubuntu/Group=${GENAI_USER}/" "/etc/systemd/system/${SERVICE_NAME}.service"
fi

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

echo
echo "============================================================"
echo "Done."
echo "============================================================"
echo "  Service status:  systemctl status ${SERVICE_NAME}"
echo "  Live logs:       journalctl -u ${SERVICE_NAME} -f"
echo "  Health check:    curl http://localhost:8000/health"
echo
echo "Loading the model on first start takes several minutes - watch the logs."
