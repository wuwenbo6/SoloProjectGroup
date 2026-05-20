import cv2
import numpy as np
from skimage import filters, morphology, measure, restoration
from scipy import ndimage as ndi
from typing import Dict, List, Tuple


class FiberSegmentation:
    def __init__(self):
        self.min_fiber_area = 20
        self.max_fiber_area = 15000

    def preprocess(self, image: np.ndarray) -> np.ndarray:
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image.copy()
        
        denoised = cv2.fastNlMeansDenoising(gray, None, h=3, templateWindowSize=7, searchWindowSize=21)
        
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(enhanced, -1, kernel)
        
        blurred = cv2.bilateralFilter(sharpened, d=5, sigmaColor=50, sigmaSpace=50)
        return blurred

    def segment(self, image: np.ndarray) -> Dict:
        preprocessed = self.preprocess(image)
        
        threshold_otsu = filters.threshold_otsu(preprocessed)
        threshold_local = filters.threshold_local(preprocessed, block_size=35, method='gaussian')
        binary_otsu = preprocessed < threshold_otsu
        binary_local = preprocessed < threshold_local
        binary = np.logical_or(binary_otsu, binary_local)
        
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        closed = cv2.morphologyEx(binary.astype(np.uint8), cv2.MORPH_CLOSE, kernel_close)
        opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_close)
        
        cleaned = morphology.remove_small_objects(opened.astype(bool), min_size=self.min_fiber_area)
        cleaned = morphology.remove_small_holes(cleaned, area_threshold=100)
        
        skeleton = morphology.skeletonize(cleaned)
        
        distance = ndi.distance_transform_edt(cleaned)
        
        labeled = measure.label(cleaned)
        regions = measure.regionprops(labeled)
        
        fibers = []
        for region in regions:
            if self.min_fiber_area <= region.area <= self.max_fiber_area:
                fiber_info = self._analyze_fiber(region, skeleton)
                fibers.append(fiber_info)
        
        fiber_count = len(fibers)
        total_area = sum(f['area'] for f in fibers) if fibers else 0
        avg_length = np.mean([f['length'] for f in fibers]) if fibers else 0
        avg_width = np.mean([f['width'] for f in fibers]) if fibers else 0
        
        orientation_distribution = self._calculate_orientation_distribution(fibers)
        
        return {
            'fiber_count': fiber_count,
            'total_fiber_area': int(total_area),
            'average_length': float(avg_length),
            'average_width': float(avg_width),
            'fiber_density': float(total_area / (image.shape[0] * image.shape[1]) if total_area > 0 else 0),
            'orientation_distribution': orientation_distribution,
            'fibers': fibers[:100]
        }

    def _analyze_fiber(self, region, skeleton: np.ndarray) -> Dict:
        minr, minc, maxr, maxc = region.bbox
        fiber_skeleton = skeleton[minr:maxr, minc:maxc]
        
        length = np.sum(fiber_skeleton)
        width = region.major_axis_length
        thickness = region.minor_axis_length
        
        orientation = region.orientation * 180 / np.pi
        if orientation < 0:
            orientation += 180
        
        eccentricity = region.eccentricity
        solidity = region.solidity
        
        return {
            'area': int(region.area),
            'centroid': [float(region.centroid[0]), float(region.centroid[1])],
            'length': float(length),
            'width': float(width),
            'thickness': float(thickness),
            'orientation': float(orientation),
            'eccentricity': float(eccentricity),
            'solidity': float(solidity),
            'bbox': [int(minr), int(minc), int(maxr), int(maxc)]
        }

    def _calculate_orientation_distribution(self, fibers: List[Dict]) -> Dict[str, int]:
        bins = {
            '0-30°': 0,
            '30-60°': 0,
            '60-90°': 0,
            '90-120°': 0,
            '120-150°': 0,
            '150-180°': 0
        }
        
        for fiber in fibers:
            orientation = fiber['orientation']
            if 0 <= orientation < 30:
                bins['0-30°'] += 1
            elif 30 <= orientation < 60:
                bins['30-60°'] += 1
            elif 60 <= orientation < 90:
                bins['60-90°'] += 1
            elif 90 <= orientation < 120:
                bins['90-120°'] += 1
            elif 120 <= orientation < 150:
                bins['120-150°'] += 1
            else:
                bins['150-180°'] += 1
        
        return bins

    def detect_breakages(self, image: np.ndarray, segmentation_result: Dict) -> List[Dict]:
        preprocessed = self.preprocess(image)
        
        edges = cv2.Canny(preprocessed, 50, 150)
        
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=50, 
                                minLineLength=20, maxLineGap=10)
        
        breakages = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                angle = np.arctan2(y2-y1, x2-x1) * 180 / np.pi
                
                breakages.append({
                    'start_point': [int(x1), int(y1)],
                    'end_point': [int(x2), int(y2)],
                    'length': float(length),
                    'angle': float(angle)
                })
        
        return breakages
