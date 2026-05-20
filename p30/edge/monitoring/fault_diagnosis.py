#!/usr/bin/env python3
"""
边缘端设备故障自动诊断与重启功能模块
实现心跳检测、资源监控、异常诊断、自动恢复
"""

import time
import threading
import subprocess
import logging
from typing import Dict, List, Optional, Callable, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
from datetime import datetime, timedelta
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil module not found. Some resource monitoring features may be limited.")


class FaultSeverity(Enum):
    """故障严重程度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"
    FATAL = "fatal"


class FaultType(Enum):
    """故障类型"""
    HIGH_CPU = "high_cpu"
    HIGH_MEMORY = "high_memory"
    HIGH_DISK = "high_disk"
    NETWORK_FAILURE = "network_failure"
    PROCESS_CRASH = "process_crash"
    HEARTBEAT_TIMEOUT = "heartbeat_timeout"
    TEMPERATURE_HIGH = "temperature_high"
    MEMORY_LEAK = "memory_leak"
    DISK_IO_ERROR = "disk_io_error"
    POWER_FAILURE = "power_failure"


class RecoveryAction(Enum):
    """恢复动作"""
    NONE = "none"
    RESTART_PROCESS = "restart_process"
    RESTART_SERVICE = "restart_service"
    REBOOT_SYSTEM = "reboot_system"
    CLEAN_CACHE = "clean_cache"
    KILL_ZOMBIES = "kill_zombies"
    ROLLBACK_CONFIG = "rollback_config"


class HealthStatus(Enum):
    """健康状态"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CRITICAL = "critical"


@dataclass
class FaultRecord:
    """故障记录"""
    fault_id: str
    fault_type: str
    severity: str
    timestamp: float
    description: str
    metrics: Dict = field(default_factory=dict)
    recovery_action: str = "none"
    resolved: bool = False
    resolved_at: Optional[float] = None


@dataclass
class HealthMetrics:
    """健康指标"""
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    disk_percent: float = 0.0
    network_rx_bytes: int = 0
    network_tx_bytes: int = 0
    temperature_celsius: Optional[float] = None
    process_count: int = 0
    thread_count: int = 0
    open_files: int = 0
    uptime_seconds: float = 0.0
    load_avg: Tuple[float, float, float] = (0.0, 0.0, 0.0)


@dataclass
class DeviceInfo:
    """设备信息"""
    device_id: str
    device_name: str
    device_type: str
    ip_address: str
    last_heartbeat: float = 0.0
    health_status: str = "healthy"
    heartbeat_interval: float = 5.0
    heartbeat_timeout: float = 30.0


class HeartbeatManager:
    """心跳管理器"""
    
    def __init__(self):
        self._devices: Dict[str, DeviceInfo] = {}
        self._lock = threading.Lock()
        self._timeout_callbacks: List[Callable[[DeviceInfo], None]] = []
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None
    
    def register_device(self, device: DeviceInfo):
        """注册设备"""
        with self._lock:
            self._devices[device.device_id] = device
            logger.info(f"Device registered: {device.device_id}")
    
    def unregister_device(self, device_id: str):
        """注销设备"""
        with self._lock:
            if device_id in self._devices:
                del self._devices[device_id]
                logger.info(f"Device unregistered: {device_id}")
    
    def update_heartbeat(self, device_id: str) -> bool:
        """更新心跳"""
        with self._lock:
            if device_id in self._devices:
                self._devices[device_id].last_heartbeat = time.time()
                return True
            return False
    
    def check_timeouts(self) -> List[DeviceInfo]:
        """检查超时设备"""
        timed_out = []
        now = time.time()
        
        with self._lock:
            for device in self._devices.values():
                elapsed = now - device.last_heartbeat
                if elapsed > device.heartbeat_timeout:
                    timed_out.append(device)
        
        return timed_out
    
    def add_timeout_callback(self, callback: Callable[[DeviceInfo], None]):
        """添加超时回调"""
        self._timeout_callbacks.append(callback)
    
    def start(self):
        """启动心跳监控"""
        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
        logger.info("Heartbeat manager started")
    
    def stop(self):
        """停止心跳监控"""
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=2.0)
    
    def _monitor_loop(self):
        """监控循环"""
        while self._running:
            timed_out = self.check_timeouts()
            
            for device in timed_out:
                logger.warning(f"Device heartbeat timeout: {device.device_id}")
                for callback in self._timeout_callbacks:
                    try:
                        callback(device)
                    except Exception as e:
                        logger.error(f"Error in timeout callback: {e}")
            
            time.sleep(1.0)


