import threading
import time
import psutil
import logging
from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass, asdict
from datetime import datetime
from collections import deque
from enum import Enum
import json

from .common import SingletonMeta, event_bus, get_platform_info

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SeverityLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class DiagnosticCategory(Enum):
    HARDWARE = "hardware"
    CONNECTION = "connection"
    PERFORMANCE = "performance"
    MEMORY = "memory"
    STORAGE = "storage"
    DRIVER = "driver"
    SYSTEM = "system"


@dataclass
class DiagnosticIssue:
    id: str
    category: DiagnosticCategory
    severity: SeverityLevel
    title: str
    message: str
    suggestion: Optional[str] = None
    timestamp: datetime = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['category'] = self.category.value
        data['severity'] = self.severity.value
        return data


@dataclass
class SystemMetrics:
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    memory_available_mb: float
    disk_usage: float
    disk_free_mb: float
    network_io: Optional[Dict[str, float]] = None
    process_count: int = 0
    thread_count: int = 0


class DiagnosticRule:
    def __init__(self,
                 rule_id: str,
                 category: DiagnosticCategory,
                 severity: SeverityLevel,
                 check_func: Callable[[], Optional[DiagnosticIssue]],
                 interval: int = 60):
        self.rule_id = rule_id
        self.category = category
        self.severity = severity
        self.check_func = check_func
        self.interval = interval
        self.last_check: Optional[float] = None


