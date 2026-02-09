from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Optional, Literal, List
import re
from uuid import UUID
from datetime import datetime, date

VALID_ROLES = ['platform_admin', 'tenant_manager', 'tenant_lead', 'tenant_user']
VALID_STATUSES = {"PENDING_INVITE", "ACTIVE", "DEACTIVATED", "pending_invite", "active", "deactivated"}


class UserBase(BaseModel):
    corporate_email: EmailStr
    personal_email: Optional[EmailStr] = None
    first_name: str
    last_name: str
    org_role: Literal['platform_admin', 'tenant_manager', 'tenant_lead', 'tenant_user']
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.replace(" ", "")
        pattern = r"^(\+91)?[6-9]\d{9}$"
        if not re.match(pattern, normalized):
            raise ValueError("Invalid Indian phone number")
        return normalized

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.replace(" ", "")
        pattern = r"^(\+91)?[6-9]\d{9}$"
        if not re.match(pattern, normalized):
            raise ValueError("Invalid Indian mobile number")
        return normalized


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    corporate_email: Optional[EmailStr] = None
    personal_email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    org_role: Optional[Literal['platform_admin', 'tenant_manager', 'tenant_lead', 'tenant_user']] = None
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    status: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.replace(" ", "")
        pattern = r"^(\+91)?[6-9]\d{9}$"
        if not re.match(pattern, normalized):
            raise ValueError("Invalid Indian phone number")
        return normalized

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.replace(" ", "")
        pattern = r"^(\+91)?[6-9]\d{9}$"
        if not re.match(pattern, normalized):
            raise ValueError("Invalid Indian mobile number")
        return normalized

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.strip()
        if normalized not in VALID_STATUSES:
            raise ValueError("Invalid status")
        return normalized.upper() if normalized.islower() else normalized


class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    corporate_email: str
    personal_email: Optional[str] = None
    first_name: str
    last_name: str
    org_role: str
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
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
    corporate_email: str
    personal_email: Optional[str] = None
    first_name: str
    last_name: str
    org_role: str
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    dept_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class BulkUploadResponse(BaseModel):
    batch_id: UUID
    total_rows: int
    valid_rows: int
    error_rows: int


class StagingRowResponse(BaseModel):
    id: UUID
    batch_id: UUID
    raw_full_name: str
    raw_email: str
    raw_mobile_phone: Optional[str] = None
    raw_role: Optional[str] = None
    raw_department: Optional[str] = None
    
    manager_email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    corporate_email: Optional[str] = None
    personal_email: Optional[str] = None
    date_of_birth: Optional[str] = None
    hire_date: Optional[str] = None
    
    is_valid: bool = False
    validation_errors: List[str] = Field(default_factory=list)
    status: str

    class Config:
        from_attributes = True


class BulkConfirmRequest(BaseModel):
    batch_id: UUID
    send_invites: bool = True


class BulkActionRequest(BaseModel):
    user_ids: List[UUID]


class BulkResendRequest(BaseModel):
    user_ids: List[UUID]


class UserPatch(BaseModel):
    email: Optional[EmailStr] = None
    corporate_email: Optional[EmailStr] = None
    personal_email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    org_role: Optional[Literal['platform_admin', 'tenant_manager', 'tenant_lead', 'tenant_user']] = None
    status: Optional[str] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.replace(" ", "")
        pattern = r"^(\+91)?[6-9]\d{9}$"
        if not re.match(pattern, normalized):
            raise ValueError("Invalid Indian phone number")
        return normalized

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile_number(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.replace(" ", "")
        pattern = r"^(\+91)?[6-9]\d{9}$"
        if not re.match(pattern, normalized):
            raise ValueError("Invalid Indian mobile number")
        return normalized

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: Optional[str]) -> Optional[str]:
        if value in (None, ""):
            return None
        normalized = value.strip()
        if normalized not in VALID_STATUSES:
            raise ValueError("Invalid status")
        return normalized.upper() if normalized.islower() else normalized


class StagingRowUpdate(BaseModel):
    raw_full_name: Optional[str] = None
    raw_email: Optional[str] = None
    raw_mobile_phone: Optional[str] = None
    raw_role: Optional[str] = None
    raw_department: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    manager_email: Optional[str] = None
    date_of_birth: Optional[str] = None
    hire_date: Optional[str] = None
