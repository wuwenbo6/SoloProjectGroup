import numpy as np
from scipy.integrate import solve_ivp
from scipy.interpolate import interp1d


class FermentationKinetics:
    def __init__(self, config):
        self.config = config
        self.kinetics_params = config["kinetics"]
        self.ferm_params = config["fermentation"]

    def arrhenius_correction(self, T, T_ref=30.0):
        Ea = self.kinetics_params.get("temperature_sensitivity", 0.05) * 1000
        R = 8.314
        return np.exp(Ea / R * (1 / (T_ref + 273.15) - 1 / (T + 273.15)))

    def ph_correction(self, ph):
        ph_opt = self.kinetics_params.get("ph_optimal", 4.5)
        ph_range = self.kinetics_params.get("ph_range", 1.0)
        return np.exp(-((ph - ph_opt) ** 2) / (2 * ph_range ** 2))

    def substrate_inhibition(self, S, Ks, Ki):
        return S / (Ks + S + S ** 2 / Ki)

    def monod_kinetics(self, S, X, Ks, mu_max):
        return mu_max * X * S / (Ks + S)


class RiceWineKinetics(FermentationKinetics):
    def __init__(self, config):
        super().__init__(config)
        self.state_names = ["yeast", "bacteria", "sugar", "alcohol", "temperature", "ph"]

    def ode_system(self, t, y, T_profile=None):
        X_yeast, X_bact, S, P, T, ph = y

        X_yeast = max(1.0, min(X_yeast, 1e12))
        X_bact = max(1.0, min(X_bact, 1e12))
        S = max(0.0, min(S, 500.0))
        P = max(0.0, min(P, 20.0))
        T = max(0.0, min(T, 50.0))
        ph = max(2.0, min(ph, 10.0))

        if T_profile is not None:
            T = float(T_profile(t))

        temp_corr = self.arrhenius_correction(T)
        ph_corr = self.ph_correction(ph)

        mu_max_yeast = self.kinetics_params["yeast_growth_rate"] * temp_corr * ph_corr
        mu_max_bact = self.kinetics_params["bacteria_growth_rate"] * temp_corr * ph_corr

        Ks_sugar = 5.0
        K_carrying = 1e10

        mu_yeast = mu_max_yeast * S / (Ks_sugar + S) * (1 - X_yeast / K_carrying)
        mu_bact = mu_max_bact * S / (Ks_sugar + S) * 0.8 * (1 - X_bact / K_carrying)

        Kd_yeast = 0.01 * (1 + 0.1 * max(0, P - 5)) + 0.001 * X_yeast / K_carrying
        Kd_bact = 0.02 * (1 + 0.15 * max(0, P - 3)) + 0.001 * X_bact / K_carrying

        Y_xs_yeast = 0.1
        Y_ps_yeast = 0.45
        Y_xs_bact = 0.08

        if S <= 0:
            r_sugar = 0.0
            r_alcohol = 0.0
        else:
            r_sugar = -(mu_yeast / Y_xs_yeast + mu_bact / Y_xs_bact) * X_yeast * 0.1
            r_alcohol = -r_sugar * Y_ps_yeast * (X_yeast / (X_yeast + X_bact + 1e-10))

        dX_yeast_dt = mu_yeast * X_yeast - Kd_yeast * X_yeast
        dX_bact_dt = mu_bact * X_bact - Kd_bact * X_bact
        dS_dt = r_sugar
        dP_dt = r_alcohol

        T_target = self.ferm_params["target_temperature"]
        dT_dt = 0.1 * (T_target - T) + 0.05 * (X_yeast + X_bact) * 1e-6

        dph_dt = -0.01 * X_bact * 1e-6 + 0.005 * (ph - 4.0)

        max_rate = 1e8
        dX_yeast_dt = max(-max_rate, min(dX_yeast_dt, max_rate))
        dX_bact_dt = max(-max_rate, min(dX_bact_dt, max_rate))
        dS_dt = max(-100, min(dS_dt, 100))
        dP_dt = max(-10, min(dP_dt, 10))
        dT_dt = max(-5, min(dT_dt, 5))
        dph_dt = max(-0.1, min(dph_dt, 0.1))

        return [dX_yeast_dt, dX_bact_dt, dS_dt, dP_dt, dT_dt, dph_dt]


