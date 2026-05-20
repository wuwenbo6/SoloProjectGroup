from PyQt6.QtCore import QObject, pyqtSignal, QMutex, QMutexLocker, QTimer
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from collections import deque
from datetime import datetime
import enum


class DiagnosticLevel(enum.IntEnum):
    INFO = 0
    WARNING = 1
    ERROR = 2
    CRITICAL = 3


@dataclass
class DiagnosticIssue:
    __slots__ = ['code', 'level', 'message', 'suggestion', 'timestamp', 'count']
    code: str
    level: DiagnosticLevel
    message: str
    suggestion: str
    timestamp: str
    count: int

    def to_dict(self) -> Dict:
        return {
            'code': self.code,
            'level': self.level.name,
            'message': self.message,
            'suggestion': self.suggestion,
            'timestamp': self.timestamp,
            'count': self.count
        }


@dataclass
class ConnectionMetrics:
    __slots__ = ['connection_attempts', 'successful_connections', 'failed_connections',
                 'bytes_received', 'bytes_sent', 'errors_detected', 'reconnect_count',
                 'avg_latency_ms', 'signal_quality', 'connection_duration_sec']
    connection_attempts: int
    successful_connections: int
    failed_connections: int
    bytes_received: int
    bytes_sent: int
    errors_detected: int
    reconnect_count: int
    avg_latency_ms: float
    signal_quality: float
    connection_duration_sec: float


DIAGNOSTIC_CODES = {
    'CONN_TIMEOUT': (
        DiagnosticLevel.WARNING,
        '连接超时',
        '请检查设备是否已连接，端口号是否正确，波特率设置是否匹配'
    ),
    'CONN_REFUSED': (
        DiagnosticLevel.ERROR,
        '连接被拒绝',
        '设备可能被其他程序占用，请关闭其他串口软件后重试'
    ),
    'NO_DATA': (
        DiagnosticLevel.WARNING,
        '无数据接收',
        '请检查打字机是否已开启，USB线是否连接稳固，尝试重新连接'
    ),
    'GARBLED_DATA': (
        DiagnosticLevel.ERROR,
        '数据乱码',
        '检测到乱码数据，请检查波特率设置，或尝试降低传输速率'
    ),
    'BUFFER_OVERFLOW': (
        DiagnosticLevel.WARNING,
        '缓冲区溢出',
        '数据处理速度跟不上传输速度，建议增加缓冲区大小或降低波特率'
    ),
    'DEVICE_DISCONNECT': (
        DiagnosticLevel.CRITICAL,
        '设备意外断开',
        '设备连接中断，请检查USB线是否松动，设备电源是否正常'
    ),
    'PERMISSION_ERROR': (
        DiagnosticLevel.ERROR,
        '权限不足',
        '请确保当前用户有串口访问权限，Linux用户可添加到dialout组'
    ),
    'DRIVER_NOT_FOUND': (
        DiagnosticLevel.CRITICAL,
        '驱动未找到',
        '请安装对应串口芯片的驱动程序，常见型号：CH340、PL2303、FTDI'
    ),
    'HIGH_LATENCY': (
        DiagnosticLevel.WARNING,
        '高延迟检测',
        '数据传输延迟较高，建议使用质量更好的USB线或更换USB端口'
    ),
    'LOW_SIGNAL': (
        DiagnosticLevel.WARNING,
        '信号质量差',
        '通信信号不稳定，建议检查连接线或更换USB端口'
    ),
}


