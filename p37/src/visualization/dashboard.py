import os
import dash
from dash import dcc, html, Input, Output, State, callback_context
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import librosa
from typing import Dict, Optional, List
import warnings
import gc
from functools import lru_cache


class RenderOptimizer:
    MAX_POINTS_WAVEFORM = 50000
    MAX_POINTS_SPECTROGRAM = 20000
    MAX_DATA_POINTS = 10000

    @staticmethod
    def downsample_1d(data: np.ndarray, max_points: int = MAX_POINTS_WAVEFORM) -> np.ndarray:
        if len(data) <= max_points:
            return data
        
        ratio = len(data) / max_points
        if ratio < 2:
            return data
        
        indices = np.linspace(0, len(data) - 1, max_points, dtype=np.int32)
        return data[indices]

    @staticmethod
    def downsample_2d(data: np.ndarray, max_cols: int = MAX_POINTS_SPECTROGRAM // 100) -> np.ndarray:
        if data.shape[1] <= max_cols:
            return data
        
        ratio = data.shape[1] / max_cols
        indices = np.linspace(0, data.shape[1] - 1, max_cols, dtype=np.int32)
        return data[:, indices]

    @staticmethod
    def downsample_dataframe(df: pd.DataFrame, max_rows: int = MAX_DATA_POINTS) -> pd.DataFrame:
        if len(df) <= max_rows:
            return df
        
        step = len(df) // max_rows
        return df.iloc[::step].reset_index(drop=True)

    @staticmethod
    def optimize_figure(fig: go.Figure) -> go.Figure:
        fig.update_layout(
            uirevision='constant',
            modebar={'orientation': 'v'},
        )
        
        for trace in fig.data:
            if hasattr(trace, 'hovertemplate'):
                trace.hovertemplate = trace.hovertemplate or '%{x}: %{y}'
        
        return fig


class OperaDashboard:
    def __init__(self, debug: bool = True, enable_optimizations: bool = True):
        self.app = dash.Dash(__name__)
        self.debug = debug
        self.enable_optimizations = enable_optimizations
        self.features_df = None
        self._features_cache = None
        self.singer_col = 'singer'
        self.opera_type_col = 'opera_type'
        self.year_col = 'year'
        self._render_cache = {}
        self._setup_layout()
        self._setup_callbacks()

    def _validate_and_clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if df is None or len(df) == 0:
            return pd.DataFrame()

        df_clean = df.copy()

        numeric_cols = df_clean.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce')
            median_val = df_clean[col].median()
            if pd.isna(median_val):
                median_val = 0
            df_clean[col] = df_clean[col].fillna(median_val)

            q1 = df_clean[col].quantile(0.01)
            q3 = df_clean[col].quantile(0.99)
            iqr = q3 - q1
            lower_bound = q1 - 3 * iqr
            upper_bound = q3 + 3 * iqr
            df_clean[col] = df_clean[col].clip(lower_bound, upper_bound)

        categorical_cols = [self.singer_col, self.opera_type_col]
        for col in categorical_cols:
            if col in df_clean.columns:
                df_clean[col] = df_clean[col].fillna('未知')
                df_clean[col] = df_clean[col].astype(str)

        if self.year_col in df_clean.columns:
            df_clean[self.year_col] = pd.to_numeric(df_clean[self.year_col], errors='coerce')
            df_clean[self.year_col] = df_clean[self.year_col].fillna(df_clean[self.year_col].median())
            df_clean[self.year_col] = df_clean[self.year_col].astype(int)

        return df_clean.dropna(how='all')

    def _create_empty_figure(self, message: str = "暂无数据") -> go.Figure:
        fig = go.Figure()
        fig.add_annotation(
            text=message,
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=20, color="#888888")
        )
        fig.update_layout(
            xaxis=dict(showticklabels=False, showgrid=False),
            yaxis=dict(showticklabels=False, showgrid=False),
            plot_bgcolor='white'
        )
        return fig

    def load_data(self, features_df: pd.DataFrame, singer_col: str = 'singer',
                   opera_type_col: str = 'opera_type', year_col: str = 'year'):
        self.singer_col = singer_col
        self.opera_type_col = opera_type_col
        self.year_col = year_col
        self.features_df = self._validate_and_clean_data(features_df)
        self._features_cache = {}
        self._render_cache.clear()
        gc.collect()

    def _get_cached_data(self, key: str, compute_func: callable):
        if key not in self._features_cache:
            self._features_cache[key] = compute_func()
        return self._features_cache[key]

    def _clear_render_cache(self):
        self._render_cache.clear()
        gc.collect()

    def _setup_layout(self):
        self.app.layout = html.Div([
            html.H1("戏曲唱腔数据分析系统", style={'textAlign': 'center', 'color': '#2c3e50', 'padding': '20px'}),

            dcc.Tabs([
                dcc.Tab(label='概览', children=[
                    html.Div([
                        html.H3("数据集概览", style={'padding': '15px'}),
                        html.Div(id='overview-stats', style={'padding': '20px'}),
                        dcc.Graph(id='opera-type-distribution')
                    ])
                ]),

                dcc.Tab(label='特征热力图', children=[
                    html.Div([
                        html.H3("唱腔特征热力图", style={'padding': '15px'}),
                        html.Div([
                            html.Label("选择特征组:"),
                            dcc.Dropdown(
                                id='heatmap-feature-group',
                                options=[
                                    {'label': '音调特征', 'value': 'pitch'},
                                    {'label': '节奏特征', 'value': 'rhythm'},
                                    {'label': '音色特征', 'value': 'timbre'},
                                    {'label': '全部特征', 'value': 'all'}
                                ],
                                value='all',
                                style={'width': '50%'}
                            )
                        ], style={'padding': '10px'}),
                        dcc.Graph(id='feature-heatmap')
                    ])
                ]),

                dcc.Tab(label='节奏变化分析', children=[
                    html.Div([
                        html.H3("节奏变化曲线", style={'padding': '15px'}),
                        html.Div([
                            html.Label("选择传承人:"),
                            dcc.Dropdown(id='singer-select', multi=True, style={'width': '70%'}),
                        ], style={'padding': '10px'}),
                        dcc.Graph(id='tempo-trend-graph'),
                        dcc.Graph(id='rhythm-comparison-graph')
                    ])
                ]),

                dcc.Tab(label='传承人对比', children=[
                    html.Div([
                        html.H3("传承人唱腔对比", style={'padding': '15px'}),
                        html.Div([
                            html.Label("选择传承人1:"),
                            dcc.Dropdown(id='singer1-select', style={'width': '45%', 'display': 'inline-block'}),
                            html.Label("  选择传承人2:", style={'marginLeft': '20px'}),
                            dcc.Dropdown(id='singer2-select', style={'width': '45%', 'display': 'inline-block', 'marginLeft': '10px'})
                        ], style={'padding': '10px'}),
                        dcc.Graph(id='singer-radar-chart'),
                        dcc.Graph(id='singer-bar-chart')
                    ])
                ]),

                dcc.Tab(label='趋势分析', children=[
                    html.Div([
                        html.H3("唱腔演变趋势", style={'padding': '15px'}),
                        html.Div([
                            html.Label("选择分析特征:"),
                            dcc.Dropdown(id='trend-feature-select', style={'width': '50%'}),
                        ], style={'padding': '10px'}),
                        dcc.Graph(id='trend-line-graph'),
                        dcc.Graph(id='style-evolution-graph')
                    ])
                ]),

                dcc.Tab(label='PCA分析', children=[
                    html.Div([
                        html.H3("主成分分析", style={'padding': '15px'}),
                        html.Div([
                            html.Label("着色依据:"),
                            dcc.RadioItems(
                                id='pca-color-by',
                                options=[
                                    {'label': '按传承人', 'value': 'singer'},
                                    {'label': '按戏曲类型', 'value': 'opera_type'}
                                ],
                                value='singer',
                                style={'padding': '10px'}
                            )
                        ]),
                        dcc.Graph(id='pca-scatter-2d')
                    ])
                ]),

                dcc.Tab(label='音频波形', children=[
                    html.Div([
                        html.H3("音频波形与频谱", style={'padding': '15px'}),
                        dcc.Upload(
                            id='upload-audio',
                            children=html.Div(['拖拽音频文件到此处 或 ', html.A('点击选择')]),
                            style={
                                'width': '100%', 'height': '60px', 'lineHeight': '60px',
                                'borderWidth': '1px', 'borderStyle': 'dashed', 'borderRadius': '5px',
                                'textAlign': 'center', 'margin': '10px', 'backgroundColor': '#f8f9fa'
                            },
                            multiple=False
                        ),
                        html.Div(id='audio-upload-status', style={'padding': '10px', 'textAlign': 'center'}),
                        dcc.Graph(id='waveform-plot'),
                        dcc.Graph(id='spectrogram-plot')
                    ])
                ])
            ])
        ], style={'fontFamily': 'Arial, sans-serif', 'backgroundColor': '#f5f6fa'})

    def _setup_callbacks(self):
        @self.app.callback(
            [Output('overview-stats', 'children'),
             Output('opera-type-distribution', 'figure'),
             Output('singer-select', 'options'),
             Output('singer1-select', 'options'),
             Output('singer2-select', 'options'),
             Output('trend-feature-select', 'options')],
            Input('singer-select', 'value')
        )
        def update_overview(_):
            if self.features_df is None or len(self.features_df) == 0:
                empty_fig = self._create_empty_figure("请先加载数据")
                return self._create_empty_stats(), empty_fig, [], [], [], []

            singers = sorted(self.features_df[self.singer_col].unique().tolist())
            singer_options = [{'label': str(s), 'value': str(s)} for s in singers if pd.notna(s)]

            numeric_features = self.features_df.select_dtypes(include=[np.number]).columns.tolist()
            feature_options = [{'label': f, 'value': f} for f in numeric_features if pd.notna(f)]

            stats = self._create_overview_stats()

            opera_type_counts = self.features_df[self.opera_type_col].value_counts().reset_index()
            opera_type_counts.columns = [self.opera_type_col, 'count']

            if len(opera_type_counts) > 0:
                dist_fig = px.pie(opera_type_counts, values='count', names=self.opera_type_col,
                                  title='戏曲类型分布', hole=0.3,
                                  color_discrete_sequence=px.colors.qualitative.Set3)
                dist_fig.update_layout(title_x=0.5)
            else:
                dist_fig = self._create_empty_figure("无戏曲类型数据")

            return stats, dist_fig, singer_options, singer_options, singer_options, feature_options

        @self.app.callback(
            Output('feature-heatmap', 'figure'),
            Input('heatmap-feature-group', 'value')
        )
        def update_heatmap(feature_group):
            if self.features_df is None or len(self.features_df) == 0:
                return self._create_empty_figure("请先加载数据")

            features = self._get_feature_group(feature_group)
            if len(features) == 0:
                return self._create_empty_figure("无可用特征数据")

            try:
                heatmap_data = self.features_df.groupby(self.singer_col)[features].mean()
                if len(heatmap_data) == 0:
                    return self._create_empty_figure("无传承人数据")

                heatmap_data_normalized = (heatmap_data - heatmap_data.mean()) / (heatmap_data.std() + 1e-10)
                heatmap_data_normalized = heatmap_data_normalized.fillna(0)

                fig = px.imshow(heatmap_data_normalized,
                                title='传承人唱腔特征热力图 (标准化)',
                                aspect='auto',
                                color_continuous_scale='RdBu_r',
                                labels=dict(x="特征", y="传承人"))
                fig.update_layout(title_x=0.5, height=600)
                return fig
            except Exception as e:
                warnings.warn(f"Heatmap rendering error: {e}")
                return self._create_empty_figure(f"渲染出错: {str(e)}")

        @self.app.callback(
            [Output('tempo-trend-graph', 'figure'),
             Output('rhythm-comparison-graph', 'figure')],
            Input('singer-select', 'value')
        )
        def update_rhythm_graphs(selected_singers):
            if self.features_df is None or len(self.features_df) == 0:
                empty_fig = self._create_empty_figure("请先加载数据")
                return empty_fig, empty_fig

            data = self.features_df.copy()

            if selected_singers and len(selected_singers) > 0:
                data = data[data[self.singer_col].isin(selected_singers)]

            if len(data) == 0:
                empty_fig = self._create_empty_figure("无符合条件的数据")
                return empty_fig, empty_fig

            try:
                if 'tempo' in data.columns:
                    tempo_fig = px.box(data, x=self.singer_col, y='tempo', color=self.singer_col,
                                       title='不同传承人节奏分布 (Tempo)',
                                       color_discrete_sequence=px.colors.qualitative.Set2)
                    tempo_fig.update_layout(title_x=0.5, showlegend=False)
                else:
                    tempo_fig = self._create_empty_figure("缺少tempo特征")

                rhythm_features = [f for f in ['tempo', 'ibi_mean', 'rms_mean', 'zcr_mean'] if f in data.columns]
                if len(rhythm_features) > 0:
                    rhythm_melt = data.melt(id_vars=[self.singer_col], value_vars=rhythm_features,
                                            var_name='feature', value_name='value')

                    comp_fig = px.bar(rhythm_melt, x='feature', y='value', color=self.singer_col,
                                      barmode='group', title='节奏特征对比',
                                      color_discrete_sequence=px.colors.qualitative.Set2)
                    comp_fig.update_layout(title_x=0.5)
                else:
                    comp_fig = self._create_empty_figure("缺少节奏特征")

                return tempo_fig, comp_fig
            except Exception as e:
                warnings.warn(f"Rhythm graph rendering error: {e}")
                empty_fig = self._create_empty_figure(f"渲染出错: {str(e)}")
                return empty_fig, empty_fig

        @self.app.callback(
            [Output('singer-radar-chart', 'figure'),
             Output('singer-bar-chart', 'figure')],
            [Input('singer1-select', 'value'),
             Input('singer2-select', 'value')]
        )
        def update_singer_comparison(singer1, singer2):
            if self.features_df is None or len(self.features_df) == 0:
                empty_fig = self._create_empty_figure("请先加载数据")
                return empty_fig, empty_fig

            if not singer1 or not singer2:
                empty_fig = self._create_empty_figure("请选择两位传承人进行对比")
                return empty_fig, empty_fig

            try:
                radar_features = [f for f in ['pitch_mean', 'pitch_std', 'tempo', 'rms_mean',
                                                'pitch_range', 'brightness', 'harmonic_ratio']
                                  if f in self.features_df.columns]

                if len(radar_features) < 3:
                    radar_features = self.features_df.select_dtypes(include=[np.number]).columns[:6].tolist()

                singer1_data = self.features_df[self.features_df[self.singer_col] == singer1][radar_features].mean()
                singer2_data = self.features_df[self.features_df[self.singer_col] == singer2][radar_features].mean()

                all_values = np.concatenate([singer1_data.values, singer2_data.values])
                max_val = np.nanmax(all_values) if not np.all(np.isnan(all_values)) else 1
                min_val = np.nanmin(all_values) if not np.all(np.isnan(all_values)) else 0

                s1_normalized = (singer1_data.values - min_val) / (max_val - min_val + 1e-10)
                s2_normalized = (singer2_data.values - min_val) / (max_val - min_val + 1e-10)

                s1_normalized = np.nan_to_num(s1_normalized)
                s2_normalized = np.nan_to_num(s2_normalized)

                fig_radar = go.Figure()
                fig_radar.add_trace(go.Scatterpolar(r=s1_normalized, theta=radar_features,
                                                     fill='toself', name=singer1, line_color='#3498db'))
                fig_radar.add_trace(go.Scatterpolar(r=s2_normalized, theta=radar_features,
                                                     fill='toself', name=singer2, line_color='#e74c3c'))
                fig_radar.update_layout(
                    polar=dict(radialaxis=dict(visible=True, range=[0, 1])),
                    title=f'{singer1} vs {singer2} 唱腔特征雷达图 (标准化)',
                    title_x=0.5
                )

                comparison_df = pd.DataFrame({
                    'feature': radar_features,
                    singer1: singer1_data.values,
                    singer2: singer2_data.values
                })
                comparison_melt = comparison_df.melt(id_vars=['feature'], var_name='singer', value_name='value')

                fig_bar = px.bar(comparison_melt, x='feature', y='value', color='singer', barmode='group',
                                 title=f'{singer1} vs {singer2} 特征柱状对比',
                                 color_discrete_sequence=['#3498db', '#e74c3c'])
                fig_bar.update_layout(title_x=0.5)

                return fig_radar, fig_bar
            except Exception as e:
                warnings.warn(f"Singer comparison rendering error: {e}")
                empty_fig = self._create_empty_figure(f"渲染出错: {str(e)}")
                return empty_fig, empty_fig

        @self.app.callback(
            [Output('trend-line-graph', 'figure'),
             Output('style-evolution-graph', 'figure')],
            Input('trend-feature-select', 'value')
        )
        def update_trend_graphs(selected_feature):
            if self.features_df is None or len(self.features_df) == 0:
                empty_fig = self._create_empty_figure("请先加载数据")
                return empty_fig, empty_fig

            if self.year_col not in self.features_df.columns:
                empty_fig = self._create_empty_figure("缺少年份数据")
                return empty_fig, empty_fig

            if not selected_feature:
                numeric_cols = self.features_df.select_dtypes(include=[np.number]).columns
                selected_feature = numeric_cols[0] if len(numeric_cols) > 0 else None

            if selected_feature is None:
                empty_fig = self._create_empty_figure("无可用数值特征")
                return empty_fig, empty_fig

            try:
                yearly_data = self.features_df.groupby(self.year_col)[selected_feature].agg(['mean', 'std']).reset_index()
                yearly_data = yearly_data.sort_values(self.year_col)

                fig_trend = go.Figure()
                fig_trend.add_trace(go.Scatter(x=yearly_data[self.year_col], y=yearly_data['mean'],
                                               mode='lines+markers', name='均值',
                                               line=dict(color='#3498db', width=3),
                                               error_y=dict(type='data', array=yearly_data['std'], visible=True)))
                fig_trend.update_layout(title=f'{selected_feature} 随时间变化趋势', title_x=0.5,
                                        xaxis_title='年份', yaxis_title=selected_feature)

                from sklearn.decomposition import PCA
                from sklearn.preprocessing import StandardScaler

                numeric_features = self.features_df.select_dtypes(include=[np.number]).columns.tolist()
                if self.year_col in numeric_features:
                    numeric_features.remove(self.year_col)

                if len(numeric_features) >= 2:
                    yearly_means = self.features_df.groupby(self.year_col)[numeric_features].mean().reset_index()
                    yearly_means = yearly_means.sort_values(self.year_col)

                    if len(yearly_means) >= 2:
                        X_scaled = StandardScaler().fit_transform(yearly_means[numeric_features])
                        pca_result = PCA(n_components=2).fit_transform(X_scaled)

                        pca_df = pd.DataFrame(pca_result, columns=['PC1', 'PC2'])
                        pca_df['year'] = yearly_means[self.year_col].astype(str)

                        fig_evo = px.scatter(pca_df, x='PC1', y='PC2', color='year',
                                             title='唱腔风格演变轨迹 (PCA)',
                                             color_discrete_sequence=px.colors.sequential.Viridis,
                                             text='year', size_max=20)
                        fig_evo.update_traces(textposition='top center')
                        fig_evo.update_layout(title_x=0.5)
                    else:
                        fig_evo = self._create_empty_figure("年份数据不足")
                else:
                    fig_evo = self._create_empty_figure("特征数量不足")

                return fig_trend, fig_evo
            except Exception as e:
                warnings.warn(f"Trend graph rendering error: {e}")
                empty_fig = self._create_empty_figure(f"渲染出错: {str(e)}")
                return empty_fig, empty_fig

        @self.app.callback(
            [Output('waveform-plot', 'figure'),
             Output('spectrogram-plot', 'figure'),
             Output('audio-upload-status', 'children')],
            Input('upload-audio', 'contents'),
            State('upload-audio', 'filename')
        )
        def update_audio_plots(contents, filename):
            if contents is None:
                empty_fig = self._create_empty_figure("请上传音频文件")
                return empty_fig, empty_fig, ""

            try:
                import base64
                content_type, content_string = contents.split(',')
                decoded = base64.b64decode(content_string)

                import io
                import tempfile

                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1])
                temp_file.write(decoded)
                temp_file.close()

                from src.data_access.audio_loader import AudioLoader
                audio_loader = AudioLoader()

                is_valid, validate_msg = audio_loader.validate_audio_file(temp_file.name)
                if not is_valid:
                    os.unlink(temp_file.name)
                    error_fig = self._create_empty_figure(f"音频验证失败: {validate_msg}")
                    status = html.Div([
                        html.Span(f"✗ 验证失败: {validate_msg}", style={'color': '#e74c3c', 'fontWeight': 'bold'})
                    ])
                    return error_fig, error_fig, status

                audio_info = audio_loader.get_audio_info(temp_file.name)

                max_duration = 600
                if audio_info['duration'] > max_duration:
                    os.unlink(temp_file.name)
                    error_fig = self._create_empty_figure(
                        f"音频过长: {audio_info['duration']:.1f}秒，建议不超过{max_duration}秒"
                    )
                    status = html.Div([
                        html.Span(f"✗ 音频过长", style={'color': '#e74c3c', 'fontWeight': 'bold'})
                    ])
                    return error_fig, error_fig, status

                y, sr = audio_loader.load_audio(temp_file.name)
                os.unlink(temp_file.name)

                duration = len(y) / sr

                max_display_samples = 5 * 60 * sr
                if len(y) > max_display_samples:
                    y_display = y[:max_display_samples]
                    display_note = " (显示前5分钟)"
                else:
                    y_display = y
                    display_note = ""

                if self.enable_optimizations:
                    y_display = RenderOptimizer.downsample_1d(y_display)

                time_axis = np.arange(len(y_display)) / sr
                fig_wave = go.Figure()
                fig_wave.add_trace(go.Scattergl(x=time_axis, y=y_display, mode='lines', name='波形',
                                               line=dict(color='#3498db', width=1)))
                fig_wave.update_layout(title=f'音频波形: {filename}{display_note} (时长: {duration:.1f}秒)', title_x=0.5,
                                       xaxis_title='时间 (秒)', yaxis_title='振幅')
                if self.enable_optimizations:
                    fig_wave = RenderOptimizer.optimize_figure(fig_wave)

                spec_duration = min(len(y), 10 * sr)
                y_spec = y[:spec_duration]

                D = librosa.amplitude_to_db(np.abs(librosa.stft(y_spec, n_fft=1024)), ref=np.max)
                
                if self.enable_optimizations:
                    D = RenderOptimizer.downsample_2d(D, max_cols=500)

                times = librosa.times_like(D, sr=sr)
                freqs = librosa.fft_frequencies(sr=sr)

                fig_spec = go.Figure(data=go.Heatmap(z=D, x=times, y=freqs, colorscale='Viridis'))
                fig_spec.update_layout(title=f'频谱图: {filename} (显示前10秒)', title_x=0.5,
                                       xaxis_title='时间 (秒)', yaxis_title='频率 (Hz)')
                if self.enable_optimizations:
                    fig_spec = RenderOptimizer.optimize_figure(fig_spec)

                status = html.Div([
                    html.Span(f"✓ 文件已加载: {filename}", style={'color': '#27ae60', 'fontWeight': 'bold'}),
                    html.Br(),
                    html.Small(f"采样率: {sr} Hz, 时长: {duration:.1f}秒", style={'color': '#7f8c8d'})
                ])

                del y, y_display, y_spec
                gc.collect()

                return fig_wave, fig_spec, status

            except Exception as e:
                warnings.warn(f"Audio processing error: {e}")
                error_fig = self._create_empty_figure(f"音频处理失败")
                status = html.Div([
                    html.Span(f"✗ 处理失败", style={'color': '#e74c3c', 'fontWeight': 'bold'}),
                    html.Br(),
                    html.Small(str(e), style={'color': '#7f8c8d'})
                ])
                return error_fig, error_fig, status

        @self.app.callback(
            Output('pca-scatter-2d', 'figure'),
            Input('pca-color-by', 'value')
        )
        def update_pca_scatter(color_by):
            if self.features_df is None or len(self.features_df) == 0:
                return self._create_empty_figure("请先加载数据")

            try:
                from sklearn.decomposition import PCA
                from sklearn.preprocessing import StandardScaler

                numeric_features = self.features_df.select_dtypes(include=[np.number]).columns.tolist()
                if len(numeric_features) < 2:
                    return self._create_empty_figure("数值特征数量不足")

                color_col = self.singer_col if color_by == 'singer' else self.opera_type_col
                if color_col not in self.features_df.columns:
                    return self._create_empty_figure(f"缺少列: {color_col}")

                df_clean = self.features_df.dropna(subset=numeric_features + [color_col])
                if len(df_clean) < 2:
                    return self._create_empty_figure("有效样本数量不足")

                X_scaled = StandardScaler().fit_transform(df_clean[numeric_features])
                pca_result = PCA(n_components=2).fit_transform(X_scaled)

                pca_df = pd.DataFrame(pca_result, columns=['PC1', 'PC2'])
                pca_df[color_col] = df_clean[color_col].values

                fig = px.scatter(pca_df, x='PC1', y='PC2', color=color_col,
                                 title=f'唱腔特征PCA分布 (按{color_col})',
                                 color_discrete_sequence=px.colors.qualitative.Set2,
                                 hover_data={color_col: True})
                fig.update_layout(title_x=0.5)

                return fig
            except Exception as e:
                warnings.warn(f"PCA rendering error: {e}")
                return self._create_empty_figure(f"渲染出错: {str(e)}")

    def _create_empty_stats(self):
        return html.Div([
            html.P("请先加载数据...", style={'color': '#95a5a6', 'fontSize': '16px', 'textAlign': 'center'})
        ])

    def _create_overview_stats(self):
        if self.features_df is None or len(self.features_df) == 0:
            return self._create_empty_stats()

        num_samples = len(self.features_df)
        num_singers = self.features_df[self.singer_col].nunique()
        num_opera_types = self.features_df[self.opera_type_col].nunique()
        num_features = len(self.features_df.select_dtypes(include=[np.number]).columns)

        return html.Div([
            html.Div([
                html.H4(f"{num_samples}", style={'fontSize': '36px', 'color': '#3498db'}),
                html.P("音频样本数", style={'fontSize': '14px', 'color': '#7f8c8d'})
            ], style={'display': 'inline-block', 'width': '200px', 'textAlign': 'center', 'margin': '20px',
                      'padding': '20px', 'backgroundColor': 'white', 'borderRadius': '10px', 'boxShadow': '0 2px 10px rgba(0,0,0,0.1)'}),
            html.Div([
                html.H4(f"{num_singers}", style={'fontSize': '36px', 'color': '#e74c3c'}),
                html.P("传承人数量", style={'fontSize': '14px', 'color': '#7f8c8d'})
            ], style={'display': 'inline-block', 'width': '200px', 'textAlign': 'center', 'margin': '20px',
                      'padding': '20px', 'backgroundColor': 'white', 'borderRadius': '10px', 'boxShadow': '0 2px 10px rgba(0,0,0,0.1)'}),
            html.Div([
                html.H4(f"{num_opera_types}", style={'fontSize': '36px', 'color': '#27ae60'}),
                html.P("戏曲类型", style={'fontSize': '14px', 'color': '#7f8c8d'})
            ], style={'display': 'inline-block', 'width': '200px', 'textAlign': 'center', 'margin': '20px',
                      'padding': '20px', 'backgroundColor': 'white', 'borderRadius': '10px', 'boxShadow': '0 2px 10px rgba(0,0,0,0.1)'}),
            html.Div([
                html.H4(f"{num_features}", style={'fontSize': '36px', 'color': '#f39c12'}),
                html.P("特征数量", style={'fontSize': '14px', 'color': '#7f8c8d'})
            ], style={'display': 'inline-block', 'width': '200px', 'textAlign': 'center', 'margin': '20px',
                      'padding': '20px', 'backgroundColor': 'white', 'borderRadius': '10px', 'boxShadow': '0 2px 10px rgba(0,0,0,0.1)'})
        ], style={'textAlign': 'center'})

    def _get_feature_group(self, group: str) -> list:
        if self.features_df is None:
            return []

        all_columns = self.features_df.columns.tolist()
        if group == 'pitch':
            return [c for c in all_columns if 'pitch' in c.lower() or 'f0' in c.lower()]
        elif group == 'rhythm':
            return [c for c in all_columns if any(x in c.lower() for x in ['tempo', 'rms', 'ibi', 'beat', 'zcr'])]
        elif group == 'timbre':
            return [c for c in all_columns if any(x in c.lower() for x in ['mfcc', 'chroma', 'contrast', 'brightness'])]
        else:
            numeric_cols = self.features_df.select_dtypes(include=[np.number]).columns.tolist()
            return numeric_cols[:min(30, len(numeric_cols))]

    def _create_radar_chart(self, scores: Dict, title: str):
        dimensions = list(scores.keys())
        values = list(scores.values())

        fig = go.Figure()
        fig.add_trace(go.Scatterpolar(
            r=values,
            theta=[d.replace('_', ' ').title() for d in dimensions],
            fill='toself',
            name='评分'
        ))
        fig.update_layout(
            polar=dict(
                radialaxis=dict(
                    visible=True,
                    range=[0, 100]
                )
            ),
            title=title,
            showlegend=True
        )
        return fig

    def _create_bar_chart(self, scores: Dict, title: str):
        dimensions = list(scores.keys())
        values = list(scores.values())

        colors = ['#2ecc71' if v >= 80 else '#f39c12' if v >= 60 else '#e74c3c' for v in values]

        fig = go.Figure(data=[
            go.Bar(
                x=[d.replace('_', ' ').title() for d in dimensions],
                y=values,
                marker_color=colors
            )
        ])
        fig.update_layout(
            title=title,
            yaxis_range=[0, 100],
            showlegend=False
        )
        return fig

    def run_server(self, host: str = '127.0.0.1', port: int = 8050):
        print(f"\n{'='*60}")
        print(f"仪表板启动: http://{host}:{port}")
        print(f"{'='*60}\n")
        self.app.run_server(debug=self.debug, host=host, port=port)


