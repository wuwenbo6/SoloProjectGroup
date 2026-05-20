import os
import aiofiles
import uuid
import numpy as np
import time
from typing import Optional, Tuple
from pathlib import Path
from pydub import AudioSegment
import librosa
import soundfile as sf
import shutil
from ..core.config import settings


async def save_uploaded_file(file, upload_dir: str = None) -> Tuple[str, str]:
    if upload_dir is None:
        upload_dir = settings.UPLOAD_DIR
    
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1].lower()
    file_uuid = str(uuid.uuid4())
    new_filename = f"{file_uuid}.{file_ext}"
    file_path = os.path.join(upload_dir, new_filename)
    
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    return file_path, file_uuid


def get_audio_info(file_path: str) -> dict:
    try:
        audio = AudioSegment.from_file(file_path)
        return {
            "duration": len(audio) / 1000.0,
            "sample_rate": audio.frame_rate,
            "channels": audio.channels,
            "format": os.path.splitext(file_path)[1][1:].lower()
        }
    except Exception as e:
        return {"error": str(e)}


def segment_audio(
    input_path: str,
    output_path: str,
    start_time: float,
    end_time: float
) -> bool:
    try:
        audio = AudioSegment.from_file(input_path)
        start_ms = int(start_time * 1000)
        end_ms = int(end_time * 1000)
        segment = audio[start_ms:end_ms]
        segment.export(output_path, format="wav")
        return True
    except Exception as e:
        print(f"Error segmenting audio: {e}")
        return False


def extract_audio_features(file_path: str) -> Optional[np.ndarray]:
    try:
        y, sr = librosa.load(file_path, sr=None)
        
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfccs_mean = np.mean(mfccs.T, axis=0)
        
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_centroid_mean = np.mean(spectral_centroids)
        
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)
        spectral_bandwidth_mean = np.mean(spectral_bandwidth)
        
        zero_crossing_rate = librosa.feature.zero_crossing_rate(y)
        zero_crossing_rate_mean = np.mean(zero_crossing_rate)
        
        chroma_stft = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_stft_mean = np.mean(chroma_stft.T, axis=0)
        
        features = np.concatenate([
            mfccs_mean,
            [spectral_centroid_mean, spectral_bandwidth_mean, zero_crossing_rate_mean],
            chroma_stft_mean
        ])
        
        return features
    except Exception as e:
        print(f"Error extracting features: {e}")
        return None


def get_file_size(file_path: str) -> int:
    return os.path.getsize(file_path)


def delete_file(file_path: str) -> bool:
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False


def allowed_file(filename: str) -> bool:
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in settings.ALLOWED_EXTENSIONS


async def cleanup_temp_files(upload_dir: str, hours: int = 24) -> int:
    """Clean up temporary files older than specified hours"""
    chunks_dir = os.path.join(upload_dir, "chunks")
    if not os.path.exists(chunks_dir):
        return 0
    
    cleaned_count = 0
    cutoff_time = time.time() - (hours * 3600)
    
    for item in os.listdir(chunks_dir):
        item_path = os.path.join(chunks_dir, item)
        try:
            if os.path.isdir(item_path):
                mtime = os.path.getmtime(item_path)
                if mtime < cutoff_time:
                    shutil.rmtree(item_path)
                    cleaned_count += 1
            elif os.path.isfile(item_path):
                mtime = os.path.getmtime(item_path)
                if mtime < cutoff_time:
                    os.remove(item_path)
                    cleaned_count += 1
        except Exception as e:
            print(f"Error cleaning up {item_path}: {e}")
            continue
    
    return cleaned_count
