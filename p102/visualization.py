import numpy as np
import matplotlib.pyplot as plt
from matplotlib import cm
from matplotlib.patches import Rectangle
from typing import Dict, Any, List, Optional
import os


class ResultsVisualizer:
    def __init__(self, results: Optional[Dict[str, Any]] = None):
        self.results = results
        plt.style.use('seaborn-v0_8-whitegrid')
    
    def set_results(self, results: Dict[str, Any]) -> None:
        self.results = results
    
    def plot_stress_heatmap(self, 
                             stress_type: str = 'von_mises',
                             save_path: Optional[str] = None,
                             show: bool = True) -> None:
        if self.results is None:
            raise ValueError("No results set for visualization")
        
        stress_field = self.results['stress_field']
        X = stress_field['X']
        Y = stress_field['Y']
        
        if stress_type not in stress_field:
            raise ValueError(f"Stress type '{stress_type}' not available. "
                           f"Available: {list(stress_field.keys())}")
        
        stress = stress_field[stress_type]
        
        fig, ax = plt.subplots(figsize=(12, 5))
        
        stress_mpa = stress / 1e6
        im = ax.pcolormesh(X, Y, stress_mpa, 
                          cmap=cm.viridis, 
                          shading='auto')
        
        cbar = plt.colorbar(im, ax=ax)
        cbar.set_label('Stress (MPa)', fontsize=12)
        
        ax.set_xlabel('Length (m)', fontsize=12)
        ax.set_ylabel('Height (m)', fontsize=12)
        ax.set_title(f'{stress_type.replace("_", " ").title()} Stress Distribution', 
                    fontsize=14, fontweight='bold')
        
        ax.set_aspect('auto')
        
        params = self.results['parameters']
        joint_x = params['beam_length'] * 0.45
        joint_width = params['tenon_length']
        rect = Rectangle((joint_x, -params['tenon_width']/2), 
                        joint_width, params['tenon_width'],
                        fill=False, edgecolor='red', linewidth=2, linestyle='--')
        ax.add_patch(rect)
        ax.text(joint_x + joint_width/2, -params['tenon_width']/2 - 0.005, 
                'Joint Region', ha='center', va='top', color='red', fontsize=10)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def plot_stress_profile(self,
                            position: float = 0.5,
                            save_path: Optional[str] = None,
                            show: bool = True) -> None:
        if self.results is None:
            raise ValueError("No results set for visualization")
        
        stress_field = self.results['stress_field']
        X = stress_field['X']
        Y = stress_field['Y']
        
        position = np.clip(position, 0.01, 0.99)
        x_idx = np.argmin(np.abs(X[0, :] - position * X[0, -1]))
        
        y_profile = Y[:, x_idx]
        sigma_x_profile = stress_field['sigma_x'][:, x_idx] / 1e6
        sigma_y_profile = stress_field['sigma_y'][:, x_idx] / 1e6
        tau_xy_profile = stress_field['tau_xy'][:, x_idx] / 1e6
        von_mises_profile = stress_field['von_mises'][:, x_idx] / 1e6
        
        sigma_x_profile = np.nan_to_num(sigma_x_profile, nan=0.0, posinf=1000, neginf=-1000)
        sigma_y_profile = np.nan_to_num(sigma_y_profile, nan=0.0, posinf=1000, neginf=-1000)
        tau_xy_profile = np.nan_to_num(tau_xy_profile, nan=0.0, posinf=1000, neginf=-1000)
        von_mises_profile = np.nan_to_num(von_mises_profile, nan=0.0, posinf=1000, neginf=-1000)
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        ax1.plot(sigma_x_profile, y_profile, 'b-', linewidth=2, label='σ_x')
        ax1.plot(sigma_y_profile, y_profile, 'r-', linewidth=2, label='σ_y')
        ax1.plot(von_mises_profile, y_profile, 'g--', linewidth=2, label='Von Mises')
        
        all_normal_stresses = np.concatenate([sigma_x_profile, sigma_y_profile, von_mises_profile])
        x_min = np.min(all_normal_stresses) * 1.1
        x_max = np.max(all_normal_stresses) * 1.1
        if x_min == x_max:
            x_min -= 1
            x_max += 1
        ax1.set_xlim(x_min, x_max)
        
        y_min = np.min(y_profile) * 1.1
        y_max = np.max(y_profile) * 1.1
        ax1.set_ylim(y_min, y_max)
        
        ax1.set_xlabel('Stress (MPa)', fontsize=12)
        ax1.set_ylabel('Height (m)', fontsize=12)
        ax1.set_title('Normal Stress Profile', fontsize=14, fontweight='bold')
        ax1.legend(fontsize=10)
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[1]
        ax2.plot(tau_xy_profile, y_profile, 'm-', linewidth=2, label='τ_xy')
        
        tau_min = np.min(tau_xy_profile) * 1.1
        tau_max = np.max(tau_xy_profile) * 1.1
        if tau_min == tau_max:
            tau_min -= 1
            tau_max += 1
        ax2.set_xlim(tau_min, tau_max)
        ax2.set_ylim(y_min, y_max)
        
        ax2.set_xlabel('Shear Stress (MPa)', fontsize=12)
        ax2.set_ylabel('Height (m)', fontsize=12)
        ax2.set_title('Shear Stress Profile', fontsize=14, fontweight='bold')
        ax2.legend(fontsize=10)
        ax2.grid(True, alpha=0.3)
        
        plt.suptitle(f'Stress Profile at {position*100:.0f}% of Beam Length',
                    fontsize=16, fontweight='bold', y=1.02)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def plot_safety_factors(self,
                            save_path: Optional[str] = None,
                            show: bool = True) -> None:
        if self.results is None:
            raise ValueError("No results set for visualization")
        
        sf = self.results['safety_factors']
        
        categories = ['Compressive', 'Tensile', 'Shear', 'Contact', 'Overall']
        values = [sf['compressive'], sf['tensile'], sf['shear'], 
                 sf['contact'], sf['overall']]
        
        values = [np.nan_to_num(v, nan=0.0, posinf=1000, neginf=0) for v in values]
        values_clipped = [min(v, 100) for v in values]
        
        colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6']
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        bars = ax.bar(categories, values_clipped, color=colors, alpha=0.8, edgecolor='black')
        
        ax.axhline(y=1.0, color='red', linestyle='--', linewidth=2, label='Safety Limit (SF=1)')
        ax.axhline(y=2.0, color='orange', linestyle='--', linewidth=1.5, alpha=0.7, label='Target SF=2')
        
        for bar, value in zip(bars, values):
            height = bar.get_height()
            display_value = value if value < 100 else '>100'
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{display_value}' if isinstance(display_value, str) else f'{display_value:.2f}',
                   ha='center', va='bottom', fontsize=11, fontweight='bold')
        
        y_max = max(max(values_clipped) * 1.2, 5.0)
        ax.set_ylim(0, y_max)
        
        ax.set_xlabel('Failure Mode', fontsize=12)
        ax.set_ylabel('Safety Factor', fontsize=12)
        ax.set_title('Safety Factors by Failure Mode', fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, axis='y', alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def plot_joint_schematic(self,
                              save_path: Optional[str] = None,
                              show: bool = True) -> None:
        if self.results is None:
            raise ValueError("No results set for visualization")
        
        params = self.results['parameters']
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        beam1_x = 0
        beam1_y = -params['beam_height'] / 2
        beam1_w = params['beam_length'] * 0.5
        beam1_h = params['beam_height']
        
        rect1 = Rectangle((beam1_x, beam1_y), beam1_w, beam1_h,
                         facecolor='lightblue', edgecolor='blue', linewidth=2)
        ax.add_patch(rect1)
        
        beam2_x = params['beam_length'] * 0.5 - params['tenon_length']
        beam2_y = -params['beam_height'] / 2
        beam2_w = params['beam_length'] * 0.5
        beam2_h = params['beam_height']
        
        rect2 = Rectangle((beam2_x, beam2_y), beam2_w, beam2_h,
                         facecolor='lightgreen', edgecolor='green', linewidth=2)
        ax.add_patch(rect2)
        
        tenon_x = params['beam_length'] * 0.5 - params['tenon_length']
        tenon_y = -params['tenon_width'] / 2
        tenon_w = params['tenon_length']
        tenon_h = params['tenon_width']
        
        rect3 = Rectangle((tenon_x, tenon_y), tenon_w, tenon_h,
                         facecolor='orange', edgecolor='red', linewidth=2, alpha=0.7)
        ax.add_patch(rect3)
        
        ax.annotate('', xy=(params['beam_length'] + 0.02, 0), 
                   xytext=(params['beam_length'] * 0.8, 0),
                   arrowprops=dict(arrowstyle='->', color='red', lw=2))
        ax.text(params['beam_length'] * 0.85, 0.015, 
               f'Load: {params["load_magnitude"]} N', 
               ha='center', color='red', fontweight='bold')
        
        ax.text(beam1_w/4, 0, 'Beam 1\n(Mortise)', ha='center', va='center', fontsize=10)
        ax.text(params['beam_length'] * 0.75, 0, 'Beam 2\n(Tenon)', ha='center', va='center', fontsize=10)
        ax.text((tenon_x + tenon_w/2), tenon_y - 0.01, 'Joint\nRegion', ha='center', va='top', 
               color='red', fontsize=10, fontweight='bold')
        
        ax.annotate(f'Tenon Length: {params["tenon_length"]*1000:.1f} mm',
                   xy=(tenon_x + tenon_w/2, tenon_y + tenon_h),
                   xytext=(tenon_x + tenon_w/2, tenon_y + tenon_h + 0.015),
                   ha='center', arrowprops=dict(arrowstyle='-|>', color='black'))
        
        ax.set_xlim(-0.02, params['beam_length'] + 0.05)
        ax.set_ylim(-params['beam_height']/2 - 0.03, params['beam_height']/2 + 0.03)
        ax.set_aspect('equal')
        ax.set_xlabel('Position (m)', fontsize=12)
        ax.set_ylabel('Height (m)', fontsize=12)
        ax.set_title(f'{params["joint_type"].replace("_", " ").title()} Joint Schematic', 
                    fontsize=14, fontweight='bold')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def plot_parametric_study(self,
                               study_results: List[Dict[str, Any]],
                               param_name: str,
                               save_path: Optional[str] = None,
                               show: bool = True) -> None:
        data_points = []
        
        for result in study_results:
            param_val = result['parameters'][param_name]
            stress_val = result['max_stresses']['max_von_mises'] / 1e6
            sf_val = result['safety_factors']['overall']
            def_val = result['deformation']['total'] * 1000
            
            data_points.append({
                'param': param_val,
                'stress': stress_val,
                'safety_factor': sf_val,
                'deformation': def_val
            })
        
        data_points.sort(key=lambda x: x['param'])
        
        param_values = [np.nan_to_num(d['param'], nan=0.0, posinf=1e6, neginf=0) for d in data_points]
        max_stresses = [np.nan_to_num(d['stress'], nan=0.0, posinf=1000, neginf=0) for d in data_points]
        safety_factors = [np.nan_to_num(d['safety_factor'], nan=0.0, posinf=100, neginf=0) for d in data_points]
        deformations = [np.nan_to_num(d['deformation'], nan=0.0, posinf=1000, neginf=0) for d in data_points]
        
        fig, axes = plt.subplots(1, 3, figsize=(18, 5))
        
        ax1 = axes[0]
        ax1.plot(param_values, max_stresses, 'o-', color='blue', linewidth=2, markersize=6)
        x_min, x_max = min(param_values), max(param_values)
        if x_min != x_max:
            ax1.set_xlim(x_min * 0.9, x_max * 1.1)
        y_min, y_max = min(max_stresses), max(max_stresses)
        if y_min != y_max:
            ax1.set_ylim(y_min * 0.9, y_max * 1.1)
        ax1.set_xlabel(f'{param_name.replace("_", " ").title()}', fontsize=12)
        ax1.set_ylabel('Max Von Mises Stress (MPa)', fontsize=12)
        ax1.set_title('Stress vs Parameter', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[1]
        ax2.plot(param_values, safety_factors, 'o-', color='green', linewidth=2, markersize=6)
        ax2.axhline(y=1.0, color='red', linestyle='--', linewidth=2, alpha=0.7, label='SF=1 Limit')
        if x_min != x_max:
            ax2.set_xlim(x_min * 0.9, x_max * 1.1)
        y_min_sf, y_max_sf = min(safety_factors), max(safety_factors)
        if y_min_sf != y_max_sf:
            ax2.set_ylim(max(0, y_min_sf * 0.9), y_max_sf * 1.1)
        else:
            ax2.set_ylim(0, max(5, y_max_sf * 1.1))
        ax2.set_xlabel(f'{param_name.replace("_", " ").title()}', fontsize=12)
        ax2.set_ylabel('Overall Safety Factor', fontsize=12)
        ax2.set_title('Safety Factor vs Parameter', fontsize=14, fontweight='bold')
        ax2.legend(fontsize=10)
        ax2.grid(True, alpha=0.3)
        
        ax3 = axes[2]
        ax3.plot(param_values, deformations, 'o-', color='orange', linewidth=2, markersize=6)
        if x_min != x_max:
            ax3.set_xlim(x_min * 0.9, x_max * 1.1)
        y_min_def, y_max_def = min(deformations), max(deformations)
        if y_min_def != y_max_def:
            ax3.set_ylim(max(0, y_min_def * 0.9), y_max_def * 1.1)
        ax3.set_xlabel(f'{param_name.replace("_", " ").title()}', fontsize=12)
        ax3.set_ylabel('Total Deformation (mm)', fontsize=12)
        ax3.set_title('Deformation vs Parameter', fontsize=14, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        
        plt.suptitle(f'Parametric Study: Effect of {param_name.replace("_", " ").title()}',
                    fontsize=16, fontweight='bold', y=1.02)
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def plot_comparison_stresses(self,
                                  save_path: Optional[str] = None,
                                  show: bool = True) -> None:
        if self.results is None:
            raise ValueError("No results set for visualization")
        
        max_stresses = self.results['max_stresses']
        contact_stresses = self.results['contact_stresses']
        
        categories = ['σ_x (max)', 'σ_y (max)', 'τ_xy (max)', 
                     'Von Mises (max)', 'Contact Pressure']
        values = [
            max_stresses['max_sigma_x'] / 1e6,
            max_stresses['max_sigma_y'] / 1e6,
            max_stresses['max_tau_xy'] / 1e6,
            max_stresses['max_von_mises'] / 1e6,
            contact_stresses['contact_pressure'] / 1e6
        ]
        
        colors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6']
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        bars = ax.bar(categories, values, color=colors, alpha=0.8, edgecolor='black')
        
        params = self.results['parameters']
        comp_strength = params['compressive_strength'] / 1e6
        ax.axhline(y=comp_strength, color='red', linestyle='--', linewidth=2,
                  label=f'Compressive Strength ({comp_strength:.1f} MPa)')
        
        for bar, value in zip(bars, values):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{value:.2f}',
                   ha='center', va='bottom', fontsize=11, fontweight='bold')
        
        ax.set_ylabel('Stress (MPa)', fontsize=12)
        ax.set_title('Comparison of Maximum Stresses', fontsize=14, fontweight='bold')
        ax.legend(fontsize=10)
        ax.grid(True, axis='y', alpha=0.3)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
        
        if show:
            plt.show()
        else:
            plt.close()
    
    def generate_report(self, output_dir: Optional[str] = None) -> str:
        if self.results is None:
            raise ValueError("No results set for visualization")
        
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(__file__), 'data', 'reports')
        
        os.makedirs(output_dir, exist_ok=True)
        
        sim_id = self.results['simulation_id']
        base_name = f"report_{sim_id}"
        
        self.plot_stress_heatmap('von_mises',
                                save_path=os.path.join(output_dir, f"{base_name}_stress_heatmap.png"),
                                show=False)
        
        self.plot_stress_profile(save_path=os.path.join(output_dir, f"{base_name}_stress_profile.png"),
                                show=False)
        
        self.plot_safety_factors(save_path=os.path.join(output_dir, f"{base_name}_safety_factors.png"),
                                show=False)
        
        self.plot_joint_schematic(save_path=os.path.join(output_dir, f"{base_name}_schematic.png"),
                                show=False)
        
        self.plot_comparison_stresses(save_path=os.path.join(output_dir, f"{base_name}_stress_comparison.png"),
                                     show=False)
        
        return output_dir
