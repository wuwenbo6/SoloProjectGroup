import numpy as np
from typing import List, Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
import librosa
from functools import partial
import logging

from .fingerprint_extractor import FingerprintExtractor
from .audio_preprocessor import AudioPreprocessor

logger = logging.getLogger(__name__)


class ConcurrentFingerprintExtractor:
    def __init__(
        self,
        extractor: FingerprintExtractor,
        preprocessor: Optional[AudioPreprocessor] = None,
        max_workers: int = 4,
        use_threads: bool = True
    ):
        self.extractor = extractor
        self.preprocessor = preprocessor
        self.max_workers = max_workers
        self.use_threads = use_threads
        self._executor_class = ThreadPoolExecutor if use_threads else ProcessPoolExecutor

    def extract_from_array_chunks(
        self,
        audio_array: np.ndarray,
        sample_rate: int,
        chunk_size_seconds: float = 3.0,
        overlap_seconds: float = 1.0
    ) -> Dict:
        chunk_size = int(chunk_size_seconds * sample_rate)
        hop_size = int((chunk_size_seconds - overlap_seconds) * sample_rate)

        chunks = []
        for i in range(0, len(audio_array), hop_size):
            chunk = audio_array[i:i + chunk_size]
            if len(chunk) >= int(0.5 * sample_rate):
                chunks.append((chunk, i // self.extractor.hop_length))

        all_hashes = []
        all_peaks = 0

        with self._executor_class(max_workers=self.max_workers) as executor:
            futures = [
                executor.submit(
                    self._extract_single_chunk,
                    chunk,
                    time_offset
                ) for chunk, time_offset in chunks
            ]

            for future in as_completed(futures):
                try:
                    result = future.result()
                    all_hashes.extend(result['hashes'])
                    all_peaks += result['num_peaks']
                except Exception as e:
                    logger.error(f"Error processing chunk: {e}")

        unique_hashes = self._deduplicate_hashes(all_hashes)
        hash_vector = self.extractor._hashes_to_vector(unique_hashes)

        return {
            'hashes': unique_hashes,
            'hash_vector': hash_vector,
            'num_peaks': all_peaks,
            'num_hashes': len(unique_hashes),
            'chunks_processed': len(chunks)
        }

    def _extract_single_chunk(
        self,
        audio_chunk: np.ndarray,
        time_offset: int
    ) -> Dict:
        try:
            result = self.extractor.extract_fingerprint(audio_chunk)

            offset_hashes = [
                (h, t + time_offset)
                for h, t in result['hashes']
            ]

            return {
                'hashes': offset_hashes,
                'num_peaks': result['num_peaks']
            }
        except Exception as e:
            logger.error(f"Chunk extraction error: {e}")
            return {'hashes': [], 'num_peaks': 0}

    def _deduplicate_hashes(self, hashes: List[Tuple[str, int]]) -> List[Tuple[str, int]]:
        seen = set()
        unique = []
        for h, t in hashes:
            key = (h, t)
            if key not in seen:
                seen.add(key)
                unique.append((h, t))
        return unique

    def batch_extract_files(
        self,
        file_paths: List[str],
        with_preprocessing: bool = True
    ) -> List[Dict]:
        results = []

        with self._executor_class(max_workers=self.max_workers) as executor:
            future_to_file = {
                executor.submit(
                    self._extract_single_file,
                    file_path,
                    with_preprocessing
                ): file_path
                for file_path in file_paths
            }

            for future in as_completed(future_to_file):
                file_path = future_to_file[future]
                try:
                    result = future.result()
                    result['file_path'] = file_path
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error processing {file_path}: {e}")
                    results.append({
                        'file_path': file_path,
                        'error': str(e),
                        'success': False
                    })

        return results

    def _extract_single_file(
        self,
        file_path: str,
        with_preprocessing: bool
    ) -> Dict:
        y, sr = librosa.load(file_path, sr=self.extractor.sample_rate, mono=True)

        if with_preprocessing and self.preprocessor:
            y = self.preprocessor.preprocess(y)

        result = self.extract_from_array_chunks(
            y,
            self.extractor.sample_rate,
            chunk_size_seconds=5.0,
            overlap_seconds=2.0
        )

        duration = len(y) / sr
        result['duration'] = duration
        result['success'] = True
        return result


class ParallelMatcher:
    def __init__(self, db_session_factory, max_workers: int = 4):
        self.db_session_factory = db_session_factory
        self.max_workers = max_workers

    def match_parallel(
        self,
        query_hashes: List[Tuple[str, int]],
        batch_size: int = 1000
    ) -> List[Dict]:
        hash_batches = [
            query_hashes[i:i + batch_size]
            for i in range(0, len(query_hashes), batch_size)
        ]

        all_results = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [
                executor.submit(self._match_batch, batch)
                for batch in hash_batches
            ]

            for future in as_completed(futures):
                try:
                    results = future.result()
                    all_results.extend(results)
                except Exception as e:
                    logger.error(f"Match batch error: {e}")

        aggregated = self._aggregate_results(all_results)
        return aggregated

    def _match_batch(self, hash_batch: List[Tuple[str, int]]) -> List[Dict]:
        db = self.db_session_factory()
        try:
            from ..services.matcher import FingerprintMatcher
            matcher = FingerprintMatcher(db)
            return matcher.match_by_hash(hash_batch)
        finally:
            db.close()

    def _aggregate_results(self, all_results: List[List[Dict]]) -> List[Dict]:
        song_scores = {}

        for batch_results in all_results:
            for result in batch_results:
                song_id = result['song_id']
                if song_id not in song_scores:
                    song_scores[song_id] = {
                        **result,
                        'match_count': 0,
                        'max_offset_alignment': 0,
                        'confidence_sum': 0.0,
                        'count': 0
                    }

                song_scores[song_id]['match_count'] += result.get('match_count', 0)
                song_scores[song_id]['max_offset_alignment'] = max(
                    song_scores[song_id]['max_offset_alignment'],
                    result.get('max_offset_alignment', 0)
                )
                song_scores[song_id]['confidence_sum'] += result.get('confidence', 0)
                song_scores[song_id]['count'] += 1

        for song_id in song_scores:
            if song_scores[song_id]['count'] > 0:
                song_scores[song_id]['confidence'] = (
                    song_scores[song_id]['confidence_sum'] / song_scores[song_id]['count']
                )
            del song_scores[song_id]['confidence_sum']
            del song_scores[song_id]['count']

        sorted_results = sorted(
            song_scores.values(),
            key=lambda x: x['confidence'],
            reverse=True
        )

        return sorted_results[:10]
