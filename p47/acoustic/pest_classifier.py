import numpy as np
import os
import tensorflow as tf
from tensorflow.keras import layers, models
from .feature_extractor import MelSpectrogramExtractor, normalize_spectrogram, pad_or_truncate


class PestCNNClassifier:
    PEST_CLASSES = ['locust', 'cotton_bollworm', 'aphid', 'whitefly', 'none']
    
    def __init__(self, input_shape=(128, 128, 1)):
        self.input_shape = input_shape
        self.model = self._build_model()
        self.extractor = MelSpectrogramExtractor()
        self._initialize_weights()

    def _build_model(self):
        model = models.Sequential([
            layers.Conv2D(32, (3, 3), activation='relu', input_shape=self.input_shape),
            layers.MaxPooling2D((2, 2)),
            layers.Conv2D(64, (3, 3), activation='relu'),
            layers.MaxPooling2D((2, 2)),
            layers.Conv2D(128, (3, 3), activation='relu'),
            layers.MaxPooling2D((2, 2)),
            layers.Conv2D(128, (3, 3), activation='relu'),
            layers.MaxPooling2D((2, 2)),
            layers.Flatten(),
            layers.Dropout(0.5),
            layers.Dense(512, activation='relu'),
            layers.Dense(len(self.PEST_CLASSES), activation='softmax')
        ])
        
        model.compile(
            optimizer='adam',
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        return model

    def _initialize_weights(self):
        weights_path = os.path.join(os.path.dirname(__file__), 'pest_model_weights.h5')
        if os.path.exists(weights_path):
            self.model.load_weights(weights_path)
        else:
            print("Warning: Pre-trained weights not found, using initialized weights.")

    def preprocess_audio(self, audio_path, sr=22050, duration=3):
        mel_spect = self.extractor.extract(audio_path, sr=sr, duration=duration)
        mel_spect = normalize_spectrogram(mel_spect)
        mel_spect = pad_or_truncate(mel_spect, target_frames=self.input_shape[1])
        mel_spect = mel_spect.reshape(self.input_shape)
        return mel_spect

    def preprocess_audio_array(self, y, sr=22050):
        mel_spect = self.extractor.extract_from_array(y, sr=sr)
        mel_spect = normalize_spectrogram(mel_spect)
        mel_spect = pad_or_truncate(mel_spect, target_frames=self.input_shape[1])
        mel_spect = mel_spect.reshape(self.input_shape)
        return mel_spect

    def predict(self, audio_path, sr=22050, duration=3):
        processed = self.preprocess_audio(audio_path, sr=sr, duration=duration)
        predictions = self.model.predict(np.array([processed]), verbose=0)[0]
        
        class_idx = np.argmax(predictions)
        confidence = float(predictions[class_idx])
        pest_type = self.PEST_CLASSES[class_idx]
        
        return {
            'pest_type': pest_type,
            'confidence': confidence,
            'all_predictions': {
                cls: float(pred) for cls, pred in zip(self.PEST_CLASSES, predictions)
            }
        }

    def predict_from_array(self, y, sr=22050):
        processed = self.preprocess_audio_array(y, sr=sr)
        predictions = self.model.predict(np.array([processed]), verbose=0)[0]
        
        class_idx = np.argmax(predictions)
        confidence = float(predictions[class_idx])
        pest_type = self.PEST_CLASSES[class_idx]
        
        return {
            'pest_type': pest_type,
            'confidence': confidence,
            'all_predictions': {
                cls: float(pred) for cls, pred in zip(self.PEST_CLASSES, predictions)
            }
        }

    def save_weights(self, path=None):
        if path is None:
            path = os.path.join(os.path.dirname(__file__), 'pest_model_weights.h5')
        self.model.save_weights(path)


class SimplePestDetector:
    PEST_FREQUENCIES = {
        'locust': (1000, 3000),
        'cotton_bollworm': (800, 2500),
        'aphid': (2000, 5000),
        'whitefly': (3000, 7000)
    }
    
    @staticmethod
    def detect_pest_simple(audio_input, sr=22050, use_file=True):
        if use_file:
            import librosa
            y, sr = librosa.load(audio_input, sr=sr)
        else:
            y = audio_input if isinstance(audio_input, np.ndarray) else np.array(audio_input)
        
        if np.max(np.abs(y)) < 0.01:
            return {'pest_type': 'none', 'confidence': 0.9}
        
        fft = np.fft.fft(y)
        freqs = np.fft.fftfreq(len(y), 1/sr)
        magnitude = np.abs(fft)
        
        positive_mask = freqs > 0
        freqs = freqs[positive_mask]
        magnitude = magnitude[positive_mask]
        
        pest_scores = {}
        total_energy = np.sum(magnitude)
        
        for pest, (f_min, f_max) in SimplePestDetector.PEST_FREQUENCIES.items():
            freq_mask = (freqs >= f_min) & (freqs <= f_max)
            band_energy = np.sum(magnitude[freq_mask])
            score = band_energy / (total_energy + 1e-10)
            pest_scores[pest] = score
        
        max_pest = max(pest_scores, key=pest_scores.get)
        max_score = pest_scores[max_pest]
        
        threshold = 0.1
        if max_score > threshold:
            confidence = min(0.95, max_score * 2)
            return {'pest_type': max_pest, 'confidence': confidence}
        else:
            return {'pest_type': 'none', 'confidence': 0.8}
    
    @staticmethod
    def detect_from_array(y, sr=22050):
        return SimplePestDetector.detect_pest_simple(y, sr, use_file=False)
