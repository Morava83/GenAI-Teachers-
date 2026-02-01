"""
Rorqual Module - Drop-in replacement for gpt_module.py

This module provides the same interface as gpt_module.py but routes requests
to a persistent inference server running on the Rorqual cluster.

Features:
- Automatically checks if an inference node is running
- Spins up a new node if none exists
- Auto-shutdown after 1 hour of inactivity
- Fault-tolerant with automatic recovery
"""

import os
import json
import time
import logging
import subprocess
import paramiko
import requests
from datetime import datetime, timedelta
from typing import Optional, Dict
from dotenv import load_dotenv
from rorqual_config import RORQUAL_CONFIG, validate_config

load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO if RORQUAL_CONFIG['debug'] else logging.WARNING)
logger = logging.getLogger(__name__)

# Global SSH client for reuse (avoids repeated MFA)
_ssh_client = None


def _get_or_create_ssh():
    """
    Get existing SSH client or create new one (reuses connection to avoid MFA on every call).

    Returns:
        paramiko.SSHClient
    """
    global _ssh_client

    # Return existing client if still connected
    if _ssh_client is not None:
        try:
            # Test if connection is still alive
            transport = _ssh_client.get_transport()
            if transport and transport.is_active():
                return _ssh_client
        except:
            pass

        # Connection is dead, close it
        try:
            _ssh_client.close()
        except:
            pass
        _ssh_client = None

    # Create new connection
    logger.info("Establishing new SSH connection (may require MFA approval on your phone)...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    ssh.connect(
        hostname=RORQUAL_CONFIG['host'],
        username=RORQUAL_CONFIG['username'],
        key_filename=RORQUAL_CONFIG['ssh_key_path'],
        timeout=60  # Longer timeout for MFA approval
    )

    _ssh_client = ssh
    logger.info("SSH connection established successfully")
    return _ssh_client


def _run_ssh_command(command):
    """
    Run SSH command using persistent connection (reuses SSH client to avoid repeated MFA).

    Args:
        command: Command to run on remote host

    Returns:
        tuple: (stdout, stderr, exit_code)
    """
    try:
        ssh = _get_or_create_ssh()
        stdin, stdout, stderr = ssh.exec_command(command, timeout=30)

        out = stdout.read().decode()
        err = stderr.read().decode()
        exit_code = stdout.channel.recv_exit_status()

        return out, err, exit_code
    except Exception as e:
        logger.error(f"SSH command failed: {e}")
        raise RuntimeError(f"SSH command failed: {e}")

# Global tunnel process
_tunnel_process = None


def generate_prompt(content, dok_level):
    """
    Generates a detailed prompt for the model based on the educational content and DOK level.

    This function is kept identical to gpt_module.py for compatibility.

    Args:
        content (str): Educational content or topic from which to generate a math problem.
        dok_level (int): Desired Depth of Knowledge level (1-4).

    Returns:
        str: A fully formed prompt including detailed instructions and examples.
    """

    # Define DOK level details
    dok_details = {
        1: {
            'description': 'Mathematical Recall and Reproduction: Tasks at this level require students to recall facts, definitions, or procedures.',
            'examples': 'Apply a well-known algorithm, Identify a plane or three-dimensional figure, Perform a specified or routine procedure.',
            'math_example': 'The price of gasoline was $2.159 per gallon last week. This week the new price is $2.319 per gallon. Determine the percent of increase.',
            'reasoning': 'Students will identify a transformation within a plane.'
        },
        2: {
            'description': 'Mathematical Skills and Concepts: Tasks at this level involve some mental processing beyond recalling or reproducing a response.',
            'examples': 'Solve a routine problem requiring multiple steps, or the application of multiple concepts, interpreting data, explaining relationships between concepts.',
            'math_example': 'On a trip across the country, Justin determined that he would have to drive about 2,763 miles. What speed would he have to average to complete the trip in no more than 50 hours of driving time?',
            'reasoning': 'Students will perform a compound transformation of a geometric figure within a coordinate plane.'
        },
        3: {
            'description': 'Mathematical Strategic Thinking: Tasks at this level require deep understanding and reasoning, planning, and using evidence.',
            'examples': 'Interpret information from a complex graph, Develop logical arguments for a concept, Solve a multiple-step problem, supported with a mathematical explanation that justifies the answer.',
            'math_example': 'A sweater that you really want has just been placed on sale. The original cost was $63.99. The sale price is $47.99. What is the percent of decrease from the original price? You still do not have enough money saved up to purchase the sweater, so you wait just a little longer and the store now has an ad that states that all items currently on sale have been reduced by 1/3 of the sale price. What is the new sale price?',
            'reasoning': 'Students will perform a geometric transformation to meet specified criteria and then explain what does or does not change about the figure.'
        },
        4: {
            'description': 'Mathematical Extended Thinking: Tasks at this level require complex reasoning, planning, developing, and thinking over an extended period of time.',
            'examples': 'Relate mathematical concepts to real-world applications in new situations, Design a mathematical model to inform and solve a practical or abstract situation.',
            'math_example': 'Students will visit three local grocery stores and find the prices of three different sizes of the same product at the three stores. Students will then determine the unit price for each size item at each store and make a decision as to which is the best buy. Students will then write a report chronicling their work and reporting which is the best buy, justifying their decision with their mathematical work.',
            'reasoning': 'Students will abstract the transformations occurring in an Escher woodprint and then create a simplified tessellation of their own.'
        }
    }

    if dok_level in dok_details:
        dok_info = dok_details[dok_level]
        # Construct the full prompt
        prompt = f"Generate a math problem based on the following content: {content}\n" \
                f"Ensure the problem aligns with a Depth of Knowledge level {dok_level}, which requires {dok_info['description']}\n" \
                f"Example of this level: {dok_info['math_example']}\n" \
                f"Reasoning required: {dok_info['reasoning']}"
    else:
        prompt = f"There is no DOK level {dok_level} available. Please select a valid level (1-4)."

    return prompt


