import dash
from dash import dcc, html, Input, Output, State, dash_table
import dash_bootstrap_components as dbc
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any
import base64
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_access import DataConnector
from data_cleaning import DataCleaner
from correlation_analysis import CorrelationAnalyzer


class Dashboard:
    def __init__(self, data: Optional[pd.DataFrame] = None):
        self.data = data
        self.app = dash.Dash(__name__, external_stylesheets=[dbc.themes.BOOTSTRAP])
        self._setup_layout()
        self._setup_callbacks()

    def set_data(self, data: pd.DataFrame):
        self.data = data.copy()

    def _setup_layout(self):
        self.app.layout = dbc.Container([
            html.H1("数据分析平台", className="text-center mt-4 mb-4"),
            
            dcc.Tabs([
                dcc.Tab(label="数据接入", children=self._get_data_access_tab()),
                dcc.Tab(label="数据清洗", children=self._get_data_cleaning_tab()),
                dcc.Tab(label="关联分析", children=self._get_correlation_tab()),
                dcc.Tab(label="可视化", children=self._get_visualization_tab()),
            ]),
            
            dcc.Store(id="stored-data"),
            dcc.Store(id="cleaned-data"),
        ], fluid=True)

    def _get_data_access_tab(self):
        return dbc.Card([
            dbc.CardHeader("数据源配置"),
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        html.Label("数据源类型"),
                        dcc.Dropdown(
                            id="data-source-type",
                            options=[
                                {"label": "上传文件 (CSV/JSON)", "value": "upload"},
                                {"label": "MySQL数据库", "value": "mysql"},
                                {"label": "PostgreSQL数据库", "value": "postgresql"},
                                {"label": "API接口", "value": "api"},
                            ],
                            value="upload",
                        ),
                    ], width=6),
                ], className="mb-3"),
                
                html.Div(id="source-config-area"),
                
                html.Button("加载示例数据", id="load-sample-btn", className="btn btn-info mt-3 me-2"),
                html.Button("应用配置", id="load-data-btn", className="btn btn-primary mt-3"),
                
                html.Div(id="data-info-area", className="mt-4"),
                
                html.Div(id="data-preview-area", className="mt-4"),
            ]),
        ], className="mt-3")

    def _get_data_cleaning_tab(self):
        return dbc.Card([
            dbc.CardHeader("数据清洗配置"),
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        html.Label("缺失值处理策略"),
                        dcc.Dropdown(
                            id="missing-strategy",
                            options=[
                                {"label": "删除含缺失值行", "value": "drop"},
                                {"label": "均值填充", "value": "fill_mean"},
                                {"label": "中位数填充", "value": "fill_median"},
                                {"label": "众数填充", "value": "fill_mode"},
                                {"label": "指定值填充", "value": "fill_value"},
                                {"label": "前向填充", "value": "ffill"},
                                {"label": "后向填充", "value": "bfill"},
                            ],
                            value="fill_mean",
                        ),
                    ], width=6),
                ], className="mb-3"),
                
                dbc.Row([
                    dbc.Col([
                        html.Label("异常值处理方法"),
                        dcc.Dropdown(
                            id="outlier-method",
                            options=[
                                {"label": "不处理", "value": "none"},
                                {"label": "盖帽法", "value": "cap"},
                                {"label": "删除", "value": "remove"},
                                {"label": "均值替换", "value": "mean"},
                            ],
                            value="none",
                        ),
                    ], width=6),
                    dbc.Col([
                        html.Label("异常值检测阈值 (IQR倍数)"),
                        dcc.Slider(
                            id="outlier-threshold",
                            min=1.0,
                            max=3.0,
                            step=0.1,
                            value=1.5,
                            marks={i: str(i) for i in [1, 1.5, 2, 2.5, 3]},
                        ),
                    ], width=6),
                ], className="mb-3"),
                
                dbc.Row([
                    dbc.Col([
                        dbc.Checklist(
                            options=[
                                {"label": "标准化文本", "value": "text_standardize"},
                                {"label": "去除重复", "value": "remove_duplicates"},
                                {"label": "标准化数值特征", "value": "feature_scaling"},
                            ],
                            value=[],
                            id="cleaning-options",
                        ),
                    ], width=12),
                ], className="mb-3"),
                
                html.Button("应用清洗规则", id="apply-cleaning-btn", className="btn btn-success"),
                
                html.Div(id="cleaning-report-area", className="mt-4"),
            ]),
        ], className="mt-3")

    def _get_correlation_tab(self):
        return dbc.Card([
            dbc.CardHeader("关联分析"),
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        html.Label("相关系数方法"),
                        dcc.Dropdown(
                            id="corr-method",
                            options=[
                                {"label": "Pearson", "value": "pearson"},
                                {"label": "Spearman", "value": "spearman"},
                                {"label": "Kendall", "value": "kendall"},
                            ],
                            value="pearson",
                        ),
                    ], width=6),
                    dbc.Col([
                        html.Label("高相关性阈值"),
                        dcc.Slider(
                            id="corr-threshold",
                            min=0.1,
                            max=1.0,
                            step=0.05,
                            value=0.7,
                            marks={i: f"{i:.1f}" for i in [0.3, 0.5, 0.7, 0.9]},
                        ),
                    ], width=6),
                ], className="mb-3"),
                
                html.Button("计算相关性", id="compute-corr-btn", className="btn btn-primary mb-3"),
                
                html.Div(id="correlation-heatmap-area"),
                
                html.Div(id="high-correlation-list", className="mt-4"),
                
                html.Hr(),
                
                dbc.Row([
                    dbc.Col([
                        html.Label("聚类方法"),
                        dcc.Dropdown(
                            id="cluster-method",
                            options=[
                                {"label": "K-Means", "value": "kmeans"},
                                {"label": "层次聚类", "value": "hierarchical"},
                                {"label": "DBSCAN", "value": "dbscan"},
                            ],
                            value="kmeans",
                        ),
                    ], width=4),
                    dbc.Col([
                        html.Label("聚类数量"),
                        dcc.Slider(
                            id="n-clusters",
                            min=2,
                            max=10,
                            step=1,
                            value=3,
                            marks={i: str(i) for i in range(2, 11)},
                        ),
                    ], width=4),
                ], className="mb-3"),
                
                html.Button("执行聚类分析", id="compute-cluster-btn", className="btn btn-info"),
                
                html.Div(id="cluster-visualization-area", className="mt-4"),
            ]),
        ], className="mt-3")

    def _get_visualization_tab(self):
        return dbc.Card([
            dbc.CardHeader("数据可视化"),
            dbc.CardBody([
                dbc.Row([
                    dbc.Col([
                        html.Label("图表类型"),
                        dcc.Dropdown(
                            id="chart-type",
                            options=[
                                {"label": "散点图", "value": "scatter"},
                                {"label": "直方图", "value": "histogram"},
                                {"label": "箱线图", "value": "box"},
                                {"label": "折线图", "value": "line"},
                                {"label": "条形图", "value": "bar"},
                            ],
                            value="scatter",
                        ),
                    ], width=4),
                    dbc.Col([
                        html.Label("X轴变量"),
                        dcc.Dropdown(id="x-variable"),
                    ], width=4),
                    dbc.Col([
                        html.Label("Y轴变量"),
                        dcc.Dropdown(id="y-variable"),
                    ], width=4),
                ], className="mb-3"),
                
                dbc.Row([
                    dbc.Col([
                        html.Label("颜色分组变量"),
                        dcc.Dropdown(id="color-variable"),
                    ], width=4),
                ], className="mb-3"),
                
                html.Button("生成图表", id="generate-chart-btn", className="btn btn-primary mb-3"),
                
                dcc.Graph(id="main-chart"),
            ]),
        ], className="mt-3")

    def _optimize_dtypes(self, df: pd.DataFrame) -> pd.DataFrame:
        for col in df.columns:
            col_type = df[col].dtype
            if col_type == 'object':
                num_unique = df[col].nunique()
                if num_unique / len(df) < 0.5:
                    df[col] = df[col].astype('category')
            elif col_type in ['int64', 'float64']:
                if col_type == 'int64':
                    df[col] = pd.to_numeric(df[col], downcast='integer')
                else:
                    df[col] = pd.to_numeric(df[col], downcast='float')
        return df

    def _setup_callbacks(self):
        @self.app.callback(
            Output("source-config-area", "children"),
            Input("data-source-type", "value"),
        )
        def update_source_config(source_type):
            if source_type == "upload":
                return html.Div([
                    dcc.Upload(
                        id="upload-data",
                        children=html.Div([
                            "拖拽文件到此处 或 ",
                            html.A("点击选择文件 (CSV/JSON)")
                        ]),
                        style={
                            "width": "100%",
                            "height": "60px",
                            "lineHeight": "60px",
                            "borderWidth": "1px",
                            "borderStyle": "dashed",
                            "borderRadius": "5px",
                            "textAlign": "center",
                            "margin": "10px 0"
                        },
                    ),
                    dbc.Row([
                        dbc.Col([
                            dbc.Checklist(
                                options=[{"label": "启用分块加载 (大文件)", "value": "chunking"}],
                                value=[],
                                id="upload-options"
                            ),
                        ], width=6),
                    ]),
                ])
            elif source_type in ["mysql", "postgresql"]:
                return dbc.Row([
                    dbc.Col([dbc.Input(id="db-host", placeholder="主机地址", type="text", value="localhost")], width=3),
                    dbc.Col([dbc.Input(id="db-port", placeholder="端口", type="number", value=3306 if source_type == "mysql" else 5432)], width=2),
                    dbc.Col([dbc.Input(id="db-user", placeholder="用户名", type="text")], width=2),
                    dbc.Col([dbc.Input(id="db-password", placeholder="密码", type="password")], width=2),
                    dbc.Col([dbc.Input(id="db-name", placeholder="数据库名", type="text")], width=3),
                    dbc.Col([dbc.Textarea(id="db-query", placeholder="SQL查询语句", rows=3)], width=12),
                ], className="mb-3")
            elif source_type == "api":
                return dbc.Row([
                    dbc.Col([dbc.Input(id="api-url", placeholder="API地址", type="text")], width=8),
                    dbc.Col([
                        dcc.Dropdown(
                            id="api-method",
                            options=[{"label": "GET", "value": "GET"}, {"label": "POST", "value": "POST"}],
                            value="GET",
                        )
                    ], width=2),
                ], className="mb-3")
            return html.Div()

        @self.app.callback(
            [Output("stored-data", "data"), Output("data-info-area", "children"), Output("data-preview-area", "children")],
            [Input("load-data-btn", "n_clicks"), Input("load-sample-btn", "n_clicks"), Input("upload-data", "contents")],
            [State("upload-data", "filename"), State("data-source-type", "value"), State("upload-options", "value")],
            prevent_initial_call=True,
        )
        def load_data(n_clicks, n_sample, contents, filename, source_type, upload_options):
            ctx = dash.callback_context
            triggered_id = ctx.triggered[0]["prop_id"].split(".")[0]
            
            df = None
            
            if triggered_id == "load-sample-btn":
                from sklearn.datasets import load_iris
                iris = load_iris()
                df = pd.DataFrame(iris.data, columns=iris.feature_names)
                df["target"] = iris.target
                df["target_name"] = [iris.target_names[i] for i in iris.target]
            
            elif triggered_id == "upload-data" and contents:
                content_type, content_string = contents.split(",")
                decoded = base64.b64decode(content_string)
                
                try:
                    use_chunking = "chunking" in upload_options if upload_options else False
                    if filename.endswith(".csv"):
                        if use_chunking:
                            chunks = []
                            for chunk in pd.read_csv(io.StringIO(decoded.decode("utf-8")), chunksize=10000):
                                chunk = self._optimize_dtypes(chunk)
                                chunks.append(chunk)
                            df = pd.concat(chunks, ignore_index=True)
                        else:
                            df = pd.read_csv(io.StringIO(decoded.decode("utf-8")))
                            df = self._optimize_dtypes(df)
                    elif filename.endswith(".json"):
                        df = pd.read_json(io.StringIO(decoded.decode("utf-8")))
                        df = self._optimize_dtypes(df)
                except MemoryError:
                    return None, dbc.Alert("内存不足，请启用分块加载模式", color="danger"), html.Div()
                except Exception as e:
                    return None, dbc.Alert(f"文件解析失败: {str(e)}", color="danger"), html.Div()
            
            if df is None:
                return None, dbc.Alert("请先上传文件、选择数据源或加载示例数据", color="warning"), html.Div()
            
            memory_usage = df.memory_usage(deep=True).sum() / (1024 * 1024)
            
            data_info = dbc.Alert([
                html.H5("数据信息"),
                html.P(f"行数: {len(df)}, 列数: {len(df.columns)}"),
                html.P(f"内存占用: {memory_usage:.2f} MB"),
                html.P(f"列名: {', '.join(df.columns.tolist())}"),
            ], color="info")
            
            preview = html.Div([
                html.H5("数据预览 (前10行)"),
                dash_table.DataTable(
                    data=df.head(10).to_dict("records"),
                    columns=[{"name": i, "id": i} for i in df.columns],
                    page_size=10,
                    style_table={"overflowX": "auto"},
                ),
            ])
            
            return df.to_json(date_format="iso", orient="split"), data_info, preview

        @self.app.callback(
            [Output("x-variable", "options"), Output("y-variable", "options"), Output("color-variable", "options")],
            Input("stored-data", "data"),
            prevent_initial_call=True,
        )
        def update_variable_dropdowns(stored_data):
            if stored_data is None:
                return [], [], []
            
            df = pd.read_json(stored_data, orient="split")
            options = [{"label": col, "value": col} for col in df.columns]
            
            return options, options, [{"label": "无", "value": ""}] + options

        @self.app.callback(
            [Output("cleaned-data", "data"), Output("cleaning-report-area", "children")],
            Input("apply-cleaning-btn", "n_clicks"),
            [State("stored-data", "data"), State("missing-strategy", "value"), 
             State("outlier-method", "value"), State("outlier-threshold", "value"),
             State("cleaning-options", "value")],
            prevent_initial_call=True,
        )
        def apply_cleaning(n_clicks, stored_data, missing_strategy, outlier_method, outlier_threshold, cleaning_options):
            if stored_data is None:
                return None, dbc.Alert("请先加载数据", color="warning")
            
            df = pd.read_json(stored_data, orient="split")
            
            cleaner = DataCleaner(df)
            
            cleaner.handle_missing_values(strategy=missing_strategy)
            
            if outlier_method != "none":
                cleaner.handle_outliers(method=outlier_method, threshold=outlier_threshold)
            
            if "text_standardize" in cleaning_options:
                cleaner.standardize_text()
            
            if "remove_duplicates" in cleaning_options:
                cleaner.remove_duplicates()
            
            if "feature_scaling" in cleaning_options:
                cleaner.scale_features(method="standard")
            
            cleaned_df = cleaner.get_cleaned_data()
            report = cleaner.get_cleaning_report()
            
            report_html = dbc.Alert([
                html.H5("清洗报告"),
                html.P(f"清洗前形状: {df.shape}, 清洗后形状: {cleaned_df.shape}"),
                html.P(f"缺失值处理策略: {missing_strategy}"),
                html.P(f"异常值处理方法: {outlier_method}"),
                html.H6("操作历史:"),
                html.Ul([html.Li(f"{item['operation']}: {item['details']}") for item in report['history']]),
            ], color="success")
            
            return cleaned_df.to_json(date_format="iso", orient="split"), report_html

        @self.app.callback(
            [Output("correlation-heatmap-area", "children"), Output("high-correlation-list", "children")],
            Input("compute-corr-btn", "n_clicks"),
            [State("stored-data", "data"), State("corr-method", "value"), State("corr-threshold", "value")],
            prevent_initial_call=True,
        )
        def compute_correlation(n_clicks, stored_data, corr_method, corr_threshold):
            if stored_data is None:
                return html.Div(dbc.Alert("请先加载数据", color="warning")), html.Div()
            
            df = pd.read_json(stored_data, orient="split")
            
            analyzer = CorrelationAnalyzer(df)
            
            try:
                corr_matrix = analyzer.compute_correlation_matrix(method=corr_method)
                
                fig = go.Figure(data=go.Heatmap(
                    z=corr_matrix.values,
                    x=corr_matrix.columns,
                    y=corr_matrix.columns,
                    colorscale="RdBu",
                    zmin=-1,
                    zmax=1,
                    text=corr_matrix.round(2).values,
                    texttemplate="%{text}",
                ))
                fig.update_layout(title=f"相关性热力图 ({corr_method.capitalize()})", height=600)
                
                high_corr = analyzer.get_high_correlations(threshold=corr_threshold, method=corr_method)
                
                if high_corr:
                    high_corr_list = html.Div([
                        html.H5(f"高相关性变量对 (阈值={corr_threshold})"),
                        html.Ul([
                            html.Li(f"{item['variable1']} - {item['variable2']}: {item['correlation']:.3f}")
                            for item in high_corr
                        ]),
                    ])
                else:
                    high_corr_list = html.Div("未发现高相关性变量对")
                
                return dcc.Graph(figure=fig), high_corr_list
            except Exception as e:
                return html.Div(dbc.Alert(f"计算失败: {str(e)}", color="danger")), html.Div()

        @self.app.callback(
            Output("cluster-visualization-area", "children"),
            Input("compute-cluster-btn", "n_clicks"),
            [State("stored-data", "data"), State("cluster-method", "value"), State("n-clusters", "value")],
            prevent_initial_call=True,
        )
        def compute_clustering(n_clicks, stored_data, cluster_method, n_clusters):
            if stored_data is None:
                return dbc.Alert("请先加载数据", color="warning")
            
            df = pd.read_json(stored_data, orient="split")
            
            analyzer = CorrelationAnalyzer(df)
            
            try:
                if cluster_method == "kmeans":
                    result = analyzer.kmeans_clustering(n_clusters=n_clusters)
                elif cluster_method == "hierarchical":
                    result = analyzer.hierarchical_clustering(n_clusters=n_clusters)
                elif cluster_method == "dbscan":
                    result = analyzer.dbscan_clustering()
                else:
                    return dbc.Alert("不支持的聚类方法", color="danger")
                
                pca_result = analyzer.pca_analysis(n_components=2)
                pca_df = pca_result["pca_data"]
                pca_df["cluster"] = result["cluster_data"]["cluster"].astype(str)
                
                fig = px.scatter(
                    pca_df,
                    x="PC1",
                    y="PC2",
                    color="cluster",
                    title=f"聚类结果可视化 (PCA降维), 解释方差: {sum(pca_result['explained_variance_ratio']):.2%}",
                    hover_data=df.columns,
                )
                
                cluster_info = html.Div([
                    html.H6("聚类统计:"),
                    html.Ul([
                        html.Li(f"聚类 {k}: {v['size']} 个样本")
                        for k, v in result["cluster_stats"].items()
                    ]),
                ])
                
                return html.Div([dcc.Graph(figure=fig), cluster_info])
            except Exception as e:
                return dbc.Alert(f"聚类分析失败: {str(e)}", color="danger")

        @self.app.callback(
            Output("main-chart", "figure"),
            Input("generate-chart-btn", "n_clicks"),
            [State("stored-data", "data"), State("chart-type", "value"), 
             State("x-variable", "value"), State("y-variable", "value"),
             State("color-variable", "value")],
            prevent_initial_call=True,
        )
        def generate_chart(n_clicks, stored_data, chart_type, x_var, y_var, color_var):
            if stored_data is None:
                return go.Figure()
            
            df = pd.read_json(stored_data, orient="split")
            
            try:
                if chart_type == "scatter":
                    fig = px.scatter(df, x=x_var, y=y_var, color=color_var if color_var else None, 
                                     title=f"{y_var} vs {x_var}")
                elif chart_type == "histogram":
                    fig = px.histogram(df, x=x_var, color=color_var if color_var else None, 
                                       title=f"{x_var} 分布")
                elif chart_type == "box":
                    fig = px.box(df, x=x_var, y=y_var, color=color_var if color_var else None, 
                                 title=f"{y_var} 按 {x_var} 分组箱线图")
                elif chart_type == "line":
                    fig = px.line(df, x=x_var, y=y_var, color=color_var if color_var else None, 
                                  title=f"{y_var} 趋势")
                elif chart_type == "bar":
                    fig = px.bar(df, x=x_var, y=y_var, color=color_var if color_var else None, 
                                 title=f"{y_var} 条形图")
                else:
                    fig = go.Figure()
                
                return fig
            except Exception as e:
                return go.Figure().update_layout(title=f"图表生成失败: {str(e)}")

    def run_server(self, debug: bool = True, port: int = 8050):
        self.app.run_server(debug=debug, port=port)
