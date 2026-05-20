#!/usr/bin/env python3
"""
高级文物分析系统演示
集成：污渍扩散预测、纸张强度估算、修复建议生成、模型微调优化
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import numpy as np
from stain_diffusion import StainDiffusionPredictor, StainRegion, StainType
from paper_strength import PaperStrengthEstimator, StrengthMetrics, PaperGrade
from restoration_advisor import RestorationAdvisor
from model_fine_tuning import ModelFineTuner, GroundTruthSample, OptimizationTarget, LearningSchedule


def generate_demo_data():
    """生成演示用的模拟数据"""
    
    stain_regions = [
        StainRegion(
            id=1,
            center=np.array([50.0, 35.0]),
            area=250.0,
            perimeter=60.0,
            max_depth=0.85,
            avg_depth=0.65,
            stain_type=StainType.WATER,
            confidence=0.9,
            boundary_points=np.random.rand(20, 2)
        ),
        StainRegion(
            id=2,
            center=np.array([120.0, 80.0]),
            area=180.0,
            perimeter=48.0,
            max_depth=0.7,
            avg_depth=0.45,
            stain_type=StainType.MOLD,
            confidence=0.85,
            boundary_points=np.random.rand(15, 2)
        )
    ]
    
    wear_analysis = {
        'wear_ratio': 0.28,
        'max_depth': 2.3,
        'avg_depth': 0.8,
        'wear_regions': [
            {'id': 1, 'size': 120, 'depth': 1.5, 'location': 'edge'},
            {'id': 2, 'size': 85, 'depth': 0.9, 'location': 'corner'},
            {'id': 3, 'size': 45, 'depth': 0.5, 'location': 'center'}
        ],
        'edge_wear_ratio': 0.45
    }
    
    surface_properties = {
        'roughness': 0.35,
        'fiber_alignment': 0.7,
        'surface_density': 75.0,
        'ph_value': 5.2,
        'aging_index': 0.4
    }
    
    damage_analysis = {
        'tear_count': 3,
        'tear_density': 0.08,
        'hole_count': 2,
        'fold_count': 5,
        'edge_damage_ratio': 0.25,
        'fiber_loss_ratio': 0.15
    }
    
    thickness_analysis = {
        'mean_thickness': 0.11,
        'thickness_std': 0.02,
        'thin_areas_ratio': 0.18
    }
    
    return {
        'wear_analysis': wear_analysis,
        'stain_regions': stain_regions,
        'surface_properties': surface_properties,
        'damage_analysis': damage_analysis,
        'thickness_analysis': thickness_analysis
    }


def run_stain_diffusion_demo(data):
    """演示污渍扩散预测"""
    print("\n" + "="*60)
    print("污渍扩散预测分析")
    print("="*60)
    
    predictor = StainDiffusionPredictor()
    
    environment = {
        'humidity': 'humidity_high',
        'temperature': 'temperature_normal',
        'light_exposure': True,
        'contact_pressure': False
    }
    
    paper_props = {
        'porosity': 'porosity_normal',
        'thickness': 'thickness_normal'
    }
    
    for i, stain in enumerate(data['stain_regions']):
        print(f"\n--- 污渍区域 {i+1} ---")
        print(f"  类型: {stain.stain_type.value}")
        print(f"  面积: {stain.area:.1f} 像素")
        print(f"  周长: {stain.perimeter:.1f} 像素")
        print(f"  平均深度: {stain.avg_depth:.2f}")
        print(f"  最大深度: {stain.max_depth:.2f}")
        print(f"  置信度: {stain.confidence:.2f}")
        
        result = predictor.predict_diffusion(
            stain,
            time_steps=12,
            environment=environment,
            paper_props=paper_props
        )
        
        final_pred = result['final_prediction']
        print(f"\n  扩散预测结果 (12个月):")
        print(f"    初始面积: {result['initial_area']:.1f} 像素")
        print(f"    最终面积: {final_pred['area']:.1f} 像素")
        print(f"    面积增长: {final_pred['area']/result['initial_area']:.2f} 倍")
        print(f"    有效扩散系数: {result['effective_diffusion_coefficient']:.4f}")
        print(f"    严重等级: {result['severity']}")
        print(f"    紧急程度分数: {result['urgency_score']:.1f}")
        
        critical_points = result['critical_time_steps']
        if critical_points:
            print(f"    关键扩散时间点: {', '.join(map(str, critical_points))}")
    
    overall_results = [
        predictor.predict_diffusion(s, 12, environment, paper_props) 
        for s in data['stain_regions']
    ]
    
    overall_severity = max([r['severity'] for r in overall_results], key=lambda x: ['mild', 'moderate', 'severe', 'critical'].index(x))
    
    print(f"\n--- 整体污渍风险评估 ---")
    print(f"  总体严重度: {overall_severity}")
    print(f"  污渍区域数: {len(data['stain_regions'])}")
    print(f"  总影响面积: {sum(s.area for s in data['stain_regions']):.1f} 像素")
    
    return {
        'overall_severity': overall_severity,
        'total_regions': len(data['stain_regions']),
        'total_impact_area': sum(s.area for s in data['stain_regions']),
        'high_risk_regions': len([r for r in overall_results if r['severity'] in ['severe', 'critical']])
    }


def run_strength_estimation_demo(data):
    """演示纸张强度估算"""
    print("\n\n" + "="*60)
    print("纸张强度估算分析")
    print("="*60)
    
    estimator = PaperStrengthEstimator()
    
    dummy_pointcloud = np.random.rand(1000, 3) * 0.1
    
    result = estimator.estimate_strength(
        point_cloud_data=dummy_pointcloud,
        paper_grade=PaperGrade.STANDARD,
        age_years=50,
        damage_analysis=data['damage_analysis']
    )
    
    print(f"\n整体强度评分: {result['overall_strength_score']:.1f}/100")
    print(f"状态等级: {result['condition']}")
    print(f"纸张等级: {result['paper_grade']}")
    print(f"已使用年限: {result['age_years']:.1f} 年")
    
    metrics = result['strength_metrics']
    print(f"\n--- 分项指标 ---")
    print(f"  抗拉强度: {metrics['tensile_strength']:.1f}")
    print(f"  抗撕裂强度: {metrics['tear_resistance']:.1f}")
    print(f"  耐破强度: {metrics['burst_strength']:.1f}")
    print(f"  耐折度: {metrics['folding_endurance']}")
    print(f"  挺度: {metrics['stiffness']:.1f}")
    print(f"  内聚强度: {metrics['cohesion_strength']:.1f}")
    print(f"  纤维完整性: {metrics['fiber_integrity']:.2f}")
    print(f"  pH值: {metrics['ph_level']:.1f}")
    print(f"  脆性指数: {metrics['brittleness_index']:.1f}")
    
    degradation = result['degradation_factors']
    print(f"\n--- 退化因素分析 ---")
    print(f"  年龄退化因子: {degradation['age_degradation']:.3f}")
    print(f"  环境影响因子: {degradation['environmental_factor']:.3f}")
    print(f"  损伤影响因子: {degradation['damage_factor']:.3f}")
    print(f"  表面影响因子: {degradation['surface_factor']:.3f}")
    print(f"  总体退化程度: {degradation['total_degradation']:.3f}")
    
    remaining = result['remaining_life_estimate']
    print(f"\n--- 剩余寿命预测 ---")
    print(f"  估计剩余年数: {remaining['estimated_years_remaining']:.1f} 年")
    print(f"  置信度: {remaining['confidence']}")
    print(f"  最大潜在寿命: {remaining['max_potential_lifespan']:.0f} 年")
    print("  寿命阶段:")
    for stage, value in remaining['life_stages'].items():
        if value:
            print(f"    - {stage.replace('_', ' ').title()}")
    
    critical = result['critical_weak_points']
    if critical:
        print(f"\n--- 关键薄弱点 ---")
        for point in critical[:3]:
            print(f"  - 位置: {point.get('location', 'unknown')}")
            print(f"    描述: {point.get('description', '')}")
            print(f"    严重程度: {point.get('severity', 'medium')}")
    
    recommendations = result['recommendations']
    print(f"\n--- 保存建议 ---")
    for rec in recommendations[:4]:
        print(f"  - {rec}")
    
    return result


def run_restoration_advisor_demo(wear_data, strength_data, stain_data):
    """演示修复建议生成"""
    print("\n\n" + "="*60)
    print("修复建议生成系统")
    print("="*60)
    
    advisor = RestorationAdvisor()
    
    plan = advisor.generate_restoration_plan(
        wear_analysis=wear_data,
        strength_analysis=strength_data,
        stain_analysis=stain_data,
        document_value='high',
        environmental_data={'temperature': 22, 'humidity': 60}
    )
    
    print(f"\n--- 总体评估 ---")
    print(f"  紧迫性: {plan['overall_urgency']}")
    print(f"  要求专业水平: {plan['required_professional_level']}")
    print(f"  需优先处理问题: {len(plan['priority_issues'])} 个")
    
    print(f"\n--- 优先处理问题 ---")
    for issue in plan['priority_issues']:
        print(f"  [{issue['severity'].upper()}] {issue['issue_type'].replace('_', ' ').title()}")
        print(f"    位置: {issue['location']}")
        print(f"    影响: {issue['impact']}")
        print(f"    建议: {issue['recommended_action']}\n")
    
    print(f"\n--- 修复步骤建议 ---")
    for step in plan['treatment_steps']:
        print(f"  {step['order']}. {step['treatment_type'].replace('_', ' ').title()}")
        print(f"     描述: {step['description']}")
        print(f"     紧迫性: {step['urgency']}")
        print(f"     难度: {step['difficulty']}")
        print(f"     预计时间: {step['estimated_time']}")
        print(f"     成本估计: {step['cost_estimate']}")
        if step['warnings']:
            print(f"     注意: {step['warnings'][0]}")
        print()
    
    cost = plan['cost_estimate']
    print(f"\n--- 成本估算 ---")
    print(f"  最低估计: ${cost['estimated_min_total']:.0f}")
    print(f"  最高估计: ${cost['estimated_max_total']:.0f}")
    print(f"  说明: {cost['notes']}")
    
    timeline = plan['estimated_timeline']
    print(f"\n--- 时间线估计 ---")
    print(f"  总预计耗时: {timeline['total_duration_estimate']}")
    for phase, duration in timeline['phases'].items():
        print(f"    {phase.replace('_', ' ').title()}: {duration}")
    
    risk = plan['risk_assessment']
    print(f"\n--- 风险评估 ---")
    print(f"  总体风险水平: {risk['overall_risk_level']}")
    print(f"  具体风险:")
    for r in risk['specific_risks'][:3]:
        print(f"    - {r['risk']} (概率: {r['probability']}, 影响: {r['impact']})")
    
    digitization = plan['digitization_recommendation']
    print(f"\n--- 数字化建议 ---")
    print(f"  推荐: {'是' if digitization['recommended'] else '否'}")
    print(f"  优先级: {digitization['priority']}")
    print(f"  理由: {digitization['recommendation']}")
    
    monitoring = plan['monitoring_plan']
    print(f"\n--- 监控计划 ---")
    print(f"  监控频率: {monitoring['monitoring_frequency']}")
    print(f"  基准检查: {monitoring['schedule']['immediate']}")
    print(f"  持续监控: {monitoring['schedule']['ongoing']}")
    print(f"  全面审查: {monitoring['schedule']['comprehensive_review']}")
    
    return plan


def run_model_fine_tuning_demo(wear_data, strength_data, stain_data):
    """演示模型微调优化"""
    print("\n\n" + "="*60)
    print("模型微调优化系统")
    print("="*60)
    
    tuner = ModelFineTuner()
    
    print("\n--- 生成训练样本 ---")
    for i in range(10):
        sample = GroundTruthSample(
            sample_id=f"sample_{i:03d}",
            wear_analysis={
                'wear_ratio': 0.1 + i * 0.03,
                'max_depth': 1.0 + i * 0.2,
                'wear_regions': [{'id': j, 'size': 50 + j*20, 'depth': 0.5} for j in range(i % 5 + 1)]
            },
            strength_analysis={
                'overall_strength_score': 70 - i * 3,
                'condition': ['good', 'fair', 'poor', 'critical'][i // 3],
                'strength_metrics': StrengthMetrics(
                    tensile_strength=75 - i*2,
                    tear_resistance=70 - i*2,
                    burst_strength=65 - i*2,
                    folding_endurance=60 - i*3,
                    stiffness=55 - i*2,
                    cohesion_strength=68 - i*2,
                    ph_level=5.5 - i*0.1,
                    brittleness_index=30 + i*4
                ).__dict__
            },
            stain_analysis=stain_data if i % 2 == 0 else None,
            safety_assessment={
                'wear_risk': 0.3 + i*0.05,
                'thickness_risk': 0.25 + i*0.03,
                'strength_risk': 0.35 + i*0.04,
                'stain_risk': 0.1 + i*0.02,
                'overall_safety_score': 0.6 - i*0.04,
                'safety_level': ['low', 'medium', 'high', 'critical'][i // 3]
            },
            expert_rating=8.0 - i*0.5
        )
        tuner.add_training_sample(sample)
    
    print(f"  已添加 {len(tuner.training_samples)} 个训练样本")
    
    print("\n--- 执行强度估算优化 ---")
    result = tuner.gradient_descent_optimize(
        target=OptimizationTarget.STRENGTH_ESTIMATION,
        learning_rate=0.05,
        max_iterations=50,
        schedule=LearningSchedule.ADAPTIVE
    )
    
    print(f"  优化目标: {result.target}")
    print(f"  迭代次数: {result.iterations}")
    print(f"  耗时: {result.elapsed_time:.3f} 秒")
    print(f"  最终得分: {result.best_score:.4f}")
    print(f"  提升百分比: {result.improvement_percent:+.2f}%")
    
    print(f"\n  最优参数:")
    for param, value in result.best_parameters.items():
        print(f"    {param}: {value:.4f}")
    
    print(f"\n--- 交叉验证优化 ---")
    cv_result = tuner.cross_validation_optimize(
        target=OptimizationTarget.SAFETY_ASSESSMENT,
        n_folds=5,
        learning_rate=0.03,
        max_iterations=30
    )
    
    print(f"  交叉验证平均得分: {cv_result['cv_mean_score']:.4f} ± {cv_result['cv_std_score']:.4f}")
    print(f"  平均提升: {cv_result['cv_mean_improvement']:+.2f}%")
    print(f"  验证折数: {cv_result['n_folds']}")
    
    print(f"\n--- 性能总结 ---")
    summary = tuner.get_performance_summary()
    print(f"  总训练样本数: {summary['total_training_samples']}")
    print(f"  已优化目标: {', '.join(summary['optimization_targets'])}")
    
    for target, perf in summary['target_performance'].items():
        print(f"\n  {target}:")
        print(f"    最新得分: {perf['latest_score']:.4f}")
        print(f"    总提升: {perf['total_improvement']:+.2f}%")
        print(f"    优化次数: {perf['optimization_count']}")
        print(f"    最后优化: {perf['last_optimized']}")
    
    return summary


def main():
    print("\n" + "="*70)
    print("    三维文物点云分析系统 - 高级功能演示")
    print("    Advanced Point Cloud Analysis for Cultural Heritage")
    print("="*70)
    print("    功能模块:")
    print("    ✓ 污渍扩散预测 | ✓ 纸张强度估算")
    print("    ✓ 修复建议生成 | ✓ 模型微调优化")
    print("="*70)
    
    data = generate_demo_data()
    
    stain_result = run_stain_diffusion_demo(data)
    strength_result = run_strength_estimation_demo(data)
    restoration_plan = run_restoration_advisor_demo(
        data['wear_analysis'], 
        strength_result, 
        stain_result
    )
    tuning_summary = run_model_fine_tuning_demo(
        data['wear_analysis'],
        strength_result,
        stain_result
    )
    
    print("\n\n" + "="*70)
    print("    高级分析演示完成!")
    print("="*70)
    print("\n总结:")
    print(f"  • 检测到 {len(data['stain_regions'])} 个污渍区域")
    print(f"  • 总体强度评分: {strength_result['overall_strength_score']:.1f}/100")
    print(f"  • 修复紧迫性: {restoration_plan['overall_urgency']}")
    print(f"  • 建议专业水平: {restoration_plan['required_professional_level']}")
    print(f"  • 已优化 {len(tuning_summary['optimization_targets'])} 个分析模型")
    print("\n" + "="*70)


if __name__ == '__main__':
    main()
