import numpy as np
import librosa


class EnvironmentalNoiseGenerator:
    """环境噪声生成器 - 用于测试自适应阈值"""
    
    def __init__(self, sr=22050):
        self.sr = sr
    
    def generate_wind_noise(self, duration=3.0, intensity=0.5):
        """
        生成风噪声 - 低频、宽带噪声"""
        t = np.linspace(0, duration, int(self.sr * duration), endpoint=False)
        
        noise = np.random.normal(0, intensity, len(t))
        
        from scipy import signal
        b, a = signal.butter(4, 500 / (self.sr / 2), 'low')
        wind_noise = signal.filtfilt(b, a, noise)
        
        mod_freq = np.random.uniform(0.5, 2.0)
        modulation = 0.5 + 0.5 * np.sin(2 * np.pi * mod_freq * t)
        wind_noise = wind_noise * modulation
        
        wind_noise = wind_noise / (np.max(np.abs(wind_noise)) + 1e-10)
        
        return wind_noise
    
    def generate_machinery_noise(self, duration=3.0, intensity=0.5):
        """
        生成农机声 - 周期性低频振动"""
        t = np.linspace(0, duration, int(self.sr * duration), endpoint=False)
        
        base_freq = np.random.uniform(80, 150)
        machinery = np.zeros_like(t)
        for harmonic in range(1, 6):
            phase = np.random.uniform(0, 2 * np.pi)
            amplitude = 1.0 / harmonic
            machinery += amplitude * np.sin(2 * np.pi * base_freq * harmonic * t + phase)
        
        vibration_freq = np.random.uniform(5, 15)
        vibration = 0.3 * np.sin(2 * np.pi * vibration_freq * t)
        
        noise = np.random.normal(0, 0.2, len(t))
        
        machinery_noise = machinery + vibration + noise
        
        machinery_noise = machinery_noise / (np.max(np.abs(machinery_noise)) + 1e-10) * intensity
        
        return machinery_noise
    
    def generate_traffic_noise(self, duration=3.0, intensity=0.5):
        """生成交通噪声"""
        t = np.linspace(0, duration, int(self.sr * duration), endpoint=False)
        
        noise = np.random.normal(0, intensity, len(t))
        
        from scipy import signal
        b, a = signal.butter(4, 200 / (self.sr / 2), 'high')
        noise = signal.filtfilt(b, a, noise)
        
        envelope = np.zeros_like(t)
        n_pulses = np.random.randint(2, 5)
        for _ in range(n_pulses):
            center = np.random.uniform(0, duration)
            width = np.random.uniform(0.2, 0.8)
            envelope += np.exp(-((t - center) ** 2 / (2 * width ** 2)))
        
        traffic_noise = noise * (0.5 + 0.5 * envelope)
        
        traffic_noise = traffic_noise / (np.max(np.abs(traffic_noise)) + 1e-10) * intensity
        
        return traffic_noise
    
    def mix_signals(self, signal1, signal2, ratio=0.5):
        """混合两个信号"""
        max_len = max(len(signal1), len(signal2))
        
        if len(signal1) < max_len:
            signal1 = np.pad(signal1, (0, max_len - len(signal1)))
        if len(signal2) < max_len:
            signal2 = np.pad(signal2, (0, max_len - len(signal2)))
        
        mixed = ratio * signal1 + (1 - ratio) * signal2
        mixed = mixed / (np.max(np.abs(mixed)) + 1e-10)
        
        return mixed
    
    def generate_calibration_noise(self, duration=3.0, n_samples=10):
        """生成校准用的环境噪声样本"""
        samples = []
        for _ in range(n_samples):
            noise_type = np.random.choice(['wind', 'machinery', 'traffic'])
            intensity = np.random.uniform(0.1, 0.3)
            
            if noise_type == 'wind':
                sample = self.generate_wind_noise(duration, intensity)
            elif noise_type == 'machinery':
                sample = self.generate_machinery_noise(duration, intensity * 0.5)
            else:
                sample = self.generate_traffic_noise(duration, intensity * 0.3)
            
            samples.append(sample)
        
        return samples


def generate_test_scenarios():
    """生成测试场景"""
    generator = EnvironmentalNoiseGenerator()
    
    scenarios = []
    
    scenarios.append({
        'name': 'Clean pest sound',
        'signal': None,  # 纯害虫声
        'noise_level': 0,
        'is_pest': True,
        'expected_result': 'detect'
    })
    
    wind = generator.generate_wind_noise(duration=3.0, intensity=0.3)
    scenarios.append({
        'name': 'Pure wind noise',
        'signal': wind,
        'noise_level': 0.3,
        'is_pest': False,
        'expected_result': 'filter'
    })
    
    machinery = generator.generate_machinery_noise(duration=3.0, intensity=0.4)
    scenarios.append({
        'name': 'Pure machinery noise',
        'signal': machinery,
        'noise_level': 0.4,
        'is_pest': False,
        'expected_result': 'filter'
    })
    
    from node_sim.audio_generator import PestSoundGenerator
    pest_gen = PestSoundGenerator()
    pest_signal = pest_gen.generate_pest_sound('locust', duration=3.0)
    
    wind_light = generator.generate_wind_noise(duration=3.0, intensity=0.15)
    mixed_light = generator.mix_signals(pest_signal, wind_light, ratio=0.7)
    scenarios.append({
        'name': 'Pest + light wind',
        'signal': mixed_light,
        'noise_level': 0.15,
        'is_pest': True,
        'expected_result': 'detect'
    })
    
    wind_strong = generator.generate_wind_noise(duration=3.0, intensity=0.6)
    mixed_strong = generator.mix_signals(pest_signal, wind_strong, ratio=0.3)
    scenarios.append({
        'name': 'Pest + strong wind',
        'signal': mixed_strong,
        'noise_level': 0.6,
        'is_pest': True,
        'expected_result': 'filter'  # 噪声太强，可能过滤掉
    })
    
    machinery_light = generator.generate_machinery_noise(duration=3.0, intensity=0.2)
    mixed_machinery = generator.mix_signals(pest_signal, machinery_light, ratio=0.6)
    scenarios.append({
        'name': 'Pest + light machinery',
        'signal': mixed_machinery,
        'noise_level': 0.2,
        'is_pest': True,
        'expected_result': 'detect'
    })
    
    return scenarios
