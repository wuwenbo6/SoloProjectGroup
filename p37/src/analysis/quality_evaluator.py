import numpy as np
from typing import Dict, List, Optional, Tuple
from scipy import stats
from collections import defaultdict
import json
from datetime import datetime


class QualityScorer:
    def __init__(self):
        self.dimension_weights = {
            'pitch_accuracy': 0.20,
            'rhythm_stability': 0.15,
            'vocal_timbre': 0.20,
            'emotional_expression': 0.15,
            'technique_proficiency': 0.15,
            'style_authenticity': 0.15
        }

    def calculate_overall_score(self, dimension_scores: Dict[str, float]) -> float:
        valid_scores = {}
        for dim, weight in self.dimension_weights.items():
            score = dimension_scores.get(dim)
            if score is not None and not np.isnan(score):
                valid_scores[dim] = score

        if not valid_scores:
            return 0.0

        total_weight = sum(self.dimension_weights[d] for d in valid_scores.keys())
        weighted_sum = sum(
            valid_scores[d] * self.dimension_weights[d]
            for d in valid_scores.keys()
        )

        return round(weighted_sum / total_weight, 2)

    def get_grade(self, score: float) -> str:
        if score >= 90:
            return '优秀 (S)'
        elif score >= 80:
            return '良好 (A)'
        elif score >= 70:
            return '中等 (B)'
        elif score >= 60:
            return '及格 (C)'
        else:
            return '待提高 (D)'


class AutomaticQualityEvaluator:
    def __init__(self):
        self.scorer = QualityScorer()
        self._load_reference_norms()

    def _load_reference_norms(self):
        self.reference_norms = {
            'pitch_mean': {'min': 100, 'max': 800, 'optimal': 350},
            'pitch_std': {'min': 0, 'max': 200, 'optimal': 50},
            'pitch_range': {'min': 50, 'max': 600, 'optimal': 300},
            'tempo': {'min': 40, 'max': 200, 'optimal': 100},
            'rms_mean': {'min': 0.01, 'max': 0.5, 'optimal': 0.1},
            'rms_std': {'min': 0, 'max': 0.3, 'optimal': 0.05},
            'spectral_centroid_mean': {'min': 500, 'max': 5000, 'optimal': 2000},
            'spectral_bandwidth_mean': {'min': 500, 'max': 3000, 'optimal': 1500},
        }

    def evaluate_from_features(self, features: Dict) -> Dict:
        evaluations = {}

        evaluations['pitch_accuracy'] = self._evaluate_pitch_accuracy(features)
        evaluations['rhythm_stability'] = self._evaluate_rhythm_stability(features)
        evaluations['vocal_timbre'] = self._evaluate_vocal_timbre(features)
        evaluations['emotional_expression'] = self._evaluate_emotional_expression(features)
        evaluations['technique_proficiency'] = self._evaluate_technique_proficiency(features)
        evaluations['style_authenticity'] = self._evaluate_style_authenticity(features)

        overall_score = self.scorer.calculate_overall_score(evaluations)

        return {
            'dimension_scores': evaluations,
            'overall_score': overall_score,
            'grade': self.scorer.get_grade(overall_score),
            'evaluation_timestamp': datetime.now().isoformat()
        }

    def _evaluate_pitch_accuracy(self, features: Dict) -> float:
        pitch_std = features.get('pitch_std', 0)
        pitch_mean = features.get('pitch_mean', 0)
        pitch_range = features.get('pitch_range', 0)

        std_score = max(0, 100 - (pitch_std / 200) * 50)

        range_score = 0
        if 100 <= pitch_range <= 500:
            range_score = 100
        elif 50 <= pitch_range < 100 or 500 < pitch_range <= 600:
            range_score = 75

        optimal_pitch = 350
        deviation = abs(pitch_mean - optimal_pitch) / optimal_pitch
        mean_score = max(0, 100 - deviation * 100)

        return round((std_score * 0.4 + range_score * 0.3 + mean_score * 0.3), 2)

    def _evaluate_rhythm_stability(self, features: Dict) -> float:
        tempo = features.get('tempo', 0)
        rms_std = features.get('rms_std', 0)

        tempo_score = 0
        if 60 <= tempo <= 160:
            tempo_score = 100
        elif 40 <= tempo < 60 or 160 < tempo <= 200:
            tempo_score = 75

        stability_score = max(0, 100 - (rms_std / 0.3) * 50)

        return round((tempo_score * 0.5 + stability_score * 0.5), 2)

    def _evaluate_vocal_timbre(self, features: Dict) -> float:
        spectral_centroid = features.get('spectral_centroid_mean', 0)
        spectral_bandwidth = features.get('spectral_bandwidth_mean', 0)

        centroid_score = 0
        if 1000 <= spectral_centroid <= 3000:
            centroid_score = 100
        elif 500 <= spectral_centroid < 1000 or 3000 < spectral_centroid <= 5000:
            centroid_score = 75

        bandwidth_score = 0
        if 1000 <= spectral_bandwidth <= 2000:
            bandwidth_score = 100
        elif 500 <= spectral_bandwidth < 1000 or 2000 < spectral_bandwidth <= 3000:
            bandwidth_score = 75

        return round((centroid_score * 0.6 + bandwidth_score * 0.4), 2)

    def _evaluate_emotional_expression(self, features: Dict) -> float:
        rms_std = features.get('rms_std', 0)
        pitch_range = features.get('pitch_range', 0)
        spectral_centroid_std = features.get('spectral_centroid_std', 0)

        dynamics_score = min(100, (rms_std / 0.05) * 100) if rms_std > 0 else 50

        expressivity_score = 0
        if pitch_range >= 200:
            expressivity_score = 100
        elif pitch_range >= 100:
            expressivity_score = 75
        else:
            expressivity_score = 50

        return round((dynamics_score * 0.5 + expressivity_score * 0.5), 2)

    def _evaluate_technique_proficiency(self, features: Dict) -> float:
        pitch_range = features.get('pitch_range', 0)
        rms_mean = features.get('rms_mean', 0)

        range_score = min(100, (pitch_range / 300) * 100)

        projection_score = min(100, (rms_mean / 0.1) * 100) if rms_mean > 0 else 50

        return round((range_score * 0.6 + projection_score * 0.4), 2)

    def _evaluate_style_authenticity(self, features: Dict) -> float:
        pitch_mean = features.get('pitch_mean', 0)
        tempo = features.get('tempo', 0)

        opera_pitch_ranges = {
            'Beijing_Opera': (300, 600),
            'Yue_Opera': (400, 700),
            'Yu_Opera': (250, 550),
            'Kun_Opera': (350, 650),
        }

        match_scores = []
        for (min_p, max_p) in opera_pitch_ranges.values():
            if min_p <= pitch_mean <= max_p:
                match_scores.append(100)
            else:
                center = (min_p + max_p) / 2
                deviation = abs(pitch_mean - center) / (max_p - min_p)
                match_scores.append(max(0, 100 - deviation * 100))

        pitch_match_score = max(match_scores) if match_scores else 50

        tempo_score = 0
        if 60 <= tempo <= 140:
            tempo_score = 100
        elif 40 <= tempo < 60 or 140 < tempo <= 180:
            tempo_score = 75

        return round((pitch_match_score * 0.6 + tempo_score * 0.4), 2)


