import os
import sys
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, g, send_from_directory
from flask_cors import CORS
import uuid
import librosa

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.database.db_manager import DatabaseManager
from src.user_management.auth import UserManager
from src.data_access.audio_loader import AudioLoader
from src.feature_extraction.feature_extractor import FeatureExtractor
from src.analysis.style_classifier import StyleClassifier
from src.analysis.comparison import SingerComparator
from src.analysis.trend_analysis import TrendAnalyzer
from src.visualization.dashboard import OperaDashboard


class OperaAnalysisApp:
    def __init__(self):
        self.app = Flask(__name__)
        CORS(self.app)

        self.UPLOAD_FOLDER = os.path.join(os.getcwd(), 'data', 'uploads')
        os.makedirs(self.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(os.path.join(os.getcwd(), 'data', 'raw'), exist_ok=True)
        os.makedirs(os.path.join(os.getcwd(), 'data', 'processed'), exist_ok=True)

        self.app.config['UPLOAD_FOLDER'] = self.UPLOAD_FOLDER
        self.app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024

        self.db_manager = DatabaseManager(self.app)
        self.user_manager = UserManager(self.db_manager)
        self.audio_loader = AudioLoader()
        self.feature_extractor = FeatureExtractor()
        self.style_classifier = StyleClassifier()
        self.singer_comparator = SingerComparator()
        self.trend_analyzer = TrendAnalyzer()

        self.dashboard = None
        self._setup_routes()

    def _setup_routes(self):
        @self.app.before_request
        def before_request():
            g.db_manager = self.db_manager

        @self.app.route('/')
        def index():
            return jsonify({
                'message': '戏曲唱腔数据分析系统 API',
                'version': '1.0.0',
                'endpoints': {
                    'auth': ['/api/auth/register', '/api/auth/login'],
                    'audio': ['/api/audio/upload', '/api/audio/list', '/api/audio/<id>'],
                    'analysis': ['/api/analysis/classify', '/api/analysis/compare', '/api/analysis/trend'],
                    'dashboard': '/dashboard'
                }
            })

        @self.app.route('/api/auth/register', methods=['POST'])
        def register():
            data = request.json
            result = self.user_manager.register_user(
                username=data.get('username'),
                email=data.get('email'),
                password=data.get('password'),
                full_name=data.get('full_name'),
                role=data.get('role', 'user')
            )
            return jsonify(result), 200 if result['success'] else 400

        @self.app.route('/api/auth/login', methods=['POST'])
        def login():
            data = request.json
            result = self.user_manager.login_user(
                username=data.get('username'),
                password=data.get('password')
            )
            return jsonify(result), 200 if result['success'] else 401

        @self.app.route('/api/audio/upload', methods=['POST'])
        def upload_audio():
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({'error': '未授权'}), 401

            token = auth_header.split()[1] if len(auth_header.split()) > 1 else ''
            user = self.user_manager.get_current_user(token)
            if not user:
                return jsonify({'error': '无效令牌'}), 401

            if 'file' not in request.files:
                return jsonify({'error': '未上传文件'}), 400

            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': '未选择文件'}), 400

            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in self.audio_loader.SUPPORTED_FORMATS:
                return jsonify({
                    'error': f'不支持的音频格式: {file_ext}',
                    'supported_formats': self.audio_loader.SUPPORTED_FORMATS
                }), 400

            filename = f"{uuid.uuid4()}_{file.filename}"
            file_path = os.path.join(self.UPLOAD_FOLDER, filename)
            file.save(file_path)

            try:
                is_valid, validate_msg = self.audio_loader.validate_audio_file(file_path)
                if not is_valid:
                    os.remove(file_path)
                    return jsonify({'error': f'音频文件验证失败: {validate_msg}'}), 400

                audio_info = self.audio_loader.get_audio_info(file_path)
                duration = audio_info['duration']
                sr = audio_info['sample_rate']

            except Exception as e:
                if os.path.exists(file_path):
                    os.remove(file_path)
                return jsonify({
                    'error': f'音频文件解析失败: {str(e)}',
                    'hint': '请确保文件是有效的音频文件，尝试转换为WAV格式重试'
                }), 400

            audio = self.db_manager.save_audio_data(
                user_id=user.id,
                filename=filename,
                original_filename=file.filename,
                file_path=file_path,
                file_size=os.path.getsize(file_path),
                duration=float(duration),
                sample_rate=int(sr),
                opera_type=request.form.get('opera_type'),
                singer_name=request.form.get('singer_name'),
                year=int(request.form.get('year')) if request.form.get('year') else None,
                description=request.form.get('description')
            )

            return jsonify({
                'success': True,
                'audio_id': audio.id,
                'filename': audio.filename,
                'duration': audio.duration,
                'sample_rate': audio.sample_rate,
                'file_size_mb': round(os.path.getsize(file_path) / (1024 * 1024), 2)
            }), 201

        @self.app.route('/api/audio/extract-features/<int:audio_id>', methods=['POST'])
        def extract_features(audio_id):
            audio = self.db_manager.db.session.query(self.db_manager.models.AudioData).get(audio_id)
            if not audio:
                return jsonify({'error': '音频不存在'}), 404

            try:
                file_size_mb = os.path.getsize(audio.file_path) / (1024 * 1024)

                if file_size_mb > 100:
                    features = self.audio_loader.extract_features_in_chunks(
                        audio.file_path,
                        self.feature_extractor,
                        chunk_duration=30.0
                    )
                    features['large_file_processed'] = True
                else:
                    y, sr = self.audio_loader.load_audio(audio.file_path)
                    features = self.feature_extractor.extract_all_features(y, sr)

                self.db_manager.save_features(audio_id=audio_id, features=features)

                return jsonify({
                    'success': True,
                    'message': '特征提取完成',
                    'features_count': len(features),
                    'large_file_processed': file_size_mb > 100
                })
            except MemoryError:
                return jsonify({
                    'error': '内存不足，文件过大',
                    'hint': '尝试使用较短的音频文件，或使用分块处理模式'
                }), 500
            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/api/audio/list')
        def list_audio():
            audios = self.db_manager.get_audio_data()
            return jsonify([{
                'id': a.id,
                'filename': a.filename,
                'original_filename': a.original_filename,
                'opera_type': a.opera_type,
                'singer_name': a.singer_name,
                'year': a.year,
                'duration': a.duration,
                'is_processed': a.is_processed
            } for a in audios])

        @self.app.route('/api/analysis/classify/<int:audio_id>')
        def classify_opera(audio_id):
            features_df = self.db_manager.get_features_dataframe()
            if len(features_df) < 10:
                return jsonify({'error': '需要至少10个样本进行训练'}), 400

            if 'opera_type' not in features_df.columns or features_df['opera_type'].isna().all():
                return jsonify({'error': '需要戏曲类型标签进行训练'}), 400

            train_df = features_df[features_df['opera_type'].notna()]
            train_result = self.style_classifier.train(train_df, train_df['opera_type'])

            target_audio = features_df[features_df['audio_id'] == audio_id]
            if len(target_audio) == 0:
                return jsonify({'error': '未找到该音频的特征数据'}), 404

            prediction, probabilities = self.style_classifier.predict(target_audio)

            return jsonify({
                'predicted_type': prediction[0],
                'probabilities': probabilities[0],
                'model_accuracy': train_result.get('accuracy', 0)
            })

        @self.app.route('/api/analysis/compare-singers')
        def compare_singers():
            features_df = self.db_manager.get_features_dataframe()
            if 'singer' not in features_df.columns or features_df['singer'].nunique() < 2:
                return jsonify({'error': '需要至少2位传承人数据进行比较'}), 400

            singers = features_df['singer'].dropna().unique().tolist()
            comparison_results = {}

            for i, singer1 in enumerate(singers):
                for singer2 in singers[i+1:]:
                    try:
                        comp = self.singer_comparator.compare_two_singers(
                            features_df, singer1, singer2, singer_col='singer'
                        )
                        comparison_results[f"{singer1}_vs_{singer2}"] = {
                            'cosine_similarity': float(comp['similarity']['cosine_similarity']),
                            'sample_count': {
                                singer1: comp['singer1_samples'],
                                singer2: comp['singer2_samples']
                            }
                        }
                    except:
                        continue

            return jsonify({
                'singers': singers,
                'comparisons': comparison_results
            })

        @self.app.route('/api/analysis/trend')
        def trend_analysis():
            features_df = self.db_manager.get_features_dataframe()
            if 'year' not in features_df.columns or features_df['year'].nunique() < 3:
                return jsonify({'error': '需要至少3年的数据进行趋势分析'}), 400

            trend_results = self.trend_analyzer.analyze_time_trend(features_df, year_col='year')

            return jsonify({
                'year_range': trend_results['year_range'],
                'total_samples': trend_results['total_samples'],
                'significant_trends': {
                    k: v for k, v in trend_results['feature_trends'].items()
                    if isinstance(v, dict) and v.get('trend') in ['increasing', 'decreasing']
                }
            })

        @self.app.route('/api/stats')
        def get_stats():
            stats = self.db_manager.get_statistics()
            return jsonify(stats)

        @self.app.route('/api/export')
        def export_data():
            output_path = os.path.join(os.getcwd(), 'data', 'processed', 'opera_features_export.csv')
            self.db_manager.export_data(output_path)
            return send_from_directory(
                os.path.dirname(output_path),
                os.path.basename(output_path),
                as_attachment=True
            )

    def init_dashboard(self):
        with self.app.app_context():
            features_df = self.db_manager.get_features_dataframe()
            if len(features_df) > 0:
                self.dashboard = OperaDashboard(debug=True)
                self.dashboard.load_data(features_df, singer_col='singer',
                                          opera_type_col='opera_type', year_col='year')

                server = self.dashboard.app.server

                for route in list(server.url_map.iter_rules()):
                    self.app.url_map.add(route)

                for endpoint, view_func in server.view_functions.items():
                    self.app.view_functions[endpoint] = view_func

    def generate_sample_data(self):
        with self.app.app_context():
            if not self.db_manager.get_user(username='admin'):
                admin = self.db_manager.create_user(
                    username='admin',
                    email='admin@opera.com',
                    password='admin123',
                    full_name='系统管理员',
                    role='admin'
                )
                user_id = admin.id
            else:
                user_id = self.db_manager.get_user(username='admin').id

            if self.db_manager.db.session.query(self.db_manager.models.AudioData).count() > 0:
                print("已有数据，跳过生成")
                return

            print("生成示例数据...")

            opera_types = ['祁剧', '潮剧', '京剧', '越剧']
            singers = {
                '祁剧': ['张传承人', '李老艺人', '王大师'],
                '潮剧': ['陈名家', '林师傅', '黄传人'],
                '京剧': ['梅派传人', '程派名家'],
                '越剧': ['袁派传人', '尹派大师']
            }
            years = [2018, 2019, 2020, 2021, 2022, 2023]

            np.random.seed(42)

            for i in range(50):
                opera_type = np.random.choice(opera_types)
                singer = np.random.choice(singers[opera_type])
                year = np.random.choice(years)

                features = {
                    'pitch_mean': 200 + np.random.randn() * 50 + (opera_types.index(opera_type) * 20),
                    'pitch_std': 30 + np.random.randn() * 10,
                    'pitch_min': 100 + np.random.randn() * 30,
                    'pitch_max': 400 + np.random.randn() * 50,
                    'pitch_median': 200 + np.random.randn() * 40,
                    'pitch_range': 300 + np.random.randn() * 50,
                    'f0_mean': 180 + np.random.randn() * 40,
                    'f0_std': 25 + np.random.randn() * 8,
                    'tempo': 80 + np.random.randn() * 20 + (years.index(year) * 3),
                    'num_beats': int(100 + np.random.randn() * 30),
                    'ibi_mean': 0.5 + np.random.randn() * 0.2,
                    'ibi_std': 0.1 + np.random.randn() * 0.05,
                    'beat_density': 1.5 + np.random.randn() * 0.3,
                    'zcr_mean': 0.1 + np.random.randn() * 0.05,
                    'rms_mean': 0.05 + np.random.randn() * 0.02,
                    'rms_std': 0.03 + np.random.randn() * 0.01,
                    'rms_max': 0.2 + np.random.randn() * 0.05,
                    'spectral_centroid_mean': 1000 + np.random.randn() * 200,
                    'spectral_bandwidth_mean': 500 + np.random.randn() * 100,
                    'spectral_rolloff_mean': 1500 + np.random.randn() * 300,
                    'spectral_flatness_mean': 0.3 + np.random.randn() * 0.1,
                    'spectral_contrast_mean': 20 + np.random.randn() * 5,
                }

                for j in range(1, 14):
                    features[f'mfcc_{j}_mean'] = np.random.randn() * 10

                for j in range(1, 13):
                    features[f'chroma_{j}_mean'] = 0.5 + np.random.randn() * 0.2

                mock_path = f"/mock/audio_{i}.wav"
                audio = self.db_manager.save_audio_data(
                    user_id=user_id,
                    filename=f"audio_{i}.wav",
                    original_filename=f"sample_{opera_type}_{i}.wav",
                    file_path=mock_path,
                    file_size=np.random.randint(500000, 5000000),
                    duration=float(180 + np.random.randn() * 60),
                    sample_rate=22050,
                    opera_type=opera_type,
                    singer_name=singer,
                    year=year,
                    description=f"{opera_type}唱腔样本 - {singer}"
                )

                self.db_manager.save_features(audio.id, features)

            print(f"生成了50个样本数据")

    def run(self, host='0.0.0.0', port=5000, debug=True):
        self.init_dashboard()
        print(f"\n{'='*60}")
        print(f"戏曲唱腔数据分析系统启动")
        print(f"{'='*60}")
        print(f"API 地址: http://{host}:{port}")
        print(f"仪表板地址: http://{host}:{port}/dashboard")
        print(f"\n默认账号: admin / admin123")
        print(f"{'='*60}\n")
        self.app.run(host=host, port=port, debug=debug)


if __name__ == '__main__':
    opera_app = OperaAnalysisApp()

    with opera_app.app.app_context():
        opera_app.generate_sample_data()

    opera_app.run()
