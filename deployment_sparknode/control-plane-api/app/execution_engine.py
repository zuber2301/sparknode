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
def run_deployment_v2(self, deployment_id, env_id, release_tag, host=None, provider=None, config=None, skip_infra=False, mode="new"):
    """
    Control Plane Execution Engine - Wraps the physical shell scripts
    """
    stream_log(deployment_id, f"Initializing {mode} sequence for {env_id}...", "INIT")
    
    # 1. Map environment to targets
    target_host = host or "localhost" 
    target_provider = provider or "aws"
    
    # 2. Prepare environment variables for the script (TF_VAR_*)
    env_vars = os.environ.copy()
    
    # Standard Metadata for ALL providers
    env_vars["TF_VAR_project_name"] = "sparknode"
    env_vars["TF_VAR_environment"] = env_id or "dev"
    env_vars["ENVIRONMENT"] = env_id or "dev" # For shell script logic

    if config:
        # Map generic 'region' to provider-specific TF variables
        region = config.get("region")
        if region:
            if target_provider.lower() == "aws":
                env_vars["TF_VAR_aws_region"] = region
            elif target_provider.lower() == "azure":
                env_vars["TF_VAR_azure_location"] = region
            elif target_provider.lower() == "gcp":
                env_vars["TF_VAR_region"] = region

        for key, value in config.items():
            if key == "region": continue # Handled above
            env_vars[f"TF_VAR_{key}"] = str(value)
            stream_log(deployment_id, f"Injected TF_VAR_{key} from UI config", "CONFIG")
            
    if skip_infra:
        env_vars["SKIP_TERRAFORM"] = "true"
        stream_log(deployment_id, "Injected SKIP_TERRAFORM=true (Bypassing Phase 1)", "CONFIG")

    # 3. Execute provider-specific deploy script
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

    # Target logic for "New" (VM only) vs "Update" (Full)
    if mode == "new":
        # We append -target flags for VM components to the terraform calls indirectly
        # or handle via shell script environment.
        env_vars["TF_TARGET_VM_ONLY"] = "true"
        stream_log(deployment_id, "Targeting VM components ONLY for new provision", "TARGET")
    
    stream_log(deployment_id, f"Executing: {' '.join(cmd)}", "DEPLOYING")
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True,
        env=env_vars
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
def run_rollback_v2(self, deployment_id, env_id, provider=None):
    """
    Rollback logic - wraps deploy_{provider}_rollback.sh scripts
    """
    stream_log(deployment_id, f"Initiating rollback sequence for {env_id}...", "ROLLBACK")
    
    target_provider = provider or "aws"
    script_name = f"deploy_{target_provider.lower()}_rollback.sh"
    rollback_script = os.path.join(SCRIPT_DIR, script_name)
    
    # Check if rollback script exists
    if not os.path.exists(rollback_script):
        stream_log(deployment_id, f"Rollback script {script_name} not found, failing.", "ERROR")
        return {"status": "FAILED", "error": "Script not found"}

    cmd = ["bash", rollback_script]
    stream_log(deployment_id, f"Executing: {' '.join(cmd)}", "ROLLING_BACK")
    
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
        stream_log(deployment_id, "Rollback successful.", "SUCCESS")
        return {"status": "SUCCESS", "deployment_id": deployment_id}
    else:
        stream_log(deployment_id, f"Rollback failed with exit code {process.returncode}", "FAILED")
        return {"status": "FAILED", "deployment_id": deployment_id}
