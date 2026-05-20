import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple
import logging
from enum import Enum


class FilmStock(Enum):
    KODACHROME = "Kodachrome"
    EKTACHROME = "Ektachrome"
    FUJICHROME = "Fujichrome"
    AGFACOLOR = "Agfacolor"
    BLACK_AND_WHITE = "BlackAndWhite"
    UNKNOWN = "Unknown"


@dataclass
class FilmColorParams:
    red_gain: float = 1.0
    green_gain: float = 1.0
    blue_gain: float = 1.0
    red_offset: int = 0
    green_offset: int = 0
    blue_offset: int = 0
    gamma: float = 1.0
    contrast: float = 1.0
    saturation: float = 1.0
    brightness: float = 0.0
    temperature: float = 0.0
    tint: float = 0.0
    cyan_red: float = 0.0
    magenta_green: float = 0.0
    yellow_blue: float = 0.0
    fade_correction: float = 0.7
    dust_brightness: float = 0.5


@dataclass
class ColorCalibrationData:
    white_point: Tuple[float, float, float] = (1.0, 1.0, 1.0)
    black_point: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    gray_point: Tuple[float, float, float] = (0.5, 0.5, 0.5)
    color_matrix: np.ndarray = field(default_factory=lambda: np.eye(3, dtype=np.float32))


