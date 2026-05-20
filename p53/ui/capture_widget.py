from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                             QPushButton, QListWidget, QListWidgetItem, 
                             QDialog, QFormLayout, QComboBox, QDialogButtonBox,
                             QGroupBox, QProgressBar, QTextEdit, QSplitter)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QImage, QPixmap
import numpy as np

from hardware.typewriter_driver import TypewriterDriver


class CaptureWidget(QWidget):
    def __init__(self, capture):
        super().__init__()
        self.capture = capture
        self.init_ui()
        self.init_connections()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        splitter = QSplitter(Qt.Orientation.Vertical)
        
        preview_group = QGroupBox("实时预览")
        preview_layout = QVBoxLayout(preview_group)
        
        self.preview_label = QLabel("等待采集...")
        self.preview_label.setMinimumSize(400, 200)
        self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_label.setStyleSheet("background-color: #f0f0f0; border: 1px solid #ccc;")
        preview_layout.addWidget(self.preview_label)
        
        self.text_preview = QTextEdit()
        self.text_preview.setReadOnly(True)
        self.text_preview.setMaximumHeight(150)
        self.text_preview.setPlaceholderText("采集的文字将显示在这里...")
        preview_layout.addWidget(self.text_preview)
        
        splitter.addWidget(preview_group)
        
        chars_group = QGroupBox("字符列表")
        chars_layout = QVBoxLayout(chars_group)
        
        self.chars_list = QListWidget()
        chars_layout.addWidget(self.chars_list)
        
        splitter.addWidget(chars_group)
        
        stats_group = QGroupBox("统计信息")
        stats_layout = QFormLayout(stats_group)
        
        self.total_chars_label = QLabel("0")
        self.corrected_chars_label = QLabel("0")
        self.confidence_label = QLabel("0.0")
        self.font_type_label = QLabel("unknown")
        
        stats_layout.addRow("总字符数:", self.total_chars_label)
        stats_layout.addRow("已校正:", self.corrected_chars_label)
        stats_layout.addRow("平均置信度:", self.confidence_label)
        stats_layout.addRow("字体类型:", self.font_type_label)
        
        splitter.addWidget(stats_group)
        
        layout.addWidget(splitter)
        
        controls_layout = QHBoxLayout()
        
        self.correct_btn = QPushButton("校正字符")
        self.correct_btn.clicked.connect(self.correct_selected)
        controls_layout.addWidget(self.correct_btn)
        
        self.clear_btn = QPushButton("清空")
        self.clear_btn.clicked.connect(self.clear_all)
        controls_layout.addWidget(self.clear_btn)
        
        layout.addLayout(controls_layout)
        
    def init_connections(self):
        self.capture.character_captured.connect(self.on_character_captured)
        
    def on_character_captured(self, char_data):
        char = char_data.get("character", "?")
        confidence = char_data.get("confidence", 0)
        font_type = char_data.get("font_type", "unknown")
        
        item_text = f"{char}  (置信度: {confidence:.2f}, 字体: {font_type})"
        item = QListWidgetItem(item_text)
        
        if confidence < 0.5:
            item.setBackground(Qt.GlobalColor.red)
        elif confidence < 0.7:
            item.setBackground(Qt.GlobalColor.yellow)
            
        self.chars_list.addItem(item)
        self.chars_list.scrollToBottom()
        
        current_text = self.text_preview.toPlainText()
        self.text_preview.setPlainText(current_text + char)
        
        self.update_stats()
        
    def update_stats(self):
        stats = self.capture.get_statistics()
        self.total_chars_label.setText(str(stats["total_characters"]))
        self.corrected_chars_label.setText(str(stats["corrected_characters"]))
        self.confidence_label.setText(f"{stats['average_confidence']:.2f}")
        
        if stats["font_types"]:
            self.font_type_label.setText(", ".join(stats["font_types"]))
            
    def correct_selected(self):
        current_row = self.chars_list.currentRow()
        if current_row < 0:
            return
            
        dialog = CorrectionDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            corrected_char = dialog.get_corrected_char()
            if corrected_char:
                self.capture.correct_character(current_row, corrected_char)
                item = self.chars_list.item(current_row)
                item.setText(f"{corrected_char} (已校正)")
                item.setBackground(Qt.GlobalColor.green)
                self.update_stats()
                
    def clear_all(self):
        self.chars_list.clear()
        self.text_preview.clear()
        self.capture.clear_current_document()
        self.update_stats()
        
    def show_connection_dialog(self):
        dialog = ConnectionDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            port = dialog.get_selected_port()
            baudrate = dialog.get_baudrate()
            self.capture.driver.connect(port, baudrate)
            
    def show_calibration_dialog(self):
        dialog = CalibrationDialog(self)
        dialog.exec()


class ConnectionDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("连接设备")
        self.init_ui()
        
    def init_ui(self):
        layout = QFormLayout(self)
        
        self.port_combo = QComboBox()
        ports = TypewriterDriver.get_available_ports()
        for port in ports:
            self.port_combo.addItem(f"{port['device']} - {port['description']}", port['device'])
            
        if not ports:
            self.port_combo.addItem("未找到可用端口")
            
        layout.addRow("端口:", self.port_combo)
        
        self.baudrate_combo = QComboBox()
        for rate in [9600, 19200, 38400, 57600, 115200]:
            self.baudrate_combo.addItem(str(rate), rate)
        self.baudrate_combo.setCurrentText("9600")
        
        layout.addRow("波特率:", self.baudrate_combo)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)
        
    def get_selected_port(self) -> str:
        return self.port_combo.currentData() or ""
        
    def get_baudrate(self) -> int:
        return self.baudrate_combo.currentData() or 9600


class CorrectionDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("校正字符")
        self.init_ui()
        
    def init_ui(self):
        layout = QFormLayout(self)
        
        self.char_combo = QComboBox()
        for char in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?'- ":
            self.char_combo.addItem(char)
            
        layout.addRow("校正为:", self.char_combo)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addRow(buttons)
        
    def get_corrected_char(self) -> str:
        return self.char_combo.currentText()


class CalibrationDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("字符校正")
        self.setMinimumSize(500, 400)
        self.init_ui()
        
    def init_ui(self):
        layout = QVBoxLayout(self)
        
        instruction = QLabel(
            "请在打字机上依次输入以下字符进行校正:\n\n"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ\n"
            "abcdefghijklmnopqrstuvwxyz\n"
            "0123456789 .,!?'-"
        )
        instruction.setWordWrap(True)
        layout.addWidget(instruction)
        
        self.progress = QProgressBar()
        layout.addWidget(self.progress)
        
        self.result_label = QLabel("准备进行校正...")
        layout.addWidget(self.result_label)
        
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
