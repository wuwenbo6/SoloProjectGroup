import numpy as np
import matplotlib.pyplot as plt
import matplotlib
from matplotlib import cm
from matplotlib.colors import LinearSegmentedColormap
from typing import Dict, List, Optional, Tuple
import warnings

matplotlib.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False


class InkVisualization:
    def __init__(self, figsize: Tuple[int, int] = (12, 8), dpi: int = 100):
        self.figsize = figsize
        self.dpi = dpi
        self.ink_cmap = LinearSegmentedColormap.from_list(
            'ink_gradient', ['#d4d4d4', '#888888', '#333333', '#000000'], N=256
        )

    def plot_composition_pie(self, formula, ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            _, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        materials = list(formula.materials.keys())
        ratios = list(formula.materials.values())
        total = sum(ratios)
        ratios = [r / total for r in ratios] if total > 0 else ratios
        
        colors = ['#2c2c2c', '#8b5a2b', '#c9a86c', '#6b8e6b', '#8b7355']
        while len(colors) < len(materials):
            colors.extend(colors)
        
        wedges, texts, autotexts = ax.pie(
            ratios, labels=materials, autopct='%1.1f%%',
            colors=colors[:len(materials)], startangle=90,
            textprops={'fontsize': 10}
        )
        
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
        
        ax.set_title(f'配方成分比例 - {formula.name}', fontsize=14, fontweight='bold', pad=20)
        
        return ax

    def plot_quality_radar(self, quality_scores: Dict, ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            _, ax = plt.subplots(figsize=self.figsize, subplot_kw=dict(projection='polar'), dpi=self.dpi)
        
        categories = [
            '黑度', '光泽', '耐久性', '细腻度', '烧制质量'
        ]
        keys = [
            'blackness_score', 'gloss_score', 'durability_score', 
            'smoothness_score', 'firing_quality'
        ]
        
        values = [quality_scores.get(key, 0) for key in keys]
        values += values[:1]
        
        angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False)
        angles = np.concatenate((angles, [angles[0]]))
        
        ax.plot(angles, values, 'o-', linewidth=2, color='#2c2c2c', label='质量评分')
        ax.fill(angles, values, alpha=0.25, color='#666666')
        
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, fontsize=11)
        ax.set_ylim(0, 100)
        ax.set_yticks([20, 40, 60, 80, 100])
        ax.set_yticklabels(['20', '40', '60', '80', '100'], fontsize=9)
        ax.grid(True, alpha=0.3)
        ax.set_title('墨质综合评分雷达图', fontsize=14, fontweight='bold', pad=30)
        
        overall = quality_scores.get('overall_quality', 0)
        ax.text(0, 110, f'综合质量: {overall:.1f}/100', ha='center', va='center',
                fontsize=12, fontweight='bold', bbox=dict(boxstyle='round', facecolor='#f0f0f0'))
        
        return ax

    def plot_process_dynamics(self, process_data: Dict, ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        else:
            fig = ax.figure
        
        ax2 = ax.twinx()
        
        time_points = process_data.get('time_points', np.array([]))
        temp_profile = process_data.get('temperature_profile', np.array([]))
        carbonization = process_data.get('carbonization_curve', np.array([]))
        
        line1, = ax.plot(time_points, temp_profile, 'r-', linewidth=2.5, label='温度 (℃)')
        line2, = ax2.plot(time_points, carbonization * 100, 'b-', linewidth=2.5, label='碳化程度 (%)')
        
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel('温度 (℃)', fontsize=12, color='r')
        ax2.set_ylabel('碳化程度 (%)', fontsize=12, color='b')
        
        ax.tick_params(axis='y', labelcolor='r')
        ax2.tick_params(axis='y', labelcolor='b')
        
        lines = [line1, line2]
        labels = [line.get_label() for line in lines]
        ax.legend(lines, labels, loc='best', fontsize=10, framealpha=0.9)
        
        ax.set_title('烧制过程动力学曲线', fontsize=14, fontweight='bold', pad=20)
        ax.grid(True, alpha=0.3)
        
        return ax

    def plot_ink_color_curve(self, blackness_values: np.ndarray, gloss_values: np.ndarray,
                            time_points: np.ndarray, ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            fig, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        else:
            fig = ax.figure
        
        ax2 = ax.twinx()
        
        line1, = ax.plot(time_points, blackness_values, 'k-', linewidth=2.5, label='黑度')
        line2, = ax2.plot(time_points, gloss_values, 'g-', linewidth=2.5, label='光泽')
        
        ax.set_xlabel('时间 (分钟)', fontsize=12)
        ax.set_ylabel('黑度 (0-100)', fontsize=12, color='k')
        ax2.set_ylabel('光泽 (0-100)', fontsize=12, color='g')
        
        ax.tick_params(axis='y', labelcolor='k')
        ax2.tick_params(axis='y', labelcolor='g')
        
        ax.set_ylim(0, 100)
        ax2.set_ylim(0, 100)
        
        lines = [line1, line2]
        labels = [line.get_label() for line in lines]
        ax.legend(lines, labels, loc='best', fontsize=10, framealpha=0.9)
        
        ax.set_title('墨色随时间变化曲线', fontsize=14, fontweight='bold', pad=20)
        ax.grid(True, alpha=0.3)
        
        return ax

    def plot_temporal_changes(self, temporal_data: Dict, ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            _, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        time_hours = temporal_data.get('time_hours', np.array([]))
        moisture = temporal_data.get('moisture_content', np.array([]))
        hardness = temporal_data.get('hardness_development', np.array([]))
        
        ax.plot(time_hours, moisture * 100, 'b--', linewidth=2, label='水分含量 (%)')
        ax.plot(time_hours, hardness * 100, 'g-', linewidth=2, label='硬度发展 (%)')
        
        ax.set_xlabel('时间 (小时)', fontsize=12)
        ax.set_ylabel('百分比 (%)', fontsize=12)
        ax.set_title('干燥过程时间变化', fontsize=14, fontweight='bold', pad=20)
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        
        return ax

    def plot_parameter_sweep(self, sweep_results: Dict, param_name: str, 
                            ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            _, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        x = sweep_results['param_values']
        
        ax.plot(x, sweep_results['overall_quality'], 'k-', linewidth=3, label='综合质量')
        ax.plot(x, sweep_results['blackness'], 'b--', linewidth=2, label='黑度')
        ax.plot(x, sweep_results['gloss'], 'g--', linewidth=2, label='光泽')
        ax.plot(x, sweep_results['durability'], 'r--', linewidth=2, label='耐久性')
        
        ax.set_xlabel(param_name, fontsize=12)
        ax.set_ylabel('评分', fontsize=12)
        ax.set_title(f'参数扫描分析 - {param_name}', fontsize=14, fontweight='bold', pad=20)
        ax.legend(fontsize=10)
        ax.grid(True, alpha=0.3)
        
        best_idx = np.argmax(sweep_results['overall_quality'])
        best_x = x[best_idx]
        best_y = sweep_results['overall_quality'][best_idx]
        
        ax.plot(best_x, best_y, 'ko', markersize=10, markerfacecolor='red')
        ax.annotate(f'最佳值: {best_x:.1f}\n得分: {best_y:.1f}',
                    xy=(best_x, best_y), xytext=(best_x, best_y - 10),
                    ha='center', fontsize=10, fontweight='bold',
                    arrowprops=dict(arrowstyle='->', color='red'))
        
        return ax

    def plot_ink_color_sample(self, blackness: float, gloss: float, 
                             ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            _, ax = plt.subplots(figsize=(6, 6), dpi=self.dpi)
        
        gray_value = int(255 * (1 - blackness / 100))
        base_color = (gray_value / 255, gray_value / 255, gray_value / 255)
        
        gradient = np.linspace(0, 1, 256)
        gradient = np.vstack((gradient, gradient))
        ax.imshow(gradient, aspect='auto', cmap=self.ink_cmap, extent=[0, 1, 0, 1])
        
        center_x, center_y = 0.5, 0.5
        highlight_radius = 0.15 * (gloss / 100)
        
        if gloss > 30:
            circle = plt.Circle((center_x, center_y + 0.2), highlight_radius, 
                               color='white', alpha=gloss / 200)
            ax.add_patch(circle)
        
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_xticks([])
        ax.set_yticks([])
        
        ax.set_title(f'墨色样本\n黑度: {blackness:.1f} | 光泽: {gloss:.1f}', 
                    fontsize=12, fontweight='bold', pad=15)
        
        return ax

    def plot_comparison_bar(self, formulas: List, results: List, 
                           ax: Optional[plt.Axes] = None) -> plt.Axes:
        if ax is None:
            _, ax = plt.subplots(figsize=self.figsize, dpi=self.dpi)
        
        x = np.arange(len(formulas))
        width = 0.15
        
        overall = [r.quality_scores['overall_quality'] for r in results]
        blackness = [r.quality_scores['blackness_score'] for r in results]
        gloss = [r.quality_scores['gloss_score'] for r in results]
        durability = [r.quality_scores['durability_score'] for r in results]
        
        rects1 = ax.bar(x - 1.5*width, overall, width, label='综合质量', color='#333333')
        rects2 = ax.bar(x - 0.5*width, blackness, width, label='黑度', color='#555555')
        rects3 = ax.bar(x + 0.5*width, gloss, width, label='光泽', color='#777777')
        rects4 = ax.bar(x + 1.5*width, durability, width, label='耐久性', color='#999999')
        
        ax.set_xlabel('配方名称', fontsize=12)
        ax.set_ylabel('评分', fontsize=12)
        ax.set_title('多配方质量对比', fontsize=14, fontweight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels([f.name for f in formulas], rotation=15)
        ax.legend(fontsize=10)
        ax.set_ylim(0, 110)
        ax.grid(True, alpha=0.3, axis='y')
        
        for rects in [rects1, rects2, rects3, rects4]:
            for rect in rects:
                height = rect.get_height()
                ax.annotate(f'{height:.0f}', xy=(rect.get_x() + rect.get_width() / 2, height),
                           xytext=(0, 3), textcoords="offset points",
                           ha='center', va='bottom', fontsize=8)
        
        return ax

    def create_comprehensive_report(self, formula, simulation_result, 
                                   save_path: Optional[str] = None) -> plt.Figure:
        fig = plt.figure(figsize=(16, 12), dpi=self.dpi)
        
        gs = fig.add_gridspec(3, 4, hspace=0.3, wspace=0.3)
        
        ax1 = fig.add_subplot(gs[0, 0])
        self.plot_composition_pie(formula, ax1)
        
        ax2 = fig.add_subplot(gs[0, 1:3], projection='polar')
        self.plot_quality_radar(simulation_result.quality_scores, ax2)
        
        ax3 = fig.add_subplot(gs[0, 3])
        self.plot_ink_color_sample(
            simulation_result.quality_scores['blackness_score'],
            simulation_result.quality_scores['gloss_score'],
            ax3
        )
        
        ax4 = fig.add_subplot(gs[1, 0:2])
        self.plot_process_dynamics(simulation_result.process_data, ax4)
        
        ax5 = fig.add_subplot(gs[1, 2:4])
        self.plot_temporal_changes(simulation_result.temporal_data, ax5)
        
        ax6 = fig.add_subplot(gs[2, :])
        props = simulation_result.properties
        prop_names = [
            '含碳量', '粒径(μm)', '胶比', '碳化度', 
            '最终黑度', '最终光泽', '结合力', '耐水性'
        ]
        prop_values = [
            props.get('carbon_content', 0) * 100,
            props.get('final_particle_size', 0) * 1000,
            props.get('binder_ratio', 0) * 100,
            props.get('carbonization_degree', 0) * 100,
            props.get('final_blackness', 0),
            props.get('final_gloss', 0),
            props.get('binding_power', 0) * 100,
            props.get('water_resistance', 0) * 100
        ]
        
        colors = plt.cm.Greys(np.linspace(0.4, 0.8, len(prop_names)))
        bars = ax6.bar(prop_names, prop_values, color=colors)
        ax6.set_ylabel('数值', fontsize=12)
        ax6.set_title('配方详细属性', fontsize=14, fontweight='bold', pad=15)
        ax6.tick_params(axis='x', rotation=20)
        ax6.grid(True, alpha=0.3, axis='y')
        
        for bar, value in zip(bars, prop_values):
            ax6.annotate(f'{value:.1f}', xy=(bar.get_x() + bar.get_width() / 2, value),
                        xytext=(0, 3), textcoords="offset points",
                        ha='center', va='bottom', fontsize=9)
        
        fig.suptitle(f'制墨配方模拟报告 - {formula.name}', fontsize=18, fontweight='bold', y=0.98)
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight', dpi=self.dpi)
        
        return fig

    def show(self):
        plt.show()

    def close_all(self):
        plt.close('all')
