import numpy as np
import cv2
from typing import Dict, List, Tuple
from dataclasses import dataclass


@dataclass
class CharacterStyle:
    name: str
    stroke_width: float
    serif: bool
    bold: bool
    italic: bool


@dataclass
class TypewriterModelProfile:
    name: str
    brand: str
    model_type: str
    avg_stroke_width: float
    avg_density: float
    avg_serif_score: float
    aspect_ratio: float
    known_fonts: List[str]
    
    def to_feature_vector(self) -> List[float]:
        return [
            self.avg_stroke_width,
            self.avg_density,
            self.avg_serif_score,
            self.aspect_ratio
        ]


class CharacterRecognizer:
    def __init__(self):
        self.known_fonts = self._init_known_fonts()
        self.character_templates = self._init_character_templates()
        self.typewriter_profiles = self._init_typewriter_profiles()
        self.cache = {}
        
    def _init_known_fonts(self) -> List[CharacterStyle]:
        return [
            CharacterStyle("Courier", 2.0, False, False, False),
            CharacterStyle("Courier Bold", 3.0, False, True, False),
            CharacterStyle("Times New Roman", 1.5, True, False, False),
            CharacterStyle("Typewriter Classic", 2.5, True, False, False),
            CharacterStyle("Mechanical Typewriter", 3.0, True, False, False),
            CharacterStyle("Electric Typewriter", 1.8, False, False, False),
        ]
        
    def _init_character_templates(self) -> Dict[str, np.ndarray]:
        templates = {}
        chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?'- "
        for char in chars:
            templates[char] = self._create_template(char)
        return templates
        
    def _init_typewriter_profiles(self) -> Dict[str, TypewriterModelProfile]:
        profiles = {}
        
        profiles["IBM Selectric"] = TypewriterModelProfile(
            name="IBM Selectric",
            brand="IBM",
            model_type="Electric",
            avg_stroke_width=2.2,
            avg_density=0.45,
            avg_serif_score=0.3,
            aspect_ratio=0.85,
            known_fonts=["Courier", "Prestige Elite"]
        )
        
        profiles["Royal Classic"] = TypewriterModelProfile(
            name="Royal Classic",
            brand="Royal",
            model_type="Mechanical",
            avg_stroke_width=3.0,
            avg_density=0.55,
            avg_serif_score=0.7,
            aspect_ratio=0.9,
            known_fonts=["Royal Typewriter", "Royal Classic"]
        )
        
        profiles["Underwood No.5"] = TypewriterModelProfile(
            name="Underwood No.5",
            brand="Underwood",
            model_type="Mechanical",
            avg_stroke_width=3.2,
            avg_density=0.58,
            avg_serif_score=0.75,
            aspect_ratio=0.92,
            known_fonts=["Underwood Classic"]
        )
        
        profiles["Remington Quiet-Riter"] = TypewriterModelProfile(
            name="Remington Quiet-Riter",
            brand="Remington",
            model_type="Mechanical",
            avg_stroke_width=2.8,
            avg_density=0.52,
            avg_serif_score=0.65,
            aspect_ratio=0.88,
            known_fonts=["Remington Standard"]
        )
        
        profiles["Olympia SM9"] = TypewriterModelProfile(
            name="Olympia SM9",
            brand="Olympia",
            model_type="Mechanical",
            avg_stroke_width=2.5,
            avg_density=0.48,
            avg_serif_score=0.55,
            aspect_ratio=0.87,
            known_fonts=["Olympia Sans"]
        )
        
        profiles["Hermes 3000"] = TypewriterModelProfile(
            name="Hermes 3000",
            brand="Hermes",
            model_type="Mechanical",
            avg_stroke_width=2.6,
            avg_density=0.5,
            avg_serif_score=0.6,
            aspect_ratio=0.86,
            known_fonts=["Hermes Elite"]
        )
        
        profiles["Brother Electric"] = TypewriterModelProfile(
            name="Brother Electric",
            brand="Brother",
            model_type="Electric",
            avg_stroke_width=1.8,
            avg_density=0.4,
            avg_serif_score=0.25,
            aspect_ratio=0.82,
            known_fonts=["Brother Modern"]
        )
        
        profiles["Smith Corona"] = TypewriterModelProfile(
            name="Smith Corona",
            brand="Smith Corona",
            model_type="Electric",
            avg_stroke_width=2.0,
            avg_density=0.42,
            avg_serif_score=0.28,
            aspect_ratio=0.84,
            known_fonts=["Corona Script"]
        )
        
        return profiles
        
    def identify_typewriter_model(self, characters: List[Dict]) -> Dict:
        if len(characters) < 5:
            return {
                "model_name": "Unknown",
                "brand": "Unknown",
                "model_type": "Unknown",
                "confidence": 0.0,
                "matches": {}
            }
            
        avg_stroke_width = 0.0
        avg_density = 0.0
        avg_serif_score = 0.0
        avg_aspect_ratio = 0.0
        valid_count = 0
        
        for char_data in characters:
            features = char_data.get("style_features", {})
            if features:
                avg_stroke_width += features.get("stroke_width", 2.0)
                avg_density += features.get("density", 0.5)
                avg_serif_score += features.get("serif_score", 0.5)
                avg_aspect_ratio += features.get("aspect_ratio", 1.0)
                valid_count += 1
        
        if valid_count == 0:
            return {
                "model_name": "Unknown",
                "brand": "Unknown",
                "model_type": "Unknown",
                "confidence": 0.0,
                "matches": {}
            }
            
        avg_stroke_width /= valid_count
        avg_density /= valid_count
        avg_serif_score /= valid_count
        avg_aspect_ratio /= valid_count
        
        sample_vector = [avg_stroke_width, avg_density, avg_serif_score, avg_aspect_ratio]
        
        matches = {}
        for name, profile in self.typewriter_profiles.items():
            profile_vector = profile.to_feature_vector()
            distance = np.linalg.norm(np.array(sample_vector) - np.array(profile_vector))
            similarity = 1.0 / (1.0 + distance)
            matches[name] = similarity
        
        sorted_matches = sorted(matches.items(), key=lambda x: x[1], reverse=True)
        best_match_name, best_confidence = sorted_matches[0]
        best_profile = self.typewriter_profiles[best_match_name]
        
        font_votes = {}
        for char_data in characters:
            font = char_data.get("font_type", "unknown")
            font_votes[font] = font_votes.get(font, 0) + 1
        
        if font_votes:
            majority_font = max(font_votes.items(), key=lambda x: x[1])[0]
            for name, profile in self.typewriter_profiles.items():
                if majority_font in profile.known_fonts:
                    matches[name] = matches.get(name, 0) * 1.3
        
        sorted_matches = sorted(matches.items(), key=lambda x: x[1], reverse=True)
        best_match_name, best_confidence = sorted_matches[0]
        best_profile = self.typewriter_profiles[best_match_name]
        
        return {
            "model_name": best_profile.name,
            "brand": best_profile.brand,
            "model_type": best_profile.model_type,
            "confidence": min(best_confidence, 1.0),
            "matches": dict(sorted_matches[:3]),
            "sample_size": valid_count,
            "avg_features": {
                "stroke_width": avg_stroke_width,
                "density": avg_density,
                "serif_score": avg_serif_score,
                "aspect_ratio": avg_aspect_ratio
            }
        }
        
    def add_custom_typewriter_profile(self, name: str, brand: str, model_type: str,
                                     avg_stroke_width: float, avg_density: float,
                                     avg_serif_score: float, aspect_ratio: float,
                                     known_fonts: List[str] = None) -> bool:
        try:
            profile = TypewriterModelProfile(
                name=name,
                brand=brand,
                model_type=model_type,
                avg_stroke_width=avg_stroke_width,
                avg_density=avg_density,
                avg_serif_score=avg_serif_score,
                aspect_ratio=aspect_ratio,
                known_fonts=known_fonts or []
            )
            self.typewriter_profiles[name] = profile
            return True
        except Exception as e:
            print(f"添加自定义型号失败: {e}")
            return False
        
    def _create_template(self, char: str) -> np.ndarray:
        size = 64
        image = np.ones((size, size), dtype=np.uint8) * 255
        
        font_faces = [cv2.FONT_HERSHEY_SIMPLEX, cv2.FONT_HERSHEY_PLAIN, 
                      cv2.FONT_HERSHEY_DUPLEX, cv2.FONT_HERSHEY_COMPLEX]
        
        for font in font_faces:
            try:
                cv2.putText(image, char, (12, 48), font, 1.8, 0, 2)
                break
            except:
                continue
        
        return image
        
    def recognize_character(self, image: np.ndarray, expected_char: str = "") -> Dict:
        if image is None:
            return {
                "recognized_char": expected_char or "?",
                "font_type": "unknown",
                "confidence": 0.0,
                "style_features": {}
            }
            
        try:
            img_hash = self._hash_image(image)
            if img_hash in self.cache:
                return self.cache[img_hash].copy()
                
            preprocessed = self._preprocess_image(image)
            
            if np.sum(preprocessed > 0) < 10:
                return {
                    "recognized_char": expected_char or " ",
                    "font_type": "unknown",
                    "confidence": 0.9,
                    "style_features": {}
                }
            
            features = self._extract_style_features(preprocessed)
            
            font_type = self._classify_font(features)
            
            confidence = self._calculate_confidence(preprocessed, expected_char)
            
            result = {
                "recognized_char": expected_char,
                "font_type": font_type,
                "confidence": confidence,
                "style_features": features
            }
            
            if len(self.cache) < 1000:
                self.cache[img_hash] = result.copy()
            
            return result
        except Exception as e:
            print(f"识别错误: {e}")
            return {
                "recognized_char": expected_char or "?",
                "font_type": "unknown",
                "confidence": 0.5,
                "style_features": {}
            }
        
    def _hash_image(self, image: np.ndarray) -> str:
        return hashlib.md5(image.tobytes()).hexdigest()
        
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
            
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        kernel = np.ones((1, 1), np.uint8)
        cleaned = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel)
        
        return cleaned
        
    def _extract_style_features(self, image: np.ndarray) -> Dict:
        contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return {
                "stroke_width": 2.0,
                "aspect_ratio": 1.0,
                "density": 0.5,
                "serif_score": 0.5
            }
            
        cnt = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(cnt)
        
        if w == 0 or h == 0:
            return {
                "stroke_width": 2.0,
                "aspect_ratio": 1.0,
                "density": 0.5,
                "serif_score": 0.5
            }
        
        roi = image[y:y+h, x:x+w]
        stroke_width = self._estimate_stroke_width(roi)
        
        density = cv2.countNonZero(roi) / (w * h)
        
        serif_score = self._detect_serifs(roi)
        
        return {
            "stroke_width": stroke_width,
            "aspect_ratio": w / h,
            "density": density,
            "serif_score": serif_score
        }
        
    def _estimate_stroke_width(self, char_image: np.ndarray) -> float:
        if char_image.size == 0:
            return 2.0
            
        distance = cv2.distanceTransform(char_image, cv2.DIST_L2, 3)
        if distance.size > 0:
            max_dist = np.max(distance)
            return max_dist * 2
        return 2.0
        
    def _detect_serifs(self, char_image: np.ndarray) -> float:
        h, w = char_image.shape
        if h < 10 or w < 10:
            return 0.5
            
        margin = max(1, h // 10)
        top_rows = char_image[:margin, :]
        bottom_rows = char_image[-margin:, :]
        
        top_width = np.sum(top_rows > 0) / (w * margin) if w * margin > 0 else 0
        bottom_width = np.sum(bottom_rows > 0) / (w * margin) if w * margin > 0 else 0
        
        return (top_width + bottom_width) / 2
        
    def _classify_font(self, features: Dict) -> str:
        stroke_width = features.get("stroke_width", 2.0)
        serif_score = features.get("serif_score", 0.5)
        density = features.get("density", 0.5)
        
        best_match = "Mechanical Typewriter"
        best_score = float('inf')
        
        for font in self.known_fonts:
            score = 0.0
            score += abs(stroke_width - font.stroke_width) * 2.0
            score += abs(serif_score - (1.0 if font.serif else 0.0)) * 3.0
            score += abs(density - 0.4) * 1.5
            
            if score < best_score:
                best_score = score
                best_match = font.name
                
        return best_match
        
    def _calculate_confidence(self, image: np.ndarray, expected_char: str) -> float:
        if not expected_char:
            return 0.7
            
        if expected_char not in self.character_templates:
            return 0.6
            
        try:
            template = self.character_templates[expected_char]
            resized = cv2.resize(image, (64, 64))
            
            match_score = cv2.matchTemplate(resized, template, cv2.TM_CCOEFF_NORMED)
            confidence = float(np.max(match_score))
            
            confidence = 0.5 + confidence * 0.5
            
            return max(0.3, min(1.0, confidence))
        except:
            return 0.6
        
    def batch_recognize(self, images: List[np.ndarray], expected_chars: List[str]) -> List[Dict]:
        results = []
        for img, char in zip(images, expected_chars):
            results.append(self.recognize_character(img, char))
        return results
        
    def recognize_font_from_sample(self, image: np.ndarray) -> Dict:
        try:
            preprocessed = self._preprocess_image(image)
            features = self._extract_style_features(preprocessed)
            font_type = self._classify_font(features)
            
            return {
                "font_type": font_type,
                "features": features,
                "confidence": 0.7
            }
        except:
            return {
                "font_type": "unknown",
                "features": {},
                "confidence": 0.5
            }
        
    def compare_characters(self, char1: np.ndarray, char2: np.ndarray) -> float:
        try:
            img1 = self._preprocess_image(char1)
            img2 = self._preprocess_image(char2)
            
            img1_resized = cv2.resize(img1, (64, 64))
            img2_resized = cv2.resize(img2, (64, 64))
            
            similarity = cv2.matchTemplate(img1_resized, img2_resized, cv2.TM_CCOEFF_NORMED)
            return float(np.max(similarity))
        except:
            return 0.5
            
    def compare_style_features(self, features1: Dict, features2: Dict) -> Dict[str, float]:
        comparisons = {}
        
        sw1 = features1.get("stroke_width", 2.0)
        sw2 = features2.get("stroke_width", 2.0)
        comparisons["stroke_width_similarity"] = 1.0 / (1.0 + abs(sw1 - sw2))
        
        ar1 = features1.get("aspect_ratio", 1.0)
        ar2 = features2.get("aspect_ratio", 1.0)
        comparisons["aspect_ratio_similarity"] = 1.0 / (1.0 + abs(ar1 - ar2))
        
        d1 = features1.get("density", 0.5)
        d2 = features2.get("density", 0.5)
        comparisons["density_similarity"] = 1.0 / (1.0 + abs(d1 - d2))
        
        sf1 = features1.get("serif_score", 0.5)
        sf2 = features2.get("serif_score", 0.5)
        comparisons["serif_similarity"] = 1.0 / (1.0 + abs(sf1 - sf2))
        
        total_score = sum(comparisons.values()) / len(comparisons)
        comparisons["overall_similarity"] = total_score
        
        return comparisons
        
    def create_comparison_image(self, chars_data: List[Dict], output_path: str = None) -> np.ndarray:
        if not chars_data:
            return np.zeros((100, 400), dtype=np.uint8) + 255
            
        char_size = 80
        padding = 20
        num_chars = len(chars_data)
        
        img_width = num_chars * char_size + (num_chars + 1) * padding
        img_height = char_size + 60
        
        result_img = np.ones((img_height, img_width), dtype=np.uint8) * 255
        
        for i, char_data in enumerate(chars_data):
            x = padding + i * (char_size + padding)
            y = padding
            
            char_img = char_data.get("image", None)
            if char_img is not None:
                try:
                    if isinstance(char_img, np.ndarray):
                        if len(char_img.shape) == 3:
                            char_img = cv2.cvtColor(char_img, cv2.COLOR_BGR2GRAY)
                        char_resized = cv2.resize(char_img, (char_size - 10, char_size - 10))
                        result_img[y+5:y+char_size-5, x+5:x+char_size-5] = char_resized
                except:
                    pass
            
            char_text = char_data.get("character", "?")
            font_type = char_data.get("font_type", "unknown")
            confidence = char_data.get("confidence", 0.0)
            
            label = f"'{char_text}'\n{font_type[:10]}\n{confidence:.2f}"
            lines = label.split('\n')
            for j, line in enumerate(lines):
                cv2.putText(result_img, line, (x, char_size + 30 + j * 15),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, 0, 1)
        
        if output_path:
            cv2.imwrite(output_path, result_img)
            
        return result_img
