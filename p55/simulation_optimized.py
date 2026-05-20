import numpy as np
from dataclasses import dataclass, field
from typing import Optional, Tuple, List, Dict, Any, Callable
from enum import Enum
import multiprocessing as mp
from multiprocessing import Pool, cpu_count
import pickle
import os
from pathlib import Path
import time


class SimulationPhase(Enum):
    HEATING = "heating"
    HOLDING = "holding"
    COOLING = "cooling"
    FINISHED = "finished"


@dataclass
class FiringState:
    temperature: float
    humidity: float
    oxygen_level: float
    shrinkage: float
    time_elapsed: float
    phase: SimulationPhase
    step: int = 0


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
    dt: float = 1.0
    adaptive_timestep: bool = False
    max_dt: float = 5.0
    min_dt: float = 0.1
    accuracy_tolerance: float = 1e-4


@dataclass
class SimulationCheckpoint:
    config: FiringConfig
    current_time: float
    current_step: int
    temperature_profile: np.ndarray
    humidity_profile: np.ndarray
    oxygen_profile: np.ndarray
    shrinkage_profile: np.ndarray
    time_points: np.ndarray
    checkpoint_time: float = field(default_factory=time.time)

    def save(self, filepath: str):
        with open(filepath, 'wb') as f:
            pickle.dump(self, f, protocol=pickle.HIGHEST_PROTOCOL)

    @classmethod
    def load(cls, filepath: str) -> 'SimulationCheckpoint':
        with open(filepath, 'rb') as f:
            return pickle.load(f)


class ClayProperties:
    _PARAMS = {
        "porcelain": {
            "thermal_conductivity": 1.5,
            "specific_heat": 880,
            "density": 2400,
            "shrinkage_alpha": 0.00015,
            "shrinkage_beta": 0.00005,
            "T1": 573,
            "T2": 1000,
            "vitrification_coeff": 0.08
        },
        "stoneware": {
            "thermal_conductivity": 1.3,
            "specific_heat": 850,
            "density": 2300,
            "shrinkage_alpha": 0.00012,
            "shrinkage_beta": 0.00004,
            "T1": 550,
            "T2": 950,
            "vitrification_coeff": 0.07
        },
        "earthenware": {
            "thermal_conductivity": 1.0,
            "specific_heat": 800,
            "density": 2100,
            "shrinkage_alpha": 0.00010,
            "shrinkage_beta": 0.00003,
            "T1": 500,
            "T2": 900,
            "vitrification_coeff": 0.06
        },
        "bone_china": {
            "thermal_conductivity": 1.4,
            "specific_heat": 860,
            "density": 2250,
            "shrinkage_alpha": 0.00013,
            "shrinkage_beta": 0.000045,
            "T1": 525,
            "T2": 975,
            "vitrification_coeff": 0.075
        }
    }

    @classmethod
    def get(cls, clay_type: str) -> Dict[str, float]:
        return cls._PARAMS.get(clay_type, cls._PARAMS["porcelain"])


