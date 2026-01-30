from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, date
from uuid import UUID


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    email: Optional[str] = None
    org_role: Optional[str] = None
    token_type: Optional[str] = None
    actual_user_id: Optional[UUID] = None
    effective_tenant_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    tenant_name: Optional[str] = None
    corporate_email: str
    personal_email: Optional[str] = None
    first_name: str
    last_name: str
    org_role: str
    role: Optional[str] = None
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    status: str
    is_platform_admin: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @property
    def effective_role(self):
        return self.org_role


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class SystemAdminResponse(BaseModel):
    admin_id: UUID
    user_id: UUID
    access_level: str
    mfa_enabled: bool
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SystemAdminLoginResponse(BaseModel):
    access_token: str
    token_type: str
    admin: SystemAdminResponse


class EmailOtpRequest(BaseModel):
    email: EmailStr
    tenant_id: Optional[UUID] = None


class EmailOtpVerify(BaseModel):
    email: EmailStr
    code: str
    tenant_id: Optional[UUID] = None


class SmsOtpRequest(BaseModel):
    mobile_number: str
    tenant_id: Optional[UUID] = None


class SmsOtpVerify(BaseModel):
    mobile_number: str
    code: str
    tenant_id: Optional[UUID] = None


class OtpResponse(BaseModel):
    success: bool
    message: str
