#!/usr/bin/env python3
"""
制墨工艺配比数值模拟系统
传统制墨工艺的参数优化与可视化平台
"""

import numpy as np
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings('ignore')

from material_collection import MaterialCollection
from numerical_computation import NumericalComputation
from formula_simulation import Formula, FormulaSimulator
from visualization import InkVisualization
from parameter_optimization import ParameterOptimizer
from data_storage import DataStorage


def print_separator(title=""):
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
    print("=" * 60 + "\n")


def demo_material_collection():
    print_separator("原料参数采集模块演示")
    
    collection = MaterialCollection()
    print(f"可用原料数量: {len(collection.list_all_materials())}")
    print("\n原料列表:")
    for mat_name in collection.list_all_materials():
        mat = collection.get_material(mat_name)
        print(f"  - {mat_name} ({mat.material_type})")
    
    return collection


def demo_formula_simulation():
    print_separator("核心配比模拟模块演示")
    
    simulator = FormulaSimulator()
    
    formula1 = Formula("传统松烟墨")
    formula1.add_material("松烟", 0.65)
    formula1.add_material("骨胶", 0.25)
    formula1.add_material("珍珠粉", 0.05)
    formula1.add_material("冰片", 0.05)
    formula1.set_process_param("firing_temperature", 900.0)
    formula1.set_process_param("firing_time", 150.0)
    formula1.set_process_param("grinding_time", 90.0)
    
    print(f"配方: {formula1.name}")
    print("原料配比:")
    for name, ratio in formula1.materials.items():
        print(f"  {name}: {ratio*100:.1f}%")
    
    result = simulator.simulate_formula(formula1)
    
    print("\n模拟结果 - 质量评分:")
    for key, value in result.quality_scores.items():
        print(f"  {key}: {value:.2f}")
    
    print("\n模拟结果 - 综合属性:")
    for key, value in result.properties.items():
        if isinstance(value, float):
            print(f"  {key}: {value:.4f}")
    
    return formula1, result


def demo_visualization(formula, result):
    print_separator("结果可视化模块演示")
    
    viz = InkVisualization()
    
    print("生成综合报告图表...")
    fig = viz.create_comprehensive_report(formula, result, "comprehensive_report.png")
    print("  综合报告已保存为: comprehensive_report.png")
    
    print("\n生成墨色样本...")
    fig2 = viz.plot_ink_color_sample(
        result.quality_scores['blackness_score'],
        result.quality_scores['gloss_score']
    )
    plt.savefig("ink_sample.png", dpi=150, bbox_inches='tight')
    print("  墨色样本已保存为: ink_sample.png")
    
    plt.close('all')
    return viz


def demo_parameter_optimization(formula):
    print_separator("参数优化模块演示")
    
    optimizer = ParameterOptimizer()
    
    param_ranges = {
        "firing_temperature": (600.0, 1200.0),
        "firing_time": (60.0, 240.0),
        "grinding_time": (30.0, 180.0)
    }
    
    print("开始工艺参数优化...")
    print(f"参数范围: {param_ranges}")
    
    opt_result = optimizer.optimize_process_params(
        formula=formula,
        param_ranges=param_ranges,
        method='differential_evolution',
        max_iter=50
    )
    
    print(f"\n优化成功: {opt_result['success']}")
    print(f"最佳得分: {opt_result['best_score']:.2f}")
    
    print("\n原始参数:")
    for name, value in opt_result['original_params'].items():
        print(f"  {name}: {value}")
    
    print("\n优化后参数:")
    for name, value in opt_result['optimized_params'].items():
        print(f"  {name}: {value:.2f}")
    
    print("\n优化后质量评分:")
    for key, value in opt_result['optimized_result'].quality_scores.items():
        print(f"  {key}: {value:.2f}")
    
    return optimizer, opt_result


def demo_sensitivity_analysis(formula, optimizer):
    print_separator("敏感性分析演示")
    
    temp_range = np.linspace(600, 1200, 30)
    sens_result = optimizer.sensitivity_analysis(
        formula=formula,
        param_name="firing_temperature",
        param_range=temp_range
    )
    
    print(f"烧制温度敏感性分析:")
    print(f"  参数范围: {temp_range[0]:.1f} - {temp_range[-1]:.1f}")
    print(f"  最佳参数: {sens_result['optimum_param']:.1f}")
    print(f"  最高得分: {sens_result['max_score']:.2f}")
    print(f"  最低得分: {sens_result['min_score']:.2f}")
    print(f"  得分变化范围: {sens_result['sensitivity_range']:.2f}")


