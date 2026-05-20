import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN
from sklearn.decomposition import PCA
from scipy import stats
from scipy.stats import pearsonr, spearmanr, kendalltau
import networkx as nx


class CorrelationAnalyzer:
    def __init__(self, data: Optional[pd.DataFrame] = None):
        self.data = data
        self.numeric_cols: List[str] = []
        self.categorical_cols: List[str] = []
        if data is not None:
            self._identify_column_types()

    def set_data(self, data: pd.DataFrame):
        self.data = data.copy()
        self._identify_column_types()

    def _identify_column_types(self):
        if self.data is None:
            return
        
        self.numeric_cols = self.data.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_cols = self.data.select_dtypes(exclude=[np.number]).columns.tolist()

    def compute_correlation_matrix(self, method: str = "pearson", min_valid_samples: int = 5) -> pd.DataFrame:
        if self.data is None or len(self.numeric_cols) < 2:
            raise ValueError("需要至少两列数值型数据")
        
        numeric_data = self.data[self.numeric_cols].copy()
        valid_data = numeric_data.dropna(how='all')
        
        if method == "pearson":
            corr_matrix = valid_data.corr(method="pearson", min_periods=min_valid_samples)
        elif method == "spearman":
            corr_matrix = valid_data.corr(method="spearman", min_periods=min_valid_samples)
        elif method == "kendall":
            corr_matrix = valid_data.corr(method="kendall", min_periods=min_valid_samples)
        else:
            raise ValueError(f"不支持的相关系数方法: {method}")
        
        corr_matrix = corr_matrix.fillna(0)
        return corr_matrix

    def get_high_correlations(self, threshold: float = 0.7, 
                              method: str = "pearson") -> List[Dict[str, Any]]:
        corr_matrix = self.compute_correlation_matrix(method)
        high_corr = []
        
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if pd.notna(corr_value) and abs(corr_value) >= threshold:
                    high_corr.append({
                        "variable1": corr_matrix.columns[i],
                        "variable2": corr_matrix.columns[j],
                        "correlation": corr_value,
                        "abs_correlation": abs(corr_value)
                    })
        
        high_corr.sort(key=lambda x: x["abs_correlation"], reverse=True)
        return high_corr

    def compute_pairwise_correlation(self, col1: str, col2: str, 
                                     method: str = "pearson") -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        valid_data = self.data[[col1, col2]].dropna()
        n_samples = len(valid_data)
        
        if n_samples < 5:
            return {
                "correlation": np.nan,
                "p_value": np.nan,
                "significant": False,
                "n_samples": n_samples,
                "warning": "有效样本数不足"
            }
        
        x = valid_data[col1]
        y = valid_data[col2]
        
        with np.errstate(invalid='ignore'):
            if method == "pearson":
                corr, p_value = pearsonr(x, y)
            elif method == "spearman":
                corr, p_value = spearmanr(x, y)
            elif method == "kendall":
                corr, p_value = kendalltau(x, y)
            else:
                raise ValueError(f"不支持的相关系数方法: {method}")
        
        if np.isnan(corr):
            corr = 0.0
        if np.isnan(p_value):
            p_value = 1.0
        
        return {
            "correlation": corr,
            "p_value": p_value,
            "significant": p_value < 0.05,
            "n_samples": n_samples
        }

    def kmeans_clustering(self, n_clusters: int = 3, 
                          columns: Optional[List[str]] = None,
                          random_state: int = 42) -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.numeric_cols
        if len(target_cols) < 1:
            raise ValueError("需要数值型列进行聚类")
        
        data_for_clustering = self.data[target_cols].dropna()
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=10)
        labels = kmeans.fit_predict(data_for_clustering)
        
        result_data = self.data.copy()
        result_data["cluster"] = -1
        result_data.loc[data_for_clustering.index, "cluster"] = labels
        
        cluster_stats = {}
        for cluster in range(n_clusters):
            cluster_data = result_data[result_data["cluster"] == cluster]
            cluster_stats[cluster] = {
                "size": len(cluster_data),
                "centroid": kmeans.cluster_centers_[cluster].tolist(),
                "columns": target_cols
            }
        
        return {
            "labels": labels.tolist(),
            "cluster_data": result_data,
            "cluster_stats": cluster_stats,
            "inertia": kmeans.inertia_,
            "columns_used": target_cols
        }

    def hierarchical_clustering(self, n_clusters: int = 3,
                                columns: Optional[List[str]] = None,
                                linkage: str = "ward") -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.numeric_cols
        data_for_clustering = self.data[target_cols].dropna()
        
        hc = AgglomerativeClustering(n_clusters=n_clusters, linkage=linkage)
        labels = hc.fit_predict(data_for_clustering)
        
        result_data = self.data.copy()
        result_data["cluster"] = -1
        result_data.loc[data_for_clustering.index, "cluster"] = labels
        
        cluster_stats = {}
        for cluster in range(n_clusters):
            cluster_data = result_data[result_data["cluster"] == cluster]
            cluster_stats[cluster] = {
                "size": len(cluster_data)
            }
        
        return {
            "labels": labels.tolist(),
            "cluster_data": result_data,
            "cluster_stats": cluster_stats,
            "columns_used": target_cols
        }

    def dbscan_clustering(self, eps: float = 0.5,
                          min_samples: int = 5,
                          columns: Optional[List[str]] = None) -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.numeric_cols
        data_for_clustering = self.data[target_cols].dropna()
        
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data_for_clustering)
        
        dbscan = DBSCAN(eps=eps, min_samples=min_samples)
        labels = dbscan.fit_predict(data_scaled)
        
        result_data = self.data.copy()
        result_data["cluster"] = -1
        result_data.loc[data_for_clustering.index, "cluster"] = labels
        
        unique_clusters = set(labels)
        cluster_stats = {}
        for cluster in unique_clusters:
            cluster_data = result_data[result_data["cluster"] == cluster]
            cluster_stats[str(cluster)] = {
                "size": len(cluster_data),
                "is_noise": cluster == -1
            }
        
        return {
            "labels": labels.tolist(),
            "cluster_data": result_data,
            "cluster_stats": cluster_stats,
            "n_clusters": len([c for c in unique_clusters if c != -1]),
            "n_noise": list(labels).count(-1),
            "columns_used": target_cols
        }

    def pca_analysis(self, n_components: int = 2,
                     columns: Optional[List[str]] = None) -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        target_cols = columns if columns else self.numeric_cols
        data_for_pca = self.data[target_cols].dropna()
        
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        data_scaled = scaler.fit_transform(data_for_pca)
        
        pca = PCA(n_components=n_components)
        pca_result = pca.fit_transform(data_scaled)
        
        result_data = self.data.copy()
        for i in range(n_components):
            result_data[f"PC{i+1}"] = np.nan
            result_data.loc[data_for_pca.index, f"PC{i+1}"] = pca_result[:, i]
        
        return {
            "pca_data": result_data,
            "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
            "cumulative_variance_ratio": np.cumsum(pca.explained_variance_ratio_).tolist(),
            "components": pca.components_.tolist(),
            "feature_names": target_cols,
            "columns_used": target_cols
        }

    def build_correlation_network(self, threshold: float = 0.5,
                                  method: str = "pearson") -> Dict[str, Any]:
        corr_matrix = self.compute_correlation_matrix(method)
        
        G = nx.Graph()
        
        for col in corr_matrix.columns:
            G.add_node(col)
        
        for i in range(len(corr_matrix.columns)):
            for j in range(i + 1, len(corr_matrix.columns)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) >= threshold:
                    G.add_edge(
                        corr_matrix.columns[i],
                        corr_matrix.columns[j],
                        weight=abs(corr_value),
                        correlation=corr_value,
                        positive=corr_value > 0
                    )
        
        degrees = dict(G.degree())
        centrality = nx.degree_centrality(G)
        
        return {
            "graph": G,
            "nodes": list(G.nodes()),
            "edges": [
                {
                    "source": u,
                    "target": v,
                    "weight": d["weight"],
                    "correlation": d["correlation"],
                    "positive": d["positive"]
                }
                for u, v, d in G.edges(data=True)
            ],
            "node_degrees": degrees,
            "centrality": centrality,
            "n_components": nx.number_connected_components(G)
        }

    def causal_inference_simple(self, target_col: str,
                                feature_cols: Optional[List[str]] = None) -> Dict[str, Any]:
        if self.data is None:
            raise ValueError("请先设置数据")
        
        features = feature_cols if feature_cols else [c for c in self.numeric_cols if c != target_col]
        
        results = {}
        for feature in features:
            corr_result = self.compute_pairwise_correlation(feature, target_col)
            
            x = self.data[feature].dropna()
            y = self.data[target_col].dropna()
            common_idx = x.index.intersection(y.index)
            
            if len(common_idx) > 0:
                slope, intercept, r_value, p_value, std_err = stats.linregress(
                    x.loc[common_idx], y.loc[common_idx]
                )
                
                results[feature] = {
                    "correlation": corr_result["correlation"],
                    "p_value": p_value,
                    "slope": slope,
                    "intercept": intercept,
                    "r_squared": r_value ** 2,
                    "significant": p_value < 0.05
                }
        
        sorted_results = dict(sorted(
            results.items(),
            key=lambda x: abs(x[1]["correlation"]),
            reverse=True
        ))
        
        return {
            "target": target_col,
            "features": sorted_results,
            "top_predictors": list(sorted_results.keys())[:5]
        }

    def get_analysis_report(self) -> Dict[str, Any]:
        if self.data is None:
            return {"status": "无数据"}
        
        return {
            "data_shape": self.data.shape,
            "numeric_columns": self.numeric_cols,
            "categorical_columns": self.categorical_cols,
            "correlation_matrix_pearson": self.compute_correlation_matrix("pearson").to_dict() if len(self.numeric_cols) >= 2 else None
        }
