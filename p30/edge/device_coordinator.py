#!/usr/bin/env python3
"""
多边缘设备协同调度模块
实现设备管理、任务分配、负载均衡和协同决策
"""

import time
import threading
import queue
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import uuid


class DeviceType(Enum):
    """设备类型"""
    CAMERA = "camera"
    WEATHER_STATION = "weather_station"
    SOIL_SENSOR = "soil_sensor"
    TRAP = "trap"
    DRONE = "drone"
    PROCESSING_NODE = "processing_node"


class DeviceStatus(Enum):
    """设备状态"""
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    IDLE = "idle"
    ERROR = "error"
    MAINTENANCE = "maintenance"


class TaskPriority(Enum):
    """任务优先级"""
    CRITICAL = 0
    HIGH = 1
    MEDIUM = 2
    LOW = 3


class TaskStatus(Enum):
    """任务状态"""
    PENDING = "pending"
    ASSIGNED = "assigned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class DeviceInfo:
    """设备信息"""
    device_id: str
    device_type: DeviceType
    region_id: str
    name: str = ""
    
    status: DeviceStatus = DeviceStatus.OFFLINE
    last_heartbeat: float = 0.0
    ip_address: str = ""
    
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    disk_usage: float = 0.0
    network_latency: float = 0.0
    battery_level: Optional[float] = None
    
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    
    capabilities: List[str] = field(default_factory=list)
    current_tasks: List[str] = field(default_factory=list)
    
    metadata: Dict = field(default_factory=dict)


@dataclass
class Task:
    """任务"""
    task_id: str
    task_type: str
    priority: TaskPriority
    
    source_device: Optional[str] = None
    target_device: Optional[str] = None
    region_id: str = "default"
    
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    
    created_time: float = field(default_factory=time.time)
    assigned_time: Optional[float] = None
    started_time: Optional[float] = None
    completed_time: Optional[float] = None
    
    timeout: int = 300
    max_retries: int = 3
    retry_count: int = 0
    
    requirements: Dict = field(default_factory=dict)
    parameters: Dict = field(default_factory=dict)
    result: Optional[Dict] = None
    error_message: str = ""
    
    callback_url: Optional[str] = None


class LoadBalancer:
    """负载均衡器"""
    
    def __init__(self):
        self._weight_cache: Dict[str, float] = {}
    
    def calculate_device_score(self, device: DeviceInfo, task: Task) -> float:
        """计算设备适合度得分"""
        if device.status not in [DeviceStatus.ONLINE, DeviceStatus.IDLE]:
            return 0.0
        
        score = 100.0
        
        cpu_penalty = device.cpu_usage * 0.5
        mem_penalty = device.memory_usage * 0.3
        latency_penalty = min(device.network_latency / 100, 0.2) * 100
        
        score -= (cpu_penalty + mem_penalty + latency_penalty)
        
        if task.task_type not in device.capabilities:
            score *= 0.3
        
        if len(device.current_tasks) > 0:
            score *= max(0.5, 1 - len(device.current_tasks) * 0.1)
        
        if device.battery_level is not None:
            if device.battery_level < 20:
                score *= 0.2
            elif device.battery_level < 50:
                score *= 0.7
        
        return max(0.0, score)
    
    def select_best_device(self, devices: List[DeviceInfo], task: Task) -> Optional[DeviceInfo]:
        """选择最优设备"""
        best_device = None
        best_score = -1
        
        for device in devices:
            score = self.calculate_device_score(device, task)
            if score > best_score:
                best_score = score
                best_device = device
        
        return best_device if best_score > 10 else None


