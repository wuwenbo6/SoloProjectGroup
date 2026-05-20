import pandas as pd
import numpy as np
from datetime import datetime
import logging
import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.models import (
    get_db_session, init_db, MuseumCollection, MaterialData, 
    MaterialKnowledgeRule, ProtectionPlan, AnalysisReport
)

logger = logging.getLogger(__name__)

class MuseumDataIntegrator:
    def __init__(self):
        self.session = get_db_session()
    
    def __del__(self):
        if hasattr(self, 'session'):
            self.session.close()
    
    def import_museum_collection(self, df, source='manual'):
        imported_count = 0
        updated_count = 0
        error_count = 0
        
        for _, row in df.iterrows():
            try:
                artifact_id = str(row.get('artifact_id', '')).strip()
                if not artifact_id:
                    artifact_id = f"ART{datetime.now().strftime('%Y%m%d%H%M%S')}{imported_count:04d}"
                
                existing = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
                
                artifact_data = {
                    'artifact_name': str(row.get('artifact_name', '未知皮影')),
                    'origin_location': str(row.get('origin_location', '')) if pd.notna(row.get('origin_location')) else None,
                    'historical_period': str(row.get('historical_period', '')) if pd.notna(row.get('historical_period')) else None,
                    'estimated_year': int(row['estimated_year']) if pd.notna(row.get('estimated_year')) else None,
                    'material_type': str(row.get('material_type', '')) if pd.notna(row.get('material_type')) else None,
                    'material_origin': str(row.get('material_origin', '')) if pd.notna(row.get('material_origin')) else None,
                    'current_condition': str(row.get('current_condition', '')) if pd.notna(row.get('current_condition')) else None,
                    'storage_location': str(row.get('storage_location', '')) if pd.notna(row.get('storage_location')) else None,
                    'acquisition_method': str(row.get('acquisition_method', '')) if pd.notna(row.get('acquisition_method')) else None,
                    'notes': str(row.get('notes', '')) if pd.notna(row.get('notes')) else None
                }
                
                if existing:
                    for key, value in artifact_data.items():
                        setattr(existing, key, value)
                    updated_count += 1
                else:
                    artifact = MuseumCollection(artifact_id=artifact_id, **artifact_data)
                    self.session.add(artifact)
                    imported_count += 1
                
            except Exception as e:
                logger.error(f"导入藏品数据失败: {e}")
                error_count += 1
        
        self.session.commit()
        logger.info(f"博物馆藏品导入完成: 新增{imported_count}, 更新{updated_count}, 失败{error_count}")
        return {'imported': imported_count, 'updated': updated_count, 'errors': error_count}
    
    def auto_link_material_data(self, similarity_threshold=0.7):
        linked_count = 0
        
        artifacts = self.session.query(MuseumCollection).filter(
            MuseumCollection.material_type.isnot(None)
        ).all()
        
        for artifact in artifacts:
            if artifact.material_data:
                continue
            
            materials = self.session.query(MaterialData).all()
            
            best_match = None
            best_score = 0
            
            for material in materials:
                score = self._calculate_material_similarity(artifact, material)
                if score > best_score and score >= similarity_threshold:
                    best_score = score
                    best_match = material
            
            if best_match:
                best_match.museum_collection_id = artifact.id
                linked_count += 1
                logger.info(f"自动关联成功: 藏品 {artifact.artifact_name} -> 材质数据 ID {best_match.id} (相似度: {best_score:.2f})")
        
        self.session.commit()
        logger.info(f"材质数据自动关联完成: 成功关联 {linked_count} 条")
        return linked_count
    
    def _calculate_material_similarity(self, artifact, material):
        score = 0
        total_weights = 0
        
        if artifact.material_type and material.material_type:
            artifact_type = artifact.material_type.lower()
            material_type = material.material_type.lower()
            
            if artifact_type == material_type:
                score += 0.5
            elif artifact_type in material_type or material_type in artifact_type:
                score += 0.3
            total_weights += 0.5
        
        if artifact.origin_location and material.source:
            artifact_loc = artifact.origin_location.lower()
            material_src = material.source.lower()
            
            if artifact_loc == material_src:
                score += 0.3
            elif artifact_loc in material_src or material_src in artifact_loc:
                score += 0.15
            total_weights += 0.3
        
        if artifact.estimated_year and material.age_years:
            current_year = datetime.now().year
            artifact_age = current_year - artifact.estimated_year
            age_diff = abs(artifact_age - material.age_years)
            age_similarity = max(0, 1 - age_diff / 100)
            score += age_similarity * 0.2
            total_weights += 0.2
        
        return score / total_weights if total_weights > 0 else 0
    
    def get_unlinked_artifacts(self):
        artifacts = self.session.query(MuseumCollection).filter(
            ~MuseumCollection.material_data.any()
        ).all()
        return [{'id': a.id, 'artifact_id': a.artifact_id, 'artifact_name': a.artifact_name} for a in artifacts]
    
    def manual_link_material(self, artifact_id, material_id):
        artifact = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
        material = self.session.query(MaterialData).filter_by(id=material_id).first()
        
        if artifact and material:
            material.museum_collection_id = artifact.id
            self.session.commit()
            return True
        return False
    
    def get_museum_statistics(self):
        total_artifacts = self.session.query(MuseumCollection).count()
        linked_artifacts = self.session.query(MuseumCollection).filter(
            MuseumCollection.material_data.any()
        ).count()
        total_materials = self.session.query(MaterialData).count()
        
        material_types = self.session.query(
            MuseumCollection.material_type,
            MuseumCollection.id
        ).filter(MuseumCollection.material_type.isnot(None)).all()
        
        type_counts = {}
        for mt, _ in material_types:
            type_counts[mt] = type_counts.get(mt, 0) + 1
        
        return {
            'total_artifacts': total_artifacts,
            'linked_artifacts': linked_artifacts,
            'unlinked_artifacts': total_artifacts - linked_artifacts,
            'linkage_rate': linked_artifacts / total_artifacts if total_artifacts > 0 else 0,
            'total_material_data': total_materials,
            'material_type_distribution': type_counts
        }

