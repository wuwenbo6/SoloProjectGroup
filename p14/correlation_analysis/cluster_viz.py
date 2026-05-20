import pandas as pd
import numpy as np
from typing import Dict, Any, Optional, List, Tuple
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots


class ClusterVisualizer:
    def __init__(self, data: Optional[pd.DataFrame] = None):
        self.data = data
        self.numeric_cols: List[str] = []
        self.cluster_labels: Optional[np.ndarray] = None
        self.cluster_stats: Dict[str, Any] = {}
        self.pca_result: Optional[np.ndarray] = None
        self.feature_names: List[str] = []
        self.algorithm_used: str = ""
        
        if data is not None:
            self._identify_numeric_cols()

    def set_data(self, data: pd.DataFrame):
        self.data = data.copy()
        self._identify_numeric_cols()

    def _identify_numeric_cols(self):
        if self.data is not None:
            self.numeric_cols = self.data.select_dtypes(include=[np.number]).columns.tolist()

    def _prepare_data(self, columns: Optional[List[str]] = None) -> Tuple[np.ndarray, List[str]]:
        target_cols = columns if columns else self.numeric_cols
        data_for_clustering = self.data[target_cols].dropna()
        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(data_for_clustering)
        return scaled_data, target_cols

    def kmeans_clustering(self, n_clusters: int = 3, 
                          columns: Optional[List[str]] = None,
                          random_state: int = 42) -> Dict[str, Any]:
        scaled_data, feature_names = self._prepare_data(columns)
        self.feature_names = feature_names
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
        self.cluster_labels = kmeans.fit_predict(scaled_data)
        self.algorithm_used = "K-Means"
        
        self._compute_cluster_stats(scaled_data, n_clusters)
        
        self._perform_pca(scaled_data)
        
        return {
            "algorithm": "K-Means",
            "n_clusters": n_clusters,
            "labels": self.cluster_labels.tolist(),
            "cluster_stats": self.cluster_stats,
            "inertia": kmeans.inertia_,
            "silhouette_score": self.cluster_stats.get("silhouette_score"),
            "feature_names": feature_names
        }

    def dbscan_clustering(self, eps: float = 0.5, 
                          min_samples: int = 5,
                          columns: Optional[List[str]] = None) -> Dict[str, Any]:
        scaled_data, feature_names = self._prepare_data(columns)
        self.feature_names = feature_names
        
        dbscan = DBSCAN(eps=eps, min_samples=min_samples)
        self.cluster_labels = dbscan.fit_predict(scaled_data)
        self.algorithm_used = "DBSCAN"
        
        n_clusters = len(set(self.cluster_labels)) - (1 if -1 in self.cluster_labels else 0)
        
        if n_clusters > 1:
            self._compute_cluster_stats(scaled_data, n_clusters)
            self._perform_pca(scaled_data)
        else:
            self.cluster_stats = {
                "n_clusters": n_clusters,
                "n_noise": list(self.cluster_labels).count(-1)
            }
        
        return {
            "algorithm": "DBSCAN",
            "eps": eps,
            "min_samples": min_samples,
            "n_clusters": n_clusters,
            "n_noise": list(self.cluster_labels).count(-1),
            "labels": self.cluster_labels.tolist(),
            "cluster_stats": self.cluster_stats,
            "silhouette_score": self.cluster_stats.get("silhouette_score"),
            "feature_names": feature_names
        }

    def hierarchical_clustering(self, n_clusters: int = 3,
                                  columns: Optional[List[str]] = None,
                                  linkage: str = "ward") -> Dict[str, Any]:
        scaled_data, feature_names = self._prepare_data(columns)
        self.feature_names = feature_names
        
        hc = AgglomerativeClustering(n_clusters=n_clusters, linkage=linkage)
        self.cluster_labels = hc.fit_predict(scaled_data)
        self.algorithm_used = "Hierarchical"
        
        self._compute_cluster_stats(scaled_data, n_clusters)
        self._perform_pca(scaled_data)
        
        return {
            "algorithm": "Hierarchical",
            "linkage": linkage,
            "n_clusters": n_clusters,
            "labels": self.cluster_labels.tolist(),
            "cluster_stats": self.cluster_stats,
            "silhouette_score": self.cluster_stats.get("silhouette_score"),
            "feature_names": feature_names
        }

    def _compute_cluster_stats(self, scaled_data: np.ndarray, n_clusters: int):
        valid_indices = self.cluster_labels != -1
        valid_labels = self.cluster_labels[valid_indices]
        valid_data = scaled_data[valid_indices]
        
        if len(set(valid_labels)) > 1:
            silhouette = silhouette_score(valid_data, valid_labels)
            calinski = calinski_harabasz_score(valid_data, valid_labels)
            davies = davies_bouldin_score(valid_data, valid_labels)
        else:
            silhouette = 0
            calinski = 0
            davies = 0
        
        cluster_sizes = {}
        for label in set(self.cluster_labels):
            cluster_sizes[str(label)] = int(list(self.cluster_labels).count(label))
        
        self.cluster_stats = {
            "n_clusters": n_clusters,
            "cluster_sizes": cluster_sizes,
            "silhouette_score": float(silhouette),
            "calinski_harabasz_score": float(calinski),
            "davies_bouldin_score": float(davies)
        }

    def _perform_pca(self, scaled_data: np.ndarray, n_components: int = 2):
        pca = PCA(n_components=n_components)
        self.pca_result = pca.fit_transform(scaled_data)
        self.explained_variance_ratio = pca.explained_variance_ratio_.tolist()

    def create_cluster_scatter(self, title: str = None,
                                show_centroids: bool = True,
                                color_palette: str = "viridis") -> go.Figure:
        if self.pca_result is None or self.cluster_labels is None:
            raise ValueError("请先执行聚类分析")
        
        plot_df = pd.DataFrame({
            "PC1": self.pca_result[:, 0],
            "PC2": self.pca_result[:, 1],
            "Cluster": self.cluster_labels.astype(str)
        })
        
        fig = px.scatter(
            plot_df,
            x="PC1",
            y="PC2",
            color="Cluster",
            color_discrete_sequence=px.colors.qualitative.Plotly,
            title=title or f"{self.algorithm_used} 聚类结果 (PCA降维)",
            hover_data=["PC1", "PC2", "Cluster"]
        )
        
        if show_centroids and self.algorithm_used in ["K-Means"]:
            for cluster in sorted(set(self.cluster_labels)):
                if cluster != -1:
                    mask = self.cluster_labels == cluster
                    centroid_x = plot_df[mask]["PC1"].mean()
                    centroid_y = plot_df[mask]["PC2"].mean()
                    fig.add_annotation(
                        x=centroid_x,
                        y=centroid_y,
                        text=f"●",
                        showarrow=False,
                        font=dict(size=20, color="red"),
                        opacity=0.8
                    )
        
        fig.update_layout(
            xaxis_title=f"PC1 (解释方差: {self.explained_variance_ratio[0]:.2%})",
            yaxis_title=f"PC2 (解释方差: {self.explained_variance_ratio[1]:.2%})",
            height=600,
            template="plotly_white"
        )
        
        return fig

    def create_feature_radar(self, cluster_id: int = 0) -> go.Figure:
        if self.cluster_labels is None or self.data is None:
            raise ValueError("请先执行聚类分析")
        
        numeric_data = self.data[self.numeric_cols].copy()
        scaler = StandardScaler()
        scaled_numeric = scaler.fit_transform(numeric_data)
        
        cluster_mask = self.cluster_labels == cluster_id
        cluster_data = scaled_numeric[cluster_mask]
        overall_data = scaled_numeric
        
        cluster_means = np.mean(cluster_data, axis=0)
        overall_means = np.mean(overall_data, axis=0)
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatterpolar(
            r=cluster_means,
            theta=self.numeric_cols,
            fill="toself",
            name=f"聚类 {cluster_id}",
            line_color="rgba(31, 119, 180, 0.8)"
        ))
        
        fig.add_trace(go.Scatterpolar(
            r=overall_means,
            theta=self.numeric_cols,
            fill="toself",
            name="整体平均值",
            line_color="rgba(255, 127, 14, 0.8)"
        ))
        
        fig.update_layout(
            polar=dict(radialaxis=dict(visible=True, range=[-2, 2])),
            showlegend=True,
            title=f"聚类 {cluster_id} 特征雷达图",
            height=500
        )
        
        return fig

    def create_cluster_boxplots(self) -> go.Figure:
        if self.cluster_labels is None or self.data is None:
            raise ValueError("请先执行聚类分析")
        
        numeric_data = self.data[self.numeric_cols].copy()
        numeric_data["Cluster"] = self.cluster_labels.astype(str)
        
        n_cols = len(self.numeric_cols)
        n_rows = (n_cols + 2) // 3
        
        fig = make_subplots(
            rows=n_rows,
            cols=3,
            subplot_titles=self.numeric_cols
        )
        
        colors = px.colors.qualitative.Plotly
        
        for idx, col in enumerate(self.numeric_cols):
            row = idx // 3 + 1
            col_pos = idx % 3 + 1
            
            for cluster_idx, cluster in enumerate(sorted(set(self.cluster_labels))):
                cluster_data = numeric_data[numeric_data["Cluster"] == str(cluster)][col]
                
                fig.add_trace(
                    go.Box(
                        y=cluster_data,
                        name=f"聚类 {cluster}",
                        marker_color=colors[cluster_idx % len(colors)],
                        showlegend=(idx == 0)
                    ),
                    row=row,
                    col=col_pos
                )
        
        fig.update_layout(
            height=300 * n_rows,
            title="各聚类特征分布箱线图",
            template="plotly_white"
        )
        
        return fig

    def create_elbow_plot(self, max_clusters: int = 10,
                           columns: Optional[List[str]] = None) -> go.Figure:
        scaled_data, _ = self._prepare_data(columns)
        
        inertias = []
        silhouette_scores = []
        k_range = range(2, max_clusters + 1)
        
        for k in k_range:
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = kmeans.fit_predict(scaled_data)
            inertias.append(kmeans.inertia_)
            silhouette_scores.append(silhouette_score(scaled_data, labels))
        
        fig = make_subplots(specs=[[{"secondary_y": True}]])
        
        fig.add_trace(
            go.Scatter(x=list(k_range), y=inertias, name="Inertia", mode="lines+markers"),
            secondary_y=False
        )
        
        fig.add_trace(
            go.Scatter(x=list(k_range), y=silhouette_scores, name="Silhouette Score", mode="lines+markers"),
            secondary_y=True
        )
        
        fig.update_layout(
            title="K-Means 肘部法则分析",
            xaxis_title="聚类数量 (k)",
            height=500,
            template="plotly_white"
        )
        
        fig.update_yaxes(title_text="Inertia", secondary_y=False)
        fig.update_yaxes(title_text="Silhouette Score", secondary_y=True)
        
        return fig

    def get_clustered_data(self) -> pd.DataFrame:
        if self.cluster_labels is None or self.data is None:
            raise ValueError("请先执行聚类分析")
        
        result_df = self.data.copy()
        result_df["cluster"] = self.cluster_labels
        return result_df

    def get_cluster_summary(self) -> pd.DataFrame:
        if self.cluster_labels is None or self.data is None:
            raise ValueError("请先执行聚类分析")
        
        result_df = self.data.copy()
        result_df["cluster"] = self.cluster_labels
        
        summary = result_df.groupby("cluster")[self.numeric_cols].agg(["mean", "std", "count"])
        return summary
