from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import os
import asyncio
import logging
from typing import Optional, List
from pydantic import BaseModel

from config import Config
from database import db_manager
from anomaly_detector import detector
from dingtalk_alert import notifier
from simulator import simulator
from signal_processing import processor
from kafka_consumer import consumer
from trend_prediction import trend_predictor
from fault_classifier import fault_classifier
from report_generator import report_generator

Config.ensure_dirs()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sensor Anomaly Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SensorDataRequest(BaseModel):
    sensor_id: str
    vibration: float
    swing: float
    temperature: float

class TrainingRequest(BaseModel):
    epochs: int = 50
    batch_size: int = 32

class TimeRangeRequest(BaseModel):
    sensor_id: str
    start_time: str
    end_time: str

consumer_task = None
simulator_task = None

@app.on_event("startup")
async def startup_event():
    global consumer_task
    
    detector.load()
    
    if consumer_task is None:
        consumer_task = asyncio.create_task(consumer.start_consuming())
        logger.info("Kafka consumer started")

@app.on_event("shutdown")
async def shutdown_event():
    global consumer_task, simulator_task
    
    consumer.stop()
    if consumer_task:
        consumer_task.cancel()
    
    simulator.stop()
    if simulator_task:
        simulator_task.cancel()
    
    db_manager.close()

@app.get("/")
async def root():
    return {"message": "Sensor Anomaly Detection API", "version": "1.0.0"}

@app.post("/api/sensor/data")
async def receive_sensor_data(data: SensorDataRequest):
    from kafka_producer import producer
    
    producer.send_sensor_data(
        sensor_id=data.sensor_id,
        vibration=data.vibration,
        swing=data.swing,
        temperature=data.temperature
    )
    
    return {"status": "success", "message": "Data sent to Kafka"}

@app.get("/api/sensor/{sensor_id}/latest")
async def get_latest_data(sensor_id: str, limit: int = 100):
    data = db_manager.get_latest_data(sensor_id, limit)
    return {"status": "success", "data": data}

@app.post("/api/sensor/history")
async def get_historical_data(request: TimeRangeRequest):
    try:
        start_time = datetime.fromisoformat(request.start_time)
        end_time = datetime.fromisoformat(request.end_time)
        
        data = db_manager.query_sensor_data(request.sensor_id, start_time, end_time)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid time format: {e}")

@app.get("/api/sensor/{sensor_id}/fft")
async def get_fft_analysis(sensor_id: str, duration: int = 10):
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(seconds=duration)
    
    data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
    
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Not enough data for FFT analysis")
    
    vibration_data = np.array([d['vibration'] for d in data])
    frequencies, amplitudes = processor.compute_fft(vibration_data, Config.SAMPLE_RATE)
    
    return {
        "status": "success",
        "sensor_id": sensor_id,
        "frequencies": frequencies.tolist(),
        "amplitudes": amplitudes.tolist()
    }

@app.get("/api/sensor/{sensor_id}/spectrogram")
async def get_spectrogram(sensor_id: str, duration: int = 30):
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(seconds=duration)
    
    data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
    
    if len(data) < 500:
        raise HTTPException(status_code=400, detail="Not enough data for spectrogram")
    
    vibration_data = np.array([d['vibration'] for d in data])
    frequencies, times, spectrogram = processor.compute_spectrogram(vibration_data, Config.SAMPLE_RATE)
    
    return {
        "status": "success",
        "sensor_id": sensor_id,
        "frequencies": frequencies.tolist(),
        "times": times.tolist(),
        "spectrogram": spectrogram.tolist()
    }

@app.get("/api/sensor/{sensor_id}/wavelet")
async def get_wavelet_transform(sensor_id: str, duration: int = 10):
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(seconds=duration)
    
    data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
    
    if len(data) < 500:
        raise HTTPException(status_code=400, detail="Not enough data for wavelet transform")
    
    vibration_data = np.array([d['vibration'] for d in data])
    frequencies, power_db, scales = processor.compute_wavelet_transform(vibration_data)
    
    return {
        "status": "success",
        "sensor_id": sensor_id,
        "frequencies": frequencies.tolist(),
        "scales": scales.tolist(),
        "power_db": power_db.tolist()
    }

@app.get("/api/sensor/{sensor_id}/features")
async def get_signal_features(sensor_id: str, duration: int = 5):
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(seconds=duration)
    
    data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
    
    if len(data) < 100:
        raise HTTPException(status_code=400, detail="Not enough data for feature extraction")
    
    vibration_data = np.array([d['vibration'] for d in data])
    features = processor.extract_features(vibration_data, Config.SAMPLE_RATE)
    
    return {"status": "success", "sensor_id": sensor_id, "features": features}

@app.get("/api/anomalies")
async def get_anomaly_events(sensor_id: Optional[str] = None, limit: int = 100):
    events = db_manager.query_anomaly_events(sensor_id=sensor_id)
    return {"status": "success", "events": events[:limit]}

@app.post("/api/model/train")
async def train_model(background_tasks: BackgroundTasks, request: TrainingRequest):
    background_tasks.add_task(_train_model_task, request.epochs, request.batch_size)
    return {"status": "success", "message": "Training started in background"}

