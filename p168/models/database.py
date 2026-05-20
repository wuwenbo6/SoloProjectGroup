from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DetectionHistory(Base):
    __tablename__ = "detection_history"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String, index=True)
    image_name = Column(String)
    defect_type = Column(String, index=True)
    confidence = Column(Float)
    heatmap_path = Column(String)
    probabilities = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_labeled = Column(Boolean, default=False)
    true_label = Column(String, nullable=True)


class ActiveLearningPool(Base):
    __tablename__ = "active_learning_pool"

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String)
    image_name = Column(String)
    uncertainty_score = Column(Float)
    predicted_label = Column(String)
    is_labeled = Column(Boolean, default=False)
    true_label = Column(String, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)
    labeled_at = Column(DateTime, nullable=True)


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String)
    version = Column(String)
    accuracy = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=False)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DatabaseManager:
    def __init__(self):
        init_db()
        self.db = next(get_db())

    def add_detection(self, image_path, image_name, defect_type, confidence, 
                      heatmap_path, probabilities):
        detection = DetectionHistory(
            image_path=image_path,
            image_name=image_name,
            defect_type=defect_type,
            confidence=confidence,
            heatmap_path=heatmap_path,
            probabilities=json.dumps(probabilities)
        )
        self.db.add(detection)
        self.db.commit()
        self.db.refresh(detection)
        return detection

    def get_detection_history(self, skip=0, limit=100):
        return self.db.query(DetectionHistory).order_by(
            DetectionHistory.created_at.desc()
        ).offset(skip).limit(limit).all()

    def get_detection_by_id(self, detection_id):
        return self.db.query(DetectionHistory).filter(
            DetectionHistory.id == detection_id
        ).first()

    def update_label(self, detection_id, true_label):
        detection = self.get_detection_by_id(detection_id)
        if detection:
            detection.is_labeled = True
            detection.true_label = true_label
            self.db.commit()
            self.db.refresh(detection)
        return detection

    def add_to_active_pool(self, image_path, image_name, uncertainty_score, predicted_label):
        sample = ActiveLearningPool(
            image_path=image_path,
            image_name=image_name,
            uncertainty_score=uncertainty_score,
            predicted_label=predicted_label
        )
        self.db.add(sample)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def get_unlabeled_samples(self, limit=10):
        return self.db.query(ActiveLearningPool).filter(
            ActiveLearningPool.is_labeled == False
        ).order_by(
            ActiveLearningPool.uncertainty_score.desc()
        ).limit(limit).all()

    def label_sample(self, sample_id, true_label):
        sample = self.db.query(ActiveLearningPool).filter(
            ActiveLearningPool.id == sample_id
        ).first()
        if sample:
            sample.is_labeled = True
            sample.true_label = true_label
            sample.labeled_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(sample)
        return sample

    def get_labeled_samples(self):
        return self.db.query(ActiveLearningPool).filter(
            ActiveLearningPool.is_labeled == True
        ).all()

    def get_statistics(self):
        total_detections = self.db.query(DetectionHistory).count()
        labeled_detections = self.db.query(DetectionHistory).filter(
            DetectionHistory.is_labeled == True
        ).count()
        
        defect_counts = {}
        for detection in self.db.query(DetectionHistory).all():
            defect_type = detection.defect_type
            defect_counts[defect_type] = defect_counts.get(defect_type, 0) + 1

        return {
            "total_detections": total_detections,
            "labeled_detections": labeled_detections,
            "defect_distribution": defect_counts
        }

    def close(self):
        self.db.close()


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