class OptimizedFiringSimulation:
    def __init__(self, config: FiringConfig):
        self.config = config
        self._setup_arrays()
        self.current_step = 0
        self.current_time = 0.0
        self.checkpoint_dir = Path("checkpoints")
        self.checkpoint_dir.mkdir(exist_ok=True)

    def _setup_arrays(self, preallocate_size: Optional[int] = None):
        if preallocate_size is None:
            n_points = int(np.ceil(self.config.total_time / self.config.dt)) + 1000
        else:
            n_points = preallocate_size

        self.time_points = np.zeros(n_points, dtype=np.float64)
        self.temperature_profile = np.zeros(n_points, dtype=np.float64)
        self.humidity_profile = np.zeros(n_points, dtype=np.float64)
        self.oxygen_profile = np.zeros(n_points, dtype=np.float64)
        self.shrinkage_profile = np.zeros(n_points, dtype=np.float64)

        self.temperature_profile[0] = self.config.initial_temp
        self.humidity_profile[0] = self.config.initial_humidity
        self.oxygen_profile[0] = self.config.initial_oxygen

    def _calculate_phase_times(self) -> Tuple[float, float, float]:
        temp_diff = max(self.config.target_temp - self.config.initial_temp, 0)
        heating_end_time = temp_diff / max(self.config.heating_rate, 1.0) * 60 if temp_diff > 0 else 0
        holding_end_time = heating_end_time + self.config.holding_time
        cooling_end_time = holding_end_time + temp_diff / max(self.config.cooling_rate, 1.0) * 60 if temp_diff > 0 else holding_end_time
        return heating_end_time, holding_end_time, cooling_end_time

    def _get_phase(self, t: float) -> SimulationPhase:
        heating_end, holding_end, cooling_end = self._calculate_phase_times()
        if t < heating_end:
            return SimulationPhase.HEATING
        elif t < holding_end:
            return SimulationPhase.HOLDING
        elif t < cooling_end:
            return SimulationPhase.COOLING
        else:
            return SimulationPhase.FINISHED

    @staticmethod
    def _temperature_curve_vectorized(t: np.ndarray, config: FiringConfig) -> np.ndarray:
        temp_diff = max(config.target_temp - config.initial_temp, 0)
        heating_rate = max(config.heating_rate, 1.0)
        cooling_rate = max(config.cooling_rate, 1.0)

        heating_end_time = temp_diff / heating_rate * 60 if temp_diff > 0 else 0
        holding_end_time = heating_end_time + config.holding_time
        cooling_end_time = holding_end_time + temp_diff / cooling_rate * 60 if temp_diff > 0 else holding_end_time

        temp = np.full_like(t, config.initial_temp, dtype=np.float64)

        heating_mask = t < heating_end_time
        temp[heating_mask] = config.initial_temp + heating_rate * (t[heating_mask] / 60)

        holding_mask = (t >= heating_end_time) & (t < holding_end_time)
        temp[holding_mask] = config.target_temp

        cooling_mask = (t >= holding_end_time) & (t < cooling_end_time)
        cooling_progress = (t[cooling_mask] - holding_end_time) / 60
        temp[cooling_mask] = config.target_temp - cooling_rate * cooling_progress

        finished_mask = t >= cooling_end_time
        temp[finished_mask] = config.initial_temp

        return np.clip(temp,
                      min(config.initial_temp, config.target_temp),
                      max(config.initial_temp, config.target_temp))

    @staticmethod
    def _humidity_vectorized(t: np.ndarray, T: np.ndarray, config: FiringConfig) -> np.ndarray:
        base_humidity = config.initial_humidity
        drying_factor = np.ones_like(t, dtype=np.float64)

        mask1 = T < 100
        drying_factor[mask1] = np.exp(-0.01 * t[mask1])

        mask2 = (T >= 100) & (T < 600)
        drying_factor[mask2] = 0.1 * np.exp(-0.005 * (t[mask2] - 100))

        mask3 = T >= 600
        drying_factor[mask3] = 0.01

        return base_humidity * drying_factor

    @staticmethod
    def _oxygen_vectorized(t: np.ndarray, T: np.ndarray, config: FiringConfig) -> np.ndarray:
        oxygen = np.full_like(t, 20.95, dtype=np.float64)

        reduction_start = 300
        if config.atmosphere == "reduction":
            mask = (t > reduction_start) & (T > 900)
            oxygen[mask] = 5.0 + 15.95 * np.exp(-0.01 * (t[mask] - reduction_start))
            decay_mask = ~mask
        else:
            decay_mask = np.ones_like(t, dtype=bool)

        oxygen[decay_mask] = 20.95 * (1 - 0.001 * np.exp(-0.005 * t[decay_mask]))

        return oxygen

    @staticmethod
    def _shrinkage_vectorized(T: np.ndarray, config: FiringConfig) -> np.ndarray:
        _ = T  # T is the temperature array, config provides clay_type
        params = ClayProperties.get(config.clay_type)
        alpha = params["shrinkage_alpha"]
        beta = params["shrinkage_beta"]
        T1 = params["T1"]
        T2 = params["T2"]
        vitr_coeff = params["vitrification_coeff"]

        shrinkage = np.zeros_like(T, dtype=np.float64)

        mask1 = T < T1
        shrinkage[mask1] = alpha * (T[mask1] - 25)

        mask2 = (T >= T1) & (T < T2)
        shrinkage[mask2] = alpha * (T1 - 25) + beta * (T[mask2] - T1)

        mask3 = T >= T2
        shrinkage[mask3] = (alpha * (T1 - 25) + beta * (T2 - T1) +
                           vitr_coeff * (1 - np.exp(-0.0005 * (T[mask3] - T2))))

        return np.minimum(shrinkage * 100, 15.0)

    def _adaptive_timestep(self, T: float, dT_dt: float) -> float:
        if not self.config.adaptive_timestep:
            return self.config.dt

        rate_magnitude = abs(dT_dt)
        if rate_magnitude < 0.1:
            return self.config.max_dt
        elif rate_magnitude > 10:
            return self.config.min_dt
        else:
            dt = self.config.max_dt - (self.config.max_dt - self.config.min_dt) * (rate_magnitude - 0.1) / 9.9
            return np.clip(dt, self.config.min_dt, self.config.max_dt)

    def run_simulation_optimized(self) -> Dict[str, np.ndarray]:
        n_points = int(np.ceil(self.config.total_time / self.config.dt))
        t = np.linspace(0, self.config.total_time, n_points, dtype=np.float64)

        self.temperature_profile = self._temperature_curve_vectorized(t, self.config)
        self.humidity_profile = self._humidity_vectorized(t, self.temperature_profile, self.config)
        self.oxygen_profile = self._oxygen_vectorized(t, self.temperature_profile, self.config)
        self.shrinkage_profile = self._shrinkage_vectorized(self.temperature_profile, self.config)
        self.time_points = t

        self.current_step = n_points - 1
        self.current_time = self.config.total_time

        return {
            "time": self.time_points,
            "temperature": self.temperature_profile,
            "humidity": self.humidity_profile,
            "oxygen": self.oxygen_profile,
            "shrinkage": self.shrinkage_profile,
        }

    def run_simulation_with_checkpoints(self, checkpoint_interval: int = 1000) -> Dict[str, np.ndarray]:
        if self.config.adaptive_timestep:
            return self._run_adaptive_simulation(checkpoint_interval)
        else:
            return self.run_simulation_optimized()

    def _run_adaptive_simulation(self, checkpoint_interval: int) -> Dict[str, np.ndarray]:
        t = 0.0
        step = 0
        max_steps = int(np.ceil(self.config.total_time / self.config.min_dt)) + 1000

        self._setup_arrays(max_steps)

        while t < self.config.total_time and step < max_steps - 1:
            T = self.temperature_profile[step]
            phase = self._get_phase(t)

            if phase == SimulationPhase.HEATING:
                dT_dt = self.config.heating_rate / 60
            elif phase == SimulationPhase.HOLDING:
                dT_dt = 0
            elif phase == SimulationPhase.COOLING:
                dT_dt = -self.config.cooling_rate / 60
            else:
                dT_dt = 0

            dt = self._adaptive_timestep(T, dT_dt)
            t += dt
            step += 1

            self.time_points[step] = t
            self.temperature_profile[step] = T + dT_dt * dt
            self.humidity_profile[step] = self._humidity_vectorized(
                np.array([t]), np.array([self.temperature_profile[step]]), self.config
            )[0]
            self.oxygen_profile[step] = self._oxygen_vectorized(
                np.array([t]), np.array([self.temperature_profile[step]]), self.config
            )[0]
            self.shrinkage_profile[step] = self._shrinkage_vectorized(
                np.array([self.temperature_profile[step]]), self.config
            )[0]

            if step % checkpoint_interval == 0:
                self.save_checkpoint(f"checkpoint_step_{step}.pkl")

        self.time_points = self.time_points[:step + 1]
        self.temperature_profile = self.temperature_profile[:step + 1]
        self.humidity_profile = self.humidity_profile[:step + 1]
        self.oxygen_profile = self.oxygen_profile[:step + 1]
        self.shrinkage_profile = self.shrinkage_profile[:step + 1]

        self.current_step = step
        self.current_time = t

        return {
            "time": self.time_points,
            "temperature": self.temperature_profile,
            "humidity": self.humidity_profile,
            "oxygen": self.oxygen_profile,
            "shrinkage": self.shrinkage_profile,
        }

    def save_checkpoint(self, filename: str) -> str:
        checkpoint = SimulationCheckpoint(
            config=self.config,
            current_time=self.current_time,
            current_step=self.current_step,
            temperature_profile=self.temperature_profile[:self.current_step + 1].copy(),
            humidity_profile=self.humidity_profile[:self.current_step + 1].copy(),
            oxygen_profile=self.oxygen_profile[:self.current_step + 1].copy(),
            shrinkage_profile=self.shrinkage_profile[:self.current_step + 1].copy(),
            time_points=self.time_points[:self.current_step + 1].copy(),
        )
        filepath = self.checkpoint_dir / filename
        checkpoint.save(str(filepath))
        return str(filepath)

    @classmethod
    def from_checkpoint(cls, filepath: str) -> Tuple['OptimizedFiringSimulation', Dict[str, np.ndarray]]:
        checkpoint = SimulationCheckpoint.load(filepath)
        sim = cls(checkpoint.config)

        n_existing = len(checkpoint.time_points)
        sim._setup_arrays(n_existing + 10000)

        sim.time_points[:n_existing] = checkpoint.time_points
        sim.temperature_profile[:n_existing] = checkpoint.temperature_profile
        sim.humidity_profile[:n_existing] = checkpoint.humidity_profile
        sim.oxygen_profile[:n_existing] = checkpoint.oxygen_profile
        sim.shrinkage_profile[:n_existing] = checkpoint.shrinkage_profile

        sim.current_step = checkpoint.current_step
        sim.current_time = checkpoint.current_time

        result = {
            "time": sim.time_points[:n_existing],
            "temperature": sim.temperature_profile[:n_existing],
            "humidity": sim.humidity_profile[:n_existing],
            "oxygen": sim.oxygen_profile[:n_existing],
            "shrinkage": sim.shrinkage_profile[:n_existing],
        }

        return sim, result

    def resume_simulation(self) -> Dict[str, np.ndarray]:
        remaining_time = self.config.total_time - self.current_time
        if remaining_time <= 0:
            return self._get_current_result()

        start_step = self.current_step
        t_start = self.current_time

        remaining_points = int(np.ceil(remaining_time / self.config.dt))
        t_remaining = np.linspace(t_start, self.config.total_time, remaining_points, dtype=np.float64)

        T_remaining = self._temperature_curve_vectorized(t_remaining, self.config)
        H_remaining = self._humidity_vectorized(t_remaining, T_remaining, self.config)
        O_remaining = self._oxygen_vectorized(t_remaining, T_remaining, self.config)
        S_remaining = self._shrinkage_vectorized(T_remaining, self.config)

        total_points = start_step + remaining_points
        if total_points > len(self.time_points):
            self._resize_arrays(total_points + 1000)

        self.time_points[start_step:start_step + remaining_points] = t_remaining
        self.temperature_profile[start_step:start_step + remaining_points] = T_remaining
        self.humidity_profile[start_step:start_step + remaining_points] = H_remaining
        self.oxygen_profile[start_step:start_step + remaining_points] = O_remaining
        self.shrinkage_profile[start_step:start_step + remaining_points] = S_remaining

        self.current_step = start_step + remaining_points - 1
        self.current_time = self.config.total_time

        return self._get_current_result()

    def _resize_arrays(self, new_size: int):
        new_time = np.zeros(new_size, dtype=np.float64)
        new_temp = np.zeros(new_size, dtype=np.float64)
        new_humid = np.zeros(new_size, dtype=np.float64)
        new_oxygen = np.zeros(new_size, dtype=np.float64)
        new_shrink = np.zeros(new_size, dtype=np.float64)

        n = min(self.current_step + 1, len(self.time_points))
        new_time[:n] = self.time_points[:n]
        new_temp[:n] = self.temperature_profile[:n]
        new_humid[:n] = self.humidity_profile[:n]
        new_oxygen[:n] = self.oxygen_profile[:n]
        new_shrink[:n] = self.shrinkage_profile[:n]

        self.time_points = new_time
        self.temperature_profile = new_temp
        self.humidity_profile = new_humid
        self.oxygen_profile = new_oxygen
        self.shrinkage_profile = new_shrink

    def _get_current_result(self) -> Dict[str, np.ndarray]:
        n = self.current_step + 1
        return {
            "time": self.time_points[:n],
            "temperature": self.temperature_profile[:n],
            "humidity": self.humidity_profile[:n],
            "oxygen": self.oxygen_profile[:n],
            "shrinkage": self.shrinkage_profile[:n],
        }

    def get_state_at_time(self, t: float) -> FiringState:
        if self.time_points is None:
            raise ValueError("Simulation not run yet")

        idx = np.searchsorted(self.time_points[:self.current_step + 1], t)
        idx = np.clip(idx, 0, self.current_step)

        return FiringState(
            temperature=self.temperature_profile[idx],
            humidity=self.humidity_profile[idx],
            oxygen_level=self.oxygen_profile[idx],
            shrinkage=self.shrinkage_profile[idx],
            time_elapsed=t,
            phase=self._get_phase(t),
            step=idx,
        )

    def get_memory_usage(self) -> Dict[str, float]:
        arrays = [
            ("time_points", self.time_points),
            ("temperature_profile", self.temperature_profile),
            ("humidity_profile", self.humidity_profile),
            ("oxygen_profile", self.oxygen_profile),
            ("shrinkage_profile", self.shrinkage_profile),
        ]

        usage = {}
        total = 0
        for name, arr in arrays:
            if arr is not None:
                size_mb = arr.nbytes / (1024 * 1024)
                usage[name] = size_mb
                total += size_mb
        usage["total_mb"] = total
        return usage


