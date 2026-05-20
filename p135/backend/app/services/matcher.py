import numpy as np
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from collections import defaultdict
from ..models import Song, Fingerprint


class FingerprintMatcher:
    def __init__(self, db: Session, top_n: int = 5, score_threshold: float = 0.3, min_alignment_score: int = 3):
        self.db = db
        self.top_n = top_n
        self.score_threshold = score_threshold
        self.min_alignment_score = min_alignment_score

    def match_by_hash(self, query_hashes: List[Tuple[str, int]]) -> List[Dict]:
        if len(query_hashes) == 0:
            return []

        hash_values = [h for h, _ in query_hashes]
        query_hash_offsets = defaultdict(list)
        for h, o in query_hashes:
            query_hash_offsets[h].append(o)

        matching_fingerprints = (
            self.db.query(Fingerprint)
            .filter(Fingerprint.hash.in_(hash_values))
            .options(
                db.joinedload(Fingerprint.song)
            )
            .all()
        )

        song_offset_histograms = defaultdict(lambda: defaultdict(int))
        song_match_details = defaultdict(lambda: {"total_matches": 0, "unique_hashes": set()})

        for fp in matching_fingerprints:
            query_offsets = query_hash_offsets.get(fp.hash, [])
            for query_offset in query_offsets:
                offset_diff = fp.offset - query_offset
                song_offset_histograms[fp.song_id][offset_diff] += 1
                song_match_details[fp.song_id]["total_matches"] += 1
                song_match_details[fp.song_id]["unique_hashes"].add(fp.hash)

        song_scores = []
        song_cache = {}

        for song_id, histogram in song_offset_histograms.items():
            if not histogram:
                continue

            counts = list(histogram.values())
            max_count = max(counts)
            total_matches = song_match_details[song_id]["total_matches"]
            unique_hash_count = len(song_match_details[song_id]["unique_hashes"])

            if max_count < self.min_alignment_score:
                continue

            sorted_counts = sorted(counts, reverse=True)
            top3_sum = sum(sorted_counts[:3])

            alignment_score = max_count * 0.6 + top3_sum * 0.4
            hash_density = unique_hash_count / max(len(query_hashes), 1)
            confidence = (alignment_score / max(len(query_hashes), 1)) * 0.7 + hash_density * 0.3

            if song_id in song_cache:
                song = song_cache[song_id]
            else:
                song = (
                    self.db.query(Song)
                    .filter(Song.id == song_id)
                    .first()
                )
                song_cache[song_id] = song

            if song:
                song_scores.append(
                    {
                        "song_id": song.id,
                        "title": song.title,
                        "artist": song.artist,
                        "album": song.album,
                        "confidence": float(confidence),
                        "match_count": total_matches,
                        "unique_hash_count": unique_hash_count,
                        "max_offset_alignment": max_count,
                        "alignment_score": float(alignment_score),
                    }
                )

        song_scores.sort(key=lambda x: x["confidence"], reverse=True)
        filtered_scores = [
            s for s in song_scores if s["confidence"] >= self.score_threshold
        ]

        return filtered_scores[: self.top_n]

    def match_by_vector(self, query_vector: np.ndarray) -> List[Dict]:
        query_vector = query_vector.tolist()

        results = (
            self.db.query(
                Fingerprint.song_id,
                Song.title,
                Song.artist,
                Song.album,
                (1 - Fingerprint.vector.cosine_distance(query_vector)).label("similarity"),
            )
            .join(Song)
            .order_by(Fingerprint.vector.cosine_distance(query_vector))
            .limit(100)
            .all()
        )

        song_scores = defaultdict(list)
        for song_id, title, artist, album, similarity in results:
            song_scores[song_id].append(
                {
                    "song_id": song_id,
                    "title": title,
                    "artist": artist,
                    "album": album,
                    "similarity": float(similarity),
                }
            )

        aggregated_scores = []
        for song_id, scores in song_scores.items():
            avg_similarity = np.mean([s["similarity"] for s in scores])
            max_similarity = max([s["similarity"] for s in scores])

            first_score = scores[0]
            aggregated_scores.append(
                {
                    "song_id": song_id,
                    "title": first_score["title"],
                    "artist": first_score["artist"],
                    "album": first_score["album"],
                    "avg_similarity": float(avg_similarity),
                    "max_similarity": float(max_similarity),
                    "match_count": len(scores),
                }
            )

        aggregated_scores.sort(key=lambda x: x["max_similarity"], reverse=True)
        return aggregated_scores[: self.top_n]

    def match_combined(
        self, query_hashes: List[Tuple[str, int]], query_vector: np.ndarray
    ) -> List[Dict]:
        hash_matches = self.match_by_hash(query_hashes)
        vector_matches = self.match_by_vector(query_vector)

        combined_scores = {}

        for match in hash_matches:
            combined_scores[match["song_id"]] = {
                "song_id": match["song_id"],
                "title": match["title"],
                "artist": match["artist"],
                "album": match["album"],
                "hash_confidence": match["confidence"],
                "vector_similarity": 0.0,
                "combined_score": match["confidence"] * 0.7,
                "match_count": match["match_count"],
            }

        for match in vector_matches:
            if match["song_id"] in combined_scores:
                combined_scores[match["song_id"]]["vector_similarity"] = match[
                    "max_similarity"
                ]
                combined_scores[match["song_id"]]["combined_score"] += (
                    match["max_similarity"] * 0.3
                )
            else:
                combined_scores[match["song_id"]] = {
                    "song_id": match["song_id"],
                    "title": match["title"],
                    "artist": match["artist"],
                    "album": match["album"],
                    "hash_confidence": 0.0,
                    "vector_similarity": match["max_similarity"],
                    "combined_score": match["max_similarity"] * 0.3,
                    "match_count": match["match_count"],
                }

        result_list = list(combined_scores.values())
        result_list.sort(key=lambda x: x["combined_score"], reverse=True)

        filtered_results = [
            r for r in result_list if r["combined_score"] >= self.score_threshold * 0.5
        ]

        return filtered_results[: self.top_n]
