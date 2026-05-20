#!/usr/bin/env python3
"""
戏曲唱腔分析系统 - 主启动脚本
整合所有功能模块的启动入口
"""

import os
import sys
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))


def init_database():
    """初始化数据库"""
    print("正在初始化数据库...")
    from init_database import init_database as init_db
    init_db()


def run_quality_dashboard(host='127.0.0.1', port=8051):
    """运行唱腔质量评价仪表板"""
    from flask import Flask
    from database.models import db
    from visualization.dashboard import QualityDashboard

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///opera_singing.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        dashboard = QualityDashboard(db.session, debug=True)
        dashboard.run_server(host=host, port=port)


def run_feature_dashboard(host='127.0.0.1', port=8050):
    """运行特征可视化仪表板"""
    from visualization.dashboard import OperaDashboard
    dashboard = OperaDashboard(debug=True)
    dashboard.run_server(host=host, port=port)


def run_evolution_analysis(heritor_id=None, genre_id=None):
    """运行唱腔演变分析"""
    from flask import Flask
    from database.models import db
    from analysis.evolution_analyzer import EvolutionAnalyzer

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///opera_singing.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        analyzer = EvolutionAnalyzer(db.session)

        if heritor_id:
            result = analyzer.analyze_heritor_evolution(heritor_id)
            print("\n传承人唱腔演变分析结果:")
        elif genre_id:
            result = analyzer.analyze_genre_evolution(genre_id)
            print("\n戏曲流派唱腔演变分析结果:")
        else:
            print("请指定 --heritor-id 或 --genre-id")
            return

        import json
        print(json.dumps(result, ensure_ascii=False, indent=2))


def run_heritor_matching():
    """运行传承人自动匹配"""
    from flask import Flask
    from database.models import db
    from database.heritor_matcher import HeritorMatcher

    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///opera_singing.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        matcher = HeritorMatcher(db.session)

        unassigned = matcher.get_unassigned_audios(limit=10)
        print(f"找到 {len(unassigned)} 个未关联的音频")

        for audio in unassigned:
            print(f"\n处理音频: {audio.filename}")
            suggestions = matcher.suggest_corrections(audio.id, top_k=3)
            for s in suggestions:
                print(f"  - {s['name']} ({s['opera_genre']}): 置信度 {s['confidence']:.2f}")


def show_help():
    """显示帮助信息"""
    print("""
戏曲唱腔分析系统 - 使用说明
============================

可用命令:

1. 初始化数据库
   python run_system.py init

2. 运行唱腔质量评价与标注仪表板
   python run_system.py quality [--host HOST] [--port PORT]

3. 运行特征可视化仪表板
   python run_system.py features [--host HOST] [--port PORT]

4. 运行唱腔演变分析
   python run_system.py evolution --heritor-id ID
   python run_system.py evolution --genre-id ID

5. 运行传承人自动匹配
   python run_system.py match

示例:
  python run_system.py init
  python run_system.py quality --port 8051
  python run_system.py evolution --heritor-id 1
""")


def main():
    parser = argparse.ArgumentParser(description='戏曲唱腔分析系统')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    subparsers.add_parser('init', help='初始化数据库')

    quality_parser = subparsers.add_parser('quality', help='运行质量评价仪表板')
    quality_parser.add_argument('--host', default='127.0.0.1', help='主机地址')
    quality_parser.add_argument('--port', type=int, default=8051, help='端口号')

    features_parser = subparsers.add_parser('features', help='运行特征可视化仪表板')
    features_parser.add_argument('--host', default='127.0.0.1', help='主机地址')
    features_parser.add_argument('--port', type=int, default=8050, help='端口号')

    evolution_parser = subparsers.add_parser('evolution', help='唱腔演变分析')
    evolution_parser.add_argument('--heritor-id', type=int, help='传承人ID')
    evolution_parser.add_argument('--genre-id', type=int, help='流派ID')

    subparsers.add_parser('match', help='传承人自动匹配')

    args = parser.parse_args()

    if args.command is None:
        show_help()
        return

    if args.command == 'init':
        init_database()

    elif args.command == 'quality':
        run_quality_dashboard(host=args.host, port=args.port)

    elif args.command == 'features':
        run_feature_dashboard(host=args.host, port=args.port)

    elif args.command == 'evolution':
        run_evolution_analysis(heritor_id=args.heritor_id, genre_id=args.genre_id)

    elif args.command == 'match':
        run_heritor_matching()

    else:
        show_help()


if __name__ == '__main__':
    main()
