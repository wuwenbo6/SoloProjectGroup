#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
唱机音频处理系统 - 功能增强版使用示例
"""

import os
from vinyl_processor import (
    TurntableConfigurator,
    ToneEnhancer,
    AlbumMatcher,
    BatchProcessor,
    ProcessingConfig
)

def example_turntable_config():
    """唱机配置示例"""
    print("=" * 60)
    print("1. 唱机型号适配示例")
    print("=" * 60)
    
    turntable = TurntableConfigurator(sample_rate=44100)
    
    print("\n可用的唱机预设:")
    for preset_name in turntable.list_presets():
        preset_info = turntable.get_preset_info(preset_name)
        print(f"  - {preset_name}: {preset_info['name']}")
    
    turntable.load_preset("technics_sl1200")
    print(f"\n当前使用的唱机: {turntable.get_current_profile_name()}")
    
    params = turntable.get_noise_reduction_params()
    print(f"降噪参数: 爆音检测灵敏度 = {params['click_sensitivity']}")


def example_tone_enhancement():
    """音色增强示例"""
    print("\n" + "=" * 60)
    print("2. 音色增强示例")
    print("=" * 60)
    
    enhancer = ToneEnhancer(sample_rate=44100)
    
    print("\n可用的均衡器预设:")
    for preset_name in enhancer.list_eq_presets():
        preset_info = enhancer.get_preset_info(preset_name)
        print(f"  - {preset_name}: {preset_info['name']} - {preset_info['description']}")
    
    enhancer.apply_eq_preset("vintage")
    print(f"\n已应用预设: {enhancer.current_eq_preset}")
    
    enhancer.set_stereo_width(1.1)
    enhancer.set_harmonic_amount(0.2)
    enhancer.set_warmth(0.3)
    print("已设置立体声宽度、谐波增强和温暖度")


def example_album_matching():
    """专辑信息匹配示例"""
    print("\n" + "=" * 60)
    print("3. 专辑信息自动匹配示例")
    print("=" * 60)
    
    matcher = AlbumMatcher(sample_rate=44100)
    
    matcher.create_sample_database()
    
    stats = matcher.get_database_stats()
    print(f"\n数据库统计:")
    print(f"  - 专辑总数: {stats['total_albums']}")
    print(f"  - 曲目总数: {stats['total_tracks']}")
    print(f"  - 风格: {', '.join(stats['genres'])}")
    print(f"  - 年代: {', '.join(stats['years'])}")
    
    print("\n搜索 'Pink Floyd':")
    results = matcher.search_album("Pink Floyd")
    for album in results:
        print(f"  - {album.artist} - {album.title} ({album.year})")
    
    filename = "Pink Floyd - Dark Side of the Moon.wav"
    print(f"\n基于文件名匹配 '{filename}':")
    matches = matcher.match_by_filename(filename)
    if matches:
        print(f"  最佳匹配: {matches[0].artist} - {matches[0].title}")
        print(f"  置信度: {matches[0].confidence:.2f}")
        print(f"  风格: {matches[0].genre}")


def example_batch_processing():
    """批量转录示例"""
    print("\n" + "=" * 60)
    print("4. 批量转录示例")
    print("=" * 60)
    
    processor = BatchProcessor()
    
    print("\n可用的处理预设:")
    presets = processor.get_presets()
    for preset_name, preset_info in presets.items():
        print(f"  - {preset_name}: {preset_info['name']} - {preset_info['description']}")
    
    processor.apply_preset("vintage")
    print(f"\n已应用预设配置")
    
    print("\n当前配置:")
    config_dict = processor.config.to_dict()
    print(f"  - 降噪: {'开启' if config_dict['noise_reduction_enabled'] else '关闭'}")
    print(f"  - 转速校正: {'开启' if config_dict['speed_correction_enabled'] else '关闭'}")
    print(f"  - 均衡器: {config_dict['equalization_preset'] if config_dict['equalization_enabled'] else '关闭'}")
    print(f"  - 音频分段: {'开启' if config_dict['segmentation_enabled'] else '关闭'}")
    print(f"  - 立体声增强: {config_dict['stereo_enhancement']}x")
    print(f"  - 温暖度: {config_dict['warmth_enhancement']}")
    print(f"  - 输出格式: {config_dict['output_format']}")
    print(f"  - 自动元数据匹配: {'开启' if config_dict['auto_metadata'] else '关闭'}")


def main():
    """主函数"""
    print("\n" + "#" * 60)
    print("#  唱机音频处理系统 - 功能增强版")
    print("#  新增功能: 唱机型号适配、音色增强、专辑信息匹配、批量转录")
    print("#" * 60 + "\n")
    
    example_turntable_config()
    example_tone_enhancement()
    example_album_matching()
    example_batch_processing()
    
    print("\n" + "=" * 60)
    print("功能展示完成!")
    print("=" * 60)
    print("""
实际使用方式:

1. 批量处理单个文件:
   processor = BatchProcessor()
   processor.apply_preset("vintage")
   result = processor.process_single_file("input.wav", "output_dir")

2. 批量处理整个目录:
   processor = BatchProcessor()
   processor.apply_preset("audiophile")
   results = processor.process_directory("input_dir", "output_dir", recursive=True)

3. 保存处理报告:
   processor.save_processing_report(results, "report.json")
""")


if __name__ == "__main__":
    main()
