import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch, cm
from typing import Dict, List
import numpy as np
import os
from datetime import datetime


class ReportGenerator:
    def __init__(self, output_dir: str = '../results'):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        self.title_style = ParagraphStyle(
            'CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1,
            textColor=colors.darkblue
        )
        self.heading_style = ParagraphStyle(
            'CustomHeading',
            parent=self.styles['Heading2'],
            fontSize=16,
            spaceAfter=12,
            textColor=colors.darkblue
        )
        self.normal_style = ParagraphStyle(
            'CustomNormal',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6
        )
        self.highlight_style = ParagraphStyle(
            'Highlight',
            parent=self.styles['Normal'],
            fontSize=14,
            spaceAfter=6,
            backColor=colors.lightblue,
            borderPadding=8
        )

    def _generate_sync_chart(self, result: Dict, chart_path: str):
        fig, axes = plt.subplots(3, 1, figsize=(10, 8))

        audio_envelope = np.array(result['signals']['audio_envelope'])
        visual_activity = np.array(result['signals']['visual_activity'])
        sync_curve = result['signals']['sync_curve']

        frames = np.arange(len(audio_envelope))

        axes[0].plot(frames, audio_envelope, 'b-', label='Audio Envelope', linewidth=1)
        axes[0].set_title('Audio Energy Envelope', fontsize=10)
        axes[0].set_ylabel('Normalized Energy', fontsize=8)
        axes[0].legend(fontsize=8)
        axes[0].grid(True, alpha=0.3)

        axes[1].plot(frames, visual_activity, 'r-', label='Visual Activity', linewidth=1)
        axes[1].set_title('Lip Movement Activity', fontsize=10)
        axes[1].set_ylabel('Normalized Activity', fontsize=8)
        axes[1].legend(fontsize=8)
        axes[1].grid(True, alpha=0.3)

        sync_frames = [item['frame'] for item in sync_curve]
        sync_scores = [item['local_sync_score'] for item in sync_curve]
        axes[2].plot(sync_frames, sync_scores, 'g-', label='Sync Score', linewidth=2)
        axes[2].axhline(y=result['sync_analysis']['sync_score'], color='orange', linestyle='--',
                        label=f'Overall Score: {result["sync_analysis"]["sync_score"]}')
        axes[2].set_title('Synchronization Score Over Time', fontsize=10)
        axes[2].set_xlabel('Frame', fontsize=8)
        axes[2].set_ylabel('Sync Score', fontsize=8)
        axes[2].legend(fontsize=8)
        axes[2].grid(True, alpha=0.3)
        axes[2].set_ylim([0, 100])

        plt.tight_layout()
        plt.savefig(chart_path, dpi=150, bbox_inches='tight')
        plt.close()

    def generate_single_report(self, result: Dict, filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'sync_report_{timestamp}.pdf'

        pdf_path = os.path.join(self.output_dir, filename)
        doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                                rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)

        story = []

        story.append(Paragraph('Audio-Video Synchronization Report', self.title_style))
        story.append(Spacer(1, 12))

        story.append(Paragraph('Executive Summary', self.heading_style))
        sync_score = result['sync_analysis']['sync_score']
        sync_level = result['sync_analysis']['sync_level']
        offset_frames = result['sync_analysis']['offset_frames']
        offset_seconds = result['sync_analysis']['offset_seconds']

        summary_text = f"""
        <b>Overall Synchronization Score:</b> {sync_score}/100 ({sync_level.upper()})<br/>
        <b>Detected Offset:</b> {offset_frames} frames ({offset_seconds:.3f} seconds)
        """
        story.append(Paragraph(summary_text, self.highlight_style))
        story.append(Spacer(1, 12))

        story.append(Paragraph('File Information', self.heading_style))
        info_data = [
            ['Parameter', 'Value'],
            ['Video Duration', f"{result['video_info']['duration']:.2f}s"],
            ['Video FPS', f"{result['video_info']['fps']:.1f}"],
            ['Video Resolution', f"{result['video_info']['resolution']['width']}x{result['video_info']['resolution']['height']}"],
            ['Audio Duration', f"{result['audio_info']['duration']:.2f}s"],
            ['Audio Sample Rate', f"{result['audio_info']['sample_rate']} Hz"]
        ]
        info_table = Table(info_data, colWidths=[3*inch, 3*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(info_table)
        story.append(Spacer(1, 12))

        story.append(Paragraph('Analysis Charts', self.heading_style))
        chart_path = os.path.join(self.output_dir, f'chart_{filename.replace(".pdf", ".png")}')
        self._generate_sync_chart(result, chart_path)

        chart_image = Image(chart_path)
        chart_image.drawWidth = 16 * cm
        chart_image.drawHeight = 12 * cm
        story.append(chart_image)
        story.append(Spacer(1, 12))

        story.append(Paragraph('Voice Activity Segments', self.heading_style))
        voice_segments = result['audio_info']['voice_segments']
        if voice_segments:
            segment_data = [['Segment #', 'Start Time (s)', 'End Time (s)', 'Duration (s)']]
            for i, seg in enumerate(voice_segments[:10], 1):
                segment_data.append([
                    str(i),
                    f"{seg['start']:.2f}",
                    f"{seg['end']:.2f}",
                    f"{seg['duration']:.2f}"
                ])
            if len(voice_segments) > 10:
                segment_data.append(['...', '...', '...', '...'])
            segment_table = Table(segment_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
            segment_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(segment_table)
        else:
            story.append(Paragraph('No voice activity detected.', self.normal_style))

        story.append(Spacer(1, 20))
        story.append(Paragraph(f'Report generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', self.normal_style))

        doc.build(story)
        return pdf_path

    def generate_batch_report(self, results: List[Dict], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'batch_sync_report_{timestamp}.pdf'

        pdf_path = os.path.join(self.output_dir, filename)
        doc = SimpleDocTemplate(pdf_path, pagesize=A4,
                                rightMargin=2*cm, leftMargin=2*cm,
                                topMargin=2*cm, bottomMargin=2*cm)

        story = []

        story.append(Paragraph('Batch Audio-Video Synchronization Report', self.title_style))
        story.append(Spacer(1, 12))

        story.append(Paragraph('Summary Statistics', self.heading_style))

        valid_results = [r for r in results if r.get('status') == 'success']
        if valid_results:
            scores = [r['sync_analysis']['sync_score'] for r in valid_results]
            avg_score = np.mean(scores)
            min_score = np.min(scores)
            max_score = np.max(scores)
            std_score = np.std(scores)

            stats_data = [
                ['Metric', 'Value'],
                ['Total Files Processed', str(len(results))],
                ['Successful Evaluations', str(len(valid_results))],
                ['Average Sync Score', f"{avg_score:.2f}/100"],
                ['Minimum Sync Score', f"{min_score:.2f}/100"],
                ['Maximum Sync Score', f"{max_score:.2f}/100"],
                ['Score Standard Deviation', f"{std_score:.2f}"]
            ]
            stats_table = Table(stats_data, colWidths=[3*inch, 3*inch])
            stats_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(stats_table)
            story.append(Spacer(1, 12))

        story.append(Paragraph('Detailed Results', self.heading_style))
        detail_data = [['#', 'Video File', 'Sync Score', 'Offset (frames)', 'Status']]
        for i, result in enumerate(results, 1):
            video_name = os.path.basename(result.get('video_path', 'N/A'))
            if result.get('status') == 'success':
                score = f"{result['sync_analysis']['sync_score']:.2f}"
                offset = str(result['sync_analysis']['offset_frames'])
                status = 'Success'
            else:
                score = 'N/A'
                offset = 'N/A'
                status = 'Failed'
            detail_data.append([str(i), video_name[:30], score, offset, status])

        detail_table = Table(detail_data, colWidths=[0.5*inch, 2*inch, 1.2*inch, 1.2*inch, 1.1*inch])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(detail_table)
        story.append(Spacer(1, 20))
        story.append(Paragraph(f'Report generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', self.normal_style))

        doc.build(story)
        return pdf_path
