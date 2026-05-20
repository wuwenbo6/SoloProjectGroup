from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from models.database import get_db, Dialect, IntonationPattern
from datetime import datetime

router = APIRouter()

class DialectCreate(BaseModel):
    name: str
    branch: Optional[str] = None
    region: Optional[str] = None
    description: Optional[str] = None

class IntonationPatternCreate(BaseModel):
    dialect_id: int
    pattern_type: str
    pattern_data: str
    description: Optional[str] = None
    confidence: Optional[float] = 0.8

@router.post("/dialects")
async def create_dialect(
    dialect: DialectCreate,
    db: Session = Depends(get_db)
):
    try:
        db_dialect = Dialect(
            name=dialect.name,
            branch=dialect.branch,
            region=dialect.region,
            description=dialect.description,
            is_active=True
        )
        db.add(db_dialect)
        db.commit()
        db.refresh(db_dialect)
        return {"success": True, "dialect": db_dialect, "message": "方言创建成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.get("/dialects")
async def list_dialects(
    branch: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Dialect)
    if branch:
        query = query.filter(Dialect.branch == branch)
    if is_active is not None:
        query = query.filter(Dialect.is_active == is_active)
    dialects = query.all()
    return {"total": len(dialects), "dialects": dialects}

@router.get("/dialects/{dialect_id}")
async def get_dialect(
    dialect_id: int,
    db: Session = Depends(get_db)
):
    dialect = db.query(Dialect).filter(Dialect.id == dialect_id).first()
    if not dialect:
        raise HTTPException(status_code=404, detail="方言不存在")
    return dialect

@router.put("/dialects/{dialect_id}")
async def update_dialect(
    dialect_id: int,
    dialect_data: DialectCreate,
    db: Session = Depends(get_db)
):
    dialect = db.query(Dialect).filter(Dialect.id == dialect_id).first()
    if not dialect:
        raise HTTPException(status_code=404, detail="方言不存在")
    
    dialect.name = dialect_data.name
    dialect.branch = dialect_data.branch
    dialect.region = dialect_data.region
    dialect.description = dialect_data.description
    dialect.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "dialect": dialect, "message": "更新成功"}

@router.post("/intonation-patterns")
async def create_intonation_pattern(
    pattern: IntonationPatternCreate,
    db: Session = Depends(get_db)
):
    try:
        db_pattern = IntonationPattern(
            dialect_id=pattern.dialect_id,
            pattern_type=pattern.pattern_type,
            pattern_data=pattern.pattern_data,
            description=pattern.description,
            confidence=pattern.confidence
        )
        db.add(db_pattern)
        db.commit()
        db.refresh(db_pattern)
        return {"success": True, "pattern": db_pattern, "message": "语调模式创建成功"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

@router.get("/intonation-patterns/{dialect_id}")
async def get_intonation_patterns(
    dialect_id: int,
    pattern_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(IntonationPattern).filter(IntonationPattern.dialect_id == dialect_id)
    if pattern_type:
        query = query.filter(IntonationPattern.pattern_type == pattern_type)
    patterns = query.all()
    return {"total": len(patterns), "patterns": patterns}

@router.get("/branches")
async def get_dialect_branches(db: Session = Depends(get_db)):
    branches = db.query(Dialect.branch).distinct().all()
    return {"branches": [b[0] for b in branches if b[0]]}

@router.post("/initialize-sample-data")
async def initialize_sample_data(db: Session = Depends(get_db)):
    sample_dialects = [
        {"name": "福州话", "branch": "闽语-闽东语", "region": "福建福州", "description": "闽东语代表方言，福州地区使用"},
        {"name": "厦门话", "branch": "闽语-闽南语", "region": "福建厦门", "description": "闽南语代表方言，厦门地区使用"},
        {"name": "长沙话", "branch": "湘语-长益片", "region": "湖南长沙", "description": "湘语代表方言，长沙地区使用"},
        {"name": "双峰话", "branch": "湘语-娄邵片", "region": "湖南双峰", "description": "湘语老湘语代表，双峰地区使用"},
        {"name": "莆田话", "branch": "闽语-莆仙语", "region": "福建莆田", "description": "莆仙语代表方言，莆田地区使用"},
    ]
    
    created_count = 0
    for dialect_data in sample_dialects:
        existing = db.query(Dialect).filter(Dialect.name == dialect_data["name"]).first()
        if not existing:
            dialect = Dialect(**dialect_data, is_active=True)
            db.add(dialect)
            created_count += 1
    
    db.commit()
    return {"success": True, "created_count": created_count, "message": f"成功初始化 {created_count} 种方言数据"}