def _worker_run_simulation(args_tuple: Tuple[FiringConfig, int, int]) -> Dict[str, Any]:
    config, sim_id, seed = args_tuple
    np.random.seed(seed)
    sim = OptimizedFiringSimulation(config)
    result = sim.run_simulation_optimized()
    return {
        "sim_id": sim_id,
        "config": config,
        "result": result,
        "memory_usage": sim.get_memory_usage(),
    }


class ParallelSimulationEngine:
    def __init__(self, n_processes: Optional[int] = None):
        self.n_processes = n_processes or max(1, cpu_count() - 1)

    def run_batch(self, configs: List[FiringConfig]) -> List[Dict[str, Any]]:
        seeds = [np.random.randint(0, 2**32 - 1) for _ in range(len(configs))]
        args_list = [(config, i, seeds[i]) for i, config in enumerate(configs)]

        with Pool(processes=self.n_processes) as pool:
            results = pool.map(_worker_run_simulation, args_list, chunksize=1)

        return results

    def run_parameter_sweep(
        self,
        base_config: FiringConfig,
        parameter: str,
        values: List[float],
    ) -> List[Dict[str, Any]]:
        configs = []
        for val in values:
            config = FiringConfig(**{**vars(base_config), parameter: val})
            configs.append(config)
        return self.run_batch(configs)


