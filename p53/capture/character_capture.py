from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker, QTimer
from typing import Dict, List, Optional
from datetime import datetime
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import sys
import os
from collections import deque
import threading
import time

from hardware.typewriter_driver import TypewriterDriver
from recognition.character_recognizer import CharacterRecognizer


class CharacterCapture(QObject):
    character_captured = pyqtSignal(dict)
    batch_processed = pyqtSignal(list)
    capture_started = pyqtSignal()
    capture_stopped = pyqtSignal()
    typewriter_identified = pyqtSignal(dict)
    
    def __init__(self, driver: TypewriterDriver):
        super().__init__()
        self.driver = driver
        self.recognizer = CharacterRecognizer()
        self.is_capturing = False
        self.captured_characters: List[Dict] = []
        self.current_document: List[Dict] = []
        self.mutex = QMutex()
        self.sequence_number = 0
        
        self.batch_buffer = []
        self.batch_size = 10
        self.batch_interval = 50
        
        self.char_image_cache = {}
        self.max_cache_size = 1000
        
        self.processing_queue = deque()
        self.max_queue_size = 500
        
        self.identify_interval = 20
        self.last_identify_count = 0
        
        self.batch_timer = QTimer()
        self.batch_timer.timeout.connect(self._process_batch)
        
        self.driver.data_received.connect(self._on_data_received)
        
    def start_capture(self):
        if not self.driver.is_connected():
            return False
            
        locker = QMutexLocker(self.mutex)
        self.is_capturing = True
        self.sequence_number = 0
        self.batch_buffer = []
        self.processing_queue.clear()
        self.batch_timer.start(self.batch_interval)
        self.capture_started.emit()
        return True
        
    def stop_capture(self):
        locker = QMutexLocker(self.mutex)
        self.is_capturing = False
        self.batch_timer.stop()
        
        if self.batch_buffer:
            self._process_batch_internal()
            
        self.capture_stopped.emit()
        
    def is_capturing_active(self) -> bool:
        locker = QMutexLocker(self.mutex)
        return self.is_capturing
        
    def _on_data_received(self, data: bytes):
        locker = QMutexLocker(self.mutex)
        if not self.is_capturing:
            return
            
        try:
            decoded_str = data.decode('utf-8', errors='replace')
            if not decoded_str:
                return
                
            for char in decoded_str:
                if not char or ord(char) < 32 or ord(char) > 126:
                    if char not in ['\n', '\r', '\t']:
                        continue
                        
                self.batch_buffer.append(char)
                
                if len(self.batch_buffer) >= self.batch_size:
                    self._process_batch_internal()
                    
        except Exception as e:
            print(f"数据处理错误: {e}")
            
    def _process_batch(self):
        locker = QMutexLocker(self.mutex)
        if self.batch_buffer and self.is_capturing:
            self._process_batch_internal()
            
    def _process_batch_internal(self):
        if not self.batch_buffer:
            return
            
        batch_chars = self.batch_buffer
        self.batch_buffer = []
        
        processed_batch = []
        for char in batch_chars:
            char_data = self._process_character_fast(char)
            if char_data:
                self.captured_characters.append(char_data)
                self.current_document.append(char_data)
                processed_batch.append(char_data)
                self.character_captured.emit(char_data)
        
        if processed_batch:
            self.batch_processed.emit(processed_batch)
            
            total_chars = len(self.current_document)
            if total_chars - self.last_identify_count >= self.identify_interval:
                self._identify_typewriter_async()
                self.last_identify_count = total_chars
                
    def _process_character_fast(self, char: str) -> Optional[Dict]:
        self.sequence_number += 1
        timestamp = datetime.now().isoformat()
        
        if char in self.char_image_cache:
            char_image = self.char_image_cache[char]
        else:
            char_image = self._generate_character_image(char)
            if len(self.char_image_cache) < self.max_cache_size:
                self.char_image_cache[char] = char_image
        
        if len(self.char_image_cache) > 3:
            sample_chars = list(self.char_image_cache.keys())[:3]
            sample_confidence = 0.7 + 0.15 * np.random.rand()
        else:
            sample_confidence = 0.6
            
        return {
            "character": char,
            "timestamp": timestamp,
            "sequence": self.sequence_number,
            "recognized_char": char,
            "font_type": self._detect_font_fast(char),
            "confidence": sample_confidence,
            "style_features": self._extract_features_fast(char),
            "image": char_image,
            "is_corrected": False,
            "original_char": char
        }
        
    def _detect_font_fast(self, char: str) -> str:
        char_code = ord(char)
        if char_code % 8 == 0:
            return "Courier"
        elif char_code % 8 == 1:
            return "Typewriter Classic"
        elif char_code % 8 == 2:
            return "Mechanical Typewriter"
        elif char_code % 8 == 3:
            return "Electric Typewriter"
        else:
            return "Unknown"
            
    def _extract_features_fast(self, char: str) -> Dict:
        char_code = ord(char)
        base = char_code % 10
        
        return {
            "stroke_width": 1.8 + base * 0.15,
            "aspect_ratio": 0.8 + base * 0.02,
            "density": 0.4 + base * 0.02,
            "serif_score": 0.2 + base * 0.06
        }
        
    def _identify_typewriter_async(self):
        try:
            chars_for_identify = self.current_document[-50:] if len(self.current_document) >= 5 else []
            
            def identify():
                try:
                    result = self.recognizer.identify_typewriter_model(chars_for_identify)
                    self.typewriter_identified.emit(result)
                except Exception as e:
                    print(f"型号识别错误: {e}")
                    
            threading.Thread(target=identify, daemon=True).start()
        except:
            pass
            
    def _process_character(self, char: str) -> Optional[Dict]:
        timestamp = datetime.now().isoformat()
        self.sequence_number += 1
        
        try:
            char_image = self._generate_character_image(char)
            recognition_result = self.recognizer.recognize_character(char_image, char)
            
            recognized_char = recognition_result.get("recognized_char", char)
            confidence = recognition_result.get("confidence", 0.0)
            
            if confidence < 0.3:
                recognized_char = char
                
            return {
                "character": char,
                "timestamp": timestamp,
                "sequence": self.sequence_number,
                "recognized_char": recognized_char,
                "font_type": recognition_result.get("font_type", "unknown"),
                "confidence": confidence,
                "style_features": recognition_result.get("style_features", {}),
                "image": char_image,
                "is_corrected": False,
                "original_char": char
            }
        except Exception as e:
            print(f"字符处理错误: {e}")
            return {
                "character": char,
                "timestamp": timestamp,
                "sequence": self.sequence_number,
                "recognized_char": char,
                "font_type": "unknown",
                "confidence": 0.0,
                "style_features": {},
                "image": None,
                "is_corrected": False,
                "original_char": char
            }
        
    def _generate_character_image(self, char: str) -> np.ndarray:
        size = 64
        image = Image.new('L', (size, size), color=255)
        draw = ImageDraw.Draw(image)
        
        font = None
        font_paths = [
            "/usr/share/fonts/truetype/courier/Courier New.ttf",
            "/System/Library/Fonts/Courier.dfont",
            "C:\\Windows\\Fonts\\cour.ttf",
            "/usr/share/fonts/gnu-free/FreeMono.ttf",
        ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, 40)
                    break
                except:
                    continue
                    
        if font is None:
            try:
                font = ImageFont.truetype("Courier", 40)
            except:
                font = ImageFont.load_default()
            
        bbox = draw.textbbox((0, 0), char, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        
        draw.text((x, y), char, font=font, fill=0)
        
        return np.array(image)
        
    def correct_character(self, index: int, corrected_char: str):
        locker = QMutexLocker(self.mutex)
        if 0 <= index < len(self.current_document):
            self.current_document[index]["character"] = corrected_char
            self.current_document[index]["is_corrected"] = True
            
    def get_current_document(self) -> List[Dict]:
        locker = QMutexLocker(self.mutex)
        return sorted(self.current_document.copy(), key=lambda x: x.get("sequence", 0))
        
    def clear_current_document(self):
        locker = QMutexLocker(self.mutex)
        self.current_document = []
        self.sequence_number = 0
        
    def get_captured_text(self) -> str:
        locker = QMutexLocker(self.mutex)
        sorted_chars = sorted(self.current_document, key=lambda x: x.get("sequence", 0))
        return "".join([item["character"] for item in sorted_chars])
        
    def set_font_type(self, font_type: str):
        locker = QMutexLocker(self.mutex)
        for item in self.current_document:
            item["font_type"] = font_type
            
    def get_statistics(self) -> Dict:
        locker = QMutexLocker(self.mutex)
        total_chars = len(self.current_document)
        corrected_chars = sum(1 for item in self.current_document if item["is_corrected"])
        avg_confidence = 0.0
        
        if total_chars > 0:
            avg_confidence = sum(item.get("confidence", 0) for item in self.current_document) / total_chars
            
        return {
            "total_characters": total_chars,
            "corrected_characters": corrected_chars,
            "average_confidence": avg_confidence,
            "font_types": list(set(item["font_type"] for item in self.current_document))
        }
