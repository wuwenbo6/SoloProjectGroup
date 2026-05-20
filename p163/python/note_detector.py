import cv2
import numpy as np
import os

class NoteDetector:
    def __init__(self):
        self.digit_templates = self._load_digit_templates()
        
    def _load_digit_templates(self):
        templates = {}
        template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        if os.path.exists(template_dir):
            for i in range(1, 8):
                template_path = os.path.join(template_dir, f'{i}.png')
                if os.path.exists(template_path):
                    templates[i] = cv2.imread(template_path, 0)
        return templates
    
    def preprocess_image(self, image_path):
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"无法读取图片: {image_path}")
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 11, 2
        )
        
        kernel = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        return img, gray, cleaned
    
    def detect_staff_lines(self, binary_img):
        horizontal = np.copy(binary_img)
        cols = horizontal.shape[1]
        horizontal_size = cols // 30
        horizontalStructure = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontal_size, 1))
        horizontal = cv2.erode(horizontal, horizontalStructure)
        horizontal = cv2.dilate(horizontal, horizontalStructure)
        
        contours, _ = cv2.findContours(horizontal, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        lines = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            if w > cols // 4 and h < 10:
                lines.append((y, y + h, x, x + w))
        
        lines.sort(key=lambda x: x[0])
        return lines
    
    def detect_digits(self, binary_img, original_img):
        contours, _ = cv2.findContours(binary_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        digit_candidates = []
        for cnt in contours:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = w / h if h > 0 else 0
            
            if 10 < w < 100 and 15 < h < 120 and 0.3 < aspect_ratio < 1.5:
                digit_roi = binary_img[y:y+h, x:x+w]
                
                digit_candidates.append({
                    'x': x,
                    'y': y,
                    'w': w,
                    'h': h,
                    'center_x': x + w // 2,
                    'center_y': y + h // 2,
                    'roi': digit_roi
                })
        
        return digit_candidates
    
    def recognize_digit(self, roi):
        if roi.size == 0:
            return None
            
        roi_resized = cv2.resize(roi, (30, 40))
        
        if self.digit_templates:
            best_match = None
            best_score = 0
            
            for digit, template in self.digit_templates.items():
                template_resized = cv2.resize(template, (30, 40))
                result = cv2.matchTemplate(roi_resized, template_resized, cv2.TM_CCOEFF_NORMED)
                score = np.max(result)
                
                if score > best_score and score > 0.6:
                    best_score = score
                    best_match = digit
            
            return best_match
        
        return None
    
    def detect_underscores(self, binary_img, digit_candidates):
        underscores = []
        
        for i, digit in enumerate(digit_candidates):
            x, y, w, h = digit['x'], digit['y'], digit['w'], digit['h']
            
            search_y = y + h + 3
            search_height = 25
            
            if search_y + search_height < binary_img.shape[0]:
                roi = binary_img[search_y:search_y + search_height, x:x + w]
                
                horizontal_pixels = np.sum(roi > 0)
                total_pixels = roi.size
                
                if horizontal_pixels / total_pixels > 0.1:
                    lines = cv2.HoughLinesP(roi, 1, np.pi / 180, threshold=10, 
                                           minLineLength=w // 2, maxLineGap=5)
                    if lines is not None:
                        underscores.append({
                            'digit_idx': i,
                            'x': x,
                            'y': search_y,
                            'w': w,
                            'level': 1
                        })
        
        return underscores
    
    def detect_high_dots(self, binary_img, digit_candidates):
        """检测音符上方的高音点（高八度标记）"""
        high_dots = []
        
        for i, digit in enumerate(digit_candidates):
            x, y, w, h = digit['x'], digit['y'], digit['w'], digit['h']
            
            search_y = max(0, y - 20)
            search_h = min(20, y)
            search_x = x + w // 4
            search_w = w // 2
            
            if search_h > 5 and search_w > 5:
                roi = binary_img[search_y:search_y + search_h, search_x:search_x + search_w]
                
                contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                for cnt in contours:
                    cx, cy, cw, ch = cv2.boundingRect(cnt)
                    aspect_ratio = cw / ch if ch > 0 else 1
                    
                    if 2 < cw < 12 and 2 < ch < 12 and 0.5 < aspect_ratio < 2:
                        high_dots.append({
                            'digit_idx': i,
                            'x': search_x + cx,
                            'y': search_y + cy
                        })
                        break
        
        return high_dots
    
    def detect_duration_dots(self, binary_img, digit_candidates):
        """检测音符右侧的附点（延长时值标记）"""
        duration_dots = []
        
        for i, digit in enumerate(digit_candidates):
            x, y, w, h = digit['x'], digit['y'], digit['w'], digit['h']
            
            search_x = x + w + 2
            search_y = y + h // 3
            search_w = max(25, w // 2)
            search_h = h // 2
            
            if search_x + search_w < binary_img.shape[1] and search_h > 5:
                roi = binary_img[search_y:search_y + search_h, search_x:search_x + search_w]
                
                contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                for cnt in contours:
                    cx, cy, cw, ch = cv2.boundingRect(cnt)
                    aspect_ratio = cw / ch if ch > 0 else 1
                    center_y = search_y + cy + ch // 2
                    digit_center_y = y + h // 2
                    y_offset = abs(center_y - digit_center_y)
                    
                    if y_offset < h // 3 and 3 < cw < 15 and 3 < ch < 15 and 0.5 < aspect_ratio < 2:
                        duration_dots.append({
                            'digit_idx': i,
                            'x': search_x + cx,
                            'y': search_y + cy
                        })
                        break
        
        return duration_dots
    
    def group_notes_by_line(self, digit_candidates, staff_lines, img_height):
        if not staff_lines:
            line_height = img_height // 10
            lines = [(i * line_height, (i + 1) * line_height) for i in range(10)]
        else:
            lines = staff_lines
        
        grouped = [[] for _ in range(len(lines))]
        
        for digit in digit_candidates:
            cy = digit['center_y']
            
            for i, (line_top, line_bottom, _, _) in enumerate(lines):
                if i < len(lines) - 1:
                    next_top = lines[i + 1][0]
                    if line_top <= cy < next_top:
                        grouped[i].append(digit)
                        break
                else:
                    if line_top <= cy:
                        grouped[i].append(digit)
                        break
        
        for i in range(len(grouped)):
            grouped[i].sort(key=lambda d: d['center_x'])
        
        return grouped
    
    def process_image(self, image_path):
        original_img, gray, binary_img = self.preprocess_image(image_path)
        
        staff_lines = self.detect_staff_lines(binary_img)
        
        digit_candidates = self.detect_digits(binary_img, original_img)
        
        for digit in digit_candidates:
            digit['value'] = self.recognize_digit(digit['roi']) or 1
        
        underscores = self.detect_underscores(binary_img, digit_candidates)
        high_dots = self.detect_high_dots(binary_img, digit_candidates)
        duration_dots = self.detect_duration_dots(binary_img, digit_candidates)
        
        grouped_notes = self.group_notes_by_line(digit_candidates, staff_lines, original_img.shape[0])
        
        result = {
            'image_path': image_path,
            'image_size': {
                'width': original_img.shape[1],
                'height': original_img.shape[0]
            },
            'staff_lines': len(staff_lines),
            'notes': []
        }
        
        note_global_idx = 0
        for line_notes in grouped_notes:
            for note in line_notes:
                note_data = {
                    'value': note['value'],
                    'x': note['x'],
                    'y': note['y'],
                    'w': note['w'],
                    'h': note['h'],
                    'duration': 1.0,
                    'octave': 0,
                    'has_high_dot': False,
                    'has_duration_dot': False,
                    'has_underscore': False
                }
                
                for us in underscores:
                    if us['digit_idx'] == note_global_idx:
                        note_data['has_underscore'] = True
                        note_data['octave'] -= 1
                        note_data['duration'] *= 0.5
                
                for hd in high_dots:
                    if hd['digit_idx'] == note_global_idx:
                        note_data['has_high_dot'] = True
                        note_data['octave'] += 1
                
                for dd in duration_dots:
                    if dd['digit_idx'] == note_global_idx:
                        note_data['has_duration_dot'] = True
                        note_data['duration'] *= 1.5
                
                note_global_idx += 1
                result['notes'].append(note_data)
        
        return result
    
    def detect_rhythm_by_spacing(self, notes):
        """基于音符水平间距分析节奏"""
        if len(notes) < 2:
            return notes
        
        notes_sorted = sorted(notes, key=lambda n: (n['y'], n['x']))
        
        current_line = None
        line_notes = []
        
        for note in notes_sorted:
            if current_line is None or abs(note['y'] - current_line) > 30:
                if line_notes:
                    self._analyze_line_rhythm(line_notes)
                current_line = note['y']
                line_notes = [note]
            else:
                line_notes.append(note)
        
        if line_notes:
            self._analyze_line_rhythm(line_notes)
        
        return notes_sorted
    
    def _analyze_line_rhythm(self, line_notes):
        """分析单行音符的间距"""
        if len(line_notes) < 2:
            return
        
        spacings = []
        for i in range(len(line_notes) - 1):
            spacing = line_notes[i + 1]['x'] - line_notes[i]['x']
            spacings.append(spacing)
        
        if not spacings:
            return
        
        avg_spacing = sum(spacings) / len(spacings)
        min_spacing = min(spacings)
        
        for i, note in enumerate(line_notes):
            if i < len(spacings):
                spacing_ratio = spacings[i] / avg_spacing if avg_spacing > 0 else 1
                
                if spacing_ratio < 0.6:
                    note['duration'] = min(note['duration'], 0.5)
                elif spacing_ratio > 1.5:
                    note['duration'] = max(note['duration'], 1.5)
    
    def process_multiple_images(self, image_paths):
        all_notes = []
        
        for path in image_paths:
            result = self.process_image(path)
            all_notes.extend(result['notes'])
        
        all_notes = self.detect_rhythm_by_spacing(all_notes)
        
        return {
            'notes': all_notes,
            'image_count': len(image_paths)
        }
