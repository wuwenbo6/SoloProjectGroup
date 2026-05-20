from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QTabWidget, QStatusBar, QMenuBar, QMenu, QToolBar,
                             QPushButton, QLabel, QSplitter, QFileDialog, QMessageBox)
from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtGui import QIcon, QAction

from hardware.typewriter_driver import TypewriterDriver
from capture.character_capture import CharacterCapture
from ui.capture_widget import CaptureWidget
from ui.transcription_widget import TranscriptionWidget
from ui.archive_widget import ArchiveWidget


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.driver = TypewriterDriver()
        self.capture = CharacterCapture(self.driver)
        
        self.init_ui()
        self.init_connections()
        
    def init_ui(self):
        self.setWindowTitle("打字机数字化系统")
        self.setMinimumSize(1200, 800)
        
        self.create_menu_bar()
        self.create_tool_bar()
        self.create_central_widget()
        self.create_status_bar()
        
    def create_menu_bar(self):
        menubar = self.menuBar()
        
        file_menu = menubar.addMenu("文件(&F)")
        
        import_action = QAction("导入(&I)", self)
        import_action.setShortcut("Ctrl+I")
        import_action.triggered.connect(self.import_file)
        file_menu.addAction(import_action)
        
        export_txt_action = QAction("导出TXT(&T)", self)
        export_txt_action.triggered.connect(self.export_txt)
        file_menu.addAction(export_txt_action)
        
        export_pdf_action = QAction("导出PDF(&P)", self)
        export_pdf_action.triggered.connect(self.export_pdf)
        file_menu.addAction(export_pdf_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction("退出(&X)", self)
        exit_action.setShortcut("Ctrl+Q")
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        device_menu = menubar.addMenu("设备(&D)")
        
        connect_action = QAction("连接设备(&C)", self)
        connect_action.triggered.connect(self.connect_device)
        device_menu.addAction(connect_action)
        
        disconnect_action = QAction("断开连接(&D)", self)
        disconnect_action.triggered.connect(self.disconnect_device)
        device_menu.addAction(disconnect_action)
        
        device_menu.addSeparator()
        
        settings_action = QAction("设备设置(&S)", self)
        device_menu.addAction(settings_action)
        
        help_menu = menubar.addMenu("帮助(&H)")
        
        about_action = QAction("关于(&A)", self)
        about_action.triggered.connect(self.show_about)
        help_menu.addAction(about_action)
        
    def create_tool_bar(self):
        toolbar = QToolBar("主工具栏")
        toolbar.setMovable(False)
        self.addToolBar(toolbar)
        
        connect_btn = QPushButton("连接设备")
        connect_btn.clicked.connect(self.connect_device)
        toolbar.addWidget(connect_btn)
        
        toolbar.addSeparator()
        
        start_capture_btn = QPushButton("开始采集")
        start_capture_btn.clicked.connect(self.start_capture)
        toolbar.addWidget(start_capture_btn)
        
        stop_capture_btn = QPushButton("停止采集")
        stop_capture_btn.clicked.connect(self.stop_capture)
        toolbar.addWidget(stop_capture_btn)
        
        toolbar.addSeparator()
        
        calibrate_btn = QPushButton("字符校正")
        calibrate_btn.clicked.connect(self.calibrate)
        toolbar.addWidget(calibrate_btn)
        
        export_btn = QPushButton("批量导出")
        export_btn.clicked.connect(self.batch_export)
        toolbar.addWidget(export_btn)
        
    def create_central_widget(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QHBoxLayout(central_widget)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        self.tab_widget = QTabWidget()
        
        self.capture_widget = CaptureWidget(self.capture)
        self.tab_widget.addTab(self.capture_widget, "实时采集")
        
        self.transcription_widget = TranscriptionWidget()
        self.tab_widget.addTab(self.transcription_widget, "转录编辑")
        
        self.archive_widget = ArchiveWidget()
        self.tab_widget.addTab(self.archive_widget, "档案管理")
        
        splitter.addWidget(self.tab_widget)
        splitter.setStretchFactor(0, 3)
        
        main_layout.addWidget(splitter)
        
    def create_status_bar(self):
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        
        self.status_label = QLabel("就绪")
        self.status_bar.addWidget(self.status_label)
        
        self.device_status_label = QLabel("设备: 未连接")
        self.status_bar.addPermanentWidget(self.device_status_label)
        
    def init_connections(self):
        self.driver.connection_status_changed.connect(self.on_connection_status_changed)
        self.capture.character_captured.connect(self.on_character_captured)
        
    def connect_device(self):
        self.capture_widget.show_connection_dialog()
        
    def disconnect_device(self):
        self.driver.disconnect()
        
    def on_connection_status_changed(self, connected, device_name):
        if connected:
            self.device_status_label.setText(f"设备: {device_name}")
            self.status_label.setText("设备已连接")
        else:
            self.device_status_label.setText("设备: 未连接")
            self.status_label.setText("设备已断开")
            
    def on_character_captured(self, char_data):
        self.status_label.setText(f"采集字符: {char_data.get('character', '?')}")
        
    def start_capture(self):
        if self.driver.is_connected():
            self.capture.start_capture()
            self.status_label.setText("采集中...")
        else:
            QMessageBox.warning(self, "警告", "请先连接设备")
            
    def stop_capture(self):
        self.capture.stop_capture()
        self.status_label.setText("采集已停止")
        
    def calibrate(self):
        self.capture_widget.show_calibration_dialog()
        
    def import_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "导入文件", "", "所有文件 (*.*)"
        )
        if file_path:
            self.status_label.setText(f"已导入: {file_path}")
            
    def export_txt(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出TXT", "", "文本文件 (*.txt)"
        )
        if file_path:
            self.status_label.setText(f"已导出: {file_path}")
            
    def export_pdf(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出PDF", "", "PDF文件 (*.pdf)"
        )
        if file_path:
            self.status_label.setText(f"已导出: {file_path}")
            
    def batch_export(self):
        self.status_label.setText("批量导出中...")
        
    def show_about(self):
        QMessageBox.about(
            self, "关于",
            "打字机数字化系统 v1.0.0\n\n"
            "专为老式打字机数字化场景开发\n"
            "支持机械/电动打字机USB/串口连接"
        )
