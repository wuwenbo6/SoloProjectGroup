import numpy as np
from typing import Dict, List, Tuple, Optional
try:
    from colorspacious import cspace_converter
    COLORSPACIOUS_AVAILABLE = True
except ImportError:
    COLORSPACIOUS_AVAILABLE = False


class ColorPredictor:
    def __init__(self):
        self.ciecam02_available = COLORSPACIOUS_AVAILABLE

    def rgb_to_hex(self, rgb: np.ndarray) -> str:
        rgb = np.clip(rgb, 0, 1)
        rgb_int = (rgb * 255).astype(int)
        return '#{:02x}{:02x}{:02x}'.format(rgb_int[0], rgb_int[1], rgb_int[2])

    def hex_to_rgb(self, hex_color: str) -> np.ndarray:
        hex_color = hex_color.lstrip('#')
        return np.array([int(hex_color[i:i+2], 16) for i in (0, 2, 4)]) / 255.0

    def rgb_to_hsv(self, rgb: np.ndarray) -> np.ndarray:
        rgb = np.clip(rgb, 0, 1)
        max_idx = np.argmax(rgb)
        min_idx = np.argmin(rgb)
        v = rgb[max_idx]
        delta = v - rgb[min_idx] if v != 0 else 0
        
        if delta == 0:
            h = 0
        else:
            if max_idx == 0:
                h = ((rgb[1] - rgb[2]) / delta) % 6
            elif max_idx == 1:
                h = (rgb[2] - rgb[0]) / delta + 2
            else:
                h = (rgb[0] - rgb[1]) / delta + 4
            h /= 6
        
        s = delta / v if v != 0 else 0
        return np.array([h, s, v])

    def hsv_to_rgb(self, hsv: np.ndarray) -> np.ndarray:
        h, s, v = hsv
        h = h % 1.0 * 6
        i = int(h)
        f = h - i
        p = v * (1 - s)
        q = v * (1 - f * s)
        t = v * (1 - (1 - f) * s)
        
        rgb_map = {
            0: (v, t, p),
            1: (q, v, p),
            2: (p, v, t),
            3: (p, q, v),
            4: (t, p, v),
            5: (v, p, q)
        }
        return np.array(rgb_map[i % 6])

    def rgb_to_cmyk(self, rgb: np.ndarray) -> np.ndarray:
        rgb = np.clip(rgb, 0, 1)
        r, g, b = rgb
        
        if r == 0 and g == 0 and b == 0:
            return np.array([0, 0, 0, 1])
        
        k = 1 - max(r, g, b)
        if k == 1:
            return np.array([0, 0, 0, 1])
        
        c = (1 - r - k) / (1 - k)
        m = (1 - g - k) / (1 - k)
        y = (1 - b - k) / (1 - k)
        
        return np.array([c, m, y, k])

    def cmyk_to_rgb(self, cmyk: np.ndarray) -> np.ndarray:
        c, m, y, k = np.clip(cmyk, 0, 1)
        r = 1 - min(1, c * (1 - k) + k)
        g = 1 - min(1, m * (1 - k) + k)
        b = 1 - min(1, y * (1 - k) + k)
        return np.array([r, g, b])

    def predict_mixed_color(self, colors: List[np.ndarray], 
                             weights: Optional[List[float]] = None,
                             mixing_mode: str = 'subtractive') -> np.ndarray:
        if weights is None:
            weights = [1.0 / len(colors)] * len(colors)
        
        weights = np.array(weights)
        weights = weights / np.sum(weights) if np.sum(weights) > 0 else weights
        
        colors_array = np.array([np.clip(c, 0, 1) for c in colors])
        
        if mixing_mode == 'subtractive':
            cmyk_colors = np.array([self.rgb_to_cmyk(c) for c in colors_array])
            mixed_cmyk = np.dot(weights, cmyk_colors)
            mixed_rgb = self.cmyk_to_rgb(mixed_cmyk)
        elif mixing_mode == 'linear':
            mixed_rgb = np.dot(weights, colors_array)
        elif mixing_mode == 'kubelka_munk':
            f_inf = (1 - colors_array) ** 2 / (2 * colors_array)
            mixed_f = np.dot(weights, f_inf)
            mixed_rgb = 1 + mixed_f - np.sqrt(mixed_f ** 2 + 2 * mixed_f)
        else:
            raise ValueError(f"未知的混合模式: {mixing_mode}，请使用 'linear', 'subtractive' 或 'kubelka_munk'")
        
        return np.clip(mixed_rgb, 0, 1)

    def color_difference(self, color1: np.ndarray, color2: np.ndarray, 
                          method: str = 'euclidean') -> float:
        color1 = np.clip(color1, 0, 1)
        color2 = np.clip(color2, 0, 1)
        
        if method == 'euclidean':
            return np.sqrt(np.sum((color1 - color2) ** 2))
        elif method == 'cie76':
            if self.ciecam02_available:
                lab1 = cspace_converter("sRGB1", "CIELab")(color1)
                lab2 = cspace_converter("sRGB1", "CIELab")(color2)
                return np.sqrt(np.sum((lab1 - lab2) ** 2))
            else:
                return self.color_difference(color1, color2, 'euclidean')
        elif method == 'cie94':
            if self.ciecam02_available:
                lab1 = cspace_converter("sRGB1", "CIELab")(color1)
                lab2 = cspace_converter("sRGB1", "CIELab")(color2)
                dL = lab1[0] - lab2[0]
                C1 = np.sqrt(lab1[1]**2 + lab1[2]**2)
                C2 = np.sqrt(lab2[1]**2 + lab2[2]**2)
                dC = C1 - C2
                dH2 = np.sum((lab1[1:] - lab2[1:])**2) - dC**2
                dH = np.sqrt(max(0, dH2))
                SL = 1
                SC = 1 + 0.045 * C1
                SH = 1 + 0.015 * C1
                return np.sqrt((dL/SL)**2 + (dC/SC)**2 + (dH/SH)**2)
            else:
                return self.color_difference(color1, color2, 'euclidean')
        else:
            raise ValueError(f"Unknown method: {method}")

    def find_closest_color(self, target_color: np.ndarray, 
                            color_palette: List[np.ndarray],
                            method: str = 'euclidean') -> Tuple[int, float]:
        min_diff = float('inf')
        min_idx = 0
        
        for i, color in enumerate(color_palette):
            diff = self.color_difference(target_color, color, method)
            if diff < min_diff:
                min_diff = diff
                min_idx = i
        
        return min_idx, min_diff

    def generate_color_gradient(self, start_color: np.ndarray, 
                                 end_color: np.ndarray, 
                                 num_steps: int = 10) -> np.ndarray:
        start_color = np.clip(start_color, 0, 1)
        end_color = np.clip(end_color, 0, 1)
        
        alphas = np.linspace(0, 1, num_steps)
        gradient = np.array([start_color * (1 - a) + end_color * a for a in alphas])
        return np.clip(gradient, 0, 1)

    def predict_color_after_reaction(self, initial_color: np.ndarray,
                                      reaction_progress: float,
                                      fading_factor: float = 0.5) -> np.ndarray:
        hsv = self.rgb_to_hsv(initial_color)
        hsv[1] *= (1 - reaction_progress * fading_factor)
        hsv[2] *= (1 - reaction_progress * fading_factor * 0.3)
        return self.hsv_to_rgb(hsv)

    def optimize_matching_ratio(self, target_color: np.ndarray,
                                 base_colors: List[np.ndarray],
                                 max_iterations: int = 1000,
                                 learning_rate: float = 0.01,
                                 mixing_mode: str = 'subtractive') -> Dict:
        n_colors = len(base_colors)
        base_colors = np.array([np.clip(c, 0, 1) for c in base_colors])
        target_color = np.clip(target_color, 0, 1)
        
        ratios = np.ones(n_colors) / n_colors
        
        best_ratios = ratios.copy()
        best_error = float('inf')
        
        for iteration in range(max_iterations):
            if mixing_mode == 'subtractive':
                cmyk_colors = np.array([self.rgb_to_cmyk(c) for c in base_colors])
                mixed_cmyk = np.dot(ratios, cmyk_colors)
                mixed_color = self.cmyk_to_rgb(mixed_cmyk)
            elif mixing_mode == 'kubelka_munk':
                f_inf = (1 - base_colors) ** 2 / (2 * base_colors + 1e-8)
                mixed_f = np.dot(ratios, f_inf)
                mixed_color = 1 + mixed_f - np.sqrt(mixed_f ** 2 + 2 * mixed_f)
            else:
                mixed_color = np.dot(ratios, base_colors)
            
            error = np.sum((mixed_color - target_color) ** 2)
            
            if error < best_error:
                best_error = error
                best_ratios = ratios.copy()
            
            eps = 1e-6
            for i in range(n_colors):
                ratios_plus = ratios.copy()
                ratios_plus[i] += eps
                ratios_plus = ratios_plus / np.sum(ratios_plus)
                
                if mixing_mode == 'subtractive':
                    cmyk_colors = np.array([self.rgb_to_cmyk(c) for c in base_colors])
                    mixed_cmyk_plus = np.dot(ratios_plus, cmyk_colors)
                    mixed_color_plus = self.cmyk_to_rgb(mixed_cmyk_plus)
                elif mixing_mode == 'kubelka_munk':
                    f_inf_plus = (1 - base_colors) ** 2 / (2 * base_colors + 1e-8)
                    mixed_f_plus = np.dot(ratios_plus, f_inf_plus)
                    mixed_color_plus = 1 + mixed_f_plus - np.sqrt(mixed_f_plus ** 2 + 2 * mixed_f_plus)
                else:
                    mixed_color_plus = np.dot(ratios_plus, base_colors)
                
                error_plus = np.sum((mixed_color_plus - target_color) ** 2)
                gradient = (error_plus - error) / eps
                ratios[i] -= learning_rate * gradient
            
            ratios = np.maximum(ratios, 0)
            if np.sum(ratios) > 0:
                ratios /= np.sum(ratios)
            else:
                ratios = np.ones(n_colors) / n_colors
        
        best_ratios = best_ratios / np.sum(best_ratios)
        
        if mixing_mode == 'subtractive':
            cmyk_colors = np.array([self.rgb_to_cmyk(c) for c in base_colors])
            final_cmyk = np.dot(best_ratios, cmyk_colors)
            final_color = self.cmyk_to_rgb(final_cmyk)
        elif mixing_mode == 'kubelka_munk':
            f_inf_final = (1 - base_colors) ** 2 / (2 * base_colors + 1e-8)
            mixed_f_final = np.dot(best_ratios, f_inf_final)
            final_color = 1 + mixed_f_final - np.sqrt(mixed_f_final ** 2 + 2 * mixed_f_final)
        else:
            final_color = np.dot(best_ratios, base_colors)
        
        return {
            'ratios': best_ratios,
            'predicted_color': np.clip(final_color, 0, 1),
            'error': best_error,
            'iterations': max_iterations,
            'mixing_mode': mixing_mode
        }

    def calculate_color_temperature(self, rgb: np.ndarray) -> float:
        rgb = np.clip(rgb, 0, 1)
        r, g, b = rgb
        
        if r > 0.8 and g > 0.8 and b > 0.8:
            return 6500
        elif r > g and g > b:
            return 2000 + (r - g) * 4000
        elif b > g and g > r:
            return 8000 + (b - g) * 2000
        else:
            return 5500

    def complementary_color(self, rgb: np.ndarray) -> np.ndarray:
        return 1 - np.clip(rgb, 0, 1)

    def analyze_color_properties(self, rgb: np.ndarray) -> Dict:
        rgb = np.clip(rgb, 0, 1)
        hsv = self.rgb_to_hsv(rgb)
        
        brightness = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
        
        saturation = hsv[1]
        warmth = 1 - abs(self.calculate_color_temperature(rgb) - 5000) / 5000
        
        dominant_idx = np.argmax(rgb)
        dominant_channel = ['red', 'green', 'blue'][dominant_idx]
        
        return {
            'rgb': rgb,
            'hsv': hsv,
            'hex': self.rgb_to_hex(rgb),
            'brightness': brightness,
            'saturation': saturation,
            'warmth': warmth,
            'dominant_channel': dominant_channel,
            'temperature': self.calculate_color_temperature(rgb)
        }

    def predict_dyeing_result(self, fabric_color: np.ndarray,
                               dye_color: np.ndarray,
                               dye_concentration: float = 0.5) -> np.ndarray:
        fabric_color = np.clip(fabric_color, 0, 1)
        dye_color = np.clip(dye_color, 0, 1)
        
        result = fabric_color * (1 - dye_concentration) + dye_color * dye_concentration
        return np.clip(result, 0, 1)

    def create_color_palette(self, base_color: np.ndarray,
                              num_shades: int = 5,
                              variation: str = 'lightness') -> List[np.ndarray]:
        base_color = np.clip(base_color, 0, 1)
        hsv = self.rgb_to_hsv(base_color)
        
        palette = []
        if variation == 'lightness':
            for i in range(num_shades):
                factor = 0.3 + (0.7 * i) / (num_shades - 1)
                new_hsv = hsv.copy()
                new_hsv[2] = hsv[2] * factor
                palette.append(self.hsv_to_rgb(new_hsv))
        elif variation == 'saturation':
            for i in range(num_shades):
                factor = 0.1 + (0.9 * i) / (num_shades - 1)
                new_hsv = hsv.copy()
                new_hsv[1] = hsv[1] * factor
                palette.append(self.hsv_to_rgb(new_hsv))
        elif variation == 'hue':
            for i in range(num_shades):
                hue_shift = (i - num_shades//2) * 0.1
                new_hsv = hsv.copy()
                new_hsv[0] = (hsv[0] + hue_shift) % 1.0
                palette.append(self.hsv_to_rgb(new_hsv))
        
        return palette
