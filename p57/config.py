import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    DATABASE_URI = os.getenv('DATABASE_URI', f'sqlite:///{os.path.join(BASE_DIR, "database", "shadow_puppet.db")}')
    
    MUSEUM_API_URL = os.getenv('MUSEUM_API_URL', 'https://api.shadowpuppet-museum.org')
    MUSEUM_API_KEY = os.getenv('MUSEUM_API_KEY', 'demo_key')
    
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'data', 'uploads')
    ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'json'}
    
    SECRET_KEY = os.getenv('SECRET_KEY', 'shadow_puppet_secret_key_2024')
    
    VISUALIZATION_THEME = {
        'background': '#1a1a2e',
        'paper_bgcolor': '#16213e',
        'font_color': '#e94560',
        'colorscale': 'Viridis'
    }

os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
