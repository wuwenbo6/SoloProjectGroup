import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Optional, List, Dict, Any, Tuple
import gc
import warnings


class Downsampler:
    @staticmethod
    def downsample_1d(data: np.ndarray, max_points: int = 10000, method: str = 'auto') -> np.ndarray:
        if len(data) <= max_points:
            return data

        if method == 'auto':
            method = 'minmax' if max_points < len(data) // 10 else 'step'

        if method == 'step':
            step = len(data) // max_points
            return data[::step]

        elif method == 'minmax':
            num_chunks = max_points // 2
            chunk_size = len(data) // num_chunks

            result = []
            for i in range(num_chunks):
                chunk = data[i * chunk_size:(i + 1) * chunk_size]
                if len(chunk) > 0:
                    result.append(np.min(chunk))
                    result.append(np.max(chunk))

            return np.array(result)

        elif method == 'lttb':
            return Downsampler._largest_triangle_three_buckets(data, max_points)

        else:
            step = len(data) // max_points
            return data[::step]

    @staticmethod
    def _largest_triangle_three_buckets(data: np.ndarray, n_out: int) -> np.ndarray:
        if n_out >= len(data):
            return data

        n_in = len(data)
        sampled = np.zeros(n_out, dtype=data.dtype)
        sampled[0] = data[0]
        sampled[-1] = data[-1]

        bucket_size = (n_in - 2) / (n_out - 2)

        for i in range(1, n_out - 1):
            avg_range = range(
                int((i + 0) * bucket_size) + 1,
                int((i + 1) * bucket_size) + 1
            )
            avg_y = np.mean(data[avg_range])

            max_area = -1
            max_idx = int((i - 1) * bucket_size) + 1
            end = int((i + 0) * bucket_size) + 1

            for j in range(max_idx, end):
                area = abs(
                    (data[j - 1] - avg_y) * (j + 1 - j) -
                    (data[j - 1] - data[j]) * (j + 1 - j)
                ) / 2
                if area > max_area:
                    max_area = area
                    max_idx = j

            sampled[i] = data[max_idx]

        return sampled

    @staticmethod
    def downsample_2d(spec: np.ndarray, max_height: int = 512, max_width: int = 2000) -> np.ndarray:
        if spec.shape[0] <= max_height and spec.shape[1] <= max_width:
            return spec

        height_step = max(1, spec.shape[0] // max_height)
        width_step = max(1, spec.shape[1] // max_width)

        return spec[::height_step, ::width_step]


class MemoryOptimizedWaveform:
    def __init__(self, max_points: int = 10000, downsample_method: str = 'minmax'):
        self.max_points = max_points
        self.downsample_method = downsample_method

    def create_waveform(self, y: np.ndarray, sr: int,
                         title: str = '音频波形',
                         show_controls: bool = True) -> go.Figure:
        if len(y) > self.max_points:
            y_downsampled = Downsampler.downsample_1d(y, self.max_points, self.downsample_method)
            x = np.arange(len(y_downsampled)) / sr
            x *= len(y) / len(y_downsampled)
        else:
            y_downsampled = y
            x = np.arange(len(y)) / sr

        fig = go.Figure()
        fig.add_trace(go.Scattergl(
            x=x,
            y=y_downsampled,
            mode='lines',
            line=dict(color='#1f77b4', width=1),
            name='波形',
            hovertemplate='时间: %{x:.3f}s<br>振幅: %{y:.4f}<extra></extra>'
        ))

        fig.update_layout(
            title=dict(text=title, x=0.5, xanchor='center'),
            xaxis_title='时间 (秒)',
            yaxis_title='振幅',
            hovermode='x unified',
            uirevision='constant',
            dragmode='pan'
        )

        if show_controls:
            fig.update_layout(
                xaxis=dict(rangeslider=dict(visible=True), type='linear')
            )

        del y_downsampled, x
        gc.collect()

        return fig

    def create_multi_channel_waveform(self, y: np.ndarray, sr: int,
                                       channel_names: Optional[List[str]] = None,
                                       title: str = '多通道音频波形') -> go.Figure:
        if len(y.shape) == 1:
            y = y.reshape(-1, 1)

        n_channels = y.shape[1]
        if channel_names is None:
            channel_names = [f'通道 {i + 1}' for i in range(n_channels)]

        fig = make_subplots(rows=n_channels, cols=1, shared_xaxes=True,
                            subplot_titles=channel_names)

        for i in range(n_channels):
            channel_data = y[:, i]
            if len(channel_data) > self.max_points:
                channel_data = Downsampler.downsample_1d(channel_data, self.max_points, self.downsample_method)

            x = np.arange(len(channel_data)) / sr
            if len(channel_data) < len(y):
                x *= len(y) / len(channel_data)

            fig.add_trace(
                go.Scattergl(
                    x=x, y=channel_data, mode='lines',
                    line=dict(width=1), name=channel_names[i]
                ),
                row=i + 1, col=1
            )

        fig.update_layout(
            title=dict(text=title, x=0.5),
            height=300 * n_channels,
            showlegend=False,
            uirevision='constant'
        )
        fig.update_xaxes(title_text='时间 (秒)', row=n_channels, col=1)
        fig.update_yaxes(title_text='振幅')

        del channel_data, x
        gc.collect()

        return fig


class OptimizedSpectrogram:
    def __init__(self, max_freq_bins: int = 512, max_time_steps: int = 2000,
                 use_log_scale: bool = True):
        self.max_freq_bins = max_freq_bins
        self.max_time_steps = max_time_steps
        self.use_log_scale = use_log_scale

    def create_spectrogram(self, S: np.ndarray, sr: int,
                            hop_length: int = 512,
                            title: str = '频谱图',
                            colorscale: str = 'Viridis',
                            dynamic_range: float = 80.0) -> go.Figure:
        if self.use_log_scale:
            S_db = 10 * np.log10(np.abs(S) ** 2 + 1e-10)
            S_db = S_db - np.max(S_db)
            S_db = np.clip(S_db, -dynamic_range, 0)
        else:
            S_db = np.abs(S)

        S_db = Downsampler.downsample_2d(S_db, self.max_freq_bins, self.max_time_steps)

        n_freq, n_time = S_db.shape
        time_axis = np.arange(n_time) * hop_length / sr
        freq_axis = np.arange(n_freq) * sr / (2 * n_freq)

        fig = go.Figure(data=go.Heatmap(
            z=S_db,
            x=time_axis,
            y=freq_axis,
            colorscale=colorscale,
            colorbar=dict(title='幅值 (dB)'),
            hovertemplate='时间: %{x:.3f}s<br>频率: %{y:.0f}Hz<br>幅值: %{z:.1f}dB<extra></extra>'
        ))

        fig.update_layout(
            title=dict(text=title, x=0.5),
            xaxis_title='时间 (秒)',
            yaxis_title='频率 (Hz)',
            uirevision='constant'
        )

        del S_db, time_axis, freq_axis
        gc.collect()

        return fig

    def create_mel_spectrogram(self, mel_spec: np.ndarray, sr: int,
                                 title: str = '梅尔频谱图',
                                 colorscale: str = 'Viridis') -> go.Figure:
        mel_spec_db = 10 * np.log10(mel_spec + 1e-10)
        mel_spec_db = Downsampler.downsample_2d(mel_spec_db, self.max_freq_bins, self.max_time_steps)

        time_axis = np.arange(mel_spec_db.shape[1]) * 512 / sr

        fig = go.Figure(data=go.Heatmap(
            z=mel_spec_db,
            x=time_axis,
            colorscale=colorscale,
            colorbar=dict(title='幅值 (dB)')
        ))

        fig.update_layout(
            title=dict(text=title, x=0.5),
            xaxis_title='时间 (秒)',
            yaxis_title='梅尔频带',
            uirevision='constant'
        )

        del mel_spec_db, time_axis
        gc.collect()

        return fig


class FeatureVisualizer:
    @staticmethod
    def create_rms_energy_plot(rms: np.ndarray, sr: int,
                                max_points: int = 5000) -> go.Figure:
        if len(rms) > max_points:
            rms = Downsampler.downsample_1d(rms, max_points)

        time_axis = np.arange(len(rms)) * 512 / sr

        fig = go.Figure()
        fig.add_trace(go.Scattergl(
            x=time_axis,
            y=rms,
            mode='lines',
            line=dict(color='#2ecc71'),
            name='RMS能量'
        ))

        fig.update_layout(
            title='RMS能量随时间变化',
            xaxis_title='时间 (秒)',
            yaxis_title='能量',
            uirevision='constant'
        )

        return fig

    @staticmethod
    def create_feature_comparison(features1: Dict[str, float],
                                   features2: Dict[str, float],
                                   label1: str = '音频1',
                                   label2: str = '音频2',
                                   title: str = '特征对比') -> go.Figure:
        common_keys = set(features1.keys()) & set(features2.keys())
        keys = sorted([k for k in common_keys if isinstance(features1[k], (int, float))])

        fig = go.Figure()

        x = np.arange(len(keys))
        width = 0.35

        fig.add_trace(go.Bar(
            x=x - width / 2,
            y=[features1[k] for k in keys],
            width=width,
            name=label1,
            marker_color='#3498db'
        ))

        fig.add_trace(go.Bar(
            x=x + width / 2,
            y=[features2[k] for k in keys],
            width=width,
            name=label2,
            marker_color='#e74c3c'
        ))

        fig.update_layout(
            title=title,
            xaxis=dict(tickmode='array', ticktext=keys, tickvals=x),
            yaxis_title='标准化值',
            barmode='group',
            uirevision='constant'
        )

        return fig

    @staticmethod
    def create_radar_chart(features: Dict[str, float],
                            title: str = '特征雷达图',
                            normalize: bool = True) -> go.Figure:
        numeric_features = {k: v for k, v in features.items()
                           if isinstance(v, (int, float, np.number)) and not np.isnan(v)}

        keys = list(numeric_features.keys())
        values = list(numeric_features.values())

        if normalize and values:
            max_val = max(values)
            if max_val > 0:
                values = [v / max_val for v in values]

        fig = go.Figure()
        fig.add_trace(go.Scatterpolar(
            r=values,
            theta=keys,
            fill='toself',
            name='特征值',
            line_color='#3498db'
        ))

        fig.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[0, 1] if normalize else None)),
            title=title,
            showlegend=False,
            uirevision='constant'
        )

        return fig


