from fastapi import APIRouter
from .songs import router as songs_router
from .identify import router as identify_router
from .streaming import router as streaming_router

api_router = APIRouter()
api_router.include_router(songs_router)
api_router.include_router(identify_router)
api_router.include_router(streaming_router)

__all__ = ["api_router"]
