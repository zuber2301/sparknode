from celery import Celery
import subprocess
import os
import redis
import logging
import shlex

celery_app = Celery('sparknode_control', broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

SCRIPT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scripts"))

def stream_log(deployment_id, message, step=None):
    # Live broadcast via Redis Pub/Sub (for WebSockets)
    payload = f"{step or 'INFO'}: {message}"
    r.publish(f"deployment_logs:{deployment_id}", payload)
    
    # Persistent store in DB (pseudo)
    logging.info(f"[{deployment_id}] {payload}")

@celery_app.task(bind=True)
def run_deployment_v2(self, deployment_id, env_id, release_tag, host=None, provider=None):
    """
    Control Plane Execution Engine - Wraps the physical shell scripts
    """
    stream_log(deployment_id, f"Initializing deployment sequence for {env_id}...", "INIT")
    
    # 1. Map environment to targets (In a real DB, this would be looked up)
    # Using defaults if not provided
    target_host = host or "localhost" 
    target_provider = provider or "aws"
    
    # 2. Execute provider-specific deploy script
    # Map to new split scripts: deploy_aws.sh, deploy_azure.sh, deploy_gcp.sh
    script_name = f"deploy_{target_provider.lower()}.sh"
    deploy_script = os.path.join(SCRIPT_DIR, script_name)
    
    # Check if provider script exists, fallback to generic deploy.sh
    if not os.path.exists(deploy_script):
        stream_log(deployment_id, f"Provider script {script_name} not found, falling back to deploy.sh", "WARN")
        deploy_script = os.path.join(SCRIPT_DIR, "deploy.sh")
    
    cmd = [
        "bash", deploy_script,
        "--host", target_host,
        "--version", release_tag
    ]
    
    stream_log(deployment_id, f"Executing: {' '.join(cmd)}", "DEPLOYING")
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )

    if process.stdout:
        for line in process.stdout:
            stream_log(deployment_id, line.strip())

    process.wait()
    
    if process.returncode == 0:
        stream_log(deployment_id, "Deployment script completed successfully.", "SUCCESS")
        return {"status": "SUCCESS", "deployment_id": deployment_id}
    else:
        stream_log(deployment_id, f"Deployment failed with exit code {process.returncode}", "FAILED")
        return {"status": "FAILED", "deployment_id": deployment_id}

@celery_app.task(bind=True)
def run_rollback(self, deployment_id, env_id):
    """Rollback wrapper"""
    stream_log(deployment_id, f"Initiating rollback for {env_id}...", "ROLLBACK")
    rollback_script = os.path.join(SCRIPT_DIR, "rollback.sh")
    # ... implementation similar to deploy ...