class UserAnnotationManager:
    def __init__(self, db_session):
        self.db = db_session

    def add_rating(self, audio_id: int, user_id: int,
                    pitch_accuracy: Optional[float] = None,
                    rhythm_accuracy: Optional[float] = None,
                    vocal_quality: Optional[float] = None,
                    emotional_expression: Optional[float] = None,
                    technique: Optional[float] = None,
                    style_authenticity: Optional[float] = None,
                    comment: Optional[str] = None) -> Dict:
        from ..database.models import SingingQualityRating

        dimension_scores = {
            'pitch_accuracy': pitch_accuracy,
            'rhythm_accuracy': rhythm_accuracy,
            'vocal_quality': vocal_quality,
            'emotional_expression': emotional_expression,
            'technique': technique,
            'style_authenticity': style_authenticity
        }

        valid_scores = [v for v in dimension_scores.values() if v is not None]
        overall_score = sum(valid_scores) / len(valid_scores) if valid_scores else None

        rating = SingingQualityRating(
            audio_id=audio_id,
            user_id=user_id,
            pitch_accuracy=pitch_accuracy,
            rhythm_accuracy=rhythm_accuracy,
            vocal_quality=vocal_quality,
            emotional_expression=emotional_expression,
            technique=technique,
            style_authenticity=style_authenticity,
            overall_score=overall_score,
            comment=comment
        )

        self.db.add(rating)
        self.db.commit()

        return {
            'rating_id': rating.id,
            'overall_score': overall_score,
            'dimension_scores': dimension_scores
        }

    def add_annotation(self, audio_id: int, user_id: int,
                        annotation_type: str,
                        start_time: Optional[float] = None,
                        end_time: Optional[float] = None,
                        content: str = '',
                        tags: Optional[List[str]] = None,
                        confidence: Optional[float] = None) -> Dict:
        from ..database.models import UserAnnotation

        annotation = UserAnnotation(
            audio_id=audio_id,
            user_id=user_id,
            annotation_type=annotation_type,
            start_time=start_time,
            end_time=end_time,
            content=content,
            tags=json.dumps(tags or [], ensure_ascii=False),
            confidence=confidence
        )

        self.db.add(annotation)
        self.db.commit()

        return {
            'annotation_id': annotation.id,
            'annotation_type': annotation_type,
            'content': content
        }

    def get_audio_ratings(self, audio_id: int, limit: int = 100) -> Dict:
        from ..database.models import SingingQualityRating, User

        ratings = self.db.query(SingingQualityRating).filter(
            SingingQualityRating.audio_id == audio_id
        ).order_by(SingingQualityRating.created_at.desc()).limit(limit).all()

        result = {
            'ratings': [],
            'summary': {}
        }

        dimension_scores = defaultdict(list)
        overall_scores = []

        for r in ratings:
            rating_data = {
                'id': r.id,
                'user_id': r.user_id,
                'username': r.rater.username if r.rater else None,
                'pitch_accuracy': r.pitch_accuracy,
                'rhythm_accuracy': r.rhythm_accuracy,
                'vocal_quality': r.vocal_quality,
                'emotional_expression': r.emotional_expression,
                'technique': r.technique,
                'style_authenticity': r.style_authenticity,
                'overall_score': r.overall_score,
                'comment': r.comment,
                'created_at': r.created_at.isoformat() if r.created_at else None
            }
            result['ratings'].append(rating_data)

            if r.overall_score is not None:
                overall_scores.append(r.overall_score)
            for dim in ['pitch_accuracy', 'rhythm_accuracy', 'vocal_quality',
                        'emotional_expression', 'technique', 'style_authenticity']:
                val = getattr(r, dim)
                if val is not None:
                    dimension_scores[dim].append(val)

        if overall_scores:
            result['summary'] = {
                'count': len(overall_scores),
                'mean': round(np.mean(overall_scores), 2),
                'std': round(np.std(overall_scores), 2),
                'min': round(np.min(overall_scores), 2),
                'max': round(np.max(overall_scores), 2),
                'dimension_means': {
                    dim: round(np.mean(scores), 2) if scores else None
                    for dim, scores in dimension_scores.items()
                }
            }

        return result

    def get_audio_annotations(self, audio_id: int,
                                annotation_type: Optional[str] = None,
                                limit: int = 200) -> List[Dict]:
        from ..database.models import UserAnnotation, User

        query = self.db.query(UserAnnotation).filter(UserAnnotation.audio_id == audio_id)

        if annotation_type:
            query = query.filter(UserAnnotation.annotation_type == annotation_type)

        annotations = query.order_by(UserAnnotation.created_at.desc()).limit(limit).all()

        result = []
        for a in annotations:
            result.append({
                'id': a.id,
                'user_id': a.user_id,
                'username': a.annotator.username if a.annotator else None,
                'annotation_type': a.annotation_type,
                'start_time': a.start_time,
                'end_time': a.end_time,
                'content': a.content,
                'tags': json.loads(a.tags) if a.tags else [],
                'confidence': a.confidence,
                'is_verified': a.is_verified,
                'created_at': a.created_at.isoformat() if a.created_at else None
            })

        return result

    def get_user_ratings(self, user_id: int, limit: int = 100) -> List[Dict]:
        from ..database.models import SingingQualityRating

        ratings = self.db.query(SingingQualityRating).filter(
            SingingQualityRating.user_id == user_id
        ).order_by(SingingQualityRating.created_at.desc()).limit(limit).all()

        return [
            {
                'id': r.id,
                'audio_id': r.audio_id,
                'overall_score': r.overall_score,
                'comment': r.comment,
                'created_at': r.created_at.isoformat() if r.created_at else None
            }
            for r in ratings
        ]

    def verify_annotation(self, annotation_id: int, verifier_id: int) -> bool:
        from ..database.models import UserAnnotation

        annotation = self.db.query(UserAnnotation).get(annotation_id)
        if not annotation:
            return False

        annotation.is_verified = True
        annotation.verified_by = verifier_id
        self.db.commit()

        return True

    def generate_rating_report(self, audio_id: int) -> Dict:
        ratings_data = self.get_audio_ratings(audio_id)
        annotations = self.get_audio_annotations(audio_id)

        auto_evaluator = AutomaticQualityEvaluator()

        from ..database.models import AudioData
        audio = self.db.query(AudioData).get(audio_id)

        auto_evaluation = None
        if audio and audio.features:
            features = {}
            for key in ['pitch_mean', 'pitch_std', 'pitch_range', 'tempo',
                        'rms_mean', 'rms_std', 'spectral_centroid_mean',
                        'spectral_bandwidth_mean']:
                if hasattr(audio.features, key):
                    features[key] = getattr(audio.features, key)
            auto_evaluation = auto_evaluator.evaluate_from_features(features)

        return {
            'audio_id': audio_id,
            'human_ratings': ratings_data,
            'automatic_evaluation': auto_evaluation,
            'annotations': annotations,
            'annotation_count': len(annotations),
            'generated_at': datetime.now().isoformat()
        }

    def get_top_rated_audios(self, opera_type: Optional[str] = None,
                               limit: int = 20) -> List[Dict]:
        from ..database.models import AudioData, SingingQualityRating
        from sqlalchemy import func

        query = self.db.query(
            AudioData,
            func.avg(SingingQualityRating.overall_score).label('avg_score'),
            func.count(SingingQualityRating.id).label('rating_count')
        ).join(SingingQualityRating)

        if opera_type:
            query = query.filter(AudioData.opera_type == opera_type)

        results = query.group_by(AudioData.id).having(
            func.count(SingingQualityRating.id) >= 2
        ).order_by(func.avg(SingingQualityRating.overall_score).desc()).limit(limit).all()

        return [
            {
                'audio_id': audio.id,
                'filename': audio.filename,
                'opera_type': audio.opera_type,
                'average_score': round(float(avg_score), 2),
                'rating_count': int(rating_count)
            }
            for audio, avg_score, rating_count in results
        ]
