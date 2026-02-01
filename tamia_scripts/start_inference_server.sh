#!/bin/bash
#SBATCH --account=REPLACE_WITH_YOUR_AIP_ACCOUNT  # e.g., aip-123456
#SBATCH --job-name=genai-inference
#SBATCH --nodes=1
#SBATCH --gpus=h100:4                   # Use all 4 H100 GPUs
#SBATCH --cpus-per-task=48              # All CPU cores on node
#SBATCH --mem=200G                      # 200GB RAM (out of 512GB available)
#SBATCH --time=24:00:00                 # Max 24 hours
#SBATCH --output=%x-%j.out              # Output file: genai-inference-<jobid>.out
#SBATCH --error=%x-%j.err               # Error file: genai-inference-<jobid>.err

# ==============================================================================
# TamIA Inference Server Startup Script
#
# This script:
# 1. Sets up the environment on a TamIA compute node
# 2. Copies the model to fast local storage ($SLURM_TMPDIR)
# 3. Starts the FastAPI inference server
# 4. Auto-resubmits to maintain 24/7 availability (unless STOP_SERVER file exists)
# ==============================================================================

set -e  # Exit on error

echo "=============================================================================="
echo "TamIA Inference Server Startup"
echo "=============================================================================="
echo "Job ID: $SLURM_JOB_ID"
echo "Node: $(hostname)"
echo "Start time: $(date)"
echo "=============================================================================="

# Configuration - these should match your setup
PROJECT_DIR="${PROJECT_DIR:-$HOME/projects/def-pi/genai-teachers}"
MODEL_NAME="${MODEL_NAME:-gpt-oss-20b}"
VENV_PATH="${VENV_PATH:-$HOME/envs/genai_teachers}"
SERVER_PORT="${SERVER_PORT:-8000}"

echo "Configuration:"
echo "  PROJECT_DIR: $PROJECT_DIR"
echo "  MODEL_NAME: $MODEL_NAME"
echo "  VENV_PATH: $VENV_PATH"
echo "  SERVER_PORT: $SERVER_PORT"
echo ""

# ==============================================================================
# 1. Load Environment Modules
# ==============================================================================

echo "[1/6] Loading environment modules..."
module load StdEnv/2023
module load python/3.11

echo "Python version: $(python --version)"
echo ""

# ==============================================================================
# 2. Activate Virtual Environment
# ==============================================================================

echo "[2/6] Activating virtual environment..."
source "$VENV_PATH/bin/activate"

echo "Virtual environment activated: $VIRTUAL_ENV"
echo ""

# ==============================================================================
# 3. Copy Model to Fast Local Storage
# ==============================================================================

echo "[3/6] Copying model to local SSD storage..."
echo "  Source: $PROJECT_DIR/models/$MODEL_NAME"
echo "  Destination: $SLURM_TMPDIR/model"
echo "  This may take several minutes..."

# Create model directory
mkdir -p "$SLURM_TMPDIR/model"

# Copy model files
# Note: Using rsync for better progress tracking
if command -v rsync &> /dev/null; then
    rsync -ah --info=progress2 "$PROJECT_DIR/models/$MODEL_NAME/" "$SLURM_TMPDIR/model/"
else
    cp -r "$PROJECT_DIR/models/$MODEL_NAME/"* "$SLURM_TMPDIR/model/"
fi

echo "Model copied successfully"
echo "Model size: $(du -sh $SLURM_TMPDIR/model | cut -f1)"
echo ""

# ==============================================================================
# 4. Write Connection Info
# ==============================================================================

echo "[4/6] Writing connection info..."

# Create connection info directory if it doesn't exist
mkdir -p "$PROJECT_DIR/connection_info"

# Write job ID and node name for client to discover
echo "$SLURM_JOB_ID" > "$PROJECT_DIR/connection_info/current_job_id.txt"
echo "$(hostname)" > "$PROJECT_DIR/connection_info/current_node.txt"
echo "$SERVER_PORT" > "$PROJECT_DIR/connection_info/current_port.txt"
date --iso-8601=seconds > "$PROJECT_DIR/connection_info/started_at.txt"

echo "Connection info written to $PROJECT_DIR/connection_info/"
echo ""

# ==============================================================================
# 5. Start Inference Server
# ==============================================================================

echo "[5/6] Starting inference server..."
echo "  Model path: $SLURM_TMPDIR/model"
echo "  Host: 0.0.0.0"
echo "  Port: $SERVER_PORT"
echo ""

# Set environment variable for model path
export MODEL_PATH="$SLURM_TMPDIR/model"

# Change to tmpdir for any temporary files
cd "$SLURM_TMPDIR"

# Start the server
echo "=============================================================================="
echo "Server Starting - Logs below"
echo "=============================================================================="

python "$PROJECT_DIR/scripts/inference_server.py" \
    --model-path "$SLURM_TMPDIR/model" \
    --host 0.0.0.0 \
    --port "$SERVER_PORT" \
    --workers 1

# ==============================================================================
# 6. Auto-resubmit for 24/7 Availability (Optional)
# ==============================================================================

echo ""
echo "[6/6] Checking for auto-resubmit..."

# Check if STOP_SERVER file exists
if [ -f "$PROJECT_DIR/STOP_SERVER" ]; then
    echo "STOP_SERVER file found. Not resubmitting."
    echo "To resume auto-resubmit, remove $PROJECT_DIR/STOP_SERVER"
else
    echo "Auto-resubmitting job to maintain 24/7 availability..."

    # Wait a bit before resubmitting to avoid immediate resubmission
    sleep 10

    # Resubmit this script
    NEXT_JOB_ID=$(sbatch "$PROJECT_DIR/scripts/start_inference_server.sh" | awk '{print $NF}')
    echo "Next job submitted: $NEXT_JOB_ID"
fi

echo "=============================================================================="
echo "Job finished at $(date)"
echo "=============================================================================="
