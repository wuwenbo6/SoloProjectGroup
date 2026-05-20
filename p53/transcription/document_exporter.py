from typing import List, Dict
import json
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Preformatted
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime


class DocumentExporter:
    @staticmethod
    def export_to_txt(characters: List[Dict], file_path: str) -> bool:
        try:
            sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
            text = "".join([char.get("character", "") for char in sorted_chars])
            
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(text)
                
            return True
        except Exception as e:
            print(f"导出TXT失败: {e}")
            return False
            
    @staticmethod
    def export_to_pdf(characters: List[Dict], file_path: str, metadata: Dict = None) -> bool:
        try:
            sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
            
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            doc = SimpleDocTemplate(file_path, pagesize=letter)
            story = []
            styles = getSampleStyleSheet()
            
            if metadata:
                title = metadata.get("title", "打字机转录文档")
                story.append(Paragraph(title, styles['Title']))
                story.append(Spacer(1, 12))
                
                info_data = [
                    ["创建时间", metadata.get("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))],
                    ["字体类型", metadata.get("font_type", "unknown")],
                    ["打字机型号", metadata.get("typewriter_model", "unknown")],
                    ["字符总数", str(len(sorted_chars))],
                ]
                info_table = Table(info_data)
                info_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('PADDING', (0, 0), (-1, -1), 6),
                    ('FONTNAME', (0, 0), (-1, -1), 'Courier'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                ]))
                story.append(info_table)
                story.append(Spacer(1, 20))
            
            text = "".join([char.get("character", "") for char in sorted_chars])
            
            lines = text.split('\n')
            
            code_style = styles['Code']
            code_style.fontName = 'Courier'
            code_style.fontSize = 11
            code_style.leading = 14
            code_style.leftIndent = 20
            
            para_text = ""
            for i, line in enumerate(lines):
                para_text += line + "\n"
                if (i + 1) % 50 == 0:
                    story.append(Preformatted(para_text.rstrip(), code_style))
                    story.append(Spacer(1, 10))
                    para_text = ""
            
            if para_text.strip():
                story.append(Preformatted(para_text.rstrip(), code_style))
            
            doc.build(story)
            return True
        except Exception as e:
            print(f"导出PDF失败: {e}")
            return False
            
    @staticmethod
    def export_to_json(characters: List[Dict], file_path: str, metadata: Dict = None) -> bool:
        try:
            sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
            
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            data = {
                "metadata": metadata or {},
                "created_at": datetime.now().isoformat(),
                "character_count": len(sorted_chars),
                "characters": []
            }
            
            for char in sorted_chars:
                char_data = {
                    "sequence": char.get("sequence", 0),
                    "character": char.get("character", ""),
                    "timestamp": char.get("timestamp", ""),
                    "font_type": char.get("font_type", "unknown"),
                    "confidence": float(char.get("confidence", 0.0)),
                    "is_corrected": bool(char.get("is_corrected", False)),
                    "original_char": char.get("original_char", ""),
                }
                data["characters"].append(char_data)
                
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            return True
        except Exception as e:
            print(f"导出JSON失败: {e}")
            return False
            
    @staticmethod
    def import_from_json(file_path: str) -> Dict:
        try:
            if not os.path.exists(file_path):
                print(f"文件不存在: {file_path}")
                return {}
                
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            if "characters" in data:
                data["characters"].sort(key=lambda x: x.get("sequence", 0))
                
            return data
        except Exception as e:
            print(f"导入JSON失败: {e}")
            return {}
            
    @staticmethod
    def get_plain_text(characters: List[Dict]) -> str:
        sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
        return "".join([char.get("character", "") for char in sorted_chars])
        
    @staticmethod
    def get_statistics(characters: List[Dict]) -> Dict:
        sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
        total = len(sorted_chars)
        corrected = sum(1 for c in sorted_chars if c.get("is_corrected", False))
        avg_confidence = 0.0
        
        if total > 0:
            confidences = [float(c.get("confidence", 0)) for c in sorted_chars]
            avg_confidence = sum(confidences) / total
            
        font_types = {}
        for c in sorted_chars:
            ft = c.get("font_type", "unknown")
            font_types[ft] = font_types.get(ft, 0) + 1
            
        return {
            "total_characters": total,
            "corrected_characters": corrected,
            "average_confidence": avg_confidence,
            "font_distribution": font_types
        }
        
    @staticmethod
    def batch_export(characters: List[Dict], output_dir: str, base_name: str, 
                     formats: List[str] = None) -> Dict[str, bool]:
        if formats is None:
            formats = ["txt", "pdf", "json"]
            
        os.makedirs(output_dir, exist_ok=True)
        
        results = {}
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        for fmt in formats:
            file_path = os.path.join(output_dir, f"{base_name}_{timestamp}.{fmt}")
            
            if fmt.lower() == "txt":
                results["txt"] = DocumentExporter.export_to_txt(characters, file_path)
            elif fmt.lower() == "pdf":
                results["pdf"] = DocumentExporter.export_to_pdf(characters, file_path)
            elif fmt.lower() == "json":
                results["json"] = DocumentExporter.export_to_json(characters, file_path)
                
        return results
        
    @staticmethod
    def add_watermark_to_pdf(input_path: str, output_path: str, 
                            watermark_text: str, opacity: float = 0.3,
                            angle: int = 45, font_size: int = 40) -> bool:
        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.units import inch
            from PyPDF2 import PdfReader, PdfWriter
            import io
            
            packet = io.BytesIO()
            can = canvas.Canvas(packet, pagesize=letter)
            
            can.setFont("Courier", font_size)
            can.setFillColorRGB(0.5, 0.5, 0.5, alpha=opacity)
            
            width, height = letter
            num_lines = 5
            num_cols = 3
            
            for i in range(num_lines):
                for j in range(num_cols):
                    x = (width / num_cols) * j + (width / (num_cols * 2))
                    y = (height / num_lines) * i + (height / (num_lines * 2))
                    
                    can.saveState()
                    can.translate(x, y)
                    can.rotate(angle)
                    can.drawCentredString(0, 0, watermark_text)
                    can.restoreState()
            
            can.save()
            packet.seek(0)
            
            new_pdf = PdfReader(packet)
            existing_pdf = PdfReader(input_path)
            output = PdfWriter()
            
            for page in existing_pdf.pages:
                page.merge_page(new_pdf.pages[0])
                output.add_page(page)
            
            with open(output_path, "wb") as output_stream:
                output.write(output_stream)
                
            return True
        except Exception as e:
            print(f"添加水印失败: {e}")
            return False
            
    @staticmethod
    def export_to_html(characters: List[Dict], file_path: str, metadata: Dict = None) -> bool:
        try:
            sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
            text = "".join([c.get("character", "") for c in sorted_chars])
            
            html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{metadata.get('title', '打字机转录文档') if metadata else '打字机转录文档'}</title>
    <style>
        body {{
            font-family: 'Courier New', Courier, monospace;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: #f5f5f0;
            line-height: 1.6;
        }}
        .document-header {{
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .typewriter-text {{
            white-space: pre-wrap;
            font-size: 14px;
            letter-spacing: 1px;
            background: #fff;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            min-height: 400px;
        }}
        .char-corrected {{
            color: #d32f2f;
            font-weight: bold;
        }}
        .metadata {{
            color: #666;
            font-size: 12px;
            margin-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="document-header">
        <h1>{metadata.get('title', '打字机转录文档') if metadata else '打字机转录文档'}</h1>
    </div>
    <div class="typewriter-text">{text}</div>
    <div class="metadata">
        <p>字体类型: {metadata.get('font_type', 'unknown') if metadata else 'unknown'}</p>
        <p>打字机型号: {metadata.get('typewriter_model', 'unknown') if metadata else 'unknown'}</p>
        <p>导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        <p>字符总数: {len(sorted_chars)}</p>
    </div>
</body>
</html>"""
            
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
                
            return True
        except Exception as e:
            print(f"导出HTML失败: {e}")
            return False
            
    @staticmethod
    def convert_format(input_path: str, output_path: str, 
                      input_format: str = None, output_format: str = None) -> bool:
        try:
            if input_format is None:
                input_format = os.path.splitext(input_path)[1].lstrip('.').lower()
            if output_format is None:
                output_format = os.path.splitext(output_path)[1].lstrip('.').lower()
                
            if input_format == output_format:
                import shutil
                shutil.copy2(input_path, output_path)
                return True
                
            characters = []
            
            if input_format == "json":
                data = DocumentExporter.import_from_json(input_path)
                characters = data.get("characters", [])
            elif input_format == "txt":
                with open(input_path, 'r', encoding='utf-8') as f:
                    text = f.read()
                for i, char in enumerate(text):
                    characters.append({
                        "sequence": i,
                        "character": char,
                        "original_char": char
                    })
            else:
                return False
                
            metadata = {}
            if input_format == "json" and "metadata" in data:
                metadata = data["metadata"]
                
            if output_format == "txt":
                return DocumentExporter.export_to_txt(characters, output_path)
            elif output_format == "json":
                return DocumentExporter.export_to_json(characters, output_path, metadata)
            elif output_format == "pdf":
                return DocumentExporter.export_to_pdf(characters, output_path, metadata)
            elif output_format == "html":
                return DocumentExporter.export_to_html(characters, output_path, metadata)
            else:
                return False
                
        except Exception as e:
            print(f"格式转换失败: {e}")
            return False
