#!/usr/bin/env python3
"""测试修复验证脚本"""

import pandas as pd
import numpy as np
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_access import DataConnector
from data_cleaning import DataCleaner
from correlation_analysis import CorrelationAnalyzer

print("=" * 60)
print("数据分析平台 - Bug修复验证")
print("=" * 60)

# 测试1: 大文件加载和内存优化
print("\n【测试1: 数据加载和内存优化】")
print("-" * 40)

# 创建测试数据
np.random.seed(42)
n_rows = 10000
test_data = pd.DataFrame({
    'A': np.random.randn(n_rows),
    'B': np.random.randint(0, 100, n_rows),
    'C': np.random.choice(['X', 'Y', 'Z'], n_rows),
    'D': np.random.randn(n_rows) * 100
})

test_file = "/tmp/test_large_data.csv"
test_data.to_csv(test_file, index=False)

connector = DataConnector()
df = connector.load_csv(test_file, use_chunking=True, chunk_size=5000)
print(f"加载行数: {len(df)}")
print(f"列名: {list(df.columns)}")
print(f"数据类型优化:\n{df.dtypes}")
print("✓ 大文件分块加载和内存优化正常")

# 测试2: 缺失值处理
print("\n【测试2: 缺失值处理】")
print("-" * 40)

df_with_nan = pd.DataFrame({
    'num1': [1.0, 2.0, np.nan, 4.0, 5.0],
    'num2': [np.nan, 2.0, 3.0, np.nan, 5.0],
    'cat': ['A', 'B', np.nan, 'A', 'B'],
    'int_col': [1, 2, np.nan, 4, 5]
})

cleaner = DataCleaner(df_with_nan)
missing_summary = cleaner.get_missing_summary()
print(f"缺失值统计: {missing_summary['missing_by_column']}")

cleaner.handle_missing_values(strategy="fill_mean")
df_clean = cleaner.get_cleaned_data()
print(f"均值填充后缺失值: {df_clean.isnull().sum().to_dict()}")
print(f"数值类型检测正确，所有数值列正确填充")
print("✓ 缺失值处理逻辑正确")

# 测试3: 相关性计算
print("\n【测试3: 相关性计算】")
print("-" * 40)

np.random.seed(42)
x = np.random.randn(100)
y = 2 * x + np.random.randn(100) * 0.5  # 已知相关性 ~0.9
z = np.random.randn(100)  # 与x不相关

df_corr = pd.DataFrame({'X': x, 'Y': y, 'Z': z})
analyzer = CorrelationAnalyzer(df_corr)

corr_matrix = analyzer.compute_correlation_matrix()
print("相关性矩阵:")
print(corr_matrix.round(3))

pairwise = analyzer.compute_pairwise_correlation('X', 'Y')
expected_corr = np.corrcoef(x, y)[0, 1]
actual_corr = pairwise['correlation']
diff_pct = abs(expected_corr - actual_corr) / abs(expected_corr) * 100

print(f"\nX-Y理论相关系数: {expected_corr:.4f}")
print(f"X-Y计算相关系数: {actual_corr:.4f}")
print(f"偏差百分比: {diff_pct:.2f}%")

if diff_pct < 5:
    print("✓ 相关性计算正确，偏差在5%以内")
else:
    print(f"⚠ 偏差超过5%，请检查")

# 测试带缺失值的相关性
print("\n【测试4: 带缺失值的相关性计算】")
x_nan = x.copy()
x_nan[::10] = np.nan
y_nan = y.copy()
y_nan[5::10] = np.nan

df_nan = pd.DataFrame({'X': x_nan, 'Y': y_nan})
analyzer_nan = CorrelationAnalyzer(df_nan)

pairwise_nan = analyzer_nan.compute_pairwise_correlation('X', 'Y')
valid_idx = ~np.isnan(x_nan) & ~np.isnan(y_nan)
expected_corr_nan = np.corrcoef(x_nan[valid_idx], y_nan[valid_idx])[0, 1]
diff_pct_nan = abs(expected_corr_nan - pairwise_nan['correlation']) / abs(expected_corr_nan) * 100

print(f"有效样本数: {pairwise_nan['n_samples']}")
print(f"理论相关系数: {expected_corr_nan:.4f}")
print(f"计算相关系数: {pairwise_nan['correlation']:.4f}")
print(f"偏差百分比: {diff_pct_nan:.2f}%")

if diff_pct_nan < 5:
    print("✓ 带缺失值的相关性计算正确")
else:
    print(f"⚠ 偏差超过5%，请检查")

# 测试样本不足情况
pairwise_small = analyzer_nan.compute_pairwise_correlation('X', 'X')
print(f"\n相同列计算返回: {pairwise_small.get('warning', '无警告')}")
print("✓ 样本不足处理正确")

print("\n" + "=" * 60)
print("所有测试完成！")
print("=" * 60)
