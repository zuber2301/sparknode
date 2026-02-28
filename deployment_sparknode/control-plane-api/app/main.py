from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import asyncio
import os
import time
from typing import List, Dict, Optional
import redis.asyncio as redis
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db, init_db, InfrastructureApproval
from datetime import datetime
from dotenv import load_dotenv

# Load secret environment variables
load_dotenv()

# Component Imports
import app.execution_engine as engine

# Initialize DB on startup
init_db()

app = FastAPI(
    title="SparkNode Control Plane API",
    description="Orchestration & State Management for SparkNode Deployments",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis for Pub/Sub (Live log streaming)
REDIS_URL = "redis://localhost:6379/0"

class DeploymentTrigger(BaseModel):
    env_id: str
    release_tag: str
    host: Optional[str] = None
    provider: Optional[str] = None
    config: Optional[Dict] = None
    skip_infra: Optional[bool] = False

class RollbackTrigger(BaseModel):
    env_id: str
    provider: Optional[str] = None

@app.post("/api/deployments/")
async def trigger_deployment(data: DeploymentTrigger):
    deployment_id = f"dep-{data.env_id}-{int(asyncio.get_event_loop().time())}"
    engine.run_deployment_v2.delay(
        deployment_id, 
        data.env_id, 
        data.release_tag,
        host=data.host,
        provider=data.provider,
        config=data.config,
        skip_infra=data.skip_infra
    )
    return {"deployment_id": deployment_id, "status": "PENDING"}


@app.post("/api/deployments/app")
async def deploy_app_containers(data: Dict):
    """
    Phase 2 — Container-only deployment (skips Terraform entirely).
    Triggers run_deployment_v2 with skip_infra=True so only SSH +
    Docker Compose steps run against an already-provisioned VM.
    """
    env_id      = data.get("env_id", "default")
    provider    = data.get("provider", "aws")
    release_tag = data.get("release_tag", "latest")
    config      = data.get("config", {})
    host        = data.get("host", "")

    deployment_id = f"app-{env_id}-{int(time.time())}"
    engine.run_deployment_v2.delay(
        deployment_id,
        env_id,
        release_tag,
        host=host,
        provider=provider,
        config=config,
        skip_infra=True,
        mode="update",
    )
    return {"deployment_id": deployment_id, "status": "PENDING"}

@app.post("/api/rollback/")
async def trigger_rollback(data: RollbackTrigger):
    deployment_id = f"roll-{data.env_id}-{int(asyncio.get_event_loop().time())}"
    # Trigger Celery Task
    engine.run_rollback_v2.delay(
        deployment_id,
        data.env_id,
        provider=data.provider
    )
    return {"deployment_id": deployment_id, "status": "PENDING"}

@app.websocket("/ws/deployments/{deployment_id}/logs")
async def websocket_logs(websocket: WebSocket, deployment_id: str):
    await websocket.accept()
    r = redis.from_url(REDIS_URL)
    pubsub = r.pubsub()
    
    # Subscribe to release-specific log channel
    channel = f"deployment_logs:{deployment_id}"
    await pubsub.subscribe(channel)
    
    try:
        # Initial handshake
        await websocket.send_json({"msg": f"Connected to log stream for {deployment_id}"})
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"].decode("utf-8")
                await websocket.send_json({"deployment_id": deployment_id, "log": data})
                
    except WebSocketDisconnect:
        await pubsub.unsubscribe(channel)
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
    finally:
        await websocket.close()

class ConnectionCreate(BaseModel):
    name: str
    provider: str
    credentials: Dict

@app.get("/api/infra/config")
async def get_infra_config(env_id: str, provider: str, db: Session = Depends(get_db)):
    # Retrieve the last successful approval/config for this environment
    last_approval = db.query(InfrastructureApproval).filter(
        InfrastructureApproval.env_id == env_id,
        InfrastructureApproval.provider == provider.lower(),
        InfrastructureApproval.status == "approved"
    ).order_by(InfrastructureApproval.created_at.desc()).first()
    
    if not last_approval:
        return {"variables": {}}
    
    return {"variables": last_approval.variables or {}}

import os
from azure.identity import ClientSecretCredential
from azure.mgmt.resource import ResourceManagementClient
from azure.core.exceptions import ClientAuthenticationError
import redis as redis_sync   # synchronous redis for plan-status polling
import json as _json

@app.post("/api/infra/validate")
async def validate_credentials(data: Dict, db: Session = Depends(get_db)):
    provider = data.get("provider", "").lower()
    config = data.get("config", {})
    
    logs = [
        {"msg": f"Starting validation for provider: {provider.upper()}", "status": "info"},
        {"msg": f"Target Environment: {data.get('env_id', 'unknown')}", "status": "info"}
    ]
    
    def run_azure_validation_sync():
        """Synchronous Azure validation - runs in a thread pool to avoid blocking the event loop."""
        from azure.identity import ClientSecretCredential
        from azure.mgmt.resource import ResourceManagementClient
        from azure.core.exceptions import ClientAuthenticationError
        
        inner_logs = []
        try:
            inner_logs.append({"msg": "Fetching Service Principal from system store...", "status": "info"})
            client_id = os.getenv("AZURE_CLIENT_ID")
            client_secret = os.getenv("AZURE_CLIENT_SECRET")
            tenant_id = config.get("tenant_id") or os.getenv("AZURE_TENANT_ID")
            subscription_id = config.get("subscription_id") or os.getenv("AZURE_SUBSCRIPTION_ID")

            if not all([client_id, client_secret, tenant_id, subscription_id]):
                inner_logs.append({"msg": "Validation Failed: Missing ID Mappings", "status": "error"})
                return {"status": "failed", "logs": inner_logs, "error": "Missing Required IDs"}

            inner_logs.append({"msg": f"Authenticating with Tenant {tenant_id[:8]}...", "status": "progress"})
            credential = ClientSecretCredential(
                tenant_id=tenant_id,
                client_id=client_id,
                client_secret=client_secret
            )
            
            inner_logs.append({"msg": f"Connecting to Subscription {subscription_id[:8]}...", "status": "progress"})
            client = ResourceManagementClient(credential, subscription_id)
            
            inner_logs.append({"msg": "Probing Azure Resource Manager API...", "status": "progress"})
            list(client.resource_groups.list(top=1))
            
            inner_logs.append({"msg": "Successfully verified SPN permissions", "status": "success"})
            return {
                "status": "validated", 
                "logs": inner_logs,
                "iam_role": "Azure-SPN-Verified", 
                "details": f"Authenticated for Tenant {tenant_id[:8]}..."
            }
        except ClientAuthenticationError:
            inner_logs.append({"msg": "Auth Error: Invalid Client/Secret or Tenant", "status": "error"})
            return {"status": "failed", "logs": inner_logs, "error": "Authentication Failed"}
        except Exception as e:
            inner_logs.append({"msg": f"API Error: {str(e)}", "status": "error"})
            return {"status": "failed", "logs": inner_logs, "error": str(e)}

    if provider == "azure":
        try:
            # Run blocking Azure SDK calls in a thread pool so the event loop
            # stays free and asyncio.wait_for timeout can actually fire
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, run_azure_validation_sync),
                timeout=15.0
            )
            logs.extend(result.get("logs", []))
            return {**result, "logs": logs}
        except asyncio.TimeoutError:
            logs.append({"msg": "Validation TIMEOUT: Azure API response exceeded 15s", "status": "error"})
            return {"status": "failed", "logs": logs, "error": "Timeout"}

    elif provider == "aws":
        def run_aws_validation_sync():
            import boto3
            from botocore.exceptions import ClientError, NoCredentialsError
            inner_logs = []
            try:
                access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
                secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
                region     = config.get("region", "us-east-1")

                inner_logs.append({"msg": "Checking AWS credentials from system store...", "status": "progress"})
                if not access_key or not secret_key or access_key.startswith("placeholder"):
                    inner_logs.append({"msg": "AWS credentials not configured on this server", "status": "error"})
                    return {"status": "failed", "logs": inner_logs, "error": "AWS credentials not configured"}

                inner_logs.append({"msg": f"Calling STS GetCallerIdentity (region: {region})...", "status": "progress"})
                sts = boto3.client(
                    "sts",
                    aws_access_key_id=access_key,
                    aws_secret_access_key=secret_key,
                    region_name=region,
                )
                identity = sts.get_caller_identity()
                account = identity["Account"]
                arn     = identity["Arn"]
                inner_logs.append({"msg": f"Verified ARN: {arn}", "status": "success"})
                inner_logs.append({"msg": f"AWS Account ID: {account}", "status": "success"})
                return {"status": "validated", "logs": inner_logs,
                        "iam_role": arn, "details": f"Account {account}"}
            except NoCredentialsError:
                inner_logs.append({"msg": "No AWS credentials found", "status": "error"})
                return {"status": "failed", "logs": inner_logs, "error": "No credentials"}
            except ClientError as e:
                msg = e.response.get("Error", {}).get("Message", str(e))
                inner_logs.append({"msg": f"AWS Error: {msg}", "status": "error"})
                return {"status": "failed", "logs": inner_logs, "error": msg}
            except Exception as e:
                inner_logs.append({"msg": f"Error: {str(e)[:120]}", "status": "error"})
                return {"status": "failed", "logs": inner_logs, "error": str(e)}

        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, run_aws_validation_sync),
                timeout=15.0
            )
            logs.extend(result.get("logs", []))
            return {**result, "logs": logs}
        except asyncio.TimeoutError:
            logs.append({"msg": "Validation TIMEOUT: AWS STS exceeded 15s", "status": "error"})
            return {"status": "failed", "logs": logs, "error": "Timeout"}

    elif provider == "gcp":
        def run_gcp_validation_sync():
            inner_logs = []
            try:
                gcp_project_id = config.get("gcp_project_id") or os.getenv("GCP_PROJECT_ID", "")
                gcp_key_path   = os.getenv("GCP_SA_KEY_JSON_PATH", "")

                inner_logs.append({"msg": "Checking GCP credentials from system store...", "status": "progress"})
                if not gcp_project_id or gcp_project_id.startswith("placeholder"):
                    inner_logs.append({"msg": "GCP Project ID not configured on this server", "status": "error"})
                    return {"status": "failed", "logs": inner_logs, "error": "GCP Project ID missing"}

                if not gcp_key_path or not os.path.exists(gcp_key_path):
                    inner_logs.append({"msg": "GCP service account key not found at configured path", "status": "error"})
                    return {"status": "failed", "logs": inner_logs, "error": "GCP SA key not found"}

                inner_logs.append({"msg": "Loading GCP service account key...", "status": "progress"})
                from google.oauth2 import service_account
                from google.auth.transport.requests import Request as GoogRequest

                creds = service_account.Credentials.from_service_account_file(
                    gcp_key_path,
                    scopes=["https://www.googleapis.com/auth/cloud-platform"],
                )
                creds.refresh(GoogRequest())

                sa_email = creds.service_account_email
                inner_logs.append({"msg": f"Service Account authenticated: {sa_email}", "status": "success"})
                inner_logs.append({"msg": f"GCP Project: {gcp_project_id}", "status": "success"})
                return {"status": "validated", "logs": inner_logs,
                        "iam_role": sa_email, "details": f"Project {gcp_project_id}"}
            except Exception as e:
                inner_logs.append({"msg": f"GCP Auth Error: {str(e)[:120]}", "status": "error"})
                return {"status": "failed", "logs": inner_logs, "error": str(e)}

        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, run_gcp_validation_sync),
                timeout=20.0
            )
            logs.extend(result.get("logs", []))
            return {**result, "logs": logs}
        except asyncio.TimeoutError:
            logs.append({"msg": "Validation TIMEOUT: GCP auth exceeded 20s", "status": "error"})
            return {"status": "failed", "logs": logs, "error": "Timeout"}

    logs.append({"msg": f"Provider '{provider}' not yet supported for direct validation", "status": "progress"})
    return {"status": "validated", "logs": logs}


