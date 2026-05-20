#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试新模块导入
"""

import sys
import importlib.util

print("=" * 60)
print("测试新模块导入")
print("=" * 60)

modules_to_test = [
    ("turntable_config", "唱机配置模块"),
    ("tone_enhancer", "音色增强模块"),
    ("album_matcher", "专辑匹配模块"),
    ("batch_processor", "批量处理模块"),
]

for module_name, description in modules_to_test:
    print(f"\n测试 {description}...")
    try:
        spec = importlib.util.spec_from_file_location(
            module_name, 
            f"vinyl_processor/{module_name}.py"
        )
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            spec.loader.exec_module(module)
            print(f"  ✓ {module_name} 导入成功")
            
            classes = [attr for attr in dir(module) 
                      if not attr.startswith('_') and isinstance(getattr(module, attr), type)]
            print(f"    包含的类: {', '.join(classes)}")
        else:
            print(f"  ✗ 无法加载模块")
    except Exception as e:
        print(f"  ✗ 导入失败: {e}")

print("\n" + "=" * 60)
print("模块文件统计")
print("=" * 60)

import os
module_files = [f for f in os.listdir("vinyl_processor") if f.endswith(".py")]
print(f"总模块文件数: {len(module_files)}")
for f in sorted(module_files):
    if f != "__init__.py":
        print(f"  - {f}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
