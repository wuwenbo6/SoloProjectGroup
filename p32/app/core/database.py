from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
import time
from app.core.config import settings

BaseTraceability = declarative_base()
BaseQuality = declarative_base()
BaseBatch = declarative_base()
BaseAuth = declarative_base()

POOL_SIZE = 20
MAX_OVERFLOW = 40
POOL_RECYCLE = 3600
POOL_PRE_PING = True


def _get_engine_config(db_url: str):
    if "sqlite" in db_url:
        return {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
            "connect_args": {"check_same_thread": False, "timeout": 30}
        }
    else:
        return {
            "pool_size": POOL_SIZE,
            "max_overflow": MAX_OVERFLOW,
            "pool_recycle": POOL_RECYCLE,
            "pool_pre_ping": POOL_PRE_PING,
            "pool_use_lifo": True,
            "pool_timeout": 30
        }


traceability_engine = create_engine(
    settings.TRACEABILITY_DB_URL,
    **_get_engine_config(settings.TRACEABILITY_DB_URL)
)
quality_engine = create_engine(
    settings.QUALITY_DB_URL,
    **_get_engine_config(settings.QUALITY_DB_URL)
)
batch_engine = create_engine(
    settings.BATCH_DB_URL,
    **_get_engine_config(settings.BATCH_DB_URL)
)
auth_engine = create_engine(
    settings.BATCH_DB_URL,
    **_get_engine_config(settings.BATCH_DB_URL)
)

TraceabilitySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=traceability_engine)
QualitySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=quality_engine)
BatchSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=batch_engine)
AuthSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=auth_engine)


def get_traceability_db():
    db = TraceabilitySessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_quality_db():
    db = QualitySessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_batch_db():
    db = BatchSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_auth_db():
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()
