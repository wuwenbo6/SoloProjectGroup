import numpy as np
import base64
import io
import soundfile as sf
from typing import List, Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
import asyncio
from collections import deque

from ..core.database import get_db
from ..core.config import get_settings
from ..models import Song
from ..services import AudioPreprocessor, FingerprintExtractor, FingerprintMatcher

settings = get_settings()
router = APIRouter(prefix="/streaming", tags=["streaming"])


class StreamMatcher:
    def __init__(self, db: Session, sample_rate: int = 22050, window_seconds: float = 3.0):
        self.db = db
        self.sample_rate = sample_rate
        self.window_seconds = window_seconds
        self.window_samples = int(window_seconds * sample_rate)
        self.audio_buffer: deque = deque(maxlen=self.window_samples)
        self.last_match_time = 0
        self.match_cooldown = 2.0
        self.stream_time = 0.0

        self.preprocessor = AudioPreprocessor(sample_rate=sample_rate)
        self.extractor = FingerprintExtractor(
            sample_rate=sample_rate,
            n_fft=settings.N_FFT,
            hop_length=settings.HOP_LENGTH,
            n_mels=settings.N_MELS,
            peak_neighborhood_size=settings.PEAK_NEIGHBORHOOD_SIZE,
            target_fan_value=settings.TARGET_FAN_VALUE,
            min_hash_time_delta=settings.MIN_HASH_TIME_DELTA,
            max_hash_time_delta=settings.MAX_HASH_TIME_DELTA,
            fingerprint_reduction=settings.FINGERPRINT_REDUCTION,
            peak_threshold_std=getattr(settings, 'PEAK_THRESHOLD_STD', 0.8),
            max_peaks_per_second=getattr(settings, 'MAX_PEAKS_PER_SECOND', 50),
        )
        self.matcher = FingerprintMatcher(
            db=db,
            score_threshold=getattr(settings, 'SCORE_THRESHOLD', 0.3),
        )

    def add_audio(self, audio_array: np.ndarray, duration: float) -> Dict:
        self.audio_buffer.extend(audio_array)
        self.stream_time += duration

        results = {
            "processed": True,
            "buffer_duration": len(self.audio_buffer) / self.sample_rate,
            "stream_time": self.stream_time,
            "match": None,
        }

        if len(self.audio_buffer) >= self.window_samples // 2:
            audio_window = np.array(list(self.audio_buffer))
            match_result = self._process_window(audio_window)
            if match_result:
                results["match"] = match_result
                results["matched"] = True
            else:
                results["matched"] = False

        return results

    def _process_window(self, audio_window: np.ndarray) -> Optional[Dict]:
        try:
            processed = self.preprocessor.preprocess(audio_window)
            fingerprint = self.extractor.extract_fingerprint(processed)

            matches = self.matcher.match_by_hash(fingerprint["hashes"])

            if matches and len(matches) > 0:
                best_match = matches[0]
                if best_match["confidence"] >= self.matcher.score_threshold:
                    song = self.db.query(Song).filter(Song.id == best_match["song_id"]).first()
                    return {
                        "song_id": best_match["song_id"],
                        "title": best_match["title"],
                        "artist": best_match["artist"],
                        "album": best_match["album"],
                        "cover_url": song.cover_url if song else None,
                        "cover_image": song.cover_image if song else None,
                        "lyrics": song.lyrics if song else None,
                        "confidence": float(best_match["confidence"]),
                        "match_count": best_match["match_count"],
                        "fingerprint_info": {
                            "num_peaks": fingerprint["num_peaks"],
                            "num_hashes": fingerprint["num_hashes"],
                        }
                    }
        except Exception as e:
            print(f"Error processing window: {e}")

        return None

    def reset(self):
        self.audio_buffer.clear()
        self.stream_time = 0.0


@router.websocket("/ws/match")
async def websocket_match(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()

    stream_matcher = StreamMatcher(db)

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "audio_chunk":
                audio_base64 = data.get("audio_data")
                duration = data.get("duration", 0.5)

                audio_bytes = base64.b64decode(audio_base64)
                audio_array, sr = sf.read(io.BytesIO(audio_bytes))

                if len(audio_array.shape) > 1:
                    audio_array = np.mean(audio_array, axis=1)

                if sr != stream_matcher.sample_rate:
                    audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=stream_matcher.sample_rate)

                result = stream_matcher.add_audio(audio_array, duration)

                await websocket.send_json({
                    "type": "result",
                    "data": result,
                })

            elif data.get("type") == "reset":
                stream_matcher.reset()
                await websocket.send_json({
                    "type": "status",
                    "data": {"message": "Stream reset successful"}
                })

            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))


@router.websocket("/ws/raw")
async def websocket_raw(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()

    stream_matcher = StreamMatcher(db)

    try:
        while True:
            data = await websocket.receive_bytes()

            audio_array = np.frombuffer(data, dtype=np.float32)
            duration = len(audio_array) / stream_matcher.sample_rate

            result = stream_matcher.add_audio(audio_array, duration)

            await websocket.send_json({
                "type": "result",
                "data": result,
            })

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close(code=1011, reason=str(e))
