from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from app.core.config import settings


class MongoDB:
    client: AsyncIOMotorClient = None
    sync_client: MongoClient = None


db = MongoDB()


async def get_database() -> AsyncIOMotorClient:
    return db.client[settings.MONGODB_DB_NAME]


def get_sync_database():
    if not db.sync_client:
        db.sync_client = MongoClient(settings.MONGODB_URL)
    return db.sync_client[settings.MONGODB_DB_NAME]


async def connect_to_mongo():
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)


async def close_mongo_connection():
    db.client.close()
