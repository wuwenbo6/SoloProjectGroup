from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from ..core.database import get_db
from ..core.security import get_current_active_user, require_role
from ..models import User, UserRole, DialectCategory
from ..schemas import (
    DialectCategoryCreate,
    DialectCategoryResponse,
    FeatureClusterResponse
)
from ..services.clustering_service import clustering_service

router = APIRouter(prefix="/dialects", tags=["dialects"])


@router.post("/categories", response_model=DialectCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_dialect_category(
    category_in: DialectCategoryCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DialectCategory).where(
            DialectCategory.code == category_in.code
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dialect category with this code already exists"
        )
    
    category = DialectCategory(**category_in.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/categories", response_model=List[DialectCategoryResponse])
async def get_dialect_categories(
    parent_id: Optional[int] = None,
    region: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(DialectCategory)
    
    if parent_id is not None:
        query = query.where(DialectCategory.parent_id == parent_id)
    if region:
        query = query.where(DialectCategory.region.like(f"%{region}%"))
    
    result = await db.execute(query)
    categories = result.scalars().all()
    return categories


@router.get("/categories/{category_id}", response_model=DialectCategoryResponse)
async def get_dialect_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    category = await db.get(DialectCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Dialect category not found")
    return category


@router.put("/categories/{category_id}", response_model=DialectCategoryResponse)
async def update_dialect_category(
    category_id: int,
    category_in: DialectCategoryCreate,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    category = await db.get(DialectCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Dialect category not found")
    
    update_data = category_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dialect_category(
    category_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    category = await db.get(DialectCategory, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Dialect category not found")
    
    await db.delete(category)
    await db.commit()
    return None


@router.post("/clusters/kmeans", response_model=List[FeatureClusterResponse])
async def run_kmeans_clustering(
    n_clusters: int = 5,
    region: Optional[str] = None,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    try:
        clusters = await clustering_service.perform_kmeans_clustering(
            db, n_clusters=n_clusters, region=region
        )
        return clusters
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/clusters/dbscan", response_model=List[FeatureClusterResponse])
async def run_dbscan_clustering(
    eps: float = 0.5,
    min_samples: int = 5,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER)),
    db: AsyncSession = Depends(get_db)
):
    try:
        clusters = await clustering_service.perform_dbscan_clustering(
            db, eps=eps, min_samples=min_samples
        )
        return clusters
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/similar/{sample_id}")
async def find_similar_samples(
    sample_id: int,
    top_k: int = 5,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    similar_samples = await clustering_service.find_similar_samples(
        db, sample_id=sample_id, top_k=top_k
    )
    return {"similar_samples": similar_samples}


@router.post("/classify/{sample_id}")
async def classify_sample_dialect(
    sample_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clustering_service.classify_dialect(db, sample_id)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["error"]
        )
    return result