class TaskScheduler:
    """任务调度器"""
    
    def __init__(self):
        self._task_queue: queue.PriorityQueue = queue.PriorityQueue()
        self._task_map: Dict[str, Task] = {}
        self._lock = threading.Lock()
    
    def submit_task(self, task: Task) -> str:
        """提交任务"""
        with self._lock:
            self._task_map[task.task_id] = task
            self._task_queue.put((task.priority.value, task.task_id))
        return task.task_id
    
    def get_next_task(self, timeout: int = 1) -> Optional[Task]:
        """获取下一个待处理任务"""
        try:
            _, task_id = self._task_queue.get(timeout=timeout)
            with self._lock:
                return self._task_map.get(task_id)
        except queue.Empty:
            return None
    
    def update_task_status(self, task_id: str, status: TaskStatus, **kwargs):
        """更新任务状态"""
        with self._lock:
            task = self._task_map.get(task_id)
            if task:
                task.status = status
                for key, value in kwargs.items():
                    if hasattr(task, key):
                        setattr(task, key, value)
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务信息"""
        with self._lock:
            return self._task_map.get(task_id)
    
    def get_pending_tasks(self) -> List[Task]:
        """获取所有待处理任务"""
        with self._lock:
            return [
                t for t in self._task_map.values()
                if t.status in [TaskStatus.PENDING, TaskStatus.ASSIGNED]
            ]
    
    def cleanup_completed_tasks(self, older_than_hours: int = 24):
        """清理已完成的任务"""
        cutoff = time.time() - older_than_hours * 3600
        with self._lock:
            to_remove = [
                tid for tid, task in self._task_map.items()
                if task.completed_time and task.completed_time < cutoff
            ]
            for tid in to_remove:
                del self._task_map[tid]


class DeviceCoordinator:
    """设备协调器"""
    
    def __init__(self):
        self._devices: Dict[str, DeviceInfo] = {}
        self._region_devices: Dict[str, List[str]] = defaultdict(list)
        self._device_lock = threading.Lock()
        
        self._scheduler = TaskScheduler()
        self._load_balancer = LoadBalancer()
        
        self._callbacks: Dict[str, List[Callable]] = {
            'device_connected': [],
            'device_disconnected': [],
            'task_completed': [],
            'task_failed': [],
        }
        
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        
        self._task_results: Dict[str, Any] = {}
        self._region_stats: Dict[str, Dict] = defaultdict(dict)
    
    def register_callback(self, event_type: str, callback: Callable):
        """注册事件回调"""
        if event_type in self._callbacks:
            self._callbacks[event_type].append(callback)
    
    def _trigger_callback(self, event_type: str, *args, **kwargs):
        """触发回调"""
        for callback in self._callbacks.get(event_type, []):
            try:
                callback(*args, **kwargs)
            except Exception as e:
                print(f"Callback error for {event_type}: {e}")
    
    def register_device(self, device_info: DeviceInfo) -> bool:
        """注册设备"""
        with self._device_lock:
            device_id = device_info.device_id
            if device_id in self._devices:
                self._devices[device_id].last_heartbeat = time.time()
                self._devices[device_id].status = DeviceStatus.ONLINE
                return False
            
            self._devices[device_id] = device_info
            self._devices[device_id].last_heartbeat = time.time()
            self._devices[device_id].status = DeviceStatus.ONLINE
            
            if device_id not in self._region_devices[device_info.region_id]:
                self._region_devices[device_info.region_id].append(device_id)
            
            self._update_region_stats(device_info.region_id)
        
        self._trigger_callback('device_connected', device_info)
        return True
    
    def unregister_device(self, device_id: str):
        """注销设备"""
        with self._device_lock:
            device = self._devices.pop(device_id, None)
            if device:
                if device_id in self._region_devices.get(device.region_id, []):
                    self._region_devices[device.region_id].remove(device_id)
                self._update_region_stats(device.region_id)
        
        self._trigger_callback('device_disconnected', device_id)
    
    def update_heartbeat(self, device_id: str, status_data: Dict = None):
        """更新心跳"""
        with self._device_lock:
            device = self._devices.get(device_id)
            if not device:
                return False
            
            device.last_heartbeat = time.time()
            
            if status_data:
                for key, value in status_data.items():
                    if hasattr(device, key):
                        setattr(device, key, value)
            
            if device.status == DeviceStatus.OFFLINE:
                device.status = DeviceStatus.ONLINE
            
            self._update_region_stats(device.region_id)
        
        return True
    
    def get_device_info(self, device_id: str) -> Optional[DeviceInfo]:
        """获取设备信息"""
        with self._device_lock:
            return self._devices.get(device_id)
    
    def get_region_devices(self, region_id: str, device_type: Optional[DeviceType] = None) -> List[DeviceInfo]:
        """获取区域内的设备"""
        with self._device_lock:
            device_ids = self._region_devices.get(region_id, [])
            devices = [self._devices[did] for did in device_ids if did in self._devices]
            
            if device_type:
                devices = [d for d in devices if d.device_type == device_type]
            
            return devices
    
    def get_all_devices(self) -> List[DeviceInfo]:
        """获取所有设备"""
        with self._device_lock:
            return list(self._devices.values())
    
    def submit_task(self, task_type: str, region_id: str = "default",
                    priority: TaskPriority = TaskPriority.MEDIUM,
                    parameters: Dict = None, requirements: Dict = None,
                    target_device: Optional[str] = None) -> str:
        """提交任务"""
        task = Task(
            task_id=str(uuid.uuid4()),
            task_type=task_type,
            priority=priority,
            region_id=region_id,
            parameters=parameters or {},
            requirements=requirements or {},
            target_device=target_device,
        )
        
        return self._scheduler.submit_task(task)
    
    def _assign_task(self, task: Task) -> bool:
        """分配任务"""
        if task.target_device:
            device = self.get_device_info(task.target_device)
            if device and device.status in [DeviceStatus.ONLINE, DeviceStatus.IDLE]:
                return self._assign_to_device(task, device)
            return False
        
        region_devices = self.get_region_devices(task.region_id)
        if not region_devices:
            region_devices = self.get_all_devices()
        
        suitable_devices = [
            d for d in region_devices
            if task.task_type in d.capabilities
            and d.status in [DeviceStatus.ONLINE, DeviceStatus.IDLE]
        ]
        
        if not suitable_devices:
            return False
        
        best_device = self._load_balancer.select_best_device(suitable_devices, task)
        if best_device:
            return self._assign_to_device(task, best_device)
        
        return False
    
    def _assign_to_device(self, task: Task, device: DeviceInfo) -> bool:
        """将任务分配给指定设备"""
        task.target_device = device.device_id
        task.assigned_time = time.time()
        task.status = TaskStatus.ASSIGNED
        
        with self._device_lock:
            if device.device_id in self._devices:
                self._devices[device.device_id].current_tasks.append(task.task_id)
                self._devices[device.device_id].status = DeviceStatus.BUSY
        
        self._scheduler.update_task_status(
            task.task_id,
            TaskStatus.ASSIGNED,
            assigned_time=time.time()
        )
        
        return True
    
    def start_task(self, task_id: str) -> bool:
        """开始执行任务"""
        task = self._scheduler.get_task(task_id)
        if not task:
            return False
        
        task.status = TaskStatus.RUNNING
        task.started_time = time.time()
        return True
    
    def complete_task(self, task_id: str, result: Dict = None) -> bool:
        """完成任务"""
        task = self._scheduler.get_task(task_id)
        if not task:
            return False
        
        task.status = TaskStatus.COMPLETED
        task.completed_time = time.time()
        task.result = result or {}
        
        with self._device_lock:
            if task.target_device in self._devices:
                device = self._devices[task.target_device]
                device.completed_tasks += 1
                if task_id in device.current_tasks:
                    device.current_tasks.remove(task_id)
                if not device.current_tasks:
                    device.status = DeviceStatus.IDLE
        
        self._task_results[task_id] = result
        self._trigger_callback('task_completed', task)
        return True
    
    def fail_task(self, task_id: str, error_message: str = "") -> bool:
        """任务失败"""
        task = self._scheduler.get_task(task_id)
        if not task:
            return False
        
        task.retry_count += 1
        task.error_message = error_message
        
        if task.retry_count < task.max_retries:
            task.status = TaskStatus.PENDING
            self._scheduler.submit_task(task)
        else:
            task.status = TaskStatus.FAILED
            task.completed_time = time.time()
            
            with self._device_lock:
                if task.target_device in self._devices:
                    device = self._devices[task.target_device]
                    device.failed_tasks += 1
                    if task_id in device.current_tasks:
                        device.current_tasks.remove(task_id)
                    if not device.current_tasks:
                        device.status = DeviceStatus.IDLE
            
            self._trigger_callback('task_failed', task, error_message)
        
        return True
    
    def start(self):
        """启动协调器"""
        if self._running:
            return
        
        self._running = True
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True
        )
        self._worker_thread.start()
        
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True
        )
        self._monitor_thread.start()
    
    def stop(self):
        """停止协调器"""
        self._running = False
        if self._worker_thread:
            self._worker_thread.join(timeout=5)
    
    def _worker_loop(self):
        """工作循环"""
        while self._running:
            task = self._scheduler.get_next_task(timeout=1)
            if task:
                if task.status == TaskStatus.PENDING:
                    assigned = self._assign_task(task)
                    if not assigned:
                        self._scheduler.submit_task(task)
                
                time.sleep(0.1)
            
            self._scheduler.cleanup_completed_tasks()
    
    def _monitor_loop(self):
        """监控循环 - 检查离线设备"""
        while self._running:
            time.sleep(30)
            self._check_offline_devices()
            self._scheduler.cleanup_completed_tasks()
    
    def _check_offline_devices(self):
        """检查离线设备"""
        timeout = 120
        now = time.time()
        
        with self._device_lock:
            for device_id, device in self._devices.items():
                if now - device.last_heartbeat > timeout:
                    if device.status != DeviceStatus.OFFLINE:
                        device.status = DeviceStatus.OFFLINE
                        self._trigger_callback('device_disconnected', device_id)
    
    def _update_region_stats(self, region_id: str):
        """更新区域统计"""
        devices = [
            self._devices[did]
            for did in self._region_devices.get(region_id, [])
            if did in self._devices
        ]
        
        online_count = sum(1 for d in devices if d.status != DeviceStatus.OFFLINE)
        busy_count = sum(1 for d in devices if d.status == DeviceStatus.BUSY)
        
        self._region_stats[region_id] = {
            'total_devices': len(devices),
            'online_devices': online_count,
            'busy_devices': busy_count,
            'online_rate': online_count / max(1, len(devices)),
            'last_update': time.time(),
        }
    
    def get_region_stats(self, region_id: str) -> Dict:
        """获取区域统计"""
        return self._region_stats.get(region_id, {})
    
    def get_coordinator_stats(self) -> Dict:
        """获取协调器统计"""
        all_devices = self.get_all_devices()
        
        return {
            'total_devices': len(all_devices),
            'online_devices': sum(1 for d in all_devices if d.status != DeviceStatus.OFFLINE),
            'offline_devices': sum(1 for d in all_devices if d.status == DeviceStatus.OFFLINE),
            'busy_devices': sum(1 for d in all_devices if d.status == DeviceStatus.BUSY),
            'idle_devices': sum(1 for d in all_devices if d.status == DeviceStatus.IDLE),
            'total_tasks_completed': sum(d.completed_tasks for d in all_devices),
            'total_tasks_failed': sum(d.failed_tasks for d in all_devices),
            'pending_tasks': len(self._scheduler.get_pending_tasks()),
            'regions_count': len(self._region_devices),
        }
    
    def broadcast_to_region(self, region_id: str, message: Dict) -> int:
        """广播消息到区域内所有设备"""
        devices = self.get_region_devices(region_id)
        sent_count = 0
        
        for device in devices:
            if device.status in [DeviceStatus.ONLINE, DeviceStatus.IDLE, DeviceStatus.BUSY]:
                sent_count += 1
        
        return sent_count
    
    def coordinate_monitoring(self, region_id: str, monitoring_type: str = "full") -> str:
        """协同监控调度"""
        requirements = {'monitoring_type': monitoring_type}
        
        if monitoring_type == "pest_survey":
            task_type = "image_capture"
            requirements['capability'] = "high_resolution_capture"
        elif monitoring_type == "environmental":
            task_type = "sensor_reading"
            requirements['device_type'] = DeviceType.WEATHER_STATION.value
        else:
            task_type = "composite_survey"
        
        return self.submit_task(
            task_type=task_type,
            region_id=region_id,
            priority=TaskPriority.HIGH,
            requirements=requirements
        )
