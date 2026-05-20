from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

USER_DB_URL = f"sqlite:///{os.path.join(BASE_DIR, '../user.db')}"
PHOTO_DB_URL = f"sqlite:///{os.path.join(BASE_DIR, '../photo.db')}"
REPAIR_DB_URL = f"sqlite:///{os.path.join(BASE_DIR, '../repair.db')}"

user_engine = create_engine(USER_DB_URL, connect_args={"check_same_thread": False})
photo_engine = create_engine(PHOTO_DB_URL, connect_args={"check_same_thread": False})
repair_engine = create_engine(REPAIR_DB_URL, connect_args={"check_same_thread": False})

UserSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=user_engine)
PhotoSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=photo_engine)
RepairSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=repair_engine)

Base = declarative_base()


def get_user_db():
    db = UserSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_photo_db():
    db = PhotoSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_repair_db():
    db = RepairSessionLocal()
    try:
        yield db
    finally:
        db.close()