class QualityDashboard:
    def __init__(self, db_session, debug: bool = True):
        self.db = db_session
        self.app = dash.Dash(__name__)
        self.debug = debug
        self._setup_layout()
        self._setup_callbacks()

    def _setup_layout(self):
        rating_dimensions = [
            'pitch_accuracy', 'rhythm_accuracy', 'vocal_quality',
            'emotional_expression', 'technique', 'style_authenticity'
        ]

        self.app.layout = html.Div([
            html.H1("唱腔质量评价与标注系统", style={'textAlign': 'center', 'padding': '20px'}),

            dcc.Tabs([
                dcc.Tab(label='评分概览', children=[
                    html.Div([
                        html.H3("评分统计概览", style={'padding': '15px'}),
                        dcc.Dropdown(id='overview-opera-type', placeholder='选择戏曲类型'),
                        dcc.Graph(id='rating-distribution'),
                        dcc.Graph(id='top-rated-audios')
                    ])
                ]),

                dcc.Tab(label='音频评分', children=[
                    html.Div([
                        html.H3("多维度评分", style={'padding': '15px'}),
                        dcc.Dropdown(id='audio-select-rating', placeholder='选择音频'),
                        html.Div([
                            html.H4("手动评分", style={'marginTop': '20px'}),
                            html.Div([
                                html.Div([
                                    html.Label(dim.replace('_', ' ').title()),
                                    dcc.Slider(
                                        id=f'rating-{dim}',
                                        min=0, max=100, value=50,
                                        marks={0: '0', 25: '25', 50: '50', 75: '75', 100: '100'}
                                    )
                                ], style={'padding': '10px', 'width': '48%', 'display': 'inline-block'})
                                for dim in rating_dimensions
                            ]),
                            html.Textarea(id='rating-comment', placeholder='添加评论...',
                                          style={'width': '100%', 'height': '100px', 'marginTop': '20px'}),
                            html.Button('提交评分', id='submit-rating', n_clicks=0,
                                        style={'marginTop': '10px', 'padding': '10px 20px'}),
                            html.Div(id='rating-result', style={'marginTop': '10px'})
                        ]),
                        html.Div([
                            html.H4("评分可视化", style={'marginTop': '30px'}),
                            dcc.Graph(id='rating-radar-chart'),
                            dcc.Graph(id='rating-bar-chart')
                        ])
                    ])
                ]),

                dcc.Tab(label='标注系统', children=[
                    html.Div([
                        html.H3("音频标注", style={'padding': '15px'}),
                        dcc.Dropdown(id='audio-select-annotation', placeholder='选择音频'),
                        html.Div([
                            html.Label('标注类型'),
                            dcc.Dropdown(id='annotation-type',
                                         options=[
                                             {'label': '技巧标注', 'value': 'technique'},
                                             {'label': '情感标注', 'value': 'emotion'},
                                             {'label': '流派特征', 'value': 'style'},
                                             {'label': '问题标注', 'value': 'issue'},
                                             {'label': '其他', 'value': 'other'}
                                         ],
                                         placeholder='选择标注类型')
                        ], style={'padding': '10px'}),
                        html.Div([
                            html.Label('时间范围 (秒)'),
                            html.Div([
                                dcc.Input(id='start-time', type='number', placeholder='开始时间', step=0.1,
                                          style={'width': '45%', 'display': 'inline-block', 'marginRight': '5%'}),
                                dcc.Input(id='end-time', type='number', placeholder='结束时间', step=0.1,
                                          style={'width': '45%', 'display': 'inline-block'})
                            ])
                        ], style={'padding': '10px'}),
                        html.Div([
                            html.Label('标注内容'),
                            dcc.Textarea(id='annotation-content', style={'width': '100%', 'height': '100px'})
                        ], style={'padding': '10px'}),
                        html.Div([
                            html.Label('标签 (逗号分隔)'),
                            dcc.Input(id='annotation-tags', type='text', style={'width': '100%'})
                        ], style={'padding': '10px'}),
                        html.Button('提交标注', id='submit-annotation', n_clicks=0,
                                    style={'margin': '10px', 'padding': '10px 20px'}),
                        html.Div(id='annotation-result', style={'marginTop': '10px'}),
                        html.Div([
                            html.H4("现有标注", style={'marginTop': '30px'}),
                            html.Div(id='existing-annotations')
                        ])
                    ])
                ]),

                dcc.Tab(label='演变分析', children=[
                    html.Div([
                        html.H3("唱腔风格演变分析", style={'padding': '15px'}),
                        dcc.Dropdown(id='heritor-select-evolution', placeholder='选择传承人'),
                        dcc.Graph(id='evolution-timeline'),
                        dcc.Graph(id='feature-evolution-trend'),
                        html.Div(id='evolution-insights', style={'padding': '20px', 'backgroundColor': '#f8f9fa'})
                    ])
                ]),

                dcc.Tab(label='传承人关联', children=[
                    html.Div([
                        html.H3("传承人数据关联", style={'padding': '15px'}),
                        dcc.Dropdown(id='unassigned-audio-select', placeholder='选择未关联音频'),
                        html.Button('自动匹配', id='auto-match-btn', n_clicks=0,
                                    style={'margin': '10px', 'padding': '10px 20px'}),
                        html.Div(id='match-suggestions', style={'padding': '10px'}),
                        html.Div([
                            html.H4("匹配结果", style={'marginTop': '20px'}),
                            dcc.Graph(id='match-confidence-chart')
                        ])
                    ])
                ])
            ])
        ], style={'fontFamily': 'Arial, sans-serif', 'backgroundColor': '#f5f6fa'})

    def _setup_callbacks(self):
        rating_dimensions = [
            'pitch_accuracy', 'rhythm_accuracy', 'vocal_quality',
            'emotional_expression', 'technique', 'style_authenticity'
        ]

        @self.app.callback(
            [Output('rating-radar-chart', 'figure'),
             Output('rating-bar-chart', 'figure')],
            [Input(f'rating-{dim}', 'value') for dim in rating_dimensions]
        )
        def update_rating_visualizations(*values):
            scores = dict(zip(rating_dimensions, values))

            radar_fig = go.Figure()
            radar_fig.add_trace(go.Scatterpolar(
                r=list(values),
                theta=[d.replace('_', ' ').title() for d in rating_dimensions],
                fill='toself',
                name='当前评分',
                line_color='#3498db'
            ))
            radar_fig.update_layout(
                polar=dict(radialaxis=dict(visible=True, range=[0, 100])),
                title='评分雷达图',
                showlegend=True
            )

            colors = ['#2ecc71' if v >= 80 else '#f39c12' if v >= 60 else '#e74c3c' for v in values]
            bar_fig = go.Figure(data=[
                go.Bar(
                    x=[d.replace('_', ' ').title() for d in rating_dimensions],
                    y=list(values),
                    marker_color=colors
                )
            ])
            bar_fig.update_layout(
                title='各维度评分柱状图',
                yaxis_range=[0, 100],
                showlegend=False
            )

            return radar_fig, bar_fig

        @self.app.callback(
            Output('rating-result', 'children'),
            Input('submit-rating', 'n_clicks'),
            [State('audio-select-rating', 'value')] +
            [State(f'rating-{dim}', 'value') for dim in rating_dimensions] +
            [State('rating-comment', 'value')]
        )
        def submit_rating(n_clicks, audio_id, *args):
            if n_clicks == 0 or not audio_id:
                return ''

            scores = args[:6]
            comment = args[6]

            score_dict = dict(zip(rating_dimensions, scores))

            from src.analysis.quality_evaluator import UserAnnotationManager
            manager = UserAnnotationManager(self.db)

            result = manager.add_rating(
                audio_id=audio_id,
                user_id=1,
                pitch_accuracy=score_dict.get('pitch_accuracy'),
                rhythm_accuracy=score_dict.get('rhythm_accuracy'),
                vocal_quality=score_dict.get('vocal_quality'),
                emotional_expression=score_dict.get('emotional_expression'),
                technique=score_dict.get('technique'),
                style_authenticity=score_dict.get('style_authenticity'),
                comment=comment
            )

            overall = result.get('overall_score', 0)
            grade = 'S' if overall >= 90 else 'A' if overall >= 80 else 'B' if overall >= 70 else 'C' if overall >= 60 else 'D'

            return html.Div([
                html.H4(f"✓ 评分提交成功", style={'color': '#27ae60'}),
                html.P(f"综合评分: {overall:.1f} ({grade})"),
                html.P(f"评分ID: {result.get('rating_id')}")
            ])

        @self.app.callback(
            Output('annotation-result', 'children'),
            Input('submit-annotation', 'n_clicks'),
            [State('audio-select-annotation', 'value'),
             State('annotation-type', 'value'),
             State('start-time', 'value'),
             State('end-time', 'value'),
             State('annotation-content', 'value'),
             State('annotation-tags', 'value')]
        )
        def submit_annotation(n_clicks, audio_id, ann_type, start, end, content, tags):
            if n_clicks == 0 or not audio_id or not ann_type:
                return ''

            tag_list = [t.strip() for t in tags.split(',')] if tags else []

            from src.analysis.quality_evaluator import UserAnnotationManager
            manager = UserAnnotationManager(self.db)

            result = manager.add_annotation(
                audio_id=audio_id,
                user_id=1,
                annotation_type=ann_type,
                start_time=start,
                end_time=end,
                content=content or '',
                tags=tag_list
            )

            return html.Div([
                html.H4("✓ 标注提交成功", style={'color': '#27ae60'}),
                html.P(f"标注ID: {result.get('annotation_id')}"),
                html.P(f"类型: {result.get('annotation_type')}")
            ])

        @self.app.callback(
            [Output('overview-opera-type', 'options'),
             Output('audio-select-rating', 'options'),
             Output('audio-select-annotation', 'options'),
             Output('unassigned-audio-select', 'options')],
            Input('audio-select-rating', 'value')
        )
        def update_dropdowns(_):
            from src.database.models import AudioData, OperaGenre

            audios = self.db.query(AudioData).all()
            audio_options = [
                {'label': f"{a.filename} ({a.opera_type or '未知'})", 'value': a.id}
                for a in audios
            ]

            genres = self.db.query(OperaGenre).all()
            genre_options = [{'label': g.name_cn, 'value': g.name_cn} for g in genres]

            return genre_options, audio_options, audio_options, audio_options

    def run_server(self, host: str = '127.0.0.1', port: int = 8051):
        print(f"\n{'='*60}")
        print(f"唱腔质量评价仪表板启动: http://{host}:{port}")
        print(f"{'='*60}\n")
        self.app.run_server(debug=self.debug, host=host, port=port)
