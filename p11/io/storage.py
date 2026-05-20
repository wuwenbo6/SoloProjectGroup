import json
import h5py
import numpy as np
from dolfin import *
from datetime import datetime
import os


class SimulationConfig:
    def __init__(self):
        self.config = {
            "metadata": {
                "created": datetime.now().isoformat(),
                "version": "2.0",
                "description": "FEniCS 2D 弹性力学仿真配置"
            },
            "problem": {
                "type": "plane_stress",
                "is_nonlinear": False
            },
            "geometry": {},
            "mesh": {
                "nx": 20,
                "ny": 20,
                "type": "structured"
            },
            "material": {
                "E": 210e9,
                "nu": 0.3,
                "rho": 7850.0,
                "yield_stress": None,
                "hardening_modulus": 0.0
            },
            "solver": {
                "linear_solver": "mumps",
                "preconditioner": "default",
                "regularization": True,
                "regularization_epsilon": 1e-10,
                "nonlinear_max_iterations": 50,
                "nonlinear_tolerance": 1e-6,
                "num_load_steps": 10
            },
            "boundary_conditions": [],
            "load_cases": []
        }
        self._mesh = None
        self._material = None
        self._bcs = []

    def set_problem_type(self, problem_type, is_nonlinear=False):
        self.config["problem"]["type"] = problem_type
        self.config["problem"]["is_nonlinear"] = is_nonlinear

    def set_rectangle_geometry(self, x_min, x_max, y_min, y_max, nx=20, ny=20, mesh_type="structured"):
        self.config["geometry"] = {
            "type": "rectangle",
            "x_min": x_min,
            "x_max": x_max,
            "y_min": y_min,
            "y_max": y_max
        }
        self.config["mesh"]["nx"] = nx
        self.config["mesh"]["ny"] = ny
        self.config["mesh"]["type"] = mesh_type

    def set_beam_geometry(self, length, height, nx=50, ny=10):
        self.config["geometry"] = {
            "type": "beam",
            "length": length,
            "height": height
        }
        self.config["mesh"]["nx"] = nx
        self.config["mesh"]["ny"] = ny

    def set_material(self, E, nu, rho=7850.0, yield_stress=None, hardening_modulus=0.0):
        self.config["material"] = {
            "E": E,
            "nu": nu,
            "rho": rho,
            "yield_stress": yield_stress,
            "hardening_modulus": hardening_modulus
        }

    def set_solver_params(self, linear_solver="mumps", regularization=True,
                          regularization_epsilon=1e-10, nonlinear_max_iterations=50,
                          nonlinear_tolerance=1e-6, num_load_steps=10):
        self.config["solver"].update({
            "linear_solver": linear_solver,
            "regularization": regularization,
            "regularization_epsilon": regularization_epsilon,
            "nonlinear_max_iterations": nonlinear_max_iterations,
            "nonlinear_tolerance": nonlinear_tolerance,
            "num_load_steps": num_load_steps
        })

    def add_fixed_boundary(self, location, description=""):
        bc = {
            "type": "fixed",
            "location": location,
            "description": description
        }
        self.config["boundary_conditions"].append(bc)

    def add_displacement_boundary(self, location, component, value, description=""):
        bc = {
            "type": "displacement",
            "location": location,
            "component": component,
            "value": value,
            "description": description
        }
        self.config["boundary_conditions"].append(bc)

    def add_load_case(self, name, loads, description=""):
        load_case = {
            "name": name,
            "description": description,
            "loads": loads
        }
        self.config["load_cases"].append(load_case)

    def create_boundary_load(self, location, value, load_type="force"):
        return {
            "type": load_type,
            "location": location,
            "value": value if isinstance(value, list) else [float(value[0]), float(value[1])]
        }

    def validate(self):
        errors = []
        if not self.config["geometry"]:
            errors.append("几何参数未设置")
        if not self.config["material"].get("E"):
            errors.append("材料参数未设置")
        if not self.config["boundary_conditions"]:
            errors.append("边界条件未设置")
        if not self.config["load_cases"]:
            errors.append("荷载工况未设置")
        return errors

    def save(self, filename):
        errors = self.validate()
        if errors:
            print("警告: 配置存在以下问题:")
            for err in errors:
                print(f"  - {err}")

        self.config["metadata"]["last_modified"] = datetime.now().isoformat()
        
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
        
        print(f"配置已保存到: {filename}")
        return True

    @staticmethod
    def load(filename):
        if not os.path.exists(filename):
            raise FileNotFoundError(f"配置文件不存在: {filename}")
        
        with open(filename, "r", encoding="utf-8") as f:
            config_data = json.load(f)
        
        sim_config = SimulationConfig()
        sim_config.config = config_data
        print(f"配置已从 {filename} 加载")
        return sim_config

    def get_config(self):
        return self.config

    def print_summary(self):
        print("\n" + "=" * 60)
        print("  仿真配置摘要")
        print("=" * 60)
        
        print(f"\n问题类型: {self.config['problem']['type']}")
        print(f"非线性求解: {'是' if self.config['problem']['is_nonlinear'] else '否'}")
        
        geom = self.config["geometry"]
        if geom.get("type") == "rectangle":
            print(f"\n几何: 矩形 [{geom['x_min']}, {geom['x_max']}] x [{geom['y_min']}, {geom['y_max']}]")
        elif geom.get("type") == "beam":
            print(f"\n几何: 梁 长度={geom['length']}, 高度={geom['height']}")
        
        mesh = self.config["mesh"]
        print(f"网格: {mesh['nx']}x{mesh['ny']} ({mesh['type']})")
        
        mat = self.config["material"]
        print(f"\n材料:")
        print(f"  弹性模量 E = {mat['E']:.6e} Pa")
        print(f"  泊松比 ν = {mat['nu']:.3f}")
        if mat.get("yield_stress"):
            print(f"  屈服应力 σ_y = {mat['yield_stress']:.6e} Pa")
            print(f"  硬化模量 H = {mat['hardening_modulus']:.6e} Pa")
        
        print(f"\n边界条件: {len(self.config['boundary_conditions'])} 个")
        for i, bc in enumerate(self.config["boundary_conditions"]):
            desc = bc.get("description", f"{bc['type']} at {bc['location']}")
            print(f"  [{i+1}] {desc}")
        
        print(f"\n荷载工况: {len(self.config['load_cases'])} 个")
        for i, lc in enumerate(self.config["load_cases"]):
            print(f"  [{i+1}] {lc['name']} - {len(lc['loads'])} 个荷载")
        
        print("\n" + "=" * 60)


