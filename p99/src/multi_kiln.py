import numpy as np
import json
from typing import Dict, List, Optional, Tuple, Callable
from dataclasses import dataclass
from .simulation import KilnSimulation
from .numerical import Interpolator


@dataclass
class KilnUnit:
    kiln_id: str
    simulation: KilnSimulation
    results: Optional[Dict] = None
    status: str = 'idle'
    start_time: float = 0.0
    priority: int = 1


@dataclass
class SharedResource:
    resource_id: str
    total_capacity: float
    current_usage: float = 0.0
    max_continuous_usage: float = float('inf')
    recovery_rate: float = 0.0


class EnergyManager:
    def __init__(self, total_power: float = 1000.0):
        self.total_power = total_power
        self.power_allocation: Dict[str, float] = {}
        self.usage_history: List[Tuple[float, Dict[str, float]]] = []

    def allocate_power(self, kiln_demands: Dict[str, float],
                        time: float) -> Dict[str, float]:
        total_demand = sum(kiln_demands.values())

        if total_demand <= self.total_power:
            allocation = kiln_demands.copy()
        else:
            ratio = self.total_power / total_demand
            allocation = {k: v * ratio for k, v in kiln_demands.items()}

        self.power_allocation = allocation
        self.usage_history.append((time, allocation.copy()))
        return allocation

    def get_peak_usage(self) -> float:
        if not self.usage_history:
            return 0.0
        return max(sum(usage.values()) for _, usage in self.usage_history)

    def get_total_energy(self, dt: float = 1.0) -> float:
        total = 0.0
        for _, usage in self.usage_history:
            total += sum(usage.values()) * dt
        return total


class ExhaustSystem:
    def __init__(self, max_capacity: float = 100.0):
        self.max_capacity = max_capacity
        self.emission_history: List[Tuple[float, Dict[str, float]]] = []
        self.temperature: float = 298.15

    def calculate_emission(self, kiln_temps: Dict[str, float],
                            flow_rates: Dict[str, float]) -> float:
        total_emission = sum(flow_rates.values())
        return min(total_emission, self.max_capacity)

    def update_temperature(self, kiln_temps: Dict[str, float],
                            flow_rates: Dict[str, float]):
        total_flow = sum(flow_rates.values())
        if total_flow > 0:
            weighted_temp = sum(kiln_temps[k] * flow_rates[k] for k in kiln_temps) / total_flow
            self.temperature = 0.9 * self.temperature + 0.1 * weighted_temp


