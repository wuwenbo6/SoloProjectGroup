import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
RESULT_DIR = BASE_DIR / "results"

UPLOAD_DIR.mkdir(exist_ok=True)
RESULT_DIR.mkdir(exist_ok=True)

MAX_MISMATCHES = 4
GRNA_LENGTH = 20

CRISPR_MODE_CAS9 = "crisprn"
CRISPR_MODE_DCAS9 = "crispra"
PAM_SEQUENCE = "NGG"
PAM_LENGTH = 3

BWA_PATH = "bwa"
BWA_AVAILABLE = False
try:
    import subprocess
    subprocess.run([BWA_PATH, "version"], capture_output=True, check=True)
    BWA_AVAILABLE = True
except:
    pass
