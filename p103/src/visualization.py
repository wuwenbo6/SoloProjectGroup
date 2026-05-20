import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from typing import Dict, List, Tuple, Optional
import os


class Visualization:
    def __init__(self, output_dir: str = './output', style: str = 'default'):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        plt.style.use(style)
        self.figures: Dict[str, Figure] = {}
    
    def plot_tension_time_series(self, time: np.ndarray, tension: np.ndarray,
                                  title: str = 'Tension Time Series',
                                  xlabel: str = 'Time (s)',
                                  ylabel: str = 'Tension (N)',
                                  filename: Optional[str] = None,
                                  show_peaks: bool = False,
                                  peaks: Optional[np.ndarray] = None) -> str:
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(time, tension, 'b-', linewidth=1.5, alpha=0.8)
        
        if show_peaks and peaks is not None:
            ax.plot(time[peaks], tension[peaks], 'ro', markersize=6, label='Peaks')
            ax.legend()
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel(xlabel, fontsize=12)
        ax.set_ylabel(ylabel, fontsize=12)
        ax.grid(True, alpha=0.3)
        ax.tick_params(axis='both', labelsize=10)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
            fig.savefig(filepath, dpi=300, bbox_inches='tight')
        else:
            filepath = os.path.join(self.output_dir, 'tension_time_series.png')
            fig.savefig(filepath, dpi=300, bbox_inches='tight')
        
        self.figures['tension_time_series'] = fig
        plt.close(fig)
        return filepath
    
    def plot_multi_needle_tension(self, time_data: Dict[int, np.ndarray],
                                   tension_data: Dict[int, np.ndarray],
                                   title: str = 'Multi-Needle Tension Comparison',
                                   filename: Optional[str] = None) -> str:
        fig, ax = plt.subplots(figsize=(14, 7))
        
        sorted_needles = sorted(time_data.keys())
        colors = plt.cm.viridis(np.linspace(0, 1, len(sorted_needles)))
        lines = []
        labels = []
        
        for idx, needle in enumerate(sorted_needles):
            time = time_data[needle]
            tension = tension_data[needle]
            line, = ax.plot(time, tension, color=colors[idx], 
                           linewidth=1.5, alpha=0.7)
            lines.append(line)
            labels.append(f'Needle {needle}')
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('Time (s)', fontsize=12)
        ax.set_ylabel('Tension (N)', fontsize=12)
        ax.legend(lines, labels, loc='best', fontsize=10)
        ax.grid(True, alpha=0.3)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'multi_needle_tension.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['multi_needle_tension'] = fig
        plt.close(fig)
        return filepath
    
    def plot_tension_distribution(self, tension: np.ndarray,
                                   title: str = 'Tension Distribution',
                                   filename: Optional[str] = None,
                                   bins: int = 50) -> str:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1.hist(tension, bins=bins, color='skyblue', edgecolor='black', alpha=0.7)
        ax1.set_title('Histogram', fontsize=12, fontweight='bold')
        ax1.set_xlabel('Tension (N)', fontsize=10)
        ax1.set_ylabel('Frequency', fontsize=10)
        ax1.grid(True, alpha=0.3)
        
        ax2.boxplot(tension, vert=True, patch_artist=True,
                    boxprops=dict(facecolor='lightblue', alpha=0.7))
        ax2.set_title('Box Plot', fontsize=12, fontweight='bold')
        ax2.set_ylabel('Tension (N)', fontsize=10)
        ax2.grid(True, alpha=0.3)
        
        fig.suptitle(title, fontsize=14, fontweight='bold')
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'tension_distribution.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['tension_distribution'] = fig
        plt.close(fig)
        return filepath
    
    def plot_fft_spectrum(self, frequencies: np.ndarray, amplitudes: np.ndarray,
                           title: str = 'FFT Spectrum',
                           filename: Optional[str] = None) -> str:
        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(frequencies, amplitudes, 'g-', linewidth=1.5)
        ax.fill_between(frequencies, amplitudes, alpha=0.3, color='green')
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('Frequency (Hz)', fontsize=12)
        ax.set_ylabel('Amplitude', fontsize=12)
        ax.grid(True, alpha=0.3)
        ax.set_xlim(left=0)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'fft_spectrum.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['fft_spectrum'] = fig
        plt.close(fig)
        return filepath
    
    def plot_tension_statistics(self, time: np.ndarray, tension: np.ndarray,
                                 rolling_mean: np.ndarray, rolling_std: np.ndarray,
                                 title: str = 'Tension Statistics',
                                 filename: Optional[str] = None) -> str:
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10), sharex=True)
        
        ax1.plot(time, tension, 'b-', label='Original', alpha=0.5, linewidth=1)
        ax1.plot(time, rolling_mean, 'r-', label='Rolling Mean', linewidth=2)
        ax1.set_ylabel('Tension (N)', fontsize=12)
        ax1.legend(loc='best', fontsize=10)
        ax1.grid(True, alpha=0.3)
        ax1.set_title(title, fontsize=14, fontweight='bold')
        
        ax2.plot(time, rolling_std, 'orange', linewidth=2)
        ax2.fill_between(time, rolling_std, alpha=0.3, color='orange')
        ax2.set_xlabel('Time (s)', fontsize=12)
        ax2.set_ylabel('Rolling Std (N)', fontsize=12)
        ax2.grid(True, alpha=0.3)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'tension_statistics.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['tension_statistics'] = fig
        plt.close(fig)
        return filepath
    
    def plot_parameter_sweep(self, param_values: np.ndarray, results: Dict[str, np.ndarray],
                              param_name: str = 'Parameter',
                              title: str = 'Parameter Sweep Results',
                              filename: Optional[str] = None) -> str:
        fig, ax = plt.subplots(figsize=(12, 6))
        
        colors = plt.cm.tab10(np.linspace(0, 1, len(results)))
        
        for idx, (metric, values) in enumerate(results.items()):
            ax.plot(param_values, values, 'o-', color=colors[idx], 
                    label=metric, markersize=5, linewidth=2)
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel(param_name, fontsize=12)
        ax.set_ylabel('Value', fontsize=12)
        ax.legend(loc='best', fontsize=10)
        ax.grid(True, alpha=0.3)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'parameter_sweep.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['parameter_sweep'] = fig
        plt.close(fig)
        return filepath
    
    def plot_stitch_type_comparison(self, stitch_types: List[str], 
                                      tension_data: List[np.ndarray],
                                      title: str = 'Stitch Type Comparison',
                                      filename: Optional[str] = None) -> str:
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        axes = axes.flatten()
        
        n_stitch = len(stitch_types)
        colors = plt.cm.Set2(np.linspace(0, 1, n_stitch))
        
        means = [np.mean(data) for data in tension_data]
        stds = [np.std(data) for data in tension_data]
        maxima = [np.max(data) for data in tension_data]
        
        axes[0].bar(stitch_types, means, yerr=stds, color=colors, 
                    capsize=5, alpha=0.7)
        axes[0].set_title('Mean Tension', fontsize=12, fontweight='bold')
        axes[0].set_ylabel('Tension (N)', fontsize=10)
        axes[0].tick_params(axis='x', rotation=45)
        axes[0].grid(True, alpha=0.3, axis='y')
        
        axes[1].bar(stitch_types, maxima, color=colors, alpha=0.7)
        axes[1].set_title('Maximum Tension', fontsize=12, fontweight='bold')
        axes[1].set_ylabel('Tension (N)', fontsize=10)
        axes[1].tick_params(axis='x', rotation=45)
        axes[1].grid(True, alpha=0.3, axis='y')
        
        axes[2].clear()
        legend_patches = []
        for idx, (stitch_type, tension) in enumerate(zip(stitch_types, tension_data)):
            n, bins, patches = axes[2].hist(tension, bins=30, alpha=0.5, 
                                         color=colors[idx], density=True)
            patch = plt.Rectangle((0,0),1,1, color=colors[idx], alpha=0.5)
            legend_patches.append((patch, stitch_type))
        
        axes[2].set_title('Tension Distribution', fontsize=12, fontweight='bold')
        axes[2].set_xlabel('Tension (N)', fontsize=10)
        if legend_patches:
            patches_list, labels_list = zip(*legend_patches)
            axes[2].legend(patches_list, labels_list, fontsize=8, loc='best')
        axes[2].grid(True, alpha=0.3)
        
        violin_parts = axes[3].violinplot(tension_data, showmeans=True, showmedians=False)
        for idx, pc in enumerate(violin_parts['bodies']):
            pc.set_facecolor(colors[idx % len(colors)])
            pc.set_alpha(0.7)
        
        axes[3].set_xticks(np.arange(1, len(stitch_types) + 1))
        axes[3].set_xticklabels(stitch_types, rotation=45)
        axes[3].set_title('Violin Plot', fontsize=12, fontweight='bold')
        axes[3].set_ylabel('Tension (N)', fontsize=10)
        axes[3].grid(True, alpha=0.3, axis='y')
        
        fig.suptitle(title, fontsize=14, fontweight='bold')
        plt.tight_layout()
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'stitch_type_comparison.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['stitch_type_comparison'] = fig
        plt.close(fig)
        return filepath
    
    def plot_autocorrelation(self, autocorr: np.ndarray,
                              title: str = 'Autocorrelation',
                              filename: Optional[str] = None) -> str:
        fig, ax = plt.subplots(figsize=(12, 6))
        lags = np.arange(len(autocorr))
        
        ax.stem(lags, autocorr, basefmt='b-', linefmt='r-', markerfmt='ro')
        ax.axhline(y=0, color='black', linestyle='--', alpha=0.5)
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('Lag', fontsize=12)
        ax.set_ylabel('Autocorrelation', fontsize=12)
        ax.grid(True, alpha=0.3)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'autocorrelation.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['autocorrelation'] = fig
        plt.close(fig)
        return filepath
    
    def plot_psd(self, freqs: np.ndarray, psd: np.ndarray,
                  title: str = 'Power Spectral Density',
                  filename: Optional[str] = None) -> str:
        fig, ax = plt.subplots(figsize=(12, 6))
        
        ax.semilogy(freqs, psd, 'b-', linewidth=1.5)
        ax.fill_between(freqs, psd, alpha=0.3, color='blue')
        
        ax.set_title(title, fontsize=14, fontweight='bold')
        ax.set_xlabel('Frequency (Hz)', fontsize=12)
        ax.set_ylabel('PSD (N²/Hz)', fontsize=12)
        ax.grid(True, alpha=0.3)
        ax.set_xlim(left=0)
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'psd.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['psd'] = fig
        plt.close(fig)
        return filepath
    
    def create_summary_dashboard(self, time: np.ndarray, tension: np.ndarray,
                                  freqs: np.ndarray, psd: np.ndarray,
                                  stats: Dict,
                                  title: str = 'Simulation Summary',
                                  filename: Optional[str] = None) -> str:
        fig = plt.figure(figsize=(16, 12))
        gs = fig.add_gridspec(3, 3)
        
        ax1 = fig.add_subplot(gs[0, :])
        ax1.plot(time, tension, 'b-', linewidth=1)
        ax1.set_title('Tension Time Series', fontsize=12, fontweight='bold')
        ax1.set_ylabel('Tension (N)')
        ax1.grid(True, alpha=0.3)
        
        ax2 = fig.add_subplot(gs[1, 0])
        ax2.hist(tension, bins=30, color='skyblue', edgecolor='black', alpha=0.7)
        ax2.set_title('Distribution', fontsize=10, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        
        ax3 = fig.add_subplot(gs[1, 1])
        ax3.semilogy(freqs, psd, 'g-', linewidth=1)
        ax3.set_title('PSD', fontsize=10, fontweight='bold')
        ax3.grid(True, alpha=0.3)
        
        ax4 = fig.add_subplot(gs[1, 2])
        ax4.boxplot(tension, vert=True, patch_artist=True)
        ax4.set_title('Box Plot', fontsize=10, fontweight='bold')
        ax4.grid(True, alpha=0.3, axis='y')
        
        ax5 = fig.add_subplot(gs[2, :])
        ax5.axis('off')
        stats_text = '\n'.join([f'{k}: {v:.4f}' if isinstance(v, float) 
                                else f'{k}: {v}' for k, v in stats.items()])
        ax5.text(0.1, 0.5, 'Statistics:\n\n' + stats_text, 
                 fontsize=11, verticalalignment='center',
                 bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        fig.suptitle(title, fontsize=16, fontweight='bold')
        plt.tight_layout()
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'summary_dashboard.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['summary_dashboard'] = fig
        plt.close(fig)
        return filepath
    
    def plot_multi_stitch_coordination(self, coord_result: Dict,
                                         title: str = 'Multi-Stitch Tension Coordination',
                                         filename: Optional[str] = None) -> str:
        time = coord_result['time']
        combined_tension = coord_result['combined_tension']
        individual_tensions = coord_result['individual_tensions']
        
        n_stitch = len(individual_tensions)
        fig, axes = plt.subplots(n_stitch + 1, 1, figsize=(14, 4 * (n_stitch + 1)),
                                 sharex=True, gridspec_kw={'height_ratios': [2] + [1] * n_stitch})
        
        if n_stitch == 0:
            return "No stitch data to plot"
        
        axes[0].plot(time, combined_tension, 'b-', linewidth=2, alpha=0.8)
        axes[0].set_title(f'{title} - Combined Tension', fontsize=14, fontweight='bold')
        axes[0].set_ylabel('Tension (N)')
        axes[0].grid(True, alpha=0.3)
        
        colors = plt.cm.tab10(np.linspace(0, 1, n_stitch))
        for idx, stitch_data in enumerate(individual_tensions):
            ax = axes[idx + 1]
            stitch_time = stitch_data['time']
            stitch_tension = stitch_data['tension']
            if len(stitch_tension) > 0:
                ax.plot(stitch_time, stitch_tension, color=colors[idx], linewidth=1.5,
                       label=f"Needle {stitch_data['needle_id']}: {stitch_data['stitch_type']}")
                ax.axvline(stitch_data['start_time'], color='g', linestyle='--', alpha=0.5)
                ax.axvline(stitch_data['end_time'], color='r', linestyle='--', alpha=0.5)
                ax.legend(fontsize=9)
                ax.grid(True, alpha=0.3)
            ax.set_ylabel('Tension (N)')
        
        axes[-1].set_xlabel('Time (s)')
        plt.tight_layout()
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'multi_stitch_coordination.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['multi_stitch_coordination'] = fig
        plt.close(fig)
        return filepath
    
    def plot_anomaly_detection(self, time: np.ndarray, tension: np.ndarray,
                                anomaly_result: Dict,
                                title: str = 'Anomaly Detection Results',
                                filename: Optional[str] = None) -> str:
        fig, axes = plt.subplots(3, 1, figsize=(14, 12), sharex=True)
        
        axes[0].plot(time, tension, 'b-', linewidth=1, alpha=0.7, label='Tension Data')
        if len(anomaly_result['anomaly_indices']) > 0:
            axes[0].scatter(time[anomaly_result['anomaly_indices']],
                           tension[anomaly_result['anomaly_indices']],
                           c='red', s=50, marker='x', label='Anomalies', zorder=5)
        axes[0].set_title(f'{title} - Tension Data & Anomalies', fontsize=12, fontweight='bold')
        axes[0].set_ylabel('Tension (N)')
        axes[0].legend(fontsize=10)
        axes[0].grid(True, alpha=0.3)
        
        axes[1].plot(time, anomaly_result['rolling_mean'], 'g-', label='Rolling Mean', linewidth=1.5)
        axes[1].fill_between(time,
                            anomaly_result['rolling_mean'] - anomaly_result['rolling_std'],
                            anomaly_result['rolling_mean'] + anomaly_result['rolling_std'],
                            color='g', alpha=0.2, label='±1 Std')
        axes[1].set_title('Rolling Statistics', fontsize=12, fontweight='bold')
        axes[1].set_ylabel('Tension (N)')
        axes[1].legend(fontsize=10)
        axes[1].grid(True, alpha=0.3)
        
        axes[2].plot(time, anomaly_result['z_scores'], 'r-', linewidth=1)
        axes[2].axhline(y=3, color='orange', linestyle='--', label='Threshold (3σ)')
        axes[2].axhline(y=-3, color='orange', linestyle='--')
        axes[2].set_title('Z-Score Analysis', fontsize=12, fontweight='bold')
        axes[2].set_xlabel('Time (s)')
        axes[2].set_ylabel('Z-Score')
        axes[2].legend(fontsize=10)
        axes[2].grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'anomaly_detection.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['anomaly_detection'] = fig
        plt.close(fig)
        return filepath
    
    def plot_experimental_comparison(self, exp_time: np.ndarray, exp_tension: np.ndarray,
                                      sim_time: np.ndarray, sim_tension: np.ndarray,
                                      comp_result: Dict,
                                      title: str = 'Simulation vs Experimental Comparison',
                                      filename: Optional[str] = None) -> str:
        fig = plt.figure(figsize=(16, 12))
        gs = fig.add_gridspec(3, 2)
        
        ax1 = fig.add_subplot(gs[0, :])
        ax1.plot(exp_time, exp_tension, 'b-', linewidth=1.5, alpha=0.7, label='Experimental')
        ax1.plot(exp_time, comp_result['sim_interpolated'], 'r-', linewidth=1.5,
                alpha=0.7, label='Simulation (Interpolated)')
        ax1.set_title(f'{title} - Time Series Comparison', fontsize=14, fontweight='bold')
        ax1.set_ylabel('Tension (N)')
        ax1.legend(fontsize=11)
        ax1.grid(True, alpha=0.3)
        
        ax2 = fig.add_subplot(gs[1, 0])
        error = comp_result['error_time_series']
        ax2.plot(exp_time, error, 'g-', linewidth=1)
        ax2.axhline(y=0, color='k', linestyle='-', alpha=0.5)
        ax2.set_title('Error Time Series (Sim - Exp)', fontsize=12, fontweight='bold')
        ax2.set_ylabel('Error (N)')
        ax2.grid(True, alpha=0.3)
        
        ax3 = fig.add_subplot(gs[1, 1])
        ax3.hist(error, bins=50, color='skyblue', edgecolor='black', alpha=0.7)
        ax3.axvline(x=0, color='r', linestyle='--', label='Zero Error')
        ax3.set_title('Error Distribution', fontsize=12, fontweight='bold')
        ax3.set_xlabel('Error (N)')
        ax3.set_ylabel('Frequency')
        ax3.legend(fontsize=10)
        ax3.grid(True, alpha=0.3)
        
        ax4 = fig.add_subplot(gs[2, :])
        ax4.axis('off')
        
        metrics_text = f"""Accuracy Metrics:
        MAE:  {comp_result['mae']:.4f} N
        RMSE: {comp_result['rmse']:.4f} N
        MAPE: {comp_result['mape']:.2f} %
        Correlation: {comp_result['correlation']:.4f}
        Frequency Corr: {comp_result['frequency_correlation']:.4f}
        CV Error: {comp_result['cv_error_percent']:.2f} %
        Accuracy Score: {comp_result['accuracy_score']:.1f} / 100
        
        Statistics:
        Sim Mean: {comp_result['sim_mean']:.4f} N
        Exp Mean: {comp_result['exp_mean']:.4f} N
        Sim Std:  {comp_result['sim_std']:.4f} N
        Exp Std:  {comp_result['exp_std']:.4f} N
        
        Error Distribution:
        Mean Error: {comp_result['error_distribution']['mean_error']:.4f} N
        Error Std:  {comp_result['error_distribution']['error_std']:.4f} N
        Max Error:  {comp_result['error_distribution']['error_max']:.4f} N
        P95 Error:  {comp_result['error_distribution']['p95_error']:.4f} N
        """
        
        ax4.text(0.05, 0.5, metrics_text, fontsize=10, family='monospace',
                verticalalignment='center',
                bbox=dict(boxstyle='round', facecolor='lightblue', alpha=0.5))
        
        plt.tight_layout()
        
        if filename:
            filepath = os.path.join(self.output_dir, filename)
        else:
            filepath = os.path.join(self.output_dir, 'experimental_comparison.png')
        
        fig.savefig(filepath, dpi=300, bbox_inches='tight')
        self.figures['experimental_comparison'] = fig
        plt.close(fig)
        return filepath
    
    def clear_figures(self) -> None:
        self.figures.clear()
    
    def get_figure(self, name: str) -> Optional[Figure]:
        return self.figures.get(name)