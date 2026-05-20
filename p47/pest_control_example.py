#!/usr/bin/env python3
"""
防治建议引擎使用示例

演示如何使用智能虫害防治系统：
1. 根据害虫种类、密度计算农药剂量
2. 调用天气API获取72小时预报
3. 生成喷洒区域建议
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pest_control import ControlRecommendationEngine, PestKnowledgeBase


def basic_usage_example():
    """基础使用示例"""
    print("=" * 70)
    print("智能虫害防治系统 - 基础使用示例")
    print("=" * 70)
    
    kb = PestKnowledgeBase()
    
    print("\n📚 知识库信息:")
    print(f"  支持的害虫种类: {len(kb.pest_profiles)}")
    print(f"  支持的农药种类: {len(kb.pesticides)}")
    
    for pest_id, profile in kb.pest_profiles.items():
        print(f"\n  {profile.chinese_name} ({pest_id}):")
        print(f"    威胁等级: {profile.threat_level}")
        print(f"    防治阈值: {profile.control_threshold} 只/m²")
        print(f"    推荐农药: {len(profile.recommended_pesticides)}")
    
    engine = ControlRecommendationEngine()
    
    print("\n" + "=" * 70)
    print("生成防治建议...")
    print("=" * 70)
    
    detections = [
        {'pest_type': 'locust', 'density': 15.0, 'lat': 35.0, 'lng': 118.0},
        {'pest_type': 'locust', 'density': 8.0, 'lat': 35.01, 'lng': 118.02},
        {'pest_type': 'aphid', 'density': 120.0, 'lat': 34.99, 'lng': 117.99},
        {'pest_type': 'cotton_bollworm', 'density': 1.5, 'lat': 35.02, 'lng': 118.01}
    ]
    
    recommendation = engine.generate_full_recommendation(
        detections,
        center_lat=35.0,
        center_lng=118.0,
        area_ha=100.0
    )
    
    print("\n📊 检测摘要:")
    print(f"  检测点数量: {recommendation['pest_summary']['total_detections']}")
    print(f"  害虫种类: {', '.join(recommendation['pest_summary']['pest_types'])}")
    print(f"  喷洒区域: {recommendation['summary']['total_zones']} 个")
    print(f"  农药总用量: {recommendation['summary']['total_pesticide_liters']:.2f} 升")
    print(f"  紧急区域: {recommendation['summary']['critical_zones']} 个")
    
    print("\n🌡️  天气影响分析:")
    if recommendation['weather']:
        w = recommendation['weather']
        print(f"  温度范围: {w['temperature']['min']:.1f} - {w['temperature']['max']:.1f} °C")
        print(f"  平均湿度: {w['humidity']['avg']:.1f} %")
        print(f"  预计降雨: {w['precipitation']['total']:.1f} mm")
    
    print("\n💊 农药推荐:")
    for pest_type, pesticides in recommendation['recommended_pesticides'].items():
        profile = kb.get_pest_profile(pest_type)
        pest_name = profile.chinese_name if profile else pest_type
        print(f"\n  {pest_name}:")
        for p in pesticides[:3]:
            print(f"    - {p['name']}: {p['dosage_per_ha_ml']} ml/ha")
            print(f"      有效成分: {p['active_ingredient']} ({p['concentration']}%)")
            if p['warnings']:
                print(f"      注意: {', '.join(p['warnings'][:2])}")
    
    print("\n🗺️  喷洒区域规划:")
    for zone in recommendation['spray_zones']:
        profile = kb.get_pest_profile(zone['pest_type'])
        pest_name = profile.chinese_name if profile else zone['pest_type']
        severity_colors = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🟢'}
        color = severity_colors.get(zone['severity'], '⚪')
        print(f"\n  {color} 区域 {zone['zone_id']}: {pest_name}")
        print(f"    中心位置: {zone['center']}")
        print(f"    覆盖范围: 半径 {zone['radius_meters']}m, 面积 {zone['area_hectares']}ha")
        print(f"    害虫密度: {zone['pest_density']:.1f} 只/m²")
        print(f"    严重等级: {zone['severity']}, 优先级: {zone['priority']}")
        print(f"    推荐剂量: {zone['dosage_per_ha']} ml/ha")
        print(f"    区域用量: {zone['total_pesticide_ml']/1000:.2f} 升")
    
    print("\n🌱 综合防治措施:")
    for pest_type, measures in recommendation['control_measures'].items():
        profile = kb.get_pest_profile(pest_type)
        pest_name = profile.chinese_name if profile else pest_type
        print(f"\n  {pest_name}:")
        
        if measures['cultural']:
            print(f"    🚜 农业措施: {', '.join(measures['cultural'][:2])}")
        if measures['biological']:
            print(f"    🐞 生物防治: {', '.join(measures['biological'][:2])}")
        if measures['chemical']:
            print(f"    💊 化学防治: {len(measures['chemical'])} 种农药推荐")
    
    if recommendation['recommended_spray_windows']:
        print("\n⏰ 最佳施药时间:")
        for i, window in enumerate(recommendation['recommended_spray_windows'][:3]):
            print(f"\n  窗口 {i+1}:")
            print(f"    开始时间: {window['start_time'].strftime('%Y-%m-%d %H:%M')}")
            print(f"    结束时间: {window['end_time'].strftime('%Y-%m-%d %H:%M')}")
            print(f"    持续时长: {window['duration_hours']} 小时")
            print(f"    适宜度评分: {window['average_score']}/100")
            print(f"    天气条件: 平均温度 {window['weather_conditions']['avg_temp']:.1f}°C")
    
    print("\n" + "=" * 70)
    print("✅ 防治建议生成完成!")
    print("=" * 70)


def quick_recommendation_only():
    """仅生成防治建议（快速模式）"""
    engine = ControlRecommendationEngine()
    
    detections = [
        {'pest_type': 'locust', 'density': 25.0, 'lat': 35.0, 'lng': 118.0}
    ]
    
    rec = engine.generate_full_recommendation(
        detections,
        center_lat=35.0,
        center_lng=118.0,
        area_ha=50.0
    )
    
    return rec


if __name__ == "__main__":
    print("🐛 智能虫害防治系统 v1.0")
    print()
    basic_usage_example()
