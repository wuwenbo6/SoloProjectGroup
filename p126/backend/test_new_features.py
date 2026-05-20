import cv2
import numpy as np
import sys
sys.path.insert(0, '.')
from app.services.image_processor import (
    WeatheringTrendAnalyzer,
    MultiPeriodComparator,
    RepairEstimator,
    ModelSlicer
)

def create_test_image():
    img = np.random.randint(200, 255, (200, 200, 3), dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (80, 80), (50, 50, 150), -1)
    cv2.rectangle(img, (100, 100), (140, 140), (80, 80, 80), -1)
    return img

def test_weathering_trend():
    print("=" * 50)
    print("测试风化趋势预测功能...")
    img = create_test_image()
    cv2.imwrite('/tmp/test_weathering.png', img)
    
    result = WeatheringTrendAnalyzer.predict_trend('/tmp/test_weathering.png', prediction_months=24)
    print(f"当前健康度: {result['current_health']:.3f}")
    print(f"趋势点数: {len(result['trend_points'])}")
    print(f"关键风险点: {len(result['critical_points'])}")
    print(f"养护建议数: {len(result['recommendations'])}")
    print("✓ 风化趋势预测测试通过!")

def test_multi_period_compare():
    print("\n" + "=" * 50)
    print("测试多期对比功能...")
    img1 = create_test_image()
    img2 = create_test_image()
    img2[60:90, 60:90] = [30, 30, 30]
    cv2.imwrite('/tmp/test_compare1.png', img1)
    cv2.imwrite('/tmp/test_compare2.png', img2)
    
    result = MultiPeriodComparator.compare('/tmp/test_compare1.png', '/tmp/test_compare2.png', time_diff_days=30)
    print(f"总体评估: {result['overall_assessment']}")
    print(f"污渍数量变化: {result['metrics']['stain_count_change']}")
    print(f"健康度变化: {result['metrics']['health_score_change']:.3f}")
    print(f"新增污渍数: {len(result['metrics']['new_stains'])}")
    print("✓ 多期对比测试通过!")

def test_repair_estimate():
    print("\n" + "=" * 50)
    print("测试维修量估算功能...")
    img = create_test_image()
    cv2.imwrite('/tmp/test_repair.png', img)
    
    result = RepairEstimator.estimate_repair('/tmp/test_repair.png')
    print(f"预估总费用: ¥{result['total_estimated_cost']:.2f}")
    print(f"预估总工时: {result['total_estimated_time']}")
    print(f"维修项目数: {len(result['repair_items'])}")
    print(f"材料清单数: {len(result['material_list'])}")
    print("✓ 维修量估算测试通过!")

def test_model_slice():
    print("\n" + "=" * 50)
    print("测试模型切片功能...")
    img = create_test_image()
    cv2.imwrite('/tmp/test_slice.png', img)
    
    result = ModelSlicer.slice_and_analyze('/tmp/test_slice.png', grid_rows=4, grid_cols=4)
    print(f"网格大小: {result['grid_size']['rows']}×{result['grid_size']['cols']}")
    print(f"切片数量: {len(result['slices'])}")
    print(f"高风险区域数: {len(result['high_risk_areas'])}")
    print(f"平均健康度: {result['overall_summary']['average_health_score']:.3f}")
    print(f"总污渍数: {result['overall_summary']['total_stains_detected']}")
    print("✓ 模型切片测试通过!")

if __name__ == '__main__':
    print("开始测试新增功能模块...")
    print()
    
    test_weathering_trend()
    test_multi_period_compare()
    test_repair_estimate()
    test_model_slice()
    
    print("\n" + "=" * 50)
    print("所有测试通过！新增功能运行正常！")
