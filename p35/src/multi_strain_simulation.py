import numpy as np
from scipy.integrate import solve_ivp
from typing import Dict, List, Tuple, Optional, Callable
import copy
from dataclasses import dataclass


@dataclass
class StrainProperties:
    """菌株属性定义"""
    name: str
    growth_rate: float = 0.3
    death_rate: float = 0.01
    substrate_affinity: float = 5.0
    production_yield: float = 0.45
    inhibition_coefficient: float = 10.0
    optimal_temp: float = 30.0
    optimal_ph: float = 4.5
    temp_sensitivity: float = 0.05
    ph_sensitivity: float = 0.1


@dataclass
class StrainInteraction:
    """菌株相互作用定义"""
    strain_a: str
    strain_b: str
    interaction_type: str  # "competition", "synergy", "antagonism", "neutral"
    strength: float = 0.0


class MultiStrainDynamics:
    """多菌株发酵协同动力学模型"""

    def __init__(self, config: Dict, strains: List[StrainProperties],
                 interactions: Optional[List[StrainInteraction]] = None):
        self.config = config
        self.strains = strains
        self.interactions = interactions or []
        self.n_strains = len(strains)
        self.state_names = self._build_state_names()

    def _build_state_names(self) -> List[str]:
        """构建状态变量名称列表"""
        names = []
        for strain in self.strains:
            names.append(f"{strain.name}_biomass")
        names.append("substrate")
        names.append("product")
        names.append("temperature")
        names.append("ph")
        return names

    def _get_interaction_effect(self, strain_idx: int, biomasses: np.ndarray) -> float:
        """计算菌株间相互作用效应"""
        effect = 0.0
        strain_name = self.strains[strain_idx].name

        for interaction in self.interactions:
            other_idx = None
            factor = 0.0

            if interaction.strain_a == strain_name:
                for i, s in enumerate(self.strains):
                    if s.name == interaction.strain_b:
                        other_idx = i
                        break
            elif interaction.strain_b == strain_name:
                for i, s in enumerate(self.strains):
                    if s.name == interaction.strain_a:
                        other_idx = i
                        break

            if other_idx is not None:
                if interaction.interaction_type == "competition":
                    factor = -interaction.strength * biomasses[other_idx] / (1 + biomasses[other_idx])
                elif interaction.interaction_type == "synergy":
                    factor = interaction.strength * biomasses[other_idx] / (10 + biomasses[other_idx])
                elif interaction.interaction_type == "antagonism":
                    factor = -interaction.strength * biomasses[other_idx] / (1 + biomasses[other_idx])

                effect += factor

        return effect

    def _temp_correction(self, strain: StrainProperties, T: float) -> float:
        """温度修正因子"""
        delta_T = T - strain.optimal_temp
        return np.exp(-strain.temp_sensitivity * delta_T ** 2)

    def _ph_correction(self, strain: StrainProperties, ph: float) -> float:
        """pH修正因子"""
        delta_ph = ph - strain.optimal_ph
        return np.exp(-strain.ph_sensitivity * delta_ph ** 2)

    def ode_system(self, t: float, y: np.ndarray, T_profile: Optional[Callable] = None) -> List[float]:
        """多菌株ODE系统"""
        biomasses = y[:self.n_strains]
        S = y[self.n_strains]
        P = y[self.n_strains + 1]
        T = y[self.n_strains + 2]
        ph = y[self.n_strains + 3]

        if T_profile is not None:
            T = float(T_profile(t))

        d_biomass = np.zeros(self.n_strains)
        total_substrate_consumption = 0.0
        total_production = 0.0

        for i, strain in enumerate(self.strains):
            X = biomasses[i]

            temp_corr = self._temp_correction(strain, T)
            ph_corr = self._ph_correction(strain, ph)

            mu_max = strain.growth_rate * temp_corr * ph_corr
            mu = mu_max * S / (strain.substrate_affinity + S)

            product_inhibition = 1 / (1 + P / strain.inhibition_coefficient)
            mu *= product_inhibition

            interaction_effect = self._get_interaction_effect(i, biomasses)
            mu_effective = mu * (1 + interaction_effect)

            growth_term = mu_effective * X
            death_term = strain.death_rate * X
            d_biomass[i] = growth_term - death_term

            substrate_yield = 1 / (0.1 + 0.1 * mu_max)
            substrate_consumption = (mu_effective / substrate_yield) * X
            total_substrate_consumption += substrate_consumption

            production = substrate_consumption * strain.production_yield
            total_production += production

        dS_dt = -total_substrate_consumption
        dP_dt = total_production

        T_target = self.config["fermentation"]["target_temperature"]
        dT_dt = 0.1 * (T_target - T) + 0.02 * np.sum(biomasses) * 1e-6

        ph_acidification = 0.001 * np.sum(biomasses) * 1e-6
        dph_dt = -ph_acidification + 0.005 * (ph - 4.0)

        dS_dt = max(-100, min(dS_dt, 100))
        dP_dt = max(-50, min(dP_dt, 50))
        dT_dt = max(-5, min(dT_dt, 5))
        dph_dt = max(-0.1, min(dph_dt, 0.1))

        d_biomass = np.clip(d_biomass, -1e8, 1e8)

        result = list(d_biomass) + [dS_dt, dP_dt, dT_dt, dph_dt]
        return result

    def simulate(self, initial_conditions: Dict, t_span: Tuple[float, float],
                 dt: float = 0.5, T_profile: Optional[Callable] = None) -> Dict:
        """执行多菌株发酵仿真"""
        y0 = []
        for strain in self.strains:
            y0.append(initial_conditions.get(f"{strain.name}_biomass", 1e6))

        y0.append(initial_conditions.get("substrate", 150.0))
        y0.append(initial_conditions.get("product", 0.0))
        y0.append(initial_conditions.get("temperature", 25.0))
        y0.append(initial_conditions.get("ph", 5.5))

        y0 = np.array(y0, dtype=np.float64)

        def ode_wrapper(t, y):
            return self.ode_system(t, y, T_profile)

        solution = solve_ivp(
            ode_wrapper,
            t_span,
            y0,
            method='RK45',
            max_step=dt,
            rtol=1e-6,
            atol=1e-8
        )

        return {
            "time": solution.t,
            "states": solution.y,
            "state_names": self.state_names,
            "n_strains": self.n_strains,
            "strain_names": [s.name for s in self.strains]
        }


