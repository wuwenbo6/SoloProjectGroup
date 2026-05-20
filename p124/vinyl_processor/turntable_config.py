import numpy as np
from scipy import signal
from typing import Dict, List, Optional, Tuple
import json
import os


class TurntableProfile:
    def __init__(self, name: str, manufacturer: str = None):
        self.name = name
        self.manufacturer = manufacturer
        self.description = ""
        self.frequency_response = {}
        self.noise_profile = {}
        self.speed_correction = {}
        self.equalization_curve = {}
        self.cartridge_type = "MM"
        self.phono_stage = "standard"
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "manufacturer": self.manufacturer,
            "description": self.description,
            "frequency_response": self.frequency_response,
            "noise_profile": self.noise_profile,
            "speed_correction": self.speed_correction,
            "equalization_curve": self.equalization_curve,
            "cartridge_type": self.cartridge_type,
            "phono_stage": self.phono_stage
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'TurntableProfile':
        profile = cls(data["name"], data.get("manufacturer"))
        profile.description = data.get("description", "")
        profile.frequency_response = data.get("frequency_response", {})
        profile.noise_profile = data.get("noise_profile", {})
        profile.speed_correction = data.get("speed_correction", {})
        profile.equalization_curve = data.get("equalization_curve", {})
        profile.cartridge_type = data.get("cartridge_type", "MM")
        profile.phono_stage = data.get("phono_stage", "standard")
        return profile