class MultiKilnCoordinator:
    def __init__(self, total_power: float = 1000.0, exhaust_capacity: float = 100.0):
        self.kilns: Dict[str, KilnUnit] = {}
        self.energy_manager = EnergyManager(total_power)
        self.exhaust_system = ExhaustSystem(exhaust_capacity)
        self.shared_resources: Dict[str, SharedResource] = {}
        self.schedule: List[Tuple[float, float, str]] = []
        self.global_results: Dict = {}

    def add_kiln(self, kiln_id: str, config: Dict, start_time: float = 0.0,
                  priority: int = 1) -> str:
        sim = KilnSimulation(config)
        kiln_unit = KilnUnit(
            kiln_id=kiln_id,
            simulation=sim,
            start_time=start_time,
            priority=priority
        )
        self.kilns[kiln_id] = kiln_unit
        return kiln_id

    def add_shared_resource(self, resource_id: str, total_capacity: float,
                             max_continuous: float = float('inf'),
                             recovery_rate: float = 0.0):
        self.shared_resources[resource_id] = SharedResource(
            resource_id=resource_id,
            total_capacity=total_capacity,
            max_continuous_usage=max_continuous,
            recovery_rate=recovery_rate
        )

    def set_schedule(self, schedule: List[Tuple[float, float, str]]):
        self.schedule = sorted(schedule, key=lambda x: x[0])

    def _calculate_power_demand(self, active_kilns: List[str],
                                 global_time: float) -> Dict[str, float]:
        demands = {}
        for kiln_id in active_kilns:
            kiln = self.kilns[kiln_id]
            relative_time = global_time - kiln.start_time

            if relative_time >= 0 and kiln.results is not None:
                time_idx = np.searchsorted(kiln.results['time'], relative_time)
                if time_idx < len(kiln.results['time']):
                    temp = kiln.results['kiln_temperature'][time_idx]
                    base_demand = kiln.simulation.config['kiln'].get('base_power', 100.0)
                    temp_factor = temp / 1000.0
                    demands[kiln_id] = base_demand * temp_factor * 0.5

        return demands

    def _calculate_flow_rates(self, active_kilns: List[str],
                               global_time: float) -> Dict[str, float]:
        flows = {}
        for kiln_id in active_kilns:
            kiln = self.kilns[kiln_id]
            relative_time = global_time - kiln.start_time

            if relative_time >= 0 and kiln.results is not None:
                time_idx = np.searchsorted(kiln.results['time'], relative_time)
                if time_idx < len(kiln.results['time']):
                    flows[kiln_id] = 5.0 + 0.01 * (
                        kiln.results['kiln_temperature'][time_idx] - 298.15
                    )

        return flows

    def run_coordinated_simulation(self, total_time: float,
                                    time_step: float = 60.0) -> Dict:
        print(f"开始多窑炉协同模拟，总时间: {total_time/3600:.1f}小时")
        print(f"窑炉数量: {len(self.kilns)}")

        for kiln_id, kiln in self.kilns.items():
            print(f"  运行窑炉 {kiln_id} 独立仿真...")
            kiln.results = kiln.simulation.run()
            kiln.status = 'completed'

        global_time_array = np.arange(0, total_time + time_step, time_step)

        energy_usage = []
        exhaust_flow = []
        temp_distributions = {}

        for t in global_time_array:
            active_kilns = [
                kid for kid, kiln in self.kilns.items()
                if kiln.start_time <= t < kiln.start_time + kiln.simulation.config['simulation']['total_time']
            ]

            power_demands = self._calculate_power_demand(active_kilns, t)
            power_allocation = self.energy_manager.allocate_power(power_demands, t)
            total_power = sum(power_allocation.values())
            energy_usage.append(total_power)

            flow_rates = self._calculate_flow_rates(active_kilns, t)
            total_flow = self.exhaust_system.calculate_emission(
                {kid: self.kilns[kid].results['kiln_temperature'][
                    min(np.searchsorted(self.kilns[kid].results['time'],
                                        t - self.kilns[kid].start_time),
                        len(self.kilns[kid].results['time']) - 1)
                ] for kid in active_kilns if self.kilns[kid].results},
                flow_rates
            )
            exhaust_flow.append(total_flow)

            for kiln_id in active_kilns:
                if kiln_id not in temp_distributions:
                    temp_distributions[kiln_id] = []
                kiln = self.kilns[kiln_id]
                rel_time = t - kiln.start_time
                if rel_time >= 0 and kiln.results is not None:
                    time_idx = min(np.searchsorted(kiln.results['time'], rel_time),
                                    len(kiln.results['time']) - 1)
                    temp_distributions[kiln_id].append(kiln.results['kiln_temperature'][time_idx])
                else:
                    temp_distributions[kiln_id].append(np.nan)

        self.global_results = {
            'time': global_time_array,
            'total_energy_usage': np.array(energy_usage),
            'total_exhaust_flow': np.array(exhaust_flow),
            'kiln_temperatures': {k: np.array(v) for k, v in temp_distributions.items()},
            'kiln_results': {kid: kiln.results for kid, kiln in self.kilns.items()},
            'energy_history': self.energy_manager.usage_history
        }

        print("多窑炉协同模拟完成!")
        print(f"  峰值能耗: {np.max(energy_usage):.1f} kW")
        print(f"  总能耗: {self.energy_manager.get_total_energy(time_step)/3600:.1f} kWh")
        print(f"  峰值废气流量: {np.max(exhaust_flow):.1f} m³/h")

        return self.global_results

    def get_kiln_status(self, kiln_id: str) -> Dict:
        if kiln_id not in self.kilns:
            return {'error': 'Kiln not found'}

        kiln = self.kilns[kiln_id]
        return {
            'kiln_id': kiln_id,
            'status': kiln.status,
            'start_time': kiln.start_time,
            'priority': kiln.priority,
            'has_results': kiln.results is not None
        }

    def save_results(self, filepath: str):
        save_dict = {
            'global_time': self.global_results['time'].tolist(),
            'total_energy_usage': self.global_results['total_energy_usage'].tolist(),
            'total_exhaust_flow': self.global_results['total_exhaust_flow'].tolist(),
            'kiln_temperatures': {
                k: v.tolist() for k, v in self.global_results['kiln_temperatures'].items()
            },
            'kiln_ids': list(self.kilns.keys()),
            'energy_summary': {
                'peak_usage': float(self.energy_manager.get_peak_usage()),
                'total_energy_kwh': float(self.energy_manager.get_total_energy() / 3600.0)
            }
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(save_dict, f, indent=2, ensure_ascii=False)

    def generate_schedule_report(self) -> Dict:
        report = {
            'total_kilns': len(self.kilns),
            'schedule_conflicts': self._detect_conflicts(),
            'energy_efficiency': self._calculate_efficiency(),
            'resource_utilization': self._calculate_resource_utilization()
        }
        return report

    def _detect_conflicts(self) -> List[Dict]:
        conflicts = []
        if not self.schedule:
            return conflicts

        for i, (start1, end1, kiln1) in enumerate(self.schedule):
            for start2, end2, kiln2 in self.schedule[i+1:]:
                if start1 < end2 and start2 < end1:
                    conflicts.append({
                        'type': 'time_overlap',
                        'kilns': [kiln1, kiln2],
                        'overlap_period': [max(start1, start2), min(end1, end2)]
                    })
        return conflicts

    def _calculate_efficiency(self) -> Dict:
        if not self.global_results:
            return {}

        peak_power = np.max(self.global_results['total_energy_usage'])
        avg_power = np.mean(self.global_results['total_energy_usage'])
        load_factor = avg_power / peak_power if peak_power > 0 else 0.0

        return {
            'peak_power_kw': float(peak_power),
            'average_power_kw': float(avg_power),
            'load_factor': float(load_factor)
        }

    def _calculate_resource_utilization(self) -> Dict:
        utilization = {}
        for rid, resource in self.shared_resources.items():
            utilization[rid] = {
                'total_capacity': resource.total_capacity,
                'current_usage': resource.current_usage
            }
        return utilization
