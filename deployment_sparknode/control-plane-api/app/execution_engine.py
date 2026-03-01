from celery import Celery
import subprocess
import os
import json
import base64
import re
import redis
import logging
import shlex

celery_app = Celery(
    'sparknode_control',
    broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
)
r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))

SCRIPT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../scripts"))
TF_MODULES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../terraform/modules"))

# Node class → provider-specific instance type mapping
NODE_CLASS_MAP = {
    "aws":   {"burstable": "t3.medium",      "production": "m6i.large"},
    "azure": {"burstable": "Standard_B2s",   "production": "Standard_D2s_v3"},
    "gcp":   {"burstable": "e2-medium",       "production": "n2-standard-2"},
}

def stream_log(deployment_id, message, step=None):
    # Live broadcast via Redis Pub/Sub (for WebSockets)
    payload = f"{step or 'INFO'}: {message}"
    r.publish(f"deployment_logs:{deployment_id}", payload)
    logging.info(f"[{deployment_id}] {payload}")


# ─────────────────────────────────────────────────────────────────
# Terraform Plan Task
# Runs terraform init + plan for a given provider/env, streaming
# each log line into a Redis LIST so the UI can poll incrementally.
# Final result is stored as a JSON blob in plan_result:{task_id}.
# ─────────────────────────────────────────────────────────────────
@celery_app.task(bind=True, name='run_terraform_plan')
def run_terraform_plan(self, task_id, env_id, provider, config, mode="new"):
    logs_key    = f"plan_logs:{task_id}"
    result_key  = f"plan_result:{task_id}"
    TTL         = 3600  # logs and result expire after 1 hour

    def push_log(msg, status="info"):
        r.rpush(logs_key, json.dumps({"msg": msg, "status": status}))
        r.expire(logs_key, TTL)
        stream_log(task_id, msg, status)

    terraform_dir = os.path.join(TF_MODULES_DIR, provider)
    # State path is relative from the module directory
    state_rel = f"../../../tfstate/{provider}/{env_id}/terraform.tfstate"

    # Build env vars identical to the old inline implementation
    tf_env = os.environ.copy()
    tf_env["PATH"] = "/usr/local/bin:/usr/bin:/bin:" + tf_env.get("PATH", "")
    tf_env["TF_IN_AUTOMATION"] = "1"
    tf_env["TF_INPUT"] = "0"
    tf_env["TF_VAR_cloud_provider"] = provider
    tf_env["TF_VAR_project_name"] = "sparknode"
    tf_env["TF_VAR_environment"] = env_id
    tf_env["TF_VAR_user_data"] = base64.b64encode(b"#!/bin/bash\necho sparknode").decode()

    region = config.get("region", "")
    if region:
        if provider == "aws":
            tf_env["TF_VAR_aws_region"] = region
            tf_env["AWS_DEFAULT_REGION"] = region
        elif provider == "azure":
            # Azure locations must be lowercase with no hyphens or spaces
            # e.g. "East-US" -> "eastus", "West Europe" -> "westeurope"
            az_location = region.lower().replace("-", "").replace(" ", "")
            tf_env["TF_VAR_azure_location"] = az_location
        elif provider == "gcp":
            tf_env["TF_VAR_gcp_region"] = region
            tf_env["TF_VAR_gcp_zone"]   = region + "-a"
            tf_env["GOOGLE_REGION"]     = region

    # ── Provider-specific auth & sizing ─────────────────────────
    node_class = config.get("node_class", "burstable")

    if provider == "azure":
        tf_env["ARM_TENANT_ID"]       = config.get("tenant_id") or os.getenv("AZURE_TENANT_ID", "")
        tf_env["ARM_SUBSCRIPTION_ID"] = config.get("subscription_id") or os.getenv("AZURE_SUBSCRIPTION_ID", "")
        tf_env["ARM_CLIENT_ID"]       = os.getenv("AZURE_CLIENT_ID", "")
        tf_env["ARM_CLIENT_SECRET"]   = os.getenv("AZURE_CLIENT_SECRET", "")
        tf_env["TF_VAR_azure_tenant_id"]       = tf_env["ARM_TENANT_ID"]
        tf_env["TF_VAR_azure_subscription_id"] = tf_env["ARM_SUBSCRIPTION_ID"]
        tf_env["TF_VAR_azure_client_id"]       = tf_env["ARM_CLIENT_ID"]
        tf_env["TF_VAR_azure_client_secret"]   = tf_env["ARM_CLIENT_SECRET"]
        tf_env["TF_VAR_vm_size"] = NODE_CLASS_MAP["azure"].get(node_class, "Standard_B2s")

    elif provider == "aws":
        tf_env["AWS_ACCESS_KEY_ID"]     = config.get("access_key_id") or os.getenv("AWS_ACCESS_KEY_ID", "")
        tf_env["AWS_SECRET_ACCESS_KEY"] = config.get("secret_access_key") or os.getenv("AWS_SECRET_ACCESS_KEY", "")
        _r = region or "us-east-1"
        tf_env["AWS_DEFAULT_REGION"]    = _r
        tf_env["TF_VAR_aws_region"]     = _r
        tf_env["TF_VAR_availability_zone"] = _r + "a"
        tf_env["TF_VAR_key_name"]       = config.get("key_name") or os.getenv("AWS_KEY_PAIR_NAME", "sparknode-key")
        tf_env["TF_VAR_instance_type"]  = NODE_CLASS_MAP["aws"].get(node_class, "t3.medium")

    elif provider == "gcp":
        gcp_project = config.get("gcp_project_id") or os.getenv("GCP_PROJECT_ID", "")
        tf_env["GOOGLE_PROJECT"]        = gcp_project
        tf_env["TF_VAR_gcp_project_id"] = gcp_project
        _r = region or "us-central1"
        tf_env["TF_VAR_gcp_region"] = _r
        tf_env["TF_VAR_gcp_zone"]   = _r + "-a"
        tf_env["TF_VAR_machine_type"] = NODE_CLASS_MAP["gcp"].get(node_class, "e2-medium")
        tf_env["TF_VAR_ssh_public_key_path"] = os.path.expanduser("~/.ssh/id_rsa.pub")
        gcp_key = os.getenv("GCP_SA_KEY_JSON_PATH", "")
        if gcp_key and os.path.exists(gcp_key):
            tf_env["GOOGLE_APPLICATION_CREDENTIALS"] = gcp_key

    plan_summary = {
        "resources_to_add": 0, "resources_to_change": 0,
        "resources_to_destroy": 0, "resources": []
    }

    def run_cmd(cmd):
        push_log(f"$ {' '.join(cmd)}", "info")
        try:
            proc = subprocess.Popen(
                cmd, cwd=terraform_dir, env=tf_env,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, bufsize=1
            )
            output_lines = []
            for line in proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                output_lines.append(line)
                if any(k in line for k in ["Error", "error", "ERRO"]):
                    push_log(line, "error")
                elif any(k in line for k in ["Warning", "warning"]):
                    push_log(line, "progress")
                else:
                    push_log(line, "info")
            proc.wait()
            return proc.returncode, output_lines
        except FileNotFoundError:
            push_log("ERROR: 'terraform' binary not found in PATH", "error")
            return 1, []

    def finish(status, error=None, plan=None):
        result = {"status": status, "plan": plan or plan_summary, "error": error}
        r.setex(result_key, TTL, json.dumps(result))
        return result

    # ── Phase 1: terraform init ───────────────────────────────
    push_log("─── Phase 1: terraform init ───", "progress")
    rc, _ = run_cmd([
        "terraform", "init", "-reconfigure",
        f"-backend-config=path={state_rel}"
    ])
    if rc != 0:
        return finish("failed", error=f"terraform init failed (exit {rc})")

    push_log("terraform init succeeded ✓", "success")

    # ── Phase 2: terraform plan ───────────────────────────────
    push_log("─── Phase 2: terraform plan ───", "progress")
    plan_args = [
        "terraform", "plan", "-no-color", "-detailed-exitcode",
        "-lock=false",   # safe for read-only plan; avoids stale lock failures
        f"-out=/tmp/tfplan-{task_id}.bin"
    ]
    if mode == "new":
        target_map = {
            "azure": "azurerm_linux_virtual_machine.sparknode",
            "aws":   "aws_instance.sparknode_vm",
            "gcp":   "google_compute_instance.sparknode",
        }
        if provider in target_map:
            plan_args += [f"-target={target_map[provider]}"]

    rc, plan_lines = run_cmd(plan_args)
    if rc == 1:
        return finish("failed", error="terraform plan failed")

    # ── Parse plan output ─────────────────────────────────────
    add = change = destroy = 0
    resources = []
    for line in plan_lines:
        m = re.search(r'Plan:\s+(\d+) to add,\s+(\d+) to change,\s+(\d+) to destroy', line)
        if m:
            add, change, destroy = int(m[1]), int(m[2]), int(m[3])
        if re.match(r'\s+#\s+\S+ will be created', line):
            res = line.strip().lstrip("# ").replace(" will be created", "").strip()
            resources.append(res)

    plan_summary = {
        "resources_to_add": add,
        "resources_to_change": change,
        "resources_to_destroy": destroy,
        "resources": resources,
        "risk_level": "DESTRUCTIVE" if destroy > 0 else ("MODERATE" if change > 0 else "SAFE"),
    }
    push_log(f"Plan complete: +{add} to add, ~{change} to change, -{destroy} to destroy", "success")
    return finish("reviewed", plan=plan_summary)


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
    env_vars["PATH"] = "/usr/local/bin:/usr/bin:/bin:" + env_vars.get("PATH", "")
    
    # Standard Metadata for ALL providers
    env_vars["TF_VAR_project_name"] = "sparknode"
    env_vars["TF_VAR_environment"] = env_id or "dev"
    env_vars["ENVIRONMENT"] = env_id or "dev"
    env_vars["TF_VAR_user_data"] = base64.b64encode(b"#!/bin/bash\necho sparknode").decode()
    env_vars["APP_VERSION"] = release_tag

    if config:
        node_class = config.get("node_class", "burstable")
        region = config.get("region", "")

        if region:
            if target_provider.lower() == "aws":
                env_vars["TF_VAR_aws_region"]   = region
                env_vars["AWS_DEFAULT_REGION"]  = region
            elif target_provider.lower() == "azure":
                az_location = region.lower().replace("-", "").replace(" ", "")
                env_vars["TF_VAR_azure_location"] = az_location
            elif target_provider.lower() == "gcp":
                env_vars["TF_VAR_gcp_region"] = region
                env_vars["TF_VAR_gcp_zone"]   = region + "-a"
                env_vars["GOOGLE_REGION"]     = region

        if target_provider.lower() == "azure":
            if config.get("tenant_id"):
                env_vars["AZURE_TENANT_ID"]          = config["tenant_id"]
                env_vars["TF_VAR_azure_tenant_id"]   = config["tenant_id"]
                env_vars["ARM_TENANT_ID"]            = config["tenant_id"]
            if config.get("subscription_id"):
                env_vars["AZURE_SUBSCRIPTION_ID"]          = config["subscription_id"]
                env_vars["TF_VAR_azure_subscription_id"]   = config["subscription_id"]
                env_vars["ARM_SUBSCRIPTION_ID"]            = config["subscription_id"]
            env_vars["AZURE_CLIENT_ID"]           = os.getenv("AZURE_CLIENT_ID", "")
            env_vars["AZURE_CLIENT_SECRET"]       = os.getenv("AZURE_CLIENT_SECRET", "")
            env_vars["ARM_CLIENT_ID"]             = os.getenv("AZURE_CLIENT_ID", "")
            env_vars["ARM_CLIENT_SECRET"]         = os.getenv("AZURE_CLIENT_SECRET", "")
            env_vars["TF_VAR_azure_client_id"]    = os.getenv("AZURE_CLIENT_ID", "")
            env_vars["TF_VAR_azure_client_secret"]= os.getenv("AZURE_CLIENT_SECRET", "")
            env_vars["TF_VAR_vm_size"] = NODE_CLASS_MAP["azure"].get(node_class, "Standard_B2s")
            stream_log(deployment_id, "Injected Azure SPN credentials from secure store", "AUTH")

        elif target_provider.lower() == "aws":
            env_vars["AWS_ACCESS_KEY_ID"]     = config.get("access_key_id") or os.getenv("AWS_ACCESS_KEY_ID", "")
            env_vars["AWS_SECRET_ACCESS_KEY"] = config.get("secret_access_key") or os.getenv("AWS_SECRET_ACCESS_KEY", "")
            _r = region or "us-east-1"
            env_vars["TF_VAR_aws_region"]        = _r
            env_vars["TF_VAR_availability_zone"] = _r + "a"
            env_vars["TF_VAR_key_name"]          = config.get("key_name") or os.getenv("AWS_KEY_PAIR_NAME", "sparknode-key")
            env_vars["TF_VAR_instance_type"]     = NODE_CLASS_MAP["aws"].get(node_class, "t3.medium")
            stream_log(deployment_id, "Injected AWS credentials from secure store", "AUTH")

        elif target_provider.lower() == "gcp":
            gcp_project = config.get("gcp_project_id") or os.getenv("GCP_PROJECT_ID", "")
            env_vars["GOOGLE_PROJECT"]        = gcp_project
            env_vars["TF_VAR_gcp_project_id"] = gcp_project
            _r = region or "us-central1"
            env_vars["TF_VAR_gcp_region"]   = _r
            env_vars["TF_VAR_gcp_zone"]     = _r + "-a"
            env_vars["TF_VAR_machine_type"] = NODE_CLASS_MAP["gcp"].get(node_class, "e2-medium")
            env_vars["TF_VAR_ssh_public_key_path"] = os.path.expanduser("~/.ssh/id_rsa.pub")
            gcp_key = os.getenv("GCP_SA_KEY_JSON_PATH", "")
            if gcp_key and os.path.exists(gcp_key):
                env_vars["GOOGLE_APPLICATION_CREDENTIALS"] = gcp_key
            stream_log(deployment_id, "Injected GCP service account credentials from secure store", "AUTH")

        # Forward remaining config keys as generic TF_VAR_*
        skip_keys = {"region", "node_class", "tenant_id", "subscription_id",
                     "access_key_id", "secret_access_key", "key_name", "gcp_project_id"}
        for key, value in config.items():
            if key in skip_keys:
                continue
            env_vars[f"TF_VAR_{key}"] = str(value)
            
    if skip_infra:
        env_vars["SKIP_TERRAFORM"] = "true"
        stream_log(deployment_id, "Injected SKIP_TERRAFORM=true (Bypassing Phase 1)", "CONFIG")

    # 3. Execute provider-specific deploy script
    script_name = f"deploy_{target_provider.lower()}.sh"
    deploy_script = os.path.join(SCRIPT_DIR, script_name)
    
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