@app.post("/api/infra/review")
async def review_infrastructure(data: Dict):
    """
    Dispatches a terraform init+plan Celery task and returns immediately.
    The UI polls /api/infra/plan-status/{task_id} to stream logs and get the result.
    """
    env_id   = data.get("env_id", "default")
    provider = data.get("provider", "aws").lower()
    mode     = data.get("mode", "new")
    config   = data.get("config", {})

    task_id = f"rev-{env_id}-{int(time.time())}"

    # Fire-and-forget — Celery worker picks this up immediately
    engine.run_terraform_plan.apply_async(
        args=[task_id, env_id, provider, config, mode],
        task_id=task_id,
    )

    return {"task_id": task_id, "deployment_id": task_id, "status": "running"}


@app.get("/api/infra/plan-status/{task_id}")
async def plan_status(task_id: str, offset: int = 0, db: Session = Depends(get_db)):
    """
    Polling endpoint for terraform plan progress.
    - Returns new log lines since `offset` on every poll.
    - When done=True the response contains the final status, plan summary, and deployment_id.
    - On first 'reviewed' response the InfrastructureApproval DB record is created here.
    """
    _r = redis_sync.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))

    logs_key   = f"plan_logs:{task_id}"
    result_key = f"plan_result:{task_id}"
    saved_key  = f"plan_saved:{task_id}"

    # Stream new log lines since last poll
    raw_logs  = _r.lrange(logs_key, offset, -1)
    new_logs  = [_json.loads(l) for l in raw_logs]
    new_offset = offset + len(new_logs)

    # Check whether the task has finished
    raw_result = _r.get(result_key)
    if not raw_result:
        # Still running
        return {"status": "running", "logs": new_logs, "offset": new_offset, "done": False}

    final = _json.loads(raw_result)
    final_status = final.get("status")  # "reviewed" | "failed"
    plan_data    = final.get("plan", {})
    error        = final.get("error")

    # Save the approval record to DB exactly once (idempotent via saved_key flag)
    if final_status == "reviewed" and not _r.get(saved_key):
        try:
            existing = db.query(InfrastructureApproval).filter(
                InfrastructureApproval.deployment_id == task_id
            ).first()
            if not existing:
                # Retrieve original config from the Celery task args stored in Redis
                db.add(InfrastructureApproval(
                    deployment_id=task_id,
                    env_id=task_id.split("-")[1] if "-" in task_id else "unknown",
                    provider=plan_data.get("provider", "unknown"),
                    plan_summary=plan_data,
                    status="reviewed",
                    variables={},
                ))
                db.commit()
            _r.setex(saved_key, 3600, "1")
        except Exception as exc:
            logging.warning(f"plan-status: DB save skipped: {exc}")

    return {
        "status":        final_status,
        "logs":          new_logs,
        "offset":        new_offset,
        "done":          True,
        "plan":          plan_data,
        "error":         error,
        "deployment_id": task_id,
    }


@app.post("/api/infra/approve")
async def approve_infrastructure(deployment_id: str, db: Session = Depends(get_db)):
    approval = db.query(InfrastructureApproval).filter(InfrastructureApproval.deployment_id == deployment_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval record not found")
    
    approval.status = "approved"
    approval.approved_at = datetime.utcnow()
    db.commit()
    
    # ─── REPLICATE SHELL SCRIPT IN DASHBOARD ───
    # We call the same Celery engine that wraps the deploy_*.sh scripts.
    # This ensures consistency: UI and CLI use the SAME logic.
    engine.run_deployment_v2.delay(
        deployment_id,
        approval.env_id,
        "latest",
        provider=approval.provider,
        config=approval.variables,
        skip_infra=False,  # This is the "Deploy Infra" path
        mode=approval.plan_summary.get("mode", "new")
    )
    
    return {"status": "deployment_started", "deployment_id": deployment_id}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "sparknode-control-plane"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
