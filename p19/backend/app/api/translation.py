from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import AudioSample, DialectCategory
from app.auth import get_current_user
from app.models import User


router = APIRouter(prefix="/api/v1/translation", tags=["translation"])


class TranslationRequest(BaseModel):
    dialect_text: str
    dialect_category_id: Optional[int] = None
    target_language: str = "zh-CN"


class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    confidence: float
    dialect_name: Optional[str] = None
    alternatives: List[str] = []


class SimilarPhrase(BaseModel):
    dialect_text: str
    standard_text: str
    similarity: float
    sample_count: int


@router.post("/translate", response_model=TranslationResponse)
async def translate_dialect(
    request: TranslationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        dialect_name = None
        if request.dialect_category_id:
            category = await db.get(DialectCategory, request.dialect_category_id)
            if category:
                dialect_name = category.name
        
        translated_text, confidence, alternatives = await simple_translate(
            request.dialect_text,
            dialect_name,
            db
        )
        
        return TranslationResponse(
            original_text=request.dialect_text,
            translated_text=translated_text,
            confidence=confidence,
            dialect_name=dialect_name,
            alternatives=alternatives
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def simple_translate(dialect_text: str, dialect_name: Optional[str], db: AsyncSession):
    """简易翻译：基于已有语料的相似度匹配 + 基础词汇映射"""
    alternatives = []
    
    vocab_mapping = {
        "咩": "什么",
        "点解": "为什么",
        "系": "是",
        "唔": "不",
        "嘅": "的",
        "咁": "这么",
        "哋": "们",
        "睇": "看",
        "饮": "喝",
        "食": "吃",
        "嚟": "来",
        "去": "去",
        "边度": "哪里",
        "边个": "谁",
        "几": "多少",
        "几多": "多少",
        "仲": "还",
        "咗": "了",
        "紧": "正在",
        "住": "着",
        "好嘅": "好的",
        "唔该": "谢谢",
        "多谢": "谢谢",
        "对唔住": "对不起",
        "系唔系": "是不是",
        "得唔得": "行不行",
        "点样": "怎么样",
        "做咩": "干什么",
        "有冇": "有没有",
        "喺": "在",
        "喺度": "在这里",
        "而家": "现在",
        "今日": "今天",
        "听日": "明天",
        "寻日": "昨天",
        "琴日": "昨天",
        "朝早": "早上",
        "晏昼": "中午/下午",
        "晚黑": "晚上",
        "屋企": "家里",
        "返工": "上班",
        "放工": "下班",
        "返工": "上班",
        "瞓觉": "睡觉",
        "冲凉": "洗澡",
        "衫": "衣服",
        "裤": "裤子",
        "鞋": "鞋子",
        "水": "水",
        "茶": "茶",
        "饭": "饭",
        "餸": "菜",
        "钱": "钱",
        "银纸": "钞票",
        "蚊": "元",
        "个": "个",
        "只": "只",
        "条": "条",
        "本": "本",
        "杯": "杯",
        "碟": "盘子",
        "碗": "碗",
        "筷子": "筷子",
        "匙羹": "勺子",
        "刀": "刀",
        "叉": "叉子"
    }
    
    translated = dialect_text
    
    for dialect_word, standard in vocab_mapping.items():
        if dialect_word in translated:
            translated = translated.replace(dialect_word, standard)
            alternatives.append(f"{dialect_word} → {standard}")
    
    confidence = min(0.95, 0.5 + len(alternatives) * 0.05)
    
    if dialect_name:
        region_keywords = await get_region_keywords(dialect_name, db)
        for kw, replacement in region_keywords:
            if kw in translated:
                translated = translated.replace(kw, replacement)
                confidence = min(1.0, confidence + 0.03)
    
    if translated == dialect_text:
        confidence = 0.3
        alternatives = ["未找到明确匹配的方言词汇", "建议参考上下文手动标注"]
    
    return translated, confidence, alternatives[:5]


async def get_region_keywords(dialect_name: str, db: AsyncSession) -> List[tuple]:
    """获取特定方言区域的额外关键词映射"""
    keywords = {
        "粤语": [
            ("嘅", "的"), ("咗", "了"), ("喺", "在"), ("冇", "没有"),
            ("仲", "还"), ("咁", "这么"), ("点", "怎么"), ("咩", "什么")
        ],
        "客家话": [
            ("嘅", "的"), ("吂", "还没"), ("嘛", "吗"), ("唵", "我们"),
            ("唔", "不"), ("系", "是"), ("做脉个", "干什么")
        ],
        "闽南语": [
            ("的", "的"), ("了", "了"), ("伫", "在"), ("无", "没有"),
            ("嘛", "也"), ("按呢", "这样"), ("啥", "什么")
        ],
        "吴语": [
            ("个", "的"), ("咾", "了"), ("勒", "在"), ("呒", "不"),
            ("朆", "没"), ("侪", "都"), ("畀", "给")
        ],
        "湘语": [
            ("咯", "的"), ("哒", "了"), ("在", "在"), ("冇", "没有"),
            ("何解", "为什么"), ("么子", "什么")
        ]
    }
    
    for dialect, kws in keywords.items():
        if dialect in dialect_name:
            return kws
    
    return []


@router.get("/similar-phrases", response_model=List[SimilarPhrase])
async def get_similar_phrases(
    dialect_category_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取相似短语推荐，辅助标注"""
    result = await db.execute(
        select(AudioSample)
        .where(AudioSample.dialect_category_id == dialect_category_id)
        .where(AudioSample.annotation_text.isnot(None))
        .limit(50)
    )
    samples = result.scalars().all()
    
    phrases = {}
    for sample in samples:
        text = sample.annotation_text.strip()
        if len(text) >= 2:
            if text in phrases:
                phrases[text]["count"] += 1
            else:
                phrases[text] = {
                    "dialect_text": text,
                    "standard_text": await get_standard_equivalent(text),
                    "similarity": 0.85,
                    "sample_count": 1
                }
    
    sorted_phrases = sorted(
        phrases.values(),
        key=lambda x: x["sample_count"],
        reverse=True
    )[:limit]
    
    return [SimilarPhrase(**p) for p in sorted_phrases]


async def get_standard_equivalent(dialect_text: str) -> str:
    """获取方言文本的标准对应表达（简化版）"""
    mapping = {
        "我系边个": "我是谁",
        "你食饭未": "你吃饭了吗",
        "佢去咗边度": "他去哪里了",
        "今日天气几好": "今天天气很好",
        "唔该借过": "麻烦让一下",
        "对唔住": "对不起",
        "几多钱": "多少钱",
        "有冇搞错": "有没有搞错"
    }
    
    return mapping.get(dialect_text, dialect_text)


@router.post("/batch-suggest")
async def batch_suggest_translation(
    sample_ids: List[int],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """批量获取翻译建议"""
    suggestions = []
    
    for sample_id in sample_ids:
        sample = await db.get(AudioSample, sample_id)
        if sample and sample.annotation_text:
            translated, confidence, _ = await simple_translate(
                sample.annotation_text,
                None,
                db
            )
            suggestions.append({
                "sample_id": sample_id,
                "original": sample.annotation_text,
                "suggested": translated,
                "confidence": confidence
            })
    
    return {"suggestions": suggestions}
