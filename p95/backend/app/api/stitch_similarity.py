from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..db.database import get_db
from ..models.models import Stitch
from ..schemas.schemas import StitchResponse
import math
from collections import Counter

router = APIRouter(prefix="/stitches/similarity", tags=["stitch_similarity"])


def preprocess_text(text):
    if not text:
        return []
    text = text.lower()
    words = []
    current_word = []
    for char in text:
        if char.isalnum():
            current_word.append(char)
        else:
            if current_word:
                words.append(''.join(current_word))
                current_word = []
    if current_word:
        words.append(''.join(current_word))
    return words


def get_ngrams(words, n=2):
    ngrams = []
    for i in range(len(words) - n + 1):
        ngrams.append(' '.join(words[i:i + n]))
    return ngrams


def cosine_similarity(vec1, vec2):
    intersection = set(vec1.keys()) & set(vec2.keys())
    if not intersection:
        return 0.0
    
    numerator = sum([vec1[x] * vec2[x] for x in intersection])
    
    sum1 = sum([vec1[x] ** 2 for x in list(vec1.keys())])
    sum2 = sum([vec2[x] ** 2 for x in list(vec2.keys())])
    
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    
    if not denominator:
        return 0.0
    
    return float(numerator) / denominator


def calculate_similarity(stitch1, stitch2):
    weights = {
        'name': 0.3,
        'description': 0.25,
        'category': 0.2,
        'difficulty': 0.15,
        'materials': 0.1
    }
    
    total_similarity = 0.0
    
    name1_words = preprocess_text(stitch1.name)
    name2_words = preprocess_text(stitch2.name)
    name1_vec = Counter(name1_words + get_ngrams(name1_words, 2))
    name2_vec = Counter(name2_words + get_ngrams(name2_words, 2))
    total_similarity += cosine_similarity(name1_vec, name2_vec) * weights['name']
    
    desc1_words = preprocess_text(stitch1.description)
    desc2_words = preprocess_text(stitch2.description)
    desc1_vec = Counter(desc1_words)
    desc2_vec = Counter(desc2_words)
    total_similarity += cosine_similarity(desc1_vec, desc2_vec) * weights['description']
    
    if stitch1.category and stitch2.category and stitch1.category == stitch2.category:
        total_similarity += weights['category']
    
    if stitch1.difficulty and stitch2.difficulty and stitch1.difficulty == stitch2.difficulty:
        total_similarity += weights['difficulty']
    
    materials1_words = preprocess_text(stitch1.materials)
    materials2_words = preprocess_text(stitch2.materials)
    materials1_vec = Counter(materials1_words)
    materials2_vec = Counter(materials2_words)
    total_similarity += cosine_similarity(materials1_vec, materials2_vec) * weights['materials']
    
    return total_similarity


@router.get("/{stitch_id}", response_model=List[dict])
def get_similar_stitches(
    stitch_id: int,
    limit: int = Query(10, ge=1, le=50, description="返回的相似针法数量"),
    min_similarity: float = Query(0.1, ge=0, le=1, description="最小相似度阈值"),
    db: Session = Depends(get_db)
):
    target_stitch = db.query(Stitch).filter(Stitch.id == stitch_id).first()
    if not target_stitch:
        raise HTTPException(status_code=404, detail="Stitch not found")
    
    all_stitches = db.query(Stitch).filter(
        Stitch.id != stitch_id,
        Stitch.is_public == True
    ).all()
    
    similarities = []
    for stitch in all_stitches:
        similarity = calculate_similarity(target_stitch, stitch)
        if similarity >= min_similarity:
            similarities.append({
                'stitch': stitch,
                'similarity': similarity
            })
    
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    results = similarities[:limit]
    
    return [
        {
            **StitchResponse.from_orm(item['stitch']).dict(),
            'similarity': round(item['similarity'], 3)
        }
        for item in results
    ]


@router.post("/search", response_model=List[dict])
def search_similar_stitches(
    name: Optional[str] = Query(None, description="针法名称"),
    description: Optional[str] = Query(None, description="针法描述"),
    category: Optional[str] = Query(None, description="分类"),
    difficulty: Optional[str] = Query(None, description="难度"),
    materials: Optional[str] = Query(None, description="材料"),
    limit: int = Query(10, ge=1, le=50, description="返回的数量"),
    db: Session = Depends(get_db)
):
    class TempStitch:
        def __init__(self):
            self.name = name or ""
            self.description = description or ""
            self.category = category or ""
            self.difficulty = difficulty or ""
            self.materials = materials or ""
    
    temp = TempStitch()
    
    if not any([name, description, category, difficulty, materials]):
        raise HTTPException(status_code=400, detail="至少提供一个搜索条件")
    
    all_stitches = db.query(Stitch).filter(Stitch.is_public == True).all()
    
    similarities = []
    for stitch in all_stitches:
        similarity = calculate_similarity(temp, stitch)
        if similarity > 0:
            similarities.append({
                'stitch': stitch,
                'similarity': similarity
            })
    
    similarities.sort(key=lambda x: x['similarity'], reverse=True)
    results = similarities[:limit]
    
    return [
        {
            **StitchResponse.from_orm(item['stitch']).dict(),
            'similarity': round(item['similarity'], 3)
        }
        for item in results
    ]
