import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from typing import Optional, List, Dict, Any
import os

from tension_simulation import SimulationResult


class TensionVisualizer:
    def __init__(self, dpi: int = 100, figsize: tuple = (12, 8)):
        self.dpi = dpi
        self.figsize = figsize
        self.output_dir = 'output'
        self._ensure_output_dir()

    def _ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def _sanitize_data(self, data: np.ndarray) -> np.ndarray:
        data = np.nan_to_num(data, nan=0.0, posinf=1e6, neginf=0.0)
        return np.clip(data, 0, 1e6)

    def plot_tension_time_series(self,
                                  result: SimulationResult,
                                  node_index: int = 0,
                                  save_path: Optional[str] = None,
                                  show: bool = True) -> plt.Figure:
        num_nodes = result.warp_tension.shape[1]
        if node_index < 0 or node_index >= num_nodes:
            raise ValueError(f"节点索引超出范围，有效范围: 0 ~ {num_nodes - 1}")
        
        fig, axes = plt.subplots(2, 2, figsize=self.figsize, dpi=self.dpi)
        
        time = result.time
        if time is None or len(time) == 0:
            raise ValueError("时间数据为空")
        
        max_tension = max(
            np.max(self._sanitize_data(result.warp_tension[:, node_index])),
            np.max(self._sanitize_data(result.weft_tension[:, node_index])),
            np.max(self._sanitize_data(result.contact_tension[:, node_index])),
            np.max(self._sanitize_data(result.total_tension[:, node_index]))
        )
        y_max = max_tension * 1.1 if max_tension > 0 else 1000
        
        warp_data = self._sanitize_data(result.warp_tension[:, node_index])
        axes[0, 0].plot(time, warp_data, 'b-', linewidth=2, label='经向张力')
        axes[0, 0].set_xlabel('时间 (s)')
        axes[0, 0].set_ylabel('张力 (N)')
        axes[0, 0].set_title('经向张力随时间变化')
        axes[0, 0].grid(True, alpha=0.3)
        axes[0, 0].legend()
        axes[0, 0].set_ylim(bottom=0, top=y_max)
        axes[0, 0].set_xlim(left=time[0], right=time[-1])
        
        weft_data = self._sanitize_data(result.weft_tension[:, node_index])
        axes[0, 1].plot(time, weft_data, 'r-', linewidth=2, label='纬向张力')
        axes[0, 1].set_xlabel('时间 (s)')
        axes[0, 1].set_ylabel('张力 (N)')
        axes[0, 1].set_title('纬向张力随时间变化')
        axes[0, 1].grid(True, alpha=0.3)
        axes[0, 1].legend()
        axes[0, 1].set_ylim(bottom=0, top=y_max)
        axes[0, 1].set_xlim(left=time[0], right=time[-1])
        
        contact_data = self._sanitize_data(result.contact_tension[:, node_index])
        axes[1, 0].plot(time, contact_data, 'g-', linewidth=2, label='接触张力')
        axes[1, 0].set_xlabel('时间 (s)')
        axes[1, 0].set_ylabel('张力 (N)')
        axes[1, 0].set_title('接触张力随时间变化')
        axes[1, 0].grid(True, alpha=0.3)
        axes[1, 0].legend()
        axes[1, 0].set_ylim(bottom=0, top=y_max)
        axes[1, 0].set_xlim(left=time[0], right=time[-1])
        
        total_data = self._sanitize_data(result.total_tension[:, node_index])
        axes[1, 1].plot(time, total_data, 'k-', linewidth=2, label='总张力')
        axes[1, 1].set_xlabel('时间 (s)')
        axes[1, 1].set_ylabel('张力 (N)')
        axes[1, 1].set_title('总张力随时间变化')
        axes[1, 1].grid(True, alpha=0.3)
        axes[1, 1].legend()
        axes[1, 1].set_ylim(bottom=0, top=y_max * 1.5)
        axes[1, 1].set_xlim(left=time[0], right=time[-1])
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_tension_comparison(self,
                                 result: SimulationResult,
                                 time_index: int = -1,
                                 save_path: Optional[str] = None,
                                 show: bool = True) -> plt.Figure:
        num_steps = result.warp_tension.shape[0]
        if time_index < -num_steps or time_index >= num_steps:
            raise ValueError(f"时间步索引超出范围，有效范围: {-num_steps} ~ {num_steps - 1}")
        
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        num_nodes = result.warp_tension.shape[1]
        x = np.arange(num_nodes)
        
        warp_data = self._sanitize_data(result.warp_tension[time_index, :])
        weft_data = self._sanitize_data(result.weft_tension[time_index, :])
        contact_data = self._sanitize_data(result.contact_tension[time_index, :])
        total_data = self._sanitize_data(result.total_tension[time_index, :])
        
        max_tension = max(np.max(warp_data), np.max(weft_data), 
                          np.max(contact_data), np.max(total_data))
        y_max = max_tension * 1.1 if max_tension > 0 else 1000
        
        ax.plot(x, warp_data, 'bo-', linewidth=2, markersize=6, label='经向张力')
        ax.plot(x, weft_data, 'rs-', linewidth=2, markersize=6, label='纬向张力')
        ax.plot(x, contact_data, 'g^-', linewidth=2, markersize=6, label='接触张力')
        ax.plot(x, total_data, 'kd-', linewidth=2, markersize=6, label='总张力')
        
        ax.set_xlabel('节点索引')
        ax.set_ylabel('张力 (N)')
        ax.set_title(f'各分量张力对比 (时间步 {time_index})')
        ax.grid(True, alpha=0.3)
        ax.legend()
        ax.set_ylim(bottom=0, top=y_max)
        ax.set_xlim(left=0, right=num_nodes - 1)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_tension_heatmap(self,
                              result: SimulationResult,
                              tension_type: str = 'total',
                              save_path: Optional[str] = None,
                              show: bool = True) -> plt.Figure:
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        tension_data = {
            'warp': result.warp_tension,
            'weft': result.weft_tension,
            'contact': result.contact_tension,
            'total': result.total_tension
        }
        
        if tension_type not in tension_data:
            raise ValueError(f"未知的张力类型: {tension_type}，可选: {list(tension_data.keys())}")
        
        data = self._sanitize_data(tension_data[tension_type])
        
        vmax = np.percentile(data, 95) if np.max(data) > 0 else 1000
        
        im = ax.imshow(data.T, aspect='auto', cmap='viridis', origin='lower',
                       extent=[result.time[0], result.time[-1], 0, data.shape[1]],
                       vmin=0, vmax=vmax)
        
        ax.set_xlabel('时间 (s)')
        ax.set_ylabel('节点索引')
        ax.set_title(f'{tension_type} 张力热力图')
        ax.set_xlim(left=result.time[0], right=result.time[-1])
        ax.set_ylim(bottom=0, top=data.shape[1])
        
        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label('张力 (N)')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_strain_displacement(self,
                                  result: SimulationResult,
                                  node_index: int = 0,
                                  save_path: Optional[str] = None,
                                  show: bool = True) -> plt.Figure:
        num_nodes = result.strain.shape[1] if len(result.strain.shape) > 1 else len(result.strain)
        if node_index < 0 or node_index >= num_nodes:
            raise ValueError(f"节点索引超出范围，有效范围: 0 ~ {num_nodes - 1}")
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=self.figsize, dpi=self.dpi)
        
        time = result.time
        
        strain_data = self._sanitize_data(result.strain[:, node_index] if len(result.strain.shape) > 1 else result.strain)
        disp_data = self._sanitize_data(result.displacement[:, node_index] if len(result.displacement.shape) > 1 else result.displacement)
        
        ax1.plot(time, strain_data, 'b-', linewidth=2)
        ax1.set_xlabel('时间 (s)')
        ax1.set_ylabel('应变')
        ax1.set_title('应变随时间变化')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim(bottom=0, top=np.max(strain_data) * 1.1 if np.max(strain_data) > 0 else 0.1)
        ax1.set_xlim(left=time[0], right=time[-1])
        
        ax2.plot(time, disp_data, 'r-', linewidth=2)
        ax2.set_xlabel('时间 (s)')
        ax2.set_ylabel('位移 (m)')
        ax2.set_title('位移随时间变化')
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim(bottom=0, top=np.max(disp_data) * 1.1 if np.max(disp_data) > 0 else 0.1)
        ax2.set_xlim(left=time[0], right=time[-1])
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_tension_statistics(self,
                                 result: SimulationResult,
                                 save_path: Optional[str] = None,
                                 show: bool = True) -> plt.Figure:
        fig = plt.figure(figsize=self.figsize, dpi=self.dpi)
        gs = GridSpec(2, 2, figure=fig)
        
        ax1 = fig.add_subplot(gs[0, :])
        
        tension_types = ['经向张力', '纬向张力', '接触张力', '总张力']
        
        warp_clean = self._sanitize_data(result.warp_tension)
        weft_clean = self._sanitize_data(result.weft_tension)
        contact_clean = self._sanitize_data(result.contact_tension)
        total_clean = self._sanitize_data(result.total_tension)
        
        mean_values = [
            np.mean(warp_clean),
            np.mean(weft_clean),
            np.mean(contact_clean),
            np.mean(total_clean)
        ]
        std_values = [
            np.std(warp_clean),
            np.std(weft_clean),
            np.std(contact_clean),
            np.std(total_clean)
        ]
        
        x = np.arange(len(tension_types))
        width = 0.35
        
        max_val = max(max(mean_values), max(std_values)) * 1.2
        ax1.bar(x - width/2, mean_values, width, label='平均值', color='skyblue', alpha=0.8)
        ax1.bar(x + width/2, std_values, width, label='标准差', color='salmon', alpha=0.8)
        ax1.set_ylim(bottom=0, top=max_val if max_val > 0 else 1000)
        ax1.set_xlabel('张力类型')
        ax1.set_ylabel('张力 (N)')
        ax1.set_title('各张力分量统计特征')
        ax1.set_xticks(x)
        ax1.set_xticklabels(tension_types)
        ax1.legend()
        ax1.grid(True, alpha=0.3, axis='y')
        
        ax2 = fig.add_subplot(gs[1, 0])
        
        max_values = [
            np.max(warp_clean),
            np.max(weft_clean),
            np.max(contact_clean),
            np.max(total_clean)
        ]
        
        if sum(max_values) == 0:
            max_values = [1, 1, 1, 1]
        
        colors = ['#ff9999', '#66b3ff', '#99ff99', '#ffcc99']
        ax2.pie(max_values, labels=tension_types, colors=colors, autopct='%1.1f%%', startangle=90)
        ax2.set_title('最大张力占比')
        
        ax3 = fig.add_subplot(gs[1, 1])
        
        time = result.time
        total_data = self._sanitize_data(result.total_tension[:, 0])
        cumulative_tension = np.cumsum(total_data) * (time[1] - time[0])
        
        ax3.plot(time, cumulative_tension, 'g-', linewidth=2)
        ax3.fill_between(time, 0, cumulative_tension, alpha=0.3, color='green')
        ax3.set_xlabel('时间 (s)')
        ax3.set_ylabel('累积张力冲量 (N·s)')
        ax3.set_title('累积张力冲量')
        ax3.grid(True, alpha=0.3)
        ax3.set_xlim(left=time[0], right=time[-1])
        ax3.set_ylim(bottom=0, top=np.max(cumulative_tension) * 1.1 if np.max(cumulative_tension) > 0 else 1000)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def compare_multiple_results(self,
                                  results: List[SimulationResult],
                                  labels: List[str],
                                  tension_type: str = 'total',
                                  node_index: int = 0,
                                  save_path: Optional[str] = None,
                                  show: bool = True) -> plt.Figure:
        fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        tension_data = {
            'warp': lambda r: r.warp_tension,
            'weft': lambda r: r.weft_tension,
            'contact': lambda r: r.contact_tension,
            'total': lambda r: r.total_tension
        }
        
        get_tension = tension_data.get(tension_type, lambda r: r.total_tension)
        
        for result, label in zip(results, labels):
            ax.plot(result.time, get_tension(result)[:, node_index], linewidth=2, label=label)
        
        ax.set_xlabel('时间 (s)')
        ax.set_ylabel('张力 (N)')
        ax.set_title(f'不同配置下的{tension_type}张力对比')
        ax.grid(True, alpha=0.3)
        ax.legend()
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def generate_report(self,
                        result: SimulationResult,
                        output_prefix: str = 'simulation_report',
                        show: bool = False):
        self.plot_tension_time_series(
            result,
            save_path=os.path.join(self.output_dir, f'{output_prefix}_time_series.png'),
            show=show
        )
        
        self.plot_tension_comparison(
            result,
            save_path=os.path.join(self.output_dir, f'{output_prefix}_comparison.png'),
            show=show
        )
        
        self.plot_tension_heatmap(
            result,
            tension_type='total',
            save_path=os.path.join(self.output_dir, f'{output_prefix}_heatmap.png'),
            show=show
        )
        
        self.plot_strain_displacement(
            result,
            save_path=os.path.join(self.output_dir, f'{output_prefix}_strain_displacement.png'),
            show=show
        )
        
        self.plot_tension_statistics(
            result,
            save_path=os.path.join(self.output_dir, f'{output_prefix}_statistics.png'),
            show=show
        )
        
        print(f"报告已生成到 {self.output_dir} 目录")

    def plot_weave_pattern_comparison(self,
                                       results: Dict[str, SimulationResult],
                                       save_path: Optional[str] = None,
                                       show: bool = True) -> plt.Figure:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5), dpi=self.dpi)
        
        patterns = list(results.keys())
        
        tension_means = []
        tension_maxs = []
        tension_stds = []
        
        for pattern in patterns:
            result = results[pattern]
            tension_means.append(np.mean(result.total_tension))
            tension_maxs.append(np.max(result.total_tension))
            tension_stds.append(np.std(result.total_tension))
        
        x = np.arange(len(patterns))
        width = 0.25
        
        axes[0].bar(x, tension_means, width, color='skyblue', alpha=0.8)
        axes[0].set_xlabel('编织方式')
        axes[0].set_ylabel('平均张力 (N)')
        axes[0].set_title('不同编织方式的平均张力')
        axes[0].set_xticks(x)
        axes[0].set_xticklabels(patterns)
        axes[0].grid(True, alpha=0.3, axis='y')
        
        axes[1].bar(x, tension_maxs, width, color='salmon', alpha=0.8)
        axes[1].set_xlabel('编织方式')
        axes[1].set_ylabel('最大张力 (N)')
        axes[1].set_title('不同编织方式的最大张力')
        axes[1].set_xticks(x)
        axes[1].set_xticklabels(patterns)
        axes[1].grid(True, alpha=0.3, axis='y')
        
        axes[2].bar(x, tension_stds, width, color='lightgreen', alpha=0.8)
        axes[2].set_xlabel('编织方式')
        axes[2].set_ylabel('张力标准差 (N)')
        axes[2].set_title('不同编织方式的张力波动')
        axes[2].set_xticks(x)
        axes[2].set_xticklabels(patterns)
        axes[2].grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_simulation_vs_test(self,
                                 times: np.ndarray,
                                 measured: np.ndarray,
                                 simulated: np.ndarray,
                                 save_path: Optional[str] = None,
                                 show: bool = True) -> plt.Figure:
        fig, axes = plt.subplots(2, 2, figsize=(14, 10), dpi=self.dpi)
        
        sorted_idx = np.argsort(times)
        times_sorted = times[sorted_idx]
        measured_sorted = measured[sorted_idx]
        simulated_sorted = simulated[sorted_idx]
        
        axes[0, 0].plot(times_sorted, measured_sorted, 'ro-', markersize=4, alpha=0.6, label='实测值')
        axes[0, 0].plot(times_sorted, simulated_sorted, 'b-', linewidth=2, label='仿真值')
        axes[0, 0].set_xlabel('时间 (s)')
        axes[0, 0].set_ylabel('张力 (N)')
        axes[0, 0].set_title('实测与仿真张力对比')
        axes[0, 0].legend()
        axes[0, 0].grid(True, alpha=0.3)
        
        error = measured_sorted - simulated_sorted
        axes[0, 1].plot(times_sorted, error, 'g-', linewidth=1.5)
        axes[0, 1].fill_between(times_sorted, 0, error, alpha=0.3, color='green')
        axes[0, 1].set_xlabel('时间 (s)')
        axes[0, 1].set_ylabel('误差 (N)')
        axes[0, 1].set_title('仿真误差随时间变化')
        axes[0, 1].axhline(y=0, color='k', linestyle='--', alpha=0.5)
        axes[0, 1].grid(True, alpha=0.3)
        
        max_val = max(np.max(measured_sorted), np.max(simulated_sorted))
        axes[1, 0].scatter(measured_sorted, simulated_sorted, alpha=0.6, s=30)
        axes[1, 0].plot([0, max_val], [0, max_val], 'r--', linewidth=2, label='理想线')
        axes[1, 0].set_xlabel('实测张力 (N)')
        axes[1, 0].set_ylabel('仿真张力 (N)')
        axes[1, 0].set_title('仿真-实测散点图')
        axes[1, 0].legend()
        axes[1, 0].grid(True, alpha=0.3)
        
        abs_error = np.abs(error)
        axes[1, 1].hist(abs_error, bins=20, color='orange', alpha=0.7, edgecolor='black')
        axes[1, 1].set_xlabel('绝对误差 (N)')
        axes[1, 1].set_ylabel('频数')
        axes[1, 1].set_title('误差分布直方图')
        axes[1, 1].grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_anomaly_detection(self,
                                result: SimulationResult,
                                anomaly_summary: Dict[str, Any],
                                save_path: Optional[str] = None,
                                show: bool = True) -> plt.Figure:
        num_anomalies = anomaly_summary['total_anomalies']
        
        if num_anomalies == 0:
            fig, ax = plt.subplots(figsize=(10, 6), dpi=self.dpi)
            ax.text(0.5, 0.5, '未检测到异常', ha='center', va='center', fontsize=16)
            ax.set_title('异常检测结果')
            ax.axis('off')
        else:
            fig = plt.figure(figsize=(15, 10), dpi=self.dpi)
            gs = fig.add_gridspec(3, 2)
            
            ax1 = fig.add_subplot(gs[0, :])
            for node in range(min(5, result.total_tension.shape[1])):
                ax1.plot(result.time, result.total_tension[:, node], 
                         label=f'节点 {node}', alpha=0.7)
            ax1.set_xlabel('时间 (s)')
            ax1.set_ylabel('张力 (N)')
            ax1.set_title('张力曲线与异常检测')
            ax1.legend()
            ax1.grid(True, alpha=0.3)
            
            for anomaly in anomaly_summary['anomalies']:
                if anomaly['node'] != -1:
                    color = {'HIGH': 'red', 'MEDIUM': 'orange', 'LOW': 'yellow'}.get(anomaly['severity'], 'gray')
                    ax1.axvline(x=anomaly['time'], color=color, linestyle='--', alpha=0.5)
            
            ax2 = fig.add_subplot(gs[1, 0])
            by_type = anomaly_summary['by_type']
            ax2.bar(range(len(by_type)), list(by_type.values()), color=['red', 'orange', 'blue', 'green'])
            ax2.set_xticks(range(len(by_type)))
            ax2.set_xticklabels(list(by_type.keys()), rotation=45)
            ax2.set_ylabel('数量')
            ax2.set_title('按类型统计异常')
            ax2.grid(True, alpha=0.3, axis='y')
            
            ax3 = fig.add_subplot(gs[1, 1])
            by_severity = anomaly_summary['by_severity']
            colors = ['red' if s == 'HIGH' else 'orange' if s == 'MEDIUM' else 'yellow' for s in by_severity.keys()]
            ax3.bar(range(len(by_severity)), list(by_severity.values()), color=colors)
            ax3.set_xticks(range(len(by_severity)))
            ax3.set_xticklabels(list(by_severity.keys()))
            ax3.set_ylabel('数量')
            ax3.set_title('按严重程度统计异常')
            ax3.grid(True, alpha=0.3, axis='y')
            
            ax4 = fig.add_subplot(gs[2, :])
            if len(anomaly_summary['anomalies']) > 0:
                anomaly_times = [a['time'] for a in anomaly_summary['anomalies']]
                severity_scores = {'HIGH': 3, 'MEDIUM': 2, 'LOW': 1}
                scores = [severity_scores.get(a['severity'], 1) for a in anomaly_summary['anomalies']]
                ax4.scatter(anomaly_times, scores, c=scores, cmap='RdYlGn_r', s=100)
                ax4.set_xlabel('时间 (s)')
                ax4.set_ylabel('严重程度')
                ax4.set_yticks([1, 2, 3])
                ax4.set_yticklabels(['低', '中', '高'])
                ax4.set_title('异常时间线')
                ax4.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig

    def plot_multi_pattern_tension(self,
                                    result: SimulationResult,
                                    pattern_names: List[str],
                                    save_path: Optional[str] = None,
                                    show: bool = True) -> plt.Figure:
        fig, axes = plt.subplots(2, 2, figsize=(14, 10), dpi=self.dpi)
        
        time = result.time
        num_nodes = result.total_tension.shape[1]
        
        for node in range(min(4, num_nodes)):
            axes[0, 0].plot(time, result.total_tension[:, node], 
                           label=f'节点 {node}', linewidth=1.5)
        axes[0, 0].set_xlabel('时间 (s)')
        axes[0, 0].set_ylabel('总张力 (N)')
        axes[0, 0].set_title('多编织方式协同张力曲线')
        axes[0, 0].legend()
        axes[0, 0].grid(True, alpha=0.3)
        
        mean_tension = np.mean(result.total_tension, axis=1)
        std_tension = np.std(result.total_tension, axis=1)
        axes[0, 1].plot(time, mean_tension, 'b-', linewidth=2, label='平均张力')
        axes[0, 1].fill_between(time, mean_tension - std_tension, 
                               mean_tension + std_tension, alpha=0.3, color='blue', label='±标准差')
        axes[0, 1].set_xlabel('时间 (s)')
        axes[0, 1].set_ylabel('张力 (N)')
        axes[0, 1].set_title('平均张力与波动范围')
        axes[0, 1].legend()
        axes[0, 1].grid(True, alpha=0.3)
        
        im = axes[1, 0].imshow(result.total_tension.T, aspect='auto', cmap='viridis',
                              origin='lower', extent=[time[0], time[-1], 0, num_nodes])
        axes[1, 0].set_xlabel('时间 (s)')
        axes[1, 0].set_ylabel('节点索引')
        axes[1, 0].set_title('张力热力图')
        plt.colorbar(im, ax=axes[1, 0], label='张力 (N)')
        
        if pattern_names:
            x_pos = np.linspace(0, num_nodes, len(pattern_names) + 1)
            for i, pattern in enumerate(pattern_names):
                axes[1, 1].text(0.5, (i + 0.5) / len(pattern_names), pattern,
                               ha='center', va='center', fontsize=12,
                               bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.5))
        axes[1, 1].set_title('编织方式分布')
        axes[1, 1].axis('off')
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight')
        
        if show:
            plt.show()
        
        return fig
