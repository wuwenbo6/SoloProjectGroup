import numpy as np
from scipy.ndimage import maximum_filter, label, center_of_mass
import cv2
from skimage.feature import peak_local_max


def detect_stars(image, min_snr=5, min_area=3, max_area=100):
    if image.ndim == 3:
        gray = np.mean(image, axis=-1)
    else:
        gray = image
    
    mean = np.mean(gray)
    std = np.std(gray)
    threshold = mean + min_snr * std
    
    binary = gray > threshold
    
    labeled, num_features = label(binary)
    
    stars = []
    for i in range(1, num_features + 1):
        mask = labeled == i
        area = np.sum(mask)
        
        if min_area <= area <= max_area:
            cy, cx = center_of_mass(gray, labels=labeled, index=i)
            brightness = np.mean(gray[mask])
            
            stars.append({
                'x': float(cx),
                'y': float(cy),
                'brightness': float(brightness),
                'area': int(area)
            })
    
    stars.sort(key=lambda s: s['brightness'], reverse=True)
    return stars


def match_stars(stars1, stars2, max_distance=50, min_matches=10):
    if len(stars1) < min_matches or len(stars2) < min_matches:
        return [], []
    
    pts1 = np.array([[s['x'], s['y']] for s in stars1])
    pts2 = np.array([[s['x'], s['y']] for s in stars2])
    
    matched1 = []
    matched2 = []
    
    for i, p1 in enumerate(pts1):
        distances = np.sqrt(np.sum((pts2 - p1) ** 2, axis=1))
        min_idx = np.argmin(distances)
        min_dist = distances[min_idx]
        
        if min_dist < max_distance:
            matched1.append(stars1[i])
            matched2.append(stars2[min_idx])
    
    return matched1, matched2


def estimate_transform(stars1, stars2):
    pts1 = np.array([[s['x'], s['y']] for s in stars1], dtype=np.float32)
    pts2 = np.array([[s['x'], s['y']] for s in stars2], dtype=np.float32)
    
    if len(pts1) < 3:
        return None
    
    M, mask = cv2.estimateAffinePartial2D(pts2, pts1)
    
    return M


def align_image(image, transform_matrix, target_shape):
    if transform_matrix is None:
        return image
    
    aligned = cv2.warpAffine(
        image,
        transform_matrix,
        (target_shape[1], target_shape[0]),
        flags=cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0
    )
    
    return aligned
