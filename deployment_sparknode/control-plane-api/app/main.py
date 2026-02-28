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
from app.database import get_db, init_db, InfrastructureApproval, CloudConnection
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

@app.get("/api/infra/connections")
async def list_connections(db: Session = Depends(get_db)):
    conns = db.query(CloudConnection).all()
    return [{"id": c.id, "name": c.name, "provider": c.provider} for c in conns]

@app.post("/api/infra/connections")
async def create_connection(data: ConnectionCreate, db: Session = Depends(get_db)):
    new_conn = CloudConnection(
        name=data.name,
        provider=data.provider,
        credentials=data.credentials
    )
    db.add(new_conn)
    db.commit()
    db.refresh(new_conn)
    return {"status": "success", "id": new_conn.id}

@app.post("/api/infra/validate")
async def validate_credentials(data: Dict, db: Session = Depends(get_db)):
    provider = data.get("provider", "").lower()
    config = data.get("config", {})
    conn_id = config.get("connection_id")

    # In a real system, we'd use the connection_id to fetch secrets
    # For this demo, we validate if secrets are in .env or if a mock conn exists
    import os
    provider_keys = {
        "aws": "AWS_ACCESS_KEY_ID",
        "azure": "AZURE_SUBSCRIPTION_ID",
        "gcp": "GCP_PROJECT_ID"
    }

    key = provider_keys.get(provider)
    if not os.getenv(key) and not conn_id:
        raise HTTPException(status_code=401, detail=f"No {provider} credentials found in Profile or .env")

    return {"status": "validated", "iam_role": "SparkNode-Provisioner", "permission": "FullAccess"}

@app.post("/api/infra/review")
async def review_infrastructure(data: Dict, db: Session = Depends(get_db)):
    env_id = data.get("env_id", "default")
    provider = data.get("provider", "aws").lower()
    node_class = data.get("config", {}).get("node_class", "burstable")
    
    deployment_id = f"rev-{env_id}-{int(time.time())}"
    
    # Provider-specific resource list
    resources_map = {
        "aws": ["aws_vpc.spark_net", "aws_subnet.spark_pub", "aws_eks_cluster.spark_k8s", "aws_eks_node_group.workers", "aws_security_group.spark_sg"],
        "azure": ["azurerm_resource_group.spark_rg", "azurerm_virtual_network.spark_vnet", "azurerm_kubernetes_cluster.spark_aks"],
        "gcp": ["google_compute_network.spark_net", "google_container_cluster.spark_gke", "google_compute_subnetwork.spark_sub"]
    }
    
    plan_summary = {
        "resources_to_add": len(resources_map.get(provider, [])),
        "resources_to_destroy": 0,
        "resources": resources_map.get(provider, []),
        "risk_level": "SAFE",
        "cost": "$84/month" if node_class == "burstable" else "$242/month",
        "time": "6 minutes"
    }
    
    new_approval = InfrastructureApproval(
        deployment_id=deployment_id,
        env_id=env_id,
        provider=provider,
        plan_summary=plan_summary,
        status="reviewed"
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
        skip_infra=False  # This is the "Deploy Infra" path
    )
    
    return {"status": "deployment_started", "deployment_id": deployment_id}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "sparknode-control-plane"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
