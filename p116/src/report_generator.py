import os
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        Image, PageBreak
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError as e:
    print(f"ReportLab 导入警告: {e}")
    REPORTLAB_AVAILABLE = False

try:
    import matplotlib.pyplot as plt
    import matplotlib
    matplotlib.use('Agg')
    MATPLOTLIB_AVAILABLE = True
except ImportError as e:
    print(f"Matplotlib 导入警告: {e}")
    MATPLOTLIB_AVAILABLE = False


class ReportGenerator:
    """报表生成类 - 改进版本，避免空白报表"""
    
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def generate_full_report(self,
                             point_cloud_stats: Dict,
                             defect_summary: Dict,
                             thickness_summary: Dict,
                             safety_report: Dict,
                             base_filename: Optional[str] = None) -> Dict[str, str]:
        """
        生成完整报告
        
        Args:
            point_cloud_stats: 点云统计信息
            defect_summary: 缺损检测摘要
            thickness_summary: 厚度分析摘要
            safety_report: 安全评估报告
            base_filename: 基础文件名（不含扩展名）
            
        Returns:
            生成的文件路径字典
        """
        if base_filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            base_filename = f"point_cloud_analysis_report_{timestamp}"
        
        print(f"\n开始生成报告: {base_filename}")
        
        pc_stats_clean = self._ensure_dict_valid(point_cloud_stats)
        defect_clean = self._ensure_dict_valid(defect_summary)
        thickness_clean = self._ensure_dict_valid(thickness_summary)
        safety_clean = self._ensure_dict_valid(safety_report)
        
        print(f"  点云统计: {len(pc_stats_clean)} 项")
        print(f"  缺损摘要: {defect_clean.get('total_defects', 0)} 个缺损")
        print(f"  厚度统计: {len(thickness_clean)} 项")
        print(f"  安全报告: {len(safety_clean)} 项")
        
        result_files = {}
        
        try:
            excel_path = self.generate_excel_report(
                pc_stats_clean, defect_clean, thickness_clean, safety_clean,
                f"{base_filename}.xlsx"
            )
            result_files['excel'] = excel_path
            print(f"  Excel报告已生成: {excel_path}")
        except Exception as e:
            print(f"  Excel报告生成失败: {e}")
        
        if REPORTLAB_AVAILABLE and MATPLOTLIB_AVAILABLE:
            try:
                pdf_path = self.generate_pdf_report(
                    pc_stats_clean, defect_clean, thickness_clean, safety_clean,
                    f"{base_filename}.pdf"
                )
                result_files['pdf'] = pdf_path
                print(f"  PDF报告已生成: {pdf_path}")
            except Exception as e:
                print(f"  PDF报告生成失败: {e}")
        else:
            print("  跳过PDF报告生成 (缺少 ReportLab 或 Matplotlib)")
        
        try:
            json_path = self.generate_json_report(
                pc_stats_clean, defect_clean, thickness_clean, safety_clean,
                f"{base_filename}.json"
            )
            result_files['json'] = json_path
            print(f"  JSON报告已生成: {json_path}")
        except Exception as e:
            print(f"  JSON报告生成失败: {e}")
        
        return result_files
    
    def _ensure_dict_valid(self, data: Dict) -> Dict:
        """确保字典数据有效，避免空值"""
        if data is None:
            return {}
        return {k: v for k, v in data.items() if v is not None}
    
    def generate_excel_report(self,
                               point_cloud_stats: Dict,
                               defect_summary: Dict,
                               thickness_summary: Dict,
                               safety_report: Dict,
                               filename: str) -> str:
        """生成Excel格式报告"""
        output_path = self.output_dir / filename
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            self._write_overview_sheet(writer, point_cloud_stats, safety_report)
            self._write_defect_sheet(writer, defect_summary)
            self._write_thickness_sheet(writer, thickness_summary)
            self._write_safety_sheet(writer, safety_report)
            self._write_recommendations_sheet(writer, safety_report)
            
        return str(output_path)
    
    def _write_overview_sheet(self, writer, point_cloud_stats: Dict, safety_report: Dict):
        """写入概览工作表"""
        overview_data = []
        
        overview_data.append(['点云分析报告概览', ''])
        overview_data.append(['生成时间', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        overview_data.append(['', ''])
        
        overview_data.append(['点云信息', ''])
        overview_data.append(['文件路径', str(point_cloud_stats.get('file_path', 'N/A'))])
        overview_data.append(['点数', str(point_cloud_stats.get('num_points', 0))])
        overview_data.append(['中心点坐标', str(point_cloud_stats.get('center', [0, 0, 0]))])
        overview_data.append(['包围盒尺寸', str(point_cloud_stats.get('extent', [0, 0, 0]))])
        overview_data.append(['包含颜色', '是' if point_cloud_stats.get('has_colors', False) else '否'])
        overview_data.append(['包含法向量', '是' if point_cloud_stats.get('has_normals', False) else '否'])
        overview_data.append(['', ''])
        
        overview_data.append(['安全评估摘要', ''])
        overview_data.append(['报告ID', str(safety_report.get('report_id', 'N/A'))])
        overview_data.append(['总体安全等级', str(safety_report.get('overall_safety_level', 'N/A'))])
        overview_data.append(['总体评分', f"{float(safety_report.get('overall_score', 0)):.1f}"])
        
        df = pd.DataFrame(overview_data, columns=['项目', '值'])
        df.to_excel(writer, sheet_name='概览', index=False)
    
    def _write_defect_sheet(self, writer, defect_summary: Dict):
        """写入缺损检测工作表"""
        summary_data = [
            ['缺损检测摘要', ''],
            ['缺损总数', str(defect_summary.get('total_defects', 0))],
            ['缺损总面积', f"{float(defect_summary.get('total_defect_area', 0)):.4f}"],
            ['', '']
        ]
        
        severity_dist = defect_summary.get('severity_distribution', {})
        if severity_dist:
            summary_data.append(['严重程度分布', ''])
            for severity, count in severity_dist.items():
                summary_data.append([str(severity), str(count)])
        
        df_summary = pd.DataFrame(summary_data, columns=['项目', '值'])
        df_summary.to_excel(writer, sheet_name='缺损检测', index=False, startrow=0)
        
        defects = defect_summary.get('defects', [])
        if defects:
            defect_data = []
            for defect in defects:
                defect_data.append([
                    int(defect.get('id', 0)),
                    str(defect.get('type', 'N/A')),
                    str(defect.get('severity', 'N/A')),
                    f"{float(defect.get('area', 0)):.4f}",
                    f"{float(defect.get('depth', 0)):.4f}",
                    f"{float(defect.get('confidence', 0)):.2f}",
                    str(defect.get('center', [0, 0, 0]))
                ])
            
            df_defects = pd.DataFrame(
                defect_data,
                columns=['ID', '类型', '严重程度', '面积', '深度', '置信度', '中心坐标']
            )
            start_row = len(summary_data) + 2
            df_defects.to_excel(writer, sheet_name='缺损检测', index=False, startrow=start_row)
    
    def _write_thickness_sheet(self, writer, thickness_summary: Dict):
        """写入厚度分析工作表"""
        if not thickness_summary:
            empty_data = [
                ['厚度分析', ''],
                ['状态', '无厚度数据']
            ]
            pd.DataFrame(empty_data).to_excel(writer, sheet_name='厚度分析', index=False)
            return
            
        stats_data = [
            ['厚度统计摘要', ''],
            ['平均值', f"{float(thickness_summary.get('mean', 0)):.4f}"],
            ['中位数', f"{float(thickness_summary.get('median', 0)):.4f}"],
            ['最小值', f"{float(thickness_summary.get('min', 0)):.4f}"],
            ['最大值', f"{float(thickness_summary.get('max', 0)):.4f}"],
            ['标准差', f"{float(thickness_summary.get('std', 0)):.4f}"],
            ['25%分位数', f"{float(thickness_summary.get('percentile_25', 0)):.4f}"],
            ['75%分位数', f"{float(thickness_summary.get('percentile_75', 0)):.4f}"],
            ['有效点数', str(thickness_summary.get('valid_points', 0))],
            ['总点数', str(thickness_summary.get('total_points', 0))]
        ]
        
        df = pd.DataFrame(stats_data, columns=['项目', '值'])
        df.to_excel(writer, sheet_name='厚度分析', index=False)
    
    def _write_safety_sheet(self, writer, safety_report: Dict):
        """写入安全评估工作表"""
        criteria = safety_report.get('criteria', [])
        if criteria:
            criteria_data = []
            for c in criteria:
                criteria_data.append([
                    str(c.get('name', 'N/A')),
                    f"{float(c.get('weight', 0)):.1f}",
                    f"{float(c.get('actual_value', 0)):.4f}",
                    f"{float(c.get('score', 0)):.1f}",
                    str(c.get('status', 'N/A'))
                ])
            
            df = pd.DataFrame(
                criteria_data,
                columns=['评估标准', '权重', '实际值', '得分', '状态']
            )
            df.to_excel(writer, sheet_name='安全评估', index=False)
    
    def _write_recommendations_sheet(self, writer, safety_report: Dict):
        """写入建议工作表"""
        recommendations = safety_report.get('recommendations', [])
        if recommendations:
            rec_data = []
            for r in recommendations:
                rec_data.append([
                    str(r.get('priority', 'N/A')),
                    str(r.get('category', 'N/A')),
                    str(r.get('message', 'N/A')),
                    str(r.get('action_required', 'N/A'))
                ])
            
            df = pd.DataFrame(
                rec_data,
                columns=['优先级', '类别', '描述', '建议行动']
            )
            df.to_excel(writer, sheet_name='安全建议', index=False)
    
    def generate_pdf_report(self,
                             point_cloud_stats: Dict,
                             defect_summary: Dict,
                             thickness_summary: Dict,
                             safety_report: Dict,
                             filename: str) -> str:
        """生成PDF格式报告"""
        if not REPORTLAB_AVAILABLE:
            raise ImportError("需要安装 reportlab 库才能生成PDF报告")
            
        output_path = self.output_dir / filename
        
        doc = SimpleDocTemplate(
            str(output_path),
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#2c3e50')
        )
        
        heading2_style = ParagraphStyle(
            'CustomHeading2',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=12,
            spaceBefore=20,
            textColor=colors.HexColor('#34495e')
        )
        
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['Normal'],
            fontSize=11,
            spaceAfter=6,
            leading=14
        )
        
        story.append(Paragraph("点云分析报告", title_style))
        story.append(Paragraph(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                              ParagraphStyle('CenterText', parent=normal_style, alignment=TA_CENTER)))
        story.append(Spacer(1, 10*mm))
        
        story.append(Paragraph("一、点云基本信息", heading2_style))
        story = self._add_point_cloud_info(story, point_cloud_stats, normal_style)
        
        story.append(Paragraph("二、安全评估概览", heading2_style))
        story = self._add_safety_overview(story, safety_report, normal_style)
        
        story.append(PageBreak())
        
        story.append(Paragraph("三、缺损检测结果", heading2_style))
        story = self._add_defect_info(story, defect_summary, normal_style)
        
        if thickness_summary and thickness_summary.get('valid_points', 0) > 0:
            story.append(Paragraph("四、厚度分析结果", heading2_style))
            story = self._add_thickness_info(story, thickness_summary, normal_style)
            
            try:
                chart_path = self._generate_thickness_chart(thickness_summary)
                if chart_path and os.path.exists(chart_path):
                    img = Image(chart_path, width=140*mm, height=90*mm)
                    story.append(img)
                    story.append(Spacer(1, 5*mm))
                    try:
                        os.remove(chart_path)
                    except:
                        pass
            except Exception as e:
                print(f"  厚度图表生成跳过: {e}")
        
        story.append(PageBreak())
        
        story.append(Paragraph("五、安全评估详情", heading2_style))
        story = self._add_safety_details(story, safety_report, normal_style)
        
        story.append(Paragraph("六、安全建议", heading2_style))
        story = self._add_recommendations(story, safety_report, normal_style)
        
        doc.build(story)
        
        return str(output_path)
    
    def _add_point_cloud_info(self, story, stats: Dict, style) -> list:
        """添加点云信息到PDF"""
        info_data = [
            ['文件路径', str(stats.get('file_path', 'N/A'))],
            ['点数', str(stats.get('num_points', 0))],
            ['包含颜色', '是' if stats.get('has_colors', False) else '否'],
            ['包含法向量', '是' if stats.get('has_normals', False) else '否'],
            ['中心点坐标', str(stats.get('center', [0, 0, 0]))],
            ['包围盒尺寸', str(stats.get('extent', [0, 0, 0]))]
        ]
        
        table = Table(info_data, colWidths=[40*mm, 110*mm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bdc3c7'))
        ]))
        story.append(table)
        story.append(Spacer(1, 5*mm))
        return story
    
    def _add_safety_overview(self, story, safety_report: Dict, style) -> list:
        """添加安全评估概览到PDF"""
        level = str(safety_report.get('overall_safety_level', 'unknown')).lower()
        score = float(safety_report.get('overall_score', 0))
        
        level_colors = {
            'safe': colors.HexColor('#27ae60'),
            'caution': colors.HexColor('#f39c12'),
            'warning': colors.HexColor('#e67e22'),
            'critical': colors.HexColor('#e74c3c'),
            'dangerous': colors.HexColor('#c0392b')
        }
        
        level_names = {
            'safe': '安全',
            'caution': '注意',
            'warning': '警告',
            'critical': '严重',
            'dangerous': '危险'
        }
        
        bg_color = level_colors.get(level, colors.grey)
        level_name = level_names.get(level, level)
        
        info_data = [
            ['报告ID', str(safety_report.get('report_id', 'N/A'))],
            ['总体安全等级', level_name],
            ['总体评分', f"{score:.1f} / 100"]
        ]
        
        table = Table(info_data, colWidths=[40*mm, 110*mm])
        
        style_commands = [
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('BACKGROUND', (1, 1), (1, 1), bg_color),
            ('TEXTCOLOR', (1, 1), (1, 1), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bdc3c7'))
        ]
        
        table.setStyle(TableStyle(style_commands))
        story.append(table)
        story.append(Spacer(1, 5*mm))
        return story
    
    def _add_defect_info(self, story, defect_summary: Dict, style) -> list:
        """添加缺损信息到PDF"""
        total_defects = int(defect_summary.get('total_defects', 0))
        total_area = float(defect_summary.get('total_defect_area', 0))
        
        story.append(Paragraph(f"缺损总数: {total_defects} 个", style))
        story.append(Paragraph(f"缺损总面积: {total_area:.4f}", style))
        story.append(Spacer(1, 3*mm))
        
        defects = defect_summary.get('defects', [])
        if defects:
            table_data = [['ID', '类型', '严重程度', '面积', '深度', '置信度']]
            
            severity_colors = {
                'critical': colors.HexColor('#e74c3c'),
                'high': colors.HexColor('#e67e22'),
                'medium': colors.HexColor('#f39c12'),
                'low': colors.HexColor('#27ae60')
            }
            
            for defect in defects:
                severity = str(defect.get('severity', '')).lower()
                table_data.append([
                    str(defect.get('id', 0)),
                    str(defect.get('type', 'N/A')),
                    str(defect.get('severity', 'N/A')),
                    f"{float(defect.get('area', 0)):.4f}",
                    f"{float(defect.get('depth', 0)):.4f}",
                    f"{float(defect.get('confidence', 0)):.2f}"
                ])
            
            table = Table(table_data, colWidths=[15*mm, 30*mm, 25*mm, 25*mm, 25*mm, 30*mm])
            
            style_commands = [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bdc3c7'))
            ]
            
            for i, defect in enumerate(defects, 1):
                severity = str(defect.get('severity', '')).lower()
                bg_color = severity_colors.get(severity, colors.white)
                style_commands.append(('BACKGROUND', (2, i), (2, i), bg_color))
                style_commands.append(('TEXTCOLOR', (2, i), (2, i), colors.white))
            
            table.setStyle(TableStyle(style_commands))
            story.append(table)
        
        story.append(Spacer(1, 5*mm))
        return story
    
    def _add_thickness_info(self, story, thickness_summary: Dict, style) -> list:
        """添加厚度信息到PDF"""
        info_data = [
            ['平均值', f"{float(thickness_summary.get('mean', 0)):.4f}"],
            ['中位数', f"{float(thickness_summary.get('median', 0)):.4f}"],
            ['最小值', f"{float(thickness_summary.get('min', 0)):.4f}"],
            ['最大值', f"{float(thickness_summary.get('max', 0)):.4f}"],
            ['标准差', f"{float(thickness_summary.get('std', 0)):.4f}"],
            ['有效点数', str(thickness_summary.get('valid_points', 0))]
        ]
        
        table = Table(info_data, colWidths=[40*mm, 110*mm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#ecf0f1')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bdc3c7'))
        ]))
        story.append(table)
        story.append(Spacer(1, 5*mm))
        return story
    
    def _add_safety_details(self, story, safety_report: Dict, style) -> list:
        """添加安全评估详情到PDF"""
        criteria = safety_report.get('criteria', [])
        if not criteria:
            story.append(Paragraph("暂无安全评估标准数据", style))
            return story
            
        table_data = [['评估标准', '权重', '实际值', '得分', '状态']]
        
        status_colors = {
            'good': colors.HexColor('#27ae60'),
            'caution': colors.HexColor('#f39c12'),
            'warning': colors.HexColor('#e67e22'),
            'critical': colors.HexColor('#e74c3c')
        }
        
        for c in criteria:
            table_data.append([
                str(c.get('name', 'N/A')),
                f"{float(c.get('weight', 0)):.1f}",
                f"{float(c.get('actual_value', 0)):.4f}",
                f"{float(c.get('score', 0)):.1f}",
                str(c.get('status', 'N/A'))
            ])
        
        table = Table(table_data, colWidths=[50*mm, 20*mm, 30*mm, 25*mm, 25*mm])
        
        style_commands = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#34495e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#bdc3c7'))
        ]
        
        for i, c in enumerate(criteria, 1):
            status = str(c.get('status', '')).lower()
            bg_color = status_colors.get(status, colors.white)
            text_color = colors.white if status in status_colors else colors.black
            style_commands.append(('BACKGROUND', (4, i), (4, i), bg_color))
            style_commands.append(('TEXTCOLOR', (4, i), (4, i), text_color))
        
        table.setStyle(TableStyle(style_commands))
        story.append(table)
        story.append(Spacer(1, 5*mm))
        return story
    
    def _add_recommendations(self, story, safety_report: Dict, style) -> list:
        """添加安全建议到PDF"""
        recommendations = safety_report.get('recommendations', [])
        if not recommendations:
            story.append(Paragraph("暂无安全建议", style))
            return story
            
        priority_colors = {
            'critical': colors.HexColor('#e74c3c'),
            'high': colors.HexColor('#e67e22'),
            'medium': colors.HexColor('#f39c12'),
            'low': colors.HexColor('#27ae60')
        }
        
        for i, rec in enumerate(recommendations, 1):
            priority = str(rec.get('priority', 'N/A')).lower()
            category = str(rec.get('category', 'N/A'))
            message = str(rec.get('message', ''))
            action = str(rec.get('action_required', ''))
            
            bg_color = priority_colors.get(priority, colors.grey)
            
            rec_header = [
                [f"{i}. [{priority.upper()}] {category}", '']
            ]
            header_table = Table(rec_header, colWidths=[150*mm])
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), bg_color),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(header_table)
            
            story.append(Paragraph(f"<b>描述:</b> {message}", style))
            story.append(Paragraph(f"<b>建议行动:</b> {action}", style))
            story.append(Spacer(1, 3*mm))
        
        return story
    
    def _generate_thickness_chart(self, thickness_summary: Dict) -> Optional[str]:
        """生成厚度分布图表"""
        if not MATPLOTLIB_AVAILABLE:
            return None
            
        chart_path = self.output_dir / "temp_thickness_chart.png"
        
        try:
            fig, ax = plt.subplots(figsize=(10, 5))
            
            stats_labels = ['Min', '25%', 'Median', '75%', 'Max', 'Mean']
            stats_values = [
                float(thickness_summary.get('min', 0)),
                float(thickness_summary.get('percentile_25', 0)),
                float(thickness_summary.get('median', 0)),
                float(thickness_summary.get('percentile_75', 0)),
                float(thickness_summary.get('max', 0)),
                float(thickness_summary.get('mean', 0))
            ]
            
            bars = ax.bar(stats_labels, stats_values,
                         color=['#e74c3c', '#f39c12', '#3498db', '#2ecc71', '#9b59b6', '#34495e'])
            ax.set_ylabel('Thickness Value')
            ax.set_title('Thickness Statistics')
            ax.grid(True, alpha=0.3, axis='y')
            
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{height:.2f}', ha='center', va='bottom', fontsize=9)
            
            plt.tight_layout()
            plt.savefig(chart_path, dpi=150, bbox_inches='tight')
            plt.close()
            
            return str(chart_path)
        except Exception as e:
            print(f"图表生成错误: {e}")
            return None
    
    def generate_json_report(self,
                              point_cloud_stats: Dict,
                              defect_summary: Dict,
                              thickness_summary: Dict,
                              safety_report: Dict,
                              filename: str) -> str:
        """生成JSON格式报告"""
        import json
        
        output_path = self.output_dir / filename
        
        def convert_to_serializable(obj):
            """转换numpy类型为Python原生类型"""
            if isinstance(obj, (np.integer, np.int64, np.int32)):
                return int(obj)
            elif isinstance(obj, (np.floating, np.float64, np.float32)):
                return float(obj)
            elif isinstance(obj, np.ndarray):
                return obj.tolist()
            elif isinstance(obj, dict):
                return {k: convert_to_serializable(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [convert_to_serializable(item) for item in obj]
            else:
                return obj
        
        report = {
            'report_info': {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0'
            },
            'point_cloud': convert_to_serializable(point_cloud_stats),
            'defect_detection': convert_to_serializable(defect_summary),
            'thickness_analysis': convert_to_serializable(thickness_summary),
            'safety_assessment': convert_to_serializable(safety_report)
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            
        return str(output_path)
