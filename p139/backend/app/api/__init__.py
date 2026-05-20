from fastapi import APIRouter
from .circuits import router as circuits_router
from .jobs import router as jobs_router
from .error_correction import router as ec_router

api_router = APIRouter()
api_router.include_router(circuits_router)
api_router.include_router(jobs_router)
api_router.include_router(ec_router)

__all__ = ["api_router"]
