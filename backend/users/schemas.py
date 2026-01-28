from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime, date

VALID_ROLES = ['platform_owner', 'tenant_admin', 'tenant_lead', 'corporate_user']


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: Literal['tenant_admin', 'tenant_lead', 'corporate_user']
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[Literal['tenant_admin', 'tenant_lead', 'corporate_user']] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    status: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    department_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
