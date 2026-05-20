from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt
import json

db = SQLAlchemy()


class OperaGenre(db.Model):
    __tablename__ = 'opera_genres'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name_cn = db.Column(db.String(50), nullable=False)
    region = db.Column(db.String(100))
    description = db.Column(db.Text)
    typical_features = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    heritors = db.relationship('Heritor', backref='opera_genre', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'name_cn': self.name_cn,
            'region': self.region,
            'description': self.description
        }


class Heritor(db.Model):
    __tablename__ = 'heritors'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    gender = db.Column(db.String(10))
    birth_year = db.Column(db.Integer)
    birth_place = db.Column(db.String(100))
    opera_genre_id = db.Column(db.Integer, db.ForeignKey('opera_genres.id'))
    school = db.Column(db.String(100))
    generation = db.Column(db.Integer)
    title = db.Column(db.String(100))
    master = db.Column(db.String(100))
    biography = db.Column(db.Text)
    representative_works = db.Column(db.Text)
    style_features = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    audio_data = db.relationship('AudioData', backref='heritor', lazy=True)
    evolution_records = db.relationship('EvolutionRecord', backref='heritor_ref', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'gender': self.gender,
            'birth_year': self.birth_year,
            'birth_place': self.birth_place,
            'opera_genre': self.opera_genre.name_cn if self.opera_genre else None,
            'school': self.school,
            'generation': self.generation,
            'title': self.title,
            'master': self.master,
            'biography': self.biography,
            'representative_works': self.representative_works,
            'style_features': self.style_features
        }


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(100))
    role = db.Column(db.String(20), default='user')
    expertise_level = db.Column(db.String(20), default='beginner')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)

    audio_data = db.relationship('AudioData', backref='uploader', lazy=True)
    analysis_results = db.relationship('AnalysisResult', backref='analyst', lazy=True)
    ratings = db.relationship('SingingQualityRating', backref='rater', lazy=True)
    annotations = db.relationship('UserAnnotation', backref='annotator', lazy=True)

    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'expertise_level': self.expertise_level,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AudioData(db.Model):
    __tablename__ = 'audio_data'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255))
    file_path = db.Column(db.String(512), nullable=False)
    file_size = db.Column(db.Integer)
    duration = db.Column(db.Float)
    sample_rate = db.Column(db.Integer)
    opera_type = db.Column(db.String(50), index=True)
    singer_name = db.Column(db.String(100), index=True)
    heritor_id = db.Column(db.Integer, db.ForeignKey('heritors.id'))
    aria_name = db.Column(db.String(200))
    role_type = db.Column(db.String(50))
    performance_venue = db.Column(db.String(200))
    year = db.Column(db.Integer, index=True)
    decade = db.Column(db.Integer, index=True)
    description = db.Column(db.Text)
    upload_time = db.Column(db.DateTime, default=datetime.utcnow)
    is_processed = db.Column(db.Boolean, default=False)
    auto_assigned = db.Column(db.Boolean, default=False)
    assignment_confidence = db.Column(db.Float)

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    features = db.relationship('FeatureData', backref='audio', uselist=False, lazy=True)
    ratings = db.relationship('SingingQualityRating', backref='audio', lazy=True)
    annotations = db.relationship('UserAnnotation', backref='audio', lazy=True)
    evolution_records = db.relationship('EvolutionRecord', backref='audio_record', lazy=True)

    def to_dict(self):
        avg_rating = None
        if self.ratings and len(self.ratings) > 0:
            ratings_sum = sum(r.overall_score for r in self.ratings if r.overall_score)
            avg_rating = ratings_sum / len(self.ratings) if ratings_sum else None

        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'duration': self.duration,
            'opera_type': self.opera_type,
            'singer_name': self.singer_name,
            'heritor_name': self.heritor.name if self.heritor else None,
            'aria_name': self.aria_name,
            'year': self.year,
            'decade': self.decade,
            'avg_rating': round(avg_rating, 2) if avg_rating else None,
            'num_ratings': len(self.ratings),
            'num_annotations': len(self.annotations)
        }


class FeatureData(db.Model):
    __tablename__ = 'feature_data'

    id = db.Column(db.Integer, primary_key=True)
    audio_id = db.Column(db.Integer, db.ForeignKey('audio_data.id'), nullable=False, unique=True)

    pitch_mean = db.Column(db.Float)
    pitch_std = db.Column(db.Float)
    pitch_min = db.Column(db.Float)
    pitch_max = db.Column(db.Float)
    pitch_median = db.Column(db.Float)
    pitch_range = db.Column(db.Float)
    f0_mean = db.Column(db.Float)
    f0_std = db.Column(db.Float)

    tempo = db.Column(db.Float)
    num_beats = db.Column(db.Integer)
    ibi_mean = db.Column(db.Float)
    ibi_std = db.Column(db.Float)
    beat_density = db.Column(db.Float)
    zcr_mean = db.Column(db.Float)
    rms_mean = db.Column(db.Float)
    rms_std = db.Column(db.Float)
    rms_max = db.Column(db.Float)

    spectral_centroid_mean = db.Column(db.Float)
    spectral_bandwidth_mean = db.Column(db.Float)
    spectral_rolloff_mean = db.Column(db.Float)
    spectral_flatness_mean = db.Column(db.Float)
    spectral_contrast_mean = db.Column(db.Float)

    mfcc_1_mean = db.Column(db.Float)
    mfcc_2_mean = db.Column(db.Float)
    mfcc_3_mean = db.Column(db.Float)
    mfcc_4_mean = db.Column(db.Float)
    mfcc_5_mean = db.Column(db.Float)
    mfcc_6_mean = db.Column(db.Float)
    mfcc_7_mean = db.Column(db.Float)
    mfcc_8_mean = db.Column(db.Float)
    mfcc_9_mean = db.Column(db.Float)
    mfcc_10_mean = db.Column(db.Float)
    mfcc_11_mean = db.Column(db.Float)
    mfcc_12_mean = db.Column(db.Float)
    mfcc_13_mean = db.Column(db.Float)

    chroma_1_mean = db.Column(db.Float)
    chroma_2_mean = db.Column(db.Float)
    chroma_3_mean = db.Column(db.Float)
    chroma_4_mean = db.Column(db.Float)
    chroma_5_mean = db.Column(db.Float)
    chroma_6_mean = db.Column(db.Float)
    chroma_7_mean = db.Column(db.Float)
    chroma_8_mean = db.Column(db.Float)
    chroma_9_mean = db.Column(db.Float)
    chroma_10_mean = db.Column(db.Float)
    chroma_11_mean = db.Column(db.Float)
    chroma_12_mean = db.Column(db.Float)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {c.name: getattr(self, c.name) for c in self.__table__.columns if c.name not in ['id', 'audio_id', 'created_at']}

    def to_feature_array(self):
        exclude_cols = ['id', 'audio_id', 'created_at']
        return [getattr(self, c.name) for c in self.__table__.columns if c.name not in exclude_cols]


