from database import engine, Base
from models import CameraProfile, PhotoArchive
import os

def init_database():
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "film_scanner.db")
    
    if os.path.exists(db_path):
        os.remove(db_path)
        print("已删除旧数据库")
    
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成，表已创建")

if __name__ == "__main__":
    init_database()
