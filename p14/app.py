#!/usr/bin/env python3
"""
数据分析平台 - 主应用入口
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from visualization import Dashboard


def main():
    print("=" * 60)
    print("数据分析平台启动中...")
    print("=" * 60)
    print("\n访问地址: http://localhost:8050")
    print("\n功能模块:")
    print("  - 数据接入: 支持CSV、JSON、MySQL、PostgreSQL、API")
    print("  - 数据清洗: 缺失值处理、异常值检测、类型转换")
    print("  - 关联分析: 相关性分析、聚类分析、因果推断")
    print("  - 可视化: 交互式仪表板、散点图、热力图")
    print("\n按 Ctrl+C 停止服务")
    print("=" * 60)
    
    dashboard = Dashboard()
    dashboard.run_server(debug=True, port=8050)


if __name__ == "__main__":
    main()
