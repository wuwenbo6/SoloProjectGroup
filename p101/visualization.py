import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from typing import List, Optional

from simulation import PaperSimulationResult
from raw_materials import RawMaterialCollector


class ResultVisualizer:
    def __init__(self):
        self.material_collector = RawMaterialCollector()
        plt.style.use('seaborn-v0_8-whitegrid')

    def plot_fiber_distribution(self, result: PaperSimulationResult, 
                                 save_path: Optional[str] = None) -> None:
        if result.fiber_length_dist is None:
            return
        
        bins, distribution = result.fiber_length_dist
        
        if len(bins) == 0 or len(distribution) == 0:
            return
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        if len(bins) > 1:
            bar_width = (bins[1] - bins[0]) * 0.8
        else:
            bar_width = 0.1
        
        ax.bar(bins, distribution, width=bar_width, alpha=0.7, color='#4A90E2', edgecolor='white', linewidth=0.5)
        
        ax.set_xlabel('纤维长度 (mm)', fontsize=12)
        ax.set_ylabel('配比比例', fontsize=12)
        ax.set_title('纤维长度分布', fontsize=14, fontweight='bold')
        
        properties = self.material_collector.get_material_properties(result.config.material_names)
        for name, color in zip(result.config.material_names, properties['color']):
            mat = self.material_collector.get_material(name)
            if mat:
                ax.axvline(x=mat.fiber_length, color=color, linestyle='--', 
                           linewidth=2, label=mat.name, alpha=0.8)
        
        ax.legend(loc='best', fontsize=10)
        
        if len(bins) > 1:
            ax.set_xlim(bins[0] - (bins[1] - bins[0]), bins[-1] + (bins[1] - bins[0]))
        
        y_max = np.max(distribution)
        if y_max > 0:
            ax.set_ylim(0, y_max * 1.2)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()

    def plot_soaking_curve(self, result: PaperSimulationResult, 
                            save_path: Optional[str] = None) -> None:
        if result.soaking_curve is None:
            return
        
        x, y = result.soaking_curve
        
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(x, y, linewidth=3, color='#E24A4A', label='抗张强度')
        ax.scatter([result.config.soak_time], [result.tensile_strength], 
                   color='#E24A4A', s=100, zorder=5, label='当前配置点')
        
        ax.set_xlabel('浸泡时间 (小时)', fontsize=12)
        ax.set_ylabel('抗张强度 (MPa)', fontsize=12)
        ax.set_title('浸泡时间对抗张强度的影响', fontsize=14, fontweight='bold')
        ax.legend()
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()

    def plot_ratios_pie(self, result: PaperSimulationResult, 
                         save_path: Optional[str] = None) -> None:
        properties = self.material_collector.get_material_properties(result.config.material_names)
        
        fig, ax = plt.subplots(figsize=(8, 8))
        
        labels = [self.material_collector.get_material(name).name 
                  for name in result.config.material_names]
        colors = properties['color']
        
        wedges, texts, autotexts = ax.pie(
            result.config.ratios,
            labels=labels,
            colors=colors,
            autopct='%1.1f%%',
            startangle=90,
            wedgeprops=dict(width=0.6, edgecolor='w', linewidth=2)
        )
        
        for text in texts:
            text.set_fontsize(11)
        for autotext in autotexts:
            autotext.set_fontsize(10)
            autotext.set_fontweight('bold')
        
        ax.set_title('纤维配比组成', fontsize=14, fontweight='bold', pad=20)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()

    def plot_quality_radar(self, result: PaperSimulationResult, 
                            save_path: Optional[str] = None) -> None:
        metrics = result.quality_metrics
        
        categories = ['强度', '孔隙率', '吸水性', '均匀性', '耐久性', '可打印性']
        values = [
            metrics['strength'] / 1.2,
            metrics['porosity'] * 100,
            metrics['water_absorption'] * 100,
            metrics['uniformity'] * 100,
            metrics['durability'],
            metrics['printability']
        ]
        
        values = np.array(values)
        values = np.concatenate((values, [values[0]]))
        
        angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False)
        angles = np.concatenate((angles, [angles[0]]))
        
        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))
        
        ax.plot(angles, values, 'o-', linewidth=2, color='#4A90E2')
        ax.fill(angles, values, alpha=0.25, color='#4A90E2')
        
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, fontsize=11)
        ax.set_ylim(0, 100)
        ax.set_title('纸张质量指标雷达图', fontsize=14, fontweight='bold', pad=20)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()

    def plot_parameter_sweep(self, results: List[PaperSimulationResult], 
                              param_name: str, save_path: Optional[str] = None) -> None:
        if param_name == 'soak_time':
            x_values = [r.config.soak_time for r in results]
            strengths = [r.tensile_strength for r in results]
            porosities = [r.porosity * 100 for r in results]
            scores = [r.quality_metrics['overall_score'] for r in results]
            
            fig, axes = plt.subplots(1, 3, figsize=(15, 5))
            
            axes[0].plot(x_values, strengths, 'o-', color='#E24A4A', linewidth=2)
            axes[0].set_xlabel('浸泡时间 (小时)', fontsize=11)
            axes[0].set_ylabel('抗张强度 (MPa)', fontsize=11)
            axes[0].set_title('强度随浸泡时间变化', fontsize=12, fontweight='bold')
            
            axes[1].plot(x_values, porosities, 'o-', color='#4AE27C', linewidth=2)
            axes[1].set_xlabel('浸泡时间 (小时)', fontsize=11)
            axes[1].set_ylabel('孔隙率 (%)', fontsize=11)
            axes[1].set_title('孔隙率随浸泡时间变化', fontsize=12, fontweight='bold')
            
            axes[2].plot(x_values, scores, 'o-', color='#E2A94A', linewidth=2)
            axes[2].set_xlabel('浸泡时间 (小时)', fontsize=11)
            axes[2].set_ylabel('综合评分', fontsize=11)
            axes[2].set_title('综合评分随浸泡时间变化', fontsize=12, fontweight='bold')
            
            plt.tight_layout()
            if save_path:
                plt.savefig(save_path, dpi=300, bbox_inches='tight')
            plt.close()

    def plot_comprehensive_dashboard(self, result: PaperSimulationResult, 
                                      save_path: Optional[str] = None) -> None:
        fig = plt.figure(figsize=(16, 12))
        gs = GridSpec(3, 3, figure=fig, hspace=0.3, wspace=0.3)
        
        ax1 = fig.add_subplot(gs[0, 0])
        ax2 = fig.add_subplot(gs[0, 1])
        ax3 = fig.add_subplot(gs[0:, 2])
        ax4 = fig.add_subplot(gs[1, 0:2])
        ax5 = fig.add_subplot(gs[2, 0:2])
        
        properties = self.material_collector.get_material_properties(result.config.material_names)
        labels = [self.material_collector.get_material(name).name 
                  for name in result.config.material_names]
        colors = properties['color']
        
        wedges, texts, autotexts = ax1.pie(
            result.config.ratios,
            labels=labels,
            colors=colors,
            autopct='%1.1f%%',
            startangle=90,
            wedgeprops=dict(width=0.6, edgecolor='w', linewidth=2)
        )
        ax1.set_title('纤维配比', fontsize=12, fontweight='bold')
        
        metrics_names = ['强度', '孔隙率', '吸水性', '均匀性']
        metrics_values = [
            result.quality_metrics['strength'],
            result.quality_metrics['porosity'] * 100,
            result.quality_metrics['water_absorption'] * 100,
            result.quality_metrics['uniformity'] * 100
        ]
        bar_colors = ['#E24A4A', '#4AE27C', '#4A90E2', '#E2A94A']
        
        bars = ax2.bar(metrics_names, metrics_values, color=bar_colors, alpha=0.8)
        ax2.set_ylim(0, 100)
        ax2.set_title('关键指标', fontsize=12, fontweight='bold')
        for bar, val in zip(bars, metrics_values):
            ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, 
                     f'{val:.1f}', ha='center', fontsize=10)
        
        categories = ['强度', '孔隙率', '吸水性', '均匀性', '耐久性', '可打印性']
        values = [
            result.quality_metrics['strength'] / 1.2,
            result.quality_metrics['porosity'] * 100,
            result.quality_metrics['water_absorption'] * 100,
            result.quality_metrics['uniformity'] * 100,
            result.quality_metrics['durability'],
            result.quality_metrics['printability']
        ]
        values = np.array(values)
        values = np.concatenate((values, [values[0]]))
        angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False)
        angles = np.concatenate((angles, [angles[0]]))
        
        ax3 = plt.subplot(gs[0:, 2], projection='polar')
        ax3.plot(angles, values, 'o-', linewidth=2, color='#4A90E2')
        ax3.fill(angles, values, alpha=0.25, color='#4A90E2')
        ax3.set_xticks(angles[:-1])
        ax3.set_xticklabels(categories, fontsize=10)
        ax3.set_ylim(0, 100)
        ax3.set_title('质量雷达图', fontsize=12, fontweight='bold', pad=20)
        
        if result.soaking_curve:
            x, y = result.soaking_curve
            ax4.plot(x, y, linewidth=2, color='#E24A4A')
            ax4.scatter([result.config.soak_time], [result.tensile_strength], 
                       color='#E24A4A', s=80, zorder=5)
            ax4.set_xlabel('浸泡时间 (小时)', fontsize=11)
            ax4.set_ylabel('抗张强度 (MPa)', fontsize=11)
            ax4.set_title('强度-浸泡曲线', fontsize=12, fontweight='bold')
        
        if result.fiber_length_dist:
            bins, distribution = result.fiber_length_dist
            if len(bins) > 0 and len(distribution) > 0:
                if len(bins) > 1:
                    bar_width = (bins[1] - bins[0]) * 0.8
                else:
                    bar_width = 0.1
                ax5.bar(bins, distribution, width=bar_width, alpha=0.7, color='#4A90E2', edgecolor='white', linewidth=0.5)
                if len(bins) > 1:
                    ax5.set_xlim(bins[0] - (bins[1] - bins[0]), bins[-1] + (bins[1] - bins[0]))
                y_max = np.max(distribution)
                if y_max > 0:
                    ax5.set_ylim(0, y_max * 1.2)
            ax5.set_xlabel('纤维长度 (mm)', fontsize=11)
            ax5.set_ylabel('配比比例', fontsize=11)
            ax5.set_title('纤维长度分布', fontsize=12, fontweight='bold')
        
        fig.suptitle(f'古法造纸纤维配比模拟综合报告 | 综合评分: {result.quality_metrics["overall_score"]:.1f}',
                     fontsize=16, fontweight='bold', y=0.98)
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        plt.close()
