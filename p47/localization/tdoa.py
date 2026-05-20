import numpy as np
from scipy.optimize import minimize
from scipy.spatial.distance import cdist
from .source_separation import MultiSourceLocalizer, GCCPHAT


class TDOALocalizer:
    SOUND_SPEED = 343.0
    
    def __init__(self, nodes):
        self.nodes = np.array(nodes)
        self.n_nodes = len(nodes)
    
    def _distance_to_node(self, source_pos, node_idx):
        return np.sqrt(np.sum((source_pos - self.nodes[node_idx])**2))
    
    def _tdoa_error(self, source_pos, tdoa_measurements, reference_idx=0):
        ref_pos = self.nodes[reference_idx]
        ref_dist = np.sqrt(np.sum((source_pos - ref_pos)**2))
        
        error = 0.0
        for i, tdoa in enumerate(tdoa_measurements):
            if i == reference_idx:
                continue
            dist_i = np.sqrt(np.sum((source_pos - self.nodes[i])**2))
            predicted_tdoa = (dist_i - ref_dist) / self.SOUND_SPEED
            error += (predicted_tdoa - tdoa) ** 2
        
        return error
    
    def localize_from_timestamps(self, timestamps):
        if len(timestamps) < 3:
            raise ValueError("At least 3 timestamps are required for localization")
        
        timestamps = np.array(timestamps)
        reference_idx = np.argmin(timestamps)
        ref_time = timestamps[reference_idx]
        
        tdoa_measurements = []
        for i in range(len(timestamps)):
            if i == reference_idx:
                tdoa_measurements.append(0)
            else:
                tdoa_measurements.append(timestamps[i] - ref_time)
        
        return self._localize_optimize(tdoa_measurements, reference_idx)
    
    def _localize_optimize(self, tdoa_measurements, reference_idx):
        centroid = np.mean(self.nodes, axis=0)
        
        bounds = [
            (np.min(self.nodes[:, 0]) - 0.1, np.max(self.nodes[:, 0]) + 0.1),
            (np.min(self.nodes[:, 1]) - 0.1, np.max(self.nodes[:, 1]) + 0.1)
        ]
        
        if self.nodes.shape[1] > 2:
            bounds.append((np.min(self.nodes[:, 2]) - 0.1, np.max(self.nodes[:, 2]) + 0.1))
        
        result = minimize(
            self._tdoa_error,
            centroid,
            args=(tdoa_measurements, reference_idx),
            method='L-BFGS-B',
            bounds=bounds
        )
        
        estimated_pos = result.x
        
        final_error = self._tdoa_error(estimated_pos, tdoa_measurements, reference_idx)
        
        return {
            'position': estimated_pos.tolist(),
            'error': final_error,
            'success': result.success
        }
    
    def localize_circle_intersection(self, timestamps):
        if len(timestamps) < 3:
            raise ValueError("At least 3 timestamps are required")
        
        timestamps = np.array(timestamps)
        reference_idx = np.argmin(timestamps)
        ref_time = timestamps[reference_idx]
        
        differences = timestamps - ref_time
        distances = differences * self.SOUND_SPEED
        
        positions = []
        for i in range(len(timestamps)):
            if i == reference_idx:
                continue
            for j in range(i + 1, len(timestamps)):
                if j == reference_idx:
                    continue
                pos = self._two_circle_intersection(
                    reference_idx, i, j,
                    distances[i], distances[j]
                )
                if pos is not None:
                    positions.append(pos)
        
        if len(positions) == 0:
            centroid = np.mean(self.nodes, axis=0)
            return {'position': centroid.tolist(), 'error': float('inf'), 'success': False}
        
        positions = np.array(positions)
        best_pos = np.mean(positions, axis=0)
        
        return {
            'position': best_pos.tolist(),
            'error': np.var(positions, axis=0).sum(),
            'success': True
        }
    
    def _two_circle_intersection(self, ref_idx, idx1, idx2, d1, d2):
        ref_pos = self.nodes[ref_idx]
        pos1 = self.nodes[idx1]
        pos2 = self.nodes[idx2]
        
        d_ref1 = np.sqrt(np.sum((pos1 - ref_pos) ** 2))
        d_ref2 = np.sqrt(np.sum((pos2 - ref_pos) ** 2))
        
        r1 = d1 + 1e-6
        r2 = d2 + 1e-6
        
        dx, dy = pos1[0] - ref_pos[0], pos1[1] - ref_pos[1]
        d = np.sqrt(dx*dx + dy*dy)
        
        if d > r1 + 100 or d < abs(r1 - 100):
            a = (r1*r1 - 10000) / (2 * d + 1e-6)
        else:
            a = (r1*r1 - 10000 + d*d) / (2 * d + 1e-6)
        
        h = np.sqrt(max(0, r1*r1 - a*a))
        xm = ref_pos[0] + a * dx / (d + 1e-6)
        ym = ref_pos[1] + a * dy / (d + 1e-6)
        
        xs1 = xm + h * dy / (d + 1e-6)
        ys1 = ym - h * dx / (d + 1e-6)
        
        dist_to_p2_1 = np.sqrt((xs1 - pos2[0])**2 + (ys1 - pos2[1])**2)
        error1 = abs(dist_to_p2_1 - r2)
        
        xs2 = xm - h * dy / (d + 1e-6)
        ys2 = ym + h * dx / (d + 1e-6)
        
        dist_to_p2_2 = np.sqrt((xs2 - pos2[0])**2 + (ys2 - pos2[1])**2)
        error2 = abs(dist_to_p2_2 - r2)
        
        if error1 < error2:
            return [xs1, ys1]
        else:
            return [xs2, ys2]


