from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime
import json

from database import init_db, get_db, TrainingHistory
from dtw_calculator import DTWCalculator
from angle_analyzer import AngleAnalyzer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

dtw_calculator = DTWCalculator()
angle_analyzer = AngleAnalyzer()

class PoseFrame(BaseModel):
    keypoints: Dict[str, Dict[str, float]]

class RecordingRequest(BaseModel):
    movement_name: str
    pose_frames: List[Dict]
    duration_seconds: float

class TrainingRecord(BaseModel):
    movement_name: str
    score: float
    similarity_score: float
    duration_seconds: float
    feedback: Optional[str] = None

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/")
async def root():
    return {"message": "太极动作分析系统 API"}

@app.get("/api/movements")
async def get_movements():
    return {"movements": dtw_calculator.get_available_movements()}

@app.websocket("/ws/pose")
async def websocket_pose(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            pose_data = json.loads(data)
            
            analysis = angle_analyzer.analyze_frame(pose_data)
            
            await websocket.send_text(json.dumps(analysis))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")

@app.post("/api/analyze")
async def analyze_pose(pose_frame: PoseFrame):
    analysis = angle_analyzer.analyze_frame(pose_frame.keypoints)
    return analysis

@app.post("/api/record")
async def record_movement(request: RecordingRequest, db = Depends(get_db)):
    try:
        similarity_score, frame_mapping = dtw_calculator.calculate_similarity(
            request.pose_frames,
            request.movement_name
        )
        
        angle_analyses = []
        for frame in request.pose_frames:
            analysis = angle_analyzer.analyze_frame(frame)
            angle_analyses.append(analysis)
        
        angle_score = angle_analyzer.calculate_overall_score(angle_analyses)
        
        final_score = (similarity_score * 0.6) + (angle_score * 0.4)
        final_score = round(final_score, 1)
        
        feedback_messages = []
        for analysis in angle_analyses:
            for fb in analysis.get("feedback", []):
                if fb.get("severity") == "warning":
                    feedback_messages.append(fb.get("suggestion"))
        
        unique_feedback = list(set(feedback_messages))
        feedback_str = "; ".join(unique_feedback[:5]) if unique_feedback else "动作完成良好"
        
        record = TrainingHistory(
            movement_name=request.movement_name,
            score=final_score,
            similarity_score=similarity_score,
            duration_seconds=request.duration_seconds,
            feedback=feedback_str
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        
        return {
            "score": final_score,
            "similarity_score": round(similarity_score, 1),
            "angle_score": angle_score,
            "feedback": feedback_str,
            "record_id": record.id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_training_history(db = Depends(get_db)):
    records = db.query(TrainingHistory).order_by(TrainingHistory.timestamp.desc()).all()
    return {
        "history": [
            {
                "id": r.id,
                "movement_name": r.movement_name,
                "score": r.score,
                "similarity_score": r.similarity_score,
                "duration_seconds": r.duration_seconds,
                "timestamp": r.timestamp.isoformat(),
                "feedback": r.feedback
            }
            for r in records
        ]
    }

@app.delete("/api/history/{record_id}")
async def delete_training_record(record_id: int, db = Depends(get_db)):
    record = db.query(TrainingHistory).filter(TrainingHistory.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(record)
    db.commit()
    return {"message": "删除成功"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
