# Rorqual Cluster Setup Guide

Rorqual is Alliance Canada's dedicated AI/ML cluster with H100 GPUs.

## Key Differences from Rorqual
- **Hostname**: `rorqual.alliancecan.ca`
- **GPUs**: H100-80GB (4 per node)
- **Max job time**: 7 days (vs 24 hours on other clusters)
- **No AIP required**: Uses your regular Alliance account (def-pi)
- **IMPORTANT**: Compute nodes CANNOT access internet - download models on login node first!

---

## Quick Setup (Assuming you have Rorqual access)

### Step 1: Request Rorqual Access
1. Go to https://ccdb.alliancecan.ca
2. Click **Resources** → **Request Access**
3. Select **Rorqual**
4. Accept the three agreements
5. Wait ~1 hour for approval

### Step 2: Test SSH Connection
```bash
ssh andersw@rorqual.alliancecan.ca
```

### Step 3: Create Directory Structure
```bash
ssh andersw@rorqual.alliancecan.ca << 'EOF'
mkdir -p ~/projects/def-pi/genai-teachers/{models,scripts,connection_info,results}
ls -la ~/projects/def-pi/genai-teachers/
EOF
```

### Step 4: Set Up Python Environment
```bash
ssh andersw@rorqual.alliancecan.ca << 'EOF'
module load StdEnv/2023
module load python/3.11

# Create virtual environment
virtualenv --no-download ~/envs/genai_teachers

# Activate and install dependencies
source ~/envs/genai_teachers/bin/activate
pip install --no-index torch torchvision transformers accelerate
pip install fastapi uvicorn requests

# Verify installation
python -c "import torch; print(f'PyTorch: {torch.__version__}')"
python -c "import transformers; print('Transformers installed')"
EOF
```

### Step 5: Download Model (on Login Node)
⚠️ **CRITICAL**: Download on login node since compute nodes can't access internet!

```bash
ssh andersw@rorqual.alliancecan.ca << 'EOF'
source ~/envs/genai_teachers/bin/activate

# Create download script
cat > ~/download_model.py << 'DOWNLOAD_SCRIPT'
from transformers import AutoModelForCausalLM, AutoTokenizer
import sys

# Choose your model (examples):
# - "facebook/opt-6.7b" (smaller, faster)
# - "facebook/opt-13b" (medium)
# - "EleutherAI/gpt-neox-20b" (larger, better quality)
MODEL_NAME = "openai/gpt-oss-20b"  # Start with smaller model for testing

cache_dir = "/home/andersw/projects/def-pi/genai-teachers/models/gpt-oss-20b"

print(f"Downloading {MODEL_NAME}...")
print("This may take 30-90 minutes...")

try:
    # Download tokenizer
    print("Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, cache_dir=cache_dir)

    # Download model
    print("Downloading model...")
    model = AutoModelForCausalLM.from_pretrained(MODEL_NAME, cache_dir=cache_dir)

    print(f"\nSuccess! Model saved to: {cache_dir}")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
DOWNLOAD_SCRIPT

# Run download
python ~/download_model.py
EOF
```

**Download time**: 30-90 minutes depending on model size.

### Step 6: Upload Scripts from Local Machine
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-"

# Upload inference server
scp rorqual_scripts/inference_server.py andersw@rorqual.alliancecan.ca:~/projects/def-pi/genai-teachers/scripts/

# Upload SLURM script
scp rorqual_scripts/start_inference_server.sh andersw@rorqual.alliancecan.ca:~/projects/def-pi/genai-teachers/scripts/

# Verify
ssh andersw@rorqual.alliancecan.ca "ls -l ~/projects/def-pi/genai-teachers/scripts/"
```

### Step 7: Configure Your Allocation Account
Use your default Alliance account (usually `def-pi` or `def-supervisor`):

```bash
# Find your account name
ssh andersw@rorqual.alliancecan.ca "sacctmgr show assoc user=\$USER format=account"

# Update SLURM script with your account (usually def-pi)
ssh andersw@rorqual.alliancecan.ca "sed -i 's/REPLACE_WITH_YOUR_AIP_ACCOUNT/def-pi/g' ~/projects/def-pi/genai-teachers/scripts/start_inference_server.sh"

