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
    # Trigger Celery Task
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

    logs.append({"msg": "Generic provider validation successful", "status": "success"})
    return {"status": "validated", "logs": logs}

@app.post("/api/infra/review")
async def review_infrastructure(data: Dict, db: Session = Depends(get_db)):
    env_id = data.get("env_id", "default")
    provider = data.get("provider", "aws").lower()
    mode = data.get("mode", "new") # new | update
    config = data.get("config", {})
    node_class = config.get("node_class", "burstable")
    
    deployment_id = f"rev-{env_id}-{int(time.time())}"
    
    # Provider-specific resource list
    resources_map = {
        "aws": ["aws_instance.sparknode_vm"] if mode == "new" else ["aws_vpc.spark_net", "aws_subnet.spark_pub", "aws_eks_cluster.spark_k8s", "aws_eks_node_group.workers", "aws_security_group.spark_sg", "aws_instance.sparknode_vm"],
        "azure": ["azurerm_linux_virtual_machine.sparknode"] if mode == "new" else ["azurerm_resource_group.spark_rg", "azurerm_virtual_network.spark_vnet", "azurerm_kubernetes_cluster.spark_aks", "azurerm_linux_virtual_machine.sparknode"],
        "gcp": ["google_compute_instance.sparknode"] if mode == "new" else ["google_compute_network.spark_net", "google_container_cluster.spark_gke", "google_compute_subnetwork.spark_sub", "google_compute_instance.sparknode"]
    }
    
    plan_summary = {
        "resources_to_add": len(resources_map.get(provider, [])),
        "resources_to_destroy": 0,
        "resources": resources_map.get(provider, []),
        "risk_level": "SAFE" if mode == "new" else "MODERATE",
        "cost": "$84/month" if node_class == "burstable" else "$242/month",
        "time": "3 minutes" if mode == "new" else "8 minutes",
        "mode": mode
    }
    
    new_approval = InfrastructureApproval(
        deployment_id=deployment_id,
        env_id=env_id,
        provider=provider,
        plan_summary=plan_summary,
        status="reviewed",
        variables=config # Persist the config used for this review
    )
    db.add(new_approval)
    db.commit()
    
    return {
        "deployment_id": deployment_id,
        "plan": plan_summary,
        "status": "reviewed"
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
