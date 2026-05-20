from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "纱线图像检测系统"
    
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MODEL_DIR: Path = BASE_DIR / "models"
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  
    ALLOWED_EXTENSIONS: set = {"jpg", "jpeg", "png", "bmp"}
    
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/yarn_detection.db"
    
    HAIRINESS_THRESHOLD: float = 0.25  
    BREAKAGE_THRESHOLD: float = 0.15   
    THICKNESS_STD_THRESHOLD: float = 0.15  
    DENSITY_THRESHOLD_LOW: float = 0.7
    DENSITY_THRESHOLD_HIGH: float = 1.3
    
    FEATURE_SIMILARITY_THRESHOLD: float = 0.85
    
    CURRENT_MODEL_VERSION: str = "1.0.0"

    class Config:
        case_sensitive = True


settings = Settings()
