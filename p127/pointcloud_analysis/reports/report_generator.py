import os
import json
import numpy as np
from datetime import datetime
from typing import Dict, Optional
from jinja2 import Template


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _safe_get_value(self, obj, key, default=None):
        if isinstance(obj, dict):
            value = obj.get(key, default)
            if value is None:
                return default
            return value
        elif hasattr(obj, key):
            value = getattr(obj, key, default)
            if value is None:
                return default
            return value
        return default

    def _format_safety_level(self, safety_level):
        if safety_level is None:
            return '未知'
        if hasattr(safety_level, 'value'):
            return safety_level.value
        return str(safety_level)

    def generate_html_report(self, analysis_results: Dict,
                              point_cloud_info: Optional[Dict] = None,
                              advanced_results: Optional[Dict] = None,
                              filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"wear_analysis_report_{timestamp}.html"

        output_path = os.path.join(self.output_dir, filename)

        html_template = self._get_html_template()
        template = Template(html_template)

        overall_safety_level = self._format_safety_level(
            analysis_results.get('overall_safety_level', '未知')
        )
        
        thickness_eval = analysis_results.get('thickness_evaluation', {}) or {}
        wear_eval = analysis_results.get('wear_evaluation', {}) or {}
        
        advanced = advanced_results or {}
        prediction = advanced.get('prediction', {})
        repair = advanced.get('repair', {})
        slice_info = advanced.get('slice', {})
        
        context = {
            'report_title': '点云磨损分析报告',
            'report_date': datetime.now().strftime("%Y年%m月%d日 %H:%M:%S"),
            'point_cloud_info': point_cloud_info or {},
            'overall_safety_level': overall_safety_level,
            'overall_score': float(analysis_results.get('overall_score', 0)),
            'nominal_thickness': float(self._safe_get_value(thickness_eval, 'nominal_thickness', 0)),
            'mean_normalized_thickness': float(self._safe_get_value(thickness_eval, 'mean_normalized_thickness', 0)),
            'safe_percentage': float(self._safe_get_value(thickness_eval, 'safe_percentage', 0)),
            'warning_percentage': float(self._safe_get_value(thickness_eval, 'warning_percentage', 0)),
            'danger_percentage': float(self._safe_get_value(thickness_eval, 'danger_percentage', 0)),
            'critical_percentage': float(self._safe_get_value(thickness_eval, 'critical_percentage', 0)),
            'wear_percentage': float(self._safe_get_value(wear_eval, 'wear_percentage', 0)),
            'max_wear_depth': float(self._safe_get_value(wear_eval, 'max_wear_depth', 0)),
            'mean_wear_depth': float(self._safe_get_value(wear_eval, 'mean_wear_depth', 0)),
            'wear_safety_level': self._format_safety_level(self._safe_get_value(wear_eval, 'safety_level', '未知')),
            'final_recommendations': analysis_results.get('final_recommendations', ['数据正常，继续观察']),
            'has_prediction': 'predictions' in prediction,
            'prediction': prediction,
            'has_repair': 'repair_volume_m3' in repair,
            'repair': repair,
            'has_slice': 'slice_count' in slice_info,
            'slice_info': slice_info
        }

        html_content = template.render(**context)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return output_path

    def generate_comparison_report(self, comparison_results: Dict,
                                    filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"multi_period_comparison_{timestamp}.html"

        output_path = os.path.join(self.output_dir, filename)

        html_template = self._get_comparison_template()
        template = Template(html_template)

        context = {
            'report_title': '多期数据对比报告',
            'report_date': datetime.now().strftime("%Y年%m月%d日 %H:%M:%S"),
            'comparison': comparison_results
        }

        html_content = template.render(**context)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return output_path

    def generate_prediction_report(self, prediction_results: Dict,
                                    filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"weathering_prediction_{timestamp}.html"

        output_path = os.path.join(self.output_dir, filename)

        html_template = self._get_prediction_template()
        template = Template(html_template)

        context = {
            'report_title': '风化趋势预测报告',
            'report_date': datetime.now().strftime("%Y年%m月%d日 %H:%M:%S"),
            'prediction': prediction_results
        }

        html_content = template.render(**context)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return output_path

    def generate_json_report(self, analysis_results: Dict,
                              point_cloud_info: Optional[Dict] = None,
                              advanced_results: Optional[Dict] = None,
                              filename: Optional[str] = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"wear_analysis_report_{timestamp}.json"

        output_path = os.path.join(self.output_dir, filename)

        report_data = {
            'report_info': {
                'title': '点云磨损分析报告',
                'date': datetime.now().isoformat(),
                'version': '1.1'
            },
            'point_cloud_info': self._convert_to_serializable(point_cloud_info or {}),
            'analysis_results': self._convert_to_serializable(analysis_results),
            'advanced_results': self._convert_to_serializable(advanced_results or {})
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return output_path

    def _convert_to_serializable(self, obj):
        if obj is None:
            return None
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif hasattr(obj, 'value'):
            return obj.value
        elif isinstance(obj, dict):
            return {k: self._convert_to_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_serializable(item) for item in obj]
        else:
            return str(obj)

    def _get_html_template(self) -> str:
        return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ report_title }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            background: #f5f7fa;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header p {
            opacity: 0.9;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 22px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .info-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .info-card h3 {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
        }
        .info-card p {
            color: #333;
            font-size: 18px;
            font-weight: bold;
        }
        .safety-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 16px;
        }
        .safety-safe {
            background: #d4edda;
            color: #155724;
        }
        .safety-warning {
            background: #fff3cd;
            color: #856404;
        }
        .safety-danger {
            background: #f8d7da;
            color: #721c24;
        }
        .safety-critical {
            background: #721c24;
            color: white;
        }
        .progress-bar {
            width: 100%;
            height: 25px;
            background: #e9ecef;
            border-radius: 12px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            padding-right: 10px;
            color: white;
            font-weight: bold;
            font-size: 12px;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-top: 20px;
        }
        .stat-grid-3 {
            grid-template-columns: repeat(3, 1fr);
        }
        .stat-item {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .stat-item .value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
        }
        .stat-item .label {
            color: #666;
            margin-top: 5px;
            font-size: 14px;
        }
        .recommendations {
            background: #fff3cd;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .recommendations h3 {
            color: #856404;
            margin-bottom: 15px;
        }
        .recommendations ul {
            list-style: none;
        }
        .recommendations li {
            padding: 8px 0;
            padding-left: 25px;
            position: relative;
        }
        .recommendations li:before {
            content: '⚠';
            position: absolute;
            left: 0;
            color: #856404;
        }
        .thickness-bars {
            margin-top: 20px;
        }
        .thickness-bar {
            margin: 10px 0;
        }
        .thickness-bar .label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 14px;
        }
        .wear-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .score-circle {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 20px auto;
            font-size: 36px;
            font-weight: bold;
            color: white;
        }
        .repair-section {
            background: #e7f3ff;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .prediction-section {
            background: #f0fff4;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }
        .priority-critical {
            color: #721c24;
            font-weight: bold;
        }
        .priority-high {
            color: #dc3545;
            font-weight: bold;
        }
        .priority-medium {
            color: #ffc107;
            font-weight: bold;
        }
        .priority-low {
            color: #28a745;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ report_title }}</h1>
            <p>生成时间: {{ report_date }}</p>
        </div>

        <div class="content">
            <div class="section">
                <h2>总体评估结果</h2>
                <div style="text-align: center;">
                    {% set score = overall_score * 100 %}
                    {% if score >= 80 %}
                        {% set color = '#28a745' %}
                    {% elif score >= 60 %}
                        {% set color = '#ffc107' %}
                    {% elif score >= 40 %}
                        {% set color = '#dc3545' %}
                    {% else %}
                        {% set color = '#721c24' %}
                    {% endif %}
                    <div class="score-circle" style="background: {{ color }};">
                        {{ "%.1f"|format(score) }}分
                    </div>
                    <div>
                        {% if overall_safety_level == '安全' %}
                            <span class="safety-badge safety-safe">{{ overall_safety_level }}</span>
                        {% elif overall_safety_level == '警告' %}
                            <span class="safety-badge safety-warning">{{ overall_safety_level }}</span>
                        {% elif overall_safety_level == '危险' %}
                            <span class="safety-badge safety-danger">{{ overall_safety_level }}</span>
                        {% else %}
                            <span class="safety-badge safety-critical">{{ overall_safety_level }}</span>
                        {% endif %}
                    </div>
                </div>
            </div>

            {% if point_cloud_info %}
            <div class="section">
                <h2>点云基本信息</h2>
                <div class="info-grid">
                    <div class="info-card">
                        <h3>点数量</h3>
                        <p>{{ point_cloud_info.num_points | default('N/A') }}</p>
                    </div>
                    <div class="info-card">
                        <h3>文件格式</h3>
                        <p>{{ point_cloud_info.file_format | default('N/A') }}</p>
                    </div>
                    <div class="info-card">
                        <h3>有效厚度点</h3>
                        <p>{{ point_cloud_info.num_valid_points | default('N/A') }}</p>
                    </div>
                </div>
            </div>
            {% endif %}

            <div class="section">
                <h2>厚度评估</h2>
                <div class="stat-grid">
                    <div class="stat-item">
                        <div class="value">{{ "%.3f"|format(nominal_thickness) }}</div>
                        <div class="label">标称厚度 (m)</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">{{ "%.1f%%"|format(mean_normalized_thickness * 100) }}</div>
                        <div class="label">平均相对厚度</div>
                    </div>
                </div>

                <div class="thickness-bars">
                    <div class="thickness-bar">
                        <div class="label">
                            <span>安全区域</span>
                            <span>{{ "%.1f%%"|format(safe_percentage) }}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {{ safe_percentage }}%; background: #28a745;">
                                {{ "%.1f%%"|format(safe_percentage) }}
                            </div>
                        </div>
                    </div>
                    <div class="thickness-bar">
                        <div class="label">
                            <span>警告区域</span>
                            <span>{{ "%.1f%%"|format(warning_percentage) }}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {{ warning_percentage }}%; background: #ffc107;">
                                {{ "%.1f%%"|format(warning_percentage) }}
                            </div>
                        </div>
                    </div>
                    <div class="thickness-bar">
                        <div class="label">
                            <span>危险区域</span>
                            <span>{{ "%.1f%%"|format(danger_percentage) }}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {{ danger_percentage }}%; background: #fd7e14;">
                                {{ "%.1f%%"|format(danger_percentage) }}
                            </div>
                        </div>
                    </div>
                    <div class="thickness-bar">
                        <div class="label">
                            <span>严重区域</span>
                            <span>{{ "%.1f%%"|format(critical_percentage) }}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: {{ critical_percentage }}%; background: #dc3545;">
                                {{ "%.1f%%"|format(critical_percentage) }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>磨损评估</h2>
                <div class="wear-stats">
                    <div class="stat-item">
                        <div class="value">{{ "%.1f%%"|format(wear_percentage) }}</div>
                        <div class="label">磨损面积比例</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">{{ "%.4f"|format(max_wear_depth) }}m</div>
                        <div class="label">最大磨损深度</div>
                    </div>
                    <div class="stat-item">
                        <div class="value">{{ "%.4f"|format(mean_wear_depth) }}m</div>
                        <div class="label">平均磨损深度</div>
                    </div>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    {% if wear_safety_level == '安全' %}
                        <span class="safety-badge safety-safe">磨损状态: {{ wear_safety_level }}</span>
                    {% elif wear_safety_level == '警告' %}
                        <span class="safety-badge safety-warning">磨损状态: {{ wear_safety_level }}</span>
                    {% elif wear_safety_level == '危险' %}
                        <span class="safety-badge safety-danger">磨损状态: {{ wear_safety_level }}</span>
                    {% else %}
                        <span class="safety-badge safety-critical">磨损状态: {{ wear_safety_level }}</span>
                    {% endif %}
                </div>
            </div>

            {% if has_prediction %}
            <div class="section">
                <h2>风化趋势预测</h2>
                <div class="prediction-section">
                    <div class="stat-grid stat-grid-3">
                        <div class="stat-item">
                            <div class="value">{{ "%.1f天"|format(prediction.remaining_life_days | default(0)) }}</div>
                            <div class="label">预计剩余寿命</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">{{ prediction.history_count | default(0) }}</div>
                            <div class="label">历史数据点数量</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">{{ prediction.days_ahead | default(365) }}天</div>
                            <div class="label">预测范围</div>
                        </div>
                    </div>
                </div>
            </div>
            {% endif %}

            {% if has_repair %}
            <div class="section">
                <h2>维修量估算</h2>
                <div class="repair-section">
                    <div class="stat-grid stat-grid-3">
                        <div class="stat-item">
                            <div class="value">{{ "%.4f"|format(repair.repair_volume_m3 | default(0)) }}m³</div>
                            <div class="label">修复体积</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">{{ "%.4f"|format(repair.repair_area_m2 | default(0)) }}m²</div>
                            <div class="label">修复面积</div>
                        </div>
                        <div class="stat-item">
                            <div class="value">{{ "%.1f"|format(repair.material_weight_kg | default(0)) }}kg</div>
                            <div class="label">预计材料重量</div>
                        </div>
                    </div>
                    {% if repair.recommendation %}
                    <div style="margin-top: 20px;">
                        <strong>修复建议:</strong>
                        <span class="priority-{{ repair.priority | default('low') }}">
                            {{ repair.recommendation }}
                        </span>
                        <br>
                        <small>预计工期: {{ repair.estimated_timeline_days | default(1) }}天</small>
                    </div>
                    {% endif %}
                </div>
            </div>
            {% endif %}

            {% if has_slice %}
            <div class="section">
                <h2>切片分析</h2>
                <div class="info-grid">
                    <div class="info-card">
                        <h3>切片数量</h3>
                        <p>{{ slice_info.slice_count | default('N/A') }}</p>
                    </div>
                    <div class="info-card">
                        <h3>切片方向</h3>
                        <p>{{ slice_info.axis | default('N/A') }}</p>
                    </div>
                    <div class="info-card">
                        <h3>平均点数</h3>
                        <p>{{ "%.0f"|format(slice_info.avg_points | default(0)) }}</p>
                    </div>
                </div>
            </div>
            {% endif %}

            <div class="section">
                <h2>建议措施</h2>
                <div class="recommendations">
                    <h3>重要建议</h3>
                    <ul>
                        {% for rec in final_recommendations %}
                        <li>{{ rec }}</li>
                        {% endfor %}
                    </ul>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>本报告由点云磨损分析系统自动生成</p>
            <p>如有疑问，请联系技术支持</p>
        </div>
    </div>
</body>
</html>
        """

    def _get_comparison_template(self) -> str:
        return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ report_title }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            background: #f5f7fa;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #11998e;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .comparison-table th, .comparison-table td {
            padding: 12px;
            text-align: center;
            border: 1px solid #ddd;
        }
        .comparison-table th {
            background: #11998e;
            color: white;
        }
        .comparison-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        .positive {
            color: #28a745;
            font-weight: bold;
        }
        .negative {
            color: #dc3545;
            font-weight: bold;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ report_title }}</h1>
            <p>生成时间: {{ report_date }}</p>
        </div>
        <div class="content">
            <div class="section">
                <h2>周期对比摘要</h2>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>对比项目</th>
                            <th>变化值</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>磨损增加比例</td>
                            <td>{{ "%.2f%%"|format(comparison.wear_increase_percentage | default(0)) }}</td>
                            <td class="{{ 'negative' if (comparison.wear_increase_percentage | default(0)) > 0 else 'positive' }}">
                                {{ '恶化' if (comparison.wear_increase_percentage | default(0)) > 0 else '改善' }}
                            </td>
                        </tr>
                        <tr>
                            <td>劣化率</td>
                            <td>{{ "%.4f"|format(comparison.deterioration_rate | default(0)) }}/年</td>
                            <td class="{{ 'negative' if (comparison.deterioration_rate | default(0)) > 0.1 else 'positive' }}">
                                {{ '快速劣化' if (comparison.deterioration_rate | default(0)) > 0.1 else '正常' }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="footer">
            <p>本报告由点云磨损分析系统自动生成</p>
        </div>
    </div>
</body>
</html>
        """

    def _get_prediction_template(self) -> str:
        return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ report_title }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
            background: #f5f7fa;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #f5576c;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .prediction-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 10px 0;
            border-left: 4px solid #f5576c;
        }
        .life-indicator {
            text-align: center;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin: 20px 0;
        }
        .life-indicator .days {
            font-size: 48px;
            font-weight: bold;
        }
        .warning {
            background: #fff3cd;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ report_title }}</h1>
            <p>生成时间: {{ report_date }}</p>
        </div>
        <div class="content">
            <div class="section">
                <h2>寿命预测</h2>
                <div class="life-indicator">
                    <div class="days">{{ "%.0f"|format(prediction.remaining_life_days | default(0)) }}</div>
                    <div>预计剩余天数</div>
                </div>
            </div>
            <div class="section">
                <h2>预测信息</h2>
                <div class="prediction-card">
                    <p><strong>预测方法:</strong> {{ prediction.method | default('线性回归') }}</p>
                    <p><strong>历史数据点:</strong> {{ prediction.history_count | default(0) }}</p>
                    <p><strong>预测范围:</strong> {{ prediction.days_ahead | default(365) }}天</p>
                </div>
            </div>
            {% if (prediction.remaining_life_days | default(0)) < 180 %}
            <div class="warning">
                <strong>⚠ 警告:</strong> 预计剩余寿命不足6个月，建议尽快安排全面检查和维修。
            </div>
            {% endif %}
        </div>
        <div class="footer">
            <p>本报告由点云磨损分析系统自动生成</p>
        </div>
    </div>
</body>
</html>
        """