def _openai_fallback(prompt):
    """
    Fallback to OpenAI API when Rorqual is disabled.

    Args:
        prompt (str): The prompt to send

    Returns:
        str: The model's response
    """
    try:
        from openai import OpenAI

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return "Error: OPENAI_API_KEY not set in environment variables."

        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a helpful math tutor. Generate clear, educational math problems with detailed solutions."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )

        return response.choices[0].message.content.strip()

    except ImportError:
        return "Error: OpenAI package not installed. Run: pip install openai"
    except Exception as e:
        logger.error(f"OpenAI fallback error: {e}", exc_info=True)
        return f"Error using OpenAI fallback: {str(e)}"


def get_gpt_response(prompt, client=None):
    """
    Drop-in replacement for gpt_module.get_gpt_response()

    Routes requests to Rorqual inference server instead of OpenAI API.
    Automatically manages node lifecycle (spin up, shutdown, recovery).

    Args:
        prompt (str): The prompt to send to the model
        client: Ignored (kept for API compatibility with gpt_module)

    Returns:
        str: The model's response
    """

    if not RORQUAL_CONFIG['enabled']:
        logger.info("Rorqual is disabled. Using OpenAI fallback.")
        return _openai_fallback(prompt)

    # Validate configuration
    try:
        validate_config()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return f"Configuration error: {e}"

    try:
        # 1. Check if node is running and healthy
        state = _check_node_status()

        # 2. Check if node should be shut down due to inactivity
        if state and _should_shutdown_node(state):
            logger.info("Node has been idle for >1 hour. Shutting down...")
            _shutdown_node(state)
            state = None

        # 3. If no node or node is unhealthy, spin up new one
        if state is None:
            logger.info("No running node found. Spinning up new Rorqual node...")
            state = _spin_up_node()
            logger.info(f"Node ready: job_id={state['job_id']}, node={state['node_name']}")
        else:
            logger.info(f"Using existing node: job_id={state['job_id']}")

        # 4. Query the server
        response = _query_inference_server(prompt, state['tunnel_port'])

        # 5. Update last_used timestamp
        state['last_used'] = datetime.now().isoformat()
        _save_state(state)

        return response

    except Exception as e:
        logger.error(f"Error in get_gpt_response: {e}", exc_info=True)

        # Try to recover by spinning up new node
        try:
            logger.info("Attempting to recover by spinning up new node...")
            state = _spin_up_node()
            response = _query_inference_server(prompt, state['tunnel_port'])

            state['last_used'] = datetime.now().isoformat()
            _save_state(state)

            return response
        except Exception as recovery_error:
            logger.error(f"Recovery failed: {recovery_error}", exc_info=True)
            return f"Failed to generate response due to Rorqual error: {str(e)}"


def _check_node_status() -> Optional[Dict]:
    """
    Check if inference server job is running and healthy.

    Returns:
        Dict with job state if running and healthy, None otherwise
    """

    # 1. Check if state file exists
    if not os.path.exists(RORQUAL_CONFIG['node_state_file']):
        logger.debug("No state file found")
        return None

    # 2. Load state
    try:
        with open(RORQUAL_CONFIG['node_state_file'], 'r') as f:
            state = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.warning(f"Failed to load state file: {e}")
        return None

    job_id = state.get('job_id')
    if not job_id:
        return None

    # 3. SSH to Rorqual/Rorqual and check if job is still running
    try:
        output, stderr, returncode = _run_ssh_command(f'squeue -j {job_id} -h -o "%T"')
        job_state = output.strip()

        if not job_state:
            logger.info(f"Job {job_id} is no longer in queue")
            return None

        if job_state not in ['RUNNING', 'R']:
            logger.info(f"Job {job_id} is in state {job_state}, not RUNNING")
            return None

    except Exception as e:
        logger.warning(f"Failed to check job status: {e}")
        return None

    # 4. Check if SSH tunnel is alive
    if not _tunnel_is_alive(state.get('tunnel_port')):
        logger.info("SSH tunnel is dead. Attempting to recreate...")
        try:
            _create_ssh_tunnel(state['node_name'], state['tunnel_port'])
        except Exception as e:
            logger.error(f"Failed to recreate tunnel: {e}")
            return None

    # 5. Check if server is healthy
    if not _check_server_health(state.get('tunnel_port')):
        logger.warning("Server health check failed")
        return None

    return state