# Make executable
ssh andersw@rorqual.alliancecan.ca "chmod +x ~/projects/def-pi/genai-teachers/scripts/*.sh ~/projects/def-pi/genai-teachers/scripts/*.py"
```

### Step 8: Update Local .env File
Your `.env` is already configured for Rorqual with the default account (`def-pi`)!

### Step 9: Install Local Dependencies
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-"
pip install paramiko requests python-dotenv
```

### Step 10: Test the Setup
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-\EDU RAG"

# Validate configuration
python -c "from rorqual_config import validate_config; validate_config(); print('✓ Config valid!')"

# Test first inference (spins up Rorqual node - takes 5-10 min)
python -c "from rorqual_module import get_gpt_response; print(get_gpt_response('Create a simple math problem'))"
```

### Step 11: Run Your Chatbot
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-\EDU RAG"
python Chroma_chatbot.py
```

---

## Useful Commands

### Check job status:
```bash
ssh andersw@rorqual.alliancecan.ca "squeue -u andersw"
```

### View server logs:
```bash
ssh andersw@rorqual.alliancecan.ca "tail -50 ~/genai-inference-*.out"
```

### Check GPU allocation:
```bash
ssh andersw@rorqual.alliancecan.ca "sinfo -p gpu --Format=partition,available,nodes,gres"
```

### Cancel job:
```bash
ssh andersw@rorqual.alliancecan.ca "scancel <job_id>"
```

### Check your fairshare (resource allocation):
```bash
ssh andersw@rorqual.alliancecan.ca "sshare -U"
```

---

## Recommended Models for Rorqual

Since Rorqual has powerful H100 GPUs, you can run larger models:

| Model | Size | Quality | Speed | Recommended For |
|-------|------|---------|-------|----------------|
| `facebook/opt-6.7b` | ~13GB | Good | Fast | Testing, development |
| `facebook/opt-13b` | ~26GB | Better | Medium | Production (lighter) |
| `EleutherAI/gpt-neox-20b` | ~40GB | Best | Slower | Production (quality) |
| `mistralai/Mistral-7B-v0.1` | ~14GB | Excellent | Fast | Recommended! |

**Start with `facebook/opt-6.7b` or `mistralai/Mistral-7B-v0.1` for testing!**

---

## Troubleshooting

### "Configuration error: Missing required Rorqual configuration"
- Make sure `.env` has `RORQUAL_ACCOUNT=def-pi` (or your allocation name)
- Run: `python -c "from rorqual_config import validate_config; validate_config()"`

### "SSH connection failed"
- Test: `ssh andersw@rorqual.alliancecan.ca`
- Check SSH key is added to CCDB: https://ccdb.alliancecan.ca

### "sbatch: error: Batch job submission failed"
- Verify your account: `ssh andersw@rorqual "sacctmgr show assoc user=$USER format=account"`
- Check account in script matches your allocation (usually `def-pi`)

### "Model not found" error
- Models must be downloaded on login node (compute nodes can't access internet)
- Verify: `ssh andersw@rorqual "ls -lh ~/projects/def-pi/genai-teachers/models/gpt-oss-20b/"`

### Job queued for long time
- Check queue: `ssh andersw@rorqual "squeue -u andersw"`
- Check fairshare: `ssh andersw@rorqual "sshare -U"`
- Consider requesting fewer GPUs: change `--gpus=h100:4` to `--gpus=h100:1`

---

## GPU Options on Rorqual

You can request different GPU configurations:

### Full GPUs (recommended for inference):
```bash
#SBATCH --gpus=h100:1    # 1 GPU (80GB)
#SBATCH --gpus=h100:2    # 2 GPUs (160GB total)
#SBATCH --gpus=h100:4    # 4 GPUs (320GB total) - current setting
```

### MIG Instances (for smaller models):
```bash
#SBATCH --gpus=h100-1g.10gb:1   # Fractional GPU, 10GB
#SBATCH --gpus=h100-2g.20gb:1   # Fractional GPU, 20GB
#SBATCH --gpus=h100-3g.40gb:1   # Fractional GPU, 40GB
```

For most use cases, **start with `--gpus=h100:1`** to reduce wait times.

---

## Next Steps

1. ✅ Your `.env` is already configured!
2. **Run Steps 1-10** above
3. **Test with** `python Chroma_chatbot.py`

Good luck! 🚀
