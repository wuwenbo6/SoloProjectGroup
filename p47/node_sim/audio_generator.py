import numpy as np
import soundfile as sf
import os


class PestSoundGenerator:
    PEST_PARAMS = {
        'locust': {
            'base_freq': 1500,
            'freq_range': 500,
            'pulse_rate': 8,
            'pulse_duration': 0.08,
            'amplitude': 0.6
        },
        'cotton_bollworm': {
            'base_freq': 1200,
            'freq_range': 400,
            'pulse_rate': 5,
            'pulse_duration': 0.1,
            'amplitude': 0.5
        },
        'aphid': {
            'base_freq': 3000,
            'freq_range': 800,
            'pulse_rate': 15,
            'pulse_duration': 0.04,
            'amplitude': 0.3
        },
        'whitefly': {
            'base_freq': 4500,
            'freq_range': 1000,
            'pulse_rate': 20,
            'pulse_duration': 0.03,
            'amplitude': 0.25
        }
    }
    
    def __init__(self, sr=22050):
        self.sr = sr
    
    def generate_pest_sound(self, pest_type, duration=3.0, add_noise=True):
        if pest_type not in self.PEST_PARAMS:
            raise ValueError(f"Unknown pest type: {pest_type}")
        
        params = self.PEST_PARAMS[pest_type]
        t = np.linspace(0, duration, int(self.sr * duration), endpoint=False)
        
        signal = np.zeros_like(t)
        
        pulse_period = 1.0 / params['pulse_rate']
        n_pulses = int(duration / pulse_period)
        
        for i in range(n_pulses):
            pulse_start = i * pulse_period
            pulse_end = pulse_start + params['pulse_duration']
            
            start_idx = int(pulse_start * self.sr)
            end_idx = int(pulse_end * self.sr)
            
            if end_idx > len(t):
                break
            
            freq_variation = np.random.uniform(-params['freq_range']/2, params['freq_range']/2)
            current_freq = params['base_freq'] + freq_variation
            
            pulse_t = t[start_idx:end_idx] - pulse_start
            envelope = np.sin(np.pi * pulse_t / params['pulse_duration']) ** 2
            pulse = envelope * np.sin(2 * np.pi * current_freq * pulse_t)
            
            signal[start_idx:end_idx] += pulse * params['amplitude']
        
        if add_noise:
            noise_amp = np.random.uniform(0.02, 0.08)
            signal += np.random.normal(0, noise_amp, size=len(signal))
        
        signal = signal / (np.max(np.abs(signal)) + 1e-10)
        
        return signal
    
    def generate_ambient_noise(self, duration=3.0, noise_type='field'):
        t = np.linspace(0, duration, int(self.sr * duration), endpoint=False)
        
        if noise_type == 'field':
            noise = np.random.normal(0, 0.05, size=len(t))
            for freq in [50, 100, 200]:
                noise += 0.02 * np.sin(2 * np.pi * freq * t)
        else:
            noise = np.random.normal(0, 0.03, size=len(t))
        
        return noise
    
    def simulate_propagation(self, signal, distance, sr=22050):
        SOUND_SPEED = 343.0
        
        delay = distance / SOUND_SPEED
        delay_samples = int(delay * sr)
        
        attenuation = 1.0 / (1.0 + distance * 0.01)
        
        delayed_signal = np.zeros(len(signal) + delay_samples)
        delayed_signal[delay_samples:] = signal * attenuation
        
        if len(delayed_signal) > len(signal):
            delayed_signal = delayed_signal[:len(signal)]
        
        return delayed_signal
    
    def save_wav(self, signal, filepath):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        sf.write(filepath, signal, self.sr)


