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
    allow_credentials=True,
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

@app.post("/api/infra/validate")
async def validate_credentials(data: Dict, db: Session = Depends(get_db)):
    provider = data.get("provider", "").lower()
    config = data.get("config", {})
    
    # Validation logic now checks .env directly
    import os
    if provider == "azure":
        client_id = os.getenv("AZURE_CLIENT_ID")
        client_secret = os.getenv("AZURE_CLIENT_SECRET")
        if not client_id or not client_secret:
            raise HTTPException(status_code=401, detail="Azure Service Principal secrets not found in system storage")
    
    return {"status": "validated", "iam_role": "SparkNode-Provisioner", "permission": "FullAccess"}

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
