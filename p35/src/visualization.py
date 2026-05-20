import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from typing import Dict, Optional, List


class FermentationVisualizer:
    def __init__(self, results: Optional[Dict] = None):
        self.results = results
        self.style_config = {
            'font.family': 'sans-serif',
            'font.size': 10,
            'axes.labelsize': 11,
            'axes.titlesize': 12,
            'xtick.labelsize': 9,
            'ytick.labelsize': 9,
            'legend.fontsize': 9,
            'figure.dpi': 100
        }
        plt.rcParams.update(self.style_config)

    def set_results(self, results: Dict):
        self.results = results

    def _check_results(self):
        if self.results is None:
            raise ValueError("未设置仿真结果，请先调用set_results()或初始化时传入results")

        required_keys = ["time", "states", "state_names"]
        for key in required_keys:
            if key not in self.results:
                raise ValueError(f"仿真结果缺少必要的键: {key}")

        time = np.asarray(self.results["time"])
        states = np.asarray(self.results["states"])

        if states.ndim != 2:
            raise ValueError(f"states 应为二维数组，当前维度: {states.ndim}")

        n_vars, n_time = states.shape
        if n_time != len(time):
            raise ValueError(f"时间序列长度 ({len(time)}) 与状态数组列数 ({n_time}) 不匹配")

    def _clean_data_for_plot(self, data):
        data = np.asarray(data, dtype=np.float64)
        data = np.nan_to_num(data, nan=1.0, posinf=1e10, neginf=1.0)
        return data

    def plot_microbes_growth(self, save_path: Optional[str] = None, show_plot: bool = False):
        self._check_results()
        time = np.asarray(self.results["time"])
        states = np.asarray(self.results["states"])
        state_names = self.results["state_names"]

        fig, ax = plt.subplots(figsize=(10, 6))

        microbe_indices = []
        microbe_names = []
        for i, name in enumerate(state_names):
            if any(keyword in name for keyword in ["yeast", "bacteria", "aspergillus", "lactobacillus"]):
                microbe_indices.append(i)
                microbe_names.append(name.replace("_", " ").title())

        if len(microbe_indices) == 0:
            ax.text(0.5, 0.5, "无微生物数据", ha='center', va='center', transform=ax.transAxes)
            return fig, ax

        colors = plt.cm.Set2(np.linspace(0, 1, len(microbe_indices)))

        for idx, name, color in zip(microbe_indices, microbe_names, colors):
            microbe_data = self._clean_data_for_plot(states[idx, :])
            microbe_data = np.maximum(microbe_data, 1.0)
            ax.semilogy(time, microbe_data, label=name, color=color, linewidth=2, base=10)

        ax.set_xlabel("时间 (小时)")
        ax.set_ylabel("微生物浓度 (CFU/mL)")
        ax.set_title("发酵过程微生物生长曲线")

        if len(microbe_indices) > 0:
            ax.legend(loc="best")

        ax.grid(True, alpha=0.3, which="both")

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"图表已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig, ax

    def plot_substrate_conversion(self, save_path: Optional[str] = None, show_plot: bool = False):
        self._check_results()
        time = np.asarray(self.results["time"])
        states = np.asarray(self.results["states"])
        state_names = self.results["state_names"]

        fig, ax1 = plt.subplots(figsize=(10, 6))

        substrate_indices = []
        product_indices = []
        substrate_labels = []
        product_labels = []

        for i, name in enumerate(state_names):
            if name in ["sugar", "protein", "starch"]:
                substrate_indices.append((i, name))
            elif name in ["alcohol", "amino_acid"]:
                product_indices.append((i, name))

        if len(substrate_indices) == 0 and len(product_indices) == 0:
            ax1.text(0.5, 0.5, "无底物/产物数据", ha='center', va='center', transform=ax1.transAxes)
            return fig, (ax1, None)

        colors_sub = plt.cm.Blues(np.linspace(0.5, 0.8, max(1, len(substrate_indices))))
        colors_prod = plt.cm.Reds(np.linspace(0.5, 0.8, max(1, len(product_indices))))

        for (idx, name), color in zip(substrate_indices, colors_sub):
            label = f"{name.title()} (g/L)"
            sub_data = self._clean_data_for_plot(states[idx, :])
            ax1.plot(time, sub_data, label=label, color=color, linewidth=2)
            substrate_labels.append(label)

        ax1.set_xlabel("时间 (小时)")
        ax1.set_ylabel("底物浓度 (g/L)", color='darkblue')
        ax1.tick_params(axis='y', labelcolor='darkblue')
        ax1.grid(True, alpha=0.3)

        ax2 = None
        if len(product_indices) > 0:
            ax2 = ax1.twinx()
            for (idx, name), color in zip(product_indices, colors_prod):
                label = f"{name.replace('_', ' ').title()} (g/L)"
                prod_data = self._clean_data_for_plot(states[idx, :])
                ax2.plot(time, prod_data, label=label, color=color, linewidth=2, linestyle='--')
                product_labels.append(label)

            ax2.set_ylabel("产物浓度 (g/L)", color='darkred')
            ax2.tick_params(axis='y', labelcolor='darkred')

            lines1, labels1 = ax1.get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            all_lines = lines1 + lines2
            all_labels = labels1 + labels2
            if all_lines:
                ax1.legend(all_lines, all_labels, loc="center right")
        else:
            lines1, labels1 = ax1.get_legend_handles_labels()
            if lines1:
                ax1.legend(loc="best")

        ax1.set_title("发酵过程底物消耗与产物生成")

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"图表已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig, (ax1, ax2)

    def plot_ph_temperature(self, save_path: Optional[str] = None, show_plot: bool = False):
        self._check_results()
        time = np.asarray(self.results["time"])
        states = np.asarray(self.results["states"])
        state_names = self.results["state_names"]

        fig, ax1 = plt.subplots(figsize=(10, 6))

        try:
            temp_idx = state_names.index("temperature")
        except ValueError:
            ax1.text(0.5, 0.5, "无温度数据", ha='center', va='center', transform=ax1.transAxes)
            return fig, (ax1, None)

        try:
            ph_idx = state_names.index("ph")
        except ValueError:
            ph_idx = None

        color_temp = 'tab:red'
        color_ph = 'tab:blue'

        temp_data = self._clean_data_for_plot(states[temp_idx, :])
        ax1.plot(time, temp_data, color=color_temp, linewidth=2, label='温度')
        ax1.set_xlabel("时间 (小时)")
        ax1.set_ylabel("温度 (℃)", color=color_temp)
        ax1.tick_params(axis='y', labelcolor=color_temp)
        ax1.grid(True, alpha=0.3)

        ax2 = None
        if ph_idx is not None:
            ax2 = ax1.twinx()
            ph_data = self._clean_data_for_plot(states[ph_idx, :])
            ax2.plot(time, ph_data, color=color_ph, linewidth=2, linestyle='--', label='pH')
            ax2.set_ylabel("pH值", color=color_ph)
            ax2.tick_params(axis='y', labelcolor=color_ph)

            lines1, labels1 = ax1.get_legend_handles_labels()
            lines2, labels2 = ax2.get_legend_handles_labels()
            ax1.legend(lines1 + lines2, labels1 + labels2, loc="best")
        else:
            ax1.legend(loc="best")

        ax1.set_title("发酵过程温度与pH变化")

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"图表已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig, (ax1, ax2)

    def plot_combined_dashboard(self, save_path: Optional[str] = None, show_plot: bool = False):
        self._check_results()
        time = np.asarray(self.results["time"])
        states = np.asarray(self.results["states"])
        state_names = self.results["state_names"]

        fig = plt.figure(figsize=(14, 10))
        gs = GridSpec(2, 2, figure=fig, hspace=0.3, wspace=0.3)

        ax1 = fig.add_subplot(gs[0, 0])
        ax2 = fig.add_subplot(gs[0, 1])
        ax3 = fig.add_subplot(gs[1, 0])
        ax4 = fig.add_subplot(gs[1, 1])

        microbe_indices = []
        microbe_labels = []
        for i, name in enumerate(state_names):
            if any(keyword in name for keyword in ["yeast", "bacteria", "aspergillus", "lactobacillus"]):
                microbe_indices.append(i)
                microbe_labels.append(name.replace("_", " ").title())

        if microbe_indices:
            colors = plt.cm.Set2(np.linspace(0, 1, len(microbe_indices)))
            for idx, label, color in zip(microbe_indices, microbe_labels, colors):
                microbe_data = self._clean_data_for_plot(states[idx, :])
                microbe_data = np.maximum(microbe_data, 1.0)
                ax1.semilogy(time, microbe_data, label=label, color=color, linewidth=1.5, base=10)
            ax1.legend(fontsize=8)
        else:
            ax1.text(0.5, 0.5, "无微生物数据", ha='center', va='center', transform=ax1.transAxes)
        ax1.set_title("微生物生长")
        ax1.set_xlabel("时间 (h)")
        ax1.set_ylabel("浓度 (CFU/mL)")
        ax1.grid(True, alpha=0.3, which="both")

        substrate_idx = None
        product_idx = None
        for i, name in enumerate(state_names):
            if name in ["sugar", "protein", "starch"]:
                substrate_idx = i
            elif name in ["alcohol", "amino_acid"]:
                product_idx = i

        ax2_twin = None
        if substrate_idx is not None:
            sub_data = self._clean_data_for_plot(states[substrate_idx, :])
            ax2.plot(time, sub_data, color='tab:blue', linewidth=1.5,
                     label=state_names[substrate_idx].title())
        if product_idx is not None:
            ax2_twin = ax2.twinx()
            prod_data = self._clean_data_for_plot(states[product_idx, :])
            ax2_twin.plot(time, prod_data, color='tab:orange', linewidth=1.5, linestyle='--',
                          label=state_names[product_idx].replace('_', ' ').title())
            ax2_twin.set_ylabel(f"{state_names[product_idx].replace('_', ' ').title()} (g/L)")
        ax2.set_title("底物与产物")
        ax2.set_xlabel("时间 (h)")
        ax2.set_ylabel("底物浓度 (g/L)")
        ax2.grid(True, alpha=0.3)
        lines1, labels1 = ax2.get_legend_handles_labels()
        if product_idx is not None and ax2_twin is not None:
            lines2, labels2 = ax2_twin.get_legend_handles_labels()
            ax2.legend(lines1 + lines2, labels1 + labels2, fontsize=8)
        elif lines1:
            ax2.legend(fontsize=8)

        try:
            temp_idx = state_names.index("temperature")
            temp_data = self._clean_data_for_plot(states[temp_idx, :])
            ax3.plot(time, temp_data, color='tab:red', linewidth=1.5)
        except ValueError:
            ax3.text(0.5, 0.5, "无温度数据", ha='center', va='center', transform=ax3.transAxes)
        ax3.set_title("温度变化")
        ax3.set_xlabel("时间 (h)")
        ax3.set_ylabel("温度 (℃)")
        ax3.grid(True, alpha=0.3)

        try:
            ph_idx = state_names.index("ph")
            ph_data = self._clean_data_for_plot(states[ph_idx, :])
            ax4.plot(time, ph_data, color='tab:purple', linewidth=1.5)
        except ValueError:
            ax4.text(0.5, 0.5, "无pH数据", ha='center', va='center', transform=ax4.transAxes)
        ax4.set_title("pH变化")
        ax4.set_xlabel("时间 (h)")
        ax4.set_ylabel("pH")
        ax4.grid(True, alpha=0.3)

        ferm_type = self.results.get("config", {}).get("type", "unknown")
        fig.suptitle(f"发酵过程综合监控仪表盘 - {ferm_type}", fontsize=14, y=0.98)

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"综合仪表盘已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig

    def plot_sensor_data(self, sensor_data: Dict, save_path: Optional[str] = None, show_plot: bool = False):
        if not sensor_data or "temperature" not in sensor_data:
            raise ValueError("传感器数据缺少温度信息")

        temps = sensor_data["temperature"]
        n_samples = len(temps)
        if n_samples == 0:
            raise ValueError("传感器数据为空")

        time_points = np.arange(n_samples)

        has_humidity = sensor_data.get("humidity") and len(sensor_data["humidity"]) == n_samples
        has_ph = sensor_data.get("ph") and len(sensor_data["ph"]) == n_samples and any(p is not None for p in sensor_data["ph"])

        n_plots = 1 + (1 if has_humidity else 0) + (1 if has_ph else 0)
        fig, axes = plt.subplots(n_plots, 1, figsize=(10, 4 * n_plots), sharex=True)
        if n_plots == 1:
            axes = [axes]

        ax_idx = 0

        axes[ax_idx].plot(time_points, temps, 'r-', linewidth=1.5, alpha=0.8)
        axes[ax_idx].set_ylabel("温度 (℃)")
        axes[ax_idx].set_title("传感器采集数据")
        axes[ax_idx].grid(True, alpha=0.3)
        axes[ax_idx].legend(["温度"])
        ax_idx += 1

        if has_humidity:
            axes[ax_idx].plot(time_points, sensor_data["humidity"], 'b-', linewidth=1.5, alpha=0.8)
            axes[ax_idx].set_ylabel("湿度 (%)")
            axes[ax_idx].grid(True, alpha=0.3)
            axes[ax_idx].legend(["湿度"])
            ax_idx += 1

        if has_ph:
            ph_values = [p if p is not None else np.nan for p in sensor_data["ph"]]
            axes[ax_idx].plot(time_points, ph_values, 'g-', linewidth=1.5, alpha=0.8)
            axes[ax_idx].set_ylabel("pH")
            axes[ax_idx].set_xlabel("采样序号")
            axes[ax_idx].grid(True, alpha=0.3)
            axes[ax_idx].legend(["pH"])

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"传感器数据图表已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig, axes

    def plot_optimization_results(self, optimization_history: Dict, save_path: Optional[str] = None, show_plot: bool = False):
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))

        iterations = np.arange(len(optimization_history["quality_scores"]))
        axes[0].plot(iterations, optimization_history["quality_scores"], 'b-o', linewidth=2, markersize=4)
        axes[0].set_xlabel("迭代次数")
        axes[0].set_ylabel("质量分数")
        axes[0].set_title("优化过程质量分数变化")
        axes[0].grid(True, alpha=0.3)

        temperatures = optimization_history.get("temperatures", [])
        times = optimization_history.get("times", [])

        if temperatures and times:
            sc = axes[1].scatter(temperatures, times, c=optimization_history["quality_scores"],
                                 cmap='viridis', s=50, alpha=0.7)
            axes[1].set_xlabel("温度 (℃)")
            axes[1].set_ylabel("发酵时间 (小时)")
            axes[1].set_title("参数空间探索")
            axes[1].grid(True, alpha=0.3)
            plt.colorbar(sc, ax=axes[1], label="质量分数")

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"优化结果图表已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig, axes

    def plot_comparison(self, results_list: List[Dict], labels: List[str], save_path: Optional[str] = None, show_plot: bool = False):
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        axes = axes.flatten()

        colors = plt.cm.tab10(np.linspace(0, 1, len(results_list)))

        state_names = results_list[0]["state_names"]
        temp_idx = state_names.index("temperature")

        for results, label, color in zip(results_list, labels, colors):
            time = results["time"]
            states = results["states"]

            axes[0].plot(time, states[temp_idx, :], label=label, color=color, linewidth=1.5)

            microbe_idx = 0
            axes[1].semilogy(time, states[microbe_idx, :], label=label, color=color, linewidth=1.5)

            substrate_idx = 2 if results_list[0]["config"]["type"] == "rice_wine" else 3
            axes[2].plot(time, states[substrate_idx, :], label=label, color=color, linewidth=1.5)

            ph_idx = state_names.index("ph")
            axes[3].plot(time, states[ph_idx, :], label=label, color=color, linewidth=1.5)

        axes[0].set_title("温度对比")
        axes[0].set_xlabel("时间 (h)")
        axes[0].set_ylabel("温度 (℃)")
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)

        axes[1].set_title("主要微生物生长对比")
        axes[1].set_xlabel("时间 (h)")
        axes[1].set_ylabel("浓度 (CFU/mL)")
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)

        axes[2].set_title("底物消耗对比")
        axes[2].set_xlabel("时间 (h)")
        axes[2].set_ylabel("浓度 (g/L)")
        axes[2].legend()
        axes[2].grid(True, alpha=0.3)

        axes[3].set_title("pH变化对比")
        axes[3].set_xlabel("时间 (h)")
        axes[3].set_ylabel("pH")
        axes[3].legend()
        axes[3].grid(True, alpha=0.3)

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=150)
            print(f"对比图表已保存至: {save_path}")

        if show_plot:
            plt.show()

        return fig, axes
