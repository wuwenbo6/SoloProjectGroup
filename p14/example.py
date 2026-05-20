#!/usr/bin/env python3
"""
示例脚本 - 演示如何使用各个模块
"""

import sys
import os
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_access import DataConnector
from data_cleaning import DataCleaner
from correlation_analysis import CorrelationAnalyzer


def example_data_access():
    print("=" * 50)
    print("示例 1: 数据接入模块")
    print("=" * 50)
    
    connector = DataConnector()
    
    from sklearn.datasets import load_iris
    iris = load_iris()
    df = pd.DataFrame(iris.data, columns=iris.feature_names)
    df["target"] = iris.target
    
    connector.data = df
    
    info = connector.get_data_info()
    print(f"数据源信息: {info}")
    print(f"\n数据预览:\n{connector.get_sample_data(3)}")
    
    return df


def example_data_cleaning(df):
    print("\n" + "=" * 50)
    print("示例 2: 数据清洗模块")
    print("=" * 50)
    
    df_with_nan = df.copy()
    df_with_nan.loc[0:5, "sepal length (cm)"] = np.nan
    
    cleaner = DataCleaner(df_with_nan)
    
    missing_summary = cleaner.get_missing_summary()
    print(f"缺失值统计: {missing_summary['total_missing']} 个缺失值")
    
    cleaner.handle_missing_values(strategy="fill_mean")
    
    outliers = cleaner.detect_outliers(method="iqr", threshold=1.5)
    print(f"异常值检测完成")
    
    cleaned_df = cleaner.get_cleaned_data()
    print(f"清洗后数据形状: {cleaned_df.shape}")
    
    return cleaned_df


def example_correlation_analysis(df):
    print("\n" + "=" * 50)
    print("示例 3: 关联分析模块")
    print("=" * 50)
    
    analyzer = CorrelationAnalyzer(df)
    
    corr_matrix = analyzer.compute_correlation_matrix(method="pearson")
    print("相关性矩阵:")
    print(corr_matrix.round(3))
    
    high_corr = analyzer.get_high_correlations(threshold=0.7)
    if high_corr:
        print(f"\n高相关性变量对 ({len(high_corr)} 个):")
        for item in high_corr:
            print(f"  {item['variable1']} - {item['variable2']}: {item['correlation']:.3f}")
    
    kmeans_result = analyzer.kmeans_clustering(n_clusters=3)
    print(f"\nK-Means 聚类结果: {kmeans_result['cluster_stats']}")
    
    causal_result = analyzer.causal_inference_simple(target_col="petal length (cm)")
    print(f"\n因果分析 - 目标变量: {causal_result['target']}")
    print(f"Top 预测因子: {causal_result['top_predictors']}")


def main():
    print("\n数据分析平台 - 模块功能演示\n")
    
    df = example_data_access()
    cleaned_df = example_data_cleaning(df)
    example_correlation_analysis(cleaned_df)
    
    print("\n" + "=" * 50)
    print("所有示例运行完成!")
    print("运行 'python app.py' 启动 Web 仪表板")
    print("=" * 50)


if __name__ == "__main__":
    main()
