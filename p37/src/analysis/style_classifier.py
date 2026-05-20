import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import pickle
import os


class StyleClassifier:
    def __init__(self, model_type: str = "random_forest"):
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.is_trained = False
        self.feature_names = []

    def _init_model(self):
        if self.model_type == "random_forest":
            return RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
        elif self.model_type == "svm":
            return SVC(kernel='rbf', probability=True, random_state=42)
        else:
            raise ValueError(f"不支持的模型类型: {self.model_type}")

    def train(self, features_df: pd.DataFrame, labels: pd.Series, test_size: float = 0.2) -> Dict:
        numeric_features = features_df.select_dtypes(include=[np.number])
        self.feature_names = numeric_features.columns.tolist()

        X = numeric_features.values
        y = self.label_encoder.fit_transform(labels)

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=y)

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        self.model = self._init_model()
        self.model.fit(X_train_scaled, y_train)

        y_pred = self.model.predict(X_test_scaled)
        y_pred_proba = self.model.predict_proba(X_test_scaled)

        cv_scores = cross_val_score(self.model, self.scaler.transform(X), y, cv=5)

        self.is_trained = True

        return {
            'accuracy': accuracy_score(y_test, y_pred),
            'cv_mean_accuracy': np.mean(cv_scores),
            'cv_std': np.std(cv_scores),
            'classification_report': classification_report(y_test, y_pred, target_names=self.label_encoder.classes_),
            'confusion_matrix': confusion_matrix(y_test, y_pred).tolist(),
            'class_names': self.label_encoder.classes_.tolist()
        }

    def predict(self, features_df: pd.DataFrame) -> Tuple[List[str], List[Dict[str, float]]]:
        if not self.is_trained:
            raise ValueError("模型未训练，请先调用train()方法")

        numeric_features = features_df.select_dtypes(include=[np.number])
        X = numeric_features.values
        X_scaled = self.scaler.transform(X)

        predictions = self.model.predict(X_scaled)
        probabilities = self.model.predict_proba(X_scaled)

        predicted_labels = self.label_encoder.inverse_transform(predictions)
        prob_dicts = []

        for prob in probabilities:
            prob_dict = {self.label_encoder.classes_[i]: float(prob[i]) for i in range(len(prob))}
            prob_dicts.append(prob_dict)

        return predicted_labels, prob_dicts

    def get_feature_importance(self) -> Dict[str, float]:
        if not self.is_trained:
            raise ValueError("模型未训练，请先调用train()方法")

        if hasattr(self.model, 'feature_importances_'):
            importance = dict(zip(self.feature_names, self.model.feature_importances_))
            return dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))
        else:
            raise ValueError("当前模型不支持特征重要性分析")

    def save_model(self, model_path: str):
        if not self.is_trained:
            raise ValueError("模型未训练，无法保存")

        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'label_encoder': self.label_encoder,
            'feature_names': self.feature_names,
            'model_type': self.model_type
        }

        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        with open(model_path, 'wb') as f:
            pickle.dump(model_data, f)

    def load_model(self, model_path: str):
        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)

        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.label_encoder = model_data['label_encoder']
        self.feature_names = model_data['feature_names']
        self.model_type = model_data['model_type']
        self.is_trained = True

    def classify_opera_type(self, features_df: pd.DataFrame) -> pd.DataFrame:
        predicted_labels, probabilities = self.predict(features_df)
        result_df = features_df.copy()
        result_df['predicted_opera_type'] = predicted_labels

        for class_name in self.label_encoder.classes_:
            result_df[f'prob_{class_name}'] = [p[class_name] for p in probabilities]

        return result_df

    def evaluate_on_new_data(self, features_df: pd.DataFrame, true_labels: pd.Series) -> Dict:
        if not self.is_trained:
            raise ValueError("模型未训练，请先调用train()方法")

        numeric_features = features_df.select_dtypes(include=[np.number])
        X = numeric_features.values
        X_scaled = self.scaler.transform(X)
        y = self.label_encoder.transform(true_labels)

        y_pred = self.model.predict(X_scaled)

        return {
            'accuracy': accuracy_score(y, y_pred),
            'classification_report': classification_report(y, y_pred, target_names=self.label_encoder.classes_),
            'confusion_matrix': confusion_matrix(y, y_pred).tolist()
        }
