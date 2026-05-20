#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
传统皮影戏材质分析系统
主应用入口文件
"""

import os
import sys

from database.models import init_db
from visualization.dashboard import ShadowPuppetDashboard

def initialize_system():
    print("=" * 60)
    print("🎭 传统皮影戏材质分析系统")
    print("=" * 60)
    print("\n正在初始化系统...")
    
    init_db()
    print("✅ 数据库初始化完成")
    
    os.makedirs('data/uploads', exist_ok=True)
    print("✅ 上传目录创建完成")
    
    print("\n系统初始化完成！")
    print("=" * 60)

def main():
    initialize_system()
    
    print("\n🚀 启动Dash可视化仪表板...")
    print("📊 仪表板地址: http://localhost:8050")
    print("💡 按 Ctrl+C 停止服务器")
    print("=" * 60)
    
    dashboard = ShadowPuppetDashboard()
    dashboard.run_server(debug=True, port=8050)

if __name__ == "__main__":
    main()
