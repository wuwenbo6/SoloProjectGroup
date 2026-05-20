import json
import csv
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional, Union


class ParameterInput:
    def __init__(self):
        self.collected_data = []
        self.timestamps = []

    def input_manual(self, ferm_type="rice_wine"):
        print(f"\n=== 手动输入{ferm_type}发酵参数 ===")

        config = {
            "name": input("发酵批次名称: "),
            "type": ferm_type,
            "fermentation": {},
            "kinetics": {},
            "initial_conditions": {},
            "optimization": {}
        }

        print("\n--- 发酵时间参数 ---")
        config["fermentation"]["total_time"] = float(input("总发酵时间(小时): "))
        config["fermentation"]["time_step"] = float(input("时间步长(小时): "))
        config["fermentation"]["initial_temperature"] = float(input("初始温度(℃): "))
        config["fermentation"]["target_temperature"] = float(input("目标温度(℃): "))
        config["fermentation"]["initial_humidity"] = float(input("初始湿度(%): "))
        config["fermentation"]["target_humidity"] = float(input("目标湿度(%): "))

        print("\n--- 动力学参数 ---")
        if ferm_type == "rice_wine":
            config["kinetics"]["yeast_growth_rate"] = float(input("酵母生长速率: "))
            config["kinetics"]["bacteria_growth_rate"] = float(input("细菌生长速率: "))
            config["kinetics"]["sugar_conversion_rate"] = float(input("糖转化速率: "))
            config["kinetics"]["alcohol_production_rate"] = float(input("酒精产率: "))
            config["kinetics"]["temperature_sensitivity"] = float(input("温度敏感性: "))
            config["kinetics"]["ph_optimal"] = float(input("最适pH: "))
            config["kinetics"]["ph_range"] = float(input("pH耐受范围: "))

            print("\n--- 初始条件 ---")
            config["initial_conditions"]["yeast_concentration"] = float(input("初始酵母浓度(CFU/mL): "))
            config["initial_conditions"]["bacteria_concentration"] = float(input("初始细菌浓度(CFU/mL): "))
            config["initial_conditions"]["sugar_concentration"] = float(input("初始糖浓度(g/L): "))
            config["initial_conditions"]["alcohol_concentration"] = float(input("初始酒精浓度(%): "))
            config["initial_conditions"]["ph"] = float(input("初始pH: "))

        elif ferm_type == "soy_sauce":
            config["kinetics"]["aspergillus_growth_rate"] = float(input("曲霉生长速率: "))
            config["kinetics"]["lactobacillus_growth_rate"] = float(input("乳酸菌生长速率: "))
            config["kinetics"]["yeast_growth_rate"] = float(input("酵母生长速率: "))
            config["kinetics"]["protein_decomposition_rate"] = float(input("蛋白质分解速率: "))
            config["kinetics"]["starch_conversion_rate"] = float(input("淀粉转化速率: "))
            config["kinetics"]["amino_acid_production_rate"] = float(input("氨基酸生成速率: "))
            config["kinetics"]["temperature_sensitivity"] = float(input("温度敏感性: "))
            config["kinetics"]["salt_tolerance"] = float(input("盐耐受性: "))

            print("\n--- 初始条件 ---")
            config["initial_conditions"]["aspergillus_concentration"] = float(input("初始曲霉浓度(CFU/mL): "))
            config["initial_conditions"]["lactobacillus_concentration"] = float(input("初始乳酸菌浓度(CFU/mL): "))
            config["initial_conditions"]["yeast_concentration"] = float(input("初始酵母浓度(CFU/mL): "))
            config["initial_conditions"]["protein_concentration"] = float(input("初始蛋白质浓度(g/L): "))
            config["initial_conditions"]["starch_concentration"] = float(input("初始淀粉浓度(g/L): "))
            config["initial_conditions"]["amino_acid_concentration"] = float(input("初始氨基酸浓度(g/L): "))
            config["initial_conditions"]["salt_concentration"] = float(input("盐浓度(g/L): "))
            config["initial_conditions"]["ph"] = float(input("初始pH: "))

        print("\n--- 优化参数 ---")
        config["optimization"]["target_quality_score"] = float(input("目标质量分数(0-1): "))
        temp_min = float(input("温度下限(℃): "))
        temp_max = float(input("温度上限(℃): "))
        config["optimization"]["temperature_bounds"] = [temp_min, temp_max]
        time_min = float(input("时间下限(小时): "))
        time_max = float(input("时间上限(小时): "))
        config["optimization"]["time_bounds"] = [time_min, time_max]

        return config

    def load_from_json(self, filepath: str) -> Dict:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def save_to_json(self, config: Dict, filepath: str):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(config, f, ensure_ascii=False, indent=2)


