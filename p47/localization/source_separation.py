import numpy as np
from scipy import signal
from scipy.cluster import hierarchy
from sklearn.decomposition import FastICA
import librosa


class MultiSourceSeparator:
    """多声源分离 - 基于ICA和频谱聚类"""
    
    def __init__(self, n_sources=2, sr=22050, method='ica'):
        self.n_sources = n_sources
        self.sr = sr
        self.method = method
        self.ica = FastICA(n_components=n_sources, random_state=42, max_iter=1000)
    
    def separate_from_multichannel(self, multichannel_signals):
        """
        从多通道信号中分离声源
        
        Args:
            multichannel_signals: shape (n_channels, n_samples)
        
        Returns:
            separated_sources: list of separated source signals
        """
        signals = np.array(multichannel_signals).T
        
        if signals.shape[1] < self.n_sources:
            raise ValueError(f"Need at least {self.n_sources} channels for ICA")
        
        separated = self.ica.fit_transform(signals).T
        
        separated_sources = []
        for i in range(separated.shape[0]):
            src = separated[i]
            src = self._post_process(src)
            separated_sources.append(src)
        
        return separated_sources
    
    def _post_process(self, signal):
        """后处理：归一化和去除直流分量"""
        signal = signal - np.mean(signal)
        signal = signal / (np.max(np.abs(signal)) + 1e-10)
        return signal
    
    def spectral_clustering_separate(self, mixed_signal, n_sources=None):
        """
        基于频谱聚类的单通道声源分离
        
        Args:
            mixed_signal: 1D混合信号
            n_sources: 声源数量
        
        Returns:
            separated_sources: 分离后的声源信号列表
        """
        if n_sources is None:
            n_sources = self.n_sources
        
        n_fft = 1024
        hop_length = 256
        
        stft = librosa.stft(mixed_signal, n_fft=n_fft, hop_length=hop_length)
        mag, phase = librosa.magphase(stft)
        log_mag = librosa.amplitude_to_db(mag)
        
        features = log_mag.T
        clusters = self._spectral_clustering(features, n_sources)
        
        separated_sources = []
        for i in range(n_sources):
            mask = (clusters == i).astype(float)
            mask = mask[:, np.newaxis].T
            mask = np.repeat(mask, mag.shape[0], axis=0)
            
            source_mag = mag * mask
            source_stft = source_mag * phase
            source_signal = librosa.istft(source_stft, hop_length=hop_length)
            
            separated_sources.append(source_signal)
        
        return separated_sources
    
    def _spectral_clustering(self, features, n_clusters):
        """简化的谱聚类实现"""
        n_samples = features.shape[0]
        
        similarity = np.exp(-cdist(features, features, 'euclidean') ** 2 / (2 * 1.0))
        
        d = np.sum(similarity, axis=1)
        D = np.diag(d)
        L = D - similarity
        
        D_inv_sqrt = np.diag(1.0 / np.sqrt(d + 1e-10))
        L_norm = D_inv_sqrt @ L @ D_inv_sqrt
        
        eigvals, eigvecs = np.linalg.eigh(L_norm)
        embeddings = eigvecs[:, :n_clusters]
        
        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embeddings)
        
        return labels
    
    def estimate_tdoa_per_source(self, separated_signals, reference_channel=0):
        """
        估计每个分离声源的TDOA
        
        Args:
            separated_signals: 分离后的声源信号 (n_sources, n_samples)
            reference_channel: 参考通道索引
        
        Returns:
            tdoa_list: 每个声源的TDOA数组 (n_sources, n_channels)
        """
        tdoa_list = []
        
        for src_signal in separated_signals:
            tdoas = self._estimate_single_tdoa(src_signal, reference_channel)
            tdoa_list.append(tdoas)
        
        return np.array(tdoa_list)
    
    def _estimate_single_tdoa(self, source_signal, reference_channel):
        """估计单个声源的TDOA"""
        n_channels = source_signal.shape[0] if len(source_signal.shape) > 1 else 1
        
        if n_channels < 2:
            return np.zeros(n_channels)
        
        tdoas = np.zeros(n_channels)
        
        for i in range(n_channels):
            if i == reference_channel:
                tdoas[i] = 0
                continue
            
            corr = np.correlate(source_signal[reference_channel], source_signal[i], mode='full')
            max_idx = np.argmax(corr)
            delay_samples = max_idx - len(source_signal[i]) + 1
            tdoas[i] = delay_samples / self.sr
        
        return tdoas