class BatchVisualizer:
    def __init__(self, max_cache_size: int = 100):
        self.max_cache_size = max_cache_size
        self._figure_cache: Dict[str, go.Figure] = {}

    def get_cached_figure(self, key: str) -> Optional[go.Figure]:
        return self._figure_cache.get(key)

    def cache_figure(self, key: str, fig: go.Figure):
        if len(self._figure_cache) >= self.max_cache_size:
            oldest_key = next(iter(self._figure_cache))
            del self._figure_cache[oldest_key]
        self._figure_cache[key] = fig

    def create_waveform_grid(self, audio_list: List[np.ndarray],
                              sr: int,
                              titles: Optional[List[str]] = None,
                              cols: int = 2,
                              max_points_per_plot: int = 5000) -> go.Figure:
        n_audios = len(audio_list)
        rows = (n_audios + cols - 1) // cols

        if titles is None:
            titles = [f'音频 {i + 1}' for i in range(n_audios)]

        fig = make_subplots(rows=rows, cols=cols, subplot_titles=titles)

        waveform_viz = MemoryOptimizedWaveform(max_points=max_points_per_plot)

        for i, y in enumerate(audio_list):
            row = i // cols + 1
            col = i % cols + 1

            if len(y) > max_points_per_plot:
                y_down = Downsampler.downsample_1d(y, max_points_per_plot)
            else:
                y_down = y

            x = np.arange(len(y_down)) / sr
            if len(y_down) < len(y):
                x *= len(y) / len(y_down)

            fig.add_trace(
                go.Scattergl(x=x, y=y_down, mode='lines', line=dict(width=1)),
                row=row, col=col
            )

        fig.update_layout(
            height=300 * rows,
            showlegend=False,
            title_text='音频波形网格',
            uirevision='constant'
        )

        gc.collect()
        return fig

    def clear_cache(self):
        self._figure_cache.clear()
        gc.collect()