def _should_shutdown_node(state: Dict) -> bool:
    """
    Check if node should be shut down due to inactivity.

    Args:
        state: Current node state

    Returns:
        True if node should be shut down, False otherwise
    """

    if not RORQUAL_CONFIG['auto_shutdown']:
        return False

    last_used = datetime.fromisoformat(state.get('last_used', state.get('started_at')))
    idle_time = (datetime.now() - last_used).total_seconds()

    return idle_time > RORQUAL_CONFIG['idle_shutdown_timeout']


def _shutdown_node(state: Dict):
    """
    Shutdown the inference node and clean up resources.

    Args:
        state: Current node state
    """

    job_id = state.get('job_id')

    try:
        # 1. Cancel SLURM job
        _run_ssh_command(f'scancel {job_id}')

        # 2. Create STOP_SERVER file to prevent auto-resubmit
        project_dir = RORQUAL_CONFIG['project_dir']
        _run_ssh_command(f'touch {project_dir}/STOP_SERVER')

        logger.info(f"Shutdown job {job_id}")

    except Exception as e:
        logger.error(f"Error shutting down node: {e}")

    # 3. Kill SSH tunnel
    global _tunnel_process
    if _tunnel_process:
        try:
            _tunnel_process.terminate()
            _tunnel_process.wait(timeout=5)
        except Exception as e:
            logger.warning(f"Error terminating tunnel: {e}")
            try:
                _tunnel_process.kill()
            except:
                pass
        _tunnel_process = None

    # 4. Remove state file
    try:
        os.remove(RORQUAL_CONFIG['node_state_file'])
    except Exception as e:
        logger.warning(f"Failed to remove state file: {e}")


def _spin_up_node() -> Dict:
    """
    Submit new SLURM job with inference server and wait for it to be ready.

    Returns:
        Dict with job state (job_id, node_name, tunnel_port, etc.)
    """

    try:
        # 1. Remove STOP_SERVER file if it exists
        project_dir = RORQUAL_CONFIG['project_dir']
        _run_ssh_command(f'rm -f {project_dir}/STOP_SERVER')

        # 2. Submit job
        script_path = f"{project_dir}/scripts/start_inference_server.sh"
        output, error, returncode = _run_ssh_command(f'sbatch {script_path}')

        if error:
            logger.warning(f"sbatch stderr: {error}")

        # Parse job ID from output: "Submitted batch job 12345678"
        if 'Submitted batch job' not in output:
            raise RuntimeError(f"Failed to submit job. Output: {output}")

        job_id = output.strip().split()[-1]
        logger.info(f"Submitted job {job_id}")

        # 3. Wait for job to start and get node name
        node_name = _wait_for_job_start(job_id, timeout=RORQUAL_CONFIG['node_startup_timeout'])
        logger.info(f"Job started on node {node_name}")

        # 4. Create SSH tunnel to node
        tunnel_port = RORQUAL_CONFIG['local_tunnel_port']
        _create_ssh_tunnel(node_name, RORQUAL_CONFIG['inference_port'])
        logger.info(f"SSH tunnel created: localhost:{tunnel_port}")

        # 5. Wait for server to be ready
        _wait_for_server_ready(tunnel_port, timeout=RORQUAL_CONFIG['server_ready_timeout'])
        logger.info("Inference server is ready")

        # 6. Save state
        state = {
            'job_id': job_id,
            'node_name': node_name,
            'tunnel_port': tunnel_port,
            'started_at': datetime.now().isoformat(),
            'last_used': datetime.now().isoformat()
        }
        _save_state(state)

        return state

    except Exception as e:
        logger.error(f"Error spinning up node: {e}")
        raise


def _wait_for_job_start(job_id: str, timeout: int = 300) -> str:
    """
    Wait for SLURM job to start and return the node name.

    Args:
        job_id: SLURM job ID
        timeout: Timeout in seconds

    Returns:
        Node name where job is running
    """

    start_time = time.time()

    while time.time() - start_time < timeout:
        output, stderr, returncode = _run_ssh_command(f'squeue -j {job_id} -h -o "%T %N"')
        output = output.strip()

        if not output:
            raise RuntimeError(f"Job {job_id} disappeared from queue")

        parts = output.split()
        if len(parts) >= 2:
            state, node = parts[0], parts[1]

            if state in ['RUNNING', 'R']:
                return node

        time.sleep(5)

    raise TimeoutError(f"Job {job_id} did not start within {timeout} seconds")


