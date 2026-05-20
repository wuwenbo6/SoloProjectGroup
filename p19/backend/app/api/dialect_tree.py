from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from collections import defaultdict
from ..core.database import get_db
from ..core.security import get_current_active_user
from ..models import User, DialectCategory, AudioSample
from ..schemas.dialect_tree import DialectTreeNode, DialectTreeStats

router = APIRouter(prefix="/dialect-tree", tags=["dialect-tree"])


def build_tree(
    categories: List[DialectCategory],
    parent_id: Optional[int] = None,
    level: int = 0,
    sample_counts: dict = None
) -> List[DialectTreeNode]:
    result = []
    for cat in categories:
        if cat.parent_id == parent_id:
            node = DialectTreeNode(
                id=cat.id,
                name=cat.name,
                code=cat.code,
                level=level,
                region=cat.region,
                description=cat.description,
                sample_count=sample_counts.get(cat.id, 0) if sample_counts else 0
            )
            children = build_tree(categories, cat.id, level + 1, sample_counts)
            node.children = children
            result.append(node)
    return result


def calculate_max_depth(nodes: List[DialectTreeNode], current_depth: int = 0) -> int:
    if not nodes:
        return current_depth
    return max(calculate_max_depth(node.children, current_depth + 1) for node in nodes)


def count_leaf_nodes(nodes: List[DialectTreeNode]) -> int:
    count = 0
    for node in nodes:
        if not node.children:
            count += 1
        else:
            count += count_leaf_nodes(node.children)
    return count


def aggregate_samples_by_level(nodes: List[DialectTreeNode], level_data: dict = None, current_level: int = 0) -> dict:
    if level_data is None:
        level_data = defaultdict(int)
    
    for node in nodes:
        level_data[current_level] += node.sample_count
        aggregate_samples_by_level(node.children, level_data, current_level + 1)
    
    return level_data


@router.get("/tree", response_model=List[DialectTreeNode])
async def get_dialect_tree(
    region: Optional[str] = None,
    min_samples: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(DialectCategory).order_by(DialectCategory.code)
    if region:
        query = query.where(DialectCategory.region.like(f"%{region}%"))
    
    result = await db.execute(query)
    categories = list(result.scalars().all())
    
    sample_result = await db.execute(
        select(
            AudioSample.dialect_category_id,
            func.count(AudioSample.id)
        ).group_by(AudioSample.dialect_category_id)
    )
    sample_counts = {row[0]: row[1] for row in sample_result.all()}
    
    if min_samples is not None:
        def filter_categories(cats: List[DialectCategory], parent_id: Optional[int] = None) -> List[int]:
            keep_ids = []
            for cat in cats:
                if cat.parent_id == parent_id:
                    child_ids = filter_categories(cats, cat.id)
                    cat_samples = sample_counts.get(cat.id, 0)
                    if child_ids or cat_samples >= min_samples:
                        keep_ids.append(cat.id)
                        keep_ids.extend(child_ids)
            return keep_ids
        
        keep_ids = set(filter_categories(categories))
        categories = [c for c in categories if c.id in keep_ids]
    
    return build_tree(categories, None, 0, sample_counts)


@router.get("/stats", response_model=DialectTreeStats)
async def get_dialect_tree_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    categories_result = await db.execute(select(DialectCategory))
    categories = list(categories_result.scalars().all())
    
    samples_result = await db.execute(
        select(
            AudioSample.dialect_category_id,
            func.count(AudioSample.id)
        ).group_by(AudioSample.dialect_category_id)
    )
    sample_counts = {row[0]: row[1] for row in samples_result.all()}
    
    tree = build_tree(categories, None, 0, sample_counts)
    
    total_samples = sum(cat.sample_count for cat in categories)
    
    return {
        "total_categories": len(categories),
        "total_samples": total_samples,
        "max_depth": calculate_max_depth(tree),
        "leaf_nodes": count_leaf_nodes(tree),
        "samples_by_level": dict(aggregate_samples_by_level(tree))
    }


@router.get("/search")
async def search_dialect_categories(
    query: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DialectCategory).where(
            (DialectCategory.name.like(f"%{query}%")) |
            (DialectCategory.code.like(f"%{query}%")) |
            (DialectCategory.region.like(f"%{query}%"))
        ).limit(20)
    )
    categories = result.scalars().all()
    
    return [
        {
            "id": cat.id,
            "name": cat.name,
            "code": cat.code,
            "region": cat.region,
            "path": await get_category_path(db, cat.id)
        }
        for cat in categories
    ]


async def get_category_path(db: AsyncSession, category_id: int) -> List[dict]:
    path = []
    current_id = category_id
    
    while current_id is not None:
        result = await db.execute(
            select(DialectCategory).where(DialectCategory.id == current_id)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            break
        
        path.insert(0, {"id": category.id, "name": category.name})
        current_id = category.parent_id
    
    return path


@router.get("/path/{category_id}")
async def get_dialect_category_path(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    path = await get_category_path(db, category_id)
    return {"path": path}


@router.get("/{category_id}/samples")
async def get_category_samples(
    category_id: int,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    async def get_all_child_ids(parent_id: int) -> List[int]:
        result = await db.execute(
            select(DialectCategory.id).where(DialectCategory.parent_id == parent_id)
        )
        child_ids = [row[0] for row in result.all()]
        all_ids = child_ids.copy()
        for cid in child_ids:
            all_ids.extend(await get_all_child_ids(cid))
        return all_ids
    
    category_ids = [category_id] + await get_all_child_ids(category_id)
    
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.dialect_category_id.in_(category_ids))
        .offset(skip)
        .limit(limit)
    )
    samples = result.scalars().all()
    
    count_result = await db.execute(
        select(func.count(AudioSample.id)).where(AudioSample.dialect_category_id.in_(category_ids))
    )
    total = count_result.scalar_one()
    
    return {
        "total": total,
        "samples": samples
    }
