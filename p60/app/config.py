from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./mortise_tenon.db"
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    THIRD_PARTY_API_URL: str = "https://api.wood-testing.com/v1"
    THIRD_PARTY_API_KEY: str = "your-third-party-api-key"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