class CoCultureOptimizer:
    """多菌株共培养优化器"""

    def __init__(self, base_config: Dict):
        self.base_config = base_config
        self.optimization_results = []

    def evaluate_inoculum_ratio(self, strain_names: List[str], ratios: np.ndarray,
                                 total_inoculum: float = 1e6) -> Dict:
        """评估接种比例对发酵效果的影响"""
        strains = []
        for i, name in enumerate(strain_names):
            strains.append(StrainProperties(
                name=name,
                growth_rate=0.25 + i * 0.05,
                production_yield=0.4 + i * 0.05
            ))

        dynamics = MultiStrainDynamics(self.base_config, strains)
        initial_conditions = {f"{name}_biomass": total_inoculum * ratios[i]
                              for i, name in enumerate(strain_names)}
        initial_conditions["substrate"] = 150.0
        initial_conditions["product"] = 0.0
        initial_conditions["temperature"] = 30.0
        initial_conditions["ph"] = 5.5

        results = dynamics.simulate(initial_conditions, (0, 120), dt=1.0)

        final_product = results["states"][-3, -1]
        total_biomass = np.sum(results["states"][:-4, -1])
        substrate_utilization = 1 - results["states"][-4, -1] / 150.0

        return {
            "ratios": ratios.tolist(),
            "final_product": float(final_product),
            "total_biomass": float(total_biomass),
            "substrate_utilization": float(substrate_utilization),
            "performance_score": float(final_product * substrate_utilization)
        }

    def optimize_inoculum(self, strain_names: List[str], n_points: int = 20) -> Dict:
        """优化菌株接种比例"""
        n_strains = len(strain_names)
        best_ratio = None
        best_score = 0.0

        results = []
        for _ in range(n_points):
            ratios = np.random.dirichlet(np.ones(n_strains))
            result = self.evaluate_inoculum_ratio(strain_names, ratios)
            results.append(result)

            if result["performance_score"] > best_score:
                best_score = result["performance_score"]
                best_ratio = ratios

        return {
            "best_ratio": best_ratio.tolist() if best_ratio is not None else None,
            "best_score": float(best_score),
            "all_results": results
        }
