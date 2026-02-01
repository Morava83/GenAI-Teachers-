"""
TamIA Cluster Configuration

This module contains all configuration settings for connecting to and managing
inference nodes on the TamIA cluster.
"""

import os
from dotenv import load_dotenv

load_dotenv()

TAMIA_CONFIG = {
    # TamIA Cluster Connection
    'host': os.getenv('TAMIA_HOST', 'tamia.alliancecan.ca'),
    'username': os.getenv('TAMIA_USERNAME', 'andersw'),
    'ssh_key_path': os.path.expanduser(os.getenv('TAMIA_SSH_KEY_PATH', '~/.ssh/id_ed25519')),

    # TamIA Project Settings
    'project_dir': os.getenv('TAMIA_PROJECT_DIR', ''),
    'account': os.getenv('TAMIA_ACCOUNT', ''),  # Format: aip-xxxxxxx

    # Model Configuration
    'model_name': os.getenv('TAMIA_MODEL_NAME', 'openai/gpt-oss-20b'),
    'model_path': os.getenv('TAMIA_MODEL_PATH', 'models/gpt-oss-20b'),

    # Inference Server Settings
    'inference_port': int(os.getenv('TAMIA_INFERENCE_PORT', '8000')),
    'local_tunnel_port': int(os.getenv('TAMIA_LOCAL_PORT', '8080')),

    # State Management
    'node_state_file': os.path.expanduser(os.getenv('TAMIA_STATE_FILE', '~/.tamia_node_state.json')),

    # Timeouts and Limits
    'job_timeout': int(os.getenv('TAMIA_JOB_TIMEOUT', '86400')),  # 24 hours in seconds
    'idle_shutdown_timeout': int(os.getenv('TAMIA_IDLE_SHUTDOWN', '3600')),  # 1 hour in seconds
    'node_startup_timeout': int(os.getenv('TAMIA_STARTUP_TIMEOUT', '300')),  # 5 minutes
    'server_ready_timeout': int(os.getenv('TAMIA_SERVER_READY_TIMEOUT', '300')),  # 5 minutes
    'request_timeout': int(os.getenv('TAMIA_REQUEST_TIMEOUT', '120')),  # 2 minutes

    # SLURM Job Settings
    'job_name': os.getenv('TAMIA_JOB_NAME', 'genai-inference'),
    'gpus': os.getenv('TAMIA_GPUS', 'h100:4'),
    'cpus': int(os.getenv('TAMIA_CPUS', '48')),
    'memory': os.getenv('TAMIA_MEMORY', '200G'),

    # Feature Flags
    'enabled': os.getenv('TAMIA_ENABLED', 'False').lower() == 'true',
    'auto_shutdown': os.getenv('TAMIA_AUTO_SHUTDOWN', 'True').lower() == 'true',
    'debug': os.getenv('TAMIA_DEBUG', 'False').lower() == 'true',
}

def validate_config():
    """Validate that required configuration is set"""
    required_fields = ['username', 'project_dir', 'account']
    missing = [field for field in required_fields if not TAMIA_CONFIG[field]]

    if missing and TAMIA_CONFIG['enabled']:
        raise ValueError(
            f"Missing required TamIA configuration: {', '.join(missing)}. "
            f"Please set environment variables: {', '.join(f'TAMIA_{field.upper()}' for field in missing)}"
        )

    return True
