from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Union
import os


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv("DATABASE_URL", "postgresql://sparknode:sparknode_secret_2024@localhost:5432/sparknode")
    
    # JWT Settings
    secret_key: str = os.getenv("SECRET_KEY", "sparknode-super-secret-key-change-in-production")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    
    # CORS - accept string or list
    cors_origins: Union[str, List[str]] = "http://localhost:3000,http://localhost:5173,http://localhost:5180"
    
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
