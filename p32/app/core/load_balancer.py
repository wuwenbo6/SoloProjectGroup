import asyncio
import time
import hashlib
import random
from typing import List, Dict, Optional, Callable
from collections import defaultdict
from datetime import datetime, timedelta
import threading


class BackendServer:
    def __init__(self, server_id: str, host: str, port: int, weight: int = 100):
        self.server_id = server_id
        self.host = host
        self.port = port
        self.weight = weight
        self.current_weight = 0
        self.active_connections = 0
        self.total_requests = 0
        self.error_count = 0
        self.last_health_check = datetime.utcnow()
        self.is_healthy = True
        self.response_times = []
        self.max_response_times = 100

    def add_response_time(self, response_time: float):
        self.response_times.append(response_time)
        if len(self.response_times) > self.max_response_times:
            self.response_times.pop(0)

    @property
    def avg_response_time(self) -> float:
        if not self.response_times:
            return 0.0
        return sum(self.response_times) / len(self.response_times)

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"


class LoadBalancer:
    def __init__(self, algorithm: str = "round_robin"):
        self.servers: List[BackendServer] = []
        self.algorithm = algorithm
        self._rr_index = 0
        self._lock = threading.Lock()
        self.health_check_interval = 30
        self._health_check_task = None

    def add_server(self, server_id: str, host: str, port: int, weight: int = 100) -> BackendServer:
        server = BackendServer(server_id, host, port, weight)
        with self._lock:
            self.servers.append(server)
        return server

    def remove_server(self, server_id: str):
        with self._lock:
            self.servers = [s for s in self.servers if s.server_id != server_id]

    def get_healthy_servers(self) -> List[BackendServer]:
        return [s for s in self.servers if s.is_healthy]

    def _round_robin(self) -> Optional[BackendServer]:
        healthy = self.get_healthy_servers()
        if not healthy:
            return None
        with self._lock:
            server = healthy[self._rr_index % len(healthy)]
            self._rr_index += 1
        return server

    def _weighted_round_robin(self) -> Optional[BackendServer]:
        healthy = self.get_healthy_servers()
        if not healthy:
            return None
        with self._lock:
            total_weight = sum(s.weight for s in healthy)
            for server in healthy:
                server.current_weight += server.weight
                if server.current_weight >= total_weight:
                    server.current_weight -= total_weight
                    return server
        return None

    def _least_connections(self) -> Optional[BackendServer]:
        healthy = self.get_healthy_servers()
        if not healthy:
            return None
        return min(healthy, key=lambda s: s.active_connections)

    def _least_response_time(self) -> Optional[BackendServer]:
        healthy = self.get_healthy_servers()
        if not healthy:
            return None
        return min(healthy, key=lambda s: s.avg_response_time or float('inf'))

    def _ip_hash(self, client_ip: str) -> Optional[BackendServer]:
        healthy = self.get_healthy_servers()
        if not healthy:
            return None
        hash_val = int(hashlib.md5(client_ip.encode()).hexdigest()[:8], 16)
        return healthy[hash_val % len(healthy)]

    def get_server(self, client_ip: Optional[str] = None) -> Optional[BackendServer]:
        if self.algorithm == "round_robin":
            return self._round_robin()
        elif self.algorithm == "weighted_round_robin":
            return self._weighted_round_robin()
        elif self.algorithm == "least_connections":
            return self._least_connections()
        elif self.algorithm == "least_response_time":
            return self._least_response_time()
        elif self.algorithm == "ip_hash" and client_ip:
            return self._ip_hash(client_ip)
        else:
            return self._round_robin()

    def update_server_health(self, server_id: str, is_healthy: bool):
        with self._lock:
            for server in self.servers:
                if server.server_id == server_id:
                    server.is_healthy = is_healthy
                    server.last_health_check = datetime.utcnow()
                    break

    def get_statistics(self) -> Dict:
        with self._lock:
            return {
                "total_servers": len(self.servers),
                "healthy_servers": len(self.get_healthy_servers()),
                "algorithm": self.algorithm,
                "servers": [
                    {
                        "server_id": s.server_id,
                        "host": s.host,
                        "port": s.port,
                        "is_healthy": s.is_healthy,
                        "active_connections": s.active_connections,
                        "total_requests": s.total_requests,
                        "error_count": s.error_count,
                        "avg_response_time": s.avg_response_time,
                        "weight": s.weight
                    }
                    for s in self.servers
                ]
            }


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 30):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.states: Dict[str, Dict] = defaultdict(
            lambda: {
                "state": "closed",
                "failures": 0,
                "last_failure_time": None,
                "successes": 0
            }
        )
        self._lock = threading.Lock()

    def record_failure(self, key: str):
        with self._lock:
            state = self.states[key]
            state["failures"] += 1
            state["last_failure_time"] = datetime.utcnow()
            if state["state"] == "closed" and state["failures"] >= self.failure_threshold:
                state["state"] = "open"
            elif state["state"] == "half_open":
                state["state"] = "open"
                state["successes"] = 0

    def record_success(self, key: str):
        with self._lock:
            state = self.states[key]
            if state["state"] == "half_open":
                state["successes"] += 1
                if state["successes"] >= 3:
                    state["state"] = "closed"
                    state["failures"] = 0
                    state["successes"] = 0
            elif state["state"] == "closed":
                state["failures"] = max(0, state["failures"] - 1)

    def can_execute(self, key: str) -> bool:
        with self._lock:
            state = self.states[key]
            if state["state"] == "closed":
                return True
            elif state["state"] == "open":
                if state["last_failure_time"] and \
                   (datetime.utcnow() - state["last_failure_time"]).seconds >= self.recovery_timeout:
                    state["state"] = "half_open"
                    state["successes"] = 0
                    return True
                return False
            else:
                return True

    def get_state(self, key: str) -> str:
        return self.states[key]["state"]


_global_load_balancer = LoadBalancer(algorithm="weighted_round_robin")
_global_circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=30)


def get_load_balancer() -> LoadBalancer:
    return _global_load_balancer


def get_circuit_breaker() -> CircuitBreaker:
    return _global_circuit_breaker