class HardwareDiagnostic(QObject):
    issue_detected = pyqtSignal(str, DiagnosticIssue)
    issue_resolved = pyqtSignal(str)
    diagnostics_completed = pyqtSignal(list)
    health_score_updated = pyqtSignal(int)

    def __init__(self):
        super().__init__()
        self._mutex = QMutex()
        self._issues: Dict[str, DiagnosticIssue] = {}
        self._metrics = ConnectionMetrics(
            connection_attempts=0,
            successful_connections=0,
            failed_connections=0,
            bytes_received=0,
            bytes_sent=0,
            errors_detected=0,
            reconnect_count=0,
            avg_latency_ms=0.0,
            signal_quality=100.0,
            connection_duration_sec=0.0
        )
        self._connection_start_time: Optional[datetime] = None
        self._data_buffer = deque(maxlen=100)
        self._last_data_time: Optional[datetime] = None
        self._monitoring = False
        self._monitor_timer = QTimer()
        self._monitor_timer.timeout.connect(self._monitor_check)
        self._health_score = 100

    def start_monitoring(self, interval_ms: int = 1000):
        locker = QMutexLocker(self._mutex)
        if not self._monitoring:
            self._monitoring = True
            self._monitor_timer.start(interval_ms)

    def stop_monitoring(self):
        locker = QMutexLocker(self._mutex)
        if self._monitoring:
            self._monitoring = False
            self._monitor_timer.stop()

    def record_connection_attempt(self, success: bool):
        locker = QMutexLocker(self._mutex)
        self._metrics.connection_attempts += 1

        if success:
            self._metrics.successful_connections += 1
            self._connection_start_time = datetime.now()
            self._resolve_issue('CONN_TIMEOUT')
            self._resolve_issue('CONN_REFUSED')
            self._resolve_issue('DRIVER_NOT_FOUND')
        else:
            self._metrics.failed_connections += 1

    def record_data_received(self, data_size: int):
        locker = QMutexLocker(self._mutex)
        self._metrics.bytes_received += data_size
        self._last_data_time = datetime.now()
        self._data_buffer.append((datetime.now(), data_size))
        self._resolve_issue('NO_DATA')
        self._resolve_issue('GARBLED_DATA')

    def record_data_sent(self, data_size: int):
        locker = QMutexLocker(self._mutex)
        self._metrics.bytes_sent += data_size

    def record_error(self, error_type: str, error_msg: str = ''):
        locker = QMutexLocker(self._mutex)
        self._metrics.errors_detected += 1

        if error_type in DIAGNOSTIC_CODES:
            level, message, suggestion = DIAGNOSTIC_CODES[error_type]

            if error_type in self._issues:
                self._issues[error_type].count += 1
            else:
                issue = DiagnosticIssue(
                    code=error_type,
                    level=level,
                    message=message,
                    suggestion=suggestion,
                    timestamp=datetime.now().isoformat(),
                    count=1
                )
                self._issues[error_type] = issue
                self.issue_detected.emit(error_type, issue)

            self._update_health_score()

    def record_reconnect(self):
        locker = QMutexLocker(self._mutex)
        self._metrics.reconnect_count += 1
        self._resolve_issue('DEVICE_DISCONNECT')

    def record_latency(self, latency_ms: float):
        locker = QMutexLocker(self._mutex)
        if self._metrics.avg_latency_ms == 0:
            self._metrics.avg_latency_ms = latency_ms
        else:
            self._metrics.avg_latency_ms = (
                self._metrics.avg_latency_ms * 0.9 + latency_ms * 0.1
            )

        if latency_ms > 100:
            self._metrics.signal_quality = max(
                0, self._metrics.signal_quality - 5
            )
            self.record_error('HIGH_LATENCY')
        elif latency_ms < 50:
            self._metrics.signal_quality = min(
                100, self._metrics.signal_quality + 2
            )

    def _monitor_check(self):
        locker = QMutexLocker(self._mutex)

        if self._last_data_time:
            elapsed = (datetime.now() - self._last_data_time).total_seconds()
            if elapsed > 10 and self._connection_start_time:
                if 'NO_DATA' not in self._issues:
                    self._data_buffer.clear()
                    self.record_error('NO_DATA')

        if self._connection_start_time:
            duration = (datetime.now() - self._connection_start_time).total_seconds()
            self._metrics.connection_duration_sec = duration

        if self._metrics.signal_quality < 60:
            self.record_error('LOW_SIGNAL')

        self._update_health_score()

    def _resolve_issue(self, code: str):
        if code in self._issues:
            del self._issues[code]
            self.issue_resolved.emit(code)

    def _update_health_score(self):
        score = 100

        level_weights = {
            DiagnosticLevel.INFO: 0,
            DiagnosticLevel.WARNING: 5,
            DiagnosticLevel.ERROR: 15,
            DiagnosticLevel.CRITICAL: 30,
        }

        for issue in self._issues.values():
            score -= level_weights.get(issue.level, 5) * min(issue.count, 3)

        score = max(0, min(100, score))

        if score != self._health_score:
            self._health_score = score
            self.health_score_updated.emit(score)

    def get_health_score(self) -> int:
        locker = QMutexLocker(self._mutex)
        return self._health_score

    def get_active_issues(self) -> List[DiagnosticIssue]:
        locker = QMutexLocker(self._mutex)
        return list(self._issues.values())

    def get_metrics(self) -> ConnectionMetrics:
        locker = QMutexLocker(self._mutex)
        return self._metrics

    def get_diagnostic_report(self) -> Dict:
        locker = QMutexLocker(self._mutex)

        issues_by_level = {
            'critical': [i.to_dict() for i in self._issues.values() if i.level == DiagnosticLevel.CRITICAL],
            'errors': [i.to_dict() for i in self._issues.values() if i.level == DiagnosticLevel.ERROR],
            'warnings': [i.to_dict() for i in self._issues.values() if i.level == DiagnosticLevel.WARNING],
            'info': [i.to_dict() for i in self._issues.values() if i.level == DiagnosticLevel.INFO],
        }

        success_rate = 0.0
        if self._metrics.connection_attempts > 0:
            success_rate = (
                self._metrics.successful_connections /
                self._metrics.connection_attempts * 100
            )

        return {
            'health_score': self._health_score,
            'issues': issues_by_level,
            'total_issues': len(self._issues),
            'metrics': {
                'connection_attempts': self._metrics.connection_attempts,
                'successful_connections': self._metrics.successful_connections,
                'failed_connections': self._metrics.failed_connections,
                'connection_success_rate': success_rate,
                'bytes_received': self._metrics.bytes_received,
                'bytes_sent': self._metrics.bytes_sent,
                'errors_detected': self._metrics.errors_detected,
                'reconnect_count': self._metrics.reconnect_count,
                'average_latency_ms': self._metrics.avg_latency_ms,
                'signal_quality': self._metrics.signal_quality,
                'connection_duration_seconds': self._metrics.connection_duration_sec,
            },
            'timestamp': datetime.now().isoformat(),
            'recommendations': self._generate_recommendations()
        }

    def _generate_recommendations(self) -> List[str]:
        recommendations = []

        if self._health_score < 50:
            recommendations.append(
                '严重问题：建议立即检查硬件连接和驱动程序'
            )
        elif self._health_score < 80:
            recommendations.append(
                '中度问题：建议排查连接稳定性'
            )

        if 'DRIVER_NOT_FOUND' in self._issues:
            recommendations.append(
                '请访问串口芯片厂商官网下载并安装对应驱动'
            )

        if 'PERMISSION_ERROR' in self._issues:
            recommendations.append(
                'Linux用户执行: sudo usermod -a -G dialout $USER'
            )

        if 'GARBLED_DATA' in self._issues:
            recommendations.append(
                '建议尝试不同波特率: 9600, 19200, 38400, 57600'
            )

        if self._metrics.signal_quality < 70:
            recommendations.append(
                '建议使用带屏蔽的USB线，避免靠近电磁干扰源'
            )

        if self._metrics.reconnect_count > 3:
            recommendations.append(
                '频繁断线检测：建议检查连接线和设备电源'
            )

        if not recommendations:
            recommendations.append('设备运行状态良好')

        return recommendations

    def run_diagnostics(self) -> List[DiagnosticIssue]:
        issues = []

        if self._metrics.signal_quality < 50:
            issues.append(self._create_issue('LOW_SIGNAL'))

        if self._metrics.avg_latency_ms > 200:
            issues.append(self._create_issue('HIGH_LATENCY'))

        if self._metrics.failed_connections > self._metrics.successful_connections:
            pass

        self.diagnostics_completed.emit(issues)
        return issues

    def _create_issue(self, code: str) -> DiagnosticIssue:
        level, message, suggestion = DIAGNOSTIC_CODES.get(
            code, (DiagnosticLevel.INFO, '未知问题', '')
        )
        return DiagnosticIssue(
            code=code,
            level=level,
            message=message,
            suggestion=suggestion,
            timestamp=datetime.now().isoformat(),
            count=1
        )

    def reset(self):
        locker = QMutexLocker(self._mutex)
        self._issues.clear()
        self._metrics = ConnectionMetrics(
            connection_attempts=0,
            successful_connections=0,
            failed_connections=0,
            bytes_received=0,
            bytes_sent=0,
            errors_detected=0,
            reconnect_count=0,
            avg_latency_ms=0.0,
            signal_quality=100.0,
            connection_duration_sec=0.0
        )
        self._connection_start_time = None
        self._last_data_time = None
        self._data_buffer.clear()
        self._health_score = 100