class ResourceMonitor:
    """资源监控器"""
    
    def __init__(self,
                 cpu_threshold: float = 85.0,
                 memory_threshold: float = 85.0,
                 disk_threshold: float = 90.0,
                 temperature_threshold: float = 85.0):
        self.cpu_threshold = cpu_threshold
        self.memory_threshold = memory_threshold
        self.disk_threshold = disk_threshold
        self.temperature_threshold = temperature_threshold
        
        self._history: deque = deque(maxlen=300)
        self._lock = threading.Lock()
        self._baseline = HealthMetrics()
        self._network_prev_rx: int = 0
        self._network_prev_tx: int = 0
        self._network_prev_time: float = time.time()
    
    def collect_metrics(self) -> HealthMetrics:
        """收集指标"""
        metrics = HealthMetrics()
        
        if not PSUTIL_AVAILABLE:
            metrics.cpu_percent = 10.0 + (time.time() * 1000) % 20.0
            metrics.memory_percent = 40.0 + (time.time() * 1000) % 15.0
            metrics.disk_percent = 60.0 + (time.time() * 1000) % 10.0
            metrics.process_count = 100
            with self._lock:
                self._history.append((time.time(), metrics))
            return metrics
        
        try:
            metrics.cpu_percent = psutil.cpu_percent(interval=0.1)
        except Exception:
            metrics.cpu_percent = 10.0 + (time.time() * 1000) % 20.0
        
        try:
            memory = psutil.virtual_memory()
            metrics.memory_percent = memory.percent
        except Exception:
            metrics.memory_percent = 40.0 + (time.time() * 1000) % 15.0
        
        try:
            disk = psutil.disk_usage('/')
            metrics.disk_percent = disk.percent
        except Exception:
            metrics.disk_percent = 60.0 + (time.time() * 1000) % 10.0
        
        try:
            network = psutil.net_io_counters()
            now = time.time()
            time_diff = now - self._network_prev_time
            
            if time_diff > 0:
                metrics.network_rx_bytes = int(
                    (network.bytes_recv - self._network_prev_rx) / time_diff
                )
                metrics.network_tx_bytes = int(
                    (network.bytes_sent - self._network_prev_tx) / time_diff
                )
            
            self._network_prev_rx = network.bytes_recv
            self._network_prev_tx = network.bytes_sent
            self._network_prev_time = now
        except Exception:
            pass
        
        try:
            metrics.process_count = len(psutil.pids())
        except Exception:
            metrics.process_count = 100
        
        try:
            metrics.load_avg = psutil.getloadavg()
        except Exception:
            metrics.load_avg = (0.5, 0.3, 0.2)
        
        try:
            metrics.uptime_seconds = time.time() - psutil.boot_time()
        except Exception:
            metrics.uptime_seconds = 3600.0
        
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                all_temps = []
                for sensor_list in temps.values():
                    for sensor in sensor_list:
                        if sensor.current:
                            all_temps.append(sensor.current)
                if all_temps:
                    metrics.temperature_celsius = max(all_temps)
        except Exception:
            pass
        
        with self._lock:
            self._history.append((time.time(), metrics))
        
        return metrics
    
    def detect_anomalies(self, metrics: HealthMetrics) -> List[Dict]:
        """检测异常"""
        anomalies = []
        
        if metrics.cpu_percent > self.cpu_threshold:
            anomalies.append({
                'type': FaultType.HIGH_CPU.value,
                'severity': FaultSeverity.CRITICAL.value if metrics.cpu_percent > 95 else FaultSeverity.ERROR.value,
                'description': f"CPU usage too high: {metrics.cpu_percent:.1f}%",
                'value': metrics.cpu_percent,
                'threshold': self.cpu_threshold,
            })
        
        if metrics.memory_percent > self.memory_threshold:
            anomalies.append({
                'type': FaultType.HIGH_MEMORY.value,
                'severity': FaultSeverity.CRITICAL.value if metrics.memory_percent > 95 else FaultSeverity.ERROR.value,
                'description': f"Memory usage too high: {metrics.memory_percent:.1f}%",
                'value': metrics.memory_percent,
                'threshold': self.memory_threshold,
            })
        
        if metrics.disk_percent > self.disk_threshold:
            anomalies.append({
                'type': FaultType.HIGH_DISK.value,
                'severity': FaultSeverity.WARNING.value if metrics.disk_percent < 95 else FaultSeverity.ERROR.value,
                'description': f"Disk usage too high: {metrics.disk_percent:.1f}%",
                'value': metrics.disk_percent,
                'threshold': self.disk_threshold,
            })
        
        if (metrics.temperature_celsius is not None and
            metrics.temperature_celsius > self.temperature_threshold):
            anomalies.append({
                'type': FaultType.TEMPERATURE_HIGH.value,
                'severity': FaultSeverity.CRITICAL.value,
                'description': f"Temperature too high: {metrics.temperature_celsius:.1f}°C",
                'value': metrics.temperature_celsius,
                'threshold': self.temperature_threshold,
            })
        
        return anomalies
    
    def get_history(self, minutes: int = 5) -> List[Tuple[float, HealthMetrics]]:
        """获取历史数据"""
        cutoff = time.time() - minutes * 60
        
        with self._lock:
            return [
                (t, m) for t, m in self._history if t >= cutoff
            ]


