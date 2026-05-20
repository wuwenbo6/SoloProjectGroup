#!/usr/bin/env python3
"""
高级功能示例：
1. 材料非线性仿真（塑性材料模型，von Mises屈服准则）
2. 仿真结果后处理分析（应力极值、安全系数、位移统计）
3. 多工况仿真（批量计算与结果对比）
4. 仿真配置的导入/导出（JSON格式）
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core import (
    Material,
    PlaneStress,
    NonlinearPlaneStress,
    MultiCaseSimulation,
)
from preprocessing import MeshGenerator, BoundaryCondition, Load, Boundary
from postprocessing import Visualizer2D, ResultAnalyzer
from io import SimulationConfig, ResultStorage

import matplotlib
matplotlib.use("Agg")


def example_1_config_io():
    """示例 1: 仿真配置的导入/导出"""
    print("\n" + "=" * 60)
    print("  示例 1: 仿真配置的导入/导出")
    print("=" * 60)

    config = SimulationConfig()

    config.set_problem_type("plane_stress", is_nonlinear=True)
    config.set_beam_geometry(length=1.0, height=0.2, nx=50, ny=10)

    config.set_material(
        E=210e9,
        nu=0.3,
        rho=7850.0,
        yield_stress=250e6,
        hardening_modulus=1e9
    )

    config.set_solver_params(
        linear_solver="mumps",
        regularization=True,
        regularization_epsilon=1e-10,
        num_load_steps=20
    )

    config.add_fixed_boundary(location="left", description="左端固定约束")

    load1 = config.create_boundary_load(location="right", value=[0, -1e6])
    config.add_load_case(name="荷载工况 1: 小荷载", loads=[load1], description="右端集中力")

    load2 = config.create_boundary_load(location="right", value=[0, -5e6])
    config.add_load_case(name="荷载工况 2: 大荷载", loads=[load2], description="右端大集中力，可能屈服")

    config.print_summary()

    os.makedirs("output", exist_ok=True)
    config.save("output/simulation_config.json")

    loaded_config = SimulationConfig.load("output/simulation_config.json")
    print("\n配置重新加载成功!")
    loaded_config.print_summary()


def example_2_postprocessing():
    """示例 2: 仿真结果后处理分析"""
    print("\n" + "=" * 60)
    print("  示例 2: 仿真结果后处理分析")
    print("=" * 60)

    mesh_gen = MeshGenerator()
    mesh = mesh_gen.create_beam_mesh(length=1.0, height=0.2, nx=50, ny=10)

    simulation = PlaneStress(mesh)
    material = Material(E=210e9, nu=0.3, yield_stress=250e6)
    simulation.set_material(material)

    left_boundary = Boundary(lambda x, on_boundary: on_boundary and near(x[0], 0))
    fixed_bc = BoundaryCondition.create_fixed(left_boundary)
    simulation.add_boundary_condition(fixed_bc)

    right_boundary = Boundary(lambda x, on_boundary: on_boundary and near(x[0], 1.0))
    load = Load.create_boundary_force([0, -1e6], right_boundary, mesh)
    simulation.add_load(load)

    print("\n求解中...")
    simulation.solve()

    print("\n后处理分析:")
    analyzer = ResultAnalyzer(simulation)

    results = analyzer.full_analysis(yield_stress=material.yield_stress)

    print("\n--- 位移统计 ---")
    if "displacement_statistics" in results:
        disp = results["displacement_statistics"]
        print(f"  最大合位移: {disp['magnitude']['max']:.6e} m")
        print(f"  最大X位移: {disp['ux']['max']:.6e} m")
        print(f"  最大Y位移: {disp['uy']['max']:.6e} m")

    print("\n--- 应力极值 ---")
    if "stress_extremes" in results:
        stress = results["stress_extremes"]
        print(f"  最大Von Mises应力: {stress['max_von_mises']:.6e} Pa")
        print(f"  应力最大点: 前5个高应力位置")
        for i, pt in enumerate(stress["max_stress_points"][:5]):
            print(f"    [{i+1}] 坐标={pt['coordinates']}, 应力={pt['von_mises_stress']:.6e} Pa")

    print("\n--- 安全系数 ---")
    if "safety_factor" in results:
        sf = results["safety_factor"]
        print(f"  最小安全系数: {sf['min']:.3f}")
        print(f"  平均安全系数: {sf['mean']:.3f}")
        print(f"  安全系数<1.0的区域比例: {sf['below_1_ratio']*100:.1f}%")
        if sf['below_1_ratio'] > 0:
            print(f"  警告: 存在屈服区域!")

    print("\n--- 主应力 ---")
    if "principal_stresses" in results:
        ps = results["principal_stresses"]
        print(f"  最大主应力: {ps['sigma1_max']:.6e} Pa")
        print(f"  最小主应力: {ps['sigma2_min']:.6e} Pa")

    print("\n--- 应变能 ---")
    if "strain_energy" in results:
        print(f"  总应变能: {results['strain_energy']:.6e} J")

    viz = Visualizer2D(simulation)
    viz.plot_von_mises_stress(show=False, save_path="output/von_mises_stress.png")
    print("\n应力云图已保存: output/von_mises_stress.png")


def example_3_multi_case():
    """示例 3: 多工况仿真"""
    print("\n" + "=" * 60)
    print("  示例 3: 多工况仿真")
    print("=" * 60)

    mesh_gen = MeshGenerator()
    mesh = mesh_gen.create_beam_mesh(length=1.0, height=0.2, nx=40, ny=8)

    material = Material(E=210e9, nu=0.3, yield_stress=250e6)

    left_boundary = Boundary(lambda x, on_boundary: on_boundary and near(x[0], 0))
    fixed_bc = BoundaryCondition.create_fixed(left_boundary)

    right_boundary = Boundary(lambda x, on_boundary: on_boundary and near(x[0], 1.0))
    top_boundary = Boundary(lambda x, on_boundary: on_boundary and near(x[1], 0.2))

    multi_case = MultiCaseSimulation(
        mesh=mesh,
        material=material,
        base_bcs=[fixed_bc],
        problem_type="plane_stress"
    )

    load1 = Load.create_boundary_force([0, -1e6], right_boundary, mesh)
    multi_case.create_load_case(name="工况1: 右端小集中力", loads=[load1])

    load2 = Load.create_boundary_force([0, -5e6], right_boundary, mesh)
    multi_case.create_load_case(name="工况2: 右端大集中力", loads=[load2])

    load3 = Load.create_boundary_force([0, -2e6], top_boundary, mesh)
    multi_case.create_load_case(name="工况3: 顶部均布力", loads=[load3])

    results = multi_case.run_all_cases(nonlinear=False)

    print("\n工况对比 - 最大Von Mises应力:")
    multi_case.compare_cases(metric="max_von_mises")

    print("\n工况对比 - 最大位移:")
    multi_case.compare_cases(metric="max_displacement")

    print("\n工况对比 - 最小安全系数:")
    multi_case.compare_cases(metric="min_safety_factor")

    multi_case.export_comparison_report("output/multi_case_report.json")

    storage = ResultStorage(multi_case)
    print("\n所有工况分析完成! 报告已保存.")


def main():
    print("\n" + "=" * 60)
    print("  高级功能综合示例")
    print("=" * 60)
    print("""
本示例展示以下功能：
  1. 仿真配置的导入/导出 (JSON格式)
  2. 仿真结果后处理分析
     - 位移场统计
     - 应力极值点查找
     - 安全系数计算
     - 主应力分析
     - 应变能计算
  3. 多工况仿真与结果对比
    """)

    try:
        example_1_config_io()
        example_2_postprocessing()
        example_3_multi_case()

        print("\n" + "=" * 60)
        print("  所有示例执行完成!")
        print("=" * 60)
        print("""
生成的文件:
  - output/simulation_config.json    - 仿真配置文件
  - output/von_mises_stress.png       - 应力云图
  - output/multi_case_report.json     - 多工况对比报告
    """)

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
