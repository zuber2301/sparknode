from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union, Optional
import os


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://sparknode:sparknode_secret_2024@localhost:5432/sparknode")
    
    # JWT Settings
    secret_key: str = os.getenv("SECRET_KEY", "sparknode-super-secret-key-change-in-production")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    # Email (SMTP) Settings
    smtp_host: Optional[str] = os.getenv("SMTP_HOST")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: Optional[str] = os.getenv("SMTP_USER")
    smtp_password: Optional[str] = os.getenv("SMTP_PASSWORD")
    smtp_from: Optional[str] = os.getenv("SMTP_FROM")
    smtp_use_tls: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    # SMS (Twilio) Settings
    twilio_account_sid: Optional[str] = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token: Optional[str] = os.getenv("TWILIO_AUTH_TOKEN")
    twilio_from_number: Optional[str] = os.getenv("TWILIO_FROM_NUMBER")

    # Celery
    celery_broker_url: Optional[str] = os.getenv("CELERY_BROKER_URL")
    celery_result_backend: Optional[str] = os.getenv("CELERY_RESULT_BACKEND")
    
    # CORS - accept string or list
    cors_origins: Union[str, List[str]] = "http://localhost:3000,http://localhost:5173,http://localhost:5180,http://localhost:6173"
    
    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
