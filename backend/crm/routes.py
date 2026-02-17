from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from database import get_db
from models import CRMConnector
from auth.utils import require_tenant_manager_or_platform, get_current_user
from models import Tenant, User

router = APIRouter()


@router.get("/connectors", response_model=List[dict])
def list_connectors(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(CRMConnector).filter(CRMConnector.tenant_id == current_user.tenant_id).all()
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "connector_type": r.connector_type,
            "config": r.config,
            "enabled": r.enabled,
        }
        for r in rows
    ]


@router.post("/connectors")
def create_connector(payload: dict, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    name = payload.get('name')
    connector_type = payload.get('connector_type')
    config = payload.get('config', {})
    enabled = payload.get('enabled', True)
    if not name or not connector_type:
        raise HTTPException(status_code=400, detail="name and connector_type required")
    c = CRMConnector(
        tenant_id=current_user.tenant_id,
        name=name,
        connector_type=connector_type,
        config=config,
        enabled=enabled
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"id": str(c.id), "name": c.name, "connector_type": c.connector_type, "config": c.config, "enabled": c.enabled}


@router.patch("/connectors/{connector_id}")
def update_connector(connector_id: UUID, payload: dict, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    c = db.query(CRMConnector).filter(CRMConnector.id == connector_id, CRMConnector.tenant_id == current_user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Connector not found")
    for k, v in payload.items():
        if k == 'config' and isinstance(v, dict):
            c.config = v
        elif hasattr(c, k):
            setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return {"id": str(c.id), "name": c.name, "connector_type": c.connector_type, "config": c.config, "enabled": c.enabled}


@router.delete("/connectors/{connector_id}")
def delete_connector(connector_id: UUID, current_user: User = Depends(require_tenant_manager_or_platform), db: Session = Depends(get_db)):
    c = db.query(CRMConnector).filter(CRMConnector.id == connector_id, CRMConnector.tenant_id == current_user.tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Connector not found")
    db.delete(c)
    db.commit()
    return {"message": "deleted"}
