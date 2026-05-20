#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地推理模块使用示例
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from local_inference import OfflineSynthesizer, create_synthesizer, ModelLoadStatus, FallbackMode

def example_basic_usage():
    """基础使用示例"""
    print("=" * 60)
    print("示例 1: 基础使用")
    print("=" * 60)
    
    synthesizer = create_synthesizer()
    
    print("\n加载状态:", synthesizer.get_load_status())
    print("\n设备信息:", synthesizer.get_device_info())
    print("\n支持的方言:", synthesizer.get_supported_dialects())
    
    result = synthesizer.synthesize(
        text="你好，这是福州话测试语音",
        dialect_id=1,
        output_path="example_output.wav",
        emotion="neutral",
        speed=1.0
    )
    
    print("\n合成结果:", result)
    if result["success"]:
        print(f"✓ 合成成功! 时长: {result['duration']:.2f} 秒")
        print(f"  方言: {result['dialect_name']}")
        print(f"  采样率: {result['sample_rate']} Hz")
        print(f"  是否降级模式: {result['fallback_used']}")
    else:
        print(f"✗ 合成失败: {result.get('error')}")

def example_multiple_dialects():
    """多方言合成示例"""
    print("\n" + "=" * 60)
    print("示例 2: 多方言合成")
    print("=" * 60)
    
    synthesizer = OfflineSynthesizer()
    synthesizer.load_model()
    
    texts = [
        (1, "福州话：这是福州话的语音合成测试"),
        (2, "厦门话：这是厦门话的语音合成测试"),
        (3, "长沙话：这是长沙话的语音合成测试"),
        (4, "双峰话：这是双峰话的语音合成测试"),
        (5, "莆田话：这是莆田话的语音合成测试"),
    ]
    
    output_dir = "dialect_outputs"
    os.makedirs(output_dir, exist_ok=True)
    
    for dialect_id, text in texts:
        output_path = os.path.join(output_dir, f"dialect_{dialect_id}.wav")
        result = synthesizer.synthesize(text, dialect_id, output_path)
        
        status = "✓" if result["success"] else "✗"
        print(f"\n{status} 方言ID {dialect_id}: {result.get('dialect_name', '未知')}")
        if result["success"]:
            print(f"  时长: {result['duration']:.2f} 秒")
            print(f"  输出: {output_path}")
        else:
            print(f"  错误: {result.get('error')}")

def example_batch_synthesis():
    """批量合成示例"""
    print("\n" + "=" * 60)
    print("示例 3: 批量合成")
    print("=" * 60)
    
    synthesizer = create_synthesizer()
    
    texts = [
        "这是第一句话。",
        "这是第二句话，稍微长一些。",
        "方言语音合成是一项有意义的技术。",
        "它有助于保护和传承地方语言文化。",
        "小众方言保护需要我们共同努力。"
    ]
    
    print(f"\n准备合成 {len(texts)} 条语音...")
    
    results = synthesizer.batch_synthesize(texts, dialect_id=1, output_dir="batch_output")
    
    success_count = sum(1 for r in results if r["success"])
    print(f"\n批量合成完成: {success_count}/{len(texts)} 成功")
    
    for i, result in enumerate(results):
        status = "✓" if result["success"] else "✗"
        print(f"  {status} 文本 {i+1}: {result['duration']:.2f}秒" if result["success"] else f"  {status} 文本 {i+1}: 失败")

def example_error_handling():
    """错误处理示例"""
    print("\n" + "=" * 60)
    print("示例 4: 错误处理与降级机制")
    print("=" * 60)
    
    print("\n测试不使用降级模式 (FallbackMode.NONE):")
    synth_no_fallback = OfflineSynthesizer(fallback_mode=FallbackMode.NONE)
    status = synth_no_fallback.load_model()
    print(f"  加载结果: {'成功' if status else '失败'}")
    print(f"  模型状态: {synth_no_fallback.status.value}")
    print(f"  错误历史: {synth_no_fallback.error_history}")
    
    print("\n测试默认降级模式 (FallbackMode.RULE_BASED):")
    synth_with_fallback = OfflineSynthesizer(fallback_mode=FallbackMode.RULE_BASED)
    status = synth_with_fallback.load_model()
    print(f"  加载结果: {'成功' if status else '失败'}")
    print(f"  模型状态: {synth_with_fallback.status.value}")
    print(f"  是否降级: {synth_with_fallback.status == ModelLoadStatus.FALLBACK}")
    
    result = synth_with_fallback.synthesize("测试降级模式下的合成", dialect_id=1)
    print(f"  降级合成结果: {'成功' if result['success'] else '失败'}")
    print(f"  使用降级: {result.get('fallback_used', False)}")

def example_monitoring():
    """监控与诊断示例"""
    print("\n" + "=" * 60)
    print("示例 5: 监控与诊断")
    print("=" * 60)
    
    synthesizer = create_synthesizer()
    
    print("\n=== 加载状态 ===")
    load_status = synthesizer.get_load_status()
    print(f"  状态: {load_status['status']}")
    print(f"  组件状态: {load_status['load_status']}")
    print(f"  支持方言数: {load_status['supported_dialects']}")
    print(f"  错误数: {load_status['error_count']}")
    
    print("\n=== 设备信息 ===")
    device_info = synthesizer.get_device_info()
    for key, value in device_info.items():
        print(f"  {key}: {value}")
    
    print("\n=== 方言详情 ===")
    dialects = synthesizer.get_supported_dialects()
    for d in dialects:
        status = "已加载" if d["loaded"] else "未加载"
        print(f"  {d['id']}. {d['name']} - {status}")

def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("本地语音合成模块 - 使用示例")
    print("=" * 60 + "\n")
    
    try:
        example_basic_usage()
        example_multiple_dialects()
        example_batch_synthesis()
        example_error_handling()
        example_monitoring()
        
        print("\n" + "=" * 60)
        print("所有示例运行完成!")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n✗ 运行出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
