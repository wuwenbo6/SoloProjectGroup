import os
import io
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Optional
import numpy as np
import pandas as pd

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics import renderPDF

from config import Config
from database import db_manager
from trend_prediction import trend_predictor
from fault_classifier import fault_classifier

logger = logging.getLogger(__name__)

class MaintenanceReportGenerator:
    def __init__(self):
        self.reports_dir = os.path.join(Config.MODEL_DIR, 'reports')
        os.makedirs(self.reports_dir, exist_ok=True)
        
        self.styles = getSampleStyleSheet()
        self._setup_styles()
    
    def _setup_styles(self):
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=18,
            spaceAfter=12,
            textColor=colors.HexColor('#1a5276'),
            alignment=1
        )
        
        self.heading2_style = ParagraphStyle(
            'CustomHeading2',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceAfter=8,
            textColor=colors.HexColor('#2c3e50')
        )
        
        self.heading3_style = ParagraphStyle(
            'CustomHeading3',
            parent=self.styles['Heading3'],
            fontSize=12,
            spaceAfter=6,
            textColor=colors.HexColor('#34495e')
        )
        
        self.normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leading=14
        )
        
        self.bold_style = ParagraphStyle(
            'CustomBold',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leading=14,
            fontName='Helvetica-Bold'
        )
        
        self.warning_style = ParagraphStyle(
            'Warning',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            leading=14,
            textColor=colors.red,
            fontName='Helvetica-Bold'
        )
    
    def _draw_header(self, canvas, doc):
        canvas.saveState()
        
        header_color = colors.HexColor('#1a5276')
        canvas.setFillColor(header_color)
        canvas.rect(0, A4[1] - 2*cm, A4[0], 2*cm, fill=1, stroke=0)
        
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 14)
        canvas.drawString(2*cm, A4[1] - 1.3*cm, '设备状态监测与运维系统')
        
        canvas.setFont('Helvetica', 10)
        canvas.drawString(2*cm, A4[1] - 1.8*cm, 'Equipment Condition Monitoring & Maintenance System')
        
        canvas.restoreState()
    
    def _draw_footer(self, canvas, doc):
        canvas.saveState()
        
        footer_color = colors.HexColor('#ecf0f1')
        canvas.setFillColor(footer_color)
        canvas.rect(0, 0, A4[0], 1.5*cm, fill=1, stroke=0)
        
        canvas.setFillColor(colors.HexColor('#7f8c8d'))
        canvas.setFont('Helvetica', 8)
        canvas.drawString(2*cm, 0.8*cm, f'生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        canvas.drawRightString(A4[0] - 2*cm, 0.8*cm, f'第 {doc.page} 页')
        
        canvas.restoreState()
    
    def _create_trend_chart(self, data: List[Dict], width: int = 400, height: int = 200) -> Drawing:
        drawing = Drawing(width, height)
        
        vibrations = [d.get('vibration', 0) for d in data[-100:]]
        times = list(range(len(vibrations)))
        
        lp = LinePlot()
        lp.x = 50
        lp.y = 30
        lp.width = width - 70
        lp.height = height - 50
        lp.data = [list(zip(times, vibrations))]
        lp.lines[0].strokeColor = colors.HexColor('#3498db')
        lp.lines[0].strokeWidth = 1.5
        
        drawing.add(lp)
        
        drawing.add(String(width // 2, 10, '时间 (采样点)', fontSize=8, fillColor=colors.gray))
        drawing.add(String(10, height // 2, '振动', fontSize=8, fillColor=colors.gray))
        
        return drawing
    
    def _create_pie_chart(self, fault_data: Dict, width: int = 250, height: int = 200) -> Drawing:
        drawing = Drawing(width, height)
        
        pc = Pie()
        pc.x = width // 2 - 60
        pc.y = 30
        pc.width = 120
        pc.height = 120
        
        probs = fault_data.get('all_probabilities', {})
        labels = list(probs.keys())[:5]
        values = [float(probs.get(l, 0)) * 100 for l in labels]
        
        if sum(values) == 0:
            values = [100]
            labels = ['无数据']
        
        pc.data = values
        pc.labels = labels
        
        color_palette = [
            colors.HexColor('#2ecc71'),
            colors.HexColor('#e74c3c'),
            colors.HexColor('#f39c12'),
            colors.HexColor('#3498db'),
            colors.HexColor('#9b59b6')
        ]
        
        for i, color in enumerate(color_palette[:len(values)]):
            pc.slices[i].fillColor = color
        
        drawing.add(pc)
        drawing.add(String(width // 2, 10, '故障类型分布 (%)', fontSize=9, textAnchor='middle'))
        
        return drawing
    
    def generate_report(self, sensor_id: str, report_type: str = 'daily') -> Dict:
        try:
            end_time = datetime.utcnow()
            if report_type == 'daily':
                start_time = end_time - timedelta(days=1)
                period_text = '24小时'
            elif report_type == 'weekly':
                start_time = end_time - timedelta(days=7)
                period_text = '7天'
            else:
                start_time = end_time - timedelta(hours=1)
                period_text = '1小时'
            
            sensor_data = db_manager.query_sensor_data(sensor_id, start_time, end_time)
            anomaly_events = db_manager.query_anomaly_events(sensor_id, start_time, end_time)
            
            try:
                trend_result = trend_predictor.predict(sensor_id, minutes=5)
            except Exception as e:
                logger.warning(f"Trend prediction failed: {e}")
                trend_result = None
            
            try:
                fault_result = fault_classifier.classify(sensor_id, duration_minutes=5)
            except Exception as e:
                logger.warning(f"Fault classification failed: {e}")
                fault_result = None
            
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=2*cm,
                leftMargin=2*cm,
                topMargin=3*cm,
                bottomMargin=2*cm
            )
            
            story = []
            
            story.append(Paragraph(f'设备运维报告 - {sensor_id}', self.title_style))
            story.append(Spacer(1, 0.5*cm))
            
            report_info = [
                ['报告类型', f'{period_text}运维报告'],
                ['传感器ID', sensor_id],
                ['报告生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')],
                ['统计周期', f'{start_time.strftime("%Y-%m-%d %H:%M:%S")} ~ {end_time.strftime("%Y-%m-%d %H:%M:%S")}']
            ]
            
            info_table = Table(report_info, colWidths=[4*cm, 10*cm])
            info_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.gray)
            ]))
            story.append(info_table)
            story.append(Spacer(1, 0.5*cm))
            
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#bdc3c7')))
            story.append(Spacer(1, 0.3*cm))
            
            story.append(Paragraph('一、设备运行状态摘要', self.heading2_style))
            story.append(Spacer(1, 0.3*cm))
            
            if len(sensor_data) > 0:
                df = pd.DataFrame(sensor_data)
                status_summary = [
                    ['指标', '当前值', '平均值', '最大值', '最小值', '状态'],
                    ['振动 (mm/s)', 
                     f"{df['vibration'].iloc[-1]:.2f}",
                     f"{df['vibration'].mean():.2f}",
                     f"{df['vibration'].max():.2f}",
                     f"{df['vibration'].min():.2f}",
                     '正常' if df['vibration'].mean() < 2.5 else '异常'],
                    ['摆度 (μm)', 
                     f"{df['swing'].iloc[-1]:.2f}",
                     f"{df['swing'].mean():.2f}",
                     f"{df['swing'].max():.2f}",
                     f"{df['swing'].min():.2f}",
                     '正常' if df['swing'].mean() < 0.5 else '异常'],
                    ['温度 (°C)', 
                     f"{df['temperature'].iloc[-1]:.1f}",
                     f"{df['temperature'].mean():.1f}",
                     f"{df['temperature'].max():.1f}",
                     f"{df['temperature'].min():.1f}",
                     '正常' if df['temperature'].mean() < 40 else '异常']
                ]
                
                status_table = Table(status_summary, colWidths=[3*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2.5*cm])
                status_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a5276')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
                ]))
                story.append(status_table)
            else:
                story.append(Paragraph('无数据可用', self.warning_style))
            
            story.append(Spacer(1, 0.5*cm))
            
            story.append(Paragraph('二、振动趋势分析', self.heading2_style))
            story.append(Spacer(1, 0.3*cm))
            
            if len(sensor_data) > 0:
                trend_chart = self._create_trend_chart(sensor_data)
                story.append(trend_chart)
            else:
                story.append(Paragraph('无趋势数据可用', self.warning_style))
            
            story.append(Spacer(1, 0.3*cm))
            
            if trend_result:
                trend_info = trend_result['trend_analysis']
                story.append(Paragraph('未来5分钟趋势预测:', self.heading3_style))
                
                trend_table_data = [
                    ['趋势方向', '预测均值', '预测最大值', '异常风险'],
                    [
                        {'stable': '稳定', 'rising': '上升', 'falling': '下降'}.get(trend_info['direction'], '未知'),
                        f"{trend_info['mean_value']:.2f} mm/s",
                        f"{trend_info['max_value']:.2f} mm/s",
                        trend_info['anomaly_risk']
                    ]
                ]
                
                trend_table = Table(trend_table_data, colWidths=[3*cm, 3*cm, 3*cm, 3*cm])
                trend_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d5dbdb')),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
                ]))
                story.append(trend_table)
            
            story.append(PageBreak())
            
            story.append(Paragraph('三、故障诊断与分析', self.heading2_style))
            story.append(Spacer(1, 0.3*cm))
            
            if fault_result:
                primary_fault = fault_result['primary_fault']
                
                if primary_fault['type'] != 'normal':
                    story.append(Paragraph(f'<font color="red">⚠️ 检测到潜在故障: {primary_fault["name"]}</font>', self.warning_style))
                else:
                    story.append(Paragraph('✅ 设备运行正常，未检测到故障', self.bold_style))
                
                story.append(Spacer(1, 0.3*cm))
                
                fault_details = [
                    ['故障类型', primary_fault['name']],
                    ['置信度', f"{primary_fault['confidence']:.1%}"],
                    ['严重程度', primary_fault['severity']],
                    ['描述', primary_fault['description']]
                ]
                
                fault_table = Table(fault_details, colWidths=[3*cm, 11*cm])
                fault_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
                    ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
                ]))
                story.append(fault_table)
                
                story.append(Spacer(1, 0.3*cm))
                story.append(Paragraph('故障概率分布:', self.heading3_style))
                
                pie_chart = self._create_pie_chart(fault_result)
                story.append(pie_chart)
            else:
                story.append(Paragraph('故障诊断数据不可用', self.warning_style))
            
            story.append(Spacer(1, 0.5*cm))
            
            story.append(Paragraph('四、异常事件记录', self.heading2_style))
            story.append(Spacer(1, 0.3*cm))
            
            if anomaly_events:
                anomaly_table_data = [['时间', '异常评分', '描述']]
                for event in anomaly_events[:10]:
                    anomaly_table_data.append([
                        str(event.get('time', ''))[:19],
                        f"{event.get('anomaly_score', 0):.2f}",
                        event.get('description', '')[:50]
                    ])
                
                anomaly_table = Table(anomaly_table_data, colWidths=[4*cm, 2.5*cm, 7.5*cm])
                anomaly_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e74c3c')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
                    ('TOPPADDING', (0, 0), (-1, -1), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
                ]))
                story.append(anomaly_table)
            else:
                story.append(Paragraph('✅ 报告周期内无异常事件记录', self.bold_style))
            
            story.append(PageBreak())
            
            story.append(Paragraph('五、维护建议', self.heading2_style))
            story.append(Spacer(1, 0.3*cm))
            
            recommendations = []
            
            if fault_result and fault_result.get('recommendations'):
                recommendations.extend(fault_result['recommendations'])
            
            if len(anomaly_events) > 0:
                recommendations.append('建议对设备进行全面检查，分析异常原因')
            
            if trend_result and trend_result['trend_analysis']['anomaly_risk'] in ['medium', 'high']:
                recommendations.append('趋势预测显示存在异常风险，建议加强监控频率')
            
            if not recommendations:
                recommendations = [
                    '设备运行状态良好，建议继续正常监控',
                    '按计划进行日常维护保养',
                    '定期检查传感器连接和校准状态'
                ]
            
            for i, rec in enumerate(recommendations, 1):
                story.append(Paragraph(f'{i}. {rec}', self.normal_style))
            
            story.append(Spacer(1, 0.5*cm))
            
            story.append(Paragraph('六、总结', self.heading2_style))
            story.append(Spacer(1, 0.3*cm))
            
            overall_status = '正常'
            if len(anomaly_events) > 0 or (fault_result and fault_result['fault_detected']):
                overall_status = '需要关注'
            
            summary_text = f"""
            本报告对传感器 {sensor_id} 在过去{period_text}的运行数据进行了综合分析。
            主要发现包括：
            <br/><br/>
            - 数据样本量: {len(sensor_data)} 条记录
            <br/>
            - 异常事件数: {len(anomaly_events)} 次
            <br/>
            - 整体运行状态: <b>{overall_status}</b>
            <br/>
            - 未来趋势风险: {trend_result['trend_analysis']['anomaly_risk'] if trend_result else '未知'}
            """
            
            story.append(Paragraph(summary_text, self.normal_style))
            
            doc.build(story, onFirstPage=self._draw_header, onLaterPages=self._draw_footer)
            
            buffer.seek(0)
            pdf_content = buffer.getvalue()
            
            filename = f"maintenance_report_{sensor_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            filepath = os.path.join(self.reports_dir, filename)
            
            with open(filepath, 'wb') as f:
                f.write(pdf_content)
            
            logger.info(f"Report generated successfully: {filepath}")
            
            return {
                'success': True,
                'filename': filename,
                'filepath': filepath,
                'sensor_id': sensor_id,
                'report_type': report_type,
                'generated_at': datetime.now().isoformat(),
                'summary': {
                    'data_points': len(sensor_data),
                    'anomaly_count': len(anomaly_events),
                    'overall_status': overall_status,
                    'fault_detected': fault_result['fault_detected'] if fault_result else False
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to generate report: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def list_reports(self) -> List[Dict]:
        reports = []
        if os.path.exists(self.reports_dir):
            for filename in sorted(os.listdir(self.reports_dir), reverse=True):
                if filename.endswith('.pdf'):
                    filepath = os.path.join(self.reports_dir, filename)
                    stat = os.stat(filepath)
                    reports.append({
                        'filename': filename,
                        'filepath': filepath,
                        'created_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'size_kb': stat.st_size // 1024
                    })
        return reports[:50]

report_generator = MaintenanceReportGenerator()
