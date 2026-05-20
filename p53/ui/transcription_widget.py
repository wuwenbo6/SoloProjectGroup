from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QTextEdit, 
                             QPushButton, QGroupBox, QFormLayout, QLineEdit,
                             QLabel, QComboBox, QFileDialog, QMessageBox,
                             QSplitter, QTableWidget, QTableWidgetItem, QHeaderView)
from PyQt6.QtCore import Qt

from transcription.document_exporter import DocumentExporter
from database.models import DatabaseManager


class TranscriptionWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.db_manager = DatabaseManager()
        self.current_characters = []
        self.identified_typewriter = None
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        splitter = QSplitter(Qt.Orientation.Vertical)
        
        metadata_group = QGroupBox("文档信息与智能识别")
        metadata_layout = QFormLayout(metadata_group)
        
        self.title_edit = QLineEdit()
        self.title_edit.setPlaceholderText("输入文档标题")
        metadata_layout.addRow("标题:", self.title_edit)
        
        self.typewriter_combo = QComboBox()
        self.load_typewriters()
        metadata_layout.addRow("打字机型号:", self.typewriter_combo)
        
        self.auto_identify_btn = QPushButton("🔍 自动识别型号")
        self.auto_identify_btn.clicked.connect(self.auto_identify_typewriter)
        metadata_layout.addRow("", self.auto_identify_btn)
        
        self.identification_result = QLabel("等待识别...")
        self.identification_result.setStyleSheet("color: #666; font-style: italic;")
        metadata_layout.addRow("识别结果:", self.identification_result)
        
        self.font_combo = QComboBox()
        fonts = ["Courier", "Typewriter Classic", "Mechanical Typewriter", 
                 "Electric Typewriter", "Times New Roman", "Custom"]
        self.font_combo.addItems(fonts)
        metadata_layout.addRow("字体类型:", self.font_combo)
        
        self.category_combo = QComboBox()
        self.load_categories()
        metadata_layout.addRow("分类:", self.category_combo)
        
        splitter.addWidget(metadata_group)
        
        watermark_group = QGroupBox("水印设置")
        watermark_layout = QFormLayout(watermark_group)
        
        self.watermark_text = QLineEdit("机密文档")
        self.watermark_text.setPlaceholderText("输入水印文字")
        watermark_layout.addRow("水印文字:", self.watermark_text)
        
        self.watermark_opacity = QComboBox()
        for i in range(1, 10):
            self.watermark_opacity.addItem(f"{i * 10}%", i * 0.1)
        self.watermark_opacity.setCurrentIndex(2)
        watermark_layout.addRow("透明度:", self.watermark_opacity)
        
        self.watermark_angle = QComboBox()
        for angle in [0, 30, 45, 60, 90]:
            self.watermark_angle.addItem(f"{angle}°", angle)
        self.watermark_angle.setCurrentIndex(2)
        watermark_layout.addRow("旋转角度:", self.watermark_angle)
        
        splitter.addWidget(watermark_group)
        
        format_group = QGroupBox("格式转换")
        format_layout = QHBoxLayout(format_group)
        
        self.input_format_combo = QComboBox()
        self.input_format_combo.addItems(["自动检测", "TXT", "JSON"])
        format_layout.addWidget(QLabel("输入格式:"))
        format_layout.addWidget(self.input_format_combo)
        
        format_layout.addWidget(QLabel("→"))
        
        self.output_format_combo = QComboBox()
        self.output_format_combo.addItems(["TXT", "PDF", "JSON", "HTML"])
        format_layout.addWidget(QLabel("输出格式:"))
        format_layout.addWidget(self.output_format_combo)
        
        self.convert_btn = QPushButton("开始转换")
        self.convert_btn.clicked.connect(self.convert_format)
        format_layout.addWidget(self.convert_btn)
        
        splitter.addWidget(format_group)
        
        editor_group = QGroupBox("转录编辑")
        editor_layout = QVBoxLayout(editor_group)
        
        self.text_editor = QTextEdit()
        self.text_editor.setPlaceholderText("在此编辑转录文本...")
        editor_layout.addWidget(self.text_editor)
        
        splitter.addWidget(editor_group)
        
        chars_table_group = QGroupBox("字符详情")
        chars_table_layout = QVBoxLayout(chars_table_group)
        
        self.chars_table = QTableWidget()
        self.chars_table.setColumnCount(5)
        self.chars_table.setHorizontalHeaderLabels(["字符", "原始", "字体", "置信度", "已校正"])
        self.chars_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        chars_table_layout.addWidget(self.chars_table)
        
        splitter.addWidget(chars_table_group)
        
        layout.addWidget(splitter)
        
        buttons_layout = QHBoxLayout()
        
        self.import_btn = QPushButton("导入")
        self.import_btn.clicked.connect(self.import_document)
        buttons_layout.addWidget(self.import_btn)
        
        self.save_btn = QPushButton("保存到档案")
        self.save_btn.clicked.connect(self.save_to_archive)
        buttons_layout.addWidget(self.save_btn)
        
        self.export_txt_btn = QPushButton("导出TXT")
        self.export_txt_btn.clicked.connect(self.export_to_txt)
        buttons_layout.addWidget(self.export_txt_btn)
        
        self.export_pdf_btn = QPushButton("导出PDF(含水印)")
        self.export_pdf_btn.clicked.connect(self.export_to_pdf_with_watermark)
        buttons_layout.addWidget(self.export_pdf_btn)
        
        self.export_json_btn = QPushButton("导出JSON")
        self.export_json_btn.clicked.connect(self.export_to_json)
        buttons_layout.addWidget(self.export_json_btn)
        
        self.export_html_btn = QPushButton("导出HTML")
        self.export_html_btn.clicked.connect(self.export_to_html)
        buttons_layout.addWidget(self.export_html_btn)
        
        layout.addLayout(buttons_layout)
        
    def load_typewriters(self):
        self.typewriter_combo.clear()
        self.typewriter_combo.addItem("未选择", None)
        
        typewriters = self.db_manager.get_all_typewriters()
        for tw in typewriters:
            self.typewriter_combo.addItem(f"{tw.brand} {tw.name}", tw.id)
            
    def load_categories(self):
        self.category_combo.clear()
        self.category_combo.addItem("未分类")
        
        categories = self.db_manager.get_all_categories()
        for cat in categories:
            self.category_combo.addItem(cat.name)
            
    def set_characters(self, characters: list):
        sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
        self.current_characters = sorted_chars
        
        text = "".join([c.get("character", "") for c in sorted_chars])
        self.text_editor.setPlainText(text)
        
        self.chars_table.setRowCount(len(sorted_chars))
        for row, char_data in enumerate(sorted_chars):
            self.chars_table.setItem(row, 0, QTableWidgetItem(char_data.get("character", "")))
            self.chars_table.setItem(row, 1, QTableWidgetItem(char_data.get("original_char", "")))
            self.chars_table.setItem(row, 2, QTableWidgetItem(char_data.get("font_type", "")))
            
            confidence = char_data.get("confidence", 0)
            try:
                confidence = float(confidence)
                confidence_str = f"{confidence:.2f}"
            except:
                confidence_str = "0.00"
            self.chars_table.setItem(row, 3, QTableWidgetItem(confidence_str))
            
            is_corrected = char_data.get("is_corrected", False)
            try:
                is_corrected = bool(is_corrected)
            except:
                is_corrected = False
            self.chars_table.setItem(row, 4, QTableWidgetItem("✓" if is_corrected else ""))
            
    def import_document(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "导入文档", "", "JSON文件 (*.json)"
        )
        if file_path:
            data = DocumentExporter.import_from_json(file_path)
            if data and "characters" in data:
                self.set_characters(data["characters"])
                metadata = data.get("metadata", {})
                self.title_edit.setText(metadata.get("title", ""))
                QMessageBox.information(self, "成功", "文档导入成功")
                
    def save_to_archive(self):
        title = self.title_edit.text().strip()
        if not title:
            QMessageBox.warning(self, "警告", "请输入文档标题")
            return
            
        typewriter_id = self.typewriter_combo.currentData()
        font_type = self.font_combo.currentText()
        category = self.category_combo.currentText()
        
        document = self.db_manager.add_document(
            title=title,
            typewriter_id=typewriter_id,
            font_type=font_type,
            category=category
        )
        
        if self.current_characters:
            self.db_manager.add_characters_to_document(document.id, self.current_characters)
            
        QMessageBox.information(self, "成功", f"文档已保存到档案 (ID: {document.id})")
        
    def export_to_txt(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出TXT", "", "文本文件 (*.txt)"
        )
        if file_path:
            text = self.text_editor.toPlainText()
            chars = [{"character": c} for c in text]
            if DocumentExporter.export_to_txt(chars, file_path):
                QMessageBox.information(self, "成功", "TXT导出成功")
                
    def export_to_pdf(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出PDF", "", "PDF文件 (*.pdf)"
        )
        if file_path:
            metadata = {
                "title": self.title_edit.text() or "打字机转录文档",
                "font_type": self.font_combo.currentText(),
                "typewriter_model": self.typewriter_combo.currentText()
            }
            chars = self.current_characters or [{"character": c} for c in self.text_editor.toPlainText()]
            if DocumentExporter.export_to_pdf(chars, file_path, metadata):
                QMessageBox.information(self, "成功", "PDF导出成功")
                
    def export_to_json(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出JSON", "", "JSON文件 (*.json)"
        )
        if file_path:
            metadata = {
                "title": self.title_edit.text() or "打字机转录文档",
                "font_type": self.font_combo.currentText(),
                "category": self.category_combo.currentText()
            }
            chars = self.current_characters or [{"character": c} for c in self.text_editor.toPlainText()]
            if DocumentExporter.export_to_json(chars, file_path, metadata):
                QMessageBox.information(self, "成功", "JSON导出成功")
                
    def export_to_html(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出HTML", "", "HTML文件 (*.html)"
        )
        if file_path:
            metadata = {
                "title": self.title_edit.text() or "打字机转录文档",
                "font_type": self.font_combo.currentText(),
                "typewriter_model": self.typewriter_combo.currentText()
            }
            chars = self.current_characters or [{"character": c} for c in self.text_editor.toPlainText()]
            if DocumentExporter.export_to_html(chars, file_path, metadata):
                QMessageBox.information(self, "成功", "HTML导出成功")
            else:
                QMessageBox.warning(self, "失败", "HTML导出失败")
                
    def export_to_pdf_with_watermark(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出PDF(含水印)", "", "PDF文件 (*.pdf)"
        )
        if file_path:
            metadata = {
                "title": self.title_edit.text() or "打字机转录文档",
                "font_type": self.font_combo.currentText(),
                "typewriter_model": self.typewriter_combo.currentText()
            }
            chars = self.current_characters or [{"character": c} for c in self.text_editor.toPlainText()]
            
            import os
            temp_path = file_path.replace('.pdf', '_temp.pdf')
            if DocumentExporter.export_to_pdf(chars, temp_path, metadata):
                opacity = self.watermark_opacity.currentData() or 0.3
                angle = self.watermark_angle.currentData() or 45
                watermark_text = self.watermark_text.text() or "打字机转录"
                
                if DocumentExporter.add_watermark_to_pdf(temp_path, file_path, watermark_text, opacity, angle):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
                    QMessageBox.information(self, "成功", "PDF(含水印)导出成功")
                else:
                    try:
                        os.rename(temp_path, file_path)
                    except:
                        pass
                    QMessageBox.information(self, "提示", "PDF导出成功(未添加水印)")
            else:
                QMessageBox.warning(self, "失败", "PDF导出失败")
                
    def auto_identify_typewriter(self):
        if not self.current_characters or len(self.current_characters) < 5:
            QMessageBox.warning(self, "提示", "需要至少5个字符才能进行型号识别，请先导入或采集更多字符")
            return
            
        from recognition.character_recognizer import CharacterRecognizer
        recognizer = CharacterRecognizer()
        
        result = recognizer.identify_typewriter_model(self.current_characters)
        
        self.identified_typewriter = result
        
        model_name = result.get('model_name', 'Unknown')
        brand = result.get('brand', 'Unknown')
        confidence = result.get('confidence', 0)
        model_type = result.get('model_type', 'Unknown')
        
        result_text = f"{brand} {model_name} ({model_type}) - 置信度: {confidence:.1%}"
        self.identification_result.setText(result_text)
        
        if confidence > 0.7:
            self.identification_result.setStyleSheet("color: #2e7d32; font-weight: bold;")
        elif confidence > 0.5:
            self.identification_result.setStyleSheet("color: #f57c00; font-weight: bold;")
        else:
            self.identification_result.setStyleSheet("color: #d32f2f; font-style: italic;")
        
        for i in range(self.typewriter_combo.count()):
            if model_name in self.typewriter_combo.itemText(i):
                self.typewriter_combo.setCurrentIndex(i)
                break
                
    def convert_format(self):
        input_path, _ = QFileDialog.getOpenFileName(
            self, "选择输入文件", "", "支持的格式 (*.txt *.json)"
        )
        if not input_path:
            return
            
        output_format = self.output_format_combo.currentText().lower()
        output_path, _ = QFileDialog.getSaveFileName(
            self, "选择输出文件", "", f"{output_format.upper()}文件 (*.{output_format})"
        )
        if not output_path:
            return
            
        input_format = None
        if self.input_format_combo.currentText() != "自动检测":
            input_format = self.input_format_combo.currentText().lower()
            
        if DocumentExporter.convert_format(input_path, output_path, input_format, output_format):
            QMessageBox.information(self, "成功", f"格式转换成功: {input_path.split('/')[-1]} → {output_format.upper()}")
        else:
            QMessageBox.warning(self, "失败", "格式转换失败")
