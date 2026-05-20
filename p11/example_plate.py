#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.simulation import Material, PlaneStress, PlaneStrain
from preprocessing.meshing import MeshGenerator
from preprocessing.boundary import BoundaryCondition, Load, Boundary
from postprocessing.visualization import Visualizer2D
from io.storage import ResultStorage, ConfigManager

import matplotlib
matplotlib.use("Agg")


def main():
    print("=" * 60)
    print("  2D 有限元结构力学仿真 - 受压板示例")
    print("=" * 60)

    print("\n[1/7] 生成网格...")
    mesh_gen = MeshGenerator()
    mesh = mesh_gen.create_rectangle_mesh(x_min=0, x_max=1.0, y_min=0, y_max=1.0, nx=30, ny=30)
    mesh_info = mesh_gen.get_mesh_info()
    print(f"    网格信息: {mesh_info['num_cells']} 单元, {mesh_info['num_vertices']} 顶点")

    print("\n[2/7] 设置仿真类型和材料...")
    simulation = PlaneStrain(mesh)
    material = Material(E=70e9, nu=0.33, rho=2700.0)
    simulation.set_material(material)
    print(f"    弹性模量 E = {material.E} Pa")
    print(f"    泊松比 ν = {material.nu}")

    print("\n[3/7] 设置边界条件...")
    bottom_boundary = Boundary(lambda x: BoundaryCondition.bottom_boundary(x, True))
    fixed_bc = BoundaryCondition.create_fixed(bottom_boundary)
    simulation.add_boundary_condition(fixed_bc)
    print("    底部边界: 固定约束")

    print("\n[4/7] 设置荷载...")
    top_boundary = Boundary(lambda x: BoundaryCondition.top_boundary(x, True))
    pressure_load = Load.create_pressure(1e7, top_boundary, mesh)
    simulation.add_load(pressure_load)
    print("    顶部边界: 均布压力 p = 1e7 Pa")

    print("\n[5/7] 求解有限元方程...")
    u = simulation.solve()
    print("    求解完成!")

    von_mises = simulation.get_von_mises_stress()
    max_stress = max(von_mises.compute_vertex_values(mesh))
    print(f"    最大 von Mises 应力: {max_stress:.6e} Pa")

    print("\n[6/7] 可视化结果...")
    viz = Visualizer2D(simulation)

    os.makedirs("output_plate", exist_ok=True)

    viz.plot_mesh(show=False, save_path="output_plate/mesh.png")
    viz.plot_displacement(show=False, save_path="output_plate/displacement.png", warp_factor=500.0)
    viz.plot_von_mises_stress(show=False, save_path="output_plate/von_mises_stress.png")
    viz.plot_stress_components(show=False, save_prefix="output_plate")
    viz.plot_strain_components(show=False, save_prefix="output_plate")
    viz.plot_summary(show=False, save_path="output_plate/summary.png")
    print("    所有可视化结果已保存到 output_plate/ 目录")

    print("\n[7/7] 保存仿真结果...")
    storage = ResultStorage(simulation)
    storage.save_results("output_plate/results.h5")

    config = ConfigManager()
    config.set_geometry("rectangle", x_min=0, x_max=1.0, y_min=0, y_max=1.0, nx=30, ny=30)
    config.set_material(E=70e9, nu=0.33, rho=2700.0)
    config.add_boundary_condition("fixed", "bottom")
    config.add_load("pressure", "top", 1e7)
    config.save_config("output_plate/config.json")

    print("\n" + "=" * 60)
    print("  仿真完成! 所有结果已保存到 output_plate/ 目录")
    print("=" * 60)


if __name__ == "__main__":
    main()