class MicrophoneNetwork:
    def __init__(self):
        self.nodes = {}
        self.gcc_phat = GCCPHAT(sr=22050, max_delay=0.1)
    
    def add_node(self, node_id, lat, lng, height=0.0):
        x, y = self._latlng_to_xy(lat, lng)
        self.nodes[node_id] = {
            'lat': lat,
            'lng': lng,
            'x': x,
            'y': y,
            'z': height
        }
    
    def _latlng_to_xy(self, lat, lng):
        earth_radius = 6371000.0
        lat_rad = np.radians(lat)
        lng_rad = np.radians(lng)
        
        x = earth_radius * lng_rad * np.cos(np.radians(35))
        y = earth_radius * lat_rad
        
        return x, y
    
    def _xy_to_latlng(self, x, y):
        earth_radius = 6371000.0
        lat = np.degrees(y / earth_radius)
        lng = np.degrees(x / (earth_radius * np.cos(np.radians(35))))
        
        return lat, lng
    
    def get_node_positions_xy(self):
        positions = []
        for node_id in sorted(self.nodes.keys()):
            node = self.nodes[node_id]
            positions.append([node['x'], node['y']])
        return positions
    
    def localize_event(self, detections):
        if len(detections) < 3:
            return None
        
        node_ids = sorted(detections.keys())
        timestamps = [detections[nid]['timestamp'] for nid in node_ids]
        
        positions_xy = []
        for nid in node_ids:
            node = self.nodes[nid]
            positions_xy.append([node['x'], node['y']])
        
        localizer = TDOALocalizer(positions_xy)
        result = localizer.localize_from_timestamps(timestamps)
        
        if result['success']:
            x, y = result['position']
            lat, lng = self._xy_to_latlng(x, y)
            result['lat'] = lat
            result['lng'] = lng
        else:
            centroid_lat = np.mean([self.nodes[nid]['lat'] for nid in node_ids])
            centroid_lng = np.mean([self.nodes[nid]['lng'] for nid in node_ids])
            result['lat'] = centroid_lat
            result['lng'] = centroid_lng
        
        return result
    
    def localize_multisource_event(self, detections_with_signals, max_sources=3):
        """
        多声源定位：先分离声源再分别定位
        
        Args:
            detections_with_signals: dict {node_id: {'signal': np.array, 'timestamp': float}}
            max_sources: 最大声源数量
        
        Returns:
            locations: 声源位置列表
        """
        if len(detections_with_signals) < 3:
            return []
        
        node_ids = sorted(detections_with_signals.keys())
        
        signals = {}
        for node_id in node_ids:
            signals[node_id] = detections_with_signals[node_id]['signal']
        
        positions_xy = []
        for node_id in node_ids:
            node = self.nodes[node_id]
            positions_xy.append([node['x'], node['y']])
        
        estimated_sources = self._estimate_number_of_sources(signals)
        n_sources = min(max(1, estimated_sources), max_sources)
        
        if n_sources == 1:
            result = self.localize_event(detections_with_signals)
            return [result] if result else []
        
        try:
            multisource_localizer = MultiSourceLocalizer(
                nodes=positions_xy,
                n_sources=n_sources,
                sr=22050
            )
            
            locations = multisource_localizer.localize_multisource(signals)
            
            for loc in locations:
                x, y = loc['position']
                lat, lng = self._xy_to_latlng(x, y)
                loc['lat'] = lat
                loc['lng'] = lng
            
            return locations
            
        except Exception as e:
            print(f"Multi-source localization failed: {e}")
            
            result = self.localize_event(detections_with_signals)
            return [result] if result else []
    
    def _estimate_number_of_sources(self, signals, energy_threshold=0.85):
        """
        估计声源数量：基于特征值分析和能量阈值
        
        Args:
            signals: dict of node signals
            energy_threshold: 累计能量阈值 (0-1)
        
        Returns:
            n_sources: estimated number of sources
        """
        try:
            node_ids = list(signals.keys())
            n_nodes = len(node_ids)
            
            if n_nodes < 3:
                return 1
            
            min_len = min(len(signals[nid]) for nid in node_ids)
            signal_matrix = np.array([signals[nid][:min_len] for nid in node_ids])
            
            cov_matrix = np.cov(signal_matrix)
            
            eigvals = np.linalg.eigvalsh(cov_matrix)
            eigvals = np.sort(eigvals)[::-1]
            
            eigvals = np.maximum(eigvals, 1e-10)
            
            total_energy = np.sum(eigvals)
            cumulative_ratio = np.cumsum(eigvals) / total_energy
            
            n_sources = np.argmax(cumulative_ratio > energy_threshold) + 1
            
            max_possible = min(n_nodes - 1, 3)
            n_sources = max(1, min(n_sources, max_possible))
            
            return n_sources
            
        except Exception as e:
            print(f"Source number estimation failed: {e}")
            return 2
