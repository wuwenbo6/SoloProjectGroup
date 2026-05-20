import os
import json
import numpy as np
import argparse
from config import Config

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

def generate_synthetic_data(num_samples=1000, grid_size=20.0, step=1.0):
    X = []
    y = []
    
    positions = []
    for x in np.arange(0, grid_size, step):
        for y_pos in np.arange(0, grid_size, step):
            positions.append((x, y_pos))
    
    for pos in positions:
        for _ in range(num_samples // len(positions)):
            amplitude = 50 + 20 * np.random.randn(64)
            amplitude = amplitude - 0.5 * (pos[0] + pos[1])
            
            phase = np.random.uniform(-np.pi, np.pi, 64)
            phase = phase + 0.1 * pos[0] - 0.1 * pos[1]
            
            amp_mean = np.mean(amplitude)
            amp_std = np.std(amplitude)
            amp_max = np.max(amplitude)
            amp_min = np.min(amplitude)
            phase_mean = np.mean(phase)
            phase_std = np.std(phase)
            
            amp_spread = amp_std / (np.mean(np.abs(amplitude)) + 1e-6)
            phase_continuity = np.mean(np.abs(np.diff(np.unwrap(phase))))
            quality_score = 0.5 * (1.0 - min(1.0, amp_spread)) + 0.5 * (1.0 - min(1.0, phase_continuity))
            quality_score = max(0.0, min(1.0, quality_score))
            
            features = np.concatenate([
                amplitude,
                phase,
                [amp_mean, amp_std, amp_max, amp_min, phase_mean, phase_std, quality_score]
            ])
            
            X.append(features)
            y.append(pos)
    
    return np.array(X), np.array(y)

def build_model(input_shape=135):
    from tensorflow import keras
    from tensorflow.keras import layers
    
    model = keras.Sequential([
        layers.Dense(256, activation='relu', input_shape=(input_shape,)),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(128, activation='relu'),
        layers.BatchNormalization(),
        layers.Dropout(0.3),
        layers.Dense(64, activation='relu'),
        layers.Dense(32, activation='relu'),
        layers.Dense(2)
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae']
    )
    
    return model

def train_model(X, y, epochs=100, batch_size=32, validation_split=0.2):
    from sklearn.model_selection import train_test_split
    
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=validation_split, random_state=42
    )
    
    model = build_model(X.shape[1])
    
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=batch_size,
        verbose=1
    )
    
    return model, history

def save_fingerprint_database(X, y, db_path):
    db = {}
    for i, (features, pos) in enumerate(zip(X, y)):
        db[f'fp_{i}'] = {
            'features': features,
            'position': pos
        }
    np.save(db_path, db)
    print(f"Fingerprint database saved to {db_path}")

def main():
    parser = argparse.ArgumentParser(description='Train CSI fingerprint model')
    parser.add_argument('--samples', type=int, default=1000, help='Number of synthetic samples')
    parser.add_argument('--epochs', type=int, default=100, help='Training epochs')
    parser.add_argument('--grid-size', type=float, default=20.0, help='Grid size in meters')
    parser.add_argument('--model-path', type=str, default=None, help='Path to save model')
    parser.add_argument('--db-path', type=str, default=None, help='Path to save fingerprint database')
    
    args = parser.parse_args()
    
    model_path = args.model_path or Config.FINGERPRINT_CONFIG['model_path']
    db_path = args.db_path or Config.FINGERPRINT_CONFIG['fingerprint_db_path']
    
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    print("Generating synthetic CSI fingerprint data...")
    X, y = generate_synthetic_data(
        num_samples=args.samples,
        grid_size=args.grid_size
    )
    print(f"Generated {len(X)} samples with feature shape {X.shape[1]}")
    
    print("Training neural network model...")
    model, history = train_model(X, y, epochs=args.epochs)
    
    final_loss = history.history['loss'][-1]
    final_mae = history.history['mae'][-1]
    val_loss = history.history['val_loss'][-1]
    val_mae = history.history['val_mae'][-1]
    
    print(f"\nTraining complete:")
    print(f"  Train Loss: {final_loss:.4f}, MAE: {final_mae:.4f}m")
    print(f"  Val Loss: {val_loss:.4f}, MAE: {val_mae:.4f}m")
    
    model.save(model_path)
    print(f"Model saved to {model_path}")
    
    save_fingerprint_database(X, y, db_path)
    
    print("\nFingerprint training complete!")

if __name__ == '__main__':
    main()
