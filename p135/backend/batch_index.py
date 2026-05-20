#!/usr/bin/env python3
import os
import sys
import argparse
from pathlib import Path
from typing import List
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine
from app.core.config import get_settings
from app.models import Song, Fingerprint, Base
from app.services import AudioPreprocessor, FingerprintExtractor
from app.services.concurrent_fingerprint import ConcurrentFingerprintExtractor
import librosa

settings = get_settings()


def init_database():
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")


def index_audio_file(
    file_path: str,
    db: Session,
    preprocessor: AudioPreprocessor,
    extractor: FingerprintExtractor,
    title: str = None,
    artist: str = None,
    album: str = None,
) -> bool:
    try:
        print(f"Processing: {file_path}")

        fingerprint_data = extractor.extract_from_file(file_path, preprocessor=preprocessor)

        song_title = title or os.path.splitext(os.path.basename(file_path))[0]
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
        print(f"Successfully indexed: {song_title} (peaks: {fingerprint_data['num_peaks']}, hashes: {fingerprint_data['num_hashes']})")
        return True

    except Exception as e:
        db.rollback()
        print(f"Error processing {file_path}: {str(e)}")
        return False


def index_directory(
    directory: str,
    recursive: bool = False,
    extensions: List[str] = None,
    use_concurrent: bool = True,
    max_workers: int = 4,
):
    if extensions is None:
        extensions = [".wav", ".mp3", ".flac", ".ogg", ".m4a"]

    extensions = [ext.lower() for ext in extensions]

    db = SessionLocal()
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

    path = Path(directory)
    if not path.exists():
        print(f"Directory not found: {directory}")
        return

    if recursive:
        files = []
        for ext in extensions:
            files.extend(path.rglob(f"*{ext}"))
            files.extend(path.rglob(f"*{ext.upper()}"))
    else:
        files = []
        for ext in extensions:
            files.extend(path.glob(f"*{ext}"))
            files.extend(path.glob(f"*{ext.upper()}"))

    files = list(set(files))
    print(f"Found {len(files)} audio files to index.")

    if use_concurrent and len(files) > 1:
        print(f"Using concurrent extraction with {max_workers} workers...")
        success_count = index_files_concurrent(files, db, preprocessor, extractor, max_workers)
    else:
        print("Using sequential processing...")
        success_count = 0
        for file_path in files:
            if index_audio_file(str(file_path), db, preprocessor, extractor):
                success_count += 1

    print(f"\nIndexing complete: {success_count}/{len(files)} files indexed successfully.")


def index_files_concurrent(
    files: List[Path],
    db: Session,
    preprocessor: AudioPreprocessor,
    extractor: FingerprintExtractor,
    max_workers: int
) -> int:
    start_time = time.time()

    concurrent_extractor = ConcurrentFingerprintExtractor(
        extractor=extractor,
        preprocessor=preprocessor,
        max_workers=max_workers,
        use_threads=True
    )

    file_paths = [str(f) for f in files]
    results = concurrent_extractor.batch_extract_files(file_paths)

    success_count = 0
    for result in results:
        if result.get('success'):
            file_path = result['file_path']
            song_title = os.path.splitext(os.path.basename(file_path))[0]
            duration = int(result.get('duration', 0))

            song = Song(
                title=song_title,
                file_path=file_path,
                duration=duration,
            )
            db.add(song)
            db.flush()

            vector_list = result['hash_vector'].tolist()
            for hash_hex, offset in result['hashes']:
                fp = Fingerprint(
                    song_id=song.id,
                    hash=hash_hex,
                    offset=offset,
                    vector=vector_list,
                )
                db.add(fp)

            db.commit()
            success_count += 1
            print(f"Indexed: {song_title} (peaks: {result['num_peaks']}, hashes: {result['num_hashes']})")
        else:
            print(f"Failed: {result.get('file_path')} - {result.get('error', 'Unknown error')}")

    elapsed = time.time() - start_time
    print(f"\nConcurrent processing completed in {elapsed:.2f} seconds")
    print(f"Average: {elapsed / len(files):.2f} seconds per file")

    return success_count


def show_stats():
    db = SessionLocal()
    song_count = db.query(Song).count()
    fingerprint_count = db.query(Fingerprint).count()

    print(f"\nDatabase Statistics:")
    print(f"  Total songs: {song_count}")
    print(f"  Total fingerprints: {fingerprint_count}")
    if song_count > 0:
        print(f"  Avg fingerprints per song: {fingerprint_count / song_count:.2f}")


def main():
    parser = argparse.ArgumentParser(description="Batch index audio files for fingerprinting")
    parser.add_argument("directory", nargs="?", help="Directory containing audio files to index")
    parser.add_argument("-r", "--recursive", action="store_true", help="Search directories recursively")
    parser.add_argument("--init-db", action="store_true", help="Initialize database tables")
    parser.add_argument("--stats", action="store_true", help="Show database statistics")
    parser.add_argument("--extensions", nargs="+", help="File extensions to index (default: wav mp3 flac ogg m4a)")
    parser.add_argument("--no-concurrent", action="store_true", help="Disable concurrent processing")
    parser.add_argument("--workers", type=int, default=4, help="Number of worker threads (default: 4)")

    args = parser.parse_args()

    if args.init_db:
        init_database()

    if args.stats:
        show_stats()
        return

    if args.directory:
        index_directory(
            args.directory,
            recursive=args.recursive,
            extensions=args.extensions,
            use_concurrent=not args.no_concurrent,
            max_workers=args.workers,
        )
        show_stats()
    elif not args.init_db:
        parser.print_help()


if __name__ == "__main__":
    main()