async def _train_model_task(epochs: int, batch_size: int):
    try:
        logger.info(f"Starting model training: epochs={epochs}, batch_size={batch_size}")
        
        training_data = simulator.generate_training_data(duration_hours=0.5)
        
        logger.info(f"Generated training data: {len(training_data)} samples")
        
        result = detector.train(training_data, epochs=epochs, batch_size=batch_size)
        
        detector.save()
        
        final_loss = result['loss'][-1]
        
        await notifier.send_training_complete(epochs, result['threshold'], final_loss)
        
        logger.info(f"Model training complete. Final loss: {final_loss:.6f}")
        
    except Exception as e:
        logger.error(f"Model training failed: {e}")

@app.post("/api/model/train/upload")
async def train_model_upload(background_tasks: BackgroundTasks, file: UploadFile = File(...), epochs: int = 50, batch_size: int = 32):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    file_path = os.path.join(Config.UPLOAD_DIR, f"training_{datetime.now().timestamp()}.csv")
    
    try:
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        df = pd.read_csv(file_path)
        
        required_columns = ['vibration', 'swing', 'temperature']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(status_code=400, detail=f"CSV must contain columns: {required_columns}")
        
        background_tasks.add_task(_train_model_with_data, df, epochs, batch_size)
        
        return {"status": "success", "message": "Training started with uploaded data", "samples": len(df)}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {e}")

async def _train_model_with_data(df: pd.DataFrame, epochs: int, batch_size: int):
    try:
        logger.info(f"Starting model training with uploaded data: {len(df)} samples")
        
        result = detector.train(df, epochs=epochs, batch_size=batch_size)
        
        detector.save()
        
        final_loss = result['loss'][-1]
        
        await notifier.send_training_complete(epochs, result['threshold'], final_loss)
        
        logger.info(f"Model training complete. Final loss: {final_loss:.6f}")
        
    except Exception as e:
        logger.error(f"Model training failed: {e}")

@app.get("/api/model/status")
async def get_model_status():
    return {
        "status": "success",
        "model_loaded": detector.model is not None,
        "threshold": float(detector.threshold) if detector.threshold else None,
        "sequence_length": detector.sequence_length,
        "n_features": detector.n_features
    }

@app.post("/api/simulator/start")
async def start_simulator(interval: float = 1.0, anomaly_chance: float = 0.05):
    global simulator_task
    
    if simulator_task and not simulator_task.done():
        return {"status": "warning", "message": "Simulator already running"}
    
    simulator_task = asyncio.create_task(simulator.start_simulation(interval, anomaly_chance))
    return {"status": "success", "message": "Simulator started"}

@app.post("/api/simulator/stop")
async def stop_simulator():
    global simulator_task
    
    simulator.stop()
    if simulator_task:
        simulator_task.cancel()
    
    return {"status": "success", "message": "Simulator stopped"}

@app.get("/api/simulator/status")
async def get_simulator_status():
    return {
        "status": "success",
        "running": simulator.is_running,
        "sensors": simulator.sensors
    }

@app.get("/api/sensors")
async def get_sensors_list():
    return {
        "status": "success",
        "sensors": ["sensor_001", "sensor_002", "sensor_003"]
    }

@app.get("/api/trend/predict/{sensor_id}")
async def predict_trend(sensor_id: str, minutes: int = 5):
    try:
        result = trend_predictor.predict(sensor_id, minutes=minutes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/trend/summary/{sensor_id}")
async def get_trend_summary(sensor_id: str):
    try:
        result = trend_predictor.get_trend_summary(sensor_id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/fault/classify/{sensor_id}")
async def classify_fault(sensor_id: str, duration_minutes: int = 5):
    try:
        result = fault_classifier.classify(sensor_id, duration_minutes=duration_minutes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/fault/batch-classify")
async def batch_classify_faults(sensor_ids: List[str], duration_minutes: int = 5):
    try:
        result = fault_classifier.batch_classify(sensor_ids, duration_minutes=duration_minutes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/fault/types")
async def get_fault_types():
    from fault_classifier import FAULT_NAMES, FAULT_DESCRIPTIONS, FAULT_SEVERITY
    return {
        "status": "success",
        "fault_types": FAULT_NAMES,
        "descriptions": FAULT_DESCRIPTIONS,
        "severity": FAULT_SEVERITY
    }

@app.post("/api/report/generate/{sensor_id}")
async def generate_maintenance_report(sensor_id: str, report_type: str = "daily"):
    try:
        result = report_generator.generate_report(sensor_id, report_type=report_type)
        if result['success']:
            return {"status": "success", "data": result}
        else:
            raise HTTPException(status_code=500, detail=result.get('error', 'Failed to generate report'))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/report/list")
async def list_reports():
    try:
        reports = report_generator.list_reports()
        return {"status": "success", "reports": reports}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/report/download/{filename}")
async def download_report(filename: str):
    try:
        from report_generator import report_generator
        reports_dir = report_generator.reports_dir
        filepath = os.path.join(reports_dir, filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Report not found")
        
        return FileResponse(
            filepath,
            media_type="application/pdf",
            filename=filename
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
