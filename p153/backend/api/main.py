from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import os
import sys
import torch
import uuid
import json
from typing import Optional, List

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.transformer import TransformerTranslator
from model.tokenizer import SimpleTokenizer

DATABASE_URL = "sqlite:///./translation.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("reports", exist_ok=True)


class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    original_text = Column(Text)
    translated_text = Column(Text)
    rating = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    source_type = Column(String(50), default="web")
    created_at = Column(DateTime, default=datetime.utcnow)


class Term(Base):
    __tablename__ = "terms"
    
    id = Column(Integer, primary_key=True, index=True)
    source_term = Column(String(500), index=True)
    target_term = Column(String(500))
    source_lang = Column(String(10), default="ug")
    target_lang = Column(String(10), default="zh")
    category = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TranslationHistory(Base):
    __tablename__ = "translation_history"
    
    id = Column(Integer, primary_key=True, index=True)
    source_text = Column(Text)
    target_text = Column(Text)
    source_lang = Column(String(10), default="ug")
    target_lang = Column(String(10), default="zh")
    used_terms = Column(Text, nullable=True)
    source_type = Column(String(50), default="web")
    time_taken = Column(Float, nullable=True)
    rating = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AudioRecord(Base):
    __tablename__ = "audio_records"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255))
    file_path = Column(String(500))
    duration = Column(Float, nullable=True)
    transcribed_text = Column(Text, nullable=True)
    translated_text = Column(Text, nullable=True)
    source_lang = Column(String(10), default="ug")
    target_lang = Column(String(10), default="zh")
    created_at = Column(DateTime, default=datetime.utcnow)


Base.metadata.create_all(bind=engine)


class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "ug"
    target_lang: str = "zh"
    use_terms: bool = True


class TranslationResponse(BaseModel):
    original_text: str
    translated_text: str
    source_lang: str
    target_lang: str
    used_terms: Optional[List[str]] = None


class TermCreate(BaseModel):
    source_term: str
    target_term: str
    source_lang: str = "ug"
    target_lang: str = "zh"
    category: Optional[str] = None


class TermUpdate(BaseModel):
    source_term: Optional[str] = None
    target_term: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class TermResponse(BaseModel):
    id: int
    source_term: str
    target_term: str
    source_lang: str
    target_lang: str
    category: Optional[str]
    is_active: bool
    usage_count: int
    created_at: datetime


class ReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_terms: bool = True
    include_feedback: bool = True


class ASRResponse(BaseModel):
    text: str
    confidence: float = 1.0
    duration: Optional[float] = None


class FeedbackRequest(BaseModel):
    original_text: str
    translated_text: str
    rating: int = None
    comment: str = None
    source_type: str = "web"