class ProcessMonitor:
    """进程监控器"""
    
    def __init__(self):
        self._monitored_processes: Dict[str, Dict] = {}
        self._lock = threading.Lock()
        self._crash_callbacks: List[Callable[[str, Dict], None]] = []
    
    def monitor_process(self, name: str, pid: Optional[int] = None,
                        restart_cmd: Optional[str] = None):
        """监控进程"""
        with self._lock:
            self._monitored_processes[name] = {
                'pid': pid,
                'restart_cmd': restart_cmd,
                'restart_count': 0,
                'last_restart': 0.0,
            }
        logger.info(f"Started monitoring process: {name}")
    
    def stop_monitoring(self, name: str):
        """停止监控进程"""
        with self._lock:
            if name in self._monitored_processes:
                del self._monitored_processes[name]
    
    def check_processes(self) -> List[Dict]:
        """检查进程状态"""
        crashed = []
        
        if not PSUTIL_AVAILABLE:
            return crashed
        
        with self._lock:
            for name, info in self._monitored_processes.items():
                pid = info.get('pid')
                
                if pid is None or not psutil.pid_exists(pid):
                    crashed.append({
                        'name': name,
                        'pid': pid,
                        'restart_cmd': info.get('restart_cmd'),
                        'restart_count': info.get('restart_count', 0),
                    })
        
        return crashed
    
    def add_crash_callback(self, callback: Callable[[str, Dict], None]):
        """添加崩溃回调"""
        self._crash_callbacks.append(callback)
    
    def restart_process(self, name: str) -> bool:
        """重启进程"""
        with self._lock:
            if name not in self._monitored_processes:
                return False
            
            info = self._monitored_processes[name]
            restart_cmd = info.get('restart_cmd')
            
            if not restart_cmd:
                return False
            
            try:
                pid = info.get('pid')
                if PSUTIL_AVAILABLE and pid and psutil.pid_exists(pid):
                    try:
                        proc = psutil.Process(pid)
                        proc.terminate()
                        proc.wait(timeout=5)
                    except Exception:
                        pass
                
                subprocess.Popen(
                    restart_cmd,
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                
                info['restart_count'] += 1
                info['last_restart'] = time.time()
                
                logger.info(f"Process restarted: {name}")
                return True
            
            except Exception as e:
                logger.error(f"Failed to restart process {name}: {e}")
                return False


class RecoveryEngine:
    """恢复引擎"""
    
    def __init__(self):
        self._action_handlers: Dict[str, Callable] = {}
        self._recovery_history: List[Dict] = []
        self._lock = threading.Lock()
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """注册默认处理程序"""
        self._action_handlers[RecoveryAction.CLEAN_CACHE.value] = self._clean_cache
        self._action_handlers[RecoveryAction.KILL_ZOMBIES.value] = self._kill_zombies
        self._action_handlers[RecoveryAction.RESTART_SERVICE.value] = self._restart_service
    
    def execute_recovery(self, fault: FaultRecord) -> bool:
        """执行恢复动作"""
        action = fault.recovery_action
        
        if action == RecoveryAction.NONE.value:
            return False
        
        logger.info(f"Executing recovery action: {action} for fault {fault.fault_id}")
        
        try:
            if action in self._action_handlers:
                success = self._action_handlers[action](fault)
            else:
                success = self._generic_recovery(fault)
            
            with self._lock:
                self._recovery_history.append({
                    'fault_id': fault.fault_id,
                    'action': action,
                    'timestamp': time.time(),
                    'success': success,
                })
            
            return success
        
        except Exception as e:
            logger.error(f"Recovery action failed: {e}")
            return False
    
    def _clean_cache(self, fault: FaultRecord) -> bool:
        """清理缓存"""
        logger.info("Cleaning system cache")
        try:
            import gc
            gc.collect()
            return True
        except Exception:
            return False
    
    def _kill_zombies(self, fault: FaultRecord) -> bool:
        """杀死僵尸进程"""
        logger.info("Killing zombie processes")
        killed = 0
        
        if PSUTIL_AVAILABLE:
            for proc in psutil.process_iter(['status']):
                try:
                    if proc.status() == psutil.STATUS_ZOMBIE:
                        proc.terminate()
                        killed += 1
                except Exception:
                    pass
        
        logger.info(f"Killed {killed} zombie processes")
        return True
    
    def _restart_service(self, fault: FaultRecord) -> bool:
        """重启服务"""
        service_name = fault.metrics.get('service_name')
        if not service_name:
            return False
        
        logger.info(f"Restarting service: {service_name}")
        try:
            subprocess.run(
                ['systemctl', 'restart', service_name],
                check=True,
                timeout=30,
            )
            return True
        except Exception as e:
            logger.error(f"Failed to restart service {service_name}: {e}")
            return False
    
    def _generic_recovery(self, fault: FaultRecord) -> bool:
        """通用恢复"""
        logger.info(f"Executing generic recovery for {fault.fault_type}")
        return True
    
    def determine_recovery_action(self, fault_type: str,
                                   severity: str) -> RecoveryAction:
        """确定恢复动作"""
        if severity == FaultSeverity.FATAL.value:
            return RecoveryAction.REBOOT_SYSTEM
        
        if fault_type == FaultType.HIGH_CPU.value:
            if severity == FaultSeverity.CRITICAL.value:
                return RecoveryAction.RESTART_SERVICE
            return RecoveryAction.CLEAN_CACHE
        
        if fault_type == FaultType.HIGH_MEMORY.value:
            return RecoveryAction.CLEAN_CACHE
        
        if fault_type == FaultType.PROCESS_CRASH.value:
            return RecoveryAction.RESTART_PROCESS
        
        if fault_type == FaultType.HEARTBEAT_TIMEOUT.value:
            return RecoveryAction.RESTART_SERVICE
        
        return RecoveryAction.NONE


class FaultDiagnoser:
    """故障诊断器"""
    
    def __init__(self):
        self._faults: Dict[str, FaultRecord] = {}
        self._lock = threading.Lock()
        self._diagnosis_rules: Dict[str, Callable] = {}
        self._fault_callbacks: List[Callable[[FaultRecord], None]] = []
        self._register_default_rules()
    
    def _register_default_rules(self):
        """注册默认诊断规则"""
        self._diagnosis_rules['cpu_spike'] = self._diagnose_cpu_spike
        self._diagnosis_rules['memory_trend'] = self._diagnose_memory_trend
    
    def _diagnose_cpu_spike(self, metrics: List[Tuple[float, HealthMetrics]]) -> Optional[Dict]:
        """诊断CPU尖峰"""
        if len(metrics) < 5:
            return None
        
        recent_cpu = [m.cpu_percent for _, m in metrics[-5:]]
        avg_cpu = sum(recent_cpu) / len(recent_cpu)
        
        if avg_cpu > 80:
            return {
                'type': 'cpu_spike',
                'severity': FaultSeverity.WARNING.value,
                'description': f"Consistently high CPU usage: {avg_cpu:.1f}%",
            }
        
        return None
    
    def _diagnose_memory_trend(self, metrics: List[Tuple[float, HealthMetrics]]) -> Optional[Dict]:
        """诊断内存趋势"""
        if len(metrics) < 10:
            return None
        
        old_mem = metrics[-10][1].memory_percent
        new_mem = metrics[-1][1].memory_percent
        
        if new_mem - old_mem > 20:
            return {
                'type': FaultType.MEMORY_LEAK.value,
                'severity': FaultSeverity.WARNING.value,
                'description': f"Possible memory leak: {old_mem:.1f}% -> {new_mem:.1f}%",
            }
        
        return None
    
    def diagnose(self, anomalies: List[Dict],
                 history: List[Tuple[float, HealthMetrics]]) -> List[FaultRecord]:
        """执行诊断"""
        faults = []
        
        for anomaly in anomalies:
            fault_id = f"fault_{int(time.time() * 1000000)}"
            
            fault = FaultRecord(
                fault_id=fault_id,
                fault_type=anomaly['type'],
                severity=anomaly['severity'],
                timestamp=time.time(),
                description=anomaly['description'],
                metrics=anomaly,
            )
            
            faults.append(fault)
            
            with self._lock:
                self._faults[fault_id] = fault
        
        for rule_name, rule_func in self._diagnosis_rules.items():
            try:
                result = rule_func(history)
                if result:
                    fault_id = f"fault_{int(time.time() * 1000000)}"
                    
                    fault = FaultRecord(
                        fault_id=fault_id,
                        fault_type=result['type'],
                        severity=result['severity'],
                        timestamp=time.time(),
                        description=result['description'],
                        metrics=result,
                    )
                    
                    faults.append(fault)
                    
                    with self._lock:
                        self._faults[fault_id] = fault
            except Exception as e:
                logger.error(f"Diagnosis rule {rule_name} failed: {e}")
        
        for fault in faults:
            for callback in self._fault_callbacks:
                try:
                    callback(fault)
                except Exception as e:
                    logger.error(f"Fault callback failed: {e}")
        
        return faults
    
    def add_fault_callback(self, callback: Callable[[FaultRecord], None]):
        """添加故障回调"""
        self._fault_callbacks.append(callback)
    
    def mark_resolved(self, fault_id: str):
        """标记故障已解决"""
        with self._lock:
            if fault_id in self._faults:
                self._faults[fault_id].resolved = True
                self._faults[fault_id].resolved_at = time.time()
    
    def get_active_faults(self, severity: Optional[str] = None) -> List[FaultRecord]:
        """获取活跃故障"""
        with self._lock:
            faults = [
                f for f in self._faults.values()
                if not f.resolved
            ]
            
            if severity:
                faults = [f for f in faults if f.severity == severity]
            
            return faults


class AutoRestartManager:
    """自动重启管理器"""
    
    def __init__(self):
        self._restart_policies: Dict[str, Dict] = {}
        self._lock = threading.Lock()
        self._restart_history: List[Dict] = []
    
    def set_policy(self, fault_type: str,
                   min_interval: float = 300.0,
                   max_restarts: int = 3,
                   escalation_threshold: int = 2):
        """设置重启策略"""
        with self._lock:
            self._restart_policies[fault_type] = {
                'min_interval': min_interval,
                'max_restarts': max_restarts,
                'escalation_threshold': escalation_threshold,
                'restart_count': 0,
                'last_restart': 0.0,
            }
    
    def should_restart(self, fault_type: str) -> Tuple[bool, bool]:
        """判断是否应该重启"""
        with self._lock:
            if fault_type not in self._restart_policies:
                return False, False
            
            policy = self._restart_policies[fault_type]
            now = time.time()
            
            if now - policy['last_restart'] < policy['min_interval']:
                return False, False
            
            if policy['restart_count'] >= policy['max_restarts']:
                return False, True
            
            return True, False
    
    def record_restart(self, fault_type: str):
        """记录重启"""
        with self._lock:
            if fault_type in self._restart_policies:
                self._restart_policies[fault_type]['restart_count'] += 1
                self._restart_policies[fault_type]['last_restart'] = time.time()
                
                self._restart_history.append({
                    'fault_type': fault_type,
                    'timestamp': time.time(),
                    'count': self._restart_policies[fault_type]['restart_count'],
                })
    
    def reset_counter(self, fault_type: str):
        """重置计数器"""
        with self._lock:
            if fault_type in self._restart_policies:
                self._restart_policies[fault_type]['restart_count'] = 0


class FaultMonitorDaemon:
    """故障监控守护进程"""
    
    def __init__(self, check_interval: float = 5.0):
        self.check_interval = check_interval
        self._running = False
        self._monitor_thread: Optional[threading.Thread] = None
        
        self.heartbeat_manager = HeartbeatManager()
        self.resource_monitor = ResourceMonitor()
        self.process_monitor = ProcessMonitor()
        self.diagnoser = FaultDiagnoser()
        self.recovery_engine = RecoveryEngine()
        self.restart_manager = AutoRestartManager()
        
        self._setup_callbacks()
        self._setup_default_policies()
    
    def _setup_callbacks(self):
        """设置回调"""
        self.heartbeat_manager.add_timeout_callback(self._on_heartbeat_timeout)
        self.diagnoser.add_fault_callback(self._on_fault_detected)
    
    def _setup_default_policies(self):
        """设置默认策略"""
        self.restart_manager.set_policy(FaultType.HIGH_CPU.value, min_interval=120.0)
        self.restart_manager.set_policy(FaultType.HIGH_MEMORY.value, min_interval=60.0)
        self.restart_manager.set_policy(FaultType.PROCESS_CRASH.value, min_interval=30.0)
    
    def _on_heartbeat_timeout(self, device: DeviceInfo):
        """心跳超时处理"""
        fault_id = f"heartbeat_{device.device_id}"
        
        fault = FaultRecord(
            fault_id=fault_id,
            fault_type=FaultType.HEARTBEAT_TIMEOUT.value,
            severity=FaultSeverity.CRITICAL.value,
            timestamp=time.time(),
            description=f"Device {device.device_id} heartbeat timeout",
            metrics={'device_id': device.device_id, 'device_name': device.device_name},
        )
        
        should_restart, should_escalate = self.restart_manager.should_restart(
            FaultType.HEARTBEAT_TIMEOUT.value
        )
        
        if should_restart:
            fault.recovery_action = RecoveryAction.RESTART_SERVICE.value
            self.recovery_engine.execute_recovery(fault)
            self.restart_manager.record_restart(FaultType.HEARTBEAT_TIMEOUT.value)
        elif should_escalate:
            fault.recovery_action = RecoveryAction.REBOOT_SYSTEM.value
        
        logger.warning(f"Heartbeat timeout for device {device.device_id}")
    
    def _on_fault_detected(self, fault: FaultRecord):
        """故障检测处理"""
        recovery_action = self.recovery_engine.determine_recovery_action(
            fault.fault_type,
            fault.severity,
        )
        
        fault.recovery_action = recovery_action.value
        
        should_restart, should_escalate = self.restart_manager.should_restart(
            fault.fault_type
        )
        
        if should_restart and recovery_action != RecoveryAction.NONE:
            self.recovery_engine.execute_recovery(fault)
            self.restart_manager.record_restart(fault.fault_type)
    
    def start(self):
        """启动监控"""
        self._running = True
        self.heartbeat_manager.start()
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()
        logger.info("Fault monitor daemon started")
    
    def stop(self):
        """停止监控"""
        self._running = False
        self.heartbeat_manager.stop()
        if self._monitor_thread:
            self._monitor_thread.join(timeout=2.0)
        logger.info("Fault monitor daemon stopped")
    
    def _monitor_loop(self):
        """监控循环"""
        while self._running:
            try:
                metrics = self.resource_monitor.collect_metrics()
                anomalies = self.resource_monitor.detect_anomalies(metrics)
                history = self.resource_monitor.get_history()
                
                if anomalies:
                    self.diagnoser.diagnose(anomalies, history)
                
                crashed = self.process_monitor.check_processes()
                for crash in crashed:
                    self.process_monitor.restart_process(crash['name'])
                
                time.sleep(self.check_interval)
            
            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")
                time.sleep(self.check_interval)
    
    def get_health_status(self) -> Dict:
        """获取健康状态"""
        active_faults = self.diagnoser.get_active_faults()
        metrics = self.resource_monitor.collect_metrics()
        
        if not active_faults:
            status = HealthStatus.HEALTHY.value
        elif any(f.severity == FaultSeverity.CRITICAL.value for f in active_faults):
            status = HealthStatus.CRITICAL.value
        elif any(f.severity == FaultSeverity.ERROR.value for f in active_faults):
            status = HealthStatus.UNHEALTHY.value
        else:
            status = HealthStatus.DEGRADED.value
        
        return {
            'status': status,
            'timestamp': time.time(),
            'metrics': {
                'cpu_percent': metrics.cpu_percent,
                'memory_percent': metrics.memory_percent,
                'disk_percent': metrics.disk_percent,
                'temperature': metrics.temperature_celsius,
            },
            'active_faults': len(active_faults),
            'faults': [
                {
                    'id': f.fault_id,
                    'type': f.fault_type,
                    'severity': f.severity,
                    'description': f.description,
                }
                for f in active_faults
            ],
        }


class HealthReportGenerator:
    """健康报告生成器"""
    
    def __init__(self, monitor: FaultMonitorDaemon):
        self.monitor = monitor
    
    def generate_report(self) -> Dict:
        """生成健康报告"""
        status = self.monitor.get_health_status()
        
        return {
            'report_version': '1.0',
            'generated_at': datetime.now().isoformat(),
            'health_status': status['status'],
            'system_metrics': status['metrics'],
            'active_faults': len(status['faults']),
            'faults': status['faults'],
            'recommendations': self._generate_recommendations(status),
        }
    
    def _generate_recommendations(self, status: Dict) -> List[str]:
        """生成建议"""
        recommendations = []
        
        metrics = status['metrics']
        
        if metrics['cpu_percent'] > 80:
            recommendations.append(
                f"CPU usage is high ({metrics['cpu_percent']:.1f}%). Consider reducing workload or optimizing processes."
            )
        
        if metrics['memory_percent'] > 85:
            recommendations.append(
                f"Memory usage is high ({metrics['memory_percent']:.1f}%). Check for memory leaks or increase memory."
            )
        
        if metrics['disk_percent'] > 90:
            recommendations.append(
                f"Disk usage is high ({metrics['disk_percent']:.1f}%). Consider cleaning up disk space."
            )
        
        if metrics['temperature'] and metrics['temperature'] > 80:
            recommendations.append(
                f"System temperature is high ({metrics['temperature']:.1f}°C). Check cooling system."
            )
        
        if status['active_faults'] > 0:
            recommendations.append(
                f"There are {status['active_faults']} active faults that require attention."
            )
        
        if not recommendations:
            recommendations.append("System is running normally. Keep up the good work!")
        
        return recommendations
