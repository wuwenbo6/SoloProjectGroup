import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.absolute()

DEVICE = "cpu"
IMAGE_SIZE = 256
BATCH_SIZE = 16
EPOCHS = 100
LEARNING_RATE = 0.0002
BETA1 = 0.5

DEFECT_TYPES = ["scratch", "particle", "contamination", "crack", "normal"]
NUM_CLASSES = len(DEFECT_TYPES)

DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
UPLOAD_DIR = BASE_DIR / "uploads"
FRONTEND_DIR = BASE_DIR / "frontend"

DATABASE_URL = f"sqlite:///{BASE_DIR / 'wafer_defects.db'}"

GAN_LATENT_DIM = 100

for directory in [DATA_DIR, MODELS_DIR, UPLOAD_DIR, FRONTEND_DIR]:
    directory.mkdir(exist_ok=True, parents=True)
