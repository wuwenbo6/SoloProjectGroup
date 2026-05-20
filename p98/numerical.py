import numpy as np
from scipy.integrate import odeint, solve_ivp
from scipy.interpolate import interp1d
from typing import Callable, Tuple, Optional, List, Dict
from numba import jit, njit


class MultiStrainKinetics:
    def __init__(self, strains: List[Dict], environment_params: Dict):
        self.strains = strains
        self.env_params = environment_params
        self.n_strains = len(strains)

    @staticmethod
    @njit
    def _monod_growth(s: float, mu_max: float, ks: float) -> float:
        return mu_max * s / (ks + s) if s > 0 else 0

    @staticmethod
    @njit
    def _arrhenius_rate(k_ref: float, e_a: float, t: float, t_ref: float = 298.15) -> float:
        r = 8.314
        return k_ref * np.exp(e_a / r * (1 / t_ref - 1 / t))

    def _interaction_term(self, biomass_i: float, biomass_j: float, 
                          alpha_ij: float, beta_ij: float) -> float:
        return alpha_ij * biomass_i * biomass_j / (1 + beta_ij * biomass_j)

    def multi_strain_odes(self, y: np.ndarray, t: float) -> np.ndarray:
        temp = y[0]
        hum = y[1]
        biomass_array = y[2:2+self.n_strains]
        substrate = y[2+self.n_strains]
        product = y[3+self.n_strains]
        co2 = y[4+self.n_strains]
        
        temp = np.clip(temp, 0, 100)
        hum = np.clip(hum, 0, 1)
        biomass_array = np.clip(biomass_array, 0, 500)
        substrate = np.clip(substrate, 0, 10000)
        
        temp_k = temp + 273.15
        
        dbiomass_dt = np.zeros(self.n_strains)
        dsubstrate_dt = 0
        dproduct_dt = 0
        total_heat = 0
        
        for i, strain in enumerate(self.strains):
            biomass_i = biomass_array[i]
            mu_max = strain['mu_max']
            ks = strain['ks']
            y_xs = strain['y_xs']
            y_ps = strain['y_ps']
            m_s = strain['m_s']
            k_heat = strain.get('k_heat', 20)
            e_a = strain.get('e_a', 50000)
            temp_opt = strain.get('temp_opt', 30)
            hum_opt = strain.get('hum_opt', 0.7)
            
            mu = self._arrhenius_rate(mu_max, e_a, temp_k) * self._monod_growth(substrate, mu_max, ks)
            mu = mu * np.exp(-((temp - temp_opt) / 8) ** 2)
            mu = mu * np.exp(-((hum - hum_opt) / 0.25) ** 2)
            mu = np.clip(mu, -5, 5)
            
            substrate_inhibition = substrate / (1 + substrate / 200) if substrate > 0 else 0
            mu = mu * substrate_inhibition
            
            carrying_capacity = strain.get('carrying_capacity', 80)
            growth_inhibition = max(0, 1 - biomass_i / carrying_capacity)
            mu = mu * growth_inhibition
            
            interaction = 0
            for j, other_strain in enumerate(self.strains):
                if i != j:
                    alpha_ij = other_strain.get('interaction_alpha', {}).get(i, 0)
                    beta_ij = other_strain.get('interaction_beta', {}).get(i, 1)
                    interaction += self._interaction_term(biomass_array[j], biomass_i, alpha_ij, beta_ij)
            
            mu += interaction
            
            r_x = mu * biomass_i
            maintenance = m_s * biomass_i if substrate > 0 else 0
            r_s = -abs(r_x) / y_xs - maintenance
            
            if substrate <= 0:
                r_s = 0
                r_x = -0.005 * biomass_i
            
            r_p = abs(r_x) * y_ps if r_x > 0 else 0
            r_co2 = abs(r_s) * 0.5
            
            dbiomass_dt[i] = r_x
            dsubstrate_dt += r_s
            dproduct_dt += r_p
            total_heat += abs(r_s) * k_heat
        
        dsubstrate_dt = np.clip(dsubstrate_dt, -100, 10)
        dproduct_dt = np.clip(dproduct_dt, 0, 100)
        
        ua = self.env_params['ua']
        mass = self.env_params['mass']
        cp = self.env_params['cp']
        env_temp = self.env_params['env_temp']
        target_hum = self.env_params['target_hum']
        evap_rate = self.env_params['evap_rate']
        vent_rate = self.env_params['vent_rate']
        
        q_heat = total_heat * 1000
        q_loss = ua * (temp - env_temp)
        dtemp_dt = (q_heat - q_loss) / (mass * cp)
        dhum_dt = vent_rate * (target_hum - hum) - evap_rate * hum
        
        dtemp_dt = np.clip(dtemp_dt, -5, 5)
        dhum_dt = np.clip(dhum_dt, -0.1, 0.1)
        dbiomass_dt = np.clip(dbiomass_dt, -10, 100)
        dco2_dt = abs(dsubstrate_dt) * 0.5
        
        result = np.concatenate([[dtemp_dt, dhum_dt], dbiomass_dt, [dsubstrate_dt, dproduct_dt, dco2_dt]])
        return result

    def solve_multi_strain(self, y0: np.ndarray, t_span: Tuple[float, float], 
                          t_eval: np.ndarray, method: str = 'fast_ode') -> dict:
        if method == 'fast_ode':
            solution = odeint(self.multi_strain_odes, y0, t_eval, mxstep=2000)
        else:
            sol = solve_ivp(lambda t, y: self.multi_strain_odes(y, t), t_span, y0, t_eval=t_eval, method='RK45')
            solution = sol.y.T
        
        results = {
            'time': t_eval,
            'temperature': solution[:, 0],
            'humidity': solution[:, 1],
            'substrate': solution[:, 2+self.n_strains],
            'product': solution[:, 3+self.n_strains],
            'co2': solution[:, 4+self.n_strains]
        }
        
        for i in range(self.n_strains):
            results[f'biomass_{i}'] = solution[:, 2+i]
        
        total_biomass = np.sum(solution[:, 2:2+self.n_strains], axis=1)
        results['total_biomass'] = total_biomass
        
        return results


