import numpy as np
import json
import csv
from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class SensorData:
    timestamp: float
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    oxygen: Optional[float] = None
    pressure: Optional[float] = None


@dataclass
class FiringParameters:
    temperature_profile: List[Tuple[float, float]]
    atmosphere: str = "oxidation"
    clay_type: str = "porcelain"
    piece_mass: float = 1.0
    notes: str = ""


class DataAcquisition:
    def __init__(self):
        self.sensor_data: List[SensorData] = []
        self.start_time = None

    def start_recording(self):
        self.start_time = datetime.now()
        self.sensor_data = []

    def add_sensor_reading(self, temperature: Optional[float] = None,
                           humidity: Optional[float] = None,
                           oxygen: Optional[float] = None,
                           pressure: Optional[float] = None) -> SensorData:
        if self.start_time is None:
            self.start_time = datetime.now()

        timestamp = (datetime.now() - self.start_time).total_seconds()
        data = SensorData(
            timestamp=timestamp,
            temperature=temperature,
            humidity=humidity,
            oxygen=oxygen,
            pressure=pressure
        )
        self.sensor_data.append(data)
        return data

    def get_sensor_data_array(self) -> Dict[str, np.ndarray]:
        if not self.sensor_data:
            return {}

        n = len(self.sensor_data)
        data = {
            'timestamp': np.zeros(n),
            'temperature': np.zeros(n),
            'humidity': np.zeros(n),
            'oxygen': np.zeros(n),
            'pressure': np.zeros(n),
        }

        for i, d in enumerate(self.sensor_data):
            data['timestamp'][i] = d.timestamp
            data['temperature'][i] = d.temperature if d.temperature is not None else np.nan
            data['humidity'][i] = d.humidity if d.humidity is not None else np.nan
            data['oxygen'][i] = d.oxygen if d.oxygen is not None else np.nan
            data['pressure'][i] = d.pressure if d.pressure is not None else np.nan

        return data

    def save_sensor_data(self, filename: str):
        data_list = [asdict(d) for d in self.sensor_data]
        with open(filename, 'w') as f:
            json.dump(data_list, f, indent=2)

    def load_sensor_data(self, filename: str):
        with open(filename, 'r') as f:
            data_list = json.load(f)
        self.sensor_data = [SensorData(**d) for d in data_list]


class ManualInput:
    @staticmethod
    def input_temperature_profile() -> List[Tuple[float, float]]:
        profile = []
        print("输入温度曲线（时间:分钟, 温度:°C），输入空行结束：")
        while True:
            try:
                line = input(f"点 {len(profile) + 1} (时间, 温度): ").strip()
                if not line:
                    break
                time_str, temp_str = line.split(',')
                time_min = float(time_str.strip())
                temp = float(temp_str.strip())
                profile.append((time_min * 60, temp))
            except (ValueError, KeyboardInterrupt):
                break
        return sorted(profile, key=lambda x: x[0])

    @staticmethod
    def input_firing_parameters() -> FiringParameters:
        print("\n=== 烧制参数手动输入 ===")
        temperature_profile = ManualInput.input_temperature_profile()

        atmosphere = input("气氛 (oxidation/reduction, 默认 oxidation): ").strip() or "oxidation"
        clay_type = input("黏土类型 (porcelain/stoneware/earthenware, 默认 porcelain): ").strip() or "porcelain"
        piece_mass = float(input("坯体质量 (kg, 默认 1.0): ").strip() or "1.0")
        notes = input("备注: ").strip()

        return FiringParameters(
            temperature_profile=temperature_profile,
            atmosphere=atmosphere,
            clay_type=clay_type,
            piece_mass=piece_mass,
            notes=notes
        )


class SensorSimulator:
    def __init__(self, noise_level: float = 2.0):
        self.noise_level = noise_level
        self.base_temperature = 25.0
        self.base_humidity = 50.0
        self.base_oxygen = 20.95

    def simulate_temperature(self, target_temp: float, progress: float) -> float:
        noise = np.random.normal(0, self.noise_level)
        return self.base_temperature + (target_temp - self.base_temperature) * progress + noise

    def simulate_humidity(self, temperature: float) -> float:
        base = max(5.0, 50.0 - 0.05 * temperature)
        noise = np.random.normal(0, 1.0)
        return base + noise

    def simulate_oxygen(self, atmosphere: str, temperature: float) -> float:
        if atmosphere == "reduction" and temperature > 900:
            base = 5.0 + np.random.normal(0, 0.5)
        else:
            base = 20.95 - 0.001 * temperature
        return max(0.0, base)

    def generate_simulated_data(self, total_time: float = 600.0,
                                 target_temp: float = 1280.0,
                                 atmosphere: str = "oxidation",
                                 sample_rate: float = 1.0) -> List[SensorData]:
        data = []
        n_samples = int(total_time / sample_rate)

        for i in range(n_samples):
            t = i * sample_rate
            progress = min(1.0, t / (total_time * 0.6))

            temp = self.simulate_temperature(target_temp, progress)
            humidity = self.simulate_humidity(temp)
            oxygen = self.simulate_oxygen(atmosphere, temp)

            data.append(SensorData(
                timestamp=t,
                temperature=temp,
                humidity=humidity,
                oxygen=oxygen,
                pressure=101.3 + np.random.normal(0, 0.1)
            ))

        return data


class CSVDataImporter:
    @staticmethod
    def import_from_csv(filename: str) -> Dict[str, np.ndarray]:
        data = []
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(row)

        if not data:
            return {}

        keys = data[0].keys()
        result = {}

        for key in keys:
            numeric_values = []
            has_valid_data = False

            for row in data:
                value = row.get(key, '')
                if value is None or value == '' or value.lower() in ('nan', 'na', 'none', 'null'):
                    numeric_values.append(np.nan)
                else:
                    try:
                        numeric_values.append(float(value))
                        has_valid_data = True
                    except (ValueError, TypeError):
                        numeric_values.append(np.nan)

            if has_valid_data:
                result[key] = np.array(numeric_values, dtype=np.float64)
            else:
                result[key] = np.array([row.get(key, '') for row in data])

        return result

    @staticmethod
    def export_to_csv(filename: str, data: Dict[str, np.ndarray]):
        if not data:
            return

        keys = list(data.keys())
        n_rows = len(data[keys[0]])

        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(keys)
            for i in range(n_rows):
                row = []
                for key in keys:
                    val = data[key][i]
                    if isinstance(val, np.floating) and np.isnan(val):
                        row.append('')
                    else:
                        row.append(val)
                writer.writerow(row)