class ProtectionPlanRecommender:
    def __init__(self):
        self.session = get_db_session()
        self._init_knowledge_rules()
    
    def __del__(self):
        if hasattr(self, 'session'):
            self.session.close()
    
    def _init_knowledge_rules(self):
        existing_rules = self.session.query(MaterialKnowledgeRule).count()
        if existing_rules > 0:
            return
        
        default_rules = [
            {'material_type': '牛皮', 'condition_type': 'thickness', 'condition_threshold': 0.5,
             'recommendation': '牛皮厚度低于0.5mm，建议进行加固处理，避免进一步磨损',
             'risk_level': 'high', 'priority': 1},
            {'material_type': '牛皮', 'condition_type': 'tensile_strength', 'condition_threshold': 15.0,
             'recommendation': '抗张强度低于15MPa，建议进行专业修复，避免物理损伤',
             'risk_level': 'high', 'priority': 1},
            {'material_type': '牛皮', 'condition_type': 'water_content', 'condition_threshold': 15.0,
             'recommendation': '含水率过高，建议控制环境湿度在50%-60%之间',
             'risk_level': 'medium', 'priority': 2},
            {'material_type': '驴皮', 'condition_type': 'collagen_ratio', 'condition_threshold': 70.0,
             'recommendation': '胶原蛋白含量较低，建议进行保湿处理，防止皮料脆化',
             'risk_level': 'medium', 'priority': 2},
            {'material_type': '羊皮', 'condition_type': 'thickness', 'condition_threshold': 0.3,
             'recommendation': '羊皮质地较薄，建议使用专用保护框，避免挤压',
             'risk_level': 'high', 'priority': 1},
            {'material_type': '鱼皮', 'condition_type': 'water_content', 'condition_threshold': 12.0,
             'recommendation': '鱼皮制品需严格控制湿度，建议使用干燥剂和密封保存',
             'risk_level': 'high', 'priority': 1},
            {'material_type': '猪皮', 'condition_type': 'tensile_strength', 'condition_threshold': 18.0,
             'recommendation': '猪皮抗张强度较低，建议避免悬挂展示，采用平放保存',
             'risk_level': 'medium', 'priority': 2},
            {'material_type': '马皮', 'condition_type': 'collagen_ratio', 'condition_threshold': 65.0,
             'recommendation': '马皮胶原蛋白流失严重，建议进行专业的胶原蛋白修复处理',
             'risk_level': 'high', 'priority': 1},
            {'material_type': '合成革', 'condition_type': 'age_years', 'condition_threshold': 50.0,
             'recommendation': '合成革材料老化较快，建议定期检查表面状态，及时进行表面翻新',
             'risk_level': 'medium', 'priority': 2},
        ]
        
        for rule_data in default_rules:
            rule = MaterialKnowledgeRule(**rule_data)
            self.session.add(rule)
        
        self.session.commit()
        logger.info(f"初始化了 {len(default_rules)} 条材质保护知识规则")
    
    def generate_protection_plan(self, material_id):
        material = self.session.query(MaterialData).filter_by(id=material_id).first()
        if not material:
            return None
        
        recommendations = []
        overall_risk = 'low'
        overall_priority = 3
        
        rules = self.session.query(MaterialKnowledgeRule).filter_by(
            material_type=material.material_type_standardized or material.material_type,
            is_active=True
        ).all()
        
        if not rules:
            rules = self.session.query(MaterialKnowledgeRule).filter_by(is_active=True).all()
        
        for rule in rules:
            condition_value = getattr(material, rule.condition_type, None)
            if condition_value is not None and condition_value < rule.condition_threshold:
                recommendations.append({
                    'condition_type': rule.condition_type,
                    'current_value': float(condition_value),
                    'threshold': rule.condition_threshold,
                    'recommendation': rule.recommendation,
                    'risk_level': rule.risk_level,
                    'priority': rule.priority
                })
                
                if rule.risk_level == 'high':
                    overall_risk = 'high'
                    overall_priority = min(overall_priority, 1)
                elif rule.risk_level == 'medium' and overall_risk != 'high':
                    overall_risk = 'medium'
                    overall_priority = min(overall_priority, 2)
        
        general_recommendations = self._get_general_recommendations(material)
        
        plan = {
            'material_id': material_id,
            'material_type': material.material_type_standardized or material.material_type,
            'overall_risk_level': overall_risk,
            'overall_priority': overall_priority,
            'specific_recommendations': recommendations,
            'general_recommendations': general_recommendations,
            'environmental_requirements': self._get_environmental_requirements(material, overall_risk),
            'monitoring_schedule': self._get_monitoring_schedule(overall_risk),
            'estimated_cost': self._estimate_cost(overall_risk, len(recommendations)),
            'estimated_duration_days': self._estimate_duration(len(recommendations))
        }
        
        return plan
    
    def _get_general_recommendations(self, material):
        general = [
            '定期进行表面清洁，使用软毛刷清除灰尘',
            '避免阳光直射，使用防紫外线展示柜',
            '控制温湿度变化，避免剧烈波动',
            '定期进行专业检查，建议每年至少一次'
        ]
        
        if material.age_years and material.age_years > 100:
            general.extend([
                '建议进行数字化存档，建立三维模型',
                '限制展示时间，采用轮换展示制度',
                '配备专用防震包装材料'
            ])
        
        return general
    
    def _get_environmental_requirements(self, material, risk_level):
        base_temp = {'min': 18, 'max': 22}
        base_humidity = {'min': 50, 'max': 60}
        
        if risk_level == 'high':
            base_temp = {'min': 19, 'max': 21}
            base_humidity = {'min': 53, 'max': 57}
        
        return {
            'temperature': base_temp,
            'relative_humidity': base_humidity,
            'light_intensity': {'max': 50, 'unit': 'lux'},
            'uv_level': {'max': 75, 'unit': 'μW/lm'},
            'pollutant_control': ['dust_filter', 'activated_carbon'],
            'pest_prevention': 'required' if risk_level in ['high', 'medium'] else 'recommended'
        }
    
    def _get_monitoring_schedule(self, risk_level):
        schedules = {
            'high': {
                'temperature_check': 'daily',
                'humidity_check': 'daily',
                'visual_inspection': 'weekly',
                'professional_assessment': 'quarterly',
                'scientific_testing': 'annually'
            },
            'medium': {
                'temperature_check': 'weekly',
                'humidity_check': 'weekly',
                'visual_inspection': 'monthly',
                'professional_assessment': 'semi-annually',
                'scientific_testing': 'biennially'
            },
            'low': {
                'temperature_check': 'monthly',
                'humidity_check': 'monthly',
                'visual_inspection': 'quarterly',
                'professional_assessment': 'annually',
                'scientific_testing': 'triennially'
            }
        }
        return schedules.get(risk_level, schedules['low'])
    
    def _estimate_cost(self, risk_level, num_issues):
        base_costs = {'high': 5000, 'medium': 2000, 'low': 500}
        return base_costs.get(risk_level, 1000) + num_issues * 500
    
    def _estimate_duration(self, num_issues):
        return 7 + num_issues * 3
    
    def save_protection_plan(self, artifact_id, plan_data):
        artifact = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
        if not artifact:
            return None
        
        plan = ProtectionPlan(
            artifact_id=artifact.id,
            material_id=plan_data.get('material_id'),
            plan_name=f"{artifact.artifact_name} 材质保护方案",
            plan_type='comprehensive',
            risk_level=plan_data['overall_risk_level'],
            priority='high' if plan_data['overall_priority'] == 1 else 'medium' if plan_data['overall_priority'] == 2 else 'low',
            recommended_actions=json.dumps(plan_data['specific_recommendations'] + plan_data['general_recommendations'], ensure_ascii=False),
            environmental_requirements=json.dumps(plan_data['environmental_requirements'], ensure_ascii=False),
            monitoring_schedule=json.dumps(plan_data['monitoring_schedule'], ensure_ascii=False),
            estimated_cost=plan_data['estimated_cost'],
            estimated_duration_days=plan_data['estimated_duration_days']
        )
        
        self.session.add(plan)
        self.session.commit()
        return plan.id
    
    def get_protection_plans(self, artifact_id=None):
        query = self.session.query(ProtectionPlan)
        if artifact_id:
            artifact = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
            if artifact:
                query = query.filter_by(artifact_id=artifact.id)
        return query.all()

