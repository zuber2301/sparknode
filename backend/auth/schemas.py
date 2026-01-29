from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from uuid import UUID


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    email: Optional[str] = None
    role: Optional[str] = None
    token_type: Optional[str] = None
    actual_user_id: Optional[UUID] = None
    effective_tenant_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    email: str
    first_name: str
    last_name: str
    role: str
    phone_number: Optional[str] = None
    mobile_number: Optional[str] = None
    corporate_email: Optional[str] = None
    personal_email: Optional[str] = None
    department_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class SystemAdminResponse(BaseModel):
    id: UUID
    email: str
    role: str
    is_super_admin: bool
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
