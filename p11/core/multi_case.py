import numpy as np
from dolfin import *
import json
import warnings
from copy import deepcopy


class LoadCase:
    def __init__(self, name, loads=None, boundary_conditions=None):
        self.name = name
        self.loads = loads or []
        self.boundary_conditions = boundary_conditions or []
        self.results = None

    def add_load(self, load):
        self.loads.append(load)

    def add_boundary_condition(self, bc):
        self.boundary_conditions.append(bc)

    def to_dict(self):
        return {
            "name": self.name,
            "num_loads": len(self.loads),
            "num_bcs": len(self.boundary_conditions)
        }


class MultiCaseSimulation:
    def __init__(self, mesh, material, base_bcs=None, problem_type="plane_stress"):
        self.mesh = mesh
        self.material = material
        self.base_bcs = base_bcs or []
        self.problem_type = problem_type
        self.load_cases = []
        self.results = {}

    def add_load_case(self, load_case):
        self.load_cases.append(load_case)

    def create_load_case(self, name, loads=None, boundary_conditions=None):
        load_case = LoadCase(name, loads, boundary_conditions)
        self.load_cases.append(load_case)
        return load_case

    def run_all_cases(self, nonlinear=False, num_load_steps=10):
        print("=" * 60)
        print(f"  开始批量仿真，共 {len(self.load_cases)} 个工况")
        print("=" * 60)

        for i, load_case in enumerate(self.load_cases):
            print(f"\n[{i+1}/{len(self.load_cases)}] 运行工况: {load_case.name}")
            
            if nonlinear:
                from .simulation import NonlinearPlaneStress, NonlinearPlaneStrain
                if self.problem_type == "plane_stress":
                    sim = NonlinearPlaneStress(self.mesh)
                else:
                    sim = NonlinearPlaneStrain(self.mesh)
            else:
                from .simulation import PlaneStress, PlaneStrain
                if self.problem_type == "plane_stress":
                    sim = PlaneStress(self.mesh)
                else:
                    sim = PlaneStrain(self.mesh)

            sim.set_material(self.material)

            for bc in self.base_bcs:
                sim.add_boundary_condition(bc)

            for bc in load_case.boundary_conditions:
                sim.add_boundary_condition(bc)

            for load in load_case.loads:
                sim.add_load(load)

            try:
                if nonlinear:
                    u = sim.solve_incremental(num_load_steps)
                else:
                    u = sim.solve()

                case_results = self._extract_results(sim, load_case.name)
                self.results[load_case.name] = case_results
                print(f"  工况 '{load_case.name}' 完成")

            except Exception as e:
                warnings.warn(f"工况 '{load_case.name}' 求解失败: {str(e)}")
                self.results[load_case.name] = {"error": str(e)}

        print("\n" + "=" * 60)
        print("  批量仿真完成")
        print("=" * 60)
        
        return self.results

    def _extract_results(self, simulation, case_name):
        results = {"name": case_name}
        
        if simulation.u is not None:
            u_values = simulation.u.compute_vertex_values(self.mesh)
            num_vertices = self.mesh.num_vertices()
            ux = u_values[:num_vertices]
            uy = u_values[num_vertices:]
            results["displacement"] = {
                "max_magnitude": float(np.max(np.sqrt(ux**2 + uy**2))),
                "max_ux": float(np.max(ux)),
                "max_uy": float(np.max(uy))
            }

        von_mises = simulation.get_von_mises_stress()
        if von_mises is not None:
            vm_values = von_mises.compute_vertex_values(self.mesh)
            results["stress"] = {
                "max_von_mises": float(np.max(vm_values)),
                "mean_von_mises": float(np.mean(vm_values))
            }

        if hasattr(simulation, 'material') and simulation.material.yield_stress:
            from postprocessing.analysis import ResultAnalyzer
            analyzer = ResultAnalyzer(simulation)
            sf = analyzer.compute_safety_factor(simulation.material.yield_stress)
            if sf:
                results["safety_factor"] = {
                    "min": sf["min"],
                    "mean": sf["mean"],
                    "below_1_ratio": sf["below_1_ratio"]
                }

        return results

    def compare_cases(self, metric="max_von_mises"):
        print("\n" + "=" * 60)
        print(f"  工况对比 - {metric}")
        print("=" * 60)

        values = []
        for name, results in self.results.items():
            if "error" in results:
                print(f"\n  {name}: 求解失败")
                continue

            val = None
            if metric == "max_von_mises" and "stress" in results:
                val = results["stress"]["max_von_mises"]
            elif metric == "max_displacement" and "displacement" in results:
                val = results["displacement"]["max_magnitude"]
            elif metric == "min_safety_factor" and "safety_factor" in results:
                val = results["safety_factor"]["min"]

            if val is not None:
                values.append((name, val))
                print(f"\n  {name}: {val:.6e}")

        if values:
            values.sort(key=lambda x: x[1])
            print(f"\n  最小值: {values[0][0]} = {values[0][1]:.6e}")
            print(f"  最大值: {values[-1][0]} = {values[-1][1]:.6e}")

        print("\n" + "=" * 60)
        return values

    def get_results_summary(self):
        summary = {}
        for name, results in self.results.items():
            summary[name] = results
        return summary

    def export_comparison_report(self, filename):
        report = {
            "num_cases": len(self.load_cases),
            "problem_type": self.problem_type,
            "material": {
                "E": self.material.E,
                "nu": self.material.nu,
                "yield_stress": self.material.yield_stress
            },
            "results": self.results
        }

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"对比报告已保存到: {filename}")
        return report