class GCCPHAT:
    """GCC-PHAT 时延估计算法"""
    
    def __init__(self, sr=22050, max_delay=None):
        self.sr = sr
        self.max_delay = max_delay
    
    def compute_delay(self, sig1, sig2):
        """计算两个信号之间的时延"""
        n = len(sig1) + len(sig2) - 1
        n_fft = 1 << (n - 1).bit_length()
        
        X1 = np.fft.fft(sig1, n_fft)
        X2 = np.fft.fft(sig2, n_fft)
        
        R = X1 * np.conj(X2)
        R = R / (np.abs(R) + 1e-10)
        
        r = np.fft.ifft(R).real
        
        max_sample = len(sig1) - 1
        min_sample = -len(sig2) + 1
        
        if self.max_delay is not None:
            max_delay_samples = int(self.max_delay * self.sr)
            max_sample = min(max_sample, max_delay_samples)
            min_sample = max(min_sample, -max_delay_samples)
        
        valid_r = r[max(0, len(sig1) - 1 + min_sample):min(len(r), len(sig1) - 1 + max_sample + 1)]
        
        if len(valid_r) == 0:
            return 0
        
        delay_idx = np.argmax(valid_r) - (len(sig1) - 1 - max(0, len(sig1) - 1 + min_sample))
        delay = delay_idx / self.sr
        
        return delay