def _create_ssh_tunnel(node_name: str, remote_port: int):
    """
    Create SSH tunnel to compute node.

    The tunnel goes: localhost:local_port -> login_node -> compute_node:remote_port

    Args:
        node_name: Name of compute node
        remote_port: Port on compute node where server is running
    """

    global _tunnel_process

    # Kill existing tunnel if any
    if _tunnel_process:
        try:
            _tunnel_process.terminate()
            _tunnel_process.wait(timeout=5)
        except:
            try:
                _tunnel_process.kill()
            except:
                pass

    local_port = RORQUAL_CONFIG['local_tunnel_port']
    username = RORQUAL_CONFIG['username']
    host = RORQUAL_CONFIG['host']
    ssh_key = RORQUAL_CONFIG['ssh_key_path']

    # Create SSH tunnel: local -> login node -> compute node
    # This is a two-hop tunnel since compute nodes aren't directly accessible
    cmd = [
        'ssh', '-N', '-L', f'{local_port}:{node_name}:{remote_port}',
        f'{username}@{host}',
        '-i', ssh_key,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'ServerAliveInterval=60',
        '-o', 'ServerAliveCountMax=3'
    ]

    # Run in background
    _tunnel_process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        stdin=subprocess.PIPE
    )

    # Give tunnel time to establish
    time.sleep(3)

    # Check if tunnel is alive
    if _tunnel_process.poll() is not None:
        raise RuntimeError("SSH tunnel failed to start")


def _tunnel_is_alive(port: int) -> bool:
    """
    Check if SSH tunnel is alive by trying to connect to local port.

    Args:
        port: Local tunnel port

    Returns:
        True if tunnel is alive, False otherwise
    """

    global _tunnel_process

    if _tunnel_process is None or _tunnel_process.poll() is not None:
        return False

    try:
        # Try to connect to the port
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        return result == 0
    except:
        return False


def _check_server_health(port: int) -> bool:
    """
    Check if inference server is healthy by calling /health endpoint.

    Args:
        port: Local tunnel port

    Returns:
        True if server is healthy, False otherwise
    """

    try:
        response = requests.get(f'http://localhost:{port}/health', timeout=5)
        return response.status_code == 200 and response.json().get('status') == 'healthy'
    except:
        return False


def _wait_for_server_ready(port: int, timeout: int = 300):
    """
    Wait for inference server to be ready.

    Args:
        port: Local tunnel port
        timeout: Timeout in seconds
    """

    start_time = time.time()

    while time.time() - start_time < timeout:
        if _check_server_health(port):
            return
        time.sleep(5)

    raise TimeoutError(f"Server did not become ready within {timeout} seconds")


def _query_inference_server(prompt: str, tunnel_port: int) -> str:
    """
    Send request to inference server via SSH tunnel.

    Args:
        prompt: The prompt to send
        tunnel_port: Local tunnel port

    Returns:
        Model's response text
    """

    url = f'http://localhost:{tunnel_port}/generate'
    payload = {
        'prompt': prompt,
        'max_tokens': 2000,
        'temperature': 0.7
    }

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=RORQUAL_CONFIG['request_timeout']
        )
        response.raise_for_status()
        return response.json()['response']

    except requests.exceptions.Timeout:
        raise TimeoutError(f"Request timed out after {RORQUAL_CONFIG['request_timeout']} seconds")
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Request failed: {e}")


def _get_ssh_client():
    """
    Create and return an SSH client connected to Rorqual.

    Returns:
        paramiko.SSHClient connected to Rorqual
    """

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    ssh.connect(
        hostname=RORQUAL_CONFIG['host'],
        username=RORQUAL_CONFIG['username'],
        key_filename=RORQUAL_CONFIG['ssh_key_path'],
        timeout=30
    )

    return ssh


def _save_state(state: Dict):
    """
    Save node state to file.

    Args:
        state: State dict to save
    """

    try:
        with open(RORQUAL_CONFIG['node_state_file'], 'w') as f:
            json.dump(state, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save state: {e}")


# For testing
if __name__ == "__main__":
    content = input("Enter the educational content/topic: ")
    dok_level = int(input("Enter the Depth of Knowledge (DOK) level (1-4): "))

    prompt = generate_prompt(content, dok_level)
    print("\nGenerated Prompt:")
    print(prompt)

    print("\nQuerying Rorqual inference server...")
    response = get_gpt_response(prompt)
    print("\nAI Generated Response:")
    print(response)
