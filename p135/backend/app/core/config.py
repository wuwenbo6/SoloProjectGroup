from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/audio_fingerprint"
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = "postgres"
    DATABASE_NAME: str = "audio_fingerprint"

    SAMPLE_RATE: int = 22050
    N_FFT: int = 2048
    HOP_LENGTH: int = 512
    N_MELS: int = 128
    PEAK_NEIGHBORHOOD_SIZE: int = 15
    TARGET_FAN_VALUE: int = 10
    MIN_HASH_TIME_DELTA: int = 2
    MAX_HASH_TIME_DELTA: int = 100
    FINGERPRINT_REDUCTION: int = 40
    PEAK_THRESHOLD_STD: float = 0.8
    MAX_PEAKS_PER_SECOND: int = 50

    TOP_N_MATCHES: int = 5
    SCORE_THRESHOLD: float = 0.3
    MIN_ALIGNMENT_SCORE: int = 3

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