class MultiSourceLocalizer:
    """多声源定位系统"""
    
    SOUND_SPEED = 343.0
    
    def __init__(self, nodes, n_sources=2, sr=22050):
        self.nodes = np.array(nodes)
        self.n_nodes = len(nodes)
        self.n_sources = n_sources
        self.sr = sr
        self.separator = MultiSourceSeparator(n_sources=n_sources, sr=sr)
        self.gcc_phat = GCCPHAT(sr=sr, max_delay=0.1)
    
    def localize_multisource(self, node_signals):
        """
        多声源主定位流程
        
        Args:
            node_signals: dict {node_id: signal_array}
        
        Returns:
            locations: 声源位置列表
        """
        node_ids = sorted(node_signals.keys())
        signals = [node_signals[nid] for nid in node_ids]
        
        min_len = min(len(s) for s in signals)
        signals = [s[:min_len] for s in signals]
        
        multichannel = np.array(signals)
        
        locations = []
        
        try:
            separated = self.separator.separate_from_multichannel(multichannel)
        except Exception as e:
            print(f"ICA separation failed: {e}")
            separated = self._fallback_separation(multichannel)
        
        for src_idx, source_signal in enumerate(separated):
            try:
                source_loc = self._localize_single_source(source_signal, node_ids)
                source_loc['source_id'] = src_idx
                source_loc['separation_confidence'] = self._compute_separation_confidence(
                    source_signal, multichannel
                )
                locations.append(source_loc)
            except Exception as e:
                print(f"Failed to localize source {src_idx}: {e}")
        
        locations = self._filter_duplicate_locations(locations)
        
        if len(locations) < 2:
            print("Using time-difference based multi-source detection...")
            time_locations = self._time_based_multilocalize(node_signals, node_ids)
            for loc in time_locations:
                loc['separation_confidence'] = 0.5
            locations.extend(time_locations)
            locations = self._filter_duplicate_locations(locations)
        
        return locations
    
    def _fallback_separation(self, multichannel):
        """备用分离方法：基于能量阈值的分段"""
        n_samples = multichannel.shape[1]
        separated = []
        
        energy = np.sum(multichannel ** 2, axis=0)
        threshold = np.mean(energy) + np.std(energy)
        
        high_energy_mask = energy > threshold
        segments = self._split_segments(high_energy_mask)
        
        for i, segment in enumerate(segments[:self.n_sources]):
            source = np.zeros(n_samples)
            start, end = segment
            source[start:end] = np.mean(multichannel[:, start:end], axis=0)
            separated.append(source)
        
        while len(separated) < self.n_sources:
            separated.append(np.zeros(n_samples))
        
        return separated
    
    def _split_segments(self, mask, min_gap=100):
        """分割连续段"""
        segments = []
        in_segment = False
        start = 0
        
        for i, val in enumerate(mask):
            if val and not in_segment:
                start = i
                in_segment = True
            elif not val and in_segment:
                if i - start >= min_gap:
                    segments.append((start, i))
                in_segment = False
        
        if in_segment and len(mask) - start >= min_gap:
            segments.append((start, len(mask)))
        
        return segments
    
    def _localize_single_source(self, source_signal, node_ids):
        """定位单个声源"""
        ref_node = 0
        tdoas = np.zeros(self.n_nodes)
        
        for i in range(self.n_nodes):
            if i == ref_node:
                tdoas[i] = 0
                continue
            
            ref_sig = source_signal
            node_sig = source_signal if i == ref_node else source_signal
            
            tdoas[i] = self.gcc_phat.compute_delay(
                source_signal, 
                np.roll(source_signal, int(tdoas[i] * self.sr))
            )
        
        from localization.tdoa import TDOALocalizer
        localizer = TDOALocalizer(self.nodes)
        result = localizer.localize_from_timestamps(tdoas)
        
        return result
    
    def _time_based_multilocalize(self, node_signals, node_ids, n_peaks=2):
        """
        备用方法：基于互相关峰值检测的多声源定位
        
        通过检测互相关函数中的多个峰值来估计多个声源
        """
        locations = []
        
        ref_idx = 0
        ref_signal = node_signals[node_ids[ref_idx]]
        
        for i in range(1, min(3, len(node_ids))):
            node_signal = node_signals[node_ids[i]]
            
            corr = np.correlate(ref_signal, node_signal, mode='full')
            peak_indices = np.argsort(np.abs(corr))[::-1][:n_peaks]
            
            for peak_idx in peak_indices[:2]:
                delay = (peak_idx - len(ref_signal) + 1) / self.sr
                
                tdoas = np.zeros(len(node_ids))
                tdoas[i] = delay
                
                from localization.tdoa import TDOALocalizer
                localizer = TDOALocalizer(self.nodes)
                result = localizer.localize_from_timestamps(tdoas)
                
                if result.get('error', float('inf')) < 50:
                    locations.append(result)
        
        unique_locations = self._filter_duplicate_locations(locations, threshold=100.0)
        
        return unique_locations[:2]
    
    def _compute_separation_confidence(self, source_signal, multichannel):
        """计算分离置信度"""
        signal_power = np.mean(source_signal ** 2)
        noise_power = np.mean((np.mean(multichannel, axis=0) - source_signal) ** 2)
        
        snr = 10 * np.log10(signal_power / (noise_power + 1e-10) + 1e-10)
        
        confidence = min(1.0, max(0.0, (snr + 10) / 30))
        
        return confidence
    
    def _filter_duplicate_locations(self, locations, threshold=5.0):
        """过滤重复的定位结果"""
        if len(locations) <= 1:
            return locations
        
        filtered = []
        positions = np.array([loc['position'] for loc in locations])
        
        for i, loc in enumerate(locations):
            is_duplicate = False
            for j in range(i):
                dist = np.linalg.norm(positions[i] - positions[j])
                if dist < threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                filtered.append(loc)
        
        return sorted(filtered, key=lambda x: x['error'])


def cdist(XA, XB, metric='euclidean'):
    """简化的距离计算"""
    XA = np.asarray(XA)
    XB = np.asarray(XB)
    
    m, n = XA.shape[0], XB.shape[0]
    dm = np.zeros((m, n))
    
    for i in range(m):
        for j in range(n):
            dm[i, j] = np.sqrt(np.sum((XA[i] - XB[j]) ** 2))
    
    return dm
