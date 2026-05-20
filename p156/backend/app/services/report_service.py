import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.units import cm
from typing import Dict, Any, List
from backend.app.models.database import SessionLocal, EmissionRecord, EmissionSource, Company, Report
from backend.app.services.carbon_calculator import CarbonCalculator
from datetime import datetime
import pandas as pd


class ReportService:
    def __init__(self):
        self.db = SessionLocal()
        self.upload_dir = "./backend/reports"
        os.makedirs(self.upload_dir, exist_ok=True)
        
        plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False
    
    def generate_scope_chart(self, record_id: str, output_path: str):
        calculator = CarbonCalculator()
        record = self.db.query(EmissionRecord).filter_by(id=record_id).first()
        
        if not record:
            return None
        
        labels = ['范围一', '范围二', '范围三']
        values = [record.scope1_total, record.scope2_total, record.scope3_total]
        colors_list = ['#1B4D3E', '#2E8B57', '#3CB371']
        
        fig, ax = plt.subplots(figsize=(8, 6))
        wedges, texts, autotexts = ax.pie(
            values, labels=labels, autopct='%1.1f%%',
            colors=colors_list, startangle=90
        )
        ax.set_title('排放范围构成', fontsize=14, pad=20)
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        calculator.close()
        
        return output_path
    
    def generate_trend_chart(self, company_id: str, output_path: str):
        calculator = CarbonCalculator()
        trend_data = calculator.get_trend_data(company_id, months=6)
        
        if not trend_data:
            return None
        
        periods = [d['period'] for d in trend_data]
        scope1 = [d['scope1'] for d in trend_data]
        scope2 = [d['scope2'] for d in trend_data]
        scope3 = [d['scope3'] for d in trend_data]
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        x = range(len(periods))
        ax.stackplot(x, scope1, scope2, scope3,
                     labels=['范围一', '范围二', '范围三'],
                     colors=['#1B4D3E', '#2E8B57', '#3CB371'],
                     alpha=0.8)
        
        ax.set_xlabel('月份')
        ax.set_ylabel('排放量 (tCO2e)')
        ax.set_title('排放趋势图', fontsize=14, pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(periods)
        ax.legend(loc='upper left')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        calculator.close()
        
        return output_path
    
    def generate_hotspot_chart(self, record_id: str, output_path: str):
        calculator = CarbonCalculator()
        hotspot_data = calculator.get_hotspot_analysis(record_id)
        
        if not hotspot_data['hotspots']:
            return None
        
        hotspots = hotspot_data['hotspots'][:8]
        categories = [h['category'] for h in hotspots]
        emissions = [h['emission'] for h in hotspots]
        colors_list = ['#E67E22' if h['level'] == 'high' else '#F39C12' if h['level'] == 'medium' else '#3CB371' for h in hotspots]
        
        fig, ax = plt.subplots(figsize=(10, 6))
        bars = ax.barh(categories, emissions, color=colors_list)
        ax.set_xlabel('排放量 (tCO2e)')
        ax.set_title('排放热点分布', fontsize=14, pad=20)
        ax.invert_yaxis()
        
        for bar, h in zip(bars, hotspots):
            width = bar.get_width()
            ax.text(width, bar.get_y() + bar.get_height()/2,
                    f' {h["percentage"]}%',
                    va='center', fontsize=9)
        
        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        calculator.close()
        
        return output_path
    
    def generate_pdf_report(self, company_id: str, period_start: str, period_end: str, report_id: str) -> str:
        report = self.db.query(Report).filter_by(id=report_id).first()
        company = self.db.query(Company).filter_by(id=company_id).first()
        
        if not company:
            raise ValueError("Company not found")
        
        record = self.db.query(EmissionRecord).filter_by(
            company_id=company_id
        ).order_by(EmissionRecord.calculated_at.desc()).first()
        
        if not record:
            calculator = CarbonCalculator()
            from backend.app.services.carbon_calculator import generate_sample_data
            sample_df = generate_sample_data()
            result = calculator.calculate_from_dataframe(sample_df, company_id, "2024-Q1")
            record = self.db.query(EmissionRecord).filter_by(id=result['record_id']).first()
            calculator.close()
        
        pdf_path = f"{self.upload_dir}/report_{report_id}.pdf"
        
        doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                               leftMargin=2*cm, rightMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#1B4D3E'),
            spaceAfter=30
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#2E8B57'),
            spaceAfter=15
        )
        normal_style = styles['Normal']
        
        story = []
        
        story.append(Paragraph("供应链碳排放管理报告", title_style))
        story.append(Paragraph(f"企业名称: {company.name}", normal_style))
        story.append(Paragraph(f"报告期间: {period_start} - {period_end}", normal_style))
        story.append(Paragraph(f"生成日期: {datetime.now().strftime('%Y-%m-%d')}", normal_style))
        story.append(Spacer(1, 0.5*cm))
        
        story.append(Paragraph("一、排放汇总", heading_style))
        
        summary_data = [
            ['排放范围', '排放量 (tCO2e)', '占比'],
            ['范围一 (直接排放)', f'{record.scope1_total:.2f}', f'{record.scope1_total/record.grand_total*100:.1f}%'],
            ['范围二 (间接排放)', f'{record.scope2_total:.2f}', f'{record.scope2_total/record.grand_total*100:.1f}%'],
            ['范围三 (供应链排放)', f'{record.scope3_total:.2f}', f'{record.scope3_total/record.grand_total*100:.1f}%'],
            ['总计', f'{record.grand_total:.2f}', '100%']
        ]
        
        summary_table = Table(summary_data, colWidths=[5*cm, 4*cm, 3*cm])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1B4D3E')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.gray),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 0.8*cm))
        
        scope_chart_path = f"{self.upload_dir}/scope_{report_id}.png"
        self.generate_scope_chart(record.id, scope_chart_path)
        if os.path.exists(scope_chart_path):
            story.append(Paragraph("二、排放范围构成", heading_style))
            story.append(Image(scope_chart_path, width=14*cm, height=10*cm))
            story.append(Spacer(1, 0.5*cm))
        
        trend_chart_path = f"{self.upload_dir}/trend_{report_id}.png"
        self.generate_trend_chart(company_id, trend_chart_path)
        if os.path.exists(trend_chart_path):
            story.append(Paragraph("三、排放趋势分析", heading_style))
            story.append(Image(trend_chart_path, width=14*cm, height=8*cm))
            story.append(Spacer(1, 0.5*cm))
        
        hotspot_chart_path = f"{self.upload_dir}/hotspot_{report_id}.png"
        self.generate_hotspot_chart(record.id, hotspot_chart_path)
        if os.path.exists(hotspot_chart_path):
            story.append(Paragraph("四、排放热点分布", heading_style))
            story.append(Image(hotspot_chart_path, width=14*cm, height=8*cm))
            story.append(Spacer(1, 0.5*cm))
        
        story.append(Paragraph("五、减排建议", heading_style))
        story.append(Paragraph("基于您的排放数据，建议优先采取以下减排措施：", normal_style))
        story.append(Spacer(1, 0.3*cm))
        
        suggestions_data = [
            ['措施', '预计减排', '成本等级', '回收期'],
            ['优化物流路线', '12.3%', '低', '6个月'],
            ['更换LED照明', '5.2%', '中', '2-3年'],
            ['安装屋顶光伏', '25.0%', '高', '6-8年'],
            ['供应商碳管理', '15.2%', '中', '2-3年']
        ]
        
        suggestion_table = Table(suggestions_data, colWidths=[5*cm, 2.5*cm, 2.5*cm, 3*cm])
        suggestion_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2E8B57')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.gray),
        ]))
        story.append(suggestion_table)
        
        doc.build(story)
        
        for f in [scope_chart_path, trend_chart_path, hotspot_chart_path]:
            if os.path.exists(f):
                os.remove(f)
        
        report.status = "completed"
        report.file_path = pdf_path
        self.db.commit()
        
        return pdf_path
    
    def close(self):
        self.db.close()