class SoySauceKinetics(FermentationKinetics):
    def __init__(self, config):
        super().__init__(config)
        self.state_names = [
            "aspergillus", "lactobacillus", "yeast",
            "protein", "starch", "amino_acid", "salt", "temperature", "ph"
        ]

    def ode_system(self, t, y, T_profile=None):
        X_aspg, X_lacto, X_yeast, Prot, Starch, AA, Salt, T, ph = y

        X_aspg = max(1.0, min(X_aspg, 1e12))
        X_lacto = max(1.0, min(X_lacto, 1e12))
        X_yeast = max(1.0, min(X_yeast, 1e12))
        Prot = max(0.0, min(Prot, 500.0))
        Starch = max(0.0, min(Starch, 300.0))
        AA = max(0.0, min(AA, 100.0))
        Salt = max(0.0, min(Salt, 300.0))
        T = max(0.0, min(T, 50.0))
        ph = max(2.0, min(ph, 10.0))

        if T_profile is not None:
            T = float(T_profile(t))

        temp_corr = self.arrhenius_correction(T)
        ph_corr = self.ph_correction(ph)
        salt_corr = np.exp(-self.kinetics_params["salt_tolerance"] * max(0, Salt - 150) / 100)

        mu_max_aspg = self.kinetics_params["aspergillus_growth_rate"] * temp_corr * ph_corr
        mu_max_lacto = self.kinetics_params["lactobacillus_growth_rate"] * temp_corr * ph_corr * salt_corr
        mu_max_yeast = self.kinetics_params["yeast_growth_rate"] * temp_corr * ph_corr * salt_corr

        Ks_prot = 10.0
        Ks_starch = 8.0
        K_carrying = 5e9

        mu_aspg = mu_max_aspg * Prot / (Ks_prot + Prot) * Starch / (Ks_starch + Starch) * (1 - X_aspg / K_carrying)
        mu_lacto = mu_max_lacto * (Starch + AA) / (5.0 + Starch + AA) * (1 - X_lacto / K_carrying)
        mu_yeast = mu_max_yeast * AA / (3.0 + AA) * (1 - X_yeast / K_carrying)

        Kd_aspg = 0.005 * (1 + 0.2 * max(0, ph - 5.5)) + 0.0005 * X_aspg / K_carrying
        Kd_lacto = 0.008 * (1 + 0.1 * max(0, ph - 5.0)) + 0.0005 * X_lacto / K_carrying
        Kd_yeast = 0.006 * (1 + 0.15 * max(0, Salt - 180) / 50) + 0.0005 * X_yeast / K_carrying

        r_prot_decomp = self.kinetics_params["protein_decomposition_rate"] * X_aspg * Prot / (Ks_prot + Prot) if Prot > 0 else 0.0
        r_starch_conv = self.kinetics_params["starch_conversion_rate"] * X_aspg * Starch / (Ks_starch + Starch) if Starch > 0 else 0.0
        r_aa_prod = self.kinetics_params["amino_acid_production_rate"] * r_prot_decomp

        dX_aspg_dt = mu_aspg * X_aspg - Kd_aspg * X_aspg
        dX_lacto_dt = mu_lacto * X_lacto - Kd_lacto * X_lacto
        dX_yeast_dt = mu_yeast * X_yeast - Kd_yeast * X_yeast
        dProt_dt = -r_prot_decomp
        dStarch_dt = -r_starch_conv
        dAA_dt = r_aa_prod - 0.3 * (mu_lacto * X_lacto + mu_yeast * X_yeast) * 0.01
        dSalt_dt = 0.0

        T_target = self.ferm_params["target_temperature"]
        dT_dt = 0.05 * (T_target - T) + 0.02 * (X_aspg + X_lacto + X_yeast) * 1e-6

        dph_dt = -0.005 * X_lacto * 1e-6 + 0.002 * (ph - 4.8)

        max_rate = 1e8
        dX_aspg_dt = max(-max_rate, min(dX_aspg_dt, max_rate))
        dX_lacto_dt = max(-max_rate, min(dX_lacto_dt, max_rate))
        dX_yeast_dt = max(-max_rate, min(dX_yeast_dt, max_rate))
        dProt_dt = max(-50, min(dProt_dt, 50))
        dStarch_dt = max(-30, min(dStarch_dt, 30))
        dAA_dt = max(-10, min(dAA_dt, 10))
        dT_dt = max(-3, min(dT_dt, 3))
        dph_dt = max(-0.05, min(dph_dt, 0.05))

        return [dX_aspg_dt, dX_lacto_dt, dX_yeast_dt, dProt_dt, dStarch_dt, dAA_dt, dSalt_dt, dT_dt, dph_dt]


class ODESolver:
    def __init__(self, kinetics_model):
        self.kinetics = kinetics_model
        self.solution = None

    def solve(self, t_span, y0, method="RK45", T_profile=None, max_step=np.inf):
        def ode_wrapper(t, y):
            return self.kinetics.ode_system(t, y, T_profile)

        self.solution = solve_ivp(
            ode_wrapper,
            t_span,
            y0,
            method=method,
            max_step=max_step,
            dense_output=True
        )
        return self.solution

    def get_results_at_time(self, t_eval):
        if self.solution is None:
            raise ValueError("ODE尚未求解，请先调用solve()方法")
        return self.solution.sol(t_eval)


class TemperatureProfile:
    def __init__(self, time_points, temp_points):
        self.time_points = np.array(time_points)
        self.temp_points = np.array(temp_points)
        self.interpolator = interp1d(
            self.time_points, self.temp_points,
            kind='linear', fill_value='extrapolate'
        )

    @classmethod
    def from_constant(cls, total_time, temp):
        return cls([0, total_time], [temp, temp])

    @classmethod
    def from_ramp(cls, t0, t1, temp0, temp1):
        return cls([t0, t1], [temp0, temp1])

    @classmethod
    def from_stages(cls, stages):
        times = []
        temps = []
        current_time = 0
        for duration, temp in stages:
            times.extend([current_time, current_time + duration])
            temps.extend([temp, temp])
            current_time += duration
        return cls(times, temps)

    def __call__(self, t):
        return self.interpolator(t)
