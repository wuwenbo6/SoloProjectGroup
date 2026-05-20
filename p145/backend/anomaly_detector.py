import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model, load_model
from tensorflow.keras.layers import LSTM, Dense, Input, RepeatVector, TimeDistributed
from tensorflow.keras import backend as K
from sklearn.preprocessing import StandardScaler
import joblib
import os
import logging
from typing import Tuple, List, Dict
import gc

from config import Config

logger = logging.getLogger(__name__)

def setup_gpu_memory():
    try:
        gpus = tf.config.experimental.list_physical_devices('GPU')
        if gpus:
            for gpu in gpus:
                tf.config.experimental.set_memory_growth(gpu, True)
                logger.info(f"GPU memory growth enabled for {gpu}")
        else:
            logger.info("No GPU found, using CPU")
    except Exception as e:
        logger.warning(f"GPU setup failed: {e}")

setup_gpu_memory()

class LSTMAutoencoder:
    def __init__(self, sequence_length: int = None, n_features: int = 3):
        self.sequence_length = sequence_length or Config.SEQUENCE_LENGTH
        self.n_features = n_features
        self.model = None
        self.scaler = None
        self.threshold = None
        self._inference_function = None
        self._batch_inference_function = None
    
    def _build_inference_function(self):
        if self.model is None:
            return
        
        @tf.function(reduce_retracing=True, jit_compile=False)
        def predict_fn(x):
            return self.model(x, training=False)
        
        self._inference_function = predict_fn
        logger.info("Inference function built with tf.function")
    
    def build_model(self):
        K.clear_session()
        
        inputs = Input(shape=(self.sequence_length, self.n_features))
        
        encoded = LSTM(64, activation='relu', return_sequences=True)(inputs)
        encoded = LSTM(32, activation='relu', return_sequences=False)(encoded)
        
        decoded = RepeatVector(self.sequence_length)(encoded)
        decoded = LSTM(32, activation='relu', return_sequences=True)(decoded)
        decoded = LSTM(64, activation='relu', return_sequences=True)(decoded)
        decoded = TimeDistributed(Dense(self.n_features))(decoded)
        
        self.model = Model(inputs=inputs, outputs=decoded)
        self.model.compile(optimizer='adam', loss='mse')
        
        self._build_inference_function()
        
        logger.info(f"Model built: sequence_length={self.sequence_length}, n_features={self.n_features}")
        return self.model
    
    def create_sequences(self, data: np.ndarray) -> np.ndarray:
        sequences = []
        for i in range(len(data) - self.sequence_length + 1):
            sequences.append(data[i:i + self.sequence_length])
        return np.array(sequences)
    
    def train(self, data: pd.DataFrame, epochs: int = 50, batch_size: int = 32, 
              validation_split: float = 0.1) -> Dict:
        features = data[['vibration', 'swing', 'temperature']].values
        
        self.scaler = StandardScaler()
        scaled_data = self.scaler.fit_transform(features)
        
        sequences = self.create_sequences(scaled_data)
        
        if self.model is None:
            self.build_model()
        
        history = self.model.fit(
            sequences, sequences,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            shuffle=True,
            verbose=1
        )
        
        reconstructions = self._batch_inference(sequences)
        mse = np.mean(np.power(sequences - reconstructions, 2), axis=(1, 2))
        self.threshold = np.percentile(mse, 95)
        
        del sequences, reconstructions, mse
        gc.collect()
        
        logger.info(f"Training complete. Threshold: {self.threshold:.4f}")
        
        return {
            "loss": history.history['loss'],
            "val_loss": history.history['val_loss'],
            "threshold": float(self.threshold),
            "epochs_trained": epochs
        }
    
    def _batch_inference(self, sequences):
        if self._inference_function is None:
            self._build_inference_function()
        
        return self._inference_function(tf.convert_to_tensor(sequences, dtype=tf.float32)).numpy()
    
    def detect_anomaly(self, data_window: np.ndarray) -> Tuple[bool, float]:
        if self.model is None or self.scaler is None:
            raise ValueError("Model not loaded or trained")
        
        scaled_window = self.scaler.transform(data_window)
        
        if len(scaled_window) < self.sequence_length:
            padded = np.zeros((self.sequence_length, self.n_features))
            padded[-len(scaled_window):] = scaled_window
            scaled_window = padded
        
        sequence = scaled_window[-self.sequence_length:].reshape(1, self.sequence_length, self.n_features)
        
        if self._inference_function is None:
            self._build_inference_function()
        
        try:
            sequence_tensor = tf.convert_to_tensor(sequence, dtype=tf.float32)
            reconstruction = self._inference_function(sequence_tensor).numpy()
        except Exception as e:
            logger.warning(f"tf.function inference failed, falling back to predict: {e}")
            reconstruction = self.model(sequence, training=False).numpy()
        
        mse = np.mean(np.power(sequence - reconstruction, 2), axis=(1, 2))[0]
        
        is_anomaly = mse > (self.threshold * Config.ANOMALY_THRESHOLD)
        
        del sequence, sequence_tensor, reconstruction
        gc.collect()
        
        return bool(is_anomaly), float(mse)
    
    def detect_batch(self, data: pd.DataFrame) -> List[Dict]:
        features = data[['vibration', 'swing', 'temperature']].values
        scaled_data = self.scaler.transform(features)
        sequences = self.create_sequences(scaled_data)
        
        if self._inference_function is None:
            self._build_inference_function()
        
        try:
            sequences_tensor = tf.convert_to_tensor(sequences, dtype=tf.float32)
            reconstructions = self._inference_function(sequences_tensor).numpy()
        except Exception as e:
            logger.warning(f"tf.function batch inference failed, falling back to predict: {e}")
            reconstructions = self.model.predict(sequences, verbose=0, batch_size=256)
        
        mse = np.mean(np.power(sequences - reconstructions, 2), axis=(1, 2))
        
        results = []
        for i in range(len(mse)):
            results.append({
                "index": i,
                "anomaly_score": float(mse[i]),
                "is_anomaly": bool(mse[i] > self.threshold),
                "start_idx": i,
                "end_idx": i + self.sequence_length
            })
        
        del sequences, sequences_tensor, reconstructions, mse
        gc.collect()
        
        return results
    
    def save(self, model_path: str = None, scaler_path: str = None, threshold_path: str = None):
        model_path = model_path or Config.MODEL_PATH
        scaler_path = scaler_path or Config.SCALER_PATH
        threshold_path = threshold_path or Config.THRESHOLD_PATH
        
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        self.model.save(model_path, save_format='h5')
        joblib.dump(self.scaler, scaler_path)
        joblib.dump(self.threshold, threshold_path)
        
        logger.info(f"Model saved to {model_path}")
    
    def load(self, model_path: str = None, scaler_path: str = None, threshold_path: str = None):
        model_path = model_path or Config.MODEL_PATH
        scaler_path = scaler_path or Config.SCALER_PATH
        threshold_path = threshold_path or Config.THRESHOLD_PATH
        
        K.clear_session()
        
        if not all(os.path.exists(p) for p in [model_path, scaler_path, threshold_path]):
            logger.warning("Model files not found, using untrained model")
            return False
        
        self.model = load_model(model_path, compile=False)
        self.model.compile(optimizer='adam', loss='mse')
        
        self.scaler = joblib.load(scaler_path)
        self.threshold = joblib.load(threshold_path)
        
        self.sequence_length = self.model.input_shape[1]
        self.n_features = self.model.input_shape[2]
        
        self._build_inference_function()
        
        logger.info(f"Model loaded. Threshold: {self.threshold:.4f}")
        return True

detector = LSTMAutoencoder()
