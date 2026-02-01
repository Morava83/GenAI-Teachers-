# Rorqual Setup Checklist

## Step 1: Test SSH Connection
```bash
ssh your_username@rorqual.alliancecan.ca
```
If this works, you're ready to proceed!

## Step 2: Create Directory Structure on Rorqual
```bash
ssh your_username@rorqual.alliancecan.ca

# Create project directories
mkdir -p ~/projects/def-pi/genai-teachers/{models,scripts,connection_info,results}

# Verify
ls -la ~/projects/def-pi/genai-teachers/
```

## Step 3: Set Up Python Environment on Rorqual
```bash
# Load modules
module load StdEnv/2023
module load python/3.11

# Create virtual environment
virtualenv --no-download ~/envs/genai_teachers

# Activate environment
source ~/envs/genai_teachers/bin/activate

# Install dependencies
pip install --no-index torch torchvision transformers accelerate
pip install fastapi uvicorn requests
```

## Step 4: Upload Scripts from Local Machine
From your local machine (Windows):
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-"

# Upload inference server script
scp rorqual_scripts/inference_server.py your_username@rorqual.alliancecan.ca:~/projects/def-pi/genai-teachers/scripts/

# Upload SLURM script
scp rorqual_scripts/start_inference_server.sh your_username@rorqual.alliancecan.ca:~/projects/def-pi/genai-teachers/scripts/

# Verify upload
ssh your_username@rorqual.alliancecan.ca "ls -l ~/projects/def-pi/genai-teachers/scripts/"
```

## Step 5: Configure SLURM Script on Rorqual
```bash
ssh your_username@rorqual.alliancecan.ca

# Edit the SLURM script
nano ~/projects/def-pi/genai-teachers/scripts/start_inference_server.sh

# Find this line:
#SBATCH --account=REPLACE_WITH_YOUR_AIP_ACCOUNT

# Change to your actual AIP account:
#SBATCH --account=aip-123456

# Save: Ctrl+O, Enter, Ctrl+X

# Make executable
chmod +x ~/projects/def-pi/genai-teachers/scripts/*.sh
chmod +x ~/projects/def-pi/genai-teachers/scripts/*.py
```

## Step 6: Configure Local .env File
Edit your local `.env` file with these settings:

```bash
# Enable Rorqual
RORQUAL_ENABLED=True

# Your Rorqual credentials
RORQUAL_USERNAME=your_actual_username
RORQUAL_SSH_KEY_PATH=C:/Users/YourName/.ssh/id_rsa

# Your project directory on Rorqual (replace your_username)
RORQUAL_PROJECT_DIR=/home/your_username/projects/def-pi/genai-teachers

# Your AIP account
RORQUAL_ACCOUNT=aip-123456

# OpenAI API key (fallback only)
OPENAI_API_KEY=your_openai_key
```

## Step 7: Test Python SSH Connection
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-\EDU RAG"

# Test configuration
python -c "from rorqual_config import RORQUAL_CONFIG, validate_config; validate_config(); print('Config OK!')"
```

## Step 8: Test First Inference
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-\EDU RAG"

# This will automatically:
# - Spin up Rorqual node
# - Create SSH tunnel
# - Run inference
python -c "from rorqual_module import get_gpt_response; print(get_gpt_response('Generate a simple algebra problem'))"
```

This may take 5-10 minutes on first run as it spins up the compute node!

## Step 9: Run the Chatbot
```bash
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-\EDU RAG"
python Chroma_chatbot.py
```

---

## Quick Reference: Important Commands

### Check if Rorqual node is running:
```bash
ssh your_username@rorqual.alliancecan.ca "squeue -u $USER"
```

### Manually shutdown node:
```python
from rorqual_module import _shutdown_node, _check_node_status
state = _check_node_status()
if state:
    _shutdown_node(state)
```

### View server logs on Rorqual:
```bash
ssh your_username@rorqual.alliancecan.ca "tail -50 ~/genai-inference-*.out"
```

---

## Troubleshooting

### "Configuration error: Missing required Rorqual configuration"
- Check your `.env` file has all required fields
- Make sure RORQUAL_ENABLED=True

### "SSH connection failed"
- Verify SSH key is added to CCDB
- Test: `ssh your_username@rorqual.alliancecan.ca`

### "Job submission failed"
- Check AIP account number in SLURM script
- Verify you have Rorqual access in CCDB

### "Server not responding"
- Check if job is running: `ssh user@rorqual "squeue -u $USER"`
- Check logs: `ssh user@rorqual "tail -100 ~/genai-inference-*.out"`
