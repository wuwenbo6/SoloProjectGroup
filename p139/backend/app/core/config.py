from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "Quantum Circuit Simulator"

    DATABASE_URL: str = "sqlite:///./quantum.db"

    USE_CUDA: bool = False
    MAX_QUBITS: int = 30

    class Config:
        case_sensitive = True


settings = Settings()