class ConfigManager:
    def __init__(self):
        self.config = {
            "metadata": {
                "created": datetime.now().isoformat(),
                "version": "1.0"
            },
            "geometry": {},
            "material": {},
            "boundary_conditions": [],
            "loads": []
        }

    def set_geometry(self, geom_type, **kwargs):
        self.config["geometry"] = {
            "type": geom_type,
            **kwargs
        }

    def set_material(self, E, nu, rho=1.0):
        self.config["material"] = {
            "E": E,
            "nu": nu,
            "rho": rho
        }

    def add_boundary_condition(self, bc_type, location, value=None):
        bc = {
            "type": bc_type,
            "location": location,
            "value": value
        }
        self.config["boundary_conditions"].append(bc)

    def add_load(self, load_type, location, value):
        load = {
            "type": load_type,
            "location": location,
            "value": value
        }
        self.config["loads"].append(load)

    def save_config(self, filename):
        with open(filename, "w") as f:
            json.dump(self.config, f, indent=4)

    @staticmethod
    def load_config(filename):
        with open(filename, "r") as f:
            config = json.load(f)
        return config


class ResultStorage:
    def __init__(self, simulation):
        self.simulation = simulation
        self.mesh = simulation.mesh

    def save_results(self, filename, save_mesh=True, save_displacement=True,
                     save_stress=True, save_strain=True, save_von_mises=True):
        with h5py.File(filename, "w") as f:
            f.attrs["timestamp"] = datetime.now().isoformat()
            f.attrs["problem_type"] = self.simulation.problem_type

            if self.simulation.material:
                mat_group = f.create_group("material")
                mat_group.attrs["E"] = self.simulation.material.E
                mat_group.attrs["nu"] = self.simulation.material.nu
                mat_group.attrs["rho"] = self.simulation.material.rho

            if save_mesh:
                self._save_mesh(f)

            if save_displacement and self.simulation.u:
                self._save_function(f, self.simulation.u, "displacement")

            if save_stress and self.simulation.sigma:
                self._save_tensor_function(f, self.simulation.sigma, "stress")

            if save_strain and self.simulation.epsilon:
                self._save_tensor_function(f, self.simulation.epsilon, "strain")

            if save_von_mises and self.simulation.get_von_mises_stress():
                von_mises = self.simulation.get_von_mises_stress()
                self._save_scalar_function(f, von_mises, "von_mises_stress")

            self._save_stats(f)

    def _save_mesh(self, f):
        mesh_group = f.create_group("mesh")
        coordinates = self.mesh.coordinates()
        cells = self.mesh.cells()
        mesh_group.create_dataset("coordinates", data=coordinates)
        mesh_group.create_dataset("cells", data=cells)
        mesh_group.attrs["num_vertices"] = self.mesh.num_vertices()
        mesh_group.attrs["num_cells"] = self.mesh.num_cells()
        mesh_group.attrs["hmax"] = self.mesh.hmax()
        mesh_group.attrs["hmin"] = self.mesh.hmin()

    def _save_function(self, f, func, name):
        func_group = f.create_group(name)
        values = func.compute_vertex_values(self.mesh)
        num_vertices = self.mesh.num_vertices()
        if len(values) == 2 * num_vertices:
            ux = values[:num_vertices]
            uy = values[num_vertices:]
            func_group.create_dataset("ux", data=ux)
            func_group.create_dataset("uy", data=uy)
            magnitude = np.sqrt(ux**2 + uy**2)
            func_group.create_dataset("magnitude", data=magnitude)
        else:
            func_group.create_dataset("values", data=values)

    def _save_tensor_function(self, f, func, name):
        values = func.compute_vertex_values(self.mesh)
        num_vertices = self.mesh.num_vertices()
        tensor_group = f.create_group(name)
        tensor_group.create_dataset("xx", data=values[0:num_vertices])
        tensor_group.create_dataset("xy", data=values[num_vertices:2*num_vertices])
        tensor_group.create_dataset("yx", data=values[2*num_vertices:3*num_vertices])
        tensor_group.create_dataset("yy", data=values[3*num_vertices:])

    def _save_scalar_function(self, f, func, name):
        values = func.compute_vertex_values(self.mesh)
        scalar_group = f.create_group(name)
        scalar_group.create_dataset("values", data=values)
        scalar_group.attrs["max"] = float(np.max(values))
        scalar_group.attrs["min"] = float(np.min(values))
        scalar_group.attrs["mean"] = float(np.mean(values))

    def _save_stats(self, f):
        stats_group = f.create_group("statistics")
        if self.simulation.u:
            u_values = self.simulation.u.compute_vertex_values(self.mesh)
            num_vertices = self.mesh.num_vertices()
            ux = u_values[:num_vertices]
            uy = u_values[num_vertices:]
            stats_group.attrs["max_displacement_x"] = float(np.max(np.abs(ux)))
            stats_group.attrs["max_displacement_y"] = float(np.max(np.abs(uy)))
            stats_group.attrs["max_displacement"] = float(np.max(np.sqrt(ux**2 + uy**2)))

        von_mises = self.simulation.get_von_mises_stress()
        if von_mises:
            vm_values = von_mises.compute_vertex_values(self.mesh)
            stats_group.attrs["max_von_mises"] = float(np.max(vm_values))
            stats_group.attrs["mean_von_mises"] = float(np.mean(vm_values))

    @staticmethod
    def load_results(filename):
        with h5py.File(filename, "r") as f:
            results = {
                "timestamp": f.attrs.get("timestamp"),
                "problem_type": f.attrs.get("problem_type"),
            }

            if "material" in f:
                mat_group = f["material"]
                results["material"] = {
                    "E": mat_group.attrs.get("E"),
                    "nu": mat_group.attrs.get("nu"),
                    "rho": mat_group.attrs.get("rho")
                }

            if "mesh" in f:
                mesh_group = f["mesh"]
                results["mesh"] = {
                    "coordinates": mesh_group["coordinates"][:],
                    "cells": mesh_group["cells"][:],
                    "num_vertices": mesh_group.attrs.get("num_vertices"),
                    "num_cells": mesh_group.attrs.get("num_cells")
                }

            if "displacement" in f:
                disp_group = f["displacement"]
                results["displacement"] = {
                    "ux": disp_group["ux"][:],
                    "uy": disp_group["uy"][:],
                    "magnitude": disp_group["magnitude"][:]
                }

            if "von_mises_stress" in f:
                vm_group = f["von_mises_stress"]
                results["von_mises_stress"] = {
                    "values": vm_group["values"][:],
                    "max": vm_group.attrs.get("max"),
                    "min": vm_group.attrs.get("min")
                }

            if "statistics" in f:
                stats_group = f["statistics"]
                results["statistics"] = dict(stats_group.attrs)

        return results
