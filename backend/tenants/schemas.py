from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from core.rbac import AllowedDepartment


class TenantBase(BaseModel):
    name: str
    domain: Optional[str] = None
    logo_url: Optional[str] = None


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class TenantResponse(TenantBase):
    id: UUID
    status: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None

    @field_validator('name')
    @classmethod
    def validate_department_name(cls, v):
        allowed_names = [d.value for d in AllowedDepartment]
        if v not in allowed_names:
            raise ValueError(f"Department name must be one of: {', '.join(allowed_names)}")
        return v


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None


class DepartmentResponse(DepartmentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
