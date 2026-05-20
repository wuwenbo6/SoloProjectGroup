#!/usr/bin/env python3
import os
import numpy as np
import pickle
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = os.getenv('MODEL_PATH', 'models/isolation_forest.pkl')
SCALER_PATH = os.getenv('SCALER_PATH', 'models/scaler.pkl')

isolation_forest = None
scaler = None

def init_model():
    global isolation_forest, scaler
    
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        logger.info("Loading pre-trained model...")
        with open(MODEL_PATH, 'rb') as f:
            isolation_forest = pickle.load(f)
        with open(SCALER_PATH, 'rb') as f:
            scaler = pickle.load(f)
        logger.info("Model loaded successfully")
    else:
        logger.info("No pre-trained model found, initializing with default...")
        isolation_forest = IsolationForest(
            n_estimators=100,
            max_samples='auto',
            contamination=0.05,
            random_state=42,
            n_jobs=-1
        )
        scaler = StandardScaler()
        dummy_data = np.random.randn(100, 10)
        scaler.fit(dummy_data)
        isolation_forest.fit(dummy_data)
        os.makedirs('models', exist_ok=True)
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(isolation_forest, f)
        with open(SCALER_PATH, 'wb') as f:
            pickle.dump(scaler, f)
        logger.info("Default model initialized and saved")

def extract_features(trace_data):
    spans = trace_data.get('spans', [])
    span_count = len(spans)
    
    if span_count == 0:
        return np.zeros(10)
    
    durations = [span.get('duration', 0) for span in spans]
    durations_ms = [d / 1000000 for d in durations]
    
    services = set()
    errors = 0
    kinds = set()
    for span in spans:
        if span.get('service_name'):
            services.add(span.get('service_name'))
        if span.get('status_code', 0) != 0:
            errors += 1
        if span.get('kind'):
            kinds.add(span.get('kind'))
    
    features = {
        'span_count': span_count,
        'service_count': len(services),
        'error_count': errors,
        'error_rate': errors / span_count if span_count > 0 else 0,
        'total_duration_ms': sum(durations_ms),
        'avg_duration_ms': np.mean(durations_ms) if durations_ms else 0,
        'max_duration_ms': max(durations_ms) if durations_ms else 0,
        'min_duration_ms': min(durations_ms) if durations_ms else 0,
        'std_duration_ms': np.std(durations_ms) if len(durations_ms) > 1 else 0,
        'kind_diversity': len(kinds)
    }
    
    return np.array([
        features['span_count'],
        features['service_count'],
        features['error_count'],
        features['error_rate'],
        features['total_duration_ms'],
        features['avg_duration_ms'],
        features['max_duration_ms'],
        features['min_duration_ms'],
        features['std_duration_ms'],
        features['kind_diversity']
    ])

def calculate_anomaly_score(features):
    scaled_features = scaler.transform([features])
    decision_score = isolation_forest.decision_function(scaled_features)[0]
    
    normalized_score = (decision_score + 1) / 2
    anomaly_score = max(0, min(1, 1 - normalized_score))
    
    return float(anomaly_score)

def get_anomaly_level(score):
    if score < 0.3:
        return "normal"
    elif score < 0.6:
        return "warning"
    elif score < 0.8:
        return "alert"
    else:
        return "critical"

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': isolation_forest is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/v1/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        
        if not data or 'trace' not in data:
            return jsonify({'error': 'Missing trace data'}), 400
        
        trace = data['trace']
        features = extract_features(trace)
        score = calculate_anomaly_score(features)
        level = get_anomaly_level(score)
        
        feature_importance = {
            'span_count': float(features[0]),
            'service_count': float(features[1]),
            'error_count': float(features[2]),
            'error_rate': float(features[3]),
            'total_duration_ms': float(features[4]),
            'avg_duration_ms': float(features[5]),
            'max_duration_ms': float(features[6]),
            'min_duration_ms': float(features[7]),
            'std_duration_ms': float(features[8]),
            'kind_diversity': float(features[9])
        }
        
        contributing_factors = []
        if feature_importance['error_rate'] > 0.1:
            contributing_factors.append('High error rate')
        if feature_importance['std_duration_ms'] > feature_importance['avg_duration_ms'] * 2:
            contributing_factors.append('High duration variance')
        if feature_importance['max_duration_ms'] > feature_importance['avg_duration_ms'] * 5:
            contributing_factors.append('Outlier slow span detected')
        if feature_importance['service_count'] > 20:
            contributing_factors.append('Complex service dependency')
        
        return jsonify({
            'trace_id': trace.get('trace_id'),
            'anomaly_score': score,
            'anomaly_level': level,
            'is_anomaly': score > 0.5,
            'features': feature_importance,
            'contributing_factors': contributing_factors,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/predict/batch', methods=['POST'])
def predict_batch():
    try:
        data = request.get_json()
        
        if not data or 'traces' not in data:
            return jsonify({'error': 'Missing traces data'}), 400
        
        traces = data['traces']
        results = []
        
        for trace in traces:
            features = extract_features(trace)
            score = calculate_anomaly_score(features)
            level = get_anomaly_level(score)
            
            results.append({
                'trace_id': trace.get('trace_id'),
                'anomaly_score': score,
                'anomaly_level': level,
                'is_anomaly': score > 0.5
            })
        
        anomalies = [r for r in results if r['is_anomaly']]
        
        return jsonify({
            'total': len(results),
            'anomalies_count': len(anomalies),
            'anomaly_rate': len(anomalies) / len(results) if results else 0,
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Batch prediction error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/train', methods=['POST'])
def train():
    try:
        data = request.get_json()
        
        if not data or 'traces' not in data:
            return jsonify({'error': 'Missing training data'}), 400
        
        traces = data['traces']
        logger.info(f"Training model with {len(traces)} traces...")
        
        feature_matrix = []
        for trace in traces:
            features = extract_features(trace)
            feature_matrix.append(features)
        
        feature_matrix = np.array(feature_matrix)
        
        scaler.fit(feature_matrix)
        scaled_features = scaler.transform(feature_matrix)
        
        contamination = min(0.1, max(0.01, data.get('contamination', 0.05)))
        
        isolation_forest = IsolationForest(
            n_estimators=data.get('n_estimators', 100),
            max_samples='auto',
            contamination=contamination,
            random_state=42,
            n_jobs=-1
        )
        isolation_forest.fit(scaled_features)
        
        os.makedirs('models', exist_ok=True)
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(isolation_forest, f)
        with open(SCALER_PATH, 'wb') as f:
            pickle.dump(scaler, f)
        
        predictions = isolation_forest.predict(scaled_features)
        anomaly_count = np.sum(predictions == -1)
        
        logger.info(f"Model trained successfully. Anomalies detected: {anomaly_count}/{len(traces)}")
        
        return jsonify({
            'status': 'success',
            'trained_samples': len(traces),
            'anomalies_detected': int(anomaly_count),
            'contamination': contamination,
            'model_path': MODEL_PATH,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Training error: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/model/info', methods=['GET'])
def model_info():
    if isolation_forest is None:
        return jsonify({'error': 'Model not initialized'}), 500
    
    return jsonify({
        'model_type': 'IsolationForest',
        'n_estimators': isolation_forest.n_estimators,
        'max_samples': isolation_forest.max_samples,
        'contamination': isolation_forest.contamination,
        'scaler': 'StandardScaler',
        'feature_dimensions': 10,
        'model_path': MODEL_PATH
    })

if __name__ == '__main__':
    init_model()
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )
