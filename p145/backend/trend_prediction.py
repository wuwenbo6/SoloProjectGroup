import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Tuple
import joblib
import os
from sklearn.preprocessing import StandardScaler
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras import backend as K

from config import Config
from database import db_manager

logger = logging.getLogger(__name__)

class TrendPredictor:
    def __init__(self):
        self.model = None
        self.scaler = None
        self.sequence_length = 50
        self.prediction_horizon = 300
        self.model_path = os.path.join(Config.MODEL_DIR, 'trend_predictor.h5')
        self.scaler_path = os.path.join(Config.MODEL_DIR, 'trend_scaler.pkl')
        self._load_model()
    
    def _load_model(self):
        if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
            try:
                self.model = load_model(self.model_path, compile=False)
                self.model.compile(optimizer='adam', loss='mse')
                self.scaler = joblib.load(self.scaler_path)
                logger.info("Trend prediction model loaded successfully")
            except Exception as e:
                logger.warning(f"Failed to load trend model: {e}")
                self._build_model()
        else:
            logger.info("No existing trend model, building new one")
            self._build_model()
    
    def _build_model(self):
        K.clear_session()
        
        self.model = Sequential([
            LSTM(128, activation='relu', return_sequences=True, 
                 input_shape=(self.sequence_length, 3)),
            Dropout(0.2),
            LSTM(64, activation='relu', return_sequences=False),
            Dropout(0.2),
            Dense(32, activation='relu'),
            Dense(self.prediction_horizon)
        ])
        
        self.model.compile(optimizer='adam', loss='mse')
        self.scaler = StandardScaler()
        
        logger.info("New trend prediction model built")
    
    def _create_sequences(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        X, y = [], []
        
        for i in range(len(data) - self.sequence_length - self.prediction_horizon + 1):
            X.append(data[i:i + self.sequence_length])
            y.append(data[i + self.sequence_length:i + self.sequence_length + self.prediction_horizon, 0])
        
        return np.array(X), np.array(y)
    
    def train(self, sensor_id: str, days: int = 7) -> Dict:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days)
        
        data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
        
        if len(data) < self.sequence_length + self.prediction_horizon:
            raise ValueError(f"Insufficient data for training. Need at least {self.sequence_length + self.prediction_horizon} points")
        
        df = pd.DataFrame(data)
        features = df[['vibration', 'swing', 'temperature']].values
        
        scaled_features = self.scaler.fit_transform(features)
        
        X, y = self._create_sequences(scaled_features)
        
        if len(X) < 10:
            raise ValueError("Not enough sequences for training")
        
        train_size = int(0.8 * len(X))
        X_train, X_test = X[:train_size], X[train_size:]
        y_train, y_test = y[:train_size], y[train_size:]
        
        history = self.model.fit(
            X_train, y_train,
            epochs=50,
            batch_size=32,
            validation_data=(X_test, y_test),
            verbose=1
        )
        
        os.makedirs(Config.MODEL_DIR, exist_ok=True)
        self.model.save(self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        
        logger.info(f"Trend model trained successfully on {len(data)} data points")
        
        return {
            'train_loss': history.history['loss'][-1],
            'val_loss': history.history['val_loss'][-1],
            'training_samples': len(X_train),
            'test_samples': len(X_test)
        }
    
    def predict(self, sensor_id: str, minutes: int = 5) -> Dict:
        prediction_points = minutes * 60
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
        
        if len(data) < self.sequence_length:
            raise ValueError(f"Insufficient data for prediction. Need at least {self.sequence_length} recent points")
        
        df = pd.DataFrame(data)
        features = df[['vibration', 'swing', 'temperature']].values
        
        scaled_features = self.scaler.transform(features)
        
        sequence = scaled_features[-self.sequence_length:].reshape(1, self.sequence_length, 3)
        
        prediction_scaled = self.model.predict(sequence, verbose=0)[0]
        
        prediction_full = np.zeros((len(prediction_scaled), 3))
        prediction_full[:, 0] = prediction_scaled
        prediction_vibration = self.scaler.inverse_transform(prediction_full)[:, 0]
        
        prediction_vibration = np.clip(prediction_vibration, 0, np.max(features[:, 0]) * 2)
        
        timestamps = [end_time + timedelta(seconds=i) for i in range(len(prediction_vibration))]
        
        current_vibration = features[-1, 0]
        trend_mean = np.mean(prediction_vibration)
        trend_max = np.max(prediction_vibration)
        trend_min = np.min(prediction_vibration)
        
        trend_direction = 'stable'
        if trend_mean > current_vibration * 1.1:
            trend_direction = 'rising'
        elif trend_mean < current_vibration * 0.9:
            trend_direction = 'falling'
        
        anomaly_risk = 'low'
        if trend_max > 5.0:
            anomaly_risk = 'high'
        elif trend_max > 3.0:
            anomaly_risk = 'medium'
        
        return {
            'sensor_id': sensor_id,
            'prediction_minutes': minutes,
            'prediction_points': len(prediction_vibration),
            'current_vibration': float(current_vibration),
            'predicted_values': [
                {'time': t.isoformat(), 'vibration': float(v)}
                for t, v in zip(timestamps, prediction_vibration)
            ],
            'trend_analysis': {
                'direction': trend_direction,
                'mean_value': float(trend_mean),
                'max_value': float(trend_max),
                'min_value': float(trend_min),
                'anomaly_risk': anomaly_risk
            }
        }
    
    def get_trend_summary(self, sensor_id: str) -> Dict:
        try:
            prediction = self.predict(sensor_id, 5)
            return prediction['trend_analysis']
        except Exception as e:
            logger.error(f"Failed to get trend summary: {e}")
            return {
                'direction': 'unknown',
                'mean_value': 0,
                'max_value': 0,
                'min_value': 0,
                'anomaly_risk': 'unknown'
            }

trend_predictor = TrendPredictor()
