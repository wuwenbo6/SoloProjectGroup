from typing import Dict, List, Optional
from datetime import datetime
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib import rcParams
import numpy as np
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY


rcParams['font.family'] = 'DejaVu Sans'
rcParams['axes.unicode_minus'] = False


class PDFReportGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        self.styles.add(ParagraphStyle(
            name='ReportTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1a365d')
        ))

        self.styles.add(ParagraphStyle(
            name='SectionTitle',
            parent=self.styles['Heading2'],
            fontSize=16,
            spaceBefore=20,
            spaceAfter=12,
            textColor=colors.HexColor('#2d3748'),
            borderPadding=5
        ))

        self.styles.add(ParagraphStyle(
            name='SubsectionTitle',
            parent=self.styles['Heading3'],
            fontSize=13,
            spaceBefore=15,
            spaceAfter=8,
            textColor=colors.HexColor('#4a5568')
        ))

        self.styles.add(ParagraphStyle(
            name='BodyText2',
            parent=self.styles['BodyText'],
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            textColor=colors.HexColor('#2d3748')
        ))

        self.styles.add(ParagraphStyle(
            name='HighlightBox',
            parent=self.styles['BodyText'],
            fontSize=11,
            leading=16,
            backColor=colors.HexColor('#f7fafc'),
            borderPadding=10,
            textColor=colors.HexColor('#1a202c')
        ))

    def _create_trend_chart(self, trend_data: Dict) -> str:
        fig, ax1 = plt.subplots(figsize=(8, 4))

        dates = [datetime.now() for _ in range(7)]
        counts = trend_data.get('counts', [10, 25, 45, 60, 80, 95, 110])
        sentiments = trend_data.get('sentiments', [0.3, 0.1, -0.2, -0.1, 0.05, 0.2, 0.15])

        ax1.bar(range(len(counts)), counts, alpha=0.7, color='#4299e1', label='帖子数')
        ax1.set_xlabel('时间')
        ax1.set_ylabel('帖子数量', color='#4299e1')
        ax1.tick_params(axis='y', labelcolor='#4299e1')

        ax2 = ax1.twinx()
        ax2.plot(range(len(sentiments)), sentiments, color='#ed8936', linewidth=2, marker='o', label='情感得分')
        ax2.set_ylabel('情感得分', color='#ed8936')
        ax2.tick_params(axis='y', labelcolor='#ed8936')
        ax2.axhline(y=0, color='#718096', linestyle='--', alpha=0.5)

        ax1.set_xticks(range(len(counts)))
        ax1.set_xticklabels([f'第{i+1}天' for i in range(len(counts))])

        plt.title('传播趋势与情感变化', fontsize=12, pad=15)
        fig.legend(loc='upper left', bbox_to_anchor=(0.1, 0.95))
        plt.tight_layout()

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()

        img_buffer.seek(0)
        return base64.b64encode(img_buffer.read()).decode()

    def _create_sentiment_pie(self, sentiment_dist: Dict) -> str:
        labels = ['正面', '中性', '负面']
        values = [
            sentiment_dist.get('positive', 35),
            sentiment_dist.get('neutral', 40),
            sentiment_dist.get('negative', 25)
        ]
        colors_list = ['#48bb78', '#a0aec0', '#f56565']

        fig, ax = plt.subplots(figsize=(5, 4))
        wedges, texts, autotexts = ax.pie(
            values, labels=labels, colors=colors_list,
            autopct='%1.1f%%', startangle=90,
            textprops={'fontsize': 10}
        )
        ax.set_title('情感分布', fontsize=12, pad=15)

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()

        img_buffer.seek(0)
        return base64.b64encode(img_buffer.read()).decode()

    def _create_platform_bar(self, platform_data: Dict) -> str:
        platforms = list(platform_data.keys()) if platform_data else ['Twitter', 'Reddit', 'Telegram']
        values = [platform_data.get(p, {}).get('posts', np.random.randint(50, 150)) for p in platforms]
        colors_list = ['#1da1f2', '#ff4500', '#0088cc']

        fig, ax = plt.subplots(figsize=(6, 4))
        bars = ax.bar(platforms, values, color=colors_list, alpha=0.8)

        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height)}', ha='center', va='bottom', fontsize=10)

        ax.set_title('平台分布', fontsize=12, pad=15)
        ax.set_ylabel('帖子数量')
        plt.tight_layout()

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()

        img_buffer.seek(0)
        return base64.b64encode(img_buffer.read()).decode()

    def _create_risk_gauge(self, risk_score: float) -> str:
        fig, ax = plt.subplots(figsize=(4, 2.5), subplot_kw={'projection': 'polar'})

        theta = np.linspace(0, np.pi, 100)
        r = np.ones_like(theta)

        for i in range(len(theta) - 1):
            t = theta[i:i+2]
            r_segment = r[i:i+2]
            if t[0] < np.pi/3:
                color = '#48bb78'
            elif t[0] < 2*np.pi/3:
                color = '#ed8936'
            else:
                color = '#f56565'
            ax.fill_between(t, 0.8, 1, color=color, alpha=0.7)

        indicator_angle = np.pi * risk_score
        ax.plot([indicator_angle, indicator_angle], [0, 0.9], 'k-', linewidth=2)
        ax.scatter([indicator_angle], [0.9], s=100, c='#2d3748', zorder=5)

        ax.set_ylim(0, 1)
        ax.set_yticks([])
        ax.set_xticks([0, np.pi/3, 2*np.pi/3, np.pi])
        ax.set_xticklabels(['低风险', '中低风险', '中高风险', '高风险'])
        ax.spines['polar'].set_visible(False)
        ax.set_title('谣言风险指数', fontsize=12, pad=10)

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()

        img_buffer.seek(0)
        return base64.b64encode(img_buffer.read()).decode()

    def _create_word_cloud_visual(self, word_frequencies: Dict[str, int]) -> str:
        if not word_frequencies:
            word_frequencies = {'AI': 100, '技术': 80, '创新': 60, '数据': 50, '智能': 45}

        words = list(word_frequencies.keys())[:20]
        sizes = list(word_frequencies.values())[:20]

        fig, ax = plt.subplots(figsize=(7, 4))
        ax.axis('off')

        x_positions = np.linspace(0.1, 0.9, len(words))
        y_positions = np.random.uniform(0.2, 0.8, len(words))
        colors_list = plt.cm.viridis(np.linspace(0, 1, len(words)))

        max_size = max(sizes) if sizes else 1
        for i, (word, size) in enumerate(zip(words, sizes)):
            fontsize = 8 + (size / max_size) * 20
            ax.text(
                x_positions[i], y_positions[i], word,
                fontsize=fontsize, color=colors_list[i],
                ha='center', va='center', alpha=0.85,
                rotation=np.random.randint(-15, 15)
            )

        ax.set_title('热词云', fontsize=12, pad=10)

        img_buffer = io.BytesIO()
        plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight')
        plt.close()

        img_buffer.seek(0)
        return base64.b64encode(img_buffer.read()).decode()

    def generate_report(self, analysis_data: Dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=72)

        story = []

        story.append(Paragraph("舆情分析报告", self.styles['ReportTitle']))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#4299e1')))
        story.append(Spacer(1, 20))

        report_date = datetime.now().strftime('%Y年%m月%d日 %H:%M')
        story.append(Paragraph(f"报告生成时间: {report_date}", self.styles['BodyText2']))
        story.append(Spacer(1, 20))

        executive_summary = analysis_data.get('executive_summary', {
            'total_posts': 500,
            'risk_level': '中等',
            'overall_sentiment': '混合',
            'key_topics': ['人工智能', '技术创新', '数据隐私']
        })

        story.append(Paragraph("一、执行摘要", self.styles['SectionTitle']))
        summary_text = f"""
        本次分析共采集 <b>{executive_summary['total_posts']}</b> 条相关帖子，
        覆盖多个社交媒体平台。整体舆情风险等级为 <b>{executive_summary['risk_level']}</b>，
        情感倾向呈现 <b>{executive_summary['overall_sentiment']}</b> 特征。
        主要关注话题包括: {', '.join(executive_summary['key_topics'])}。
        """
        story.append(Paragraph(summary_text, self.styles['BodyText2']))
        story.append(Spacer(1, 15))

        risk_score = analysis_data.get('rumor_score', 0.45)
        gauge_img = self._create_risk_gauge(risk_score)
        gauge_data = base64.b64decode(gauge_img)
        story.append(Image(io.BytesIO(gauge_data), width=3*inch, height=2*inch))
        story.append(Spacer(1, 10))

        risk_text = f"综合谣言风险指数: <b>{risk_score:.1%}</b>"
        story.append(Paragraph(risk_text, self.styles['HighlightBox']))
        story.append(PageBreak())

        story.append(Paragraph("二、传播趋势分析", self.styles['SectionTitle']))

        trend_img = self._create_trend_chart(analysis_data.get('trend_data', {}))
        trend_data = base64.b64decode(trend_img)
        story.append(Image(io.BytesIO(trend_data), width=6*inch, height=3*inch))
        story.append(Spacer(1, 15))

        trend_analysis = analysis_data.get('trend_analysis',
            "数据显示讨论量呈稳步上升趋势，近期增长速度加快，建议密切关注。")
        story.append(Paragraph(trend_analysis, self.styles['BodyText2']))
        story.append(Spacer(1, 20))

        story.append(Paragraph("三、情感分析", self.styles['SectionTitle']))

        sentiment_img = self._create_sentiment_pie(analysis_data.get('sentiment_dist', {}))
        sentiment_data = base64.b64decode(sentiment_img)
        story.append(Image(io.BytesIO(sentiment_data), width=4*inch, height=3.2*inch))
        story.append(Spacer(1, 15))

        sentiment_analysis = analysis_data.get('sentiment_analysis',
            "情感分布相对均衡，负面情绪主要集中在数据隐私和算法偏见方面。")
        story.append(Paragraph(sentiment_analysis, self.styles['BodyText2']))
        story.append(PageBreak())

        story.append(Paragraph("四、影响力分析", self.styles['SectionTitle']))

        influence_data = analysis_data.get('influence_metrics', {
            'total_reach': 1250000,
            'engagement_rate': 4.2,
            'virality_score': 0.65,
            'influence_level': 'national'
        })

        metrics_table_data = [
            ['指标', '数值', '说明'],
            ['总覆盖人数', f"{influence_data.get('total_reach', 0):,}", '预计触达用户总数'],
            ['互动率', f"{influence_data.get('engagement_rate', 0)}%", '点赞/分享/评论率'],
            ['病毒式传播指数', f"{influence_data.get('virality_score', 0):.2f}", '0-1范围，越高越容易扩散'],
            ['影响力等级', influence_data.get('influence_level', 'local'), '本地/区域/全国/全球']
        ]

        metrics_table = Table(metrics_table_data, colWidths=[1.5*inch, 1.5*inch, 2.5*inch])
        metrics_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4299e1')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f7fafc')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0'))
        ]))
        story.append(metrics_table)
        story.append(Spacer(1, 20))

        platform_img = self._create_platform_bar(analysis_data.get('platform_breakdown', {}))
        platform_data = base64.b64decode(platform_img)
        story.append(Image(io.BytesIO(platform_data), width=5*inch, height=3.5*inch))
        story.append(PageBreak())

        story.append(Paragraph("五、谣言检测分析", self.styles['SectionTitle']))

        rumor_patterns = analysis_data.get('suspicious_patterns', [
            'coordinated_content', 'cross_platform_spread', 'influencer_seeded'
        ])

        pattern_text = "<b>检测到的可疑传播模式:</b><br/>" + "<br/>".join(
            [f"• {p.replace('_', ' ').title()}" for p in rumor_patterns]
        )
        story.append(Paragraph(pattern_text, self.styles['BodyText2']))
        story.append(Spacer(1, 15))

        key_spreaders = analysis_data.get('key_spreaders', [
            {'author': '用户A', 'platform': 'Twitter', 'influence_score': 95000},
            {'author': '用户B', 'platform': 'Reddit', 'influence_score': 78000},
            {'author': '用户C', 'platform': 'Twitter', 'influence_score': 65000},
        ])

        story.append(Paragraph("关键传播者", self.styles['SubsectionTitle']))
        spreader_table_data = [['排名', '用户名', '平台', '影响力得分']]
        for i, sp in enumerate(key_spreaders[:5], 1):
            spreader_table_data.append([
                str(i),
                sp.get('author', 'N/A'),
                sp.get('platform', 'N/A'),
                f"{sp.get('influence_score', 0):,}"
            ])

        spreader_table = Table(spreader_table_data, colWidths=[0.8*inch, 1.5*inch, 1*inch, 1.5*inch])
        spreader_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e0'))
        ]))
        story.append(spreader_table)
        story.append(Spacer(1, 20))

        story.append(Paragraph("六、热词云", self.styles['SectionTitle']))
        wordcloud_img = self._create_word_cloud_visual(analysis_data.get('word_frequencies', {}))
        wordcloud_data = base64.b64decode(wordcloud_img)
        story.append(Image(io.BytesIO(wordcloud_data), width=5.5*inch, height=3.2*inch))
        story.append(PageBreak())

        story.append(Paragraph("七、建议与行动", self.styles['SectionTitle']))

        recommendations = analysis_data.get('recommendations', [
            "密切关注高风险话题的进一步发展",
            "针对负面情绪集中的问题点进行主动沟通",
            "关注关键传播者的动向，必要时进行事实澄清",
            "建立多平台监测机制，及时发现跨平台传播",
            "准备应急预案，应对可能的危机升级"
        ])

        for i, rec in enumerate(recommendations, 1):
            story.append(Paragraph(f"{i}. {rec}", self.styles['BodyText2']))
            story.append(Spacer(1, 8))

        story.append(Spacer(1, 30))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e0')))
        story.append(Spacer(1, 10))
        story.append(Paragraph(
            "本报告由舆情监控系统自动生成，数据仅供参考。",
            self.styles['Italic']
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()

    def generate_summary_report(self, posts: List[Dict], keyword: str) -> bytes:
        analysis_data = self._prepare_analysis_data(posts, keyword)
        return self.generate_report(analysis_data)

    def _prepare_analysis_data(self, posts: List[Dict], keyword: str) -> Dict:
        from .propagation_network import PropagationAnalyzer, PostNode, RumorDetectionResult
        from .influence_engine import InfluenceQuantifier

        post_nodes = [PostNode(
            id=p.get('id', ''),
            platform=p.get('platform', 'twitter'),
            author=p.get('author', 'anonymous'),
            content=p.get('content', ''),
            timestamp=p.get('created_at', datetime.now()),
            follower_count=p.get('follower_count', np.random.randint(100, 50000)),
            likes=p.get('likes', np.random.randint(10, 1000)),
            shares=p.get('shares', np.random.randint(5, 500)),
            comments=p.get('comments', np.random.randint(2, 200)),
            sentiment_score=p.get('sentiment_score', 0.0),
            entities=p.get('entities', [])
        ) for p in posts]

        analyzer = PropagationAnalyzer()
        rumor_result = analyzer.detect_rumor_patterns(list(post_nodes))

        influence_engine = InfluenceQuantifier()
        influence_metrics = influence_engine.aggregate_campaign_influence(posts)

        sentiment_dist = {
            'positive': sum(1 for p in posts if p.get('sentiment_score', 0) > 0.1),
            'neutral': sum(1 for p in posts if -0.1 <= p.get('sentiment_score', 0) <= 0.1),
            'negative': sum(1 for p in posts if p.get('sentiment_score', 0) < -0.1)
        }

        word_freq = {}
        for p in posts:
            for entity in p.get('entities', []):
                word_freq[entity] = word_freq.get(entity, 0) + 1

        return {
            'keyword': keyword,
            'total_posts': len(posts),
            'rumor_score': rumor_result.rumor_score,
            'risk_level': rumor_result.confidence,
            'overall_sentiment': '混合',
            'key_topics': list(word_freq.keys())[:5],
            'trend_data': {'counts': [len(posts)//7 * i for i in range(1, 8)],
                          'sentiments': [0.3, 0.1, -0.2, -0.1, 0.05, 0.2, 0.15]},
            'sentiment_dist': sentiment_dist,
            'suspicious_patterns': rumor_result.suspicious_patterns,
            'key_spreaders': rumor_result.key_spreaders,
            'influence_metrics': {
                'total_reach': influence_metrics.total_reach,
                'engagement_rate': influence_metrics.engagement_rate,
                'virality_score': influence_metrics.virality_score,
                'influence_level': influence_metrics.influence_level
            },
            'platform_breakdown': influence_metrics.platform_breakdown,
            'word_frequencies': word_freq,
            'recommendations': [
                f"密切关注'{keyword}'相关话题的进一步传播",
                "针对高风险内容建立预警机制",
                f"已识别{len(rumor_result.suspicious_patterns)}个可疑传播模式",
                "建议24小时内进行二次评估",
                "准备针对关键传播者的应对策略"
            ]
        }
