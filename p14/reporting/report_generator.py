import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime
import plotly.graph_objects as go
import plotly.express as px
from plotly.io import to_html
import json
import base64
import io


class ReportGenerator:
    def __init__(self, data: Optional[pd.DataFrame] = None):
        self.data = data
        self.report_sections: List[Dict[str, Any]] = []
        self.metadata: Dict[str, Any] = {
            "title": "数据分析报告",
            "author": "数据分析平台",
            "created_at": datetime.now().isoformat()
        }

    def set_data(self, data: pd.DataFrame):
        self.data = data.copy()

    def set_metadata(self, title: str = None, author: str = None):
        if title:
            self.metadata["title"] = title
        if author:
            self.metadata["author"] = author
        self.metadata["created_at"] = datetime.now().isoformat()

    def add_section(self, section_title: str, content: str, 
                     figure: Optional[go.Figure] = None,
                     section_type: str = "text"):
        section = {
            "title": section_title,
            "content": content,
            "type": section_type,
            "timestamp": datetime.now().isoformat()
        }
        
        if figure:
            section["figure"] = to_html(figure, full_html=False, include_plotlyjs=False)
        
        self.report_sections.append(section)

    def add_data_overview(self, include_stats: bool = True):
        if self.data is None:
            raise ValueError("请先设置数据")
        
        overview_content = f"""
        <div class="data-overview">
            <p><strong>数据集大小:</strong> {len(self.data)} 行 × {len(self.data.columns)} 列</p>
            <p><strong>列名:</strong> {', '.join(self.data.columns.tolist())}</p>
            <p><strong>数据类型:</strong></p>
            <ul>
                {''.join([f'<li>{col}: {dtype}</li>' for col, dtype in self.data.dtypes.items()])}
            </ul>
        </div>
        """
        
        if include_stats:
            numeric_cols = self.data.select_dtypes(include=[np.number]).columns
            if len(numeric_cols) > 0:
                desc_stats = self.data[numeric_cols].describe()
                stats_html = desc_stats.to_html(classes="table table-striped table-sm")
                overview_content += f"<p><strong>描述性统计:</strong></p>{stats_html}"
        
        missing_counts = self.data.isnull().sum()
        if missing_counts.sum() > 0:
            missing_html = pd.DataFrame({
                "列名": missing_counts.index,
                "缺失数量": missing_counts.values,
                "缺失比例": (missing_counts.values / len(self.data) * 100).round(2)
            }).to_html(classes="table table-warning table-sm")
            overview_content += f"<p><strong>缺失值统计:</strong></p>{missing_html}"
        
        self.add_section("数据概览", overview_content, section_type="overview")

    def add_correlation_analysis(self, method: str = "pearson"):
        if self.data is None:
            raise ValueError("请先设置数据")
        
        numeric_cols = self.data.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) < 2:
            return
        
        corr_matrix = self.data[numeric_cols].corr(method=method)
        
        fig = go.Figure(data=go.Heatmap(
            z=corr_matrix.values,
            x=corr_matrix.columns,
            y=corr_matrix.columns,
            colorscale="RdBu",
            zmin=-1,
            zmax=1,
            text=corr_matrix.round(2).values,
            texttemplate="%{text}",
        ))
        fig.update_layout(title=f"相关性热力图 ({method.capitalize()})", height=500)
        
        high_corr = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                corr_val = corr_matrix.iloc[i, j]
                if abs(corr_val) >= 0.7:
                    high_corr.append({
                        "var1": corr_matrix.columns[i],
                        "var2": corr_matrix.columns[j],
                        "correlation": corr_val
                    })
        
        content = f"<p>计算了 {len(numeric_cols)} 个数值变量之间的相关性。</p>"
        if high_corr:
            content += "<p><strong>高相关性变量对 (|r| ≥ 0.7):</strong></p><ul>"
            for item in high_corr:
                content += f"<li>{item['var1']} ↔ {item['var2']}: {item['correlation']:.3f}</li>"
            content += "</ul>"
        
        self.add_section("相关性分析", content, figure=fig, section_type="analysis")

    def add_distribution_plots(self, columns: Optional[List[str]] = None):
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.data.select_dtypes(include=[np.number]).columns[:4]
        
        for col in target_cols:
            fig = px.histogram(
                self.data, x=col, nbins=30,
                title=f"{col} 分布直方图",
                marginal="box"
            )
            fig.update_layout(height=400, template="plotly_white")
            
            stats = self.data[col].describe()
            content = f"""
            <p><strong>统计摘要:</strong></p>
            <ul>
                <li>均值: {stats['mean']:.3f}</li>
                <li>标准差: {stats['std']:.3f}</li>
                <li>最小值: {stats['min']:.3f}</li>
                <li>25%分位数: {stats['25%']:.3f}</li>
                <li>中位数: {stats['50%']:.3f}</li>
                <li>75%分位数: {stats['75%']:.3f}</li>
                <li>最大值: {stats['max']:.3f}</li>
            </ul>
            """
            
            self.add_section(f"变量分布: {col}", content, figure=fig, section_type="visualization")

    def add_cluster_analysis_section(self, cluster_result: Dict[str, Any]):
        content = f"""
        <div class="cluster-summary">
            <p><strong>聚类算法:</strong> {cluster_result.get('algorithm', 'Unknown')}</p>
            <p><strong>聚类数量:</strong> {cluster_result.get('cluster_stats', {}).get('n_clusters', 0)}</p>
            <p><strong>轮廓系数:</strong> {cluster_result.get('cluster_stats', {}).get('silhouette_score', 0):.3f}</p>
            <p><strong>各聚类大小:</strong></p>
            <ul>
        """
        
        cluster_sizes = cluster_result.get('cluster_stats', {}).get('cluster_sizes', {})
        for cluster_label, size in cluster_sizes.items():
            content += f"<li>聚类 {cluster_label}: {size} 个样本</li>"
        
        content += "</ul></div>"
        
        self.add_section("聚类分析摘要", content, section_type="analysis")

    def add_custom_figure(self, title: str, fig: go.Figure, description: str = ""):
        self.add_section(title, description, figure=fig, section_type="visualization")

    def add_text_section(self, title: str, text: str):
        self.add_section(title, f"<p>{text}</p>", section_type="text")

    def _get_css_styles(self) -> str:
        return """
        <style>
            body {
                font-family: 'Segoe UI', Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 20px;
                color: #333;
                background-color: #f8f9fa;
            }
            .report-container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .report-header {
                border-bottom: 3px solid #007bff;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .report-header h1 {
                color: #2c3e50;
                margin: 0;
            }
            .report-meta {
                color: #6c757d;
                font-size: 0.9em;
                margin-top: 10px;
            }
            .section {
                margin-bottom: 40px;
            }
            .section h2 {
                color: #007bff;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 10px;
                margin-top: 0;
            }
            .section-content {
                padding: 15px 0;
            }
            .table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            .table th, .table td {
                border: 1px solid #dee2e6;
                padding: 8px 12px;
                text-align: left;
            }
            .table th {
                background-color: #f8f9fa;
                font-weight: 600;
            }
            .table-striped tbody tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            .table-warning {
                background-color: #fff3cd;
            }
            ul {
                padding-left: 20px;
            }
            .plot-container {
                margin: 20px 0;
            }
            .report-footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
                text-align: center;
                color: #6c757d;
                font-size: 0.85em;
            }
            @media print {
                body {
                    background: white;
                    padding: 0;
                }
                .report-container {
                    box-shadow: none;
                    max-width: none;
                }
            }
        </style>
        """

    def generate_html(self, output_path: Optional[str] = None) -> str:
        html_parts = [
            "<!DOCTYPE html>",
            "<html lang='zh-CN'>",
            "<head>",
            "<meta charset='UTF-8'>",
            "<meta name='viewport' content='width=device-width, initial-scale=1.0'>",
            f"<title>{self.metadata['title']}</title>",
            self._get_css_styles(),
            '<script src="https://cdn.plot.ly/plotly-latest.min.js"></script>',
            "</head>",
            "<body>",
            '<div class="report-container">',
            '<div class="report-header">',
            f"<h1>{self.metadata['title']}</h1>",
            f'<div class="report-meta">',
            f"<p>作者: {self.metadata['author']}</p>",
            f"<p>生成时间: {datetime.fromisoformat(self.metadata['created_at']).strftime('%Y年%m月%d日 %H:%M:%S')}</p>",
            "</div></div>"
        ]
        
        for section in self.report_sections:
            html_parts.append('<div class="section">')
            html_parts.append(f"<h2>{section['title']}</h2>")
            html_parts.append(f'<div class="section-content">{section["content"]}</div>')
            
            if "figure" in section:
                html_parts.append('<div class="plot-container">')
                html_parts.append(section["figure"])
                html_parts.append("</div>")
            
            html_parts.append("</div>")
        
        html_parts.append('<div class="report-footer">')
        html_parts.append("<p>本报告由数据分析平台自动生成</p>")
        html_parts.append("</div></div></body></html>")
        
        full_html = "\n".join(html_parts)
        
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(full_html)
        
        return full_html

    def generate_pdf(self, output_path: str):
        try:
            import pdfkit
            
            html_content = self.generate_html()
            
            options = {
                'page-size': 'A4',
                'margin-top': '0.75in',
                'margin-right': '0.75in',
                'margin-bottom': '0.75in',
                'margin-left': '0.75in',
                'encoding': 'UTF-8',
                'no-outline': None,
                'enable-local-file-access': None
            }
            
            pdfkit.from_string(html_content, output_path, options=options)
            return True
        except ImportError:
            raise ImportError("请安装 pdfkit 和 wkhtmltopdf 以支持PDF导出: pip install pdfkit")
        except Exception as e:
            raise Exception(f"PDF生成失败: {str(e)}")

    def generate_summary_json(self, output_path: Optional[str] = None) -> Dict[str, Any]:
        summary = {
            "metadata": self.metadata,
            "sections_count": len(self.report_sections),
            "sections": [
                {"title": s["title"], "type": s["type"], "timestamp": s["timestamp"]}
                for s in self.report_sections
            ],
            "data_shape": self.data.shape if self.data is not None else None
        }
        
        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
        
        return summary

    def clear_sections(self):
        self.report_sections = []

    def auto_generate_report(self, include_distributions: bool = True,
                             include_correlation: bool = True,
                             title: str = "自动数据分析报告") -> str:
        self.clear_sections()
        self.set_metadata(title=title)
        
        self.add_data_overview()
        
        if include_distributions and self.data is not None:
            self.add_distribution_plots()
        
        if include_correlation:
            self.add_correlation_analysis()
        
        return self.generate_html()

    def get_report_preview(self) -> str:
        return f"报告包含 {len(self.report_sections)} 个部分，生成时间: {self.metadata['created_at']}"
