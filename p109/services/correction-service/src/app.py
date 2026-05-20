from flask import Flask, request, jsonify
import cv2
import numpy as np
from io import BytesIO
from minio import Minio
import os
import uuid
from scipy.ndimage import interpolation as inter

app = Flask(__name__)

minio_client = Minio(
    f"{os.getenv('MINIO_ENDPOINT', 'localhost')}:{os.getenv('MINIO_PORT', '9000')}",
    access_key=os.getenv('MINIO_ACCESS_KEY', 'minioadmin'),
    secret_key=os.getenv('MINIO_SECRET_KEY', 'minioadmin'),
    secure=False
)

BUCKET_NAME = "ancient-books"

def ensure_bucket():
    if not minio_client.bucket_exists(BUCKET_NAME):
        minio_client.make_bucket(BUCKET_NAME)
        policy = '''{
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": ["arn:aws:s3:::ancient-books/*"]
                }
            ]
        }'''
        minio_client.set_bucket_policy(BUCKET_NAME, policy)

ensure_bucket()

def calculate_rotation_score(image, angle):
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    gray = cv2.cvtColor(rotated, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    
    horizontal_hist = np.sum(thresh, axis=1, dtype=float)
    horizontal_score = np.sum((horizontal_hist[1:] - horizontal_hist[:-1]) ** 2, dtype=float)
    
    vertical_hist = np.sum(thresh, axis=0, dtype=float)
    vertical_score = np.sum((vertical_hist[1:] - vertical_hist[:-1]) ** 2, dtype=float)
    
    return horizontal_score, vertical_score, rotated

def detect_text_orientation(image):
    angles = [0, 90, 180, 270]
    scores = []
    
    for angle in angles:
        h_score, v_score, _ = calculate_rotation_score(image, angle)
        if angle in [90, 270]:
            scores.append(v_score)
        else:
            scores.append(h_score)
    
    best_idx = np.argmax(scores)
    return angles[best_idx]

def correct_skew(image, delta=0.5, limit=10):
    def determine_score(arr, angle):
        data = inter.rotate(arr, angle, reshape=False, order=0)
        histogram = np.sum(data, axis=1, dtype=float)
        score = np.sum((histogram[1:] - histogram[:-1]) ** 2, dtype=float)
        return histogram, score

    orientation = detect_text_orientation(image)
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    
    if orientation != 0:
        M = cv2.getRotationMatrix2D(center, orientation, 1.0)
        image = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

    scores = []
    angles = np.arange(-limit, limit + delta, delta)
    for angle in angles:
        _, score = determine_score(thresh, angle)
        scores.append(score)

    best_skew_angle = angles[scores.index(max(scores))]

    if abs(best_skew_angle) > 0.1:
        M = cv2.getRotationMatrix2D(center, best_skew_angle, 1.0)
        corrected = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    else:
        corrected = image

    total_angle = orientation + best_skew_angle
    return corrected, total_angle

def detect_edges(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)
    return edged

def find_contours(edged):
    contours, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    
    for c in contours:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        
        if len(approx) == 4:
            return approx
    return None

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")
    
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    
    return warped

def enhance_image(image):
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    
    enhanced_lab = cv2.merge((l, a, b))
    enhanced_image = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    
    return enhanced_image

@app.route('/correct', methods=['POST'])
def correct_image():
    try:
        data = request.json
        object_name = data.get('object_name')
        
        if not object_name:
            return jsonify({'error': 'object_name is required'}), 400
        
        response = minio_client.get_object(BUCKET_NAME, object_name)
        image_data = BytesIO(response.read())
        
        file_bytes = np.asarray(bytearray(image_data.read()), dtype=np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        edged = detect_edges(image)
        contours = find_contours(edged)
        
        if contours is not None:
            warped = four_point_transform(image, contours.reshape(4, 2))
        else:
            warped = image
        
        corrected, skew_angle = correct_skew(warped)
        enhanced = enhance_image(corrected)
        
        _, buffer = cv2.imencode('.jpg', enhanced, [cv2.IMWRITE_JPEG_QUALITY, 95])
        img_bytes = BytesIO(buffer)
        
        corrected_object_name = f"corrected/{uuid.uuid4()}.jpg"
        
        minio_client.put_object(
            BUCKET_NAME,
            corrected_object_name,
            img_bytes,
            len(buffer),
            content_type='image/jpeg'
        )
        
        return jsonify({
            'original_object': object_name,
            'corrected_object': corrected_object_name,
            'skew_angle': skew_angle,
            'perspective_corrected': contours is not None,
            'status': 'success'
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'correction-service'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3002, debug=True)
