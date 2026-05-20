from flask import Flask, request, jsonify
import cv2
import numpy as np
from io import BytesIO
from minio import Minio
import os
import pytesseract
from PIL import Image

app = Flask(__name__)

minio_client = Minio(
    f"{os.getenv('MINIO_ENDPOINT', 'localhost')}:{os.getenv('MINIO_PORT', '9000')}",
    access_key=os.getenv('MINIO_ACCESS_KEY', 'minioadmin'),
    secret_key=os.getenv('MINIO_SECRET_KEY', 'minioadmin'),
    secure=False
)

BUCKET_NAME = "ancient-books"

PUNCTUATION_MARKS = ['，', '。', '、', '；', '：', '？', '！', '「', '」', '『', '』', '（', '）', '〔', '〕']

def detect_text_lines(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    connected = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(connected, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    lines = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w > 50 and h > 10:
            lines.append({
                'x': x,
                'y': y,
                'width': w,
                'height': h,
                'bounding_box': {'x': x, 'y': y, 'width': w, 'height': h}
            })
    
    lines.sort(key=lambda l: l['y'])
    
    return lines

def recognize_text(image, line_info, lang='chi_tra'):
    x, y, w, h = line_info['x'], line_info['y'], line_info['width'], line_info['height']
    
    padding = 5
    x = max(0, x - padding)
    y = max(0, y - padding)
    w = min(image.shape[1] - x, w + 2 * padding)
    h = min(image.shape[0] - y, h + 2 * padding)
    
    line_image = image[y:y+h, x:x+w]
    
    if line_image.size == 0:
        return "", 0.0
    
    gray_line = cv2.cvtColor(line_image, cv2.COLOR_BGR2GRAY)
    _, binary_line = cv2.threshold(gray_line, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    custom_config = r'--oem 3 --psm 6'
    data = pytesseract.image_to_data(
        Image.fromarray(binary_line),
        lang=lang,
        config=custom_config,
        output_type=pytesseract.Output.DICT
    )
    
    text = ' '.join([t for t in data['text'] if t.strip()])
    confidences = [float(c) for c, t in zip(data['conf'], data['text']) if t.strip()]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    
    text = text.replace(' ', '')
    
    return text, avg_confidence / 100.0

def add_punctuation(text):
    if not text:
        return text, ""
    
    punctuation_rules = {
        'end_chars': ['之', '乎', '者', '也', '矣', '焉', '哉', '耶', '与', '邪', '耳', '而已'],
        'colon_chars': ['曰', '云', '道', '言', '谓', '说'],
        'pause_chars': ['而', '则', '故', '是', '然', '但', '虽', '且', '及', '与', '以'],
        'question_chars': ['何', '胡', '焉', '奚', '安', '岂', '孰', '乌', '恶', '乎']
    }
    
    result = []
    punctuation_map = {}
    
    for i, char in enumerate(text):
        result.append(char)
        
        if i < len(text) - 1:
            next_char = text[i + 1]
            prev_char = text[i - 1] if i > 0 else ''
            
            if char in punctuation_rules['end_chars'] and next_char not in ['，', '。', '、', '；', '：', '？', '！']:
                if next_char in ['，', '。', '？', '！', '、', '；', '：']:
                    continue
                if i + 1 < len(text) and text[i + 1] in punctuation_rules['colon_chars']:
                    punctuation_map[i] = '，'
                    result.append('，')
                else:
                    punctuation_map[i] = '。'
                    result.append('。')
            
            elif char in punctuation_rules['colon_chars'] and next_char not in ['：', '曰', '云']:
                punctuation_map[i] = '：'
                result.append('：')
            
            elif char in punctuation_rules['pause_chars'] and prev_char not in ['，', '。', '、', '；', '：', '？', '！', '']:
                if next_char not in ['，', '。', '、', '；', '：', '？', '！']:
                    punctuation_map[i] = '，'
                    result.append('，')
            
            elif char in punctuation_rules['question_chars'] and (i == 0 or prev_char in ['，', '。', '！', '？', '；', '：']):
                has_end_marker = False
                for j in range(i, min(i + 10, len(text))):
                    if text[j] in ['？', '。', '！', '乎', '哉', '耶']:
                        has_end_marker = True
                        break
                if not has_end_marker:
                    for j in range(min(i + 10, len(text)) - 1, i, -1):
                        if text[j] in punctuation_rules['end_chars']:
                            punctuation_map[j] = '？'
                            break
        
        if i == len(text) - 1:
            has_punct = False
            for j in range(max(0, len(text) - 5), len(text)):
                if text[j] in ['。', '！', '？', '，', '；', '：']:
                    has_punct = True
                    break
            if not has_punct:
                punctuation_map[i] = '。'
                result.append('。')
    
    punctuated_text = ''.join(result)
    
    punctuation_entries = []
    offset = 0
    for orig_pos in sorted(punctuation_map.keys()):
        punctuation_entries.append(f"{orig_pos}:{punctuation_map[orig_pos]}")
        offset += 1
    
    punctuation_marks = ';'.join(punctuation_entries)
    
    return punctuated_text, punctuation_marks

@app.route('/segment', methods=['POST'])
def segment_and_recognize():
    try:
        data = request.json
        object_name = data.get('object_name')
        lang = data.get('lang', 'chi_tra')
        
        if not object_name:
            return jsonify({'error': 'object_name is required'}), 400
        
        response = minio_client.get_object(BUCKET_NAME, object_name)
        image_data = BytesIO(response.read())
        
        file_bytes = np.asarray(bytearray(image_data.read()), dtype=np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        lines = detect_text_lines(image)
        
        annotated_lines = []
        for i, line_info in enumerate(lines):
            text, confidence = recognize_text(image, line_info, lang)
            punctuated_text, punctuation_positions = add_punctuation(text)
            
            annotated_lines.append({
                'line_number': i + 1,
                'bounding_box': line_info['bounding_box'],
                'original_text': text,
                'punctuated_text': punctuated_text,
                'punctuation': punctuation_positions,
                'confidence_score': confidence
            })
        
        return jsonify({
            'object_name': object_name,
            'lines': annotated_lines,
            'total_lines': len(annotated_lines),
            'status': 'success'
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/punctuate', methods=['POST'])
def punctuate_text():
    try:
        data = request.json
        text = data.get('text', '')
        
        punctuated_text, punctuation_marks = add_punctuation(text)
        
        return jsonify({
            'original_text': text,
            'punctuated_text': punctuated_text,
            'punctuation': punctuation_marks
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'segmentation-service'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3003, debug=True)
