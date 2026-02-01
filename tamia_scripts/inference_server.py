#!/usr/bin/env python3
"""
TamIA Inference Server

FastAPI server that runs on TamIA compute nodes and serves inference requests
for the GPT-OSS-20B model.

This server:
- Loads the model once at startup
- Accepts POST requests with prompts
- Returns generated text
- Provides health check endpoint
"""

import os
import sys
import argparse
import logging
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import uvicorn

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(title="TamIA Math Problem Generator Inference Server")

# Global model and tokenizer
model = None
tokenizer = None
device = None


class GenerateRequest(BaseModel):
    """Request model for generation endpoint"""
    prompt: str
    max_tokens: int = 2000
    temperature: float = 0.7
    top_p: float = 0.9
    do_sample: bool = True


class GenerateResponse(BaseModel):
    """Response model for generation endpoint"""
    response: str
    prompt_length: int
    response_length: int


class HealthResponse(BaseModel):
    """Response model for health check endpoint"""
    status: str
    model_loaded: bool
    device: str
    gpu_count: int
    gpu_memory_allocated: dict


@app.on_event("startup")
async def load_model():
    """Load model and tokenizer at server startup"""
    global model, tokenizer, device

    logger.info("=" * 80)
    logger.info("Starting TamIA Inference Server")
    logger.info("=" * 80)

    # Get model path from environment variable
    model_path = os.environ.get('MODEL_PATH', '/model')

    if not os.path.exists(model_path):
        logger.error(f"Model path does not exist: {model_path}")
        sys.exit(1)

    logger.info(f"Model path: {model_path}")

    # Check CUDA availability
    if not torch.cuda.is_available():
        logger.error("CUDA is not available! This server requires GPU.")
        sys.exit(1)

    device_count = torch.cuda.device_count()
    logger.info(f"CUDA is available with {device_count} GPU(s)")

    for i in range(device_count):
        gpu_name = torch.cuda.get_device_name(i)
        logger.info(f"  GPU {i}: {gpu_name}")

    # Set device
    device = "cuda"

    try:
        # Load tokenizer
        logger.info("Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_path)

        # Add padding token if not present
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        logger.info("Tokenizer loaded successfully")

        # Load model with optimizations for H100
        logger.info("Loading model (this may take several minutes)...")
        logger.info("Using bfloat16 precision for H100 GPUs")

        model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.bfloat16,  # Use bfloat16 for H100 efficiency
            device_map="auto",  # Automatically distribute across GPUs
            low_cpu_mem_usage=True,
        )

        logger.info("Model loaded successfully")

        # Print memory usage
        for i in range(torch.cuda.device_count()):
            allocated = torch.cuda.memory_allocated(i) / 1024**3
            reserved = torch.cuda.memory_reserved(i) / 1024**3
            logger.info(f"GPU {i} Memory - Allocated: {allocated:.2f}GB, Reserved: {reserved:.2f}GB")

        logger.info("=" * 80)
        logger.info("Inference server is ready to accept requests")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Failed to load model: {e}", exc_info=True)
        sys.exit(1)


@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """
    Generate text based on the provided prompt.

    Args:
        request: GenerateRequest with prompt and generation parameters

    Returns:
        GenerateResponse with generated text
    """

    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    try:
        logger.info(f"Received generation request (prompt length: {len(request.prompt)} chars)")

        # Tokenize input
        inputs = tokenizer(
            request.prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=2048
        ).to(device)

        prompt_length = inputs['input_ids'].shape[1]
        logger.info(f"Prompt tokens: {prompt_length}")

        # Generate
        logger.info("Generating response...")
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

        # Decode output
        # Only decode the newly generated tokens (not the prompt)
        generated_tokens = outputs[0][prompt_length:]
        response_text = tokenizer.decode(generated_tokens, skip_special_tokens=True)

        response_length = len(generated_tokens)
        logger.info(f"Generated {response_length} tokens")

        return GenerateResponse(
            response=response_text,
            prompt_length=prompt_length,
            response_length=response_length
        )

    except Exception as e:
        logger.error(f"Error during generation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.get("/health", response_model=HealthResponse)
async def health():
    """
    Health check endpoint.

    Returns:
        HealthResponse with server status
    """

    gpu_memory = {}
    if torch.cuda.is_available():
        for i in range(torch.cuda.device_count()):
            allocated = torch.cuda.memory_allocated(i) / 1024**3
            reserved = torch.cuda.memory_reserved(i) / 1024**3
            gpu_memory[f"gpu_{i}"] = {
                "allocated_gb": round(allocated, 2),
                "reserved_gb": round(reserved, 2)
            }

    return HealthResponse(
        status="healthy",
        model_loaded=model is not None,
        device=str(device) if device else "none",
        gpu_count=torch.cuda.device_count() if torch.cuda.is_available() else 0,
        gpu_memory_allocated=gpu_memory
    )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "TamIA Math Problem Generator Inference Server",
        "endpoints": {
            "/generate": "POST - Generate text from prompt",
            "/health": "GET - Health check",
        }
    }


def main():
    """Main entry point"""

    parser = argparse.ArgumentParser(description="TamIA Inference Server")
    parser.add_argument(
        '--model-path',
        type=str,
        default=os.environ.get('MODEL_PATH', '/model'),
        help='Path to model directory'
    )
    parser.add_argument(
        '--host',
        type=str,
        default='0.0.0.0',
        help='Host to bind to'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='Port to bind to'
    )
    parser.add_argument(
        '--workers',
        type=int,
        default=1,
        help='Number of worker processes (keep at 1 for GPU)'
    )

    args = parser.parse_args()

    # Set model path in environment for startup handler
    os.environ['MODEL_PATH'] = args.model_path

    logger.info(f"Starting server on {args.host}:{args.port}")

    # Run server
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        workers=args.workers,
        log_level="info"
    )


if __name__ == "__main__":
    main()
