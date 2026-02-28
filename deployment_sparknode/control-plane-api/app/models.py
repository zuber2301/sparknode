from enum import Enum
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict

class DeploymentStatus(str, Enum):
    CREATED = "created"
    INFRA_PROVISIONING = "infra_provisioning"
    IMAGE_PULLING = "image_pulling"
    MIGRATING = "migrating"
    RESTARTING = "restarting"
    VERIFYING = "verifying"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"

class Release(BaseModel):
    image_tag: str
    git_sha: str
    migration_version: str

class Deployment(BaseModel):
    id: str
    environment: str
    release: Release
    status: DeploymentStatus
    infra_state: Dict
    started_at: datetime
    completed_at: Optional[datetime] = None
    log_stream_id: str

class Environment(BaseModel):
    id: str
    name: str  # dev, staging, prod, customer-x
    region: str
    current_release: Optional[Release] = None
    health_status: str = "unknown"
    uptime: str = "0d"
    last_deploy_at: Optional[datetime] = None