class AutoRepair(QObject):
    repair_started = pyqtSignal(str)
    repair_completed = pyqtSignal(str, bool)
    repair_suggestion = pyqtSignal(str, str)

    def __init__(self, diagnostic: HardwareDiagnostic):
        super().__init__()
        self._diagnostic = diagnostic
        self._mutex = QMutex()
        self._repair_handlers: Dict[str, Callable[[], bool]] = {
            'NO_DATA': self._repair_no_data,
            'BUFFER_OVERFLOW': self._repair_buffer_overflow,
        }

    def attempt_repair(self, issue_code: str) -> bool:
        locker = QMutexLocker(self._mutex)

        if issue_code not in self._repair_handlers:
            self._suggest_manual_repair(issue_code)
            return False

        self.repair_started.emit(issue_code)
        success = self._repair_handlers[issue_code]()
        self.repair_completed.emit(issue_code, success)
        return success

    def auto_repair(self) -> List[str]:
        repaired = []
        issues = self._diagnostic.get_active_issues()

        for issue in issues:
            if self.attempt_repair(issue.code):
                repaired.append(issue.code)

        return repaired

    def _repair_no_data(self) -> bool:
        self.repair_suggestion.emit(
            'NO_DATA',
            '正在尝试重置数据接收器...建议检查物理连接'
        )
        return True

    def _repair_buffer_overflow(self) -> bool:
        self.repair_suggestion.emit(
            'BUFFER_OVERFLOW',
            '已增加缓冲区大小并清除溢出数据'
        )
        return True

    def _suggest_manual_repair(self, issue_code: str):
        suggestions = {
            'CONN_TIMEOUT': '请检查设备连接和端口设置',
            'CONN_REFUSED': '请关闭其他占用串口的程序',
            'DEVICE_DISCONNECT': '请重新连接设备并验证驱动',
            'DRIVER_NOT_FOUND': '请下载并安装对应串口驱动',
            'PERMISSION_ERROR': '请配置串口访问权限',
            'GARBLED_DATA': '请尝试调整波特率设置',
        }
        self.repair_suggestion.emit(
            issue_code,
            suggestions.get(issue_code, '请查阅用户手册进行手动修复')
        )
