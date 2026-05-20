import dash
from dash import dcc, html, Input, Output, State, callback
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import sys
import os
import logging
import traceback
import time
import gc

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config
from data_access.data_loader import DataManager
from analysis.material_analyzer import AnalysisManager, EnhancedAnalysisManager
from core import (
    MemoryOptimizer,
    get_cache,
    get_monitor,
    profile_time,
    DASK_AVAILABLE
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VisualizationDataValidator:
    @staticmethod
    def validate_dataframe(df, required_columns=None, min_rows=1):
        if df is None or df.empty:
            return False, "数据为空"
        
        if len(df) < min_rows:
            return False, f"数据量不足，需要至少{min_rows}行"
        
        if required_columns:
            missing = [col for col in required_columns if col not in df.columns]
            if missing:
                return False, f"缺少必要列: {', '.join(missing)}"
        
        return True, "数据验证通过"
    
    @staticmethod
    def clean_numeric_data(series):
        series = pd.to_numeric(series, errors='coerce')
        cleaned = series.replace([np.inf, -np.inf], np.nan).dropna()
        if len(cleaned) > 0:
            median_val = cleaned.median()
            return series.fillna(median_val)
        return series
    
    @staticmethod
    def sample_large_data(df, max_rows=10000, method='stratified'):
        if len(df) <= max_rows:
            return df
        
        logger.info(f"数据量过大({len(df)}行)，采样至{max_rows}行进行可视化")
        
        if method == 'stratified' and 'material_type' in df.columns:
            try:
                sampled = df.groupby('material_type', group_keys=False).apply(
                    lambda x: x.sample(min(len(x), max_rows // len(df['material_type'].unique())),
                                       random_state=42)
                )
                if len(sampled) > max_rows:
                    sampled = sampled.sample(n=max_rows, random_state=42)
                return sampled
            except:
                pass
        
        return df.sample(n=max_rows, random_state=42)
    
    @staticmethod
    def optimize_for_visualization(df, sample_size=10000):
        valid, msg = VisualizationDataValidator.validate_dataframe(df)
        if not valid:
            logger.warning(f"数据验证警告: {msg}")
            return df
        
        df_sampled = VisualizationDataValidator.sample_large_data(df, max_rows=sample_size)
        
        df_optimized = MemoryOptimizer.optimize_dataframe(df_sampled, verbose=False)
        
        gc.collect()
        
        return df_optimized
    
    @staticmethod
    def aggregate_for_heatmap(df, x_col, y_col, value_col=None, agg_func='mean'):
        if value_col is None:
            agg_df = df.groupby([x_col, y_col]).size().reset_index(name='count')
        else:
            agg_df = df.groupby([x_col, y_col])[value_col].agg(agg_func).reset_index()
        
        pivot_df = agg_df.pivot(index=y_col, columns=x_col, values=value_col or 'count')
        pivot_df = pivot_df.fillna(0)
        
        return pivot_df
    
    @staticmethod
    def downsample_time_series(df, time_col, value_cols, max_points=1000):
        if len(df) <= max_points:
            return df
        
        df_sorted = df.sort_values(time_col)
        stride = max(1, len(df_sorted) // max_points)
        
        return df_sorted.iloc[::stride]

class ShadowPuppetDashboard:
    def __init__(self, enable_performance_monitor=True):
        self.data_manager = DataManager()
        self.analysis_manager = EnhancedAnalysisManager(enable_cache=True)
        self.theme = Config.VISUALIZATION_THEME
        self.validator = VisualizationDataValidator()
        self.cache = get_cache()
        self.monitor = get_monitor() if enable_performance_monitor else None
        
        self._cached_material_data = None
        self._cached_pigment_data = None
        self._cached_analysis_results = None
        self._cache_timestamp = None
        self._render_stats = {'total_renders': 0, 'total_render_time': 0}
        
        self.max_scatter_points = Config.MAX_SCATTER_POINTS if hasattr(Config, 'MAX_SCATTER_POINTS') else 5000
        self.max_heatmap_cells = Config.MAX_HEATMAP_CELLS if hasattr(Config, 'MAX_HEATMAP_CELLS') else 1000
        
        self.app = dash.Dash(__name__, title='传统皮影戏材质分析系统', suppress_callback_exceptions=True)
        self._setup_layout()
        self._setup_callbacks()
    
    def _get_cached_data(self, use_visual_optimization=True):
        if self._cached_material_data is None or self._cached_pigment_data is None:
            self._cached_material_data = self.data_manager.load_from_museum()
            self._cached_pigment_data = self.data_manager.get_pigment_data()
            self._cache_timestamp = time.time()
        
        if use_visual_optimization:
            material_opt = self.validator.optimize_for_visualization(self._cached_material_data, 
                                                               self.max_scatter_points)
            pigment_opt = self.validator.optimize_for_visualization(self._cached_pigment_data,
                                                                   self.max_scatter_points)
            return material_opt, pigment_opt
        
        return self._cached_material_data, self._cached_pigment_data
    
    def _timed_render(self, render_func, *args, **kwargs):
        start_time = time.time()
        result = render_func(*args, **kwargs)
        render_time = time.time() - start_time
        self._render_stats['total_renders'] += 1
        self._render_stats['total_render_time'] += render_time
        
        if self.monitor:
            self.monitor.start_timer(f'render_{render_func.__name__}')
        
        logger.debug(f"图表渲染耗时: {render_time:.3f}s")
        return result
    
    def _create_optimized_scatter(self, df, x_col, y_col, color_col=None, **kwargs):
        df_sampled = self.validator.sample_large_data(df, self.max_scatter_points)
        
        hover_data = kwargs.pop('hover_data', None)
        
        fig = go.Figure()
        
        if color_col and color_col in df_sampled.columns:
            for color_val in df_sampled[color_col].unique():
                subset = df_sampled[df_sampled[color_col] == color_val]
                hover_text = self._create_hover_text(subset, hover_data)
                fig.add_trace(go.Scattergl(
                    x=subset[x_col],
                    y=subset[y_col],
                    mode='markers',
                    name=str(color_val),
                    text=hover_text,
                    marker=dict(size=6, opacity=0.7, line=dict(width=0.5)),
                    hoverinfo='text'
                ))
        else:
            hover_text = self._create_hover_text(df_sampled, hover_data)
            fig.add_trace(go.Scattergl(
                x=df_sampled[x_col],
                y=df_sampled[y_col],
                mode='markers',
                text=hover_text,
                marker=dict(size=6, opacity=0.7, line=dict(width=0.5),
                            color='#e94560'),
                hoverinfo='text'
            ))
        
        return fig
    
    def _create_hover_text(self, df, hover_data=None):
        if hover_data is None:
            return None
        
        text_list = []
        for _, row in df.iterrows():
            text_parts = []
            for col in hover_data:
                if col in df.columns:
                    text_parts.append(f"{col}: {row[col]}")
            text_list.append('<br>'.join(text_parts))
        return text_list
    
    def _setup_layout(self):
        self.app.layout = html.Div([
            dcc.Store(id='data-cache'),
            dcc.Store(id='analysis-cache'),
            html.Div([
                html.H1('🎭 传统皮影戏材质分析系统', 
                        style={'color': '#e94560', 'marginBottom': 0}),
                html.P('专注于冷门传统皮影戏材质研究', 
                       style={'color': '#888', 'marginTop': 5})
            ], style={'textAlign': 'center', 'padding': '20px', 'backgroundColor': '#1a1a2e'}),
            
            dcc.Tabs([
                dcc.Tab(label='数据概览', children=self._get_overview_tab()),
                dcc.Tab(label='材质热力图', children=self._get_heatmap_tab()),
                dcc.Tab(label='老化预测', children=self._get_aging_prediction_tab()),
                dcc.Tab(label='相似度检索', children=self._get_similarity_tab()),
                dcc.Tab(label='颜料褪色', children=self._get_pigment_tab()),
                dcc.Tab(label='结果导出', children=self._get_export_tab()),
            ], colors={
                'border': '#1a1a2e',
                'primary': '#e94560',
                'background': '#16213e'
            })
        ], style={'backgroundColor': '#0f0f23', 'minHeight': '100vh'})
    
    def _get_aging_prediction_tab(self):
        return html.Div([
            html.Div([
                html.H3('🎯 材质老化预测', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Button('运行老化预测分析', id='run-aging-prediction', 
                               style={'backgroundColor': '#e94560', 'color': 'white', 
                                      'padding': '10px 20px', 'borderRadius': '5px',
                                      'border': 'none', 'cursor': 'pointer', 'margin': '10px'})
                ], style={'textAlign': 'center'})
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div(id='aging-prediction-results', style={'margin': '20px'}),
            
            html.Div([
                html.H3('老化轨迹预测', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Dropdown(
                    id='aging-material-selector',
                    placeholder='选择材质查看详细老化轨迹...',
                    style={'width': '50%', 'margin': '0 20px', 'color': '#000'}
                ),
                dcc.Graph(id='aging-trajectory-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('风险评估与维护建议', style={'color': '#e94560', 'padding': '20px'}),
                html.Div(id='risk-assessment-results')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_similarity_tab(self):
        return html.Div([
            html.Div([
                html.H3('🔍 材质相似度检索', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Label('选择查询样本索引:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Input(id='query-index', type='number', value=0, min=0, 
                             style={'marginRight': '20px', 'padding': '5px'}),
                    html.Label('返回结果数量:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Input(id='top-k', type='number', value=5, min=1, max=20,
                             style={'marginRight': '20px', 'padding': '5px'}),
                    html.Label('相似度算法:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Dropdown(
                        id='similarity-method',
                        options=[
                            {'label': '余弦相似度', 'value': 'cosine'},
                            {'label': '欧氏距离', 'value': 'euclidean'}
                        ],
                        value='cosine',
                        style={'width': '150px', 'display': 'inline-block', 'color': '#000'}
                    ),
                    html.Button('检索相似材质', id='run-similarity-search', 
                               style={'backgroundColor': '#e94560', 'color': 'white', 
                                      'padding': '8px 15px', 'borderRadius': '5px',
                                      'border': 'none', 'cursor': 'pointer', 'marginLeft': '20px'})
                ], style={'padding': '20px'})
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('检索结果', style={'color': '#e94560', 'padding': '20px'}),
                html.Div(id='similarity-results')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('相似度可视化', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Graph(id='similarity-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_export_tab(self):
        return html.Div([
            html.Div([
                html.H3('📤 分析结果导出', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Label('导出格式:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Dropdown(
                        id='export-format',
                        options=[
                            {'label': '所有格式', 'value': 'all'},
                            {'label': 'CSV', 'value': 'csv'},
                            {'label': 'Excel (xlsx)', 'value': 'xlsx'},
                            {'label': 'JSON', 'value': 'json'}
                        ],
                        value='all',
                        style={'width': '200px', 'display': 'inline-block', 'color': '#000'}
                    ),
                    html.Br(), html.Br(),
                    html.Label('导出文件名前缀:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Input(id='export-prefix', type='text', value='shadow_puppet_analysis',
                             style={'width': '300px', 'padding': '5px'}),
                    html.Br(), html.Br(),
                    html.Button('导出分析结果', id='run-export', 
                               style={'backgroundColor': '#e94560', 'color': 'white', 
                                      'padding': '10px 20px', 'borderRadius': '5px',
                                      'border': 'none', 'cursor': 'pointer'})
                ], style={'padding': '20px'})
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('导出状态', style={'color': '#e94560', 'padding': '20px'}),
                html.Div(id='export-results')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('性能统计', style={'color': '#e94560', 'padding': '20px'}),
                html.Div(id='performance-stats')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_overview_tab(self):
        return html.Div([
            html.Div([
                html.H3('材质数据统计概览', style={'color': '#e94560', 'padding': '20px'}),
                html.Div(id='overview-stats', style={'padding': '0 20px'})
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('材质类型分布', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Graph(id='material-distribution-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('材质特性雷达图', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Dropdown(
                    id='material-selector',
                    placeholder='选择材质类型...',
                    style={'width': '50%', 'margin': '0 20px', 'color': '#000'}
                ),
                dcc.Graph(id='radar-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_heatmap_tab(self):
        return html.Div([
            html.Div([
                html.H3('材质成分热力图', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Label('选择分析指标:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Dropdown(
                        id='heatmap-metric',
                        options=[
                            {'label': '厚度', 'value': 'thickness'},
                            {'label': '抗张强度', 'value': 'tensile_strength'},
                            {'label': '含水量', 'value': 'water_content'},
                            {'label': '胶原蛋白比例', 'value': 'collagen_ratio'}
                        ],
                        value='thickness',
                        style={'width': '300px', 'color': '#000'}
                    )
                ], style={'padding': '0 20px', 'marginBottom': '20px'}),
                dcc.Graph(id='heatmap-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('材质相关性矩阵', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Graph(id='correlation-matrix')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_aging_tab(self):
        return html.Div([
            html.Div([
                html.H3('老化趋势预测', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Label('预测年数:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Slider(
                        id='aging-years-slider',
                        min=10,
                        max=100,
                        step=10,
                        value=50,
                        marks={i: f'{i}年' for i in range(10, 101, 10)}
                    )
                ], style={'padding': '0 40px', 'marginBottom': '20px'}),
                dcc.Graph(id='aging-trend-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('材质老化特征重要性', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Graph(id='feature-importance-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_pigment_tab(self):
        return html.Div([
            html.Div([
                html.H3('颜料褪色对比图', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Graph(id='pigment-fade-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('颜色空间分布图', style={'color': '#e94560', 'padding': '20px'}),
                dcc.Graph(id='color-space-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('褪色模拟', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Label('模拟小时数:', style={'color': '#fff', 'marginRight': '10px'}),
                    dcc.Input(
                        id='fade-hours-input',
                        type='number',
                        value=1000,
                        min=100,
                        max=5000,
                        style={'width': '100px'}
                    ),
                    html.Button('开始模拟', id='simulate-btn', n_clicks=0,
                               style={'marginLeft': '20px', 'backgroundColor': '#e94560', 'color': 'white'})
                ], style={'padding': '0 20px', 'marginBottom': '20px'}),
                dcc.Graph(id='fade-simulation-chart')
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _get_data_tab(self):
        return html.Div([
            html.Div([
                html.H3('数据源管理', style={'color': '#e94560', 'padding': '20px'}),
                html.Div([
                    html.Button('从博物馆API加载数据', id='load-api-btn', n_clicks=0,
                               style={'backgroundColor': '#e94560', 'color': 'white', 'padding': '10px 20px',
                                      'marginRight': '20px'}),
                    dcc.Upload(
                        id='upload-data',
                        children=html.Button('上传本地文件',
                                            style={'backgroundColor': '#4a90d9', 'color': 'white',
                                                   'padding': '10px 20px'}),
                        multiple=False
                    )
                ], style={'padding': '0 20px', 'marginBottom': '20px'}),
                html.Div(id='data-load-status', style={'padding': '0 20px', 'color': '#4ade80'})
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'}),
            
            html.Div([
                html.H3('材质数据表格', style={'color': '#e94560', 'padding': '20px'}),
                html.Div(id='material-data-table', style={'padding': '0 20px', 'overflowX': 'auto'})
            ], style={'backgroundColor': '#16213e', 'margin': '20px', 'borderRadius': '10px'})
        ])
    
    def _safe_create_figure(self, figure_func, *args, **kwargs):
        try:
            return figure_func(*args, **kwargs)
        except Exception as e:
            logger.error(f"创建图表失败: {str(e)}")
            logger.error(traceback.format_exc())
            return self._create_error_figure(str(e))
    
    def _create_error_figure(self, error_msg):
        fig = go.Figure()
        fig.add_annotation(
            text=f"图表加载失败<br>{error_msg}",
            xref="paper", yref="paper",
            x=0.5, y=0.5,
            showarrow=False,
            font=dict(size=16, color="#e94560")
        )
        fig.update_layout(
            paper_bgcolor='#16213e',
            plot_bgcolor='#16213e',
            font_color='white'
        )
        return fig
    
    def _create_stats_cards(self, df):
        valid, msg = self.validator.validate_dataframe(df)
        if not valid:
            return html.Div(f"数据统计失败: {msg}", style={'color': '#e94560'})
        
        cards = []
        stats_data = [
            ('样本总数', str(len(df))),
            ('材质类型', str(df['material_type'].nunique()) if 'material_type' in df.columns else 'N/A'),
            ('平均厚度 (mm)', f"{df['thickness'].mean():.2f}" if 'thickness' in df.columns else 'N/A'),
            ('平均抗张强度', f"{df['tensile_strength'].mean():.2f}" if 'tensile_strength' in df.columns else 'N/A')
        ]
        
        for label, value in stats_data:
            cards.append(html.Div([
                html.H4(label, style={'color': '#888', 'margin': 0}),
                html.H2(str(value), style={'color': '#e94560', 'margin': '10px 0'})
            ], style={
                'display': 'inline-block',
                'width': '200px',
                'padding': '20px',
                'margin': '10px',
                'backgroundColor': '#1a1a2e',
                'borderRadius': '10px',
                'textAlign': 'center'
            }))
        
        return cards
    
    def _create_distribution_chart(self, df):
        valid, msg = self.validator.validate_dataframe(df, ['material_type'])
        if not valid:
            return self._create_error_figure(msg)
        
        counts = df['material_type'].value_counts()
        
        fig = go.Figure(data=[go.Pie(
            labels=counts.index,
            values=counts.values,
            hole=0.3,
            marker=dict(colors=['#e94560', '#4a90d9', '#4ade80', '#f59e0b', '#8b5cf6'])
        )])
        fig.update_layout(
            paper_bgcolor='#16213e',
            plot_bgcolor='#16213e',
            font_color='white',
            height=400
        )
        return fig
    
    def _create_radar_chart(self, df, material_type):
        valid, msg = self.validator.validate_dataframe(df, min_rows=1)
        if not valid:
            return self._create_error_figure(msg)
        
        numeric_cols = ['thickness', 'tensile_strength', 'water_content', 'collagen_ratio', 'age_years']
        available_cols = [col for col in numeric_cols if col in df.columns]
        
        if not available_cols:
            return self._create_error_figure("缺少数值型数据列")
        
        labels_map = {
            'thickness': '厚度',
            'tensile_strength': '抗张强度',
            'water_content': '含水量',
            'collagen_ratio': '胶原蛋白比例',
            'age_years': '年龄'
        }
        labels = [labels_map[col] for col in available_cols]
        
        if material_type and 'material_type' in df.columns:
            subset = df[df['material_type'] == material_type]
            if subset.empty:
                return self._create_error_figure(f"没有找到材质类型: {material_type}")
            means = subset[available_cols].mean()
        else:
            means = df[available_cols].mean()
        
        means = means.fillna(means.mean())
        normalized = (means - means.min()) / (means.max() - means.min() + 1e-8)
        
        fig = go.Figure(data=go.Scatterpolar(
            r=normalized.values,
            theta=labels,
            fill='toself',
            line_color='#e94560'
        ))
        fig.update_layout(
            polar=dict(
                bgcolor='#1a1a2e',
                radialaxis=dict(color='white', range=[0, 1])
            ),
            paper_bgcolor='#16213e',
            font_color='white',
            title=f'{material_type if material_type else "所有材质"}特性雷达图',
            height=500
        )
        return fig
    
    def _create_heatmap(self, df, metric):
        valid, msg = self.validator.validate_dataframe(df, ['material_type', 'source', metric])
        if not valid:
            return self._create_error_figure(msg)
        
        df_sampled = self.validator.sample_large_data(df, max_rows=5000)
        
        pivot_df = df_sampled.pivot_table(
            index='material_type',
            columns='source',
            values=metric,
            aggfunc='mean'
        ).fillna(0)
        
        if pivot_df.empty:
            return self._create_error_figure("热力图数据为空")
        
        fig = go.Figure(data=go.Heatmap(
            z=pivot_df.values,
            x=pivot_df.columns,
            y=pivot_df.index,
            colorscale='Viridis',
            text=pivot_df.values.round(2),
            texttemplate='%{text}'
        ))
        fig.update_layout(
            paper_bgcolor='#16213e',
            plot_bgcolor='#16213e',
            font_color='white',
            height=500
        )
        return fig
    
    def _create_correlation_matrix(self, df):
        numeric_df = df.select_dtypes(include=[np.number])
        if numeric_df.empty:
            return self._create_error_figure("没有数值型数据")
        
        numeric_df = numeric_df.apply(self.validator.clean_numeric_data)
        corr = numeric_df.corr()
        
        fig = go.Figure(data=go.Heatmap(
            z=corr.values,
            x=corr.columns,
            y=corr.columns,
            zmin=-1,
            zmax=1,
            colorscale='RdBu',
            text=corr.values.round(2),
            texttemplate='%{text}'
        ))
        fig.update_layout(
            paper_bgcolor='#16213e',
            plot_bgcolor='#16213e',
            font_color='white',
            height=500
        )
        return fig
    
    def _create_aging_trend_chart(self, df, years):
        valid, msg = self.validator.validate_dataframe(df, min_rows=1)
        if not valid:
            return self._create_error_figure(msg)
        
        try:
            future_df = self.analysis_manager.aging_predictor.predict_future_aging(df, years)
        except Exception as e:
            logger.error(f"老化预测失败: {e}")
            future_df = pd.DataFrame({
                'year': range(0, years + 1, 10),
                'tensile_strength': 25 - 0.1 * np.arange(0, years + 1, 10),
                'collagen_ratio': 80 - 0.05 * np.arange(0, years + 1, 10)
            })
        
        fig = go.Figure()
        
        colors = ['#e94560', '#4a90d9', '#4ade80']
        for i, col in enumerate(['tensile_strength', 'collagen_ratio', 'thickness']):
            if col in future_df.columns:
                data = future_df[col].fillna(future_df[col].mean())
                fig.add_trace(go.Scatter(
                    x=future_df['year'],
                    y=data,
                    mode='lines+markers',
                    name=col,
                    line=dict(width=3, color=colors[i % len(colors)])
                ))
        
        fig.update_layout(
            paper_bgcolor='#16213e',
            plot_bgcolor='#1a1a2e',
            font_color='white',
            xaxis_title='年份',
            yaxis_title='相对值',
            height=400
        )
        return fig
    
    def _create_feature_importance_chart(self, df):
        try:
            model_info = self.analysis_manager.aging_predictor.train_aging_model(df)
            
            if not model_info:
                return self._create_error_figure("无法训练模型，缺少必要特征")
            
            features = list(model_info['feature_importance'].keys())
            importance = list(model_info['feature_importance'].values())
            
            fig = go.Figure(data=go.Bar(
                x=features,
                y=importance,
                marker_color='#e94560'
            ))
            fig.update_layout(
                paper_bgcolor='#16213e',
                plot_bgcolor='#1a1a2e',
                font_color='white',
                yaxis_title='重要性',
                height=400
            )
            return fig
        except Exception as e:
            return self._create_error_figure(f"特征重要性分析失败: {str(e)}")
    
    def _create_pigment_fade_chart(self, pigment_df):
        valid, msg = self.validator.validate_dataframe(pigment_df, ['pigment_name', 'fade_rate'])
        if not valid:
            return self._create_error_figure(msg)
        
        pigment_df['fade_rate'] = self.validator.clean_numeric_data(pigment_df['fade_rate'])
        
        fig = go.Figure(data=go.Bar(
            x=pigment_df['pigment_name'],
            y=pigment_df['fade_rate'],
            marker_color=pigment_df['fade_rate'],
            marker_colorscale='Reds'
        ))
        fig.update_layout(
            paper_bgcolor='#16213e',
            plot_bgcolor='#1a1a2e',
            font_color='white',
            yaxis_title='褪色速率',
            height=400
        )
        return fig
    
    def _create_color_space_chart(self, pigment_df):
        required_cols = ['color_l', 'color_a', 'color_b', 'pigment_name']
        valid, msg = self.validator.validate_dataframe(pigment_df, required_cols)
        if not valid:
            return self._create_error_figure(msg)
        
        for col in ['color_l', 'color_a', 'color_b']:
            pigment_df[col] = self.validator.clean_numeric_data(pigment_df[col])
        
        pigment_df_sampled = self.validator.sample_large_data(pigment_df, max_rows=100)
        
        fig = go.Figure(data=go.Scatter3d(
            x=pigment_df_sampled['color_l'],
            y=pigment_df_sampled['color_a'],
            z=pigment_df_sampled['color_b'],
            mode='markers+text',
            text=pigment_df_sampled['pigment_name'],
            marker=dict(size=10, color=pigment_df_sampled.get('fade_rate', np.ones(len(pigment_df_sampled))),
                       colorscale='Viridis')
        ))
        fig.update_layout(
            paper_bgcolor='#16213e',
            scene=dict(
                xaxis_title='L*',
                yaxis_title='a*',
                zaxis_title='b*',
                bgcolor='#1a1a2e'
            ),
            font_color='white',
            height=500
        )
        return fig
    
    def _create_fade_simulation_chart(self, pigment_df, hours):
        valid, msg = self.validator.validate_dataframe(pigment_df, min_rows=1)
        if not valid:
            return self._create_error_figure(msg)
        
        try:
            initial_l = pigment_df['color_l'].iloc[0] if 'color_l' in pigment_df.columns else 50
            initial_a = pigment_df['color_a'].iloc[0] if 'color_a' in pigment_df.columns else 0
            initial_b = pigment_df['color_b'].iloc[0] if 'color_b' in pigment_df.columns else 0
            
            sim_df = pd.DataFrame({
                'hours': range(0, hours + 1, 100),
                'color_l': initial_l * (1 - 0.0002 * np.arange(0, hours + 1, 100)),
                'color_a': initial_a * (1 - 0.00015 * np.arange(0, hours + 1, 100)),
                'color_b': initial_b * (1 - 0.0001 * np.arange(0, hours + 1, 100))
            })
            
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=sim_df['hours'],
                y=sim_df['color_l'],
                mode='lines',
                name='L* (亮度)',
                line=dict(color='#ffd700', width=3)
            ))
            fig.add_trace(go.Scatter(
                x=sim_df['hours'],
                y=sim_df['color_a'],
                mode='lines',
                name='a* (红绿)',
                line=dict(color='#ff4444', width=3)
            ))
            fig.add_trace(go.Scatter(
                x=sim_df['hours'],
                y=sim_df['color_b'],
                mode='lines',
                name='b* (黄蓝)',
                line=dict(color='#4444ff', width=3)
            ))
            
            fig.update_layout(
                paper_bgcolor='#16213e',
                plot_bgcolor='#1a1a2e',
                font_color='white',
                xaxis_title='光照小时数',
                yaxis_title='颜色值',
                height=400
            )
            return fig
        except Exception as e:
            return self._create_error_figure(f"模拟失败: {str(e)}")
    
    def _create_data_table(self, df, max_rows=50):
        valid, msg = self.validator.validate_dataframe(df)
        if not valid:
            return html.Div(f"表格加载失败: {msg}", style={'color': '#e94560'})
        
        display_df = df.head(max_rows).copy()
        
        for col in display_df.columns:
            if pd.api.types.is_numeric_dtype(display_df[col]):
                display_df[col] = display_df[col].round(3)
        
        table = html.Table([
            html.Thead(html.Tr([
                html.Th(col, style={'border': '1px solid #333', 'padding': '8px', 'backgroundColor': '#1a1a2e'}) 
                for col in display_df.columns
            ])),
            html.Tbody([
                html.Tr([
                    html.Td(str(val), style={'border': '1px solid #333', 'padding': '8px'}) 
                    for val in row
                ]) for _, row in display_df.iterrows()
            ])
        ], style={'width': '100%', 'borderCollapse': 'collapse', 'color': 'white'})
        
        return html.Div([
            table,
            html.P(f"显示前 {len(display_df)} 行，共 {len(df)} 行数据", 
                   style={'color': '#888', 'marginTop': '10px'})
        ])
    
    def _get_material_options(self, df):
        if df is not None and 'material_type' in df.columns:
            return [{'label': mt, 'value': mt} for mt in sorted(df['material_type'].unique())]
        return []
    
    def _setup_callbacks(self):
        @self.app.callback(
            [Output('overview-stats', 'children'),
             Output('material-distribution-chart', 'figure'),
             Output('material-selector', 'options'),
             Output('material-data-table', 'children'),
             Output('data-load-status', 'children')],
            [Input('load-api-btn', 'n_clicks'),
             Input('upload-data', 'contents')],
            [State('upload-data', 'filename')]
        )
        def update_overview(n_clicks, contents, filename):
            ctx = dash.callback_context
            if not ctx.triggered:
                trigger_id = 'load-api-btn'
            else:
                trigger_id = ctx.triggered[0]['prop_id'].split('.')[0]
            
            try:
                if trigger_id == 'upload-data' and contents:
                    import base64
                    content_type, content_string = contents.split(',')
                    decoded = base64.b64decode(content_string)
                    
                    if filename.endswith('.csv'):
                        from io import StringIO
                        self._cached_material_data = pd.read_csv(StringIO(decoded.decode('utf-8')))
                    elif filename.endswith('.xlsx'):
                        from io import BytesIO
                        self._cached_material_data = pd.read_excel(BytesIO(decoded))
                    else:
                        raise ValueError(f"不支持的文件格式: {filename}")
                    
                    status_msg = f"✅ 成功上传文件: {filename}，共 {len(self._cached_material_data)} 行数据"
                else:
                    self._cached_material_data = self.data_manager.load_from_museum()
                    status_msg = f"✅ 从博物馆API加载数据成功，共 {len(self._cached_material_data)} 行"
                
                self._cached_pigment_data = self.data_manager.get_pigment_data()
                
                stats = self._create_stats_cards(self._cached_material_data)
                dist_fig = self._safe_create_figure(self._create_distribution_chart, self._cached_material_data)
                options = self._get_material_options(self._cached_material_data)
                table = self._create_data_table(self._cached_material_data)
                
                return stats, dist_fig, options, table, status_msg
                
            except Exception as e:
                logger.error(f"数据加载失败: {str(e)}")
                error_msg = f"❌ 数据加载失败: {str(e)}"
                empty_fig = self._create_error_figure(str(e))
                return html.Div(error_msg), empty_fig, [], html.Div(error_msg), error_msg
        
        @self.app.callback(
            Output('radar-chart', 'figure'),
            [Input('material-selector', 'value')]
        )
        def update_radar_chart(material_type):
            df, _ = self._get_cached_data()
            return self._safe_create_figure(self._create_radar_chart, df, material_type)
        
        @self.app.callback(
            [Output('aging-prediction-results', 'children'),
             Output('aging-material-selector', 'options')],
            [Input('run-aging-prediction', 'n_clicks')]
        )
        def run_aging_prediction(n_clicks):
            if n_clicks is None:
                return html.Div('点击上方按钮运行老化预测分析', style={'color': '#888', 'padding': '20px'}), []
            
            try:
                df, _ = self._get_cached_data()
                
                results = self.analysis_manager.run_enhanced_analysis(
                    df, enable_aging_prediction=True, enable_similarity_search=False
                )
                
                self._cached_analysis_results = results
                
                predictions = results.get('aging_predictions', {})
                
                prediction_cards = []
                for pred, lower, upper in zip(
                    predictions.get('predicted_age', []),
                    predictions.get('lower_bound', []),
                    predictions.get('upper_bound', [])
                ):
                    prediction_cards.append(html.Div([
                        html.P(f"预测年龄: {pred:.1f} 年", style={'color': 'white'}),
                        html.P(f"置信区间: [{lower:.1f}, {upper:.1f}]", style={'color': '#aaa'}),
                    ], style={'padding': '10px', 'backgroundColor': '#1a1a2e', 'borderRadius': '5px', 'margin': '5px'}))
                
                results_div = html.Div([
                    html.H4('预测结果摘要', style={'color': '#e94560'}),
                ] + prediction_cards)
                
                options = [{'label': f'样本 {i}', 'value': i} for i in range(len(df))]
                
                return results_div, options
                
            except Exception as e:
                logger.error(f"老化预测失败: {e}")
                return html.Div(f"❌ 预测失败: {str(e)}", style={'color': '#e94560', 'padding': '20px'}), []
        
        @self.app.callback(
            Output('aging-trajectory-chart', 'figure'),
            [Input('aging-material-selector', 'value')]
        )
        def update_aging_trajectory_chart(material_index):
            if material_index is None:
                return self._create_error_figure("请先选择样本")
            
            try:
                df, _ = self._get_cached_data()
                
                detailed_aging = self.analysis_manager.enhanced_aging_predictor.predict_detailed_aging(
                    df.iloc[[material_index]]
                )
                
                if not detailed_aging or len(detailed_aging) == 0:
                    return self._create_error_figure("无法生成老化轨迹")
                
                trajectory = detailed_aging[0]['aging_trajectory']
                traj_df = pd.DataFrame(trajectory)
                
                fig = go.Figure()
                
                colors = {'tensile_strength': '#e94560', 'collagen_ratio': '#4a90d9', 'thickness': '#4ade80'}
                names = {'tensile_strength': '抗张强度', 'collagen_ratio': '胶原蛋白比例', 'thickness': '厚度'}
                
                for col in ['tensile_strength', 'collagen_ratio', 'thickness']:
                    if col in traj_df.columns:
                        fig.add_trace(go.Scatter(
                            x=traj_df['year'],
                            y=traj_df[col],
                            mode='lines+markers',
                            name=names[col],
                            line=dict(width=3, color=colors[col])
                        ))
                
                fig.update_layout(
                    paper_bgcolor='#16213e',
                    plot_bgcolor='#1a1a2e',
                    font_color='white',
                    xaxis_title='预测年份',
                    yaxis_title='属性值',
                    height=400
                )
                
                return fig
                
            except Exception as e:
                logger.error(f"老化轨迹图生成失败: {e}")
                return self._create_error_figure(f"生成失败: {str(e)}")
        
        @self.app.callback(
            Output('risk-assessment-results', 'children'),
            [Input('run-aging-prediction', 'n_clicks')]
        )
        def update_risk_assessment(n_clicks):
            if n_clicks is None:
                return html.Div('请先运行老化预测分析', style={'color': '#888', 'padding': '20px'})
            
            try:
                df, _ = self._get_cached_data()
                
                detailed_aging = self.analysis_manager.enhanced_aging_predictor.predict_detailed_aging(df)
                
                risk_cards = []
                for idx, item in enumerate(detailed_aging):
                    trajectory = item['aging_trajectory']
                    if len(trajectory) > 0:
                        current_risk = trajectory[0].get('risk_level', 'unknown')
                        maintenance = trajectory[0].get('maintenance_suggestion', '')
                        
                        risk_colors = {'high': '#e94560', 'medium': '#ffa500', 'low': '#4ade80'}
                        risk_names = {'high': '高风险', 'medium': '中等风险', 'low': '低风险'}
                        
                        risk_cards.append(html.Div([
                            html.H5(f"样本 {idx}", style={'color': risk_colors.get(current_risk, '#888')}),
                            html.P(f"风险等级: {risk_names.get(current_risk, '未知')}", style={'color': 'white'}),
                            html.P(f"维护建议: {maintenance}", style={'color': '#aaa', 'fontSize': '0.9em'})
                        ], style={'padding': '15px', 'backgroundColor': '#1a1a2e', 'borderRadius': '5px', 'margin': '10px',
                                  'borderLeft': f'4px solid {risk_colors.get(current_risk, "#888")}'}))
                
                return html.Div(risk_cards, style={'display': 'grid', 'gridTemplateColumns': 'repeat(auto-fill, minmax(250px, 1fr))'})
                
            except Exception as e:
                logger.error(f"风险评估失败: {e}")
                return html.Div(f"❌ 风险评估失败: {str(e)}", style={'color': '#e94560', 'padding': '20px'})
        
        @self.app.callback(
            [Output('similarity-results', 'children'),
             Output('similarity-chart', 'figure')],
            [Input('run-similarity-search', 'n_clicks')],
            [State('query-index', 'value'), State('top-k', 'value'), State('similarity-method', 'value')]
        )
        def run_similarity_search(n_clicks, query_index, top_k, method):
            if n_clicks is None:
                return html.Div('点击上方按钮检索相似材质', style={'color': '#888', 'padding': '20px'}), self._create_error_figure("等待检索")
            
            try:
                df, _ = self._get_cached_data()
                
                if query_index >= len(df):
                    return html.Div(f"❌ 查询索引超出范围，最大值为 {len(df)-1}", 
                                   style={'color': '#e94560', 'padding': '20px'}), self._create_error_figure("索引超出范围")
                
                results = self.analysis_manager.find_similar_materials(
                    df, query_index, top_k=top_k, method=method
                )
                
                results_table = html.Table([
                    html.Thead(html.Tr([
                        html.Th('排名', style={'border': '1px solid #333', 'padding': '8px', 'backgroundColor': '#1a1a2e'}),
                        html.Th('相似度', style={'border': '1px solid #333', 'padding': '8px', 'backgroundColor': '#1a1a2e'}),
                        html.Th('材质类型', style={'border': '1px solid #333', 'padding': '8px', 'backgroundColor': '#1a1a2e'}),
                        html.Th('来源', style={'border': '1px solid #333', 'padding': '8px', 'backgroundColor': '#1a1a2e'})
                    ])),
                    html.Tbody([
                        html.Tr([
                            html.Td(str(item['rank']), style={'border': '1px solid #333', 'padding': '8px'}),
                            html.Td(f"{item['similarity_score']:.4f}", style={'border': '1px solid #333', 'padding': '8px'}),
                            html.Td(item['material_type'], style={'border': '1px solid #333', 'padding': '8px'}),
                            html.Td(item.get('source', 'N/A'), style={'border': '1px solid #333', 'padding': '8px'})
                        ]) for item in results
                    ])
                ], style={'width': '100%', 'borderCollapse': 'collapse', 'color': 'white'})
                
                fig = go.Figure(data=go.Bar(
                    x=[item['rank'] for item in reversed(results)],
                    y=[item['similarity_score'] for item in reversed(results)],
                    orientation='h',
                    marker_color='#e94560'
                ))
                fig.update_layout(
                    paper_bgcolor='#16213e',
                    plot_bgcolor='#1a1a2e',
                    font_color='white',
                    xaxis_title='相似度分数',
                    yaxis_title='排名',
                    height=400
                )
                
                return results_table, fig
                
            except Exception as e:
                logger.error(f"相似度检索失败: {e}")
                return html.Div(f"❌ 检索失败: {str(e)}", style={'color': '#e94560', 'padding': '20px'}), self._create_error_figure(str(e))
        
        @self.app.callback(
            [Output('export-results', 'children'),
             Output('performance-stats', 'children')],
            [Input('run-export', 'n_clicks')],
            [State('export-format', 'value'), State('export-prefix', 'value')]
        )
        def run_export(n_clicks, export_format, export_prefix):
            if n_clicks is None:
                return (html.Div('点击上方按钮导出分析结果', style={'color': '#888', 'padding': '20px'}),
                        self._get_performance_stats_div())
            
            try:
                df, pigment_df = self._get_cached_data()
                
                if self._cached_analysis_results is None:
                    self._cached_analysis_results = self.analysis_manager.run_enhanced_analysis(df, pigment_df)
                
                from feature_extraction.feature_extractor import MaterialFeatureExtractor
                extractor = MaterialFeatureExtractor()
                features_df = extractor.extract_all_features(df, pigment_df)
                
                export_path = f"{export_prefix}"
                results = self.analysis_manager.export_results(features_df, self._cached_analysis_results, export_path, export_format)
                
                if export_format == 'all':
                    result_items = []
                    for fmt, path in results['features'].items():
                        if path:
                            result_items.append(html.Div(f"✅ 特征数据 ({fmt.upper()}): {path}", 
                                                        style={'color': '#4ade80', 'margin': '5px'}))
                    for fmt, path in results['analysis'].items():
                        if path:
                            result_items.append(html.Div(f"✅ 分析结果 ({fmt.upper()}): {path}", 
                                                        style={'color': '#4ade80', 'margin': '5px'}))
                    results_div = html.Div(result_items)
                else:
                    results_div = html.Div([
                        html.Div(f"✅ 特征数据已导出: {results['features']}", style={'color': '#4ade80', 'margin': '5px'}),
                        html.Div(f"✅ 分析结果已导出: {results['analysis']}", style={'color': '#4ade80', 'margin': '5px'})
                    ])
                
                return results_div, self._get_performance_stats_div()
                
            except Exception as e:
                logger.error(f"导出失败: {e}")
                return html.Div(f"❌ 导出失败: {str(e)}", style={'color': '#e94560', 'padding': '20px'}), self._get_performance_stats_div()
    
    def _get_performance_stats_div(self):
        perf_stats = self.analysis_manager.get_performance_stats()
        avg_render_time = self._render_stats['total_render_time'] / max(1, self._render_stats['total_renders'])
        
        return html.Div([
            html.Div([
                html.H5('缓存统计', style={'color': '#e94560'}),
                html.P(f"总渲染次数: {self._render_stats['total_renders']}", style={'color': 'white'}),
                html.P(f"平均渲染时间: {avg_render_time:.3f}s", style={'color': 'white'}),
                html.P(f"缓存命中率: {perf_stats.get('cache_hit_rate', 0):.1%}", style={'color': 'white'}),
                html.P(f"缓存命中数: {perf_stats.get('cache_hits', 0)}", style={'color': 'white'}),
                html.P(f"缓存未命中数: {perf_stats.get('cache_misses', 0)}", style={'color': 'white'})
            ], style={'padding': '15px', 'backgroundColor': '#1a1a2e', 'borderRadius': '5px', 'margin': '10px'})
        ])
        
        @self.app.callback(
            [Output('heatmap-chart', 'figure'),
             Output('correlation-matrix', 'figure')],
            [Input('heatmap-metric', 'value')]
        )
        def update_heatmaps(metric):
            df = self._cached_material_data
            if df is None:
                df = self.data_manager.load_from_museum()
                self._cached_material_data = df
            
            heatmap_fig = self._safe_create_figure(self._create_heatmap, df, metric)
            corr_fig = self._safe_create_figure(self._create_correlation_matrix, df)
            return heatmap_fig, corr_fig
        
        @self.app.callback(
            [Output('aging-trend-chart', 'figure'),
             Output('feature-importance-chart', 'figure')],
            [Input('aging-years-slider', 'value')]
        )
        def update_aging_charts(years):
            df = self._cached_material_data
            if df is None:
                df = self.data_manager.load_from_museum()
                self._cached_material_data = df
            
            trend_fig = self._safe_create_figure(self._create_aging_trend_chart, df, years)
            importance_fig = self._safe_create_figure(self._create_feature_importance_chart, df)
            return trend_fig, importance_fig
        
        @self.app.callback(
            [Output('pigment-fade-chart', 'figure'),
             Output('color-space-chart', 'figure')],
            [Input('load-api-btn', 'n_clicks')]
        )
        def update_pigment_charts(n_clicks):
            pigment_df = self._cached_pigment_data
            if pigment_df is None:
                pigment_df = self.data_manager.get_pigment_data()
                self._cached_pigment_data = pigment_df
            
            fade_fig = self._safe_create_figure(self._create_pigment_fade_chart, pigment_df)
            color_fig = self._safe_create_figure(self._create_color_space_chart, pigment_df)
            return fade_fig, color_fig
        
        @self.app.callback(
            Output('fade-simulation-chart', 'figure'),
            [Input('simulate-btn', 'n_clicks')],
            [State('fade-hours-input', 'value')]
        )
        def update_simulation(n_clicks, hours):
            if n_clicks is None or n_clicks == 0:
                hours = 1000
            
            pigment_df = self._cached_pigment_data
            if pigment_df is None:
                pigment_df = self.data_manager.get_pigment_data()
                self._cached_pigment_data = pigment_df
            
            return self._safe_create_figure(self._create_fade_simulation_chart, pigment_df, hours)
    
    def run_server(self, debug=True, port=8050):
        logger.info(f"启动仪表板服务器: http://localhost:{port}")
        self.app.run_server(debug=debug, port=port)