class MicrophoneNodeSimulator:
    def __init__(self, node_id, lat, lng, height=0.0, noise_level=0.05):
        self.node_id = node_id
        self.lat = lat
        self.lng = lng
        self.height = height
        self.noise_level = noise_level
        self.generator = PestSoundGenerator()
    
    def get_position(self):
        return {
            'node_id': self.node_id,
            'lat': self.lat,
            'lng': self.lng,
            'height': self.height
        }
    
    def capture_audio(self, source_lat, source_lng, pest_type, 
                      source_height=1.0, duration=3.0, base_time=None):
        distance = self._calculate_distance(source_lat, source_lng, 
                                            self.lat, self.lng,
                                            source_height, self.height)
        
        clean_signal = self.generator.generate_pest_sound(pest_type, duration)
        propagated = self.generator.simulate_propagation(clean_signal, distance)
        
        noise = np.random.normal(0, self.noise_level, size=len(propagated))
        captured_signal = propagated + noise
        
        travel_time = distance / 343.0
        if base_time is not None:
            arrival_time = base_time + travel_time
        else:
            arrival_time = travel_time
        
        return {
            'signal': captured_signal,
            'arrival_time': arrival_time,
            'distance': distance,
            'node_id': self.node_id
        }
    
    def _calculate_distance(self, lat1, lng1, lat2, lng2, h1=0, h2=0):
        EARTH_RADIUS = 6371000.0
        
        lat1_rad = np.radians(lat1)
        lat2_rad = np.radians(lat2)
        lng1_rad = np.radians(lng1)
        lng2_rad = np.radians(lng2)
        
        dlat = lat2_rad - lat1_rad
        dlng = lng2_rad - lng1_rad
        
        a = np.sin(dlat/2)**2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlng/2)**2
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
        
        horizontal_distance = EARTH_RADIUS * c
        height_diff = h2 - h1
        
        total_distance = np.sqrt(horizontal_distance**2 + height_diff**2)
        
        return total_distance


def create_default_nodes():
    nodes = [
        MicrophoneNodeSimulator('node_1', 35.0, 118.0, noise_level=0.04),
        MicrophoneNodeSimulator('node_2', 35.01, 118.02, noise_level=0.05),
        MicrophoneNodeSimulator('node_3', 35.01, 117.98, noise_level=0.045),
        MicrophoneNodeSimulator('node_4', 34.99, 118.01, noise_level=0.055),
        MicrophoneNodeSimulator('node_5', 34.99, 117.99, noise_level=0.042),
    ]
    return nodes


class MultiSourceSimulator:
    """多声源同时发声模拟器"""
    
    def __init__(self, nodes=None):
        self.nodes = nodes if nodes else create_default_nodes()
        self.generator = PestSoundGenerator()
    
    def simulate_concurrent_sources(self, sources_config, duration=3.0, base_time=0.0):
        """
        模拟多个声源同时发声
        
        Args:
            sources_config: list of dict, each with 'pest_type', 'lat', 'lng', 'height'
            duration: 音频时长
            base_time: 基准时间
        
        Returns:
            node_recordings: dict {node_id: {'signal': array, 'timestamp': arrival_time}}
            source_locations: list of source positions
        """
        n_samples = int(duration * self.generator.sr)
        
        node_recordings = {}
        for node in self.nodes:
            node_recordings[node.node_id] = {
                'signal': np.zeros(n_samples),
                'timestamp': float('inf')
            }
        
        source_locations = []
        for src_idx, src_config in enumerate(sources_config):
            pest_type = src_config['pest_type']
            lat = src_config['lat']
            lng = src_config['lng']
            height = src_config.get('height', 1.0)
            
            source_locations.append({
                'source_id': src_idx,
                'pest_type': pest_type,
                'lat': lat,
                'lng': lng,
                'height': height
            })
            
            clean_signal = self.generator.generate_pest_sound(pest_type, duration)
            
            earliest_arrival = float('inf')
            
            for node in self.nodes:
                distance = node._calculate_distance(
                    lat, lng, node.lat, node.lng,
                    height, node.height
                )
                
                travel_time = distance / 343.0
                delay_samples = int(travel_time * self.generator.sr)
                
                attenuation = 1.0 / (1.0 + distance * 0.01)
                
                propagated = np.zeros(n_samples)
                if delay_samples < n_samples:
                    propagated[delay_samples:] = clean_signal[:n_samples - delay_samples] * attenuation
                
                noise = np.random.normal(0, node.noise_level * 0.5, n_samples)
                node_recordings[node.node_id]['signal'] += propagated + noise
                
                if travel_time < node_recordings[node.node_id]['timestamp']:
                    node_recordings[node.node_id]['timestamp'] = base_time + travel_time
        
        return node_recordings, source_locations
    
    def generate_random_multisource_event(self, n_sources=2, duration=3.0):
        """生成随机多声源事件"""
        pest_types = ['locust', 'cotton_bollworm', 'aphid', 'whitefly']
        
        sources_config = []
        for i in range(n_sources):
            pest_type = np.random.choice(pest_types)
            lat = np.random.uniform(34.98, 35.02)
            lng = np.random.uniform(117.97, 118.03)
            
            sources_config.append({
                'pest_type': pest_type,
                'lat': lat,
                'lng': lng,
                'height': np.random.uniform(0.5, 2.0)
            })
        
        return self.simulate_concurrent_sources(sources_config, duration)
