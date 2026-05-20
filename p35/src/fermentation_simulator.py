import json
import numpy as np
from datetime import datetime
from .numerical_computation import (
    RiceWineKinetics,
    SoySauceKinetics,
    ODESolver,
    TemperatureProfile
)


class FermentationSimulator:
    def __init__(self, config_path=None, config_dict=None):
        if config_path:
            with open(config_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)
        elif config_dict:
            self.config = config_dict
        else:
            raise ValueError("必须提供config_path或config_dict")

        self.ferm_type = self.config["type"]
        self.ferm_params = self.config["fermentation"]
        self.init_conditions = self.config["initial_conditions"]

        if self.ferm_type == "rice_wine":
            self.kinetics = RiceWineKinetics(self.config)
        elif self.ferm_type == "soy_sauce":
            self.kinetics = SoySauceKinetics(self.config)
        else:
            raise ValueError(f"不支持的发酵类型: {self.ferm_type}")

        self.solver = ODESolver(self.kinetics)
        self.results = None
        self.time_points = None
        self.simulation_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    def get_initial_state(self):
        ic = self.init_conditions
        if self.ferm_type == "rice_wine":
            return [
                ic["yeast_concentration"],
                ic["bacteria_concentration"],
                ic["sugar_concentration"],
                ic["alcohol_concentration"],
                self.ferm_params["initial_temperature"],
                ic["ph"]
            ]
        elif self.ferm_type == "soy_sauce":
            return [
                ic["aspergillus_concentration"],
                ic["lactobacillus_concentration"],
                ic["yeast_concentration"],
                ic["protein_concentration"],
                ic["starch_concentration"],
                ic["amino_acid_concentration"],
                ic["salt_concentration"],
                self.ferm_params["initial_temperature"],
                ic["ph"]
            ]

    def run_simulation(self, T_profile=None, method="RK45"):
        total_time = self.ferm_params["total_time"]
        time_step = self.ferm_params["time_step"]

        if T_profile is None:
            T_profile = TemperatureProfile.from_constant(
                total_time,
                self.ferm_params["target_temperature"]
            )

        y0 = self.get_initial_state()
        t_span = (0, total_time)

        solution = self.solver.solve(
            t_span, y0,
            method=method,
            T_profile=T_profile,
            max_step=time_step
        )

        self.time_points = np.arange(0, total_time + time_step, time_step)
        self.results = self.solver.get_results_at_time(self.time_points)

        return {
            "time": self.time_points,
            "state_names": self.kinetics.state_names,
            "states": self.results,
            "simulation_id": self.simulation_id,
            "config": self.config
        }

    def get_state_at_time(self, t):
        if self.results is None:
            raise ValueError("仿真尚未运行，请先调用run_simulation()")
        idx = np.argmin(np.abs(self.time_points - t))
        return {
            name: self.results[i, idx]
            for i, name in enumerate(self.kinetics.state_names)
        }

    def calculate_quality_score(self):
        if self.results is None:
            raise ValueError("仿真尚未运行，请先调用run_simulation()")

        final_idx = -1
        if self.ferm_type == "rice_wine":
            final_alcohol = self.results[3, final_idx]
            final_sugar = self.results[2, final_idx]
            final_yeast = self.results[0, final_idx]

            alcohol_score = min(final_alcohol / 15.0, 1.0)
            sugar_score = np.exp(-((final_sugar - 30) ** 2) / 200)
            yeast_score = min(final_yeast / 2e8, 1.0)

            quality_score = 0.4 * alcohol_score + 0.3 * sugar_score + 0.3 * yeast_score

        elif self.ferm_type == "soy_sauce":
            final_aa = self.results[5, final_idx]
            final_prot = self.results[3, final_idx]
            initial_prot = self.init_conditions["protein_concentration"]

            aa_score = min(final_aa / 80.0, 1.0)
            conversion_score = min((initial_prot - final_prot) / initial_prot, 1.0)
            balance_score = np.exp(-((self.results[8, final_idx] - 4.8) ** 2) / 0.5)

            quality_score = 0.4 * aa_score + 0.35 * conversion_score + 0.25 * balance_score

        return float(quality_score)

    def get_summary_statistics(self):
        if self.results is None:
            raise ValueError("仿真尚未运行，请先调用run_simulation()")

        stats = {
            "simulation_id": self.simulation_id,
            "fermentation_type": self.ferm_type,
            "total_time_hours": float(self.time_points[-1]),
            "quality_score": self.calculate_quality_score(),
            "final_states": {}
        }

        for i, name in enumerate(self.kinetics.state_names):
            stats["final_states"][name] = float(self.results[i, -1])
            stats[f"max_{name}"] = float(np.max(self.results[i, :]))
            stats[f"min_{name}"] = float(np.min(self.results[i, :]))
            stats[f"mean_{name}"] = float(np.mean(self.results[i, :]))

        return stats

    def set_temperature_profile(self, profile_type="constant", **kwargs):
        if profile_type == "constant":
            return TemperatureProfile.from_constant(
                self.ferm_params["total_time"],
                kwargs.get("temperature", self.ferm_params["target_temperature"])
            )
        elif profile_type == "ramp":
            return TemperatureProfile.from_ramp(
                kwargs.get("t0", 0),
                kwargs.get("t1", self.ferm_params["total_time"]),
                kwargs.get("temp0", self.ferm_params["initial_temperature"]),
                kwargs.get("temp1", self.ferm_params["target_temperature"])
            )
        elif profile_type == "stages":
            return TemperatureProfile.from_stages(kwargs.get("stages", []))
        else:
            raise ValueError(f"不支持的温度曲线类型: {profile_type}")