class TurntableConfigurator:
    PRESETS = {
        "technics_sl1200": {
            "name": "Technics SL-1200",
            "manufacturer": "Technics",
            "description": "经典 DJ 唱机，精准转速，优秀隔离",
            "frequency_response": {
                "low_freq_boost": 3.0,
                "high_freq_boost": 1.5,
                "low_cutoff": 20,
                "high_cutoff": 20000
            },
            "noise_profile": {
                "rumble_level": -65,
                "surface_noise_level": -55,
                "click_sensitivity": 0.7
            },
            "speed_correction": {
                "expected_deviation": 0.002,
                "wow_flutter": 0.03
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MM",
            "phono_stage": "standard"
        },
        "audio_technica_lp120": {
            "name": "Audio-Technica LP120",
            "manufacturer": "Audio-Technica",
            "description": "入门级直驱唱机，性价比高",
            "frequency_response": {
                "low_freq_boost": 4.0,
                "high_freq_boost": 2.0,
                "low_cutoff": 20,
                "high_cutoff": 18000
            },
            "noise_profile": {
                "rumble_level": -60,
                "surface_noise_level": -50,
                "click_sensitivity": 0.8
            },
            "speed_correction": {
                "expected_deviation": 0.005,
                "wow_flutter": 0.07
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MM",
            "phono_stage": "built-in"
        },
        "rega_planar_3": {
            "name": "Rega Planar 3",
            "manufacturer": "Rega",
            "description": "英国经典唱机，音乐性强",
            "frequency_response": {
                "low_freq_boost": 2.0,
                "high_freq_boost": 2.5,
                "low_cutoff": 30,
                "high_cutoff": 22000
            },
            "noise_profile": {
                "rumble_level": -68,
                "surface_noise_level": -58,
                "click_sensitivity": 0.6
            },
            "speed_correction": {
                "expected_deviation": 0.003,
                "wow_flutter": 0.04
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MC",
            "phono_stage": "external"
        },
        "pro_ject_debut": {
            "name": "Pro-Ject Debut Carbon",
            "manufacturer": "Pro-Ject",
            "description": "高端入门唱机，碳纤维唱臂",
            "frequency_response": {
                "low_freq_boost": 2.5,
                "high_freq_boost": 1.8,
                "low_cutoff": 20,
                "high_cutoff": 20000
            },
            "noise_profile": {
                "rumble_level": -70,
                "surface_noise_level": -60,
                "click_sensitivity": 0.65
            },
            "speed_correction": {
                "expected_deviation": 0.001,
                "wow_flutter": 0.025
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MM",
            "phono_stage": "external"
        },
        "thorens_td124": {
            "name": "Thorens TD 124",
            "manufacturer": "Thorens",
            "description": "经典皮带驱动，复古音色",
            "frequency_response": {
                "low_freq_boost": 3.5,
                "high_freq_boost": 3.0,
                "low_cutoff": 20,
                "high_cutoff": 18000
            },
            "noise_profile": {
                "rumble_level": -55,
                "surface_noise_level": -48,
                "click_sensitivity": 0.9
            },
            "speed_correction": {
                "expected_deviation": 0.008,
                "wow_flutter": 0.1
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MM",
            "phono_stage": "external"
        },
        "vintage_generic": {
            "name": "Vintage Generic",
            "manufacturer": "Generic",
            "description": "通用复古唱机配置",
            "frequency_response": {
                "low_freq_boost": 5.0,
                "high_freq_boost": 4.0,
                "low_cutoff": 30,
                "high_cutoff": 15000
            },
            "noise_profile": {
                "rumble_level": -50,
                "surface_noise_level": -45,
                "click_sensitivity": 1.0
            },
            "speed_correction": {
                "expected_deviation": 0.015,
                "wow_flutter": 0.15
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MM",
            "phono_stage": "external"
        },
        "modern_reference": {
            "name": "Modern Reference",
            "manufacturer": "Reference",
            "description": "现代参考级唱机，最小校正",
            "frequency_response": {
                "low_freq_boost": 1.0,
                "high_freq_boost": 1.0,
                "low_cutoff": 20,
                "high_cutoff": 22000
            },
            "noise_profile": {
                "rumble_level": -75,
                "surface_noise_level": -65,
                "click_sensitivity": 0.5
            },
            "speed_correction": {
                "expected_deviation": 0.0005,
                "wow_flutter": 0.01
            },
            "equalization_curve": "RIAA",
            "cartridge_type": "MC",
            "phono_stage": "external"
        }
    }
    
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.current_profile = None
        self._custom_profiles = {}
    
    def list_presets(self) -> List[str]:
        return list(self.PRESETS.keys())
    
    def get_preset_info(self, preset_name: str) -> Optional[Dict]:
        if preset_name in self.PRESETS:
            return self.PRESETS[preset_name]
        return None
    
    def load_preset(self, preset_name: str) -> bool:
        if preset_name not in self.PRESETS:
            print(f"预设 '{preset_name}' 不存在")
            return False
        
        preset_data = self.PRESETS[preset_name]
        self.current_profile = TurntableProfile.from_dict(preset_data)
        print(f"已加载唱机配置: {self.current_profile.name}")
        return True
    
    def create_custom_profile(self, name: str, manufacturer: str = None,
                             description: str = None) -> TurntableProfile:
        profile = TurntableProfile(name, manufacturer)
        if description:
            profile.description = description
        return profile
    
    def save_custom_profile(self, profile: TurntableProfile, 
                           config_dir: str = None) -> bool:
        try:
            if config_dir is None:
                home_dir = os.path.expanduser("~")
                config_dir = os.path.join(home_dir, ".vinyl_processor", "profiles")
            
            os.makedirs(config_dir, exist_ok=True)
            
            file_path = os.path.join(config_dir, f"{profile.name.replace(' ', '_')}.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(profile.to_dict(), f, indent=2, ensure_ascii=False)
            
            self._custom_profiles[profile.name] = profile
            print(f"配置已保存: {file_path}")
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False
    
    def load_custom_profile(self, profile_name: str, 
                           config_dir: str = None) -> Optional[TurntableProfile]:
        try:
            if config_dir is None:
                home_dir = os.path.expanduser("~")
                config_dir = os.path.join(home_dir, ".vinyl_processor", "profiles")
            
            file_path = os.path.join(config_dir, f"{profile_name.replace(' ', '_')}.json")
            
            if not os.path.exists(file_path):
                print(f"配置文件不存在: {file_path}")
                return None
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            profile = TurntableProfile.from_dict(data)
            self.current_profile = profile
            print(f"已加载自定义配置: {profile.name}")
            return profile
        except Exception as e:
            print(f"加载配置失败: {e}")
            return None
    
    def get_noise_reduction_params(self) -> Dict:
        if self.current_profile is None:
            return {
                "click_sensitivity": 0.7,
                "rumble_level": -60,
                "surface_noise_level": -55
            }
        
        np = self.current_profile.noise_profile
        return {
            "click_sensitivity": np.get("click_sensitivity", 0.7),
            "rumble_level": np.get("rumble_level", -60),
            "surface_noise_level": np.get("surface_noise_level", -55)
        }
    
    def get_speed_correction_params(self) -> Dict:
        if self.current_profile is None:
            return {
                "expected_deviation": 0.005,
                "wow_flutter": 0.05
            }
        
        sc = self.current_profile.speed_correction
        return {
            "expected_deviation": sc.get("expected_deviation", 0.005),
            "wow_flutter": sc.get("wow_flutter", 0.05)
        }
    
    def apply_frequency_compensation(self, audio: np.ndarray) -> np.ndarray:
        if self.current_profile is None:
            return audio
        
        fr = self.current_profile.frequency_response
        low_boost = fr.get("low_freq_boost", 1.0)
        high_boost = fr.get("high_freq_boost", 1.0)
        low_cutoff = fr.get("low_cutoff", 20)
        high_cutoff = fr.get("high_cutoff", 20000)
        
        try:
            nyquist = self.sample_rate / 2
            numtaps = 1025
            
            low_gain = 10 ** (low_boost / 20)
            high_gain = 10 ** (high_boost / 20)
            
            bands = [0, low_cutoff / nyquist, 1000 / nyquist, high_cutoff / nyquist, 1.0]
            gains = [low_gain, 1.0, 1.0, high_gain, high_gain * 0.5]
            
            tap_coeffs = signal.firwin2(numtaps, bands, gains, fs=self.sample_rate)
            
            if audio.ndim == 2:
                compensated = np.zeros_like(audio)
                for channel in range(audio.shape[1]):
                    compensated[:, channel] = signal.filtfilt(tap_coeffs, [1.0], audio[:, channel])
                return compensated
            else:
                return signal.filtfilt(tap_coeffs, [1.0], audio)
        except Exception as e:
            print(f"频率补偿失败: {e}")
            return audio
    
    def apply_riaa_equalization(self, audio: np.ndarray, inverse: bool = False) -> np.ndarray:
        try:
            nyquist = self.sample_rate / 2
            
            riaa_time_constants = [3180e-6, 318e-6, 75e-6]
            
            t1, t2, t3 = riaa_time_constants
            
            f1 = 1 / (2 * np.pi * t1)
            f2 = 1 / (2 * np.pi * t2)
            f3 = 1 / (2 * np.pi * t3)
            
            b1, a1 = signal.butter(1, f1 / nyquist, 'high' if not inverse else 'low')
            b2, a2 = signal.butter(1, f3 / nyquist, 'low' if not inverse else 'high')
            
            Q = 1 / np.sqrt(2)
            b3, a3 = signal.iirpeak(f2 / nyquist, Q) if not inverse else signal.iirnotch(f2 / nyquist, Q)
            
            processed = audio.copy()
            
            if audio.ndim == 2:
                for channel in range(audio.shape[1]):
                    x = signal.filtfilt(b1, a1, audio[:, channel])
                    x = signal.filtfilt(b2, a2, x)
                    x = signal.filtfilt(b3, a3, x)
                    processed[:, channel] = x
            else:
                x = signal.filtfilt(b1, a1, audio)
                x = signal.filtfilt(b2, a2, x)
                x = signal.filtfilt(b3, a3, x)
                processed = x
            
            return processed
        except Exception as e:
            print(f"RIAA 均衡失败: {e}")
            return audio
    
    def get_current_profile_name(self) -> Optional[str]:
        if self.current_profile:
            return self.current_profile.name
        return None
