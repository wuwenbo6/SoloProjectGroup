import os
import sys
import platform
import logging
import subprocess
import shutil
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json
import tempfile
import threading
import time

logger = logging.getLogger(__name__)

class OSType:
    WINDOWS = "windows"
    MACOS = "macos"
    LINUX = "linux"
    UNKNOWN = "unknown"

class SystemInfo:
    def __init__(self):
        self.os_type = self._detect_os()
        self.os_version = platform.version()
        self.os_release = platform.release()
        self.python_version = platform.python_version()
        self.architecture = platform.machine()
        self.cpu_count = os.cpu_count() or 4
        self.total_memory = self._detect_memory()
        self.available_memory = self._detect_available_memory()
        self.disk_space = self._detect_disk_space()
    
    def _detect_os(self) -> str:
        system = platform.system().lower()
        if "windows" in system:
            return OSType.WINDOWS
        elif "darwin" in system:
            return OSType.MACOS
        elif "linux" in system:
            return OSType.LINUX
        return OSType.UNKNOWN
    
    def _detect_memory(self) -> int:
        try:
            if self.os_type == OSType.WINDOWS:
                result = subprocess.run(
                    ["wmic", "OS", "get", "TotalVisibleMemorySize", "/value"],
                    capture_output=True, text=True
                )
                for line in result.stdout.split("\n"):
                    if "TotalVisibleMemorySize" in line:
                        return int(line.split("=")[1].strip()) * 1024
            elif self.os_type in [OSType.MACOS, OSType.LINUX]:
                result = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True)
                return int(result.stdout.strip())
        except:
            pass
        return 8 * 1024 * 1024 * 1024
    
    def _detect_available_memory(self) -> int:
        try:
            if self.os_type == OSType.WINDOWS:
                result = subprocess.run(
                    ["wmic", "OS", "get", "FreePhysicalMemory", "/value"],
                    capture_output=True, text=True
                )
                for line in result.stdout.split("\n"):
                    if "FreePhysicalMemory" in line:
                        return int(line.split("=")[1].strip()) * 1024
            elif self.os_type == OSType.MACOS:
                result = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True)
                total = int(result.stdout.strip())
                return int(total * 0.3)
            elif self.os_type == OSType.LINUX:
                with open("/proc/meminfo") as f:
                    for line in f:
                        if "MemAvailable" in line:
                            return int(line.split()[1]) * 1024
        except:
            pass
        return 2 * 1024 * 1024 * 1024
    
    def _detect_disk_space(self) -> Dict[str, int]:
        try:
            disk = shutil.disk_usage(".")
            return {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free
            }
        except:
            return {"total": 0, "used": 0, "free": 0}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "os_type": self.os_type,
            "os_version": self.os_version,
            "os_release": self.os_release,
            "python_version": self.python_version,
            "architecture": self.architecture,
            "cpu_count": self.cpu_count,
            "total_memory_gb": round(self.total_memory / (1024**3), 2),
            "available_memory_gb": round(self.available_memory / (1024**3), 2),
            "disk_free_gb": round(self.disk_space["free"] / (1024**3), 2)
        }

