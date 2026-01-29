from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Optional, Literal, List
import re
from uuid import UUID
from datetime import datetime, date

VALID_ROLES = ['tenant_admin', 'tenant_lead', 'corporate_user']
VALID_STATUSES = {"PENDING_INVITE", "ACTIVE", "DEACTIVATED", "pending_invite", "active", "deactivated"}


class UserBase(BaseModel):
    email: EmailStr
    corporate_email: Optional[EmailStr] = None
    personal_email: Optional[EmailStr] = None
    first_name: str
    last_name: str
    role: Literal['tenant_admin', 'tenant_lead', 'corporate_user']
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None

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
    role: Optional[Literal['tenant_admin', 'tenant_lead', 'corporate_user']] = None
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
    email: str
    corporate_email: Optional[str] = None
    personal_email: Optional[str] = None
    first_name: str
    last_name: str
    role: str
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
    email: str
    corporate_email: Optional[str] = None
    personal_email: Optional[str] = None
    first_name: str
    last_name: str
    role: str
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    department_id: Optional[UUID] = None
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
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    corporate_email: Optional[str] = None
    personal_email: Optional[str] = None
    department_name: Optional[str] = None
    role: Optional[str] = None
    manager_email: Optional[str] = None
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    hire_date: Optional[str] = None
    errors: List[str] = Field(default_factory=list)
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
    role: Optional[Literal['tenant_admin', 'tenant_lead', 'corporate_user']] = None
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
    full_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    corporate_email: Optional[EmailStr] = None
    personal_email: Optional[EmailStr] = None
    department_name: Optional[str] = None
    role: Optional[str] = None
    manager_email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    hire_date: Optional[str] = None