class SingingQualityRating(db.Model):
    __tablename__ = 'singing_quality_ratings'

    id = db.Column(db.Integer, primary_key=True)
    audio_id = db.Column(db.Integer, db.ForeignKey('audio_data.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    pitch_accuracy = db.Column(db.Float)
    rhythm_accuracy = db.Column(db.Float)
    vocal_quality = db.Column(db.Float)
    emotional_expression = db.Column(db.Float)
    technique = db.Column(db.Float)
    style_authenticity = db.Column(db.Float)
    overall_score = db.Column(db.Float, index=True)

    comment = db.Column(db.Text)
    is_approved = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'audio_id': self.audio_id,
            'user_id': self.user_id,
            'username': self.rater.username if self.rater else None,
            'pitch_accuracy': self.pitch_accuracy,
            'rhythm_accuracy': self.rhythm_accuracy,
            'vocal_quality': self.vocal_quality,
            'emotional_expression': self.emotional_expression,
            'technique': self.technique,
            'style_authenticity': self.style_authenticity,
            'overall_score': self.overall_score,
            'comment': self.comment,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def calculate_overall(self):
        scores = [
            self.pitch_accuracy,
            self.rhythm_accuracy,
            self.vocal_quality,
            self.emotional_expression,
            self.technique,
            self.style_authenticity
        ]
        valid_scores = [s for s in scores if s is not None]
        if valid_scores:
            self.overall_score = sum(valid_scores) / len(valid_scores)
        return self.overall_score


class UserAnnotation(db.Model):
    __tablename__ = 'user_annotations'

    id = db.Column(db.Integer, primary_key=True)
    audio_id = db.Column(db.Integer, db.ForeignKey('audio_data.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    annotation_type = db.Column(db.String(50), nullable=False)
    start_time = db.Column(db.Float)
    end_time = db.Column(db.Float)
    content = db.Column(db.Text, nullable=False)

    tags = db.Column(db.Text)
    confidence = db.Column(db.Float)
    is_verified = db.Column(db.Boolean, default=False)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'audio_id': self.audio_id,
            'user_id': self.user_id,
            'username': self.annotator.username if self.annotator else None,
            'annotation_type': self.annotation_type,
            'start_time': self.start_time,
            'end_time': self.end_time,
            'content': self.content,
            'tags': json.loads(self.tags) if self.tags else [],
            'confidence': self.confidence,
            'is_verified': self.is_verified,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class EvolutionRecord(db.Model):
    __tablename__ = 'evolution_records'

    id = db.Column(db.Integer, primary_key=True)
    heritor_id = db.Column(db.Integer, db.ForeignKey('heritors.id'))
    audio_id = db.Column(db.Integer, db.ForeignKey('audio_data.id'))
    opera_genre_id = db.Column(db.Integer, db.ForeignKey('opera_genres.id'))

    period_start = db.Column(db.Integer, index=True)
    period_end = db.Column(db.Integer, index=True)
    period_label = db.Column(db.String(100))

    feature_summary = db.Column(db.Text)
    trend_direction = db.Column(db.String(50))
    change_magnitude = db.Column(db.Float)
    comparison_baseline = db.Column(db.Text)

    analysis_notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'heritor_name': self.heritor_ref.name if self.heritor_ref else None,
            'opera_genre': self.opera_genre.name_cn if self.opera_genre else None,
            'period': f"{self.period_start}-{self.period_end}" if self.period_start and self.period_end else None,
            'period_label': self.period_label,
            'trend_direction': self.trend_direction,
            'change_magnitude': self.change_magnitude,
            'feature_summary': json.loads(self.feature_summary) if self.feature_summary else {},
            'analysis_notes': self.analysis_notes
        }


class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    analysis_type = db.Column(db.String(50), nullable=False)

    opera_type_prediction = db.Column(db.String(50))
    confidence = db.Column(db.Float)
    singer_similarity = db.Column(db.Text)
    trend_analysis = db.Column(db.Text)
    raw_results = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'analysis_type': self.analysis_type,
            'opera_type_prediction': self.opera_type_prediction,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
