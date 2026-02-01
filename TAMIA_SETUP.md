# TamIA Cluster Setup Guide

This guide walks you through setting up the TamIA cluster integration for the GenAI Math Problem Generator.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Requesting TamIA Access](#requesting-tamia-access)
3. [Initial TamIA Setup](#initial-tamia-setup)
4. [Model Download](#model-download)
5. [Deploy Scripts](#deploy-scripts)
6. [Local Configuration](#local-configuration)
7. [Testing the Setup](#testing-the-setup)
8. [Usage](#usage)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- McGill/University email and student/faculty account
- Canadian Alliance account (create at https://ccdb.alliancecan.ca)
- SSH client installed (built-in on Mac/Linux, use PuTTY or WSL on Windows)
- Basic familiarity with SSH and command-line tools

### Recommended
- Member of a research group with an AIP Resource Allocation Project

---

## Requesting TamIA Access

### Step 1: Get Alliance Account
1. Go to https://ccdb.alliancecan.ca
2. Click "Register" and follow instructions
3. Use your university email
4. Wait for approval (usually within 1 business day)

### Step 2: Request TamIA Access
1. Log in to https://ccdb.alliancecan.ca
2. Go to "My Account" → "Access Services"
3. Find "TamIA Cluster Access" and click "Request"
4. You must be part of an AIP-type project (ask your supervisor/PI)
5. Access typically granted within 1 hour

### Step 3: Set Up SSH Keys

**On Mac/Linux:**
```bash
# Generate SSH key if you don't have one
ssh-keygen -t rsa -b 4096 -C "your_email@university.ca"

# Add key to Alliance CCDB
# Copy your public key
cat ~/.ssh/id_rsa.pub

# Go to https://ccdb.alliancecan.ca → My Account → SSH Keys
# Click "Add Key" and paste the public key
```

**On Windows:**
```bash
# If using WSL or Git Bash:
ssh-keygen -t rsa -b 4096 -C "your_email@university.ca"
cat ~/.ssh/id_rsa.pub

# If using PuTTY:
# 1. Download PuTTYgen
# 2. Generate RSA key (4096 bits)
# 3. Save private key
# 4. Copy public key to CCDB
```

### Step 4: Test SSH Connection
```bash
ssh your_username@tamia.alliancecan.ca

# You should see:
# Welcome to TamIA cluster...
```

---

## Initial TamIA Setup

### Step 1: Create Project Directory Structure

SSH into TamIA and create the necessary directories:

```bash
ssh your_username@tamia.alliancecan.ca

# Create project directory
mkdir -p ~/projects/def-pi/genai-teachers/{models,scripts,connection_info,results}

# Verify structure
tree ~/projects/def-pi/genai-teachers -L 1
```

You should see:
```
~/projects/def-pi/genai-teachers/
├── models/
├── scripts/
├── connection_info/
└── results/
```

### Step 2: Set Up Python Environment

```bash
# Load required modules
module load StdEnv/2023
module load python/3.11

# Check Python version
python --version  # Should be 3.11.x

# Create virtual environment
virtualenv --no-download ~/envs/genai_teachers

# Activate environment
source ~/envs/genai_teachers/bin/activate

# Verify activation
which python  # Should point to ~/envs/genai_teachers/bin/python
```

### Step 3: Install Python Dependencies

```bash
# Make sure virtual environment is activated
source ~/envs/genai_teachers/bin/activate

# Install PyTorch (use pre-built wheels)
pip install --no-index torch torchvision

# Install Transformers and related packages
pip install --no-index transformers accelerate

# Install FastAPI and Uvicorn for the server
pip install fastapi uvicorn[standard]

# If bitsandbytes is available (for 8-bit quantization)
pip install bitsandbytes

# Install requests for health checks
pip install --no-index requests

# Verify installations
python -c "import torch; print(f'PyTorch: {torch.__version__}')"
python -c "import transformers; print(f'Transformers: {transformers.__version__}')"
python -c "import fastapi; print('FastAPI installed')"
```

**Note:** Use `--no-index` flag to use pre-built wheels from Alliance's wheelhouse. This is much faster and more reliable than building from source.

---

## Model Download

### Important: Model Name Clarification

⚠️ **The model "openai/gpt-oss-20b" may not exist on HuggingFace.** You need to verify the correct model name.

Possible alternatives:
- `facebook/opt-20b` - Meta's OPT-20B
- `EleutherAI/gpt-neox-20b` - EleutherAI's GPT-NeoX-20B
- `tiiuae/falcon-20b` - TII's Falcon-20B

Please confirm with your instructor/supervisor which model to use.

### Download Model (on TamIA login node)

The login node has internet access, so download the model there:

```bash
# SSH to TamIA
ssh your_username@tamia.alliancecan.ca

# Activate virtual environment
source ~/envs/genai_teachers/bin/activate

# Create download script
cat > ~/download_model.py << 'EOF'
from transformers import AutoModelForCausalLM, AutoTokenizer
import sys

# REPLACE THIS with the correct model name
MODEL_NAME = "facebook/opt-20b"  # or whatever the correct name is

print(f"Downloading {MODEL_NAME}...")
print("This may take 30-60 minutes depending on model size...")

cache_dir = "/home/your_username/projects/def-pi/genai-teachers/models/gpt-oss-20b"

try:
    # Download tokenizer
    print("Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_NAME,
        cache_dir=cache_dir
    )
    print("Tokenizer downloaded successfully")

    # Download model
    print("Downloading model...")
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        cache_dir=cache_dir
    )
    print("Model downloaded successfully")

    print(f"\nModel saved to: {cache_dir}")
    print("\nYou can now delete this script.")

except Exception as e:
    print(f"Error downloading model: {e}")
    sys.exit(1)
EOF

# Update your_username in the script
sed -i "s/your_username/$USER/g" ~/download_model.py

# Run download (this will take a while!)
python ~/download_model.py
```

**Expected download time:** 30-90 minutes depending on model size and network speed.

### Verify Model Download

```bash
# Check model directory
ls -lh ~/projects/def-pi/genai-teachers/models/gpt-oss-20b/

# You should see files like:
# - config.json
# - pytorch_model.bin (or multiple pytorch_model-*.bin files)
# - tokenizer_config.json
# - tokenizer.json
# etc.

# Check total size
du -sh ~/projects/def-pi/genai-teachers/models/gpt-oss-20b/
```

---

## Deploy Scripts

### Step 1: Upload Scripts from Local Machine

From your **local machine** (not TamIA), upload the scripts:

```bash
# Navigate to your project directory
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-"

# Upload inference server script
scp tamia_scripts/inference_server.py your_username@tamia.alliancecan.ca:~/projects/def-pi/genai-teachers/scripts/

# Upload SLURM script
scp tamia_scripts/start_inference_server.sh your_username@tamia.alliancecan.ca:~/projects/def-pi/genai-teachers/scripts/

# Verify upload
ssh your_username@tamia.alliancecan.ca "ls -l ~/projects/def-pi/genai-teachers/scripts/"
```

### Step 2: Configure SLURM Script

SSH back to TamIA and edit the SLURM script to add your AIP account:

```bash
ssh your_username@tamia.alliancecan.ca

# Edit the script
nano ~/projects/def-pi/genai-teachers/scripts/start_inference_server.sh

# Change this line:
#SBATCH --account=REPLACE_WITH_YOUR_AIP_ACCOUNT

# To (replace with your actual account):
#SBATCH --account=aip-123456

# Save and exit (Ctrl+O, Enter, Ctrl+X)
```

### Step 3: Make Scripts Executable

```bash
chmod +x ~/projects/def-pi/genai-teachers/scripts/*.sh
chmod +x ~/projects/def-pi/genai-teachers/scripts/*.py
```

---

## Local Configuration

### Step 1: Install Local Dependencies

On your **local development machine**:

```bash
# Navigate to project directory
cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-"

# Activate your local Python virtual environment (if you have one)
# or install globally

# Install required packages for SSH and HTTP requests
pip install paramiko requests python-dotenv

# Verify installation
python -c "import paramiko; print('paramiko installed')"
python -c "import requests; print('requests installed')"
```

### Step 2: Create Local .env File

```bash
# Copy the example file
cp .env.example .env

# Edit .env file
# On Windows, use notepad or your preferred editor
# On Mac/Linux, use nano or vim
```

Update the following values in `.env`:

```bash
# Enable TamIA
TAMIA_ENABLED=True

# Your TamIA credentials
TAMIA_USERNAME=your_actual_username
TAMIA_SSH_KEY_PATH=C:/Users/YourName/.ssh/id_rsa  # Windows path
# or
TAMIA_SSH_KEY_PATH=/home/yourname/.ssh/id_rsa     # Linux/Mac path

# Your project directory on TamIA
TAMIA_PROJECT_DIR=/home/your_username/projects/def-pi/genai-teachers

# Your AIP account
TAMIA_ACCOUNT=aip-123456

# Keep other defaults as-is
```

**Important:** Never commit `.env` file to git! It should already be in `.gitignore`.

---

## Testing the Setup

### Step 1: Test SSH Connection from Python

Create a test script:

```python
# test_ssh.py
from tamia_config import TAMIA_CONFIG, validate_config
import paramiko

try:
    validate_config()
    print("✓ Configuration is valid")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    ssh.connect(
        hostname=TAMIA_CONFIG['host'],
        username=TAMIA_CONFIG['username'],
        key_filename=TAMIA_CONFIG['ssh_key_path'],
        timeout=30
    )

    stdin, stdout, stderr = ssh.exec_command('hostname')
    print(f"✓ Connected to TamIA: {stdout.read().decode().strip()}")

    ssh.close()

except Exception as e:
    print(f"✗ Error: {e}")
```

Run it:
```bash
cd "EDU RAG"
python test_ssh.py
```

### Step 2: Test Manual Job Submission

SSH to TamIA and manually submit a test job:

```bash
ssh your_username@tamia.alliancecan.ca

# Submit job
cd ~/projects/def-pi/genai-teachers/scripts
sbatch start_inference_server.sh

# Check job status
squeue -u $USER

# You should see:
# JOBID   PARTITION   NAME              USER    ST  TIME  NODES
# 1234567 main        genai-inference   youruser R   0:30  1

# Check job output
tail -f ~/genai-inference-<jobid>.out
```

Wait for the server to start. You should see:
```
============================================================================
Inference server is ready to accept requests
============================================================================
```

### Step 3: Test SSH Tunnel

From your **local machine**, create an SSH tunnel to the running server:

```bash
# Get the node name from TamIA
ssh your_username@tamia.alliancecan.ca "cat ~/projects/def-pi/genai-teachers/connection_info/current_node.txt"

# Example output: node123

# Create tunnel (replace 'node123' with actual node name)
ssh -N -L 8080:node123:8000 your_username@tamia.alliancecan.ca
```

Keep this terminal open. In another terminal, test the connection:

```bash
# Test health endpoint
curl http://localhost:8080/health

# You should get a JSON response:
# {"status":"healthy","model_loaded":true,...}
```

### Step 4: Test Full Integration

From your **local project directory**:

```bash
cd "EDU RAG"
python

# In Python shell:
>>> from tamia_module import get_gpt_response, generate_prompt
>>> prompt = generate_prompt("linear equations", 2)
>>> response = get_gpt_response(prompt)
>>> print(response)
```

If everything works, you should see the generated math problem!

### Step 5: Clean Up Test Job

```bash
# SSH to TamIA
ssh your_username@tamia.alliancecan.ca

# Create STOP_SERVER file to prevent auto-resubmit
touch ~/projects/def-pi/genai-teachers/STOP_SERVER

# Cancel the job
scancel <job_id>
```

---

## Usage

### Starting the System

The system automatically manages nodes! You just need to:

1. **Enable TamIA in .env:**
   ```bash
   TAMIA_ENABLED=True
   ```

2. **Run your application normally:**
   ```bash
   cd "d:\University\Courses\2025_Fall\ECSE_458\GenAI-Teachers-"
   python manage.py runserver
   ```

3. **Make requests through the web interface**

The first request will:
- Spin up a TamIA node (takes 3-5 minutes)
- Load the model
- Process the request
- Return the result

Subsequent requests will:
- Reuse the existing node (fast, ~1-2 seconds)

### Auto-Shutdown Behavior

The node will **automatically shut down** after 1 hour of inactivity to save resources.

To change this timeout, edit `.env`:
```bash
TAMIA_IDLE_SHUTDOWN=7200  # 2 hours instead of 1
```

### Manual Node Management

**Check node status:**
```python
from tamia_module import _check_node_status
state = _check_node_status()
print(state)
```

**Force shutdown:**
```python
from tamia_module import _shutdown_node, _check_node_status
state = _check_node_status()
if state:
    _shutdown_node(state)
```

---

## Troubleshooting

### Issue: "Configuration error: Missing required TamIA configuration"

**Solution:** Make sure `.env` file exists and contains all required fields:
- `TAMIA_USERNAME`
- `TAMIA_PROJECT_DIR`
- `TAMIA_ACCOUNT`

### Issue: "SSH connection failed"

**Possible causes:**
1. SSH key not set up correctly
2. Not connected to internet
3. TamIA is down

**Solution:**
```bash
# Test SSH manually
ssh your_username@tamia.alliancecan.ca

# If that works, check SSH key path in .env
echo $TAMIA_SSH_KEY_PATH
```

### Issue: "Job did not start within 300 seconds"

**Possible causes:**
1. TamIA cluster is busy (long queue)
2. Requesting too many resources
3. AIP account has no allocation left

**Solution:**
```bash
# Check queue status
ssh your_username@tamia.alliancecan.ca "squeue -u $USER"

# Check allocation
ssh your_username@tamia.alliancecan.ca "sshare -U"

# Increase timeout in .env
TAMIA_STARTUP_TIMEOUT=600  # 10 minutes
```

### Issue: "Server did not become ready within 300 seconds"

**Possible causes:**
1. Model loading takes longer than expected (20B model is large)
2. Model path is wrong

**Solution:**
```bash
# Check job output for errors
ssh your_username@tamia.alliancecan.ca "tail -100 ~/genai-inference-*.out"

# Look for model loading errors
# If model path is wrong, check TAMIA_MODEL_PATH in .env
```

### Issue: "Tunnel is dead"

**Possible causes:**
1. SSH tunnel process crashed
2. Network interruption
3. Compute node rebooted

**Solution:**
The system should automatically recreate the tunnel. If not:
```python
from tamia_module import _shutdown_node, _check_node_status, _spin_up_node

# Force recreation
state = _check_node_status()
if state:
    _shutdown_node(state)

# Next request will spin up a new node
```

### Issue: Model name "openai/gpt-oss-20b" not found

**Solution:**
This model name might not exist. Update the model name in:

1. `.env`:
   ```bash
   TAMIA_MODEL_NAME=facebook/opt-20b  # or correct name
   ```

2. Re-download the model on TamIA with the correct name

### Issue: Out of memory on GPUs

**Possible causes:**
1. Model is too large
2. Batch size too big

**Solution:**

Edit `inference_server.py` to use 8-bit quantization:

```python
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    torch_dtype=torch.bfloat16,
    device_map="auto",
    load_in_8bit=True,  # Add this line
)
```

Redeploy:
```bash
scp tamia_scripts/inference_server.py your_username@tamia:~/projects/def-pi/genai-teachers/scripts/
```

### Getting Help

1. **Check logs:**
   ```bash
   # On TamIA
   ssh your_username@tamia.alliancecan.ca
   tail -100 ~/genai-inference-*.out
   tail -100 ~/genai-inference-*.err
   ```

2. **Enable debug mode:**
   In `.env`:
   ```bash
   TAMIA_DEBUG=True
   ```

3. **TamIA Support:**
   - Email: support@tech.alliancecan.ca
   - Documentation: https://docs.alliancecan.ca/wiki/TamIA

---

## Performance Tips

1. **Keep node alive during active use:**
   Set longer idle timeout during development:
   ```bash
   TAMIA_IDLE_SHUTDOWN=7200  # 2 hours
   ```

2. **Monitor resource usage:**
   ```bash
   ssh your_username@tamia.alliancecan.ca "seff <job_id>"
   ```

3. **Use screen/tmux for long jobs:**
   ```bash
   # On TamIA login node
   screen -S tunnel
   # Create tunnel here
   # Detach: Ctrl+A, D
   # Reattach later: screen -r tunnel
   ```

---

## Next Steps

Once setup is complete:

1. **Test with your Django application**
2. **Monitor costs** (check your AIP allocation usage)
3. **Optimize timeouts** based on your usage patterns
4. **Consider scaling** if you need multiple concurrent requests

---

## Summary Checklist

- [ ] TamIA access approved
- [ ] SSH keys configured
- [ ] Project directory created on TamIA
- [ ] Python environment set up
- [ ] Dependencies installed
- [ ] Model downloaded
- [ ] Scripts uploaded and configured
- [ ] Local .env configured
- [ ] SSH connection tested
- [ ] Test job submitted successfully
- [ ] Server health check passed
- [ ] Full integration test passed

**Congratulations!** Your TamIA integration is ready to use! 🎉