class ResourceLimiter:
    def __init__(self, system_info: SystemInfo):
        self.system_info = system_info
        self.memory_limit = self._calculate_memory_limit()
        self.cpu_limit = self._calculate_cpu_limit()
        self.thread_limits = self._calculate_thread_limits()
    
    def _calculate_memory_limit(self) -> int:
        available = self.system_info.available_memory
        if available > 16 * 1024**3:
            return int(available * 0.7)
        elif available > 8 * 1024**3:
            return int(available * 0.6)
        elif available > 4 * 1024**3:
            return int(available * 0.5)
        else:
            return int(available * 0.4)
    
    def _calculate_cpu_limit(self) -> float:
        cpu_count = self.system_info.cpu_count
        if cpu_count >= 16:
            return 12.0
        elif cpu_count >= 8:
            return 6.0
        elif cpu_count >= 4:
            return 3.0
        else:
            return 1.5
    
    def _calculate_thread_limits(self) -> Dict[str, int]:
        cpu_count = self.system_info.cpu_count
        return {
            "synthesis": max(2, min(cpu_count, 8)),
            "audio_processing": max(2, min(cpu_count, 4)),
            "model_inference": max(1, min(cpu_count // 2, 4)),
            "io_workers": max(2, min(cpu_count, 8))
        }
    
    def apply_limits(self):
        logger.info(f"Applying resource limits: memory={self.memory_limit/(1024**3):.2f}GB, cpu={self.cpu_limit} cores")
        
        try:
            if self.system_info.os_type in [OSType.MACOS, OSType.LINUX]:
                import resource
                soft, hard = resource.getrlimit(resource.RLIMIT_AS)
                resource.setrlimit(resource.RLIMIT_AS, (self.memory_limit, hard))
        except Exception as e:
            logger.warning(f"Could not apply memory limit: {e}")
    
    def get_limits(self) -> Dict[str, Any]:
        return {
            "memory_limit_gb": round(self.memory_limit / (1024**3), 2),
            "cpu_limit_cores": self.cpu_limit,
            "thread_limits": self.thread_limits
        }

class OfflineModeManager:
    def __init__(self, data_dir: str = "./offline_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.is_offline_mode = False
        self.offline_data_version = "1.0.0"
        self.required_files = self._get_required_files()
        self.check_status = {}
        
    def _get_required_files(self) -> Dict[str, List[str]]:
        return {
            "models": [
                "dialect_1_transformer.onnx",
                "dialect_2_transformer.onnx",
                "dialect_3_transformer.onnx",
                "dialect_4_transformer.onnx",
                "dialect_5_transformer.onnx",
                "vocoder.onnx"
            ],
            "data": [
                "phoneme_dictionary.json",
                "tone_rules.json",
                "dialect_prosody.json"
            ],
            "cache": [
                "common_phrases.json",
                "frequent_requests.json"
            ]
        }
    
    def check_offline_readiness(self) -> Dict[str, Any]:
        results = {
            "ready": True,
            "checks": {},
            "missing_files": [],
            "message": ""
        }
        
        for category, files in self.required_files.items():
            category_dir = self.data_dir / category
            category_dir.mkdir(parents=True, exist_ok=True)
            results["checks"][category] = {"total": len(files), "found": 0, "missing": []}
            
            for file in files:
                file_path = category_dir / file
                if file_path.exists():
                    results["checks"][category]["found"] += 1
                else:
                    results["checks"][category]["missing"].append(file)
                    results["missing_files"].append(f"{category}/{file}")
                    results["ready"] = False
        
        if results["ready"]:
            results["message"] = "Offline mode ready"
        else:
            results["message"] = f"Missing {len(results['missing_files'])} required files"
        
        self.check_status = results
        return results
    
    def create_placeholder_files(self):
        for category, files in self.required_files.items():
            category_dir = self.data_dir / category
            category_dir.mkdir(parents=True, exist_ok=True)
            
            for file in files:
                file_path = category_dir / file
                if not file_path.exists():
                    placeholder_data = {
                        "placeholder": True,
                        "category": category,
                        "filename": file,
                        "created_at": datetime.now().isoformat()
                    }
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(placeholder_data, f, ensure_ascii=False, indent=2)
        
        logger.info("Created placeholder offline files")
    
    def enable_offline_mode(self) -> bool:
        readiness = self.check_offline_readiness()
        if readiness["ready"]:
            self.is_offline_mode = True
            logger.info("Offline mode enabled")
            return True
        else:
            logger.warning(f"Cannot enable offline mode: {readiness['message']}")
            return False
    
    def disable_offline_mode(self):
        self.is_offline_mode = False
        logger.info("Offline mode disabled")

class SystemHealthMonitor:
    def __init__(self):
        self.system_info = SystemInfo()
        self.resource_limiter = ResourceLimiter(self.system_info)
        self.health_history: List[Dict] = []
        self.alert_thresholds = {
            "cpu_percent": 90,
            "memory_percent": 85,
            "disk_percent": 90,
            "response_time_ms": 5000
        }
        self.active_alerts: List[Dict] = []
        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_monitoring = threading.Event()
    
    def check_health(self) -> Dict[str, Any]:
        health = {
            "timestamp": datetime.now().isoformat(),
            "system_info": self.system_info.to_dict(),
            "metrics": {},
            "status": "healthy",
            "alerts": []
        }
        
        try:
            cpu_percent = self._get_cpu_usage()
            health["metrics"]["cpu_percent"] = cpu_percent
            if cpu_percent > self.alert_thresholds["cpu_percent"]:
                health["alerts"].append({
                    "type": "high_cpu",
                    "severity": "warning",
                    "message": f"High CPU usage: {cpu_percent:.1f}%"
                })
        except:
            health["metrics"]["cpu_percent"] = 0
        
        try:
            memory_percent = self._get_memory_usage()
            health["metrics"]["memory_percent"] = memory_percent
            if memory_percent > self.alert_thresholds["memory_percent"]:
                health["alerts"].append({
                    "type": "high_memory",
                    "severity": "warning",
                    "message": f"High memory usage: {memory_percent:.1f}%"
                })
        except:
            health["metrics"]["memory_percent"] = 0
        
        try:
            disk_percent = self._get_disk_usage()
            health["metrics"]["disk_percent"] = disk_percent
            if disk_percent > self.alert_thresholds["disk_percent"]:
                health["alerts"].append({
                    "type": "low_disk",
                    "severity": "critical",
                    "message": f"Low disk space: {100-disk_percent:.1f}% available"
                })
        except:
            health["metrics"]["disk_percent"] = 0
        
        if health["alerts"]:
            critical_count = sum(1 for a in health["alerts"] if a["severity"] == "critical")
            if critical_count > 0:
                health["status"] = "critical"
            else:
                health["status"] = "degraded"
        
        self.health_history.append(health)
        if len(self.health_history) > 1000:
            self.health_history = self.health_history[-1000:]
        
        self.active_alerts = health["alerts"]
        return health
    
    def _get_cpu_usage(self) -> float:
        try:
            import psutil
            return psutil.cpu_percent(interval=0.1)
        except:
            return 0.0
    
    def _get_memory_usage(self) -> float:
        try:
            import psutil
            return psutil.virtual_memory().percent
        except:
            return 0.0
    
    def _get_disk_usage(self) -> float:
        try:
            import psutil
            return psutil.disk_usage(".").percent
        except:
            return 0.0
    
    def start_monitoring(self, interval_seconds: int = 60):
        if self._monitor_thread and self._monitor_thread.is_alive():
            return
        
        self._stop_monitoring.clear()
        
        def monitor_loop():
            while not self._stop_monitoring.is_set():
                self.check_health()
                time.sleep(interval_seconds)
        
        self._monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self._monitor_thread.start()
        logger.info("System health monitor started")
    
    def stop_monitoring(self):
        self._stop_monitoring.set()
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5)
        logger.info("System health monitor stopped")
    
    def get_health_summary(self, last_minutes: int = 60) -> Dict[str, Any]:
        if not self.health_history:
            return {"message": "No health data available"}
        
        cutoff = datetime.now().timestamp() - last_minutes * 60
        recent_history = [
            h for h in self.health_history
            if datetime.fromisoformat(h["timestamp"]).timestamp() > cutoff
        ]
        
        if not recent_history:
            return {"message": "No recent health data"}
        
        avg_cpu = sum(h["metrics"]["cpu_percent"] for h in recent_history) / len(recent_history)
        avg_memory = sum(h["metrics"]["memory_percent"] for h in recent_history) / len(recent_history)
        
        alert_count = sum(len(h["alerts"]) for h in recent_history)
        worst_status = max(
            recent_history,
            key=lambda x: {"healthy": 0, "degraded": 1, "critical": 2}[x["status"]]
        )["status"]
        
        return {
            "period_minutes": last_minutes,
            "checks_count": len(recent_history),
            "average_cpu_percent": round(avg_cpu, 1),
            "average_memory_percent": round(avg_memory, 1),
            "total_alerts": alert_count,
            "current_status": self.health_history[-1]["status"],
            "worst_status": worst_status,
            "active_alerts": self.active_alerts
        }

class GracefulShutdownHandler:
    def __init__(self):
        self.shutdown_handlers: List[callable] = []
        self.is_shutting_down = False
    
    def register_handler(self, handler: callable):
        self.shutdown_handlers.append(handler)
    
    def initiate_shutdown(self, reason: str = "User request"):
        if self.is_shutting_down:
            return
        
        self.is_shutting_down = True
        logger.info(f"Initiating graceful shutdown: {reason}")
        
        for handler in reversed(self.shutdown_handlers):
            try:
                handler_name = getattr(handler, "__name__", str(handler))
                logger.info(f"Running shutdown handler: {handler_name}")
                handler()
            except Exception as e:
                logger.error(f"Error in shutdown handler: {e}")
        
        logger.info("Graceful shutdown completed")

class PerformanceProfiler:
    def __init__(self):
        self.profiling_data: Dict[str, List[float]] = {}
        self.enabled = True
    
    def profile(self, name: str):
        def decorator(func):
            import functools
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                if not self.enabled:
                    return await func(*args, **kwargs)
                
                start = time.perf_counter()
                try:
                    return await func(*args, **kwargs)
                finally:
                    elapsed = (time.perf_counter() - start) * 1000
                    self._record(name, elapsed)
            
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                if not self.enabled:
                    return func(*args, **kwargs)
                
                start = time.perf_counter()
                try:
                    return func(*args, **kwargs)
                finally:
                    elapsed = (time.perf_counter() - start) * 1000
                    self._record(name, elapsed)
            
            import asyncio
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            return sync_wrapper
        return decorator
    
    def _record(self, name: str, elapsed_ms: float):
        if name not in self.profiling_data:
            self.profiling_data[name] = []
        self.profiling_data[name].append(elapsed_ms)
        
        if len(self.profiling_data[name]) > 10000:
            self.profiling_data[name] = self.profiling_data[name][-10000:]
    
    def get_stats(self, name: Optional[str] = None) -> Dict[str, Any]:
        if name:
            times = self.profiling_data.get(name, [])
            if not times:
                return {}
            return {
                "name": name,
                "count": len(times),
                "avg_ms": round(sum(times) / len(times), 2),
                "min_ms": round(min(times), 2),
                "max_ms": round(max(times), 2),
                "p50_ms": round(self._percentile(times, 50), 2),
                "p95_ms": round(self._percentile(times, 95), 2),
                "p99_ms": round(self._percentile(times, 99), 2)
            }
        
        return {name: self.get_stats(name) for name in self.profiling_data.keys()}
    
    def _percentile(self, data: List[float], p: int) -> float:
        sorted_data = sorted(data)
        k = (len(sorted_data) - 1) * p / 100
        f = int(k)
        c = f + 1
        if f >= len(sorted_data) - 1:
            return sorted_data[-1]
        return sorted_data[f] + (sorted_data[c] - sorted_data[f]) * (k - f)

class SystemAdapter:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if hasattr(self, '_initialized'):
            return
        self._initialized = True
        
        self.system_info = SystemInfo()
        self.resource_limiter = ResourceLimiter(self.system_info)
        self.offline_manager = OfflineModeManager()
        self.health_monitor = SystemHealthMonitor()
        self.shutdown_handler = GracefulShutdownHandler()
        self.profiler = PerformanceProfiler()
        
        self.shutdown_handler.register_handler(self.health_monitor.stop_monitoring)
        
        logger.info(f"System adapter initialized for {self.system_info.os_type}")
    
    def initialize(self):
        self.resource_limiter.apply_limits()
        self.health_monitor.start_monitoring(interval_seconds=30)
        
        if not self.offline_manager.check_offline_readiness()["ready"]:
            logger.info("Creating offline mode placeholder files")
            self.offline_manager.create_placeholder_files()
    
    def get_status(self) -> Dict[str, Any]:
        return {
            "system_info": self.system_info.to_dict(),
            "resource_limits": self.resource_limiter.get_limits(),
            "offline_mode": {
                "enabled": self.offline_manager.is_offline_mode,
                "readiness": self.offline_manager.check_offline_readiness()
            },
            "health": self.health_monitor.get_health_summary(),
            "performance": self.profiler.get_stats()
        }
