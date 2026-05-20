import numpy as np
from dolfin import *
import warnings


class ResultAnalyzer:
    def __init__(self, simulation):
        self.simulation = simulation
        self.mesh = simulation.mesh
        self._analysis_results = {}

    def compute_displacement_statistics(self):
        if self.simulation.u is None:
            warnings.warn("位移场未计算")
            return None

        u_values = self.simulation.u.compute_vertex_values(self.mesh)
        num_vertices = self.mesh.num_vertices()
        
        ux = u_values[:num_vertices]
        uy = u_values[num_vertices:]
        
        stats = {
            "ux": {
                "min": float(np.min(ux)),
                "max": float(np.max(ux)),
                "mean": float(np.mean(ux)),
                "std": float(np.std(ux)),
                "rms": float(np.sqrt(np.mean(ux**2)))
            },
            "uy": {
                "min": float(np.min(uy)),
                "max": float(np.max(uy)),
                "mean": float(np.mean(uy)),
                "std": float(np.std(uy)),
                "rms": float(np.sqrt(np.mean(uy**2)))
            },
            "magnitude": {
                "min": float(np.min(np.sqrt(ux**2 + uy**2))),
                "max": float(np.max(np.sqrt(ux**2 + uy**2))),
                "mean": float(np.mean(np.sqrt(ux**2 + uy**2))),
                "std": float(np.std(np.sqrt(ux**2 + uy**2)))
            }
        }
        
        self._analysis_results["displacement_statistics"] = stats
        return stats

    def find_stress_extremes(self, n_points=5):
        von_mises = self.simulation.get_von_mises_stress()
        if von_mises is None:
            warnings.warn("应力场未计算")
            return None

        vm_values = von_mises.compute_vertex_values(self.mesh)
        coordinates = self.mesh.coordinates()
        
        sorted_indices = np.argsort(vm_values)
        
        max_points = []
        for i in range(-1, -min(n_points, len(vm_values)) - 1, -1):
            idx = sorted_indices[i]
            max_points.append({
                "index": int(idx),
                "coordinates": coordinates[idx].tolist(),
                "von_mises_stress": float(vm_values[idx])
            })
        
        min_points = []
        for i in range(min(n_points, len(vm_values))):
            idx = sorted_indices[i]
            min_points.append({
                "index": int(idx),
                "coordinates": coordinates[idx].tolist(),
                "von_mises_stress": float(vm_values[idx])
            })
        
        extremes = {
            "max_stress_points": max_points,
            "min_stress_points": min_points,
            "max_von_mises": float(np.max(vm_values)),
            "min_von_mises": float(np.min(vm_values)),
            "mean_von_mises": float(np.mean(vm_values))
        }
        
        self._analysis_results["stress_extremes"] = extremes
        return extremes

    def compute_safety_factor(self, yield_stress):
        von_mises = self.simulation.get_von_mises_stress()
        if von_mises is None:
            warnings.warn("应力场未计算")
            return None

        V_scalar = FunctionSpace(self.mesh, "P", 1)
        vm_expr = von_mises / Constant(yield_stress)
        safety_factor = project(1.0 / vm_expr, V_scalar, solver_type="mumps")
        
        sf_values = safety_factor.compute_vertex_values(self.mesh)
        
        sf_stats = {
            "field": safety_factor,
            "min": float(np.min(sf_values)),
            "max": float(np.max(sf_values)),
            "mean": float(np.mean(sf_values)),
            "below_1_ratio": float(np.sum(sf_values < 1.0) / len(sf_values)),
            "below_15_ratio": float(np.sum(sf_values < 1.5) / len(sf_values))
        }
        
        self._analysis_results["safety_factor"] = sf_stats
        return sf_stats

    def compute_strain_energy(self):
        if self.simulation.u is None or self.simulation.material is None:
            warnings.warn("位移场或材料未设置")
            return None

        u = self.simulation.u
        sigma = self.simulation._sigma(u)
        epsilon = self.simulation._epsilon(u)
        energy = 0.5 * assemble(inner(sigma, epsilon) * dx)
        
        self._analysis_results["strain_energy"] = float(energy)
        return float(energy)

    def compute_principal_stresses(self):
        if self.simulation.sigma is None:
            warnings.warn("应力场未计算")
            return None

        sigma = self.simulation.sigma
        V_scalar = FunctionSpace(self.mesh, "P", 1)
        
        sigma1_expr = 0.5 * (sigma[0, 0] + sigma[1, 1]) + sqrt(0.25 * (sigma[0, 0] - sigma[1, 1])**2 + sigma[0, 1]**2)
        sigma2_expr = 0.5 * (sigma[0, 0] + sigma[1, 1]) - sqrt(0.25 * (sigma[0, 0] - sigma[1, 1])**2 + sigma[0, 1]**2)
        
        sigma1 = project(sigma1_expr, V_scalar, solver_type="mumps")
        sigma2 = project(sigma2_expr, V_scalar, solver_type="mumps")
        
        sigma1_values = sigma1.compute_vertex_values(self.mesh)
        sigma2_values = sigma2.compute_vertex_values(self.mesh)
        
        principal = {
            "sigma1_field": sigma1,
            "sigma2_field": sigma2,
            "sigma1_max": float(np.max(sigma1_values)),
            "sigma1_min": float(np.min(sigma1_values)),
            "sigma2_max": float(np.max(sigma2_values)),
            "sigma2_min": float(np.min(sigma2_values))
        }
        
        self._analysis_results["principal_stresses"] = principal
        return principal

    def full_analysis(self, yield_stress=None):
        print("=" * 60)
        print("  仿真结果综合分析")
        print("=" * 60)
        
        print("\n[1/5] 计算位移场统计...")
        disp_stats = self.compute_displacement_statistics()
        if disp_stats:
            print(f"  最大位移: {disp_stats['magnitude']['max']:.6e} m")
            print(f"  平均位移: {disp_stats['magnitude']['mean']:.6e} m")
        
        print("\n[2/5] 查找应力极值点...")
        stress_extremes = self.find_stress_extremes(n_points=5)
        if stress_extremes:
            print(f"  最大 Von Mises 应力: {stress_extremes['max_von_mises']:.6e} Pa")
            print(f"  最小 Von Mises 应力: {stress_extremes['min_von_mises']:.6e} Pa")
        
        print("\n[3/5] 计算主应力...")
        principal = self.compute_principal_stresses()
        if principal:
            print(f"  最大主应力: {principal['sigma1_max']:.6e} Pa")
            print(f"  最小主应力: {principal['sigma2_min']:.6e} Pa")
        
        print("\n[4/5] 计算应变能...")
        strain_energy = self.compute_strain_energy()
        if strain_energy:
            print(f"  总应变能: {strain_energy:.6e} J")
        
        if yield_stress is not None:
            print(f"\n[5/5] 计算安全系数 (屈服应力: {yield_stress:.6e} Pa)...")
            sf = self.compute_safety_factor(yield_stress)
            if sf:
                print(f"  最小安全系数: {sf['min']:.3f}")
                print(f"  平均安全系数: {sf['mean']:.3f}")
                print(f"  安全系数<1.0区域比例: {sf['below_1_ratio']*100:.1f}%")
        
        print("\n" + "=" * 60)
        print("  分析完成")
        print("=" * 60)
        
        return self._analysis_results

    def get_analysis_report(self):
        return self._analysis_results

    def print_report(self):
        if not self._analysis_results:
            print("暂无分析结果，请先运行分析")
            return
        
        print("\n" + "=" * 60)
        print("  分析报告")
        print("=" * 60)
        
        if "displacement_statistics" in self._analysis_results:
            print("\n--- 位移统计 ---")
            stats = self._analysis_results["displacement_statistics"]
            print(f"  X方向位移:")
            print(f"    范围: [{stats['ux']['min']:.6e}, {stats['ux']['max']:.6e}] m")
            print(f"    均值: {stats['ux']['mean']:.6e} m")
            print(f"  Y方向位移:")
            print(f"    范围: [{stats['uy']['min']:.6e}, {stats['uy']['max']:.6e}] m")
            print(f"    均值: {stats['uy']['mean']:.6e} m")
            print(f"  合位移:")
            print(f"    最大值: {stats['magnitude']['max']:.6e} m")
        
        if "stress_extremes" in self._analysis_results:
            print("\n--- 应力极值 ---")
            extremes = self._analysis_results["stress_extremes"]
            print(f"  最大 Von Mises 应力: {extremes['max_von_mises']:.6e} Pa")
            print(f"  应力最大点坐标: {extremes['max_stress_points'][0]['coordinates']}")
        
        if "safety_factor" in self._analysis_results:
            print("\n--- 安全系数 ---")
            sf = self._analysis_results["safety_factor"]
            print(f"  最小值: {sf['min']:.3f}")
            print(f"  均值: {sf['mean']:.3f}")
            print(f"  安全系数<1.0区域: {sf['below_1_ratio']*100:.1f}%")
        
        if "strain_energy" in self._analysis_results:
            print("\n--- 应变能 ---")
            print(f"  总应变能: {self._analysis_results['strain_energy']:.6e} J")
        
        print("\n" + "=" * 60)
