import numpy as np
from scipy.integrate import solve_ivp
from scipy.interpolate import interp1d


class HeatTransferSolver:
    def __init__(self, material_props):
        self.rho = material_props.get('density', 2300.0)
        self.cp = material_props.get('specific_heat', 850.0)
        self.k = material_props.get('thermal_conductivity', 1.5)
        self.alpha = self.k / (self.rho * self.cp)
        self.MIN_TEMP = 200.0
        self.MAX_TEMP = 2000.0

    def heat_equation_1d(self, t, T, x, h, T_ambient):
        n = len(T)
        dTdt = np.zeros(n)
        dx = x[1] - x[0]

        T = np.clip(T, self.MIN_TEMP, self.MAX_TEMP)

        for i in range(1, n - 1):
            dTdt[i] = self.alpha * (T[i + 1] - 2 * T[i] + T[i - 1]) / dx ** 2

        dTdt[0] = 2 * self.alpha * (T[1] - T[0]) / dx ** 2 + 2 * h * (T_ambient - T[0]) / (self.rho * self.cp * dx)
        dTdt[-1] = 2 * self.alpha * (T[-2] - T[-1]) / dx ** 2 + 2 * h * (T_ambient - T[-1]) / (self.rho * self.cp * dx)

        MAX_DT_DT = 100.0
        dTdt = np.clip(dTdt, -MAX_DT_DT, MAX_DT_DT)

        return dTdt

    def solve_transient(self, x, T_initial, t_span, h, T_ambient_func, t_eval=None):
        def ode_func(t, T):
            T_ambient = T_ambient_func(t)
            return self.heat_equation_1d(t, T, x, h, T_ambient)

        result = solve_ivp(ode_func, t_span, T_initial, t_eval=t_eval, method='RK45',
                          max_step=60.0, rtol=1e-4, atol=1e-4)

        result.y = np.clip(result.y, self.MIN_TEMP, self.MAX_TEMP)

        return result


class ThermodynamicsCalculator:
    @staticmethod
    def water_vapor_pressure(T):
        T_celsius = T - 273.15
        return 0.61078 * np.exp((17.27 * T_celsius) / (T_celsius + 237.3)) * 1000

    @staticmethod
    def relative_humidity(T, absolute_humidity, P=101325):
        P_sat = ThermodynamicsCalculator.water_vapor_pressure(T)
        P_v = absolute_humidity * P / (0.622 + absolute_humidity)
        return np.clip(P_v / P_sat * 100, 0, 100)

    @staticmethod
    def heat_capacity_ceramic(T):
        T_celsius = T - 273.15
        return 850.0 + 0.5 * T_celsius + 0.0005 * T_celsius ** 2

    @staticmethod
    def thermal_expansion(T, T_ref=293.15):
        alpha = 5e-6
        return 1 + alpha * (T - T_ref)


class AtmosphereModel:
    def __init__(self):
        self.gas_constants = {
            'O2': 0.2095,
            'N2': 0.7808,
            'CO2': 0.0004,
            'H2O': 0.0
        }

    def update_oxygen_content(self, temperature, pressure, time):
        base_o2 = 0.2095
        temp_factor = 1.0 - 0.0001 * (temperature - 293.15)
        return base_o2 * temp_factor

    def calculate_co2_production(self, temperature, organic_content):
        if temperature > 673.15:
            rate = 0.001 * (temperature - 673.15) * organic_content
            return rate
        return 0.0


class Interpolator:
    @staticmethod
    def linear_interpolate(x, y, x_new, fill_value=None):
        if fill_value is None:
            fill_value = (y[0], y[-1])
        f = interp1d(x, y, kind='linear', fill_value=fill_value, bounds_error=False)
        return f(x_new)

    @staticmethod
    def spline_interpolate(x, y, x_new, kind='cubic', fill_value=None):
        if fill_value is None:
            fill_value = (y[0], y[-1])
        f = interp1d(x, y, kind=kind, fill_value=fill_value, bounds_error=False)
        return f(x_new)

    @staticmethod
    def temperature_profile(t, profile_points):
        times = [p[0] for p in profile_points]
        temps = [p[1] for p in profile_points]
        
        t = np.asarray(t)
        scalar_input = t.ndim == 0
        if scalar_input:
            t = t[np.newaxis]
        
        result = Interpolator.linear_interpolate(times, temps, t)
        
        MIN_TEMP = 200.0
        MAX_TEMP = 2000.0
        result = np.clip(result, MIN_TEMP, MAX_TEMP)
        
        return float(result[0]) if scalar_input else result
