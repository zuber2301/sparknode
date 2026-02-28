from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import asyncio
from typing import List, Dict, Optional
import redis.asyncio as redis
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db, init_db, InfrastructureApproval
from datetime import datetime

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

@app.post("/api/infra/validate")
async def validate_credentials(data: DeploymentTrigger):
    # Pseudo-validation: check if keys are present
    if not data.config:
        raise HTTPException(status_code=400, detail="Missing configuration")
    return {"status": "validated", "message": "Credentials format is correct"}

@app.post("/api/infra/review")
async def review_infrastructure(data: DeploymentTrigger, db: Session = Depends(get_db)):
    deployment_id = f"rev-{data.env_id}-{int(asyncio.get_event_loop().time())}"
    
    # Mock Terraform Plan Summary
    plan_summary = {
        "resources_to_add": 12,
        "resources_to_change": 0,
        "resources_to_destroy": 0,
        "resources": [
            "aws_instance.sparknode_vm",
            "aws_vpc.main",
            "aws_security_group.allow_web",
            "aws_subnet.public",
            "aws_internet_gateway.gw",
            "aws_route_table.rt"
        ]
    }
    
    new_approval = InfrastructureApproval(
        deployment_id=deployment_id,
        env_id=data.env_id,
        provider=data.provider,
        plan_summary=plan_summary,
        status="reviewed",
        variables=data.config
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
    
    # Trigger actual deployment task
    engine.run_deployment_v2.delay(
        deployment_id,
        approval.env_id,
        "latest",
        provider=approval.provider,
        config=approval.variables
    )
    
    return {"status": "deployment_started", "deployment_id": deployment_id}

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "sparknode-control-plane"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
