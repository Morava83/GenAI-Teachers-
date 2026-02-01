"""
Rorqual Cluster Configuration

This module contains all configuration settings for connecting to and managing
inference nodes on the Rorqual cluster.
"""

import os
from dotenv import load_dotenv

load_dotenv()

RORQUAL_CONFIG = {
    # Rorqual Cluster Connection
    'host': os.getenv('RORQUAL_HOST', 'rorqual.alliancecan.ca'),
    'username': os.getenv('RORQUAL_USERNAME', 'andersw'),
    'ssh_key_path': os.path.expanduser(os.getenv('RORQUAL_SSH_KEY_PATH', '~/.ssh/id_rsa')),

    # Rorqual Project Settings
    'project_dir': os.getenv('RORQUAL_PROJECT_DIR', ''),
    'account': os.getenv('RORQUAL_ACCOUNT', ''),  # Format: def-xxxxx

    # Model Configuration
    'model_name': os.getenv('RORQUAL_MODEL_NAME', 'openai/gpt-oss-20b'),
    'model_path': os.getenv('RORQUAL_MODEL_PATH', 'models/gpt-oss-20b'),

    # Inference Server Settings
    'inference_port': int(os.getenv('RORQUAL_INFERENCE_PORT', '8000')),
    'local_tunnel_port': int(os.getenv('RORQUAL_LOCAL_PORT', '8080')),

    # State Management
    'node_state_file': os.path.expanduser(os.getenv('RORQUAL_STATE_FILE', '~/.rorqual_node_state.json')),

    # Timeouts and Limits
    'job_timeout': int(os.getenv('RORQUAL_JOB_TIMEOUT', '86400')),  # 24 hours in seconds
    'idle_shutdown_timeout': int(os.getenv('RORQUAL_IDLE_SHUTDOWN', '3600')),  # 1 hour in seconds
    'node_startup_timeout': int(os.getenv('RORQUAL_STARTUP_TIMEOUT', '300')),  # 5 minutes
    'server_ready_timeout': int(os.getenv('RORQUAL_SERVER_READY_TIMEOUT', '300')),  # 5 minutes
    'request_timeout': int(os.getenv('RORQUAL_REQUEST_TIMEOUT', '120')),  # 2 minutes

    # SLURM Job Settings
    'job_name': os.getenv('RORQUAL_JOB_NAME', 'genai-inference'),
    'gpus': os.getenv('RORQUAL_GPUS', 'h100:4'),
    'cpus': int(os.getenv('RORQUAL_CPUS', '48')),
    'memory': os.getenv('RORQUAL_MEMORY', '200G'),

    # Feature Flags
    'enabled': os.getenv('RORQUAL_ENABLED', 'False').lower() == 'true',
    'auto_shutdown': os.getenv('RORQUAL_AUTO_SHUTDOWN', 'True').lower() == 'true',
    'debug': os.getenv('RORQUAL_DEBUG', 'False').lower() == 'true',
}

def validate_config():
    """Validate that required configuration is set"""
    required_fields = ['username', 'project_dir', 'account']
    missing = [field for field in required_fields if not RORQUAL_CONFIG[field]]

    if missing and RORQUAL_CONFIG['enabled']:
        raise ValueError(
            f"Missing required Rorqual configuration: {', '.join(missing)}. "
            f"Please set environment variables: {', '.join(f'RORQUAL_{field.upper()}' for field in missing)}"
        )

    return True