class FilmColorCorrector:
    def __init__(self):
        self.logger = logging.getLogger("FilmColorCorrector")
        self._film_stock_params = self._init_film_stock_params()
        self.current_params = FilmColorParams()
        self.calibration_data = ColorCalibrationData()
        self.lut_r = None
        self.lut_g = None
        self.lut_b = None
        self._build_luts()

    def _init_film_stock_params(self) -> dict:
        return {
            FilmStock.KODACHROME: FilmColorParams(
                red_gain=1.15,
                green_gain=1.0,
                blue_gain=1.2,
                gamma=1.1,
                saturation=1.15,
                fade_correction=0.8
            ),
            FilmStock.EKTACHROME: FilmColorParams(
                red_gain=1.05,
                green_gain=1.0,
                blue_gain=1.1,
                gamma=1.05,
                saturation=1.1,
                fade_correction=0.75
            ),
            FilmStock.FUJICHROME: FilmColorParams(
                red_gain=0.95,
                green_gain=1.0,
                blue_gain=1.05,
                gamma=1.0,
                saturation=1.05,
                fade_correction=0.7
            ),
            FilmStock.AGFACOLOR: FilmColorParams(
                red_gain=1.1,
                green_gain=0.98,
                blue_gain=1.05,
                gamma=1.08,
                saturation=1.08,
                fade_correction=0.72
            ),
            FilmStock.BLACK_AND_WHITE: FilmColorParams(
                red_gain=1.0,
                green_gain=1.0,
                blue_gain=1.0,
                gamma=1.2,
                saturation=0.0,
                fade_correction=0.6
            ),
        }

    def set_film_stock(self, film_stock: FilmStock):
        if film_stock in self._film_stock_params:
            self.current_params = self._film_stock_params[film_stock]
            self._build_luts()
            self.logger.info(f"Set film stock to {film_stock.value}")

    def set_custom_params(self, params: FilmColorParams):
        self.current_params = params
        self._build_luts()

    def _build_luts(self):
        p = self.current_params
        self.lut_r = self._build_single_lut(p.red_gain, p.red_offset, p.gamma)
        self.lut_g = self._build_single_lut(p.green_gain, p.green_offset, p.gamma)
        self.lut_b = self._build_single_lut(p.blue_gain, p.blue_offset, p.gamma)

    def _build_single_lut(self, gain: float, offset: int, gamma: float) -> np.ndarray:
        lut = np.arange(256, dtype=np.float32)
        lut = ((lut / 255.0) ** (1.0 / gamma)) * 255.0 * gain + offset
        return np.clip(lut, 0, 255).astype(np.uint8)

    def correct_frame(self, frame: np.ndarray) -> np.ndarray:
        if frame is None or frame.size == 0:
            return frame

        corrected = frame.copy()

        corrected = self._apply_channel_gains(corrected)

        corrected = self._apply_white_balance(corrected)

        corrected = self._apply_color_matrix(corrected)

        corrected = self._apply_fade_correction(corrected)

        corrected = self._apply_contrast_saturation(corrected)

        return corrected

    def _apply_channel_gains(self, frame: np.ndarray) -> np.ndarray:
        b, g, r = cv2.split(frame)
        r = cv2.LUT(r, self.lut_r)
        g = cv2.LUT(g, self.lut_g)
        b = cv2.LUT(b, self.lut_b)
        return cv2.merge((b, g, r))

    def _apply_white_balance(self, frame: np.ndarray) -> np.ndarray:
        p = self.current_params

        if p.temperature != 0 or p.tint != 0:
            temp_factor = (p.temperature + 50) / 100.0
            tint_factor = (p.tint + 50) / 100.0

            b, g, r = cv2.split(frame.astype(np.float32))

            r = r * (1.0 + temp_factor * 0.3)
            b = b * (1.0 - temp_factor * 0.3)

            g = g * (1.0 + tint_factor * 0.2)
            r = r * (1.0 - tint_factor * 0.1)
            b = b * (1.0 - tint_factor * 0.1)

            frame = cv2.merge((b, g, r))
            frame = np.clip(frame, 0, 255).astype(np.uint8)

        return frame

    def _apply_color_matrix(self, frame: np.ndarray) -> np.ndarray:
        if not np.allclose(self.calibration_data.color_matrix, np.eye(3)):
            frame_float = frame.astype(np.float32) / 255.0

            reshaped = frame_float.reshape(-1, 3)
            corrected = np.dot(reshaped, self.calibration_data.color_matrix.T)
            corrected = corrected.reshape(frame.shape)

            frame = np.clip(corrected * 255.0, 0, 255).astype(np.uint8)

        return frame

    def _apply_fade_correction(self, frame: np.ndarray) -> np.ndarray:
        p = self.current_params
        if p.fade_correction <= 0:
            return frame

        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab.astype(np.float32))

        l = cv2.normalize(l, None, 0, 255, cv2.NORM_MINMAX)

        a_mean = np.mean(a)
        b_mean = np.mean(b)
        a = (a - a_mean) * (1.0 + p.fade_correction) + a_mean
        b = (b - b_mean) * (1.0 + p.fade_correction) + b_mean

        lab_corrected = cv2.merge((l, a, b))
        lab_corrected = np.clip(lab_corrected, 0, 255).astype(np.uint8)

        return cv2.cvtColor(lab_corrected, cv2.COLOR_LAB2BGR)

    def _apply_contrast_saturation(self, frame: np.ndarray) -> np.ndarray:
        p = self.current_params

        if p.contrast != 1.0 or p.brightness != 0:
            frame = cv2.convertScaleAbs(frame, alpha=p.contrast, beta=p.brightness)

        if p.saturation != 1.0:
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            h, s, v = cv2.split(hsv.astype(np.float32))
            s = np.clip(s * p.saturation, 0, 255)
            hsv = cv2.merge((h, s, v)).astype(np.uint8)
            frame = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

        return frame

    def auto_white_balance(self, frame: np.ndarray) -> FilmColorParams:
        gray_world = frame.mean(axis=(0, 1))
        mean_gray = gray_world.mean()

        params = FilmColorParams()
        params.blue_gain = mean_gray / gray_world[0]
        params.green_gain = mean_gray / gray_world[1]
        params.red_gain = mean_gray / gray_world[2]

        max_gain = max(params.red_gain, params.green_gain, params.blue_gain)
        params.red_gain /= max_gain
        params.green_gain /= max_gain
        params.blue_gain /= max_gain

        self.logger.info(f"Auto WB gains - R: {params.red_gain:.3f}, G: {params.green_gain:.3f}, B: {params.blue_gain:.3f}")

        return params

    def auto_exposure(self, frame: np.ndarray) -> FilmColorParams:
        params = FilmColorParams()

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])

        total = gray.size
        target_black = total * 0.01
        target_white = total * 0.99

        cum_hist = np.cumsum(hist)
        black_point = np.searchsorted(cum_hist, target_black)
        white_point = np.searchsorted(cum_hist, target_white)

        if white_point > black_point:
            params.contrast = 255.0 / (white_point - black_point)
            params.brightness = -black_point * params.contrast

        self.logger.info(f"Auto exposure - contrast: {params.contrast:.3f}, brightness: {params.brightness:.1f}")

        return params

    def auto_color_correct(self, frame: np.ndarray) -> FilmColorParams:
        wb_params = self.auto_white_balance(frame)
        exp_params = self.auto_exposure(frame)

        combined = FilmColorParams()
        combined.red_gain = wb_params.red_gain
        combined.green_gain = wb_params.green_gain
        combined.blue_gain = wb_params.blue_gain
        combined.contrast = exp_params.contrast
        combined.brightness = exp_params.brightness
        combined.fade_correction = 0.7
        combined.saturation = 1.1

        return combined

    def calibrate_from_graycard(self, graycard_frame: np.ndarray):
        mean_rgb = cv2.cvtColor(graycard_frame, cv2.COLOR_BGR2RGB).mean(axis=(0, 1))
        mean_gray = mean_rgb.mean()

        self.calibration_data.white_point = tuple(mean_rgb / 255.0)

        self.calibration_data.color_matrix = np.array([
            [mean_gray / mean_rgb[0], 0, 0],
            [0, mean_gray / mean_rgb[1], 0],
            [0, 0, mean_gray / mean_rgb[2]]
        ], dtype=np.float32)

        self.logger.info("Calibrated from gray card")

    def create_color_histogram_equalization(self, frame: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_eq = clahe.apply(l)

        lab_eq = cv2.merge((l_eq, a, b))
        return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)

    def remove_dust_and_scratches(self, frame: np.ndarray, radius: int = 2) -> np.ndarray:
        p = self.current_params
        if p.dust_brightness <= 0:
            return frame

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        median = cv2.medianBlur(gray, 2 * radius + 1)

        diff = cv2.absdiff(gray, median)

        _, mask = cv2.threshold(diff, int(255 * (1 - p.dust_brightness)), 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.dilate(mask, kernel)

        result = frame.copy()
        for i in range(3):
            result[:, :, i] = np.where(mask == 255, median, frame[:, :, i])

        return result

    def get_color_timeline(self, frames: list) -> dict:
        if not frames:
            return {}

        stats = {
            'mean_r': [],
            'mean_g': [],
            'mean_b': [],
            'contrast': [],
            'saturation': []
        }

        for frame in frames:
            mean = frame.mean(axis=(0, 1))
            stats['mean_b'].append(mean[0])
            stats['mean_g'].append(mean[1])
            stats['mean_r'].append(mean[2])

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            stats['contrast'].append(gray.std())

            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            stats['saturation'].append(hsv[:, :, 1].mean())

        return {
            k: (np.mean(v) if v else 0) for k, v in stats.items()
        }