class AnalysisReportGenerator:
    def __init__(self):
        self.session = get_db_session()
        self.output_dir = 'reports'
        os.makedirs(self.output_dir, exist_ok=True)
    
    def __del__(self):
        if hasattr(self, 'session'):
            self.session.close()
    
    def generate_material_analysis_report(self, artifact_id, analysis_results, format='html'):
        artifact = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
        if not artifact:
            return None
        
        report_data = {
            'report_title': f"{artifact.artifact_name} 材质分析报告",
            'artifact_info': {
                'artifact_id': artifact.artifact_id,
                'artifact_name': artifact.artifact_name,
                'origin_location': artifact.origin_location,
                'historical_period': artifact.historical_period,
                'estimated_year': artifact.estimated_year,
                'material_type': artifact.material_type,
                'current_condition': artifact.current_condition
            },
            'analysis_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'analysis_results': analysis_results,
            'key_findings': self._extract_key_findings(analysis_results),
            'recommendations': self._generate_recommendations(analysis_results),
            'version': '1.0'
        }
        
        if format.lower() == 'html':
            report_path = self._generate_html_report(report_data)
        elif format.lower() == 'json':
            report_path = self._generate_json_report(report_data)
        else:
            raise ValueError(f"不支持的报告格式: {format}")
        
        report_record = AnalysisReport(
            artifact_id=artifact.id,
            report_title=report_data['report_title'],
            report_type='material_analysis',
            report_format=format,
            report_path=report_path,
            summary=self._generate_summary(report_data),
            key_findings=json.dumps(report_data['key_findings'], ensure_ascii=False),
            recommendations=report_data['recommendations']
        )
        
        self.session.add(report_record)
        self.session.commit()
        
        return report_path
    
    def _extract_key_findings(self, analysis_results):
        findings = []
        
        if 'material_properties' in analysis_results:
            props = analysis_results['material_properties']
            for material_type, data in props.items():
                findings.append(f"{material_type}材质样本数: {data.get('count', 0)}")
        
        if 'aging_predictions' in analysis_results:
            aging = analysis_results['aging_predictions']
            if 'predicted_age' in aging:
                avg_age = np.mean(aging['predicted_age'])
                findings.append(f"预测平均老化年限: {avg_age:.1f}年")
        
        if 'similarity_search_examples' in analysis_results:
            findings.append("已完成相似材质检索，可用于保护方案参考")
        
        if 'detailed_aging_trajectory' in analysis_results:
            findings.append("已生成详细老化轨迹预测")
        
        return findings
    
    def _generate_recommendations(self, analysis_results):
        recommendations = [
            "建议根据材质特性制定个性化保护方案",
            "定期监测环境温湿度变化",
            "建立材质状态跟踪档案"
        ]
        
        if 'aging_predictions' in analysis_results:
            recommendations.append("根据老化预测结果，提前采取预防性保护措施")
        
        return "\n".join(recommendations)
    
    def _generate_summary(self, report_data):
        summary = f"{report_data['artifact_info']['artifact_name']}材质分析报告。"
        summary += f"共发现 {len(report_data['key_findings'])} 项关键发现。"
        return summary
    
    def _generate_html_report(self, report_data):
        artifact = report_data['artifact_info']
        recommendations_html = report_data['recommendations'].replace('\n', '<br>')
        findings_html = ''.join([f'<div class="finding-item">• {f}</div>' for f in report_data['key_findings']])
        
        html_content = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{report_data['report_title']}</title>
    <style>
        body {{ font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .report-container {{ max-width: 1000px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; border-bottom: 3px solid #e74c3c; padding-bottom: 20px; margin-bottom: 30px; }}
        .header h1 {{ color: #2c3e50; margin: 0; }}
        .info-section {{ background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .info-section h3 {{ color: #e74c3c; margin-top: 0; }}
        .info-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }}
        .info-item {{ display: flex; }}
        .info-label {{ font-weight: bold; color: #7f8c8d; min-width: 100px; }}
        .findings-section {{ margin-bottom: 20px; }}
        .findings-section h3 {{ color: #e74c3c; }}
        .finding-item {{ padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; margin: 10px 0; }}
        .recommendations-section {{ margin-bottom: 20px; }}
        .recommendations-section h3 {{ color: #e74c3c; }}
        .recommendation-item {{ padding: 15px; background: #d4edda; border-radius: 5px; margin: 10px 0; }}
        .footer {{ text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; }}
    </style>
</head>
<body>
    <div class="report-container">
        <div class="header">
            <h1>🎭 传统皮影戏材质分析系统</h1>
            <h2>{report_data['report_title']}</h2>
            <p>报告生成时间: {report_data['analysis_date']}</p>
            <p>报告版本: {report_data['version']}</p>
        </div>
        
        <div class="info-section">
            <h3>📋 藏品基本信息</h3>
            <div class="info-grid">
                <div class="info-item"><span class="info-label">藏品编号:</span> {artifact['artifact_id']}</div>
                <div class="info-item"><span class="info-label">藏品名称:</span> {artifact['artifact_name']}</div>
                <div class="info-item"><span class="info-label">产地来源:</span> {artifact['origin_location'] or '未知'}</div>
                <div class="info-item"><span class="info-label">历史时期:</span> {artifact['historical_period'] or '未知'}</div>
                <div class="info-item"><span class="info-label">预估年代:</span> {artifact['estimated_year'] or '未知'}年</div>
                <div class="info-item"><span class="info-label">材质类型:</span> {artifact['material_type'] or '未知'}</div>
                <div class="info-item"><span class="info-label">保存状态:</span> {artifact['current_condition'] or '未知'}</div>
            </div>
        </div>
        
        <div class="findings-section">
            <h3>🔍 关键发现</h3>
            {findings_html}
        </div>
        
        <div class="recommendations-section">
            <h3>💡 保护建议</h3>
            <div class="recommendation-item">{recommendations_html}</div>
        </div>
        
        <div class="footer">
            <p>传统皮影戏材质分析系统 - 自动生成报告</p>
            <p>本报告仅供参考，专业保护请咨询文物保护专家</p>
        </div>
    </div>
</body>
</html>
        """
        
        filename = f"report_{artifact['artifact_id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        logger.info(f"HTML报告已生成: {filepath}")
        return filepath
    
    def _generate_json_report(self, report_data):
        filename = f"report_{report_data['artifact_info']['artifact_id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"JSON报告已生成: {filepath}")
        return filepath
    
    def generate_batch_reports(self, artifact_ids, format='html'):
        results = []
        for artifact_id in artifact_ids:
            try:
                artifact = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
                if artifact and artifact.material_data:
                    analysis_results = self._get_analysis_data_for_artifact(artifact)
                    report_path = self.generate_material_analysis_report(artifact_id, analysis_results, format)
                    results.append({'artifact_id': artifact_id, 'status': 'success', 'report_path': report_path})
                else:
                    results.append({'artifact_id': artifact_id, 'status': 'skipped', 'reason': '无材质数据'})
            except Exception as e:
                logger.error(f"生成报告失败 {artifact_id}: {e}")
                results.append({'artifact_id': artifact_id, 'status': 'failed', 'error': str(e)})
        
        return results
    
    def _get_analysis_data_for_artifact(self, artifact):
        if not artifact.material_data:
            return {}
        
        material = artifact.material_data[0]
        
        return {
            'material_properties': {
                material.material_type: {
                    'count': 1,
                    'properties': {
                        'thickness': {'mean': material.thickness},
                        'tensile_strength': {'mean': material.tensile_strength},
                        'water_content': {'mean': material.water_content},
                        'collagen_ratio': {'mean': material.collagen_ratio}
                    }
                }
            }
        }
    
    def get_report_history(self, artifact_id=None):
        query = self.session.query(AnalysisReport)
        if artifact_id:
            artifact = self.session.query(MuseumCollection).filter_by(artifact_id=artifact_id).first()
            if artifact:
                query = query.filter_by(artifact_id=artifact.id)
        return query.order_by(AnalysisReport.generated_at.desc()).all()


def init_museum_demo_data():
    session = get_db_session()
    
    demo_artifacts = [
        {'artifact_id': 'SHADOW001', 'artifact_name': '陕西皮影-关公', 'origin_location': '陕西西安',
         'historical_period': '清代', 'estimated_year': 1880, 'material_type': '牛皮',
         'current_condition': '良好', 'storage_location': 'A馆-01柜'},
        {'artifact_id': 'SHADOW002', 'artifact_name': '唐山皮影-孙悟空', 'origin_location': '河北唐山',
         'historical_period': '民国', 'estimated_year': 1930, 'material_type': '驴皮',
         'current_condition': '一般', 'storage_location': 'A馆-02柜'},
        {'artifact_id': 'SHADOW003', 'artifact_name': '山西皮影-穆桂英', 'origin_location': '山西平遥',
         'historical_period': '清代', 'estimated_year': 1850, 'material_type': '羊皮',
         'current_condition': '较差', 'storage_location': 'B馆-01柜'},
        {'artifact_id': 'SHADOW004', 'artifact_name': '湖北皮影-诸葛亮', 'origin_location': '湖北孝感',
         'historical_period': '现代', 'estimated_year': 1980, 'material_type': '牛皮',
         'current_condition': '优秀', 'storage_location': 'C馆-01柜'},
        {'artifact_id': 'SHADOW005', 'artifact_name': '四川皮影-张飞', 'origin_location': '四川成都',
         'historical_period': '清代', 'estimated_year': 1890, 'material_type': '马皮',
         'current_condition': '一般', 'storage_location': 'B馆-02柜'},
    ]
    
    imported = 0
    for data in demo_artifacts:
        existing = session.query(MuseumCollection).filter_by(artifact_id=data['artifact_id']).first()
        if not existing:
            artifact = MuseumCollection(**data)
            session.add(artifact)
            imported += 1
    
    session.commit()
    logger.info(f"初始化博物馆演示数据完成: 导入 {imported} 件藏品")
    return imported


if __name__ == '__main__':
    init_db()
    init_museum_demo_data()
