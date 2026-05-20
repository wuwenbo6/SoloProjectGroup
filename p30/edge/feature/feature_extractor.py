import numpy as np
import cv2
from typing import List, Dict, Tuple
from dataclasses import dataclass
from enum import Enum


class FeatureType(Enum):
    COLOR = "color"
    TEXTURE = "texture"
    SHAPE = "shape"
    EDGE = "edge"
    SPECTRAL = "spectral"


@dataclass
class FeatureVector:
    feature_id: str
    data_id: str
    feature_type: FeatureType
    vector: np.ndarray
    timestamp: float
    scale: float = 1.0


class MultiScaleImageFeatureExtractor:
    def __init__(self):
        self.color_bins = 48
        self.lbp_radii = [1, 2, 3]
        self.lbp_points = [8, 16, 24]
        self.scales = [0.5, 1.0, 1.5]
        self.gabor_kernels = self._build_gabor_kernels()

    def _build_gabor_kernels(self) -> List:
        kernels = []
        for theta in range(4):
            theta = theta / 4.0 * np.pi
            for sigma in (1, 3):
                for lamda in (np.pi / 4, np.pi / 2):
                    kernel = cv2.getGaborKernel((21, 21), sigma, theta, lamda, 0.5, 0, ktype=cv2.CV_32F)
                    kernels.append(kernel)
        return kernels

    def extract_multi_color_histogram(self, image: np.ndarray) -> np.ndarray:
        histograms = []
        
        rgb_bins = [16, 16, 16]
        for channel in range(3):
            hist = cv2.calcHist([image], [channel], None, [rgb_bins[channel]], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            histograms.append(hist)
        
        hsv = cv2.cvtColor(image, cv2.COLOR_RGB2HSV)
        hsv_bins = [18, 16, 16]
        for channel in range(3):
            hist = cv2.calcHist([hsv], [channel], None, [hsv_bins[channel]], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            histograms.append(hist)
        
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        for channel in range(3):
            hist = cv2.calcHist([lab], [channel], None, [16], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            histograms.append(hist)
        
        ycrcb = cv2.cvtColor(image, cv2.COLOR_RGB2YCrCb)
        for channel in range(3):
            hist = cv2.calcHist([ycrcb], [channel], None, [16], [0, 256])
            hist = cv2.normalize(hist, hist).flatten()
            histograms.append(hist)
        
        return np.concatenate(histograms)

    def extract_multi_scale_lbp(self, gray: np.ndarray) -> np.ndarray:
        all_lbp = []
        
        for radius, n_points in zip(self.lbp_radii, self.lbp_points):
            lbp = np.zeros_like(gray)
            for y in range(radius, gray.shape[0] - radius):
                for x in range(radius, gray.shape[1] - radius):
                    center = gray[y, x]
                    code = 0
                    for i in range(n_points):
                        theta = 2 * np.pi * i / n_points
                        rx = int(x + radius * np.cos(theta))
                        ry = int(y + radius * np.sin(theta))
                        if gray[ry, rx] >= center:
                            code |= 1 << i
                    lbp[y, x] = code
            
            hist, _ = np.histogram(lbp, bins=min(2**n_points, 64), range=(0, 2**n_points))
            hist = hist.astype(np.float32) / hist.sum()
            all_lbp.append(hist)
        
        return np.concatenate(all_lbp)

    def extract_gabor_features(self, gray: np.ndarray) -> np.ndarray:
        features = []
        for kernel in self.gabor_kernels:
            filtered = cv2.filter2D(gray, cv2.CV_8UC3, kernel)
            mean = np.mean(filtered)
            var = np.var(filtered)
            features.extend([mean, var])
        
        return np.array(features, dtype=np.float32)

    def extract_edge_features(self, gray: np.ndarray) -> np.ndarray:
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / edges.size
        
        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        sobel_mag = np.sqrt(sobel_x**2 + sobel_y**2)
        
        sobel_hist, _ = np.histogram(sobel_mag, bins=16, range=(0, 255))
        sobel_hist = sobel_hist.astype(np.float32) / sobel_hist.sum()
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian_var = np.var(laplacian)
        
        return np.concatenate([
            np.array([edge_density, laplacian_var]),
            sobel_hist
        ])

    def extract_shape_features(self, image: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        features = []
        for thresh in [80, 127, 170]:
            _, binary = cv2.threshold(gray, thresh, 255, cv2.THRESH_BINARY)
            contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                areas = [cv2.contourArea(c) for c in contours]
                perimeters = [cv2.arcLength(c, True) for c in contours]
                
                if len(areas) > 0:
                    features.extend([
                        np.mean(areas),
                        np.sum(areas),
                        len(contours),
                        np.max(areas) if areas else 0,
                        np.min(areas) if areas else 0,
                        np.mean(perimeters) if perimeters else 0
                    ])
                else:
                    features.extend([0, 0, 0, 0, 0, 0])
            else:
                features.extend([0, 0, 0, 0, 0, 0])
        
        return np.array(features, dtype=np.float32)

    def extract_local_contrast_features(self, gray: np.ndarray) -> np.ndarray:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        local_stats = []
        for size in [5, 11, 17]:
            kernel = np.ones((size, size), np.uint8)
            local_mean = cv2.blur(enhanced, (size, size))
            local_var = cv2.blur(enhanced**2, (size, size)) - local_mean**2
            
            local_stats.extend([
                np.mean(local_mean),
                np.mean(local_var),
                np.max(local_var),
                np.min(local_var)
            ])
        
        return np.array(local_stats, dtype=np.float32)

    def extract_pyramid_features(self, image: np.ndarray) -> List[FeatureVector]:
        features = []
        
        for scale in self.scales:
            if scale != 1.0:
                scaled = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            else:
                scaled = image.copy()
            
            gray = cv2.cvtColor(scaled, cv2.COLOR_RGB2GRAY)
            
            color_feat = self.extract_multi_color_histogram(scaled)
            lbp_feat = self.extract_multi_scale_lbp(gray)
            gabor_feat = self.extract_gabor_features(gray)
            edge_feat = self.extract_edge_features(gray)
            shape_feat = self.extract_shape_features(scaled)
            contrast_feat = self.extract_local_contrast_features(gray)
            
            combined = np.concatenate([
                color_feat,
                lbp_feat,
                gabor_feat,
                edge_feat,
                shape_feat,
                contrast_feat
            ])
            
            features.append(FeatureVector(
                feature_id=f"pyr_{int(scale*100)}",
                data_id="",
                feature_type=FeatureType.TEXTURE,
                vector=combined.astype(np.float16),
                timestamp=np.datetime64('now').astype(float),
                scale=scale
            ))
        
        return features

    def extract_all(self, image: np.ndarray, data_id: str) -> List[FeatureVector]:
        features = self.extract_pyramid_features(image)
        
        for f in features:
            f.data_id = data_id
            f.feature_id = f"{data_id}_{f.feature_id}"
        
        return features


class AudioFeatureExtractor:
    def __init__(self, sample_rate=44100):
        self.sample_rate = sample_rate
        self.n_mfcc = 20
        self.mel_filters = self._build_mel_filterbank()

    def _build_mel_filterbank(self, n_filters=40, n_fft=2048):
        m_min = 0
        m_max = 2595 * np.log10(1 + (self.sample_rate / 2) / 700)
        m_pts = np.linspace(m_min, m_max, n_filters + 2)
        h_pts = 700 * (10 ** (m_pts / 2595) - 1)
        
        bins = np.floor((n_fft - 1) * 2 * h_pts / self.sample_rate).astype(int)
        
        filters = np.zeros((n_filters, n_fft // 2 + 1))
        for m in range(1, n_filters + 1):
            left = bins[m - 1]
            center = bins[m]
            right = bins[m + 1]
            
            for f in range(left, center):
                filters[m - 1, f] = (f - left) / (center - left)
            for f in range(center, right):
                filters[m - 1, f] = (right - f) / (right - center)
        
        return filters

    def extract_mfcc(self, audio: np.ndarray, n_fft=512, hop_length=128) -> np.ndarray:
        n_frames = 1 + max(0, (len(audio) - n_fft) // hop_length)
        if n_frames <= 0:
            return np.zeros(self.n_mfcc)
            
        mfccs = []
        
        for i in range(n_frames):
            start = i * hop_length
            end = min(start + n_fft, len(audio))
            frame = np.zeros(n_fft)
            frame[:end - start] = audio[start:end] * np.hanning(end - start)
            
            spectrum = np.abs(np.fft.rfft(frame)) ** 2
            
            mel_spectrum = np.dot(spectrum, self.mel_filters.T)
            mel_spectrum = np.log(mel_spectrum + 1e-10)
            
            dct = np.zeros(self.n_mfcc)
            for k in range(self.n_mfcc):
                for n in range(len(mel_spectrum)):
                    dct[k] += mel_spectrum[n] * np.cos(np.pi * k * (2 * n + 1) / (2 * len(mel_spectrum)))
            mfccs.append(dct)
        
        if mfccs:
            return np.mean(mfccs, axis=0)
        return np.zeros(self.n_mfcc)

    def extract_spectral_features(self, audio: np.ndarray) -> np.ndarray:
        spectrum = np.abs(np.fft.rfft(audio))
        spec_centroid = np.sum(np.arange(len(spectrum)) * spectrum) / (np.sum(spectrum) + 1e-10)
        
        threshold = np.max(spectrum) * 0.5
        above_thresh = np.where(spectrum > threshold)[0]
        spec_bandwidth = above_thresh[-1] - above_thresh[0] if len(above_thresh) > 0 else 0
        
        cumulative = np.cumsum(spectrum)
        rolloff_idx = np.where(cumulative >= cumulative[-1] * 0.85)[0]
        spec_rolloff = rolloff_idx[0] if len(rolloff_idx) > 0 else 0
        
        zcr = np.sum(np.abs(np.diff(np.signbit(audio)))) / len(audio)
        
        spec_flatness = np.exp(np.mean(np.log(spectrum + 1e-10))) / (np.mean(spectrum) + 1e-10)
        
        spec_crest = np.max(spectrum) / (np.mean(spectrum) + 1e-10)
        
        return np.array([spec_centroid, spec_bandwidth, spec_rolloff, zcr, spec_flatness, spec_crest], dtype=np.float32)

    def extract_temporal_features(self, audio: np.ndarray) -> np.ndarray:
        energy = np.sum(audio ** 2) / len(audio)
        rms = np.sqrt(np.mean(audio ** 2))
        
        zero_crossings = np.sum(np.abs(np.diff(np.signbit(audio))))
        zcr_rate = zero_crossings / len(audio)
        
        envelope = np.abs(audio)
        env_mean = np.mean(envelope)
        env_std = np.std(envelope)
        
        return np.array([energy, rms, zcr_rate, env_mean, env_std], dtype=np.float32)

    def extract_chroma_features(self, audio: np.ndarray) -> np.ndarray:
        spectrum = np.abs(np.fft.rfft(audio))
        chroma = np.zeros(12)
        
        freq_bins = np.fft.rfftfreq(len(audio), 1/self.sample_rate)
        
        for i in range(12):
            min_freq = 27.5 * (2 ** (i / 12))
            max_freq = 27.5 * (2 ** ((i + 1) / 12))
            mask = (freq_bins >= min_freq) & (freq_bins < max_freq)
            if np.any(mask):
                chroma[i] = np.sum(spectrum[mask])
        
        chroma_sum = np.sum(chroma)
        if chroma_sum > 0:
            chroma = chroma / chroma_sum
        
        return chroma.astype(np.float32)

    def extract_all(self, audio: np.ndarray, data_id: str) -> List[FeatureVector]:
        features = []
        
        mfcc_vec = self.extract_mfcc(audio)
        features.append(FeatureVector(
            feature_id=f"{data_id}_mfcc",
            data_id=data_id,
            feature_type=FeatureType.SPECTRAL,
            vector=mfcc_vec.astype(np.float16),
            timestamp=np.datetime64('now').astype(float)
        ))
        
        spec_vec = self.extract_spectral_features(audio)
        features.append(FeatureVector(
            feature_id=f"{data_id}_spectral",
            data_id=data_id,
            feature_type=FeatureType.SPECTRAL,
            vector=spec_vec.astype(np.float16),
            timestamp=np.datetime64('now').astype(float)
        ))
        
        temp_vec = self.extract_temporal_features(audio)
        features.append(FeatureVector(
            feature_id=f"{data_id}_temporal",
            data_id=data_id,
            feature_type=FeatureType.SPECTRAL,
            vector=temp_vec.astype(np.float16),
            timestamp=np.datetime64('now').astype(float)
        ))
        
        chroma_vec = self.extract_chroma_features(audio)
        features.append(FeatureVector(
            feature_id=f"{data_id}_chroma",
            data_id=data_id,
            feature_type=FeatureType.SPECTRAL,
            vector=chroma_vec.astype(np.float16),
            timestamp=np.datetime64('now').astype(float)
        ))
        
        return features
