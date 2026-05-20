import cv2
import numpy as np
from dataclasses import dataclass
from typing import Optional, List, Tuple
import logging
from enum import Enum


class ScratchType(Enum):
    LINEAR_VERTICAL = "vertical"
    LINEAR_HORIZONTAL = "horizontal"
    CURL = "curl"
    DOT = "dot"
    HAIR = "hair"
    UNKNOWN = "unknown"


@dataclass
class ScratchDetectionParams:
    sensitivity: float = 0.5
    min_length: int = 5
    max_width: int = 20
    edge_threshold: int = 50
    multi_scale_levels: int = 3
    enable_directional_detection: bool = True
    enable_hough_transform: bool = True
    enable_deep_detection: bool = False


@dataclass
class InpaintingParams:
    method: str = "telea"
    radius: int = 3
    iterations: int = 1
    blend_strength: float = 0.5
    preserve_edges: bool = True


@dataclass
class DetectedScratch:
    scratch_type: ScratchType
    mask: np.ndarray
    bounding_box: Tuple[int, int, int, int]
    length: float
    width: float
    confidence: float
    orientation: float


class MultiScaleScratchDetector:
    def __init__(self):
        self.logger = logging.getLogger("MultiScaleScratchDetector")
        self.detection_params = ScratchDetectionParams()
        self.inpainting_params = InpaintingParams()

    def set_detection_params(self, params: ScratchDetectionParams):
        self.detection_params = params

    def set_inpainting_params(self, params: InpaintingParams):
        self.inpainting_params = params

    def detect_and_remove(self, frame: np.ndarray) -> Tuple[np.ndarray, List[DetectedScratch], np.ndarray]:
        scratches = self.detect_scratches_multi_scale(frame)
        combined_mask = self._combine_scratch_masks(scratches, frame.shape[:2])
        restored = self.inpaint_scratches(frame, combined_mask)
        return restored, scratches, combined_mask

    def detect_scratches_multi_scale(self, frame: np.ndarray) -> List[DetectedScratch]:
        all_scratches = []
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        for level in range(self.detection_params.multi_scale_levels):
            scale = 1.0 / (2 ** level)
            scaled = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

            level_scratches = self._detect_scratches_single_scale(scaled, scale)

            for scratch in level_scratches:
                x, y, w, h = scratch.bounding_box
                scratch.bounding_box = (
                    int(x / scale),
                    int(y / scale),
                    int(w / scale),
                    int(h / scale)
                )
                scratch.length /= scale
                scratch.width /= scale

            all_scratches.extend(level_scratches)

        return self._merge_overlapping_scratches(all_scratches)

    def _detect_scratches_single_scale(self, gray: np.ndarray, scale: float) -> List[DetectedScratch]:
        scratches = []
        p = self.detection_params

        edge_mask = self._edge_based_detection(gray)

        if p.enable_directional_detection:
            vert_mask = self._directional_detection(gray, direction='vertical')
            horz_mask = self._directional_detection(gray, direction='horizontal')
            combined_mask = cv2.bitwise_or(edge_mask, vert_mask)
            combined_mask = cv2.bitwise_or(combined_mask, horz_mask)
        else:
            combined_mask = edge_mask

        if p.enable_hough_transform:
            hough_scratches = self._hough_line_detection(gray, scale)
            scratches.extend(hough_scratches)

        contour_scratches = self._contour_based_detection(combined_mask, gray, scale)
        scratches.extend(contour_scratches)

        dot_scratches = self._detect_dots(gray, scale)
        scratches.extend(dot_scratches)

        return scratches

    def _edge_based_detection(self, gray: np.ndarray) -> np.ndarray:
        p = self.detection_params

        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)

        mag = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
        mag = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

        threshold = int(p.edge_threshold * (1 - p.sensitivity * 0.5))
        _, edge_mask = cv2.threshold(mag, threshold, 255, cv2.THRESH_BINARY)

        return edge_mask

    def _directional_detection(self, gray: np.ndarray, direction: str = 'vertical') -> np.ndarray:
        p = self.detection_params
        threshold = int(p.edge_threshold * (1 - p.sensitivity * 0.5))

        if direction == 'vertical':
            kernel = np.array([
                [-1, 2, -1],
                [-1, 2, -1],
                [-1, 2, -1]
            ], dtype=np.float32)
        else:
            kernel = np.array([
                [-1, -1, -1],
                [2, 2, 2],
                [-1, -1, -1]
            ], dtype=np.float32)

        filtered = cv2.filter2D(gray, cv2.CV_8U, kernel)
        _, mask = cv2.threshold(filtered, threshold, 255, cv2.THRESH_BINARY)

        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 3) if direction == 'vertical' else (3, 1))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)

        return mask

    def _hough_line_detection(self, gray: np.ndarray, scale: float) -> List[DetectedScratch]:
        scratches = []
        p = self.detection_params

        edges = cv2.Canny(gray, p.edge_threshold, p.edge_threshold * 2)

        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=int(50 * (1 - p.sensitivity + 0.5)),
            minLineLength=int(p.min_length * scale),
            maxLineGap=10
        )

        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                length = np.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

                if length < p.min_length:
                    continue

                orientation = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi

                if abs(orientation) > 45:
                    scratch_type = ScratchType.LINEAR_VERTICAL
                else:
                    scratch_type = ScratchType.LINEAR_HORIZONTAL

                mask = np.zeros(gray.shape, dtype=np.uint8)
                cv2.line(mask, (x1, y1), (x2, y2), 255, int(p.max_width * scale / 2))

                x, y = min(x1, x2), min(y1, y2)
                w, h = abs(x2 - x1) + p.max_width, abs(y2 - y1) + p.max_width

                confidence = min(1.0, length / 100.0) * (0.7 + 0.3 * p.sensitivity)

                scratches.append(DetectedScratch(
                    scratch_type=scratch_type,
                    mask=mask,
                    bounding_box=(x, y, w, h),
                    length=length,
                    width=float(p.max_width * scale),
                    confidence=confidence,
                    orientation=orientation
                ))

        return scratches

    def _contour_based_detection(self, mask: np.ndarray, gray: np.ndarray, scale: float) -> List[DetectedScratch]:
        scratches = []
        p = self.detection_params

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            if len(contour) < 2:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            length = max(w, h)

            if length < p.min_length * scale:
                continue

            aspect_ratio = float(w) / h if h > 0 else 0
            area = cv2.contourArea(contour)

            if aspect_ratio > 5 or aspect_ratio < 0.2:
                if aspect_ratio > 1:
                    scratch_type = ScratchType.LINEAR_HORIZONTAL
                else:
                    scratch_type = ScratchType.LINEAR_VERTICAL

                scratch_mask = np.zeros(gray.shape, dtype=np.uint8)
                cv2.drawContours(scratch_mask, [contour], 0, 255, -1)

                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
                scratch_mask = cv2.dilate(scratch_mask, kernel)

                confidence = min(1.0, length / 50.0) * min(1.0, area / (w * h))

                scratches.append(DetectedScratch(
                    scratch_type=scratch_type,
                    mask=scratch_mask,
                    bounding_box=(x, y, w, h),
                    length=length,
                    width=min(w, h),
                    confidence=confidence,
                    orientation=0.0 if aspect_ratio > 1 else 90.0
                ))

        return scratches

    def _detect_dots(self, gray: np.ndarray, scale: float) -> List[DetectedScratch]:
        scratches = []
        p = self.detection_params

        blurred = cv2.medianBlur(gray, 3)
        diff = cv2.absdiff(gray, blurred)

        threshold = int(30 * (1 - p.sensitivity * 0.5))
        _, dot_mask = cv2.threshold(diff, threshold, 255, cv2.THRESH_BINARY)

        contours, _ = cv2.findContours(dot_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = cv2.contourArea(contour)

            if area < 2 or max(w, h) > 15:
                continue

            scratch_mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.drawContours(scratch_mask, [contour], 0, 255, -1)

            scratches.append(DetectedScratch(
                scratch_type=ScratchType.DOT,
                mask=scratch_mask,
                bounding_box=(x, y, w, h),
                length=max(w, h),
                width=min(w, h),
                confidence=0.7 * p.sensitivity,
                orientation=0.0
            ))

        return scratches

    def _merge_overlapping_scratches(self, scratches: List[DetectedScratch]) -> List[DetectedScratch]:
        if not scratches:
            return []

        scratches = sorted(scratches, key=lambda s: s.confidence, reverse=True)

        merged = []
        used = [False] * len(scratches)

        for i, scratch in enumerate(scratches):
            if used[i]:
                continue

            current_group = [scratch]
            used[i] = True

            x1, y1, w1, h1 = scratch.bounding_box
            rx1, ry1, rx2, ry2 = x1, y1, x1 + w1, y1 + h1

            for j, other in enumerate(scratches[i + 1:], i + 1):
                if used[j]:
                    continue

                x2, y2, w2, h2 = other.bounding_box
                ox1, oy1, ox2, oy2 = x2, y2, x2 + w2, y2 + h2

                if (rx1 <= ox2 and rx2 >= ox1 and ry1 <= oy2 and ry2 >= oy1):
                    current_group.append(other)
                    used[j] = True

                    rx1 = min(rx1, ox1)
                    ry1 = min(ry1, oy1)
                    rx2 = max(rx2, ox2)
                    ry2 = max(ry2, oy2)

            if len(current_group) == 1:
                merged.append(current_group[0])
            else:
                combined_mask = np.zeros_like(scratches[0].mask)
                for s in current_group:
                    combined_mask = cv2.bitwise_or(combined_mask, s.mask)

                max_confidence = max(s.confidence for s in current_group)

                merged.append(DetectedScratch(
                    scratch_type=current_group[0].scratch_type,
                    mask=combined_mask,
                    bounding_box=(rx1, ry1, rx2 - rx1, ry2 - ry1),
                    length=max(s.length for s in current_group),
                    width=max(s.width for s in current_group),
                    confidence=max_confidence,
                    orientation=current_group[0].orientation
                ))

        return merged

    def _combine_scratch_masks(self, scratches: List[DetectedScratch], shape: Tuple[int, int]) -> np.ndarray:
        combined = np.zeros(shape, dtype=np.uint8)

        for scratch in scratches:
            if scratch.confidence > 0.3:
                mask = scratch.mask
                if mask.shape != shape:
                    mask = cv2.resize(mask, (shape[1], shape[0]), interpolation=cv2.INTER_NEAREST)
                combined = cv2.bitwise_or(combined, mask)

        return combined

    def inpaint_scratches(self, frame: np.ndarray, mask: np.ndarray) -> np.ndarray:
        p = self.inpainting_params

        if np.count_nonzero(mask) == 0:
            return frame.copy()

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (p.radius, p.radius))
        dilated_mask = cv2.dilate(mask, kernel)

        if p.method == 'telea':
            inpaint_method = cv2.INPAINT_TELEA
        else:
            inpaint_method = cv2.INPAINT_NS

        result = frame.copy()
        for _ in range(p.iterations):
            result = cv2.inpaint(result, dilated_mask, p.radius, inpaint_method)

        if p.preserve_edges:
            result = self._edge_aware_blend(frame, result, dilated_mask)

        if p.blend_strength < 1.0:
            result = cv2.addWeighted(frame, 1 - p.blend_strength, result, p.blend_strength, 0)

        return result

    def _edge_aware_blend(self, original: np.ndarray, inpainted: np.ndarray, mask: np.ndarray) -> np.ndarray:
        result = inpainted.copy()

        gray = cv2.cvtColor(original, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)

        edge_mask = cv2.bitwise_and(mask, edges)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        edge_region = cv2.dilate(edge_mask, kernel)

        edge_region_float = edge_region.astype(np.float32) / 255.0
        for i in range(3):
            result[:, :, i] = (original[:, :, i].astype(np.float32) * (1 - edge_region_float) +
                               inpainted[:, :, i].astype(np.float32) * edge_region_float).astype(np.uint8)

        return result

    def estimate_scratch_severity(self, scratches: List[DetectedScratch], frame_shape: Tuple[int, int]) -> dict:
        if not scratches:
            return {"severity": "none", "count": 0, "coverage": 0.0}

        total_area = sum(np.count_nonzero(s.mask) for s in scratches)
        frame_area = frame_shape[0] * frame_shape[1]
        coverage = (total_area / frame_area) * 100

        if coverage < 0.1:
            severity = "minor"
        elif coverage < 1.0:
            severity = "moderate"
        elif coverage < 5.0:
            severity = "significant"
        else:
            severity = "severe"

        return {
            "severity": severity,
            "count": len(scratches),
            "coverage": coverage,
            "avg_confidence": sum(s.confidence for s in scratches) / len(scratches)
        }

    def create_preview_mask(self, frame: np.ndarray, scratches: List[DetectedScratch]) -> np.ndarray:
        preview = frame.copy()

        color_map = {
            ScratchType.LINEAR_VERTICAL: (0, 0, 255),
            ScratchType.LINEAR_HORIZONTAL: (0, 255, 0),
            ScratchType.CURL: (255, 0, 255),
            ScratchType.DOT: (255, 255, 0),
            ScratchType.HAIR: (255, 0, 0),
            ScratchType.UNKNOWN: (128, 128, 128)
        }

        for scratch in scratches:
            color = color_map.get(scratch.scratch_type, (128, 128, 128))

            mask = scratch.mask
            if mask.shape[:2] != frame.shape[:2]:
                mask = cv2.resize(mask, (frame.shape[1], frame.shape[0]), interpolation=cv2.INTER_NEAREST)

            colored_mask = np.zeros_like(frame)
            colored_mask[mask > 0] = color
            preview = cv2.addWeighted(preview, 1, colored_mask, 0.5, 0)

            x, y, w, h = scratch.bounding_box
            cv2.rectangle(preview, (x, y), (x + w, y + h), color, 1)
            cv2.putText(preview, f"{scratch.confidence:.2f}", (x, y - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        return preview
