import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from typing import Dict, Optional, List, Tuple
import matplotlib.dates as mdates
from matplotlib import rcParams
from scipy.interpolate import interp1d

rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
rcParams['axes.unicode_minus'] = False


class FermentationVisualizer:
    def __init__(self, results: Optional[Dict] = None):
        self.results = results
        self.multi_strain_results = None
        self.figures = {}

    def set_results(self, results: Dict, is_multi_strain: bool = False) -> None:
        if is_multi_strain:
            self.multi_strain_results = results
        else:
            self.results = results

    def _clean_data(self, data: np.ndarray) -> np.ndarray:
        data = np.array(data, dtype=float)
        data = np.nan_to_num(data, nan=0, posinf=0, neginf=0)
        return data

    def _get_safe_range(self, data: np.ndarray, padding: float = 0.05) -> Tuple[float, float]:
        data = self._clean_data(data)
        if len(data) == 0 or np.all(data == 0):
            return (0, 1)
        min_val = np.min(data)
        max_val = np.max(data)
        if min_val == max_val:
            return (min_val * 0.9, max_val * 1.1)
        range_val = max_val - min_val
        return (min_val - padding * range_val, max_val + padding * range_val)

    def plot_multi_strain_growth(self, strain_names: Optional[List[str]] = None,
                                 show: bool = True, save_path: Optional[str] = None) -> plt.Figure:
        if self.multi_strain_results is None:
            raise ValueError("没有多菌株仿真结果")
        
        time = self._clean_data(self.multi_strain_results['time'])
        total_biomass = self._clean_data(self.multi_strain_results['total_biomass'])
        substrate = self._clean_data(self.multi_strain_results['substrate'])
        product = self._clean_data(self.multi_strain_results['product'])
        
        n_strains = sum(1 for k in self.multi_strain_results.keys() if k.startswith('biomass_'))
        
        colors = ['g', 'b', 'r', 'c', 'm', 'y', 'orange', 'purple']
        
        fig = plt.figure(figsize=(16, 12))
        gs = GridSpec(3, 2, figure=fig)
        
        ax1 = fig.add_subplot(gs[0, :])
        for i in range(n_strains):
            strain_biomass = self._clean_data(self.multi_strain_results[f'biomass_{i}'])
            name = strain_names[i] if strain_names and i < len(strain_names) else f'菌株{i+1}'
            ax1.plot(time, strain_biomass, color=colors[i % len(colors)], 
                    linewidth=2, label=name, alpha=0.8)
        
        ax1.plot(time, total_biomass, 'k-', linewidth=3, label='总生物量')
        ax1.set_xlabel('时间 (小时)', fontsize=12)
        ax1.set_ylabel('微生物浓度 (g/L)', fontsize=12)
        ax1.set_title('多菌株协同生长曲线', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.legend(loc='best')
        ax1.set_xlim(time[0], time[-1])
        
        ax2 = fig.add_subplot(gs[1, 0])
        ax2.plot(time, substrate, 'orange', linewidth=2)
        ax2.set_xlabel('时间 (小时)', fontsize=11)
        ax2.set_ylabel('底物浓度 (g/L)', fontsize=11)
        ax2.set_title('底物消耗', fontsize=12, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim(self._get_safe_range(substrate))
        ax2.set_xlim(time[0], time[-1])
        
        ax3 = fig.add_subplot(gs[1, 1])
        ax3.plot(time, product, 'purple', linewidth=2)
        ax3.set_xlabel('时间 (小时)', fontsize=11)
        ax3.set_ylabel('产物浓度 (g/L)', fontsize=11)
        ax3.set_title('产物生成', fontsize=12, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        ax3.set_ylim(self._get_safe_range(product))
        ax3.set_xlim(time[0], time[-1])
        
        ax4 = fig.add_subplot(gs[2, :])
        for i in range(n_strains):
            strain_biomass = self._clean_data(self.multi_strain_results[f'biomass_{i}'])
            proportion = strain_biomass / (total_biomass + 1e-10) * 100
            name = strain_names[i] if strain_names and i < len(strain_names) else f'菌株{i+1}'
            ax4.stackplot(time, proportion, labels=[name], alpha=0.6, 
                         colors=[colors[i % len(colors)]])
        
        ax4.set_xlabel('时间 (小时)', fontsize=12)
        ax4.set_ylabel('菌株占比 (%)', fontsize=12)
        ax4.set_title('菌株群落动态变化', fontsize=14, fontweight='bold')
        ax4.grid(True, alpha=0.3)
        ax4.legend(loc='best')
        ax4.set_xlim(time[0], time[-1])
        ax4.set_ylim(0, 100)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['multi_strain_growth'] = fig
        return fig

    def plot_simulation_vs_actual(self, actual_data: Dict, 
                                  variables: Optional[List[str]] = None,
                                  show: bool = True, 
                                  save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可对比的仿真结果")
        
        if variables is None:
            variables = ['temperature', 'biomass', 'substrate', 'product']
        
        biomass_key = 'total_biomass' if 'total_biomass' in results else 'biomass'
        if 'biomass' in variables and biomass_key != 'biomass':
            variables = [bi if bi != 'biomass' else biomass_key for bi in variables]
        
        time_sim = self._clean_data(results['time'])
        
        n_vars = len(variables)
        fig, axes = plt.subplots(n_vars, 2, figsize=(14, 5 * n_vars))
        if n_vars == 1:
            axes = axes.reshape(1, -1)
        
        for idx, var in enumerate(variables):
            ax1, ax2 = axes[idx]
            
            sim_data = self._clean_data(results[var])
            
            time_actual = np.array(actual_data['time'])
            actual_vals = np.array(actual_data[var] if var != biomass_key else actual_data.get('biomass', actual_data[var]))
            
            sim_interp = interp1d(time_sim, sim_data, kind='linear', 
                                 fill_value='extrapolate')
            sim_interpolated = sim_interp(time_actual)
            
            ax1.plot(time_actual, actual_vals, 'ro-', markersize=4, 
                    label='实际数据', alpha=0.7)
            ax1.plot(time_actual, sim_interpolated, 'b-', 
                    linewidth=2, label='仿真结果', alpha=0.8)
            ax1.set_xlabel('时间 (小时)', fontsize=11)
            ax1.set_ylabel(self._get_label(var), fontsize=11)
            ax1.set_title(f'{self._get_title(var).replace("对比", "")}对比', 
                         fontsize=12, fontweight='bold')
            ax1.grid(True, alpha=0.3)
            ax1.legend(loc='best')
            
            all_data = np.concatenate([sim_interpolated, actual_vals])
            ax1.set_ylim(self._get_safe_range(all_data))
            ax1.set_xlim(time_actual[0], time_actual[-1])
            
            error = sim_interpolated - actual_vals
            relative_error = np.abs(error / (actual_vals + 1e-10)) * 100
            
            ax2.plot(time_actual, relative_error, 'g-', linewidth=2)
            ax2.fill_between(time_actual, 0, relative_error, alpha=0.3)
            ax2.set_xlabel('时间 (小时)', fontsize=11)
            ax2.set_ylabel('相对误差 (%)', fontsize=11)
            ax2.set_title(f'相对误差 (MAPE: {np.mean(relative_error):.2f}%)', 
                         fontsize=12, fontweight='bold')
            ax2.grid(True, alpha=0.3)
            ax2.set_xlim(time_actual[0], time_actual[-1])
            ax2.set_ylim(0, min(100, np.max(relative_error) * 1.2))
        
        plt.suptitle('仿真结果与实际数据对比分析', fontsize=16, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['simulation_vs_actual'] = fig
        return fig

    def plot_sensitivity_analysis(self, param_ranges: Dict, 
                                  batch_results: List[Dict],
                                  show: bool = True,
                                  save_path: Optional[str] = None) -> plt.Figure:
        n_params = len(param_ranges)
        param_names = list(param_ranges.keys())
        
        fig, axes = plt.subplots(1, n_params, figsize=(5 * n_params, 5))
        if n_params == 1:
            axes = [axes]
        
        output_metrics = ['final_product', 'substrate_conversion', 'max_growth_rate']
        
        for idx, param_name in enumerate(param_names):
            ax = axes[idx]
            
            param_values = [r['params'][param_name] for r in batch_results]
            
            for metric in output_metrics:
                metric_values = [r.get(metric, np.nan) for r in batch_results]
                mask = np.isfinite(metric_values)
                if np.sum(mask) > 0:
                    ax.scatter(np.array(param_values)[mask], 
                              np.array(metric_values)[mask], 
                              alpha=0.6, label=self._get_metric_title(metric))
            
            ax.set_xlabel(param_name, fontsize=11)
            ax.set_ylabel('输出值', fontsize=11)
            ax.set_title(f'{param_name}敏感性分析', fontsize=12, fontweight='bold')
            ax.grid(True, alpha=0.3)
            ax.legend(loc='best')
        
        plt.suptitle('发酵参数敏感性分析', fontsize=16, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['sensitivity_analysis'] = fig
        return fig

    def _get_metric_title(self, metric: str) -> str:
        titles = {
            'final_product': '最终产物浓度',
            'substrate_conversion': '底物转化率',
            'max_growth_rate': '最大生长速率'
        }
        return titles.get(metric, metric)

    def plot_temperature_humidity(self, show: bool = True, 
                                  save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可可视化的仿真结果")
        
        time = self._clean_data(results['time'])
        temperature = self._clean_data(results['temperature'])
        humidity = self._clean_data(results['humidity']) * 100
        
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8), sharex=True)
        
        ax1.plot(time, temperature, 'r-', linewidth=2, label='温度')
        ax1.set_ylabel('温度 (°C)', fontsize=12)
        ax1.set_title('发酵过程温度变化曲线', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.legend(loc='best')
        ax1.set_ylim(self._get_safe_range(temperature))
        
        ax2.plot(time, humidity, 'b-', linewidth=2, label='湿度')
        ax2.set_xlabel('时间 (小时)', fontsize=12)
        ax2.set_ylabel('湿度 (%)', fontsize=12)
        ax2.set_title('发酵过程湿度变化曲线', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.legend(loc='best')
        ax2.set_ylim(self._get_safe_range(humidity))
        
        ax1.set_xlim(time[0], time[-1])
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['temperature_humidity'] = fig
        return fig

    def plot_microbial_growth(self, show: bool = True, 
                             save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可可视化的仿真结果")
        
        biomass_key = 'total_biomass' if self.multi_strain_results else 'biomass'
        time = self._clean_data(results['time'])
        biomass = self._clean_data(results[biomass_key])
        substrate = self._clean_data(results['substrate'])
        product = self._clean_data(results['product'])
        
        fig, ax1 = plt.subplots(figsize=(12, 6))
        
        line1, = ax1.plot(time, biomass, 'g-', linewidth=2, label='微生物浓度')
        ax1.set_xlabel('时间 (小时)', fontsize=12)
        ax1.set_ylabel('微生物浓度 (g/L)', fontsize=12, color='g')
        ax1.tick_params(axis='y', labelcolor='g')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim(self._get_safe_range(biomass))
        ax1.set_xlim(time[0], time[-1])
        
        ax2 = ax1.twinx()
        line2, = ax2.plot(time, substrate, 'orange', linewidth=2, label='底物浓度')
        line3, = ax2.plot(time, product, 'purple', linewidth=2, label='产物浓度')
        ax2.set_ylabel('浓度 (g/L)', fontsize=12)
        ax2.tick_params(axis='y')
        
        all_conc = np.concatenate([substrate, product])
        ax2.set_ylim(self._get_safe_range(all_conc))
        
        lines = [line1, line2, line3]
        labels = [l.get_label() for l in lines]
        ax1.legend(lines, labels, loc='center right')
        
        plt.title('微生物生长与物质转化曲线', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['microbial_growth'] = fig
        return fig

    def plot_growth_rates(self, show: bool = True, 
                         save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可可视化的仿真结果")
        
        if 'growth_rate' not in results:
            raise ValueError("结果中缺少速率数据，请先计算衍生量")
        
        time = self._clean_data(results['time'])
        growth_rate = self._clean_data(results['growth_rate'])
        substrate_rate = self._clean_data(results['substrate_consumption_rate'])
        productivity = self._clean_data(results['productivity'])
        
        fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 5))
        
        ax1.plot(time, growth_rate, 'g-', linewidth=2)
        ax1.set_title('微生物生长速率', fontsize=12, fontweight='bold')
        ax1.set_xlabel('时间 (小时)')
        ax1.set_ylabel('生长速率 (g/L·h)')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim(self._get_safe_range(growth_rate))
        ax1.set_xlim(time[0], time[-1])
        
        ax2.plot(time, substrate_rate, 'orange', linewidth=2)
        ax2.set_title('底物消耗速率', fontsize=12, fontweight='bold')
        ax2.set_xlabel('时间 (小时)')
        ax2.set_ylabel('消耗速率 (g/L·h)')
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim(self._get_safe_range(substrate_rate))
        ax2.set_xlim(time[0], time[-1])
        
        ax3.plot(time, productivity, 'purple', linewidth=2)
        ax3.set_title('产物生成速率', fontsize=12, fontweight='bold')
        ax3.set_xlabel('时间 (小时)')
        ax3.set_ylabel('生成速率 (g/L·h)')
        ax3.grid(True, alpha=0.3)
        ax3.set_ylim(self._get_safe_range(productivity))
        ax3.set_xlim(time[0], time[-1])
        
        plt.suptitle('发酵过程动力学速率分析', fontsize=16, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['growth_rates'] = fig
        return fig

    def plot_comparison(self, comparison: Dict, show: bool = True,
                       save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可可视化的仿真结果")
        
        time = self._clean_data(results['time'])
        n_plots = len(comparison)
        
        fig, axes = plt.subplots(n_plots, 1, figsize=(12, 4 * n_plots), sharex=True)
        if n_plots == 1:
            axes = [axes]
        
        for idx, (key, data) in enumerate(comparison.items()):
            ax = axes[idx]
            
            sim_data = self._clean_data(data['simulation'])
            sensor_data = self._clean_data(data['sensor'])
            
            ax.plot(time, sim_data, 'b-', linewidth=2, label='仿真值')
            ax.plot(time, sensor_data, 'ro', markersize=3, alpha=0.6, label='传感器值')
            ax.set_ylabel(self._get_label(key), fontsize=11)
            ax.set_title(f'{self._get_title(key)} - RMSE: {data["rmse"]:.4f}', fontsize=12, fontweight='bold')
            ax.grid(True, alpha=0.3)
            ax.legend(loc='best')
            
            all_data = np.concatenate([sim_data, sensor_data])
            ax.set_ylim(self._get_safe_range(all_data))
        
        axes[-1].set_xlabel('时间 (小时)', fontsize=12)
        axes[-1].set_xlim(time[0], time[-1])
        plt.suptitle('仿真结果与传感器数据对比', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['comparison'] = fig
        return fig

    def plot_phase_portrait(self, show: bool = True,
                           save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可可视化的仿真结果")
        
        biomass_key = 'total_biomass' if self.multi_strain_results else 'biomass'
        biomass = self._clean_data(results[biomass_key])
        substrate = self._clean_data(results['substrate'])
        product = self._clean_data(results['product'])
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1.plot(substrate, biomass, 'g-', linewidth=2)
        ax1.set_xlabel('底物浓度 (g/L)', fontsize=12)
        ax1.set_ylabel('微生物浓度 (g/L)', fontsize=12)
        ax1.set_title('微生物-底物相图', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.set_xlim(self._get_safe_range(substrate))
        ax1.set_ylim(self._get_safe_range(biomass))
        
        ax2.plot(biomass, product, 'purple', linewidth=2)
        ax2.set_xlabel('微生物浓度 (g/L)', fontsize=12)
        ax2.set_ylabel('产物浓度 (g/L)', fontsize=12)
        ax2.set_title('微生物-产物相图', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.set_xlim(self._get_safe_range(biomass))
        ax2.set_ylim(self._get_safe_range(product))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['phase_portrait'] = fig
        return fig

    def plot_dashboard(self, show: bool = True,
                      save_path: Optional[str] = None) -> plt.Figure:
        results = self.multi_strain_results if self.multi_strain_results else self.results
        if results is None:
            raise ValueError("没有可可视化的仿真结果")
        
        biomass_key = 'total_biomass' if self.multi_strain_results else 'biomass'
        time = self._clean_data(results['time'])
        
        fig = plt.figure(figsize=(16, 12))
        gs = GridSpec(3, 3, figure=fig)
        
        ax1 = fig.add_subplot(gs[0, 0])
        data = self._clean_data(results['temperature'])
        ax1.plot(time, data, 'r-', linewidth=2)
        ax1.set_title('温度', fontsize=11, fontweight='bold')
        ax1.set_ylabel('°C')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim(self._get_safe_range(data))
        ax1.set_xlim(time[0], time[-1])
        
        ax2 = fig.add_subplot(gs[0, 1])
        data = self._clean_data(results['humidity']) * 100
        ax2.plot(time, data, 'b-', linewidth=2)
        ax2.set_title('湿度', fontsize=11, fontweight='bold')
        ax2.set_ylabel('%')
        ax2.grid(True, alpha=0.3)
        ax2.set_ylim(self._get_safe_range(data))
        ax2.set_xlim(time[0], time[-1])
        
        ax3 = fig.add_subplot(gs[0, 2])
        data = self._clean_data(results['co2'])
        ax3.plot(time, data, 'gray', linewidth=2)
        ax3.set_title('CO2生成量', fontsize=11, fontweight='bold')
        ax3.set_ylabel('g/L')
        ax3.grid(True, alpha=0.3)
        ax3.set_ylim(self._get_safe_range(data))
        ax3.set_xlim(time[0], time[-1])
        
        ax4 = fig.add_subplot(gs[1, 0])
        data = self._clean_data(results[biomass_key])
        ax4.plot(time, data, 'g-', linewidth=2)
        ax4.set_title('微生物浓度', fontsize=11, fontweight='bold')
        ax4.set_ylabel('g/L')
        ax4.grid(True, alpha=0.3)
        ax4.set_ylim(self._get_safe_range(data))
        ax4.set_xlim(time[0], time[-1])
        
        ax5 = fig.add_subplot(gs[1, 1])
        data = self._clean_data(results['substrate'])
        ax5.plot(time, data, 'orange', linewidth=2)
        ax5.set_title('底物浓度', fontsize=11, fontweight='bold')
        ax5.set_ylabel('g/L')
        ax5.grid(True, alpha=0.3)
        ax5.set_ylim(self._get_safe_range(data))
        ax5.set_xlim(time[0], time[-1])
        
        ax6 = fig.add_subplot(gs[1, 2])
        data = self._clean_data(results['product'])
        ax6.plot(time, data, 'purple', linewidth=2)
        ax6.set_title('产物浓度', fontsize=11, fontweight='bold')
        ax6.set_ylabel('g/L')
        ax6.grid(True, alpha=0.3)
        ax6.set_ylim(self._get_safe_range(data))
        ax6.set_xlim(time[0], time[-1])
        
        ax7 = fig.add_subplot(gs[2, :])
        if 'growth_rate' in results:
            growth_rate = self._clean_data(results['growth_rate'])
            substrate_rate = self._clean_data(results['substrate_consumption_rate'])
            productivity = self._clean_data(results['productivity'])
            
            ax7.plot(time, growth_rate, 'g-', label='生长速率', alpha=0.7)
            ax7.plot(time, substrate_rate, 'orange', label='底物消耗速率', alpha=0.7)
            ax7.plot(time, productivity, 'purple', label='产物生成速率', alpha=0.7)
            ax7.set_xlabel('时间 (小时)', fontsize=12)
            ax7.set_ylabel('速率 (g/L·h)', fontsize=12)
            ax7.set_title('发酵过程速率综合图', fontsize=13, fontweight='bold')
            ax7.legend(loc='best')
            ax7.grid(True, alpha=0.3)
            
            all_rates = np.concatenate([growth_rate, substrate_rate, productivity])
            ax7.set_ylim(self._get_safe_range(all_rates))
        
        ax7.set_xlim(time[0], time[-1])
        
        plt.suptitle('古法酿酒发酵过程仿真综合仪表盘', fontsize=18, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        
        self.figures['dashboard'] = fig
        return fig

    def _get_label(self, key: str) -> str:
        labels = {
            'temperature': '温度 (°C)',
            'humidity': '湿度 (比例)',
            'biomass': '微生物浓度 (g/L)',
            'total_biomass': '总微生物浓度 (g/L)',
            'substrate': '底物浓度 (g/L)',
            'product': '产物浓度 (g/L)',
            'co2': 'CO2 (g/L)'
        }
        return labels.get(key, key)

    def _get_title(self, key: str) -> str:
        titles = {
            'temperature': '温度对比',
            'humidity': '湿度对比',
            'biomass': '微生物浓度对比',
            'substrate': '底物浓度对比',
            'product': '产物浓度对比',
            'co2': 'CO2对比'
        }
        return titles.get(key, key)

    def show_all(self) -> None:
        plt.show()

    def close_all(self) -> None:
        plt.close('all')
        self.figures = {}
