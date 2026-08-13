#!/usr/bin/env python3
"""
Arbutus Inference Server

FastAPI server that runs persistently on an Arbutus cloud VM (managed by
systemd) and serves inference requests for the configured causal-LM model.

Differences from the old Rorqual variant:
- Always-on lifecycle (no SLURM); systemd handles restarts.
- Optional X-API-Key header for shared-secret auth (recommended whenever the
  security group allows non-VPN traffic).
- CORS enabled so a browser-based frontend can reach the server directly when
  using a floating IP.
"""

import os
import sys
import argparse
import logging
import torch
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import uvicorn

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Arbutus Math Problem Generator Inference Server")

# CORS - lock down via ARBUTUS_CORS_ORIGINS in production (comma-separated).
_cors_origins_env = os.environ.get('ARBUTUS_CORS_ORIGINS', '*')
_cors_origins = [o.strip() for o in _cors_origins_env.split(',') if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

model = None
tokenizer = None
device = None
EXPECTED_API_KEY = os.environ.get('ARBUTUS_API_KEY', '').strip()


class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 2000
    temperature: float = 0.7
    top_p: float = 0.9
    do_sample: bool = True


class GenerateResponse(BaseModel):
    response: str
    prompt_length: int
    response_length: int


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    gpu_count: int
    gpu_memory_allocated: dict


def _check_api_key(x_api_key: str | None):
    if not EXPECTED_API_KEY:
        return
    if x_api_key != EXPECTED_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@app.on_event("startup")
async def load_model():
    global model, tokenizer, device

    logger.info("=" * 80)
    logger.info("Starting Arbutus Inference Server")
    logger.info("=" * 80)

    model_path = os.environ.get('MODEL_PATH', '/opt/genai/model')
    if not os.path.exists(model_path):
        logger.error(f"Model path does not exist: {model_path}")
        sys.exit(1)
    logger.info(f"Model path: {model_path}")

    if not torch.cuda.is_available():
        logger.error("CUDA is not available. This server requires a GPU-enabled flavor.")
        sys.exit(1)

    device_count = torch.cuda.device_count()
    logger.info(f"CUDA available with {device_count} GPU(s)")
    for i in range(device_count):
        logger.info(f"  GPU {i}: {torch.cuda.get_device_name(i)}")

    device = "cuda"

    try:
        logger.info("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            model_path,
            use_fast=False,
            trust_remote_code=True,
            legacy=False,
        )
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        logger.info("Tokenizer loaded")

        logger.info("Loading model (this may take several minutes)...")
        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            low_cpu_mem_usage=True,
        )
        logger.info("Model loaded")

        for i in range(torch.cuda.device_count()):
            allocated = torch.cuda.memory_allocated(i) / 1024 ** 3
            reserved = torch.cuda.memory_reserved(i) / 1024 ** 3
            logger.info(f"GPU {i} memory - allocated: {allocated:.2f}GB, reserved: {reserved:.2f}GB")

        logger.info("Inference server ready")

    except Exception as e:
        logger.error(f"Failed to load model: {e}", exc_info=True)
        sys.exit(1)


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest, x_api_key: str | None = Header(default=None)):
    _check_api_key(x_api_key)

    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    try:
        logger.info(f"Generation request (prompt: {len(request.prompt)} chars)")

        inputs = tokenizer(
            request.prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=2048,
        ).to(device)

        prompt_length = inputs['input_ids'].shape[1]

        with torch.no_grad():
            outputs = model.generate(
                inputs['input_ids'],
                attention_mask=inputs.get('attention_mask'),
                max_new_tokens=request.max_tokens,
                temperature=request.temperature,
                top_p=request.top_p,
                do_sample=request.do_sample,
                pad_token_id=tokenizer.pad_token_id,
                eos_token_id=tokenizer.eos_token_id,
            )

        generated_tokens = outputs[0][prompt_length:]
        response_text = tokenizer.decode(generated_tokens, skip_special_tokens=True)

        return GenerateResponse(
            response=response_text,
            prompt_length=prompt_length,
            response_length=len(generated_tokens),
        )

    except Exception as e:
        logger.error(f"Error during generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@app.get("/health", response_model=HealthResponse)
async def health():
    gpu_memory = {}
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            gpu_memory[f"gpu_{i}"] = {
                "allocated_gb": round(torch.cuda.memory_allocated(i) / 1024 ** 3, 2),
                "reserved_gb": round(torch.cuda.memory_reserved(i) / 1024 ** 3, 2),
            }

    return HealthResponse(
        status="healthy" if model is not None else "loading",
        model_loaded=model is not None,
        device=str(device) if device else "none",
        gpu_count=torch.cuda.device_count() if torch.cuda.is_available() else 0,
        gpu_memory_allocated=gpu_memory,
    )


@app.get("/")
async def root():
    return {
        "message": "Arbutus Math Problem Generator Inference Server",
        "endpoints": {
            "/generate": "POST - Generate text from prompt (requires X-API-Key if configured)",
            "/health": "GET - Health check",
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Arbutus Inference Server")
    parser.add_argument('--model-path', type=str,
                        default=os.environ.get('MODEL_PATH', '/opt/genai/model'))
    parser.add_argument('--host', type=str, default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--workers', type=int, default=1)
    args = parser.parse_args()

    os.environ['MODEL_PATH'] = args.model_path
    logger.info(f"Starting server on {args.host}:{args.port}")

    uvicorn.run(app, host=args.host, port=args.port, workers=args.workers, log_level="info")


if __name__ == "__main__":
    main()