class DiagnosticsEngine(metaclass=SingletonMeta):
    def __init__(self):
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._issues: Dict[str, DiagnosticIssue] = {}
        self._issue_history: deque = deque(maxlen=500)
        self._metrics_history: deque = deque(maxlen=1000)
        self._rules: List[DiagnosticRule] = []
        self._check_interval: int = 5
        self._platform_info = get_platform_info()
        self._initialized = False
        self._listeners: List[Callable] = []

    def initialize(self):
        if self._initialized:
            return

        self._register_default_rules()
        self._initialized = True
        logger.info("硬件诊断引擎初始化完成")

    def _register_default_rules(self):
        self.add_rule(DiagnosticRule(
            rule_id="cpu_high_usage",
            category=DiagnosticCategory.PERFORMANCE,
            severity=SeverityLevel.WARNING,
            check_func=self._check_cpu_usage,
            interval=10
        ))

        self.add_rule(DiagnosticRule(
            rule_id="memory_high_usage",
            category=DiagnosticCategory.MEMORY,
            severity=SeverityLevel.WARNING,
            check_func=self._check_memory_usage,
            interval=10
        ))

        self.add_rule(DiagnosticRule(
            rule_id="disk_low_space",
            category=DiagnosticCategory.STORAGE,
            severity=SeverityLevel.WARNING,
            check_func=self._check_disk_space,
            interval=60
        ))

        self.add_rule(DiagnosticRule(
            rule_id="memory_critical",
            category=DiagnosticCategory.MEMORY,
            severity=SeverityLevel.CRITICAL,
            check_func=self._check_memory_critical,
            interval=5
        ))

        self.add_rule(DiagnosticRule(
            rule_id="system_load",
            category=DiagnosticCategory.SYSTEM,
            severity=SeverityLevel.ERROR,
            check_func=self._check_system_load,
            interval=30
        ))

        self.add_rule(DiagnosticRule(
            rule_id="disk_critical",
            category=DiagnosticCategory.STORAGE,
            severity=SeverityLevel.CRITICAL,
            check_func=self._check_disk_critical,
            interval=30
        ))

    def add_rule(self, rule: DiagnosticRule):
        with self._lock:
            self._rules.append(rule)

    def remove_rule(self, rule_id: str):
        with self._lock:
            self._rules = [r for r in self._rules if r.rule_id != rule_id]

    def start_monitoring(self):
        if self._running:
            return

        if not self._initialized:
            self.initialize()

        self._running = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_worker,
            daemon=True,
            name="DiagnosticsMonitor"
        )
        self._monitor_thread.start()
        logger.info("硬件诊断监控已启动")

    def stop_monitoring(self):
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=10)
        logger.info("硬件诊断监控已停止")

    def _monitor_worker(self):
        while self._running:
            try:
                current_time = time.time()

                for rule in self._rules:
                    if (rule.last_check is None or
                            current_time - rule.last_check >= rule.interval):
                        try:
                            issue = rule.check_func()
                            if issue:
                                self._handle_issue(issue)
                        except Exception as e:
                            logger.error(f"规则 {rule.rule_id} 执行失败: {e}")
                        rule.last_check = current_time

                self._collect_metrics()
                time.sleep(self._check_interval)

            except Exception as e:
                logger.error(f"监控线程错误: {e}")
                time.sleep(self._check_interval)

    def _handle_issue(self, issue: DiagnosticIssue):
        with self._lock:
            existing = self._issues.get(issue.id)

            if existing:
                if issue.resolved and not existing.resolved:
                    existing.resolved = True
                    existing.resolved_at = datetime.now()
                    event_bus.emit('issue_resolved', existing.to_dict())
                    logger.info(f"问题已解决: {issue.title}")
            elif not issue.resolved:
                self._issues[issue.id] = issue
                self._issue_history.append(issue)
                event_bus.emit('issue_detected', issue.to_dict())
                logger.warning(f"检测到问题: {issue.severity.value} - {issue.title}")

    def _collect_metrics(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')

            metrics = SystemMetrics(
                timestamp=datetime.now(),
                cpu_usage=cpu_percent,
                memory_usage=memory.percent,
                memory_available_mb=memory.available / (1024 * 1024),
                disk_usage=disk.percent,
                disk_free_mb=disk.free / (1024 * 1024),
                process_count=len(psutil.pids()),
                thread_count=threading.active_count()
            )

            with self._lock:
                self._metrics_history.append(metrics)

            event_bus.emit('metrics_updated', {
                'cpu': metrics.cpu_usage,
                'memory': metrics.memory_usage,
                'disk': metrics.disk_usage
            })

        except Exception as e:
            logger.error(f"指标收集错误: {e}")

    def _check_cpu_usage(self) -> Optional[DiagnosticIssue]:
        cpu_percent = psutil.cpu_percent(interval=0.1)

        if cpu_percent > 90:
            return DiagnosticIssue(
                id="cpu_high_usage",
                category=DiagnosticCategory.PERFORMANCE,
                severity=SeverityLevel.WARNING,
                title="CPU 使用率过高",
                message=f"当前 CPU 使用率为 {cpu_percent:.1f}%，可能影响扫描性能",
                suggestion="建议关闭其他占用 CPU 的应用程序，或降低扫描分辨率"
            )
        return None

    def _check_memory_usage(self) -> Optional[DiagnosticIssue]:
        memory = psutil.virtual_memory()

        if memory.percent > 85:
            return DiagnosticIssue(
                id="memory_high_usage",
                category=DiagnosticCategory.MEMORY,
                severity=SeverityLevel.WARNING,
                title="内存使用率较高",
                message=f"当前内存使用率为 {memory.percent:.1f}%",
                suggestion="建议关闭其他应用程序，或重启扫描服务"
            )
        return None

    def _check_memory_critical(self) -> Optional[DiagnosticIssue]:
        memory = psutil.virtual_memory()
        available_mb = memory.available / (1024 * 1024)

        if available_mb < 500:
            return DiagnosticIssue(
                id="memory_critical",
                category=DiagnosticCategory.MEMORY,
                severity=SeverityLevel.CRITICAL,
                title="内存严重不足",
                message=f"可用内存仅剩余 {available_mb:.0f} MB",
                suggestion="立即关闭其他应用程序，保存工作并重启系统"
            )
        return None

    def _check_disk_space(self) -> Optional[DiagnosticIssue]:
        try:
            disk = psutil.disk_usage('/')
            free_gb = disk.free / (1024 * 1024 * 1024)

            if free_gb < 10:
                return DiagnosticIssue(
                    id="disk_low_space",
                    category=DiagnosticCategory.STORAGE,
                    severity=SeverityLevel.WARNING,
                    title="磁盘空间不足",
                    message=f"系统磁盘剩余空间仅 {free_gb:.1f} GB",
                    suggestion="建议清理磁盘空间，确保至少有 20GB 可用空间"
                )
        except:
            pass
        return None

    def _check_disk_critical(self) -> Optional[DiagnosticIssue]:
        try:
            disk = psutil.disk_usage('/')
            free_gb = disk.free / (1024 * 1024 * 1024)

            if free_gb < 2:
                return DiagnosticIssue(
                    id="disk_critical",
                    category=DiagnosticCategory.STORAGE,
                    severity=SeverityLevel.CRITICAL,
                    title="磁盘空间严重不足",
                    message=f"系统磁盘剩余空间仅 {free_gb:.1f} GB",
                    suggestion="立即清理磁盘空间，否则可能导致数据丢失"
                )
        except:
            pass
        return None

    def _check_system_load(self) -> Optional[DiagnosticIssue]:
        try:
            load_avg = psutil.getloadavg()
            cpu_count = psutil.cpu_count() or 4

            if load_avg[0] > cpu_count * 1.5:
                return DiagnosticIssue(
                    id="system_high_load",
                    category=DiagnosticCategory.SYSTEM,
                    severity=SeverityLevel.ERROR,
                    title="系统负载过高",
                    message=f"1分钟负载: {load_avg[0]:.2f}, CPU核心数: {cpu_count}",
                    suggestion="减少并发任务数量，检查是否有异常进程"
                )
        except:
            pass
        return None

    def run_full_diagnosis(self) -> List[DiagnosticIssue]:
        if not self._initialized:
            self.initialize()

        issues = []
        for rule in self._rules:
            try:
                issue = rule.check_func()
                if issue:
                    issues.append(issue)
                    self._handle_issue(issue)
            except Exception as e:
                logger.error(f"诊断规则 {rule.rule_id} 执行错误: {e}")

        return issues

    def get_active_issues(self, category: Optional[DiagnosticCategory] = None,
                          severity: Optional[SeverityLevel] = None) -> List[DiagnosticIssue]:
        with self._lock:
            issues = [i for i in self._issues.values() if not i.resolved]

            if category:
                issues = [i for i in issues if i.category == category]

            if severity:
                issues = [i for i in issues if i.severity == severity]

            return sorted(issues, key=lambda x: x.timestamp, reverse=True)

    def get_issue_history(self, limit: int = 100) -> List[DiagnosticIssue]:
        with self._lock:
            return list(self._issue_history)[-limit:]

    def get_latest_metrics(self, count: int = 60) -> List[SystemMetrics]:
        with self._lock:
            return list(self._metrics_history)[-count:]

    def resolve_issue(self, issue_id: str):
        with self._lock:
            issue = self._issues.get(issue_id)
            if issue and not issue.resolved:
                issue.resolved = True
                issue.resolved_at = datetime.now()
                event_bus.emit('issue_resolved', issue.to_dict())

    def get_status_summary(self) -> Dict[str, Any]:
        active_issues = self.get_active_issues()
        critical_count = len([i for i in active_issues if i.severity == SeverityLevel.CRITICAL])
        error_count = len([i for i in active_issues if i.severity == SeverityLevel.ERROR])
        warning_count = len([i for i in active_issues if i.severity == SeverityLevel.WARNING])

        latest_metrics = self.get_latest_metrics(1)
        metrics = latest_metrics[0] if latest_metrics else None

        status = "healthy"
        if critical_count > 0:
            status = "critical"
        elif error_count > 0:
            status = "error"
        elif warning_count > 0:
            status = "warning"

        return {
            'status': status,
            'monitoring': self._running,
            'issues': {
                'total_active': len(active_issues),
                'critical': critical_count,
                'error': error_count,
                'warning': warning_count
            },
            'metrics': {
                'cpu_usage': metrics.cpu_usage if metrics else None,
                'memory_usage': metrics.memory_usage if metrics else None,
                'disk_usage': metrics.disk_usage if metrics else None
            } if metrics else None,
            'platform': self._platform_info
        }

    def add_listener(self, callback: Callable):
        self._listeners.append(callback)

    def remove_listener(self, callback: Callable):
        if callback in self._listeners:
            self._listeners.remove(callback)


diagnostics_engine = DiagnosticsEngine()


class DeviceHealthMonitor:
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.health_score: float = 100.0
        self.connection_stability: float = 100.0
        self.error_count: int = 0
        self.consecutive_errors: int = 0
        self.last_heartbeat: Optional[float] = None
        self._checks: List[Dict[str, Any]] = []

    def record_heartbeat(self, success: bool = True):
        self.last_heartbeat = time.time()

        if success:
            self.consecutive_errors = 0
            self.connection_stability = min(100.0, self.connection_stability + 5.0)
        else:
            self.error_count += 1
            self.consecutive_errors += 1
            self.connection_stability = max(0.0, self.connection_stability - 10.0)

        self._update_health_score()

    def _update_health_score(self):
        stability_weight = 0.6
        error_penalty = min(self.consecutive_errors * 5, 30)
        self.health_score = (self.connection_stability * stability_weight) + \
                            (100.0 * (1 - stability_weight)) - error_penalty
        self.health_score = max(0.0, min(100.0, self.health_score))

    def get_health_status(self) -> Dict[str, Any]:
        status = 'healthy'
        if self.health_score < 50:
            status = 'critical'
        elif self.health_score < 75:
            status = 'warning'

        return {
            'device_id': self.device_id,
            'health_score': self.health_score,
            'connection_stability': self.connection_stability,
            'error_count': self.error_count,
            'consecutive_errors': self.consecutive_errors,
            'last_heartbeat': self.last_heartbeat,
            'status': status
        }
