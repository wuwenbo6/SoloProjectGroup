#!/usr/bin/env python3
"""
戏曲唱腔分析系统 - 数据库初始化脚本
初始化数据库表结构并创建示例数据
"""

import os
import sys
import json
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

from database.models import db, User, OperaGenre, Heritor, AudioData, FeatureData
from flask import Flask


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///opera_singing.db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app


def init_database():
    app = create_app()

    with app.app_context():
        print("正在创建数据库表...")
        db.create_all()
        print("✓ 数据库表创建完成")

        print("\n正在创建示例戏曲流派数据...")
        sample_genres = [
            {'name': 'Beijing_Opera', 'name_cn': '京剧', 'region': '北京',
             'description': '中国国粹，皮黄唱腔，讲究字正腔圆'},
            {'name': 'Yue_Opera', 'name_cn': '越剧', 'region': '浙江',
             'description': '柔美婉转，长于抒情，有第二国剧之称'},
            {'name': 'Yu_Opera', 'name_cn': '豫剧', 'region': '河南',
             'description': '高亢激越，大气磅礴，河南主要地方剧种'},
            {'name': 'Huangmei_Opera', 'name_cn': '黄梅戏', 'region': '安徽',
             'description': '质朴细腻，民歌风味，安徽主要地方剧种'},
            {'name': 'Kun_Opera', 'name_cn': '昆曲', 'region': '江苏',
             'description': '百戏之祖，典雅精致，曲牌体'},
            {'name': 'Qin_Opera', 'name_cn': '秦腔', 'region': '陕西',
             'description': '粗犷豪放，激越悲壮，梆子腔始祖'},
            {'name': 'Chuan_Opera', 'name_cn': '川剧', 'region': '四川',
             'description': '幽默风趣，高腔特色，变脸绝活'},
            {'name': 'Ping_Opera', 'name_cn': '评剧', 'region': '河北',
             'description': '活泼自由，贴近生活，北方主要剧种'}
        ]

        for genre_data in sample_genres:
            existing = OperaGenre.query.filter_by(name=genre_data['name']).first()
            if not existing:
                genre = OperaGenre(**genre_data)
                db.session.add(genre)

        db.session.commit()
        print(f"✓ 已创建 {len(sample_genres)} 个戏曲流派")

        print("\n正在创建示例传承人数据...")
        beijing_opera = OperaGenre.query.filter_by(name='Beijing_Opera').first()
        yue_opera = OperaGenre.query.filter_by(name='Yue_Opera').first()

        sample_heritors = [
            {
                'name': '梅兰芳',
                'gender': '男',
                'birth_year': 1894,
                'birth_place': '北京',
                'opera_genre_id': beijing_opera.id if beijing_opera else None,
                'school': '梅派',
                'generation': 1,
                'title': '京剧大师',
                'master': '吴菱仙',
                'biography': '中国京剧表演艺术大师，梅派创始人，位列四大名旦之首。',
                'representative_works': json.dumps(['贵妃醉酒', '霸王别姬', '宇宙锋', '穆桂英挂帅'], ensure_ascii=False),
                'style_features': json.dumps({'pitch_range': 'wide', 'vibrato': 'elegant', 'expression': 'subtle'}, ensure_ascii=False)
            },
            {
                'name': '程砚秋',
                'gender': '男',
                'birth_year': 1904,
                'birth_place': '北京',
                'opera_genre_id': beijing_opera.id if beijing_opera else None,
                'school': '程派',
                'generation': 1,
                'title': '京剧大师',
                'master': '梅兰芳',
                'biography': '京剧程派创始人，四大名旦之一。',
                'representative_works': json.dumps(['锁麟囊', '荒山泪', '窦娥冤', '春闺梦'], ensure_ascii=False),
                'style_features': json.dumps({'pitch_range': 'medium', 'vibrato': 'melancholic', 'tempo': 'slow'}, ensure_ascii=False)
            },
            {
                'name': '袁雪芬',
                'gender': '女',
                'birth_year': 1922,
                'birth_place': '浙江',
                'opera_genre_id': yue_opera.id if yue_opera else None,
                'school': '袁派',
                'generation': 1,
                'title': '越剧大师',
                'master': '王杏花',
                'biography': '越剧袁派创始人，越剧改革先驱。',
                'representative_works': json.dumps(['祥林嫂', '西厢记', '梁山伯与祝英台'], ensure_ascii=False),
                'style_features': json.dumps({'pitch_range': 'medium', 'vibrato': 'soft', 'emotion': 'deep'}, ensure_ascii=False)
            }
        ]

        for heritor_data in sample_heritors:
            existing = Heritor.query.filter_by(name=heritor_data['name']).first()
            if not existing:
                heritor = Heritor(**heritor_data)
                db.session.add(heritor)

        db.session.commit()
        print(f"✓ 已创建 {len(sample_heritors)} 个传承人")

        print("\n正在创建示例用户...")
        existing_admin = User.query.filter_by(username='admin').first()
        if not existing_admin:
            admin = User(
                username='admin',
                email='admin@opera.com',
                full_name='系统管理员',
                role='admin',
                expertise_level='expert'
            )
            admin.set_password('admin123')
            db.session.add(admin)

        existing_user = User.query.filter_by(username='user').first()
        if not existing_user:
            user = User(
                username='user',
                email='user@opera.com',
                full_name='测试用户',
                role='user',
                expertise_level='intermediate'
            )
            user.set_password('user123')
            db.session.add(user)

        db.session.commit()
        print("✓ 已创建示例用户 (admin/admin123, user/user123)")

        print("\n正在创建示例音频数据...")
        heritors = Heritor.query.all()
        users = User.query.all()
        admin_user = users[0] if users else None

        sample_audios = []
        for i, heritor in enumerate(heritors[:2]):
            audio = AudioData(
                filename=f'sample_{heritor.name}_{i+1}.wav',
                original_filename=f'{heritor.name}_代表作品.wav',
                file_path=f'/data/audio/sample_{heritor.name}_{i+1}.wav',
                file_size=1024 * 1024 * (i + 1) * 5,
                duration=180.0 + i * 60,
                sample_rate=22050,
                opera_type=heritor.opera_genre.name_cn if heritor.opera_genre else '京剧',
                singer_name=heritor.name,
                heritor_id=heritor.id,
                aria_name='贵妃醉酒' if '梅兰芳' in heritor.name else '锁麟囊',
                role_type='旦角',
                performance_venue='北京长安大戏院',
                year=1950 + i * 10,
                decade=(1950 + i * 10) // 10 * 10,
                description=f'{heritor.name} 代表作录音',
                user_id=admin_user.id if admin_user else 1,
                is_processed=True
            )
            sample_audios.append(audio)

        for audio in sample_audios:
            existing = AudioData.query.filter_by(filename=audio.filename).first()
            if not existing:
                db.session.add(audio)

        db.session.commit()
        print(f"✓ 已创建 {len(sample_audios)} 个示例音频")

        print("\n正在创建示例特征数据...")
        audios = AudioData.query.all()
        for audio in audios[:3]:
            existing_features = FeatureData.query.filter_by(audio_id=audio.id).first()
            if not existing_features:
                features = FeatureData(
                    audio_id=audio.id,
                    pitch_mean=440.0 + hash(audio.filename) % 200,
                    pitch_std=80.0 + hash(audio.filename) % 40,
                    pitch_min=200.0 + hash(audio.filename) % 100,
                    pitch_max=700.0 + hash(audio.filename) % 200,
                    pitch_median=420.0 + hash(audio.filename) % 100,
                    pitch_range=500.0 + hash(audio.filename) % 200,
                    tempo=90.0 + hash(audio.filename) % 40,
                    rms_mean=0.08 + (hash(audio.filename) % 100) / 1000,
                    rms_std=0.03 + (hash(audio.filename) % 50) / 1000,
                    spectral_centroid_mean=2000.0 + hash(audio.filename) % 1000,
                    spectral_bandwidth_mean=1500.0 + hash(audio.filename) % 500,
                )
                db.session.add(features)

        db.session.commit()
        print("✓ 已创建示例特征数据")

        print("\n" + "=" * 60)
        print("数据库初始化完成！")
        print("=" * 60)
        print("\n数据库统计:")
        print(f"  - 戏曲流派: {OperaGenre.query.count()}")
        print(f"  - 传承人: {Heritor.query.count()}")
        print(f"  - 用户: {User.query.count()}")
        print(f"  - 音频数据: {AudioData.query.count()}")
        print(f"  - 特征数据: {FeatureData.query.count()}")
        print("\n登录账号:")
        print("  - 管理员: admin / admin123")
        print("  - 普通用户: user / user123")


if __name__ == '__main__':
    init_database()