def create_comparison_dashboard(y1: np.ndarray, y2: np.ndarray, sr: int,
                                labels: Tuple[str, str] = ('音频 A', '音频 B')) -> go.Figure:
    waveform_viz = MemoryOptimizedWaveform(max_points=8000)
    spec_viz = OptimizedSpectrogram(max_freq_bins=256, max_time_steps=1000)

    fig = make_subplots(
        rows=4, cols=2,
        subplot_titles=(
            f'{labels[0]} 波形', f'{labels[1]} 波形',
            f'{labels[0]} 频谱', f'{labels[1]} 频谱',
            f'{labels[0]} 能量', f'{labels[1]} 能量',
            '波形对比', '能量对比'
        ),
        vertical_spacing=0.08
    )

    for i, (y, label, col) in enumerate([(y1, labels[0], 1), (y2, labels[1], 2)]):
        if len(y) > 8000:
            y_down = Downsampler.downsample_1d(y, 8000)
        else:
            y_down = y
        x = np.arange(len(y_down)) / sr

        fig.add_trace(
            go.Scattergl(x=x, y=y_down, mode='lines', name=label),
            row=1, col=col
        )

    import librosa

    for i, (y, col) in enumerate([(y1, 1), (y2, 2)]):
        D = librosa.stft(y[:min(len(y), sr * 30)], n_fft=2048)
        D_db = 10 * np.log10(np.abs(D) ** 2 + 1e-10)
        D_db = Downsampler.downsample_2d(D_db, 256, 1000)

        time_axis = np.arange(D_db.shape[1]) * 512 / sr
        freq_axis = np.arange(D_db.shape[0]) * sr / (2 * D_db.shape[0])

        fig.add_trace(
            go.Heatmap(z=D_db, x=time_axis, y=freq_axis, colorscale='Viridis', showscale=False),
            row=2, col=col
        )

    for i, (y, col) in enumerate([(y1, 1), (y2, 2)]):
        rms = librosa.feature.rms(y=y)[0]
        time_axis = np.arange(len(rms)) * 512 / sr

        fig.add_trace(
            go.Scattergl(x=time_axis, y=rms, mode='lines', name=f'能量 {labels[i]}'),
            row=3, col=col
        )

    max_len = max(len(y1), len(y2))
    if max_len > 10000:
        y1_down = Downsampler.downsample_1d(y1, 10000)
        y2_down = Downsampler.downsample_1d(y2, 10000)
    else:
        y1_down, y2_down = y1, y2

    x1 = np.arange(len(y1_down)) / sr * len(y1) / len(y1_down)
    x2 = np.arange(len(y2_down)) / sr * len(y2) / len(y2_down)

    fig.add_trace(
        go.Scattergl(x=x1, y=y1_down, mode='lines', name=labels[0], line=dict(color='#3498db')),
        row=4, col=1
    )
    fig.add_trace(
        go.Scattergl(x=x2, y=y2_down, mode='lines', name=labels[1], line=dict(color='#e74c3c')),
        row=4, col=1
    )

    rms1 = librosa.feature.rms(y=y1)[0]
    rms2 = librosa.feature.rms(y=y2)[0]

    fig.add_trace(
        go.Histogram(x=rms1, name=labels[0], marker_color='#3498db', opacity=0.7),
        row=4, col=2
    )
    fig.add_trace(
        go.Histogram(x=rms2, name=labels[1], marker_color='#e74c3c', opacity=0.7),
        row=4, col=2
    )

    fig.update_layout(
        height=1200,
        title_text='音频对比仪表板',
        barmode='overlay',
        uirevision='constant'
    )

    gc.collect()
    return fig