class HighPrecisionSimulator(OptimizedFiringSimulation):
    def __init__(self, config: FiringConfig):
        super().__init__(config)
        self.error_estimate = None

    def _rk4_step(self, f: Callable, t: float, y: np.ndarray, dt: float) -> Tuple[np.ndarray, np.ndarray]:
        k1 = f(t, y)
        k2 = f(t + dt/2, y + dt/2 * k1)
        k3 = f(t + dt/2, y + dt/2 * k2)
        k4 = f(t + dt, y + dt * k3)
        y_next = y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)
        return y_next, (k1 + k2 + k3 + k4) * dt / 6

    def _temperature_derivative(self, t: float, state: np.ndarray) -> np.ndarray:
        T, H, O, S = state
        phase = self._get_phase(t)

        if phase == SimulationPhase.HEATING:
            dT_dt = self.config.heating_rate / 60
        elif phase == SimulationPhase.HOLDING:
            dT_dt = 0
        elif phase == SimulationPhase.COOLING:
            dT_dt = -self.config.cooling_rate / 60
        else:
            dT_dt = 0

        dH_dt = -0.01 * H if T < 100 else (-0.005 * H if T < 600 else 0)
        dO_dt = -0.01 * O if self.config.atmosphere == "reduction" and T > 900 else -0.00001 * O
        dS_dt = 0.001 * (15 - S) if T > 1000 else 0.0001 * S

        return np.array([dT_dt, dH_dt, dO_dt, dS_dt], dtype=np.float64)

    def run_high_precision_simulation(self) -> Dict[str, Any]:
        dt = self.config.dt / 2
        n_steps = int(np.ceil(self.config.total_time / dt))

        self._setup_arrays(n_steps + 100)

        state = np.array([
            self.config.initial_temp,
            self.config.initial_humidity,
            self.config.initial_oxygen,
            0.0,
        ], dtype=np.float64)

        t = 0.0
        step = 0
        errors = []

        while t < self.config.total_time and step < n_steps:
            state_next, delta = self._rk4_step(self._temperature_derivative, t, state, dt)
            state_next2, _ = self._rk4_step(self._temperature_derivative, t, state, dt/2)
            state_next2, _ = self._rk4_step(self._temperature_derivative, t + dt/2, state_next2, dt/2)

            error = np.max(np.abs(state_next - state_next2))
            errors.append(error)

            if error > self.config.accuracy_tolerance * 2:
                dt = max(dt / 2, self.config.min_dt)
                continue
            elif error < self.config.accuracy_tolerance / 2:
                dt = min(dt * 1.5, self.config.max_dt)

            t += dt
            step += 1
            state = state_next

            self.time_points[step] = t
            self.temperature_profile[step] = state[0]
            self.humidity_profile[step] = state[1]
            self.oxygen_profile[step] = state[2]
            self.shrinkage_profile[step] = state[3]

        self.time_points = self.time_points[:step + 1]
        self.temperature_profile = self.temperature_profile[:step + 1]
        self.humidity_profile = self.humidity_profile[:step + 1]
        self.oxygen_profile = self.oxygen_profile[:step + 1]
        self.shrinkage_profile = self.shrinkage_profile[:step + 1]

        self.current_step = step
        self.current_time = t
        self.error_estimate = np.mean(errors) if errors else 0

        return {
            "time": self.time_points,
            "temperature": self.temperature_profile,
            "humidity": self.humidity_profile,
            "oxygen": self.oxygen_profile,
            "shrinkage": self.shrinkage_profile,
            "error_estimate": self.error_estimate,
            "n_steps": step,
        }
