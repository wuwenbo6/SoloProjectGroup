import numpy as np
from scipy.integrate import odeint
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class FiringState:
    temperature: float
    humidity: float
    oxygen_level: float
    shrinkage: float
    time_elapsed: float


@dataclass
class FiringConfig:
    initial_temp: float = 25.0
    initial_humidity: float = 50.0
    initial_oxygen: float = 20.95
    target_temp: float = 1280.0
    heating_rate: float = 150.0
    holding_time: float = 120.0
    cooling_rate: float = 100.0
    total_time: float = 600.0
    clay_type: str = "porcelain"
    atmosphere: str = "oxidation"


class CeramicFiringSimulation:
    def __init__(self, config: FiringConfig):
        self.config = config
        self.time_points = None
        self.temperature_profile = None
        self.humidity_profile = None
        self.oxygen_profile = None
        self.shrinkage_profile = None

    def temperature_ode(self, T: float, t: float, target: float, rate: float) -> float:
        if T < target:
            return rate * np.exp(-(T - target) ** 2 / 100000)
        elif T > target:
            return -rate * np.exp(-(target - T) ** 2 / 100000)
        return 0.0

    def humidity_model(self, t: float, T: float) -> float:
        base_humidity = self.config.initial_humidity
        if T < 100:
            drying_factor = np.exp(-0.01 * t)
        elif T < 600:
            drying_factor = 0.1 * np.exp(-0.005 * (t - 100))
        else:
            drying_factor = 0.01
        return base_humidity * drying_factor

    def oxygen_model(self, t: float, T: float, atmosphere: str) -> float:
        if atmosphere == "reduction":
            reduction_start = 300
            if t > reduction_start and T > 900:
                return 5.0 + 15.95 * np.exp(-0.01 * (t - reduction_start))
        return 20.95 * (1 - 0.001 * np.exp(-0.005 * t))

    def shrinkage_model(self, T: float, clay_type: str) -> float:
        clay_params = {
            "porcelain": {"alpha": 0.00015, "beta": 0.00005, "T1": 573, "T2": 1000},
            "stoneware": {"alpha": 0.00012, "beta": 0.00004, "T1": 550, "T2": 950},
            "earthenware": {"alpha": 0.00010, "beta": 0.00003, "T1": 500, "T2": 900},
        }
        params = clay_params.get(clay_type, clay_params["porcelain"])
        alpha, beta, T1, T2 = params["alpha"], params["beta"], params["T1"], params["T2"]

        if T < T1:
            shrinkage = alpha * (T - 25)
        elif T < T2:
            shrinkage = alpha * (T1 - 25) + beta * (T - T1)
        else:
            vitrification = 0.08 * (1 - np.exp(-0.0005 * (T - T2)))
            shrinkage = alpha * (T1 - 25) + beta * (T2 - T1) + vitrification

        return min(shrinkage * 100, 15.0)

    def generate_temperature_curve(self, total_time: float, dt: float = 1.0) -> Tuple[np.ndarray, np.ndarray]:
        t = np.arange(0, total_time, dt)
        temp_curve = np.full_like(t, self.config.initial_temp, dtype=np.float64)

        min_rate = 1.0
        heating_rate = max(self.config.heating_rate, min_rate)
        cooling_rate = max(self.config.cooling_rate, min_rate)

        temp_diff = max(self.config.target_temp - self.config.initial_temp, 0)

        if temp_diff > 0:
            heating_end_time = temp_diff / heating_rate * 60
        else:
            heating_end_time = 0

        holding_end_time = heating_end_time + self.config.holding_time

        if temp_diff > 0:
            cooling_end_time = holding_end_time + temp_diff / cooling_rate * 60
        else:
            cooling_end_time = holding_end_time

        for i, time in enumerate(t):
            if time < heating_end_time:
                temp_curve[i] = self.config.initial_temp + heating_rate * (time / 60)
            elif time < holding_end_time:
                temp_curve[i] = self.config.target_temp
            elif time < cooling_end_time:
                cooling_progress = (time - holding_end_time) / 60
                cooled_temp = self.config.target_temp - cooling_rate * cooling_progress
                temp_curve[i] = max(cooled_temp, self.config.initial_temp)
            else:
                temp_curve[i] = self.config.initial_temp

        temp_curve = np.clip(temp_curve,
                           min(self.config.initial_temp, self.config.target_temp),
                           max(self.config.initial_temp, self.config.target_temp))

        return t, temp_curve

    def run_simulation(self, dt: float = 1.0) -> dict:
        total_time = self.config.total_time
        self.time_points, self.temperature_profile = self.generate_temperature_curve(total_time, dt)
        n_points = len(self.time_points)

        self.humidity_profile = np.zeros(n_points)
        self.oxygen_profile = np.zeros(n_points)
        self.shrinkage_profile = np.zeros(n_points)

        for i, (t, T) in enumerate(zip(self.time_points, self.temperature_profile)):
            self.humidity_profile[i] = self.humidity_model(t, T)
            self.oxygen_profile[i] = self.oxygen_model(t, T, self.config.atmosphere)
            self.shrinkage_profile[i] = self.shrinkage_model(T, self.config.clay_type)

        return {
            "time": self.time_points,
            "temperature": self.temperature_profile,
            "humidity": self.humidity_profile,
            "oxygen": self.oxygen_profile,
            "shrinkage": self.shrinkage_profile,
        }

    def get_state_at_time(self, t: float) -> FiringState:
        if self.time_points is None:
            raise ValueError("Simulation not run yet")

        idx = np.argmin(np.abs(self.time_points - t))
        return FiringState(
            temperature=self.temperature_profile[idx],
            humidity=self.humidity_profile[idx],
            oxygen_level=self.oxygen_profile[idx],
            shrinkage=self.shrinkage_profile[idx],
            time_elapsed=t,
        )