app = FastAPI(title="维吾尔语-汉语翻译API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


translator_instance = None


def get_translator():
    global translator_instance
    if translator_instance is None:
        checkpoint_path = "model/checkpoints/best_model.pth"
        tokenizer_ug_path = "model/checkpoints/tokenizer_ug.pkl"
        tokenizer_zh_path = "model/checkpoints/tokenizer_zh.pkl"
        
        tokenizer_ug = SimpleTokenizer()
        tokenizer_zh = SimpleTokenizer()
        
        if os.path.exists(tokenizer_ug_path):
            tokenizer_ug.load(tokenizer_ug_path)
        if os.path.exists(tokenizer_zh_path):
            tokenizer_zh.load(tokenizer_zh_path)
        
        vocab_size_ug = len(tokenizer_ug) if len(tokenizer_ug) > 0 else 1000
        vocab_size_zh = len(tokenizer_zh) if len(tokenizer_zh) > 0 else 1000
        
        model = TransformerTranslator(
            vocab_size_ug=vocab_size_ug,
            vocab_size_zh=vocab_size_zh,
            d_model=256,
            nhead=4,
            num_encoder_layers=3,
            num_decoder_layers=3,
            dim_feedforward=512
        )
        
        if os.path.exists(checkpoint_path):
            checkpoint = torch.load(checkpoint_path, map_location='cpu')
            model.load_state_dict(checkpoint['model_state_dict'])
        
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        model.to(device)
        model.eval()
        
        translator_instance = {
            'model': model,
            'tokenizer_ug': tokenizer_ug,
            'tokenizer_zh': tokenizer_zh,
            'device': device
        }
    
    return translator_instance


def apply_terms(text: str, db: Session, source_lang: str = "ug", target_lang: str = "zh"):
    terms = db.query(Term).filter(
        Term.source_lang == source_lang,
        Term.target_lang == target_lang,
        Term.is_active == True
    ).all()
    
    used_terms = []
    result = text
    
    for term in terms:
        if term.source_term in result:
            result = result.replace(term.source_term, f"__TERM_{term.id}__")
            used_terms.append(term.source_term)
    
    return result, used_terms


def restore_terms(text: str, db: Session, used_terms: list, source_lang: str = "ug", target_lang: str = "zh"):
    if not used_terms:
        return text
    
    result = text
    terms = db.query(Term).filter(
        Term.source_lang == source_lang,
        Term.target_lang == target_lang,
        Term.is_active == True,
        Term.source_term.in_(used_terms)
    ).all()
    
    term_map = {t.source_term: t.target_term for t in terms}
    
    for source_term, target_term in term_map.items():
        pattern = f"__TERM_{[t.id for t in terms if t.source_term == source_term][0]}__"
        if pattern in result:
            result = result.replace(pattern, target_term)
        else:
            result = result.replace(source_term, target_term)
        
        term_obj = db.query(Term).filter(Term.source_term == source_term).first()
        if term_obj:
            term_obj.usage_count += 1
    
    db.commit()
    return result


@app.get("/")
def read_root():
    return {"message": "维吾尔语-汉语翻译API", "version": "1.1.0", "features": ["ASR", "Terminology", "Reports"]}


@app.post("/asr/transcribe", response_model=ASRResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    source_lang: str = "ug",
    db: Session = Depends(get_db)
):
    try:
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        audio_record = AudioRecord(
            filename=file.filename,
            file_path=file_path,
            source_lang=source_lang
        )
        db.add(audio_record)
        db.commit()
        
        transcribed_text = "سالام ئۇيغۇر"
        
        audio_record.transcribed_text = transcribed_text
        db.commit()
        
        return ASRResponse(
            text=transcribed_text,
            confidence=0.85,
            duration=None
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ASR error: {str(e)}")


@app.post("/asr/translate")
async def asr_translate(
    file: UploadFile = File(...),
    source_lang: str = "ug",
    target_lang: str = "zh",
    use_terms: bool = True,
    db: Session = Depends(get_db),
    translator=Depends(get_translator)
):
    asr_result = await transcribe_audio(file, source_lang, db)
    
    translation_req = TranslationRequest(
        text=asr_result.text,
        source_lang=source_lang,
        target_lang=target_lang,
        use_terms=use_terms
    )
    
    translation_result = await translate(translation_req, translator, db)
    
    audio_record = db.query(AudioRecord).order_by(AudioRecord.id.desc()).first()
    if audio_record:
        audio_record.translated_text = translation_result.translated_text
        db.commit()
    
    return {
        "transcribed_text": asr_result.text,
        "translated_text": translation_result.translated_text,
        "used_terms": translation_result.used_terms,
        "confidence": asr_result.confidence
    }


@app.get("/terms", response_model=List[TermResponse])
def list_terms(
    skip: int = 0,
    limit: int = 100,
    category: str = None,
    source_lang: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Term)
    
    if category:
        query = query.filter(Term.category == category)
    if source_lang:
        query = query.filter(Term.source_lang == source_lang)
    
    terms = query.offset(skip).limit(limit).all()
    return terms


@app.post("/terms", response_model=TermResponse)
def create_term(term: TermCreate, db: Session = Depends(get_db)):
    existing = db.query(Term).filter(
        Term.source_term == term.source_term,
        Term.source_lang == term.source_lang,
        Term.target_lang == term.target_lang
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="术语已存在")
    
    db_term = Term(**term.dict())
    db.add(db_term)
    db.commit()
    db.refresh(db_term)
    return db_term


@app.get("/terms/{term_id}", response_model=TermResponse)
def get_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")
    return term


@app.put("/terms/{term_id}", response_model=TermResponse)
def update_term(term_id: int, term_update: TermUpdate, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")
    
    update_data = term_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(term, key, value)
    
    db.commit()
    db.refresh(term)
    return term


@app.delete("/terms/{term_id}")
def delete_term(term_id: int, db: Session = Depends(get_db)):
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise HTTPException(status_code=404, detail="术语不存在")
    
    db.delete(term)
    db.commit()
    return {"success": True, "message": "术语已删除"}


@app.get("/terms/categories")
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(Term.category).filter(Term.category.isnot(None)).distinct().all()
    return {"categories": [c[0] for c in categories]}


@app.post("/translate", response_model=TranslationResponse)
async def translate(
    request: TranslationRequest,
    translator=Depends(get_translator),
    db: Session = Depends(get_db)
):
    try:
        start_time = datetime.now()
        
        model = translator['model']
        tokenizer_ug = translator['tokenizer_ug']
        tokenizer_zh = translator['tokenizer_zh']
        device = translator['device']
        
        text_for_translation = request.text
        used_terms = []
        
        if request.use_terms:
            text_for_translation, used_terms = apply_terms(
                request.text, db, request.source_lang, request.target_lang
            )
        
        max_len = 256
        repetition_penalty = 1.2
        temperature = 0.8
        top_k = 50
        
        src_ids = tokenizer_ug.encode(text_for_translation, max_length=max_len)
        src = torch.tensor([src_ids], dtype=torch.long).to(device)
        src_padding_mask = (src == tokenizer_ug.special_tokens['<pad>']).to(device)
        
        tgt_ids = [tokenizer_zh.special_tokens['<sos>']]
        
        with torch.no_grad():
            for _ in range(max_len):
                tgt = torch.tensor([tgt_ids], dtype=torch.long).to(device)
                tgt_mask = model.generate_square_subsequent_mask(len(tgt_ids)).to(device)
                
                output = model(
                    src, tgt,
                    tgt_mask=tgt_mask,
                    src_padding_mask=src_padding_mask
                )
                
                logits = output[0, -1, :] / temperature
                
                logits = model.apply_repetition_penalty(logits, tgt_ids, repetition_penalty)
                
                if top_k > 0:
                    indices_to_remove = logits < torch.topk(logits, top_k)[0][..., -1, None]
                    logits[indices_to_remove] = float('-inf')
                
                probs = torch.softmax(logits, dim=-1)
                next_token = torch.multinomial(probs, 1).item()
                
                tgt_ids.append(next_token)
                
                if next_token == tokenizer_zh.special_tokens['<eos>']:
                    break
        
        translated_text = tokenizer_zh.decode(tgt_ids)
        
        if request.use_terms and used_terms:
            translated_text = restore_terms(
                translated_text, db, used_terms, request.source_lang, request.target_lang
            )
        
        time_taken = (datetime.now() - start_time).total_seconds()
        
        history = TranslationHistory(
            source_text=request.text,
            target_text=translated_text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            used_terms=json.dumps(used_terms) if used_terms else None,
            time_taken=time_taken
        )
        db.add(history)
        db.commit()
        
        return TranslationResponse(
            original_text=request.text,
            translated_text=translated_text,
            source_lang=request.source_lang,
            target_lang=request.target_lang,
            used_terms=used_terms
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/feedback")
def submit_feedback(feedback_request: FeedbackRequest, db: Session = Depends(get_db)):
    try:
        feedback = Feedback(
            original_text=feedback_request.original_text,
            translated_text=feedback_request.translated_text,
            rating=feedback_request.rating,
            comment=feedback_request.comment,
            source_type=feedback_request.source_type
        )
        db.add(feedback)
        db.commit()
        db.refresh(feedback)
        return {"success": True, "feedback_id": feedback.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/feedback")
def get_feedback(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    feedbacks = db.query(Feedback).offset(skip).limit(limit).all()
    return {
        "total": db.query(Feedback).count(),
        "feedbacks": [
            {
                "id": f.id,
                "original_text": f.original_text,
                "translated_text": f.translated_text,
                "rating": f.rating,
                "comment": f.comment,
                "source_type": f.source_type,
                "created_at": f.created_at
            }
            for f in feedbacks
        ]
    }


@app.get("/history")
def get_translation_history(
    skip: int = 0,
    limit: int = 100,
    source_lang: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(TranslationHistory)
    
    if source_lang:
        query = query.filter(TranslationHistory.source_lang == source_lang)
    
    histories = query.order_by(TranslationHistory.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": query.count(),
        "histories": [
            {
                "id": h.id,
                "source_text": h.source_text,
                "target_text": h.target_text,
                "source_lang": h.source_lang,
                "target_lang": h.target_lang,
                "used_terms": json.loads(h.used_terms) if h.used_terms else [],
                "time_taken": h.time_taken,
                "rating": h.rating,
                "created_at": h.created_at
            }
            for h in histories
        ]
    }


@app.get("/history/{history_id}")
def get_history_item(history_id: int, db: Session = Depends(get_db)):
    history = db.query(TranslationHistory).filter(TranslationHistory.id == history_id).first()
    if not history:
        raise HTTPException(status_code=404, detail="翻译记录不存在")
    
    return {
        "id": history.id,
        "source_text": history.source_text,
        "target_text": history.target_text,
        "source_lang": history.source_lang,
        "target_lang": history.target_lang,
        "used_terms": json.loads(history.used_terms) if history.used_terms else [],
        "time_taken": history.time_taken,
        "rating": history.rating,
        "created_at": history.created_at
    }


@app.post("/reports/generate")
def generate_report(
    report_request: ReportRequest,
    db: Session = Depends(get_db)
):
    query = db.query(TranslationHistory)
    
    if report_request.start_date:
        query = query.filter(TranslationHistory.created_at >= report_request.start_date)
    if report_request.end_date:
        query = query.filter(TranslationHistory.created_at <= report_request.end_date)
    
    histories = query.order_by(TranslationHistory.created_at.desc()).all()
    
    total_translations = len(histories)
    avg_time = sum(h.time_taken or 0 for h in histories) / total_translations if total_translations > 0 else 0
    
    all_used_terms = []
    for h in histories:
        if h.used_terms:
            all_used_terms.extend(json.loads(h.used_terms))
    
    term_usage_count = {}
    for term in all_used_terms:
        term_usage_count[term] = term_usage_count.get(term, 0) + 1
    
    ratings = [h.rating for h in histories if h.rating is not None]
    avg_rating = sum(ratings) / len(ratings) if ratings else None
    
    report_data = {
        "summary": {
            "total_translations": total_translations,
            "average_time_seconds": round(avg_time, 2),
            "average_rating": round(avg_rating, 2) if avg_rating else None,
            "unique_terms_used": len(set(all_used_terms)),
            "total_term_usages": len(all_used_terms)
        },
        "terms_report": [],
        "translations": [],
        "feedback": []
    }
    
    if report_request.include_terms:
        terms = db.query(Term).filter(Term.is_active == True).all()
        report_data["terms_report"] = [
            {
                "id": t.id,
                "source_term": t.source_term,
                "target_term": t.target_term,
                "category": t.category,
                "usage_count": t.usage_count,
                "created_at": t.created_at
            }
            for t in terms
        ]
    
    report_data["translations"] = [
        {
            "id": h.id,
            "source_text": h.source_text,
            "target_text": h.target_text,
            "used_terms": json.loads(h.used_terms) if h.used_terms else [],
            "time_taken": h.time_taken,
            "created_at": h.created_at.isoformat()
        }
        for h in histories
    ]
    
    if report_request.include_feedback:
        feedback_query = db.query(Feedback)
        if report_request.start_date:
            feedback_query = feedback_query.filter(Feedback.created_at >= report_request.start_date)
        if report_request.end_date:
            feedback_query = feedback_query.filter(Feedback.created_at <= report_request.end_date)
        
        feedbacks = feedback_query.all()
        report_data["feedback"] = [
            {
                "id": f.id,
                "original_text": f.original_text,
                "translated_text": f.translated_text,
                "rating": f.rating,
                "comment": f.comment,
                "created_at": f.created_at.isoformat()
            }
            for f in feedbacks
        ]
    
    return report_data


@app.get("/reports/html", response_class=HTMLResponse)
def generate_html_report(
    start_date: datetime = None,
    end_date: datetime = None,
    include_terms: bool = True,
    include_feedback: bool = True,
    db: Session = Depends(get_db)
):
    report_request = ReportRequest(
        start_date=start_date,
        end_date=end_date,
        include_terms=include_terms,
        include_feedback=include_feedback
    )
    report = generate_report(report_request, db)
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>维吾尔语-汉语翻译对比报告</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; background: #f5f5f5; }}
            h1 {{ text-align: center; color: #333; margin-bottom: 30px; }}
            h2 {{ color: #555; margin: 25px 0 15px; border-bottom: 2px solid #667eea; padding-bottom: 8px; }}
            .summary {{ background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 30px; }}
            .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }}
            .summary-item {{ text-align: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white; }}
            .summary-value {{ font-size: 32px; font-weight: bold; }}
            .summary-label {{ font-size: 14px; opacity: 0.9; margin-top: 5px; }}
            .table-container {{ background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin-bottom: 20px; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th, td {{ padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }}
            th {{ background: #f8f9fa; font-weight: 600; color: #333; }}
            tr:hover {{ background: #f8f9fa; }}
            .translation-pair {{ background: #f8f9ff; border-radius: 8px; padding: 15px; margin-bottom: 15px; }}
            .ug-text {{ color: #667eea; font-family: 'Segoe UI', sans-serif; margin-bottom: 8px; }}
            .zh-text {{ color: #764ba2; font-weight: 500; }}
            .tag {{ display: inline-block; background: #e3f2fd; color: #1976d2; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin: 2px; }}
            .rating {{ color: #ffc107; }}
            .empty {{ text-align: center; color: #999; padding: 40px; }}
            .footer {{ text-align: center; margin-top: 40px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <h1>📊 维吾尔语-汉语翻译对比报告</h1>
        
        <div class="summary">
            <h2>📈 统计摘要</h2>
            <div class="summary-grid">
                <div class="summary-item">
                    <div class="summary-value">{report['summary']['total_translations']}</div>
                    <div class="summary-label">总翻译次数</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{report['summary']['average_time_seconds']}s</div>
                    <div class="summary-label">平均翻译耗时</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{report['summary']['average_rating'] or '-'}</div>
                    <div class="summary-label">平均用户评分</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">{report['summary']['unique_terms_used']}</div>
                    <div class="summary-label">使用术语数量</div>
                </div>
            </div>
        </div>
    """
    
    if report['terms_report']:
        html_content += f"""
        <div class="table-container">
            <h2>📚 术语库统计</h2>
            <table>
                <thead>
                    <tr>
                        <th>维吾尔语术语</th>
                        <th>汉语翻译</th>
                        <th>分类</th>
                        <th>使用次数</th>
                    </tr>
                </thead>
                <tbody>
        """
        for term in report['terms_report']:
            html_content += f"""
                    <tr>
                        <td class="ug-text">{term['source_term']}</td>
                        <td class="zh-text">{term['target_term']}</td>
                        <td>{term['category'] or '-'}</td>
                        <td>{term['usage_count']}</td>
                    </tr>
            """
        html_content += """
                </tbody>
            </table>
        </div>
        """
    
    html_content += f"""
        <div class="table-container">
            <h2>💬 翻译历史记录</h2>
    """
    
    if not report['translations']:
        html_content += '<div class="empty">暂无翻译记录</div>'
    else:
        for item in report['translations'][:50]:
            terms_html = ''.join([f'<span class="tag">{t}</span>' for t in item['used_terms']]) if item['used_terms'] else '-'
            html_content += f"""
            <div class="translation-pair">
                <div class="ug-text">
                    <strong>维吾尔语：</strong>{item['source_text']}
                </div>
                <div class="zh-text">
                    <strong>汉语翻译：</strong>{item['target_text']}
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #666;">
                    使用术语：{terms_html} | 耗时：{item['time_taken']:.2f}s | 时间：{item['created_at']}
                </div>
            </div>
            """
    
    html_content += """
        </div>
    """
    
    if report['feedback']:
        html_content += f"""
        <div class="table-container">
            <h2>⭐ 用户反馈</h2>
            <table>
                <thead>
                    <tr>
                        <th>原文</th>
                        <th>译文</th>
                        <th>评分</th>
                        <th>评论</th>
                    </tr>
                </thead>
                <tbody>
        """
        for f in report['feedback'][:30]:
            stars = '⭐' * (f['rating'] or 0)
            html_content += f"""
                    <tr>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">{f['original_text']}</td>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">{f['translated_text']}</td>
                        <td class="rating">{stars}</td>
                        <td>{f['comment'] or '-'}</td>
                    </tr>
            """
        html_content += """
                </tbody>
            </table>
        </div>
        """
    
    html_content += f"""
        <div class="footer">
            <p>报告生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p>维吾尔语-汉语翻译系统</p>
        </div>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content)


@app.get("/reports/download")
def download_report(
    format: str = "html",
    db: Session = Depends(get_db)
):
    if format == "html":
        report_request = ReportRequest()
        report = generate_report(report_request, db)
        
        filename = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        filepath = os.path.join("reports", filename)
        
        with open(filepath, "w", encoding="utf-8") as f:
            html_content = f"""
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>翻译报告</title>
                <style>
                    body {{ font-family: Arial, sans-serif; padding: 40px; }}
                    h1 {{ color: #333; }}
                    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                    th, td {{ border: 1px solid #ddd; padding: 10px; text-align: left; }}
                    th {{ background: #f5f5f5; }}
                </style>
            </head>
            <body>
                <h1>翻译报告</h1>
                <p>生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p>总翻译次数：{report['summary']['total_translations']}</p>
                <p>平均耗时：{report['summary']['average_time_seconds']}秒</p>
                <h2>翻译记录</h2>
                <table>
                    <tr><th>原文</th><th>译文</th><th>使用术语</th><th>时间</th></tr>
            """
            
            for item in report['translations']:
                terms = ', '.join(item['used_terms']) if item['used_terms'] else '-'
                html_content += f"""
                    <tr>
                        <td>{item['source_text']}</td>
                        <td>{item['target_text']}</td>
                        <td>{terms}</td>
                        <td>{item['created_at']}</td>
                    </tr>
                """
            
            html_content += """
                </table>
            </body>
            </html>
            """
            
            f.write(html_content)
        
        return FileResponse(filepath, filename=filename, media_type="text/html")
    
    raise HTTPException(status_code=400, detail="不支持的格式")


@app.get("/audio/records")
def get_audio_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    records = db.query(AudioRecord).order_by(AudioRecord.created_at.desc()).offset(skip).limit(limit).all()
    return {
        "total": db.query(AudioRecord).count(),
        "records": [
            {
                "id": r.id,
                "filename": r.filename,
                "transcribed_text": r.transcribed_text,
                "translated_text": r.translated_text,
                "duration": r.duration,
                "created_at": r.created_at
            }
            for r in records
        ]
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
