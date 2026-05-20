import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from typing import Dict, List, Optional, Tuple
import os


class DyeVisualizer:
    def __init__(self, figure_size: Tuple[int, int] = (12, 8), dpi: int = 100):
        self.figure_size = figure_size
        self.dpi = dpi
        plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']
        plt.rcParams['axes.unicode_minus'] = False

    def plot_concentration_curve(self, time_points: np.ndarray, 
                                  concentration_history: np.ndarray,
                                  material_names: List[str],
                                  title: str = "浓度变化曲线",
                                  save_path: Optional[str] = None) -> None:
        fig, ax = plt.subplots(figsize=self.figure_size, dpi=self.dpi)
        
        for i, name in enumerate(material_names):
            ax.plot(time_points, concentration_history[:, i], 
                    label=name, linewidth=2, marker='o', markersize=3, markevery=10)
        
        ax.set_xlabel('时间 (s)', fontsize=12)
        ax.set_ylabel('浓度 (mol/L)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.legend(loc='best', fontsize=10)
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_absorption_curve(self, time_points: np.ndarray,
                               absorption_history: np.ndarray,
                               material_names: List[str],
                               title: str = "吸光度变化曲线",
                               save_path: Optional[str] = None) -> None:
        fig, ax = plt.subplots(figsize=self.figure_size, dpi=self.dpi)
        
        for i, name in enumerate(material_names):
            ax.plot(time_points, absorption_history[:, i], 
                    label=name, linewidth=2, linestyle='--')
        
        ax.set_xlabel('时间 (s)', fontsize=12)
        ax.set_ylabel('吸光度', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.legend(loc='best', fontsize=10)
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_temperature_effect(self, temperatures: np.ndarray,
                                 final_concentrations: np.ndarray,
                                 material_names: List[str],
                                 title: str = "温度对最终浓度的影响",
                                 save_path: Optional[str] = None) -> None:
        fig, ax = plt.subplots(figsize=self.figure_size, dpi=self.dpi)
        
        for i, name in enumerate(material_names):
            ax.plot(temperatures, final_concentrations[:, i], 
                    label=name, linewidth=2, marker='s', markersize=4)
        
        ax.set_xlabel('温度 (°C)', fontsize=12)
        ax.set_ylabel('最终浓度 (mol/L)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.legend(loc='best', fontsize=10)
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_reaction_yield(self, temperatures: np.ndarray,
                             yields: np.ndarray,
                             title: str = "温度对反应产率的影响",
                             save_path: Optional[str] = None) -> None:
        fig, ax = plt.subplots(figsize=self.figure_size, dpi=self.dpi)
        
        ax.plot(temperatures, yields, 'r-', linewidth=2, marker='o', markersize=5)
        ax.fill_between(temperatures, yields, alpha=0.2, color='red')
        
        ax.set_xlabel('温度 (°C)', fontsize=12)
        ax.set_ylabel('反应产率 (%)', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_ratio_comparison(self, ratio_results: List[Dict],
                               title: str = "不同配比结果对比",
                               save_path: Optional[str] = None) -> None:
        fig, axes = plt.subplots(1, 2, figsize=(15, 6), dpi=self.dpi)
        
        final_concs = [np.sum(r['final_concentrations']) for r in ratio_results]
        yields = [r['reaction_yield'] for r in ratio_results]
        labels = [f'配比{i+1}' for i in range(len(ratio_results))]
        
        axes[0].bar(labels, final_concs, color='skyblue', edgecolor='navy', alpha=0.7)
        axes[0].set_ylabel('最终总浓度 (mol/L)', fontsize=12)
        axes[0].set_title('不同配比最终浓度对比', fontsize=12, fontweight='bold')
        axes[0].grid(True, alpha=0.3, axis='y')
        
        axes[1].bar(labels, yields, color='lightcoral', edgecolor='darkred', alpha=0.7)
        axes[1].set_ylabel('反应产率 (%)', fontsize=12)
        axes[1].set_title('不同配比起始反应产率对比', fontsize=12, fontweight='bold')
        axes[1].grid(True, alpha=0.3, axis='y')
        
        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_color_evolution(self, time_points: np.ndarray,
                              color_evolution: np.ndarray,
                              title: str = "颜色演化过程",
                              save_path: Optional[str] = None) -> None:
        color_evolution = np.clip(np.array(color_evolution), 0, 1)
        time_points = np.array(time_points)
        
        if color_evolution.ndim != 2 or color_evolution.shape[1] != 3:
            raise ValueError(f"颜色数据格式错误，期望(N, 3)，得到{color_evolution.shape}")
        if len(time_points) != len(color_evolution):
            raise ValueError(f"时间点数量与颜色数据数量不匹配: {len(time_points)} vs {len(color_evolution)}")
        
        fig, axes = plt.subplots(2, 1, figsize=(12, 10), dpi=self.dpi)
        
        axes[0].plot(time_points, color_evolution[:, 0], 'r-', label='R通道', linewidth=2)
        axes[0].plot(time_points, color_evolution[:, 1], 'g-', label='G通道', linewidth=2)
        axes[0].plot(time_points, color_evolution[:, 2], 'b-', label='B通道', linewidth=2)
        axes[0].set_xlabel('时间 (s)', fontsize=12)
        axes[0].set_ylabel('RGB值 (0-1)', fontsize=12)
        axes[0].set_ylim(-0.05, 1.05)
        axes[0].set_title('RGB通道随时间变化', fontsize=12, fontweight='bold')
        axes[0].legend(loc='best', fontsize=10)
        axes[0].grid(True, alpha=0.3)
        
        n_colors = min(10, len(color_evolution))
        indices = np.linspace(0, len(color_evolution)-1, n_colors, dtype=int)
        
        for i, idx in enumerate(indices):
            color = color_evolution[idx]
            color = np.clip(color, 0, 1)
            patch = plt.Rectangle((i, 0), 1, 1, 
                                  facecolor=(color[0], color[1], color[2]), 
                                  edgecolor='black', linewidth=1)
            axes[1].add_patch(patch)
            axes[1].text(i+0.5, -0.15, f't={time_points[idx]:.0f}s', 
                         ha='center', va='top', fontsize=9, rotation=0)
        
        axes[1].set_xlim(0, n_colors)
        axes[1].set_ylim(-0.3, 1)
        axes[1].set_aspect('equal')
        axes[1].axis('off')
        axes[1].set_title('颜色演化快照', fontsize=12, fontweight='bold')
        
        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_material_colors(self, material_colors: Dict[str, np.ndarray],
                              title: str = "原料颜色展示",
                              save_path: Optional[str] = None) -> None:
        n_materials = len(material_colors)
        if n_materials == 0:
            raise ValueError("没有颜色数据可以展示")
        
        fig, ax = plt.subplots(figsize=(max(8, n_materials*2), 4), dpi=self.dpi)
        
        for i, (name, color) in enumerate(material_colors.items()):
            color = np.clip(np.array(color, dtype=float), 0, 1)
            if len(color) != 3:
                color = np.array([0.5, 0.5, 0.5])
            
            patch = plt.Rectangle((i, 0), 1, 1, 
                                  facecolor=(color[0], color[1], color[2]), 
                                  edgecolor='black', linewidth=2)
            ax.add_patch(patch)
            ax.text(i+0.5, -0.1, name, ha='center', va='top', fontsize=11, 
                    fontweight='bold', rotation=0)
        
        ax.set_xlim(0, n_materials)
        ax.set_ylim(-0.3, 1)
        ax.set_aspect('equal')
        ax.axis('off')
        ax.set_title(title, fontsize=14, fontweight='bold')
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_3d_ratio_surface(self, ratio1_range: np.ndarray,
                               ratio2_range: np.ndarray,
                               results: np.ndarray,
                               title: str = "配比响应曲面",
                               save_path: Optional[str] = None) -> None:
        from mpl_toolkits.mplot3d import Axes3D
        
        fig = plt.figure(figsize=self.figure_size, dpi=self.dpi)
        ax = fig.add_subplot(111, projection='3d')
        
        R1, R2 = np.meshgrid(ratio1_range, ratio2_range)
        
        surf = ax.plot_surface(R1, R2, results, cmap='viridis', 
                               linewidth=0, antialiased=True, alpha=0.8)
        
        ax.set_xlabel('染料1比例', fontsize=12)
        ax.set_ylabel('染料2比例', fontsize=12)
        ax.set_zlabel('响应值', fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        
        fig.colorbar(surf, shrink=0.5, aspect=10)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def create_comprehensive_report(self, sim_result: Dict,
                                     output_dir: str = 'reports') -> None:
        os.makedirs(output_dir, exist_ok=True)
        
        self.plot_concentration_curve(
            sim_result['time_points'],
            sim_result['concentration_history'],
            sim_result['material_names'],
            title="浓度变化曲线",
            save_path=os.path.join(output_dir, 'concentration_curve.png')
        )
        
        self.plot_absorption_curve(
            sim_result['time_points'],
            sim_result['absorption_history'],
            sim_result['material_names'],
            title="吸光度变化曲线",
            save_path=os.path.join(output_dir, 'absorption_curve.png')
        )
        
        fig, ax = plt.subplots(figsize=(10, 6))
        text = f"""
        模拟报告
        =========
        温度: {sim_result['temperature']}°C
        反应产率: {sim_result['reaction_yield']:.2f}%
        时间范围: {sim_result['time_points'][0]:.1f} - {sim_result['time_points'][-1]:.1f}s
        
        原料配比:
        """
        for name, ratio in sim_result['ratios'].items():
            text += f"  {name}: {ratio*100:.2f}%\n"
        
        ax.text(0.1, 0.5, text, fontsize=12, family='monospace')
        ax.axis('off')
        plt.tight_layout()
        plt.savefig(os.path.join(output_dir, 'report_text.png'), bbox_inches='tight')
        plt.close()

    def plot_batch_comparison(self, batch_results: List[Dict],
                               parameter: str = 'reaction_yield',
                               title: str = "批量模拟结果对比",
                               save_path: Optional[str] = None) -> None:
        fig, ax = plt.subplots(figsize=self.figure_size, dpi=self.dpi)
        
        values = [r[parameter] for r in batch_results]
        labels = [f'模拟{i+1}' for i in range(len(batch_results))]
        
        bars = ax.bar(labels, values, color='steelblue', edgecolor='navy', alpha=0.7)
        
        for bar, value in zip(bars, values):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{value:.2f}', ha='center', va='bottom', fontsize=10)
        
        ax.set_xlabel('模拟编号', fontsize=12)
        ax.set_ylabel(parameter, fontsize=12)
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='y')
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_warnings_summary(self, warnings: List[Dict],
                               title: str = "模拟警告信息汇总",
                               save_path: Optional[str] = None) -> None:
        if not warnings:
            fig, ax = plt.subplots(figsize=(8, 4))
            ax.text(0.5, 0.5, "无警告信息", ha='center', va='center', fontsize=14)
            ax.axis('off')
            ax.set_title(title, fontsize=14, fontweight='bold')
        else:
            from collections import Counter
            level_counts = Counter(w.get('level', 'unknown') for w in warnings)
            
            fig, axes = plt.subplots(1, 2, figsize=(14, 6))
            
            levels = list(level_counts.keys())
            counts = list(level_counts.values())
            colors = {'info': 'skyblue', 'warning': 'orange', 'error': 'red', 'critical': 'darkred'}
            bar_colors = [colors.get(level, 'gray') for level in levels]
            
            axes[0].bar(levels, counts, color=bar_colors, edgecolor='black', alpha=0.7)
            axes[0].set_xlabel('警告级别', fontsize=12)
            axes[0].set_ylabel('数量', fontsize=12)
            axes[0].set_title('警告级别分布', fontsize=12, fontweight='bold')
            
            code_counts = Counter(w.get('code', 'unknown') for w in warnings)
            codes = list(code_counts.keys())
            code_values = list(code_counts.values())
            
            y_pos = np.arange(len(codes))
            axes[1].barh(y_pos, code_values, color='steelblue', edgecolor='navy', alpha=0.7)
            axes[1].set_yticks(y_pos)
            axes[1].set_yticklabels(codes, fontsize=9)
            axes[1].set_xlabel('数量', fontsize=12)
            axes[1].set_title('警告类型分布', fontsize=12, fontweight='bold')
            
            fig.suptitle(title, fontsize=14, fontweight='bold')
            plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_simulation_vs_actual(self, comparison_result: Dict,
                                   title: str = "仿真结果与实际数据对比",
                                   save_path: Optional[str] = None) -> None:
        detailed = comparison_result.get('detailed_results', [])
        
        if not detailed:
            fig, ax = plt.subplots(figsize=(8, 4))
            ax.text(0.5, 0.5, "无对比数据", ha='center', va='center', fontsize=14)
            ax.axis('off')
            ax.set_title(title, fontsize=14, fontweight='bold')
        else:
            n_params = len(detailed)
            params = [r['parameter_name'] for r in detailed]
            sim_values = [r['simulated_value'] for r in detailed]
            actual_values = [r['actual_value'] for r in detailed]
            
            x = np.arange(n_params)
            width = 0.35
            
            fig, ax = plt.subplots(figsize=(max(10, n_params * 1.5), 6))
            
            bars1 = ax.bar(x - width/2, sim_values, width, label='仿真值', 
                           color='skyblue', edgecolor='navy', alpha=0.8)
            bars2 = ax.bar(x + width/2, actual_values, width, label='实际值', 
                           color='lightcoral', edgecolor='darkred', alpha=0.8)
            
            ax.set_xlabel('参数名称', fontsize=12)
            ax.set_ylabel('数值', fontsize=12)
            ax.set_title(title, fontsize=14, fontweight='bold')
            ax.set_xticks(x)
            ax.set_xticklabels(params, rotation=45, ha='right', fontsize=10)
            ax.legend()
            ax.grid(True, alpha=0.3, axis='y')
            
            for i, r in enumerate(detailed):
                if r['passed']:
                    ax.text(x[i], max(sim_values[i], actual_values[i]) * 1.05, 
                            '✓', ha='center', color='green', fontsize=12)
                else:
                    ax.text(x[i], max(sim_values[i], actual_values[i]) * 1.05, 
                            '✗', ha='center', color='red', fontsize=12)
            
            plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_error_analysis_heatmap(self, error_analysis: Dict,
                                     title: str = "误差分析热力图",
                                     save_path: Optional[str] = None) -> None:
        params = list(error_analysis.keys())
        metrics = ['mean_error', 'max_error', 'std_error']
        
        data = np.array([[error_analysis[p][m] for m in metrics] for p in params])
        
        fig, ax = plt.subplots(figsize=(10, max(6, len(params) * 0.8)))
        
        im = ax.imshow(data, cmap='YlOrRd', aspect='auto', interpolation='nearest')
        
        ax.set_xticks(np.arange(len(metrics)))
        ax.set_yticks(np.arange(len(params)))
        ax.set_xticklabels(metrics, fontsize=11)
        ax.set_yticklabels(params, fontsize=11)
        ax.set_title(title, fontsize=14, fontweight='bold')
        
        cbar = fig.colorbar(im, ax=ax)
        cbar.set_label('误差值', fontsize=12)
        
        for i in range(len(params)):
            for j in range(len(metrics)):
                text = ax.text(j, i, f'{data[i, j]:.4f}',
                               ha='center', va='center', color='black', fontsize=10)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_grid_search_results(self, grid_search_result: Dict,
                                  title: str = "网格搜索结果分析",
                                  save_path: Optional[str] = None) -> None:
        objective_values = np.array(grid_search_result['objective_values'])
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        axes[0].hist(objective_values, bins=20, color='skyblue', edgecolor='navy', alpha=0.7)
        axes[0].axvline(grid_search_result['best_objective_value'], color='red', 
                       linestyle='--', linewidth=2, label=f'最优值: {grid_search_result["best_objective_value"]:.2f}')
        axes[0].set_xlabel('目标函数值', fontsize=12)
        axes[0].set_ylabel('频数', fontsize=12)
        axes[0].set_title('目标函数值分布', fontsize=12, fontweight='bold')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3, axis='y')
        
        sorted_values = np.sort(objective_values)
        axes[1].plot(sorted_values, 'b-', linewidth=2, marker='o', markersize=3)
        axes[1].axhline(grid_search_result['best_objective_value'], color='red', 
                       linestyle='--', linewidth=2)
        axes[1].set_xlabel('排序索引', fontsize=12)
        axes[1].set_ylabel('目标函数值', fontsize=12)
        axes[1].set_title('排序后的目标函数值', fontsize=12, fontweight='bold')
        axes[1].grid(True, alpha=0.3)
        
        fig.suptitle(f'{title} (共{grid_search_result["total_combinations"]}组)', fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def plot_interaction_effects(self, interaction_effects: Dict,
                                  title: str = "染料组间相互作用效应",
                                  save_path: Optional[str] = None) -> None:
        interactions = interaction_effects.get('interactions', [])
        
        if not interactions:
            fig, ax = plt.subplots(figsize=(8, 4))
            ax.text(0.5, 0.5, "无相互作用数据", ha='center', va='center', fontsize=14)
            ax.axis('off')
            ax.set_title(title, fontsize=14, fontweight='bold')
        else:
            fig, axes = plt.subplots(1, 2, figsize=(14, 6))
            
            labels = [f"{i['group_pair'][0]} vs {i['group_pair'][1]}" for i in interactions]
            factors = [i['interaction_factor'] for i in interactions]
            yield_mods = [i['yield_modification'] for i in interactions]
            
            x = np.arange(len(labels))
            
            axes[0].bar(x, factors, color='mediumpurple', edgecolor='indigo', alpha=0.7)
            axes[0].set_xlabel('染料组对', fontsize=12)
            axes[0].set_ylabel('相互作用强度', fontsize=12)
            axes[0].set_title('组间相互作用因子', fontsize=12, fontweight='bold')
            axes[0].set_xticks(x)
            axes[0].set_xticklabels(labels, rotation=30, ha='right', fontsize=9)
            axes[0].grid(True, alpha=0.3, axis='y')
            
            axes[1].bar(x, yield_mods, color='mediumseagreen', edgecolor='darkgreen', alpha=0.7)
            axes[1].set_xlabel('染料组对', fontsize=12)
            axes[1].set_ylabel('产率修正量', fontsize=12)
            axes[1].set_title('相互作用对产率的影响', fontsize=12, fontweight='bold')
            axes[1].set_xticks(x)
            axes[1].set_xticklabels(labels, rotation=30, ha='right', fontsize=9)
            axes[1].grid(True, alpha=0.3, axis='y')
            
            fig.suptitle(title, fontsize=14, fontweight='bold')
            plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, bbox_inches='tight')
            plt.close()
        else:
            plt.show()

    def create_advanced_report(self, advanced_result: Dict,
                                comparison_result: Optional[Dict] = None,
                                output_dir: str = 'advanced_reports') -> None:
        os.makedirs(output_dir, exist_ok=True)
        
        if 'concentration_history' in advanced_result:
            self.plot_concentration_curve(
                advanced_result['time_points'],
                advanced_result['concentration_history'],
                advanced_result['material_names'],
                title="浓度变化曲线",
                save_path=os.path.join(output_dir, 'concentration_curve.png')
            )
            
            self.plot_color_evolution(
                advanced_result['time_points'],
                advanced_result['color_evolution'],
                title="染色过程颜色演化",
                save_path=os.path.join(output_dir, 'color_evolution.png')
            )
        
        warnings = advanced_result.get('warnings', [])
        if warnings:
            self.plot_warnings_summary(
                warnings,
                title="模拟警告信息汇总",
                save_path=os.path.join(output_dir, 'warnings_summary.png')
            )
        
        if comparison_result:
            self.plot_simulation_vs_actual(
                comparison_result,
                title="仿真结果与实际数据对比",
                save_path=os.path.join(output_dir, 'sim_vs_actual.png')
            )
            
            if 'error_analysis' in comparison_result:
                self.plot_error_analysis_heatmap(
                    comparison_result['error_analysis'],
                    title="误差分析热力图",
                    save_path=os.path.join(output_dir, 'error_heatmap.png')
                )
        
        if 'interaction_effects' in advanced_result:
            self.plot_interaction_effects(
                advanced_result['interaction_effects'],
                title="染料组间相互作用效应",
                save_path=os.path.join(output_dir, 'interaction_effects.png')
            )
