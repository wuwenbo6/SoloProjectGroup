import os
import pandas as pd
from typing import Optional, List, Dict
from datetime import datetime
from .models import db, User, AudioData, FeatureData, AnalysisResult


class DatabaseManager:
    def __init__(self, app=None, db_url: Optional[str] = None):
        if db_url is None:
            db_url = f"sqlite:///{os.path.join(os.getcwd(), 'opera_database.db')}"

        if app is not None:
            app.config['SQLALCHEMY_DATABASE_URI'] = db_url
            app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
            db.init_app(app)
            with app.app_context():
                db.create_all()

        self.app = app

    def init_app(self, app):
        db.init_app(app)
        with app.app_context():
            db.create_all()

    def create_user(self, username: str, email: str, password: str,
                    full_name: Optional[str] = None, role: str = 'user') -> User:
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            role=role
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user

    def get_user(self, user_id: Optional[int] = None, username: Optional[str] = None,
                 email: Optional[str] = None) -> Optional[User]:
        if user_id:
            return User.query.get(user_id)
        if username:
            return User.query.filter_by(username=username).first()
        if email:
            return User.query.filter_by(email=email).first()
        return None

    def verify_user(self, username: str, password: str) -> Optional[User]:
        user = self.get_user(username=username)
        if user and user.check_password(password) and user.is_active:
            user.last_login = datetime.utcnow()
            db.session.commit()
            return user
        return None

    def save_audio_data(self, user_id: int, filename: str, file_path: str,
                        original_filename: Optional[str] = None,
                        file_size: Optional[int] = None,
                        duration: Optional[float] = None,
                        sample_rate: Optional[int] = None,
                        opera_type: Optional[str] = None,
                        singer_name: Optional[str] = None,
                        year: Optional[int] = None,
                        description: Optional[str] = None) -> AudioData:
        audio = AudioData(
            user_id=user_id,
            filename=filename,
            original_filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            duration=duration,
            sample_rate=sample_rate,
            opera_type=opera_type,
            singer_name=singer_name,
            year=year,
            description=description
        )
        db.session.add(audio)
        db.session.commit()
        return audio

    def save_features(self, audio_id: int, features: Dict) -> FeatureData:
        feature_data = FeatureData(audio_id=audio_id)

        for key, value in features.items():
            if hasattr(feature_data, key):
                setattr(feature_data, key, value)

        db.session.add(feature_data)

        audio = AudioData.query.get(audio_id)
        if audio:
            audio.is_processed = True

        db.session.commit()
        return feature_data

    def get_audio_data(self, user_id: Optional[int] = None,
                       opera_type: Optional[str] = None,
                       singer_name: Optional[str] = None,
                       year: Optional[int] = None,
                       is_processed: Optional[bool] = None) -> List[AudioData]:
        query = AudioData.query

        if user_id:
            query = query.filter_by(user_id=user_id)
        if opera_type:
            query = query.filter_by(opera_type=opera_type)
        if singer_name:
            query = query.filter_by(singer_name=singer_name)
        if year:
            query = query.filter_by(year=year)
        if is_processed is not None:
            query = query.filter_by(is_processed=is_processed)

        return query.all()

    def get_features_dataframe(self, **filters) -> pd.DataFrame:
        audios = self.get_audio_data(**filters)

        data = []
        for audio in audios:
            if audio.features:
                row = {
                    'audio_id': audio.id,
                    'opera_type': audio.opera_type,
                    'singer': audio.singer_name,
                    'year': audio.year,
                    'duration': audio.duration
                }
                row.update(audio.features.to_dict())
                data.append(row)

        return pd.DataFrame(data)

    def save_analysis_result(self, user_id: int, analysis_type: str,
                             opera_type_prediction: Optional[str] = None,
                             confidence: Optional[float] = None,
                             singer_similarity: Optional[str] = None,
                             trend_analysis: Optional[str] = None,
                             raw_results: Optional[str] = None,
                             notes: Optional[str] = None) -> AnalysisResult:
        result = AnalysisResult(
            user_id=user_id,
            analysis_type=analysis_type,
            opera_type_prediction=opera_type_prediction,
            confidence=confidence,
            singer_similarity=singer_similarity,
            trend_analysis=trend_analysis,
            raw_results=raw_results,
            notes=notes
        )
        db.session.add(result)
        db.session.commit()
        return result

    def get_analysis_results(self, user_id: Optional[int] = None,
                             analysis_type: Optional[str] = None,
                             limit: Optional[int] = None) -> List[AnalysisResult]:
        query = AnalysisResult.query.order_by(AnalysisResult.created_at.desc())

        if user_id:
            query = query.filter_by(user_id=user_id)
        if analysis_type:
            query = query.filter_by(analysis_type=analysis_type)
        if limit:
            query = query.limit(limit)

        return query.all()

    def get_opera_types(self) -> List[str]:
        result = db.session.query(AudioData.opera_type).distinct().filter(
            AudioData.opera_type.isnot(None)
        ).all()
        return [r[0] for r in result]

    def get_singers(self) -> List[str]:
        result = db.session.query(AudioData.singer_name).distinct().filter(
            AudioData.singer_name.isnot(None)
        ).all()
        return [r[0] for r in result]

    def get_years(self) -> List[int]:
        result = db.session.query(AudioData.year).distinct().filter(
            AudioData.year.isnot(None)
        ).all()
        return sorted([r[0] for r in result if r[0]])

    def delete_audio(self, audio_id: int) -> bool:
        audio = AudioData.query.get(audio_id)
        if audio:
            db.session.delete(audio)
            db.session.commit()
            return True
        return False

    def delete_user(self, user_id: int) -> bool:
        user = User.query.get(user_id)
        if user:
            db.session.delete(user)
            db.session.commit()
            return True
        return False

    def update_user(self, user_id: int, **kwargs) -> Optional[User]:
        user = User.query.get(user_id)
        if user:
            for key, value in kwargs.items():
                if key == 'password':
                    user.set_password(value)
                elif hasattr(user, key):
                    setattr(user, key, value)
            db.session.commit()
        return user

    def get_statistics(self) -> Dict:
        return {
            'total_users': User.query.count(),
            'total_audio_files': AudioData.query.count(),
            'processed_files': AudioData.query.filter_by(is_processed=True).count(),
            'total_analyses': AnalysisResult.query.count(),
            'opera_types': self.get_opera_types(),
            'singers': self.get_singers()
        }

    def export_data(self, output_path: str):
        df = self.get_features_dataframe()
        df.to_csv(output_path, index=False, encoding='utf-8')
        return output_path