def demo_data_storage(formula, result, opt_result):
    print_separator("数据存储模块演示")
    
    storage = DataStorage()
    
    sim_id = storage.save_simulation_result(formula, result)
    print(f"模拟结果已保存, ID: {sim_id}")
    
    config_path = storage.save_formula_config(formula)
    print(f"配方配置已保存: {config_path}")
    
    opt_path = storage.save_optimization_result(opt_result, "process_param_opt")
    print(f"优化结果已保存: {opt_path}")
    
    stats = storage.get_statistics()
    print("\n数据统计:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    return storage


def demo_anomaly_detection(formula, result):
    print_separator("配比过程异常预警演示")
    
    from anomaly_detection import AnomalyDetector
    
    detector = AnomalyDetector()
    
    warnings = detector.detect_formula_anomalies(formula)
    
    print("配方异常检测结果:")
    summary = detector.get_warning_summary()
    print(f"  总预警数: {summary['total']}")
    for level, count in summary['by_level'].items():
        print(f"    {level.upper()}: {count}")
    
    detector.print_warnings()
    
    sim_warnings = detector.detect_simulation_anomalies(result)
    print(f"\n模拟结果异常数: {len(sim_warnings)}")
    
    process_warnings = detector.detect_process_anomalies(result.process_data)
    print(f"工艺过程异常数: {len(process_warnings)}")
    
    return detector


def demo_comparison_analysis():
    print_separator("仿真结果与实际制墨测试数据对比分析演示")
    
    from comparison_analysis import SimulationVsTestComparison, generate_sample_test_data
    from formula_simulation import FormulaSimulator
    
    comparator = SimulationVsTestComparison()
    
    test_data = generate_sample_test_data()
    print(f"生成测试数据: {len(test_data)} 个样本")
    
    simulator = FormulaSimulator()
    simulation_results = []
    
    for test_point in test_data:
        formula = Formula(test_point.formula_name)
        formula.materials = test_point.materials.copy()
        formula.process_params = test_point.process_params.copy()
        sim_result = simulator.simulate_formula(formula)
        simulation_results.append(sim_result)
    
    print(f"完成模拟计算: {len(simulation_results)} 个样本")
    
    comparison_results = []
    for i, (test_point, sim_result) in enumerate(zip(test_data, simulation_results)):
        comparison = comparator.compare_single(
            {
                'quality_scores': sim_result.quality_scores,
                'properties': sim_result.properties
            },
            test_point
        )
        comparison_results.append(comparison)
    
    print(f"\n对比分析结果:")
    print(f"  有效对比数: {len(comparison_results)}")
    
    accuracies = [r['accuracy'] for r in comparison_results]
    print(f"  平均准确度: {np.mean(accuracies):.2f}%")
    print(f"  最高准确度: {np.max(accuracies):.2f}%")
    print(f"  最低准确度: {np.min(accuracies):.2f}%")
    
    corr = comparator.calculate_correlation('overall_quality')
    if 'pearson_correlation' in corr:
        print(f"  Pearson相关系数: {corr['pearson_correlation']:.4f}")
        print(f"  R²值: {corr['r_squared']:.4f}")
        print(f"  RMSE: {corr['rmse']:.4f}")
    
    improvements = comparator.suggest_model_improvements()
    if improvements:
        print(f"\n模型改进建议:")
        for imp in improvements:
            print(f"  - {imp['parameter']}: {imp['suggestion']} (优先级: {imp['priority']})")
    
    viz = InkVisualization()
    fig = comparator.visualize_comparison('overall_quality', 'comparison_analysis.png')
    print(f"\n  对比分析图表已保存为: comparison_analysis.png")
    plt.close('all')
    
    return comparator


def demo_multi_material_synergy(base_formula):
    print_separator("多原料协同配比模拟演示")
    
    simulator = FormulaSimulator()
    
    print("方法1: 使用拉丁超立方采样 (LHS)")
    synergy_result = simulator.simulate_multi_material_synergy(
        base_formula,
        n_samples=100,
        method='lhs'
    )
    
    print(f"  总组合数: {synergy_result['total_combinations']}")
    print(f"  有效组合数: {synergy_result['valid_combinations']}")
    print(f"  平均质量: {synergy_result['average_quality']:.2f}")
    print(f"  最佳质量: {synergy_result['best_quality']:.2f}")
    
    print(f"\n  Top 3 配方:")
    for i, top in enumerate(synergy_result['top_5_formulas'][:3]):
        materials_str = ", ".join([f"{k}:{v:.2f}" for k, v in list(top['materials'].items())[:3]])
        print(f"    {i+1}. 质量={top['overall_quality']:.2f}, 原料=[{materials_str}...]")
    
    print(f"\n  原料贡献分析:")
    for mat, corr in synergy_result['material_contributions'].items():
        print(f"    {mat}: 相关系数={corr:.4f}")
    
    print(f"\n方法2: 参数敏感性矩阵分析")
    param_ranges = {
        'firing_temperature': (600.0, 1200.0),
        'firing_time': (60.0, 240.0)
    }
    
    sens_matrix = simulator.sensitivity_analysis_matrix(base_formula, param_ranges, n_points=20)
    
    for param, data in sens_matrix.items():
        print(f"  {param}:")
        print(f"    范围影响度: {data['sensitivity']:.2f}")
        print(f"    最优值: {data['optimal_value']:.2f}")
        print(f"    最佳质量: {data['max_quality']:.2f}")
    
    return synergy_result


def demo_performance_optimization():
    print_separator("数值计算性能优化演示")
    
    from numerical_computation import NumericalComputation
    
    print("运行性能基准测试...")
    benchmark = NumericalComputation.benchmark_performance(n_samples=1000, verbose=True)
    
    print(f"\n性能总结:")
    print(f"  向量化计算加速比: {benchmark['speedup_temp_effect']:.2f}x")
    print(f"  单次调用缓存已启用 (最大缓存大小: {NumericalComputation._cache_max_size})")
    
    print(f"\n演示批量计算能力:")
    n_batch = 500
    carbon_content = np.random.uniform(0.7, 0.95, n_batch)
    particle_size = np.random.uniform(0.05, 0.3, n_batch)
    temp_effect = np.random.uniform(0.3, 0.9, n_batch)
    
    import time
    start = time.time()
    blackness_values = NumericalComputation.vectorized_calculate_blackness(
        carbon_content, particle_size, temp_effect
    )
    vector_time = time.time() - start
    
    start = time.time()
    for i in range(n_batch):
        NumericalComputation.calculate_blackness(
            carbon_content[i], particle_size[i], temp_effect[i]
        )
    loop_time = time.time() - start
    
    print(f"  向量化批量计算 ({n_batch}个样本): {vector_time:.4f}s")
    print(f"  循环单例计算 ({n_batch}个样本): {loop_time:.4f}s")
    print(f"  批量计算加速比: {loop_time/vector_time:.2f}x")
    
    NumericalComputation.clear_cache()
    print(f"\n  缓存已清理")
    
    return benchmark


def demo_multi_formula_comparison():
    print_separator("多配方对比演示")
    
    simulator = FormulaSimulator()
    
    formulas = []
    
    formula1 = Formula("松烟墨配方")
    formula1.add_material("松烟", 0.65)
    formula1.add_material("骨胶", 0.25)
    formula1.add_material("珍珠粉", 0.05)
    formula1.add_material("冰片", 0.05)
    formulas.append(formula1)
    
    formula2 = Formula("桐油烟墨配方")
    formula2.add_material("桐油烟", 0.60)
    formula2.add_material("桃胶", 0.30)
    formula2.add_material("冰片", 0.05)
    formula2.add_material("珍珠粉", 0.05)
    formulas.append(formula2)
    
    formula3 = Formula("漆烟墨配方")
    formula3.add_material("漆烟", 0.55)
    formula3.add_material("桐油烟", 0.15)
    formula3.add_material("骨胶", 0.22)
    formula3.add_material("冰片", 0.05)
    formula3.add_material("朱砂", 0.03)
    formulas.append(formula3)
    
    results = simulator.compare_formulas(formulas)
    
    print("配方对比结果:")
    for i, (formula, result) in enumerate(zip(formulas, results)):
        print(f"\n  {i+1}. {formula.name}:")
        print(f"     综合质量: {result.quality_scores['overall_quality']:.2f}")
        print(f"     黑度: {result.quality_scores['blackness_score']:.2f}")
        print(f"     光泽: {result.quality_scores['gloss_score']:.2f}")
        print(f"     耐久性: {result.quality_scores['durability_score']:.2f}")
    
    viz = InkVisualization()
    fig = viz.plot_comparison_bar(formulas, results)
    plt.savefig("formula_comparison.png", dpi=150, bbox_inches='tight')
    print("\n  对比图表已保存为: formula_comparison.png")
    plt.close('all')
    
    return formulas, results


def main():
    print_separator("制墨工艺配比数值模拟系统")
    print("版本: 2.0.0")
    print("功能: 原料参数采集 | 数值计算 | 配比模拟 | 结果可视化 | 参数优化")
    print("新增功能: 多原料协同配比 | 异常预警 | 实测对比 | 性能优化")
    
    try:
        collection = demo_material_collection()
        
        formula, result = demo_formula_simulation()
        
        viz = demo_visualization(formula, result)
        
        optimizer, opt_result = demo_parameter_optimization(formula)
        
        demo_sensitivity_analysis(formula, optimizer)
        
        storage = demo_data_storage(formula, result, opt_result)
        
        demo_multi_formula_comparison()
        
        demo_anomaly_detection(formula, result)
        
        demo_comparison_analysis()
        
        demo_multi_material_synergy(formula)
        
        demo_performance_optimization()
        
        print_separator("演示完成")
        print("所有模块演示已成功完成!")
        print("生成的文件:")
        print("  - comprehensive_report.png (综合报告)")
        print("  - ink_sample.png (墨色样本)")
        print("  - formula_comparison.png (配方对比)")
        print("  - comparison_analysis.png (仿真vs实测对比)")
        print("  - data/simulation_results.h5 (HDF5模拟数据)")
        print("  - data/formula_configs/ (JSON配方配置)")
        print("  - data/optimizations/ (JSON优化结果)")
        
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