class FermentationKinetics:
    def __init__(self, params: dict):
        self.params = params

    @staticmethod
    @njit
    def monod_growth(s: float, mu_max: float, ks: float) -> float:
        return mu_max * s / (ks + s) if s > 0 else 0

    @staticmethod
    @njit
    def arrhenius_rate(k_ref: float, e_a: float, t: float, t_ref: float = 298.15) -> float:
        r = 8.314
        return k_ref * np.exp(e_a / r * (1 / t_ref - 1 / t))

    def temperature_dynamics(self, t: float, temp: float, env_temp: float, 
                            heat_production: float, ua: float, mass: float, cp: float) -> float:
        q_heat = heat_production * 1000
        q_loss = ua * (temp - env_temp)
        return (q_heat - q_loss) / (mass * cp)

    def humidity_dynamics(self, t: float, hum: float, target_hum: float, 
                         evap_rate: float, vent_rate: float) -> float:
        return vent_rate * (target_hum - hum) - evap_rate * hum

    @staticmethod
    @njit
    def _fermentation_core(y: np.ndarray, mu_max: float, ks: float, y_xs: float, 
                           y_ps: float, m_s: float, k_heat: float, ua: float, 
                           mass: float, cp: float, env_temp: float, target_hum: float,
                           evap_rate: float, vent_rate: float) -> np.ndarray:
        temp, hum, biomass, substrate, product, co2 = y
        
        temp = max(0, min(100, temp))
        hum = max(0, min(1, hum))
        biomass = max(0, min(1000, biomass))
        substrate = max(0, min(10000, substrate))
        
        temp_k = temp + 273.15
        r = 8.314
        arrhenius = np.exp(20000 / r * (1 / 298.15 - 1 / temp_k))
        mu = mu_max * arrhenius * substrate / (ks + substrate) if substrate > 0 else 0
        
        mu = mu * np.exp(-((temp - 30) / 20) ** 2)
        mu = mu * np.exp(-((hum - 0.7) / 0.5) ** 2)
        mu = max(-10, min(10, mu))
        
        substrate_inhibition = substrate / (1 + substrate / 200) if substrate > 0 else 0
        mu = mu * substrate_inhibition
        
        carrying_capacity = 100
        growth_inhibition = max(0, 1 - biomass / carrying_capacity)
        mu = mu * growth_inhibition
        
        r_x = mu * biomass
        
        maintenance = m_s * biomass if substrate > 0 else 0
        r_s = -r_x / y_xs - maintenance
        
        if substrate <= 0:
            r_s = 0
            r_x = -0.01 * biomass
        
        r_p = r_x * y_ps if r_x > 0 else 0
        r_co2 = abs(r_s) * 0.5
        
        heat_prod = abs(r_s) * k_heat if r_s < 0 else 0
        q_heat = heat_prod * 1000
        q_loss = ua * (temp - env_temp)
        dtemp_dt = (q_heat - q_loss) / (mass * cp)
        dhum_dt = vent_rate * (target_hum - hum) - evap_rate * hum
        
        dtemp_dt = max(-5, min(5, dtemp_dt))
        dhum_dt = max(-0.1, min(0.1, dhum_dt))
        r_x = max(-10, min(100, r_x))
        r_s = max(-100, min(10, r_s))
        r_p = max(-10, min(100, r_p))
        r_co2 = max(0, min(100, r_co2))
        
        return np.array([dtemp_dt, dhum_dt, r_x, r_s, r_p, r_co2])

    def fermentation_odes(self, y: np.ndarray, t: float, *args) -> np.ndarray:
        return self._fermentation_core(y, *args)

    def solve_fermentation(self, y0: np.ndarray, t_span: Tuple[float, float], 
                          t_eval: np.ndarray, method: str = 'odeint') -> dict:
        args = (
            self.params['mu_max'], self.params['ks'], self.params['y_xs'],
            self.params['y_ps'], self.params['m_s'], self.params['k_heat'],
            self.params['ua'], self.params['mass'], self.params['cp'],
            self.params['env_temp'], self.params['target_hum'],
            self.params['evap_rate'], self.params['vent_rate']
        )
        
        if method in ['odeint', 'fast_ode']:
            solution = odeint(self.fermentation_odes, y0, t_eval, args=args, mxstep=2000)
        else:
            def ode_wrapper(t, y):
                return self.fermentation_odes(y, t, *args)
            sol = solve_ivp(ode_wrapper, t_span, y0, t_eval=t_eval, method=method)
            solution = sol.y.T
        
        return {
            'time': t_eval,
            'temperature': solution[:, 0],
            'humidity': solution[:, 1],
            'biomass': solution[:, 2],
            'substrate': solution[:, 3],
            'product': solution[:, 4],
            'co2': solution[:, 5]
        }


class DataInterpolator:
    @staticmethod
    def interpolate_time_series(time: np.ndarray, values: np.ndarray, 
                               new_time: np.ndarray, kind: str = 'linear') -> np.ndarray:
        interp_func = interp1d(time, values, kind=kind, fill_value='extrapolate')
        return interp_func(new_time)

    @staticmethod
    def smooth_data(data: np.ndarray, window_size: int = 5) -> np.ndarray:
        kernel = np.ones(window_size) / window_size
        return np.convolve(data, kernel, mode='same')

    @staticmethod
    def calculate_derivative(time: np.ndarray, values: np.ndarray) -> np.ndarray:
        return np.gradient(values, time)

    @staticmethod
    def calculate_integral(time: np.ndarray, values: np.ndarray) -> np.ndarray:
        return np.cumsum(values * np.gradient(time))
