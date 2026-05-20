from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
import librosa
import numpy as np

from ..core.database import get_db
from ..core.config import get_settings
from ..models import Song
from ..services import AudioPreprocessor, FingerprintExtractor, FingerprintMatcher
from ..schemas import UploadResponse

router = APIRouter(prefix="/identify", tags=["identify"])

settings = get_settings()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=UploadResponse)
async def identify_audio(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    artist: Optional[str] = Form(None),
    album: Optional[str] = Form(None),
    save_to_db: bool = Form(False),
    db: Session = Depends(get_db),
):
    try:
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in [".wav", ".mp3", ".flac", ".ogg", ".m4a"]:
            raise HTTPException(status_code=400, detail="Unsupported file format")

        file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}{file_extension}")

        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        preprocessor = AudioPreprocessor(sample_rate=settings.SAMPLE_RATE)
        extractor = FingerprintExtractor(
            sample_rate=settings.SAMPLE_RATE,
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

        fingerprint_data = extractor.extract_from_file(file_path, preprocessor=preprocessor)

        matcher = FingerprintMatcher(
            db=db,
            top_n=settings.TOP_N_MATCHES,
            score_threshold=settings.SCORE_THRESHOLD,
            min_alignment_score=getattr(settings, 'MIN_ALIGNMENT_SCORE', 3),
        )

        matches = matcher.match_by_hash(fingerprint_data["hashes"])

        for match in matches:
            song_obj = db.query(Song).filter(Song.id == match["song_id"]).first()
            if song_obj:
                match["cover_url"] = song_obj.cover_url
                match["cover_image"] = song_obj.cover_image
                match["lyrics"] = song_obj.lyrics

        song = None
        if save_to_db:
            from ..models import Fingerprint

            song_title = title or os.path.splitext(file.filename)[0]
            duration = int(librosa.get_duration(path=file_path))

            song = Song(
                title=song_title,
                artist=artist,
                album=album,
                file_path=file_path,
                duration=duration,
            )
            db.add(song)
            db.flush()

            vector_list = fingerprint_data["hash_vector"].tolist()
            for hash_hex, offset in fingerprint_data["hashes"]:
                fp = Fingerprint(
                    song_id=song.id,
                    hash=hash_hex,
                    offset=offset,
                    vector=vector_list,
                )
                db.add(fp)

            db.commit()
            db.refresh(song)

        if not save_to_db and os.path.exists(file_path):
            os.remove(file_path)

        fingerprint_info = {
            "num_peaks": fingerprint_data["num_peaks"],
            "num_hashes": fingerprint_data["num_hashes"],
        }

        return UploadResponse(
            success=True,
            message="Audio processed successfully",
            song=song,
            matches=matches,
            fingerprint_info=fingerprint_info,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")


@router.post("/raw", response_model=UploadResponse)
async def identify_raw_audio(
    audio_data: list[float],
    sample_rate: int = 22050,
    db: Session = Depends(get_db),
):
    try:
        audio_array = np.array(audio_data, dtype=np.float32)

        preprocessor = AudioPreprocessor(sample_rate=sample_rate)
        extractor = FingerprintExtractor(
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

        fingerprint_data = extractor.extract_from_array(audio_array, preprocessor=preprocessor)

        matcher = FingerprintMatcher(
            db=db,
            top_n=settings.TOP_N_MATCHES,
            score_threshold=settings.SCORE_THRESHOLD,
            min_alignment_score=getattr(settings, 'MIN_ALIGNMENT_SCORE', 3),
        )

        matches = matcher.match_by_hash(fingerprint_data["hashes"])

        for match in matches:
            song_obj = db.query(Song).filter(Song.id == match["song_id"]).first()
            if song_obj:
                match["cover_url"] = song_obj.cover_url
                match["cover_image"] = song_obj.cover_image
                match["lyrics"] = song_obj.lyrics

        fingerprint_info = {
            "num_peaks": fingerprint_data["num_peaks"],
            "num_hashes": fingerprint_data["num_hashes"],
        }

        return UploadResponse(
            success=True,
            message="Audio processed successfully",
            matches=matches,
            fingerprint_info=fingerprint_info,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing audio: {str(e)}")