class SensorDataCollector:
    def __init__(self, sampling_interval: float = 1.0):
        self.sampling_interval = sampling_interval
        self.data = {
            "timestamp": [],
            "temperature": [],
            "humidity": [],
            "ph": []
        }
        self.is_collecting = False

    def add_measurement(self, temperature: Optional[float] = None,
                        humidity: Optional[float] = None,
                        ph: Optional[float] = None):
        self.data["timestamp"].append(datetime.now().isoformat())
        self.data["temperature"].append(temperature)
        self.data["humidity"].append(humidity)
        self.data["ph"].append(ph)

    def import_from_csv(self, filepath: str, time_column: str = "time",
                        temp_column: str = "temperature",
                        humidity_column: Optional[str] = None,
                        ph_column: Optional[str] = None,
                        delimiter: str = ',',
                        skip_invalid_rows: bool = True) -> Dict:
        imported_data = {
            "time": [],
            "temperature": [],
            "humidity": [],
            "ph": [],
            "valid_rows": 0,
            "invalid_rows": 0
        }

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f, delimiter=delimiter)

                if time_column not in reader.fieldnames:
                    raise ValueError(f"时间列 '{time_column}' 不存在，可用列: {reader.fieldnames}")
                if temp_column not in reader.fieldnames:
                    raise ValueError(f"温度列 '{temp_column}' 不存在，可用列: {reader.fieldnames}")

                for row_num, row in enumerate(reader, start=1):
                    try:
                        time_val = self._parse_numeric_value(row[time_column], "time", row_num)
                        temp_val = self._parse_numeric_value(row[temp_column], "temperature", row_num)

                        imported_data["time"].append(time_val)
                        imported_data["temperature"].append(temp_val)

                        if humidity_column and humidity_column in row and row[humidity_column].strip():
                            humidity_val = self._parse_numeric_value(row[humidity_column], "humidity", row_num)
                            imported_data["humidity"].append(humidity_val)

                        if ph_column and ph_column in row and row[ph_column].strip():
                            ph_val = self._parse_numeric_value(row[ph_column], "ph", row_num)
                            imported_data["ph"].append(ph_val)

                        imported_data["valid_rows"] += 1

                    except (ValueError, TypeError) as e:
                        imported_data["invalid_rows"] += 1
                        if not skip_invalid_rows:
                            raise ValueError(f"第 {row_num} 行数据格式错误: {e}")

        except FileNotFoundError:
            raise FileNotFoundError(f"CSV文件不存在: {filepath}")
        except Exception as e:
            raise RuntimeError(f"读取CSV文件时出错: {str(e)}")

        if imported_data["valid_rows"] == 0:
            raise ValueError("CSV文件中没有有效的数据行")

        if humidity_column and len(imported_data["humidity"]) != len(imported_data["time"]):
            while len(imported_data["humidity"]) < len(imported_data["time"]):
                imported_data["humidity"].append(None)

        if ph_column and len(imported_data["ph"]) != len(imported_data["time"]):
            while len(imported_data["ph"]) < len(imported_data["time"]):
                imported_data["ph"].append(None)

        return imported_data

    def _parse_numeric_value(self, value_str: str, field_name: str, row_num: int) -> float:
        if not value_str or value_str.strip() == '':
            raise ValueError(f"{field_name} 值为空")

        value_str = value_str.strip().replace(',', '.')

        try:
            value = float(value_str)

            if field_name == "temperature":
                if not (-20 <= value <= 80):
                    raise ValueError(f"温度值超出合理范围 (-20 ~ 80): {value}")
            elif field_name == "humidity":
                if not (0 <= value <= 100):
                    raise ValueError(f"湿度值超出合理范围 (0 ~ 100): {value}")
            elif field_name == "ph":
                if not (0 <= value <= 14):
                    raise ValueError(f"pH值超出合理范围 (0 ~ 14): {value}")

            return value
        except ValueError as e:
            raise ValueError(f"无法将 '{value_str}' 转换为数值: {e}")

    def export_to_csv(self, filepath: str):
        with open(filepath, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            headers = list(self.data.keys())
            writer.writerow(headers)
            for i in range(len(self.data["timestamp"])):
                row = [self.data[key][i] for key in headers]
                writer.writerow(row)

    def get_temperature_profile(self):
        from .numerical_computation import TemperatureProfile
        temps = self.data["temperature"]
        if len(temps) > 0:
            valid_temps = []
            valid_times = []
            for i, temp in enumerate(temps):
                if temp is not None and np.isfinite(temp):
                    valid_temps.append(float(temp))
                    valid_times.append(float(i * self.sampling_interval))

            if len(valid_temps) >= 2:
                return TemperatureProfile(np.array(valid_times), np.array(valid_temps))
            elif len(valid_temps) == 1:
                return TemperatureProfile.from_constant(24.0, valid_temps[0])

        return None

    def simulate_sensor_data(self, duration_hours: float, noise_level: float = 0.5):
        if duration_hours <= 0:
            raise ValueError(f"发酵时长必须大于0，当前值: {duration_hours}")
        if self.sampling_interval <= 0:
            raise ValueError(f"采样间隔必须大于0，当前值: {self.sampling_interval}")
        if noise_level < 0:
            raise ValueError(f"噪声水平不能为负，当前值: {noise_level}")

        num_samples = int(duration_hours / self.sampling_interval)
        if num_samples < 2:
            raise ValueError(f"采样点数过少（{num_samples}），请增加发酵时长或减小采样间隔")

        base_temp = 30.0
        base_humidity = 75.0
        base_ph = 4.5

        self.clear_data()

        for i in range(num_samples):
            time_hours = i * self.sampling_interval
            temp_variation = 2 * np.sin(time_hours / 24 * 2 * np.pi)
            temp = base_temp + temp_variation + np.random.normal(0, noise_level)
            humidity = base_humidity + np.random.normal(0, noise_level)
            ph = base_ph + 0.1 * np.sin(time_hours / 48 * 2 * np.pi) + np.random.normal(0, 0.05)

            temp = np.clip(temp, 0.0, 50.0)
            humidity = np.clip(humidity, 30.0, 100.0)
            ph = np.clip(ph, 3.0, 7.0)

            self.add_measurement(
                temperature=float(temp),
                humidity=float(humidity),
                ph=float(ph)
            )

        return self.data

    def clear_data(self):
        for key in self.data:
            self.data[key] = []


class DataValidator:
    @staticmethod
    def validate_config(config: Dict) -> tuple[bool, List[str]]:
        errors = []

        required_keys = ["name", "type", "fermentation", "kinetics", "initial_conditions", "optimization"]
        for key in required_keys:
            if key not in config:
                errors.append(f"缺少必需的配置项: {key}")

        if config.get("type") not in ["rice_wine", "soy_sauce"]:
            errors.append(f"不支持的发酵类型: {config.get('type')}")

        ferm = config.get("fermentation", {})
        if ferm.get("total_time", 0) <= 0:
            errors.append("总发酵时间必须大于0")
        if ferm.get("time_step", 0) <= 0:
            errors.append("时间步长必须大于0")

        opt = config.get("optimization", {})
        temp_bounds = opt.get("temperature_bounds", [0, 0])
        if temp_bounds[0] >= temp_bounds[1]:
            errors.append("温度范围无效，下限必须小于上限")

        time_bounds = opt.get("time_bounds", [0, 0])
        if time_bounds[0] >= time_bounds[1]:
            errors.append("时间范围无效，下限必须小于上限")

        return len(errors) == 0, errors

    @staticmethod
    def validate_sensor_data(data: Dict) -> tuple[bool, List[str]]:
        errors = []

        if len(data.get("temperature", [])) == 0:
            errors.append("温度数据为空")

        temps = [t for t in data.get("temperature", []) if t is not None]
        if temps:
            if min(temps) < -10 or max(temps) > 60:
                errors.append("温度数据超出合理范围(-10℃ ~ 60℃)")

        ph_values = [p for p in data.get("ph", []) if p is not None]
        if ph_values:
            if min(ph_values) < 0 or max(ph_values) > 14:
                errors.append("pH数据超出合理范围(0 ~ 14)")

        return len(errors) == 0, errors
