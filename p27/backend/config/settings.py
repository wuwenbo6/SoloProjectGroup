from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = True

    elasticsearch_host: str = "http://localhost:9200"
    elasticsearch_user: str = "elastic"
    elasticsearch_password: str = "changeme"

    tesseract_cmd: str = "/usr/bin/tesseract"
    tesseract_lang: str = "chi_sim+eng"

    layoutlm_model_name: str = "microsoft/layoutlmv3-base"
    layoutlm_max_length: int = 512

    embedding_model_name: str = "shibing624/text2vec-base-chinese"
    embedding_dimension: int = 768

    llama_model_path: str = "models/llama-2-7b-chat.gguf"
    llama_n_ctx: int = 2048
    llama_n_gpu_layers: int = 0
    llama_temperature: float = 0.7
    llama_max_tokens: int = 512

    upload_dir: str = "uploads"
    max_file_size: int = 100 * 1024 * 1024
    allowed_extensions: List[str] = ["pdf", "png", "jpg", "jpeg", "tiff"]

    rag_top_k: int = 5
    rag_min_score: float = 0.5

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
