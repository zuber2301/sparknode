from sqlalchemy import Column, String, DateTime, JSON, ForeignKey, Enum as SQLEnum, Integer
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class DeploymentStatus(str, enum.Enum):
    CREATED = "created"
    QUEUED = "queued"
    INFRA_PROVISIONING = "infra_provisioning"
    IMAGE_PULLING = "image_pulling"
    MIGRATING = "migrating"
    RESTARTING = "restarting"
    SUCCESS = "success"
    FAILED = "failed"
    ROLLING_BACK = "rolling_back"

class Environment(Base):
    __tablename__ = "control_environments"
    
    id = Column(String, primary_key=True)  # prod, staging, etc.
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)  # aws, azure, gcp
    region = Column(String, nullable=False)
    domain = Column(String)
    
    current_release_id = Column(String, ForeignKey("control_releases.id"))
    current_release = relationship("Release", foreign_keys=[current_release_id])
    
    deployments = relationship("Deployment", back_populates="environment")
    created_at = Column(DateTime, default=datetime.utcnow)

class Release(Base):
    __tablename__ = "control_releases"
    
    id = Column(String, primary_key=True)  # v1.4.2
    image_tag = Column(String, nullable=False)
    git_sha = Column(String)
    migration_version = Column(String)  # Alembic head at time of release
    created_at = Column(DateTime, default=datetime.utcnow)

class Deployment(Base):
    __tablename__ = "control_deployments"
    
    id = Column(String, primary_key=True)
    env_id = Column(String, ForeignKey("control_environments.id"))
    release_id = Column(String, ForeignKey("control_releases.id"))
    
    status = Column(SQLEnum(DeploymentStatus), default=DeploymentStatus.CREATED)
    infra_state_snapshot = Column(JSON)  # Capture TF state excerpt
    
    error_message = Column(String)
    log_file_path = Column(String) # Path to persistent log on control plane
    
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    
    environment = relationship("Environment", back_populates="deployments")
    release = relationship("Release")

class DeploymentLog(Base):
    __tablename__ = "control_deployment_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    deployment_id = Column(String, ForeignKey("control_deployments.id"))
    step = Column(String) # e.g., "MIGRATING"
    message = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
