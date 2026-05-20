import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams
from typing import Dict, Optional, List, Any, Tuple

rcParams['font.sans-serif'] = ['DejaVu Sans', 'Arial']
rcParams['axes.unicode_minus'] = False
rcParams['figure.dpi'] = 100
rcParams['figure.figsize'] = (12, 8)


class FiringVisualization:
    def __init__(self, style: str = 'default'):
        plt.style.use(style)
        self.fig = None
        self.axes = None

    def plot_temperature_curve(self, time: np.ndarray, temperature: np.ndarray,
                               title: str = "烧制温度曲线", ax=None, **kwargs):
        if ax is None:
            fig, ax = plt.subplots(figsize=(10, 6))

        label = kwargs.pop('label', '温度')
        ax.plot(time / 60, temperature, linewidth=2, label=label, **kwargs)
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel('温度 (°C)', fontsize=12, color='#e74c3c')
        ax.tick_params(axis='y', labelcolor='#e74c3c')
        ax.set_title(title, fontsize=14, pad=15)
        ax.grid(True, alpha=0.3)

        heating_zones = [
            (0, 200, "干燥阶段", '#f39c12'),
            (200, 600, "氧化阶段", '#e74c3c'),
            (600, 1000, "烧成阶段", '#9b59b6'),
            (1000, 1300, "玻化阶段", '#3498db'),
        ]

        for ymin, ymax, label_text, color in heating_zones:
            ax.axhspan(ymin, ymax, alpha=0.1, color=color)
            ax.text(ax.get_xlim()[1], (ymin + ymax) / 2, label_text,
                    va='center', ha='right', fontsize=9, alpha=0.7)

        if ax.get_legend_handles_labels()[0]:
            ax.legend(loc='upper left')

        return ax

    def plot_humidity_curve(self, time: np.ndarray, humidity: np.ndarray,
                            title: str = "湿度变化曲线", ax=None, **kwargs):
        if ax is None:
            fig, ax = plt.subplots(figsize=(10, 6))

        label = kwargs.pop('label', '湿度')
        ax.plot(time / 60, humidity, linewidth=2, color='#3498db', label=label, **kwargs)
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel('相对湿度 (%)', fontsize=12, color='#3498db')
        ax.tick_params(axis='y', labelcolor='#3498db')
        ax.set_title(title, fontsize=14, pad=15)
        ax.grid(True, alpha=0.3)
        ax.set_ylim(bottom=0)

        if ax.get_legend_handles_labels()[0]:
            ax.legend(loc='upper right')

        return ax

    def plot_oxygen_curve(self, time: np.ndarray, oxygen: np.ndarray,
                          title: str = "氧气浓度变化曲线", ax=None, **kwargs):
        if ax is None:
            fig, ax = plt.subplots(figsize=(10, 6))

        label = kwargs.pop('label', '氧气浓度')
        line, = ax.plot(time / 60, oxygen, linewidth=2, color='#2ecc71', label=label, **kwargs)
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel('氧气浓度 (%)', fontsize=12, color='#2ecc71')
        ax.tick_params(axis='y', labelcolor='#2ecc71')
        ax.set_title(title, fontsize=14, pad=15)
        ax.grid(True, alpha=0.3)

        hline = ax.axhline(y=21, color='gray', linestyle='--', alpha=0.5, label='空气中氧气浓度')
        span = ax.axhspan(0, 8, alpha=0.1, color='red', label='还原气氛区')

        handles = [line, hline]
        labels = [label, '空气中氧气浓度']
        ax.legend(handles, labels, loc='upper right')

        return ax

    def plot_shrinkage_curve(self, time: np.ndarray, shrinkage: np.ndarray,
                             temperature: Optional[np.ndarray] = None,
                             title: str = "坯体收缩率变化曲线", ax=None, **kwargs):
        if ax is None:
            fig, ax = plt.subplots(figsize=(10, 6))

        label = kwargs.pop('label', '收缩率')
        line1, = ax.plot(time / 60, shrinkage, linewidth=2, color='#9b59b6', label=label, **kwargs)
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel('收缩率 (%)', fontsize=12, color='#9b59b6')
        ax.tick_params(axis='y', labelcolor='#9b59b6')
        ax.set_title(title, fontsize=14, pad=15)
        ax.grid(True, alpha=0.3)

        if temperature is not None:
            ax2 = ax.twinx()
            line2, = ax2.plot(time / 60, temperature, linewidth=1, color='#e74c3c', alpha=0.7, label='温度')
            ax2.set_ylabel('温度 (°C)', color='#e74c3c')
            ax2.tick_params(axis='y', labelcolor='#e74c3c')

            lines = [line1, line2]
            labels = [line1.get_label(), line2.get_label()]
            ax.legend(lines, labels, loc='upper left')

        else:
            ax.legend(handles=[line1], loc='upper left')

        return ax

    def plot_all_parameters(self, simulation_results: Dict[str, np.ndarray],
                            save_path: Optional[str] = None):
        time = simulation_results['time']
        temp = simulation_results['temperature']
        humidity = simulation_results['humidity']
        oxygen = simulation_results['oxygen']
        shrinkage = simulation_results['shrinkage']

        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        fig.suptitle('陶艺烧制过程参数模拟', fontsize=16, y=0.98)

        self.plot_temperature_curve(time, temp, ax=axes[0, 0], title='温度曲线')
        self.plot_humidity_curve(time, humidity, ax=axes[0, 1], title='湿度曲线')
        self.plot_oxygen_curve(time, oxygen, ax=axes[1, 0], title='氧气浓度曲线')
        self.plot_shrinkage_curve(time, shrinkage, temp, ax=axes[1, 1], title='收缩率曲线')

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, dpi=150, bbox_inches='tight')

        return fig, axes

    def plot_comparison(self, time1: np.ndarray, data1: np.ndarray,
                        time2: np.ndarray, data2: np.ndarray,
                        label1: str = "模拟值", label2: str = "实测值",
                        ylabel: str = "数值", title: str = "参数对比",
                        ax=None):
        if ax is None:
            fig, ax = plt.subplots(figsize=(10, 6))

        ax.plot(time1 / 60, data1, label=label1, linewidth=2, alpha=0.8)
        ax.plot(time2 / 60, data2, label=label2, linewidth=2, alpha=0.8, linestyle='--')
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel(ylabel, fontsize=12)
        ax.set_title(title, fontsize=14, pad=15)
        ax.legend()
        ax.grid(True, alpha=0.3)

        return ax

    def plot_temperature_shrinkage_relation(self, temperature: np.ndarray,
                                            shrinkage: np.ndarray,
                                            ax=None):
        if ax is None:
            fig, ax = plt.subplots(figsize=(10, 6))

        ax.plot(temperature, shrinkage, linewidth=2, color='#c0392b')
        ax.set_xlabel('温度 (°C)', fontsize=12)
        ax.set_ylabel('收缩率 (%)', fontsize=12)
        ax.set_title('温度-收缩率关系曲线', fontsize=14, pad=15)
        ax.grid(True, alpha=0.3)

        critical_points = [573, 900, 1200]
        for tp in critical_points:
            idx = np.argmin(np.abs(temperature - tp))
            ax.axvline(x=tp, color='gray', linestyle='--', alpha=0.5)
            ax.plot(tp, shrinkage[idx], 'ro', markersize=8)
            ax.annotate(f'{tp}°C', (tp, shrinkage[idx]),
                        xytext=(10, 10), textcoords='offset points')

        return ax

    def plot_3d_surface(self, x: np.ndarray, y: np.ndarray, z: np.ndarray,
                        xlabel: str = 'X', ylabel: str = 'Y', zlabel: str = 'Z',
                        title: str = '3D Surface'):
        from mpl_toolkits.mplot3d import Axes3D

        fig = plt.figure(figsize=(12, 8))
        ax = fig.add_subplot(111, projection='3d')

        X, Y = np.meshgrid(x, y)
        surf = ax.plot_surface(X, Y, z, cmap='viridis', alpha=0.8)

        ax.set_xlabel(xlabel, fontsize=12)
        ax.set_ylabel(ylabel, fontsize=12)
        ax.set_zlabel(zlabel, fontsize=12)
        ax.set_title(title, fontsize=14, pad=20)

        fig.colorbar(surf, shrink=0.5, aspect=5)

        return fig, ax

    def plot_heatmap(self, data: np.ndarray, xlabel: str = 'X', ylabel: str = 'Y',
                     title: str = '热力图', cmap: str = 'hot'):
        fig, ax = plt.subplots(figsize=(10, 8))

        im = ax.imshow(data, cmap=cmap, aspect='auto', interpolation='nearest')
        ax.set_xlabel(xlabel, fontsize=12)
        ax.set_ylabel(ylabel, fontsize=12)
        ax.set_title(title, fontsize=14, pad=15)

        plt.colorbar(im, ax=ax)

        return fig, ax

    @staticmethod
    def show():
        plt.show()

    @staticmethod
    def save(filename: str, **kwargs):
        plt.savefig(filename, **kwargs)
        plt.close()

    def plot_multi_kiln_comparison(self, time: np.ndarray,
                                    kiln_temperatures: Dict[str, np.ndarray],
                                    title: str = "多窑炉温度对比",
                                    show_load: bool = False,
                                    load_profiles: Optional[Dict[str, np.ndarray]] = None):
        n_kilns = len(kiln_temperatures)
        if show_load and load_profiles:
            fig, axes = plt.subplots(2, 1, figsize=(14, 10), sharex=True)
            ax_temp, ax_load = axes
        else:
            fig, ax_temp = plt.subplots(figsize=(14, 6))
            ax_load = None

        colors = plt.cm.tab10(np.linspace(0, 1, max(n_kilns, 10)))
        for i, (kid, temp) in enumerate(kiln_temperatures.items()):
            ax_temp.plot(time / 60, temp, label=f'{kid}', color=colors[i], linewidth=2)
        ax_temp.set_ylabel('温度 (°C)', fontsize=12)
        ax_temp.set_title(title, fontsize=14, pad=15)
        ax_temp.legend(loc='best')
        ax_temp.grid(True, alpha=0.3)

        if ax_load is not None and load_profiles:
            total_load = np.zeros_like(time)
            for i, (kid, load) in enumerate(load_profiles.items()):
                ax_load.plot(time / 60, load, label=f'{kid}', color=colors[i],
                            linestyle='--', alpha=0.7)
                total_load += load
            ax_load.plot(time / 60, total_load, label='总负荷', color='black',
                        linewidth=2.5, alpha=0.8)
            ax_load.set_xlabel('时间 (分钟)', fontsize=12)
            ax_load.set_ylabel('功率负荷 (kW)', fontsize=12)
            ax_load.legend(loc='best')
            ax_load.grid(True, alpha=0.3)
        else:
            ax_temp.set_xlabel('时间 (分钟)', fontsize=12)

        plt.tight_layout()
        return fig, axes if show_load else fig

    def plot_anomaly_markers(self, time: np.ndarray, data: np.ndarray,
                              alerts: List, ax=None, ylabel: str = '数值'):
        if ax is None:
            fig, ax = plt.subplots(figsize=(12, 6))

        ax.plot(time / 60, data, linewidth=1.5, alpha=0.7, label=ylabel)

        severity_colors = {'HIGH': 'red', 'MEDIUM': 'orange', 'LOW': 'yellow'}
        for alert in alerts:
            t_idx = np.argmin(np.abs(time - alert.timestamp))
            y_val = data[t_idx]
            ax.scatter(alert.timestamp / 60, y_val,
                      color=severity_colors.get(alert.severity, 'gray'),
                      s=100, zorder=5, edgecolors='black', linewidths=1.5)
            ax.annotate(alert.alert_type,
                       (alert.timestamp / 60, y_val),
                       xytext=(10, 10), textcoords='offset points',
                       fontsize=8, rotation=45)

        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel(ylabel, fontsize=12)
        ax.set_title(f'{ylabel}异常检测', fontsize=14, pad=15)
        ax.grid(True, alpha=0.3)
        ax.legend()

        from matplotlib.lines import Line2D
        legend_elements = [
            Line2D([0], [0], marker='o', color='w', markerfacecolor='red',
                  markersize=10, label='高风险'),
            Line2D([0], [0], marker='o', color='w', markerfacecolor='orange',
                  markersize=10, label='中风险'),
            Line2D([0], [0], marker='o', color='w', markerfacecolor='yellow',
                  markersize=10, label='低风险')
        ]
        ax.legend(handles=legend_elements, loc='upper right')

        return ax

    def plot_simulation_vs_real(self, time_sim: np.ndarray, data_sim: np.ndarray,
                                 time_real: np.ndarray, data_real: np.ndarray,
                                 param_name: str = '温度', units: str = '°C'):
        fig, axes = plt.subplots(2, 1, figsize=(14, 10), gridspec_kw={'height_ratios': [3, 1]})
        ax_plot, ax_err = axes

        ax_plot.plot(time_sim / 60, data_sim, label='仿真值', linewidth=2, color='blue', alpha=0.8)
        ax_plot.plot(time_real / 60, data_real, label='实际值', linewidth=2, color='red',
                    alpha=0.8, linestyle='--')
        ax_plot.set_ylabel(f'{param_name} ({units})', fontsize=12)
        ax_plot.set_title(f'{param_name}仿真与实际对比', fontsize=14, pad=15)
        ax_plot.legend(loc='best')
        ax_plot.grid(True, alpha=0.3)

        from scipy.interpolate import interp1d
        common_time = np.union1d(time_sim, time_real)
        sim_interp = interp1d(time_sim, data_sim, kind='linear', fill_value='extrapolate')
        real_interp = interp1d(time_real, data_real, kind='linear', fill_value='extrapolate')
        error = sim_interp(common_time) - real_interp(common_time)

        ax_err.fill_between(common_time / 60, error, 0, alpha=0.3, color='purple')
        ax_err.plot(common_time / 60, error, color='purple', linewidth=1, alpha=0.7)
        ax_err.axhline(y=0, color='black', linestyle='-', alpha=0.5)
        ax_err.set_xlabel('时间 (分钟)', fontsize=12)
        ax_err.set_ylabel(f'偏差 ({units})', fontsize=12)
        ax_err.set_title('误差曲线', fontsize=12, pad=10)
        ax_err.grid(True, alpha=0.3)

        plt.tight_layout()
        return fig, axes

    def plot_comparison_radar(self, metrics_dict: Dict[str, Any]):
        params = list(metrics_dict.keys())
        n_params = len(params)

        angles = np.linspace(0, 2 * np.pi, n_params, endpoint=False)
        angles = np.concatenate((angles, [angles[0]]))

        similarities = [metrics_dict[p].profile_similarity for p in params]
        similarities.append(similarities[0])

        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))
        ax.plot(angles, similarities, 'o-', linewidth=2, label='相似度')
        ax.fill(angles, similarities, alpha=0.25)

        ax.set_xticks(angles[:-1])
        ax.set_xticklabels([p.upper() for p in params], fontsize=10)
        ax.set_ylim(0, 1)
        ax.set_yticks([0.25, 0.5, 0.75, 1.0])
        ax.set_yticklabels(['0.25', '0.5', '0.75', '1.0'])
        ax.set_title('各参数拟合质量雷达图', fontsize=14, pad=20)
        ax.grid(True)
        ax.legend(loc='upper right', bbox_to_anchor=(1.1, 1.1))

        plt.tight_layout()
        return fig, ax

    def plot_performance_benchmark(self, calc_times: Dict[str, List[float]], title: str = "性能对比"):
        labels = list(calc_times.keys())
        means = [np.mean(times) for times in calc_times.values()]
        stds = [np.std(times) for times in calc_times.values()]

        fig, ax = plt.subplots(figsize=(10, 6))
        x_pos = np.arange(len(labels))
        ax.bar(x_pos, means, yerr=stds, capsize=10, alpha=0.7, color='steelblue')
        ax.set_ylabel('计算时间 (秒)', fontsize=12)
        ax.set_title(title, fontsize=14, pad=15)
        ax.set_xticks(x_pos)
        ax.set_xticklabels(labels, rotation=45, ha='right')
        ax.grid(True, alpha=0.3, axis='y')

        for i, (mean, std) in enumerate(zip(means, stds)):
            ax.text(i, mean + std + 0.01, f'{mean:.3f}s', ha='center', fontsize=10)

        plt.tight_layout()
        return fig, ax

    def plot_multi_batch_comparison(self, batch_data: Dict[str, Dict[str, float]],
                                     metric: str = 'quality_score',
                                     title: str = "批次参数对比"):
        batches = list(batch_data.keys())
        params = list(batch_data[batches[0]].keys())
        n_batches = len(batches)
        n_params = len(params)

        fig, axes = plt.subplots(1, n_params, figsize=(4 * n_params, 6))
        if n_params == 1:
            axes = [axes]

        colors = plt.cm.Set3(np.linspace(0, 1, n_batches))

        for idx, param in enumerate(params):
            values = [batch_data[batch][param] for batch in batches]
            axes[idx].bar(range(n_batches), values, color=colors, alpha=0.8)
            axes[idx].set_title(param, fontsize=12)
            axes[idx].set_xticks(range(n_batches))
            axes[idx].set_xticklabels([f"B{i+1}" for i in range(n_batches)], rotation=45)
            axes[idx].grid(True, alpha=0.3, axis='y')

        plt.suptitle(title, fontsize=14, y=1.02)
        plt.tight_layout()
        return fig, axes

    def plot_quality_distribution(self, quality_scores: List[float],
                                   title: str = "品质分数分布"):
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

        ax1.hist(quality_scores, bins=10, edgecolor='black', alpha=0.7, color='skyblue')
        ax1.axvline(np.mean(quality_scores), color='red', linestyle='--', linewidth=2,
                   label=f'均值: {np.mean(quality_scores):.2f}')
        ax1.set_xlabel('品质分数', fontsize=11)
        ax1.set_ylabel('频次', fontsize=11)
        ax1.set_title('分布直方图', fontsize=12)
        ax1.legend()
        ax1.grid(True, alpha=0.3)

        ax2.boxplot(quality_scores, vert=True, patch_artist=True)
        ax2.set_ylabel('品质分数', fontsize=11)
        ax2.set_title('箱线图', fontsize=12)
        ax2.grid(True, alpha=0.3, axis='y')

        plt.suptitle(title, fontsize=14, y=1.02)
        plt.tight_layout()
        return fig, (ax1, ax2)

    def plot_trend_analysis(self, time_points: List[str], values: List[float],
                            trend_slope: float, metric_name: str = "品质分数",
                            title: str = "趋势分析"):
        fig, ax = plt.subplots(figsize=(12, 6))

        x_indices = range(len(time_points))
        ax.plot(x_indices, values, 'o-', linewidth=2, markersize=6, label=metric_name)

        z = np.polyfit(x_indices, values, 1)
        p = np.poly1d(z)
        ax.plot(x_indices, p(x_indices), 'r--', linewidth=2,
               label=f'趋势线 (斜率: {trend_slope:.3f})')

        ax.set_xlabel('时间', fontsize=12)
        ax.set_ylabel(metric_name, fontsize=12)
        ax.set_title(title, fontsize=14, pad=15)
        ax.set_xticks(x_indices)
        ax.set_xticklabels(time_points, rotation=45)
        ax.legend()
        ax.grid(True, alpha=0.3)

        trend_direction = "改善" if trend_slope > 0 else "下降" if trend_slope < 0 else "稳定"
        ax.text(0.02, 0.98, f'趋势方向: {trend_direction}',
               transform=ax.transAxes, verticalalignment='top',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))

        plt.tight_layout()
        return fig, ax

    def plot_correlation_heatmap(self, data_matrix: Dict[str, List[float]],
                                  title: str = "参数相关性热力图"):
        import pandas as pd
        df = pd.DataFrame(data_matrix)
        corr_matrix = df.corr()

        fig, ax = plt.subplots(figsize=(10, 8))
        im = ax.imshow(corr_matrix, cmap='coolwarm', aspect='auto', vmin=-1, vmax=1)

        ax.set_xticks(range(len(corr_matrix.columns)))
        ax.set_yticks(range(len(corr_matrix.columns)))
        ax.set_xticklabels(corr_matrix.columns, rotation=45, ha='right')
        ax.set_yticklabels(corr_matrix.columns)

        for i in range(len(corr_matrix.columns)):
            for j in range(len(corr_matrix.columns)):
                ax.text(j, i, f'{corr_matrix.iloc[i, j]:.2f}',
                       ha='center', va='center', color='white' if abs(corr_matrix.iloc[i, j]) > 0.5 else 'black')

        plt.colorbar(im, ax=ax)
        ax.set_title(title, fontsize=14, pad=15)
        plt.tight_layout()
        return fig, ax

    def plot_defect_statistics(self, defect_counts: Dict[str, int],
                                 title: str = "缺陷类型统计"):
        sorted_defects = sorted(defect_counts.items(), key=lambda x: -x[1])
        labels = [d[0] for d in sorted_defects]
        counts = [d[1] for d in sorted_defects]

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))

        colors = plt.cm.Reds(np.linspace(0.3, 0.9, len(labels)))
        bars = ax1.bar(range(len(labels)), counts, color=colors, edgecolor='black')
        ax1.set_xlabel('缺陷类型', fontsize=11)
        ax1.set_ylabel('发生次数', fontsize=11)
        ax1.set_title('缺陷频次统计', fontsize=12)
        ax1.set_xticks(range(len(labels)))
        ax1.set_xticklabels(labels, rotation=45, ha='right')
        ax1.grid(True, alpha=0.3, axis='y')

        for bar, count in zip(bars, counts):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                    str(count), ha='center', va='bottom', fontsize=10)

        total = sum(counts)
        ax2.pie(counts, labels=labels, autopct='%1.1f%%', startangle=90, colors=colors)
        ax2.set_title('缺陷占比', fontsize=12)

        plt.suptitle(title, fontsize=14, y=1.02)
        plt.tight_layout()
        return fig, (ax1, ax2)

    def plot_process_scheme_radar(self, schemes: List[Dict[str, Any]],
                                    title: str = "工艺方案对比雷达图"):
        params = ['target_temp', 'heating_rate', 'holding_time', 'cooling_rate']
        param_labels = ['烧成温度', '升温速率', '保温时间', '降温速率']

        angles = np.linspace(0, 2 * np.pi, len(params), endpoint=False)
        angles = np.concatenate((angles, [angles[0]]))

        fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))

        colors = plt.cm.tab10(np.linspace(0, 1, len(schemes)))

        for idx, scheme in enumerate(schemes):
            values = [scheme['config'][p] for p in params]
            values.append(values[0])

            max_vals = [1400, 300, 240, 200]
            norm_values = [v / m for v, m in zip(values, max_vals + [max_vals[0]])]

            ax.plot(angles, norm_values, 'o-', linewidth=2, color=colors[idx],
                   label=scheme.get('name', f'方案{idx+1}'))
            ax.fill(angles, norm_values, alpha=0.15, color=colors[idx])

        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(param_labels, fontsize=11)
        ax.set_ylim(0, 1)
        ax.set_yticks([0.2, 0.4, 0.6, 0.8, 1.0])
        ax.set_yticklabels(['20%', '40%', '60%', '80%', '100%'])
        ax.set_title(title, fontsize=14, pad=20)
        ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))
        ax.grid(True)

        plt.tight_layout()
        return fig, ax
