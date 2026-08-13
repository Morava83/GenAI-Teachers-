# Arbutus Inference Server

Persistent deployment of the GenAI inference server on the Digital Research
Alliance's **Arbutus** OpenStack cloud. Replaces the previous Rorqual SLURM
deployment in [`rorqual_scripts/`](../rorqual_scripts/).

## Why this changed

| Aspect            | Rorqual (HPC, SLURM)                 | Arbutus (OpenStack VM, this dir) |
|-------------------|--------------------------------------|----------------------------------|
| Lifetime          | Ephemeral job, 24h max, auto-resub.  | Persistent VM, always on         |
| Access            | Login node → compute node (2-hop)    | Direct SSH / floating IP         |
| Server start      | `sbatch start_inference_server.sh`   | `systemctl start genai-inference`|
| Client logic      | Submit job, wait, tunnel, query      | Just hit the URL                 |
| Idle handling     | Auto-shutdown after 1h               | Not needed                       |

The Python client lives in [`EDU RAG/arbutus_module.py`](../EDU%20RAG/arbutus_module.py) and is configured via `.env` (see [`.env.example`](../.env.example)).

## VM provisioning (one time)

1. **Launch the VM in Arbutus** via the OpenStack dashboard or CLI:
   - Image: Ubuntu 22.04 LTS (or the GPU-image variant if you want the NVIDIA driver pre-installed).
   - Flavor: a `g*` GPU flavor sized for the model. Mistral-7B in bf16 fits in ~16 GB VRAM, so a single-GPU flavor is fine. You probably want at least 32 GB system RAM and 100 GB disk for the model + cache.
   - Key pair: your SSH key.
   - Security group: open inbound TCP 22 (SSH) from your IP, and TCP 8000 (or whatever you set as `PORT`) from whoever needs to query the server. **Do not open 8000 to 0.0.0.0/0 without setting `ARBUTUS_API_KEY`.**
   - Optional: assign a floating IP so the VM has a stable public address.
   - Optional: attach a persistent volume mounted at `/opt/genai` if you want the model to survive instance rebuilds.

2. **Install the NVIDIA driver** if your image does not already include it. Verify with `nvidia-smi`. (If you used the Alliance's CUDA-ready image, skip this.)

3. **Copy this folder to the VM and run the installer:**
   ```bash
   scp -r arbutus_scripts ubuntu@<vm-ip>:/tmp/
   ssh ubuntu@<vm-ip>
   sudo bash /tmp/arbutus_scripts/setup_vm.sh
   ```

   For gated models (e.g. Llama), pass an HF token:
   ```bash
   sudo HF_TOKEN=hf_xxx bash /tmp/arbutus_scripts/setup_vm.sh
   ```

   To use a different model, override `MODEL_ID`:
   ```bash
   sudo MODEL_ID=mistralai/Mistral-7B-Instruct-v0.3 bash /tmp/arbutus_scripts/setup_vm.sh
   ```

4. **Set the API key** on the VM:
   ```bash
   sudo nano /etc/genai/inference.env
   # set ARBUTUS_API_KEY=<long random string>
   sudo systemctl restart genai-inference
   ```

5. **Verify the server is up:**
   ```bash
   curl http://localhost:8000/health
   journalctl -u genai-inference -f   # follow startup logs
   ```

   The first start downloads and loads the model — expect several minutes
   before `/health` reports `"status": "healthy"`.

## Local client setup

Edit your `.env` (in the repo root) using `.env.example` as a template:

```
ARBUTUS_ENABLED=True
ARBUTUS_HOST=<floating-ip-or-dns>
ARBUTUS_PORT=8000
ARBUTUS_API_KEY=<same-long-random-string>
```

If you prefer not to expose port 8000 publicly, leave the security group closed and use an SSH tunnel instead:

```bash
ssh -N -L 8000:localhost:8000 ubuntu@<vm-ip>
```

Then point the client at the tunnel:

```
ARBUTUS_HOST=127.0.0.1
ARBUTUS_PORT=8000
```

## Day-to-day operations

| Task                        | Command (on the VM)                                    |
|-----------------------------|--------------------------------------------------------|
| Status                      | `systemctl status genai-inference`                     |
| Live logs                   | `journalctl -u genai-inference -f`                     |
| Restart                     | `sudo systemctl restart genai-inference`               |
| Stop                        | `sudo systemctl stop genai-inference`                  |
| Update server code          | run `bash arbutus_scripts/deploy.sh` from your laptop  |
| Change model / port / key   | edit `/etc/genai/inference.env`, then restart          |
| Re-download model           | `sudo rm -rf /opt/genai/model && sudo bash setup_vm.sh`|

## Troubleshooting

- **`/health` returns 503** — model is still loading. Watch `journalctl`.
- **`CUDA is not available`** in logs — the VM has no GPU passthrough or the driver is not installed. Run `nvidia-smi` to confirm.
- **Client gets ConnectionError** — confirm the VM's security group allows your source IP, that the service is running (`systemctl status genai-inference`), and that `ARBUTUS_HOST` / `ARBUTUS_PORT` match.
- **Client gets HTTP 401** — `ARBUTUS_API_KEY` differs between the VM (`/etc/genai/inference.env`) and the laptop (`.env`).
- **Out-of-memory at load time** — pick a larger GPU flavor, or switch to a smaller model via `MODEL_ID`.
