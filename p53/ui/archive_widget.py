from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, 
                             QTableWidgetItem, QPushButton, QGroupBox, QLabel,
                             QLineEdit, QFormLayout, QMessageBox, QSplitter,
                             QHeaderView, QDialog, QTextEdit, QComboBox)
from PyQt6.QtCore import Qt

from database.models import DatabaseManager


class ArchiveWidget(QWidget):
    def __init__(self):
        super().__init__()
        self.db_manager = DatabaseManager()
        self.init_ui()
        self.load_documents()
        self.load_statistics()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        splitter = QSplitter(Qt.Orientation.Vertical)
        
        stats_group = QGroupBox("统计信息")
        stats_layout = QFormLayout(stats_group)
        
        self.total_docs_label = QLabel("0")
        self.total_chars_label = QLabel("0")
        self.total_typewriters_label = QLabel("0")
        
        stats_layout.addRow("总文档数:", self.total_docs_label)
        stats_layout.addRow("总字符数:", self.total_chars_label)
        stats_layout.addRow("打字机型号数:", self.total_typewriters_label)
        
        splitter.addWidget(stats_group)
        
        search_group = QGroupBox("搜索")
        search_layout = QHBoxLayout(search_group)
        
        self.search_edit = QLineEdit()
        self.search_edit.setPlaceholderText("输入关键词搜索文档...")
        search_layout.addWidget(self.search_edit)
        
        self.search_btn = QPushButton("搜索")
        self.search_btn.clicked.connect(self.search_documents)
        search_layout.addWidget(self.search_btn)
        
        self.refresh_btn = QPushButton("刷新")
        self.refresh_btn.clicked.connect(self.load_documents)
        search_layout.addWidget(self.refresh_btn)
        
        splitter.addWidget(search_group)
        
        docs_group = QGroupBox("文档列表")
        docs_layout = QVBoxLayout(docs_group)
        
        self.docs_table = QTableWidget()
        self.docs_table.setColumnCount(7)
        self.docs_table.setHorizontalHeaderLabels([
            "ID", "标题", "字体", "字符数", "已校正", "分类", "创建时间"
        ])
        self.docs_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.docs_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        docs_layout.addWidget(self.docs_table)
        
        splitter.addWidget(docs_group)
        
        layout.addWidget(splitter)
        
        buttons_layout = QHBoxLayout()
        
        self.add_typewriter_btn = QPushButton("添加打字机")
        self.add_typewriter_btn.clicked.connect(self.show_add_typewriter_dialog)
        buttons_layout.addWidget(self.add_typewriter_btn)
        
        self.view_btn = QPushButton("查看详情")
        self.view_btn.clicked.connect(self.view_document)
        buttons_layout.addWidget(self.view_btn)
        
        self.delete_btn = QPushButton("删除文档")
        self.delete_btn.clicked.connect(self.delete_document)
        buttons_layout.addWidget(self.delete_btn)
        
        layout.addLayout(buttons_layout)
        
    def load_statistics(self):
        stats = self.db_manager.get_statistics()
        self.total_docs_label.setText(str(stats["total_documents"]))
        self.total_chars_label.setText(str(stats["total_characters"]))
        self.total_typewriters_label.setText(str(stats["total_typewriters"]))
        
    def load_documents(self):
        documents = self.db_manager.get_all_documents()
        self.docs_table.setRowCount(len(documents))
        
        for row, doc in enumerate(documents):
            self.docs_table.setItem(row, 0, QTableWidgetItem(str(doc.id)))
            self.docs_table.setItem(row, 1, QTableWidgetItem(doc.title))
            self.docs_table.setItem(row, 2, QTableWidgetItem(doc.font_type or ""))
            self.docs_table.setItem(row, 3, QTableWidgetItem(str(doc.character_count)))
            self.docs_table.setItem(row, 4, QTableWidgetItem(str(doc.corrected_count)))
            self.docs_table.setItem(row, 5, QTableWidgetItem(doc.category or ""))
            self.docs_table.setItem(row, 6, QTableWidgetItem(doc.created_at.strftime("%Y-%m-%d %H:%M") if doc.created_at else ""))
            
    def search_documents(self):
        keyword = self.search_edit.text().strip()
        if keyword:
            documents = self.db_manager.search_documents(keyword)
            self.docs_table.setRowCount(len(documents))
            
            for row, doc in enumerate(documents):
                self.docs_table.setItem(row, 0, QTableWidgetItem(str(doc.id)))
                self.docs_table.setItem(row, 1, QTableWidgetItem(doc.title))
                self.docs_table.setItem(row, 2, QTableWidgetItem(doc.font_type or ""))
                self.docs_table.setItem(row, 3, QTableWidgetItem(str(doc.character_count)))
                self.docs_table.setItem(row, 4, QTableWidgetItem(str(doc.corrected_count)))
                self.docs_table.setItem(row, 5, QTableWidgetItem(doc.category or ""))
                self.docs_table.setItem(row, 6, QTableWidgetItem(doc.created_at.strftime("%Y-%m-%d %H:%M") if doc.created_at else ""))
        else:
            self.load_documents()
            
    def view_document(self):
        selected_rows = self.docs_table.selectedItems()
        if not selected_rows:
            QMessageBox.warning(self, "警告", "请选择一个文档")
            return
            
        doc_id = int(self.docs_table.item(selected_rows[0].row(), 0).text())
        doc = self.db_manager.get_document_by_id(doc_id)
        chars = self.db_manager.get_characters_by_document(doc_id)
        
        dialog = DocumentDetailDialog(doc, chars, self)
        dialog.exec()
        
    def delete_document(self):
        selected_rows = self.docs_table.selectedItems()
        if not selected_rows:
            QMessageBox.warning(self, "警告", "请选择一个文档")
            return
            
        reply = QMessageBox.question(
            self, "确认删除", "确定要删除这个文档吗？此操作不可撤销。",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.Yes:
            doc_id = int(self.docs_table.item(selected_rows[0].row(), 0).text())
            self.db_manager.delete_document(doc_id)
            self.load_documents()
            self.load_statistics()
            QMessageBox.information(self, "成功", "文档已删除")
            
    def show_add_typewriter_dialog(self):
        dialog = AddTypewriterDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            data = dialog.get_data()
            self.db_manager.add_typewriter(**data)
            self.load_statistics()
            QMessageBox.information(self, "成功", "打字机型号已添加")


class DocumentDetailDialog(QDialog):
    def __init__(self, document, characters, parent=None):
        super().__init__(parent)
        self.document = document
        self.characters = characters
        self.setWindowTitle(f"文档详情: {document.title}")
        self.setMinimumSize(800, 600)
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        info_group = QGroupBox("基本信息")
        info_layout = QFormLayout(info_group)
        
        info_layout.addRow("ID:", QLabel(str(self.document.id)))
        info_layout.addRow("标题:", QLabel(self.document.title))
        info_layout.addRow("字体类型:", QLabel(self.document.font_type or ""))
        info_layout.addRow("分类:", QLabel(self.document.category or ""))
        info_layout.addRow("字符数:", QLabel(str(self.document.character_count)))
        info_layout.addRow("已校正:", QLabel(str(self.document.corrected_count)))
        
        layout.addWidget(info_group)
        
        content_group = QGroupBox("文档内容")
        content_layout = QVBoxLayout(content_group)
        
        text = "".join([c.character for c in self.characters])
        text_edit = QTextEdit(text)
        text_edit.setReadOnly(True)
        content_layout.addWidget(text_edit)
        
        layout.addWidget(content_group)
        
        buttons = QPushButton("关闭")
        buttons.clicked.connect(self.accept)
        layout.addWidget(buttons)


class AddTypewriterDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("添加打字机型号")
        self.init_ui()
        
    def init_ui(self):
        layout = QFormLayout(self)
        
        self.name_edit = QLineEdit()
        layout.addRow("型号名称:", self.name_edit)
        
        self.brand_edit = QLineEdit()
        layout.addRow("品牌:", self.brand_edit)
        
        self.type_combo = QComboBox()
        self.type_combo.addItems(["机械打字机", "电动打字机", "电子打字机", "其他"])
        layout.addRow("类型:", self.type_combo)
        
        self.font_edit = QLineEdit()
        layout.addRow("默认字体:", self.font_edit)
        
        self.year_edit = QLineEdit()
        layout.addRow("年份:", self.year_edit)
        
        self.desc_edit = QTextEdit()
        self.desc_edit.setMaximumHeight(100)
        layout.addRow("描述:", self.desc_edit)
        
        buttons_layout = QHBoxLayout()
        
        ok_btn = QPushButton("确定")
        ok_btn.clicked.connect(self.accept)
        buttons_layout.addWidget(ok_btn)
        
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        buttons_layout.addWidget(cancel_btn)
        
        layout.addRow(buttons_layout)
        
    def get_data(self) -> dict:
        return {
            "name": self.name_edit.text().strip(),
            "brand": self.brand_edit.text().strip(),
            "model_type": self.type_combo.currentText(),
            "font_type": self.font_edit.text().strip(),
            "year": int(self.year_edit.text()) if self.year_edit.text().isdigit() else None,
            "description": self.desc_edit.toPlainText().strip()
        }
