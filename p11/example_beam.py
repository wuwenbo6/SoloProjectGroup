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
    print("  2D 有限元结构力学仿真 - 悬臂梁示例")
    print("=" * 60)

    print("\n[1/7] 生成网格...")
    mesh_gen = MeshGenerator()
    mesh = mesh_gen.create_beam_mesh(length=1.0, height=0.2, nx=50, ny=10)
    mesh_info = mesh_gen.get_mesh_info()
    print(f"    网格信息: {mesh_info['num_cells']} 单元, {mesh_info['num_vertices']} 顶点")

    print("\n[2/7] 设置仿真类型和材料...")
    simulation = PlaneStress(mesh)
    material = Material(E=210e9, nu=0.3, rho=7850.0)
    simulation.set_material(material)
    print(f"    弹性模量 E = {material.E} Pa")
    print(f"    泊松比 ν = {material.nu}")

    print("\n[3/7] 设置边界条件...")
    left_boundary = Boundary(lambda x: BoundaryCondition.left_boundary(x, True))
    fixed_bc = BoundaryCondition.create_fixed(left_boundary)
    simulation.add_boundary_condition(fixed_bc)
    print("    左侧边界: 固定约束 (u_x = 0, u_y = 0)")

    print("\n[4/7] 设置荷载...")
    right_boundary = Boundary(lambda x: abs(x[0] - 1.0) < 1e-8)
    load = Load.create_boundary_force((0, -1e6), right_boundary, mesh)
    simulation.add_load(load)
    print("    右侧边界: 集中力 F_y = -1e6 N")

    print("\n[5/7] 求解有限元方程...")
    u = simulation.solve()
    print("    求解完成!")

    max_displacement = max(u.compute_vertex_values(mesh), key=abs)
    print(f"    最大位移: {max_displacement:.6e} m")

    von_mises = simulation.get_von_mises_stress()
    max_stress = max(von_mises.compute_vertex_values(mesh))
    print(f"    最大 von Mises 应力: {max_stress:.6e} Pa")

    print("\n[6/7] 可视化结果...")
    viz = Visualizer2D(simulation)

    os.makedirs("output", exist_ok=True)

    viz.plot_mesh(title="Finite Element Mesh", show=False, save_path="output/mesh.png")
    print("    网格图已保存: output/mesh.png")

    viz.plot_displacement(title="Displacement Field", show=False, save_path="output/displacement.png", warp_factor=10.0)
    print("    位移场图已保存: output/displacement.png")

    viz.plot_von_mises_stress(title="Von Mises Stress Distribution", show=False, save_path="output/von_mises_stress.png")
    print("    应力云图已保存: output/von_mises_stress.png")

    viz.plot_stress_components(show=False, save_prefix="output")
    print("    应力分量图已保存: output/stress_components.png")

    viz.plot_displacement_components(show=False, save_prefix="output")
    print("    位移分量图已保存: output/displacement_components.png")

    viz.plot_summary(show=False, save_path="output/summary.png")
    print("    汇总图已保存: output/summary.png")

    print("\n[7/7] 保存仿真结果...")
    storage = ResultStorage(simulation)
    storage.save_results("output/results.h5")
    print("    结果数据已保存: output/results.h5")

    config = ConfigManager()
    config.set_geometry("beam", length=1.0, height=0.2, nx=50, ny=10)
    config.set_material(E=210e9, nu=0.3, rho=7850.0)
    config.add_boundary_condition("fixed", "left")
    config.add_load("boundary_force", "right", (0, -1e6))
    config.save_config("output/config.json")
    print("    配置文件已保存: output/config.json")

    print("\n" + "=" * 60)
    print("  仿真完成! 所有结果已保存到 output/ 目录")
    print("=" * 60)


if __name__ == "__main__":
    main()
