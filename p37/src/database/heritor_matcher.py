import re
import json
from difflib import SequenceMatcher
from typing import List, Dict, Tuple, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class HeritorMatcher:
    def __init__(self, db_session):
        self.db = db_session
        self.name_aliases = self._build_name_aliases()
        self.vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 3))

    def _build_name_aliases(self) -> Dict[str, List[str]]:
        aliases = {}
        from .models import Heritor
        heritors = self.db.query(Heritor).all()
        for h in heritors:
            name = h.name
            aliases[name] = [name]
            if len(name) >= 2:
                aliases[name].append(name[1:])
                aliases[name].append(name[:-1])
                aliases[name].append(name[0] + name[-1])
        return aliases

    def match_by_name(self, singer_name: str, threshold: float = 0.6) -> List[Tuple[int, str, float]]:
        from .models import Heritor

        if not singer_name:
            return []

        matches = []
        heritors = self.db.query(Heritor).all()

        for h in heritors:
            similarity = self._calculate_name_similarity(singer_name, h.name)
            if similarity >= threshold:
                matches.append((h.id, h.name, similarity))

        matches.sort(key=lambda x: x[2], reverse=True)
        return matches

    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        if not name1 or not name2:
            return 0.0

        name1_clean = re.sub(r'[^\w\s]', '', name1).lower()
        name2_clean = re.sub(r'[^\w\s]', '', name2).lower()

        if name1_clean == name2_clean:
            return 1.0

        if name1_clean in name2_clean or name2_clean in name1_clean:
            return 0.9

        return SequenceMatcher(None, name1_clean, name2_clean).ratio()

    def match_by_features(self, features: Dict, opera_genre: Optional[str] = None,
                          threshold: float = 0.5) -> List[Tuple[int, str, float]]:
        from .models import Heritor, AudioData, FeatureData

        query = self.db.query(Heritor)
        if opera_genre:
            query = query.join(Heritor.opera_genre).filter(
                (Heritor.opera_genre.has(name_cn=opera_genre)) |
                (Heritor.opera_genre.has(name=opera_genre))
            )

        heritors = query.all()
        matches = []

        for h in heritors:
            heritor_features = self._get_heritor_average_features(h.id)
            if heritor_features:
                similarity = self._calculate_feature_similarity(features, heritor_features)
                if similarity >= threshold:
                    matches.append((h.id, h.name, similarity))

        matches.sort(key=lambda x: x[2], reverse=True)
        return matches

    def _get_heritor_average_features(self, heritor_id: int) -> Optional[Dict]:
        from .models import AudioData, FeatureData

        audio_records = self.db.query(AudioData).filter(
            AudioData.heritor_id == heritor_id,
            AudioData.features.isnot(None)
        ).all()

        if not audio_records:
            return None

        feature_keys = [
            'pitch_mean', 'pitch_std', 'tempo', 'rms_mean',
            'spectral_centroid_mean', 'spectral_bandwidth_mean'
        ]

        avg_features = {}
        for key in feature_keys:
            values = []
            for audio in audio_records:
                if audio.features and hasattr(audio.features, key):
                    val = getattr(audio.features, key)
                    if val is not None:
                        values.append(val)
            if values:
                avg_features[key] = np.mean(values)

        return avg_features if avg_features else None

    def _calculate_feature_similarity(self, feat1: Dict, feat2: Dict) -> float:
        common_keys = set(feat1.keys()) & set(feat2.keys())
        if not common_keys:
            return 0.0

        similarities = []
        for key in common_keys:
            v1, v2 = feat1.get(key), feat2.get(key)
            if v1 is not None and v2 is not None and v2 != 0:
                diff = abs(v1 - v2) / max(abs(v1), abs(v2), 1)
                similarities.append(1 - min(diff, 1))

        return np.mean(similarities) if similarities else 0.0

    def match_combined(self, singer_name: str, features: Dict,
                        opera_genre: Optional[str] = None,
                        name_weight: float = 0.6, feature_weight: float = 0.4,
                        threshold: float = 0.5) -> List[Tuple[int, str, float]]:
        from .models import Heritor

        name_matches = dict(self.match_by_name(singer_name, threshold=0.3))
        feature_matches = dict(self.match_by_features(features, opera_genre, threshold=0.3))

        all_heritor_ids = set(name_matches.keys()) | set(feature_matches.keys())

        combined_matches = []
        for h_id in all_heritor_ids:
            name_score = name_matches.get(h_id, 0)
            feature_score = feature_matches.get(h_id, 0)
            combined_score = name_score * name_weight + feature_score * feature_weight

            if combined_score >= threshold:
                heritor = self.db.query(Heritor).get(h_id)
                if heritor:
                    combined_matches.append((h_id, heritor.name, combined_score))

        combined_matches.sort(key=lambda x: x[2], reverse=True)
        return combined_matches

    def auto_assign_heritor(self, audio_id: int) -> Optional[Dict]:
        from .models import AudioData, FeatureData

        audio = self.db.query(AudioData).get(audio_id)
        if not audio:
            return None

        features = {}
        if audio.features:
            feature_data = audio.features
            features = {
                'pitch_mean': feature_data.pitch_mean,
                'pitch_std': feature_data.pitch_std,
                'tempo': feature_data.tempo,
                'rms_mean': feature_data.rms_mean,
                'spectral_centroid_mean': feature_data.spectral_centroid_mean
            }

        matches = self.match_combined(
            singer_name=audio.singer_name or '',
            features=features,
            opera_genre=audio.opera_type
        )

        if matches:
            best_match_id, best_match_name, confidence = matches[0]
            audio.heritor_id = best_match_id
            audio.auto_assigned = True
            audio.assignment_confidence = confidence

            if not audio.decade and audio.year:
                audio.decade = (audio.year // 10) * 10

            self.db.commit()

            return {
                'audio_id': audio_id,
                'heritor_id': best_match_id,
                'heritor_name': best_match_name,
                'confidence': confidence,
                'top_matches': matches[:5]
            }

        return None

    def batch_assign_heritors(self, audio_ids: List[int],
                               auto_commit: bool = True) -> Dict:
        results = {
            'assigned': [],
            'failed': [],
            'total': len(audio_ids)
        }

        for audio_id in audio_ids:
            try:
                assignment = self.auto_assign_heritor(audio_id)
                if assignment:
                    results['assigned'].append(assignment)
                else:
                    results['failed'].append(audio_id)
            except Exception as e:
                results['failed'].append({'audio_id': audio_id, 'error': str(e)})

        if auto_commit:
            self.db.commit()

        return results

    def get_unassigned_audios(self, limit: int = 100) -> List:
        from .models import AudioData
        return self.db.query(AudioData).filter(
            AudioData.heritor_id.is_(None)
        ).order_by(AudioData.upload_time.desc()).limit(limit).all()

    def suggest_corrections(self, audio_id: int, top_k: int = 5) -> List[Dict]:
        from .models import AudioData, Heritor

        audio = self.db.query(AudioData).get(audio_id)
        if not audio:
            return []

        features = {}
        if audio.features:
            fd = audio.features
            features = {
                'pitch_mean': fd.pitch_mean,
                'pitch_std': fd.pitch_std,
                'tempo': fd.tempo,
                'rms_mean': fd.rms_mean,
            }

        matches = self.match_combined(
            singer_name=audio.singer_name or '',
            features=features,
            opera_genre=audio.opera_type,
            threshold=0.2
        )

        suggestions = []
        for h_id, h_name, conf in matches[:top_k]:
            heritor = self.db.query(Heritor).get(h_id)
            suggestions.append({
                'heritor_id': h_id,
                'name': h_name,
                'opera_genre': heritor.opera_genre.name_cn if heritor.opera_genre else None,
                'confidence': conf
            })

        return suggestions


class HeritorDataImporter:
    def __init__(self, db_session):
        self.db = db_session

    def import_heritors_from_json(self, json_path: str) -> Dict:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        results = {
            'imported': [],
            'skipped': [],
            'errors': []
        }

        for item in data:
            try:
                result = self._import_single_heritor(item)
                if result['status'] == 'imported':
                    results['imported'].append(result)
                else:
                    results['skipped'].append(result)
            except Exception as e:
                results['errors'].append({
                    'name': item.get('name'),
                    'error': str(e)
                })

        self.db.commit()
        return results

    def _import_single_heritor(self, item: Dict) -> Dict:
        from .models import Heritor, OperaGenre

        name = item.get('name')
        if not name:
            return {'status': 'error', 'name': name, 'error': 'Missing name'}

        existing = self.db.query(Heritor).filter_by(name=name).first()
        if existing:
            return {'status': 'skipped', 'name': name, 'reason': 'Already exists'}

        genre_name = item.get('opera_genre')
        genre_id = None
        if genre_name:
            genre = self.db.query(OperaGenre).filter(
                (OperaGenre.name_cn == genre_name) |
                (OperaGenre.name == genre_name)
            ).first()
            if genre:
                genre_id = genre.id

        heritor = Heritor(
            name=name,
            gender=item.get('gender'),
            birth_year=item.get('birth_year'),
            birth_place=item.get('birth_place'),
            opera_genre_id=genre_id,
            school=item.get('school'),
            generation=item.get('generation'),
            title=item.get('title'),
            master=item.get('master'),
            biography=item.get('biography'),
            representative_works=json.dumps(item.get('representative_works', []), ensure_ascii=False),
            style_features=json.dumps(item.get('style_features', {}), ensure_ascii=False)
        )

        self.db.add(heritor)
        return {'status': 'imported', 'name': name}

    def create_sample_heritors(self) -> Dict:
        from .models import OperaGenre, Heritor

        sample_genres = [
            {'name': 'Beijing_Opera', 'name_cn': '京剧', 'region': '北京',
             'description': '皮黄唱腔，讲究字正腔圆'},
            {'name': 'Yue_Opera', 'name_cn': '越剧', 'region': '浙江',
             'description': '柔美婉转，长于抒情'},
            {'name': 'Yu_Opera', 'name_cn': '豫剧', 'region': '河南',
             'description': '高亢激越，大气磅礴'},
            {'name': 'Huangmei_Opera', 'name_cn': '黄梅戏', 'region': '安徽',
             'description': '质朴细腻，民歌风味'},
        ]

        imported_genres = []
        for g_data in sample_genres:
            existing = self.db.query(OperaGenre).filter_by(name=g_data['name']).first()
            if not existing:
                genre = OperaGenre(**g_data)
                self.db.add(genre)
                self.db.flush()
                imported_genres.append(genre)
            else:
                imported_genres.append(existing)

        sample_heritors = [
            {'name': '梅兰芳', 'gender': '男', 'birth_year': 1894,
             'opera_genre': '京剧', 'school': '梅派', 'generation': 1,
             'title': '京剧大师', 'master': '吴菱仙',
             'biography': '中国京剧表演艺术大师',
             'representative_works': ['贵妃醉酒', '霸王别姬', '宇宙锋'],
             'style_features': {'pitch_range': 'wide', 'vibrato': 'elegant'}},
            {'name': '程砚秋', 'gender': '男', 'birth_year': 1904,
             'opera_genre': '京剧', 'school': '程派', 'generation': 1,
             'title': '京剧大师', 'master': '梅兰芳',
             'biography': '京剧程派创始人',
             'representative_works': ['锁麟囊', '荒山泪', '窦娥冤'],
             'style_features': {'pitch_range': 'medium', 'vibrato': 'melancholic'}},
        ]

        imported_heritors = []
        for h_data in sample_heritors:
            genre_name = h_data.pop('opera_genre')
            genre = next((g for g in imported_genres if g.name_cn == genre_name), None)
            if genre:
                h_data['opera_genre_id'] = genre.id

            existing = self.db.query(Heritor).filter_by(name=h_data['name']).first()
            if not existing:
                h_data['representative_works'] = json.dumps(h_data['representative_works'], ensure_ascii=False)
                h_data['style_features'] = json.dumps(h_data['style_features'], ensure_ascii=False)
                heritor = Heritor(**h_data)
                self.db.add(heritor)
                imported_heritors.append(heritor.name)

        self.db.commit()
        return {
            'genres_imported': len(imported_genres),
            'heritors_imported': imported_heritors
        }
