import pandas as pd
import numpy as np
from typing import Dict, Any, List, Set, Tuple, Optional
from itertools import combinations
from collections import defaultdict
import plotly.graph_objects as go
import plotly.express as px


class Apriori:
    """Apriori算法 - 挖掘频繁项集与关联规则"""

    def __init__(self, min_support: float = 0.1, min_confidence: float = 0.5,
                 min_lift: float = 1.0, max_len: int = 5):
        self.min_support = min_support
        self.min_confidence = min_confidence
        self.min_lift = min_lift
        self.max_len = max_len
        self.transaction_count: int = 0
        self.frequent_itemsets: Dict[frozenset, float] = {}
        self.rules: List[Dict[str, Any]] = []

    def _create_c1(self, transactions: List[Set]) -> Dict[frozenset, int]:
        """创建大小为1的候选项集"""
        c1 = defaultdict(int)
        for transaction in transactions:
            for item in transaction:
                c1[frozenset([item])] += 1
        return dict(c1)

    def _prune(self, candidates: Dict[frozenset, int]) -> Dict[frozenset, float]:
        """剪枝 - 保留满足最小支持度的项集"""
        pruned = {}
        for itemset, count in candidates.items():
            support = count / self.transaction_count
            if support >= self.min_support:
                pruned[itemset] = support
        return pruned

    def _apriori_gen(self, frequent_itemsets: List[frozenset], k: int) -> Dict[frozenset, int]:
        """生成K项候选项集"""
        candidates = defaultdict(int)

        # 连接步：合并频繁k-1项集
        for i in range(len(frequent_itemsets)):
            for j in range(i + 1, len(frequent_itemsets)):
                itemset1 = sorted(list(frequent_itemsets[i]))
                itemset2 = sorted(list(frequent_itemsets[j]))

                if itemset1[:k - 2] == itemset2[:k - 2]:
                    new_itemset = frozenset(itemset1 + itemset2)
                    # 剪枝步：检查所有子集是否都频繁
                    all_subsets_frequent = True
                    for subset in combinations(new_itemset, k - 1):
                        if frozenset(subset) not in self.frequent_itemsets:
                            all_subsets_frequent = False
                            break

                    if all_subsets_frequent:
                        candidates[new_itemset] = 0

        return dict(candidates)

    def _count_support(self, transactions: List[Set], candidates: Dict[frozenset, int]
                       ) -> Dict[frozenset, int]:
        """计算候选项集的支持度计数"""
        for transaction in transactions:
            for candidate in candidates:
                if candidate.issubset(transaction):
                    candidates[candidate] += 1
        return candidates

    def fit(self, transactions: List[Set]) -> 'Apriori':
        """执行Apriori算法"""
        self.transaction_count = len(transactions)
        self.frequent_itemsets = {}

        # 第1步：生成大小为1的频繁项集
        c1 = self._create_c1(transactions)
        l1 = self._prune(c1)
        self.frequent_itemsets.update(l1)

        # 第2步：迭代生成更大的项集
        k = 2
        current_frequent = list(l1.keys())

        while current_frequent and k <= self.max_len:
            # 生成候选项集
            ck = self._apriori_gen(current_frequent, k)

            if not ck:
                break

            # 计算支持度并剪枝
            ck = self._count_support(transactions, ck)
            lk = self._prune(ck)

            if not lk:
                break

            self.frequent_itemsets.update(lk)
            current_frequent = list(lk.keys())
            k += 1

        # 生成关联规则
        self._generate_rules()
        return self

    def _generate_rules(self):
        """从频繁项集生成关联规则"""
        self.rules = []

        for itemset in self.frequent_itemsets:
            if len(itemset) < 2:
                continue

            # 生成所有可能的规则
            for i in range(1, len(itemset)):
                for antecedent in combinations(itemset, i):
                    antecedent_set = frozenset(antecedent)
                    consequent_set = itemset - antecedent_set

                    if len(consequent_set) == 0:
                        continue

                    # 计算置信度
                    confidence = (self.frequent_itemsets[itemset] /
                                  self.frequent_itemsets[antecedent_set])

                    if confidence >= self.min_confidence:
                        # 计算提升度
                        lift = confidence / self.frequent_itemsets[consequent_set]

                        if lift >= self.min_lift:
                            # 计算其他指标
                            support = self.frequent_itemsets[itemset]
                            leverage = support - (
                                    self.frequent_itemsets[antecedent_set] *
                                    self.frequent_itemsets[consequent_set]
                            )

                            conviction = float('inf')
                            if confidence < 1:
                                conviction = (1 - self.frequent_itemsets[consequent_set]) / (1 - confidence)

                            self.rules.append({
                                'antecedent': set(antecedent_set),
                                'consequent': set(consequent_set),
                                'antecedent_str': ' & '.join(sorted(antecedent_set)),
                                'consequent_str': ' & '.join(sorted(consequent_set)),
                                'support': support,
                                'confidence': confidence,
                                'lift': lift,
                                'leverage': leverage,
                                'conviction': conviction,
                                'rule_length': len(antecedent_set) + len(consequent_set)
                            })

        # 按提升度排序
        self.rules.sort(key=lambda x: x['lift'], reverse=True)

    def get_frequent_itemsets(self, min_len: int = 1) -> pd.DataFrame:
        """获取频繁项集"""
        itemsets_list = []
        for itemset, support in self.frequent_itemsets.items():
            if len(itemset) >= min_len:
                itemsets_list.append({
                    'items': set(itemset),
                    'items_str': ' & '.join(sorted(itemset)),
                    'support': support,
                    'length': len(itemset)
                })

        df = pd.DataFrame(itemsets_list)
        if not df.empty:
            df = df.sort_values('support', ascending=False)
        return df

    def get_rules(self, top_n: Optional[int] = None) -> pd.DataFrame:
        """获取关联规则"""
        if not self.rules:
            return pd.DataFrame()

        df = pd.DataFrame(self.rules)
        if top_n:
            df = df.head(top_n)
        return df

    def filter_rules(self, min_lift: Optional[float] = None,
                     min_confidence: Optional[float] = None,
                     contains_antecedent: Optional[Set] = None,
                     contains_consequent: Optional[Set] = None) -> pd.DataFrame:
        """过滤规则"""
        df = pd.DataFrame(self.rules)

        if min_lift is not None:
            df = df[df['lift'] >= min_lift]
        if min_confidence is not None:
            df = df[df['confidence'] >= min_confidence]
        if contains_antecedent:
            df = df[df['antecedent'].apply(lambda x: contains_antecedent.issubset(x))]
        if contains_consequent:
            df = df[df['consequent'].apply(lambda x: contains_consequent.issubset(x))]

        return df


class RuleMiner:
    """增强的关联规则挖掘器"""

    def __init__(self, dataframe: pd.DataFrame = None):
        self.df = dataframe
        self.apriori: Optional[Apriori] = None
        self.transactions: List[Set] = []

    def prepare_transactions(self, columns: Optional[List[str]] = None,
                              categorical_cols: Optional[List[str]] = None,
                              numeric_bins: int = 3) -> List[Set]:
        """将DataFrame转换为事务格式"""
        if self.df is None:
            raise ValueError("请先设置DataFrame")

        df = self.df.copy()
        self.transactions = []

        target_cols = columns or df.columns.tolist()

        for _, row in df[target_cols].iterrows():
            transaction = set()
            for col in target_cols:
                val = row[col]
                if col in (categorical_cols or []):
                    transaction.add(f"{col}={val}")
                elif pd.api.types.is_numeric_dtype(df[col].dtype):
                    # 数值型分箱
                    bin_label = pd.qcut(df[col], numeric_bins, duplicates='drop').cat.categories[
                        pd.qcut(df[col], numeric_bins, duplicates='drop').cat.codes.loc[_]
                    ]
                    transaction.add(f"{col}:{bin_label}")
                else:
                    transaction.add(f"{col}={val}")
            self.transactions.append(transaction)

        return self.transactions

    def from_list(self, transactions: List[List[str]]):
        """从列表格式导入"""
        self.transactions = [set(t) for t in transactions]
        return self

    def mine_rules(self, min_support: float = 0.1, min_confidence: float = 0.5,
                   min_lift: float = 1.0, max_len: int = 5) -> pd.DataFrame:
        """挖掘关联规则"""
        self.apriori = Apriori(
            min_support=min_support,
            min_confidence=min_confidence,
            min_lift=min_lift,
            max_len=max_len
        )
        self.apriori.fit(self.transactions)
        return self.apriori.get_rules()

    def visualize_rules(self, top_n: int = 20,
                        x_axis: str = 'support',
                        y_axis: str = 'confidence',
                        size_by: str = 'lift') -> go.Figure:
        """可视化关联规则"""
        if not self.apriori:
            raise ValueError("请先运行挖掘")

        rules_df = self.apriori.get_rules(top_n)

        if rules_df.empty:
            return go.Figure().update_layout(title="没有找到关联规则")

        # 创建规则标签
        rules_df['label'] = rules_df.apply(
            lambda row: f"{row['antecedent_str']} → {row['consequent_str']}", axis=1
        )

        fig = px.scatter(
            rules_df,
            x=x_axis,
            y=y_axis,
            size=size_by,
            color='lift',
            hover_data=['support', 'confidence', 'lift', 'leverage', 'conviction'],
            text='label',
            title='关联规则可视化',
            template='plotly_white'
        )

        fig.update_layout(
            height=700,
            xaxis_title=x_axis.capitalize(),
            yaxis_title=y_axis.capitalize(),
            showlegend=True
        )

        return fig

    def itemsets_network(self, top_n: int = 30) -> go.Figure:
        """频繁项集网络关系图"""
        if not self.apriori:
            raise ValueError("请先运行挖掘")

        itemsets_df = self.apriori.get_frequent_itemsets(min_len=2).head(top_n)

        if itemsets_df.empty:
            return go.Figure().update_layout(title="没有足够的频繁项集")

        # 构建边
        edges = []
        for _, row in itemsets_df.iterrows():
            items = sorted(list(row['items']))
            for i in range(len(items)):
                for j in range(i + 1, len(items)):
                    edges.append({
                        'source': items[i],
                        'target': items[j],
                        'weight': row['support'],
                        'lift': row.get('support', 0)
                    })

        # 生成节点
        all_items = set()
        for _, row in itemsets_df.iterrows():
            all_items.update(row['items'])
        nodes = list(all_items)

        # 创建可视化
        edge_x = []
        edge_y = []
        pos = {node: (np.random.rand(), np.random.rand()) for node in nodes}

        for edge in edges:
            x0, y0 = pos[edge['source']]
            x1, y1 = pos[edge['target']]
            edge_x.extend([x0, x1, None])
            edge_y.extend([y0, y1, None])

        edge_trace = go.Scatter(
            x=edge_x, y=edge_y,
            line=dict(width=0.5, color='#888'),
            hoverinfo='none',
            mode='lines'
        )

        node_x = [pos[node][0] for node in nodes]
        node_y = [pos[node][1] for node in nodes]

        node_trace = go.Scatter(
            x=node_x, y=node_y,
            mode='markers+text',
            hoverinfo='text',
            marker=dict(
                showscale=True,
                colorscale='YlGnBu',
                size=10 + np.log([sum(1 for e in edges if e['source'] == n or e['target'] == n) or 1 for n in nodes]) * 10,
                line_width=2
            ),
            text=nodes,
            textposition="top center"
        )

        fig = go.Figure(data=[edge_trace, node_trace],
                       layout=go.Layout(
                           title='频繁项集关联网络',
                           showlegend=False,
                           hovermode='closest',
                           height=600,
                           template='plotly_white'
                       ))

        return fig

    def get_top_recommendations(self, item: str, top_n: int = 5) -> pd.DataFrame:
        """获取某个商品的推荐"""
        if not self.apriori:
            raise ValueError("请先运行挖掘")

        item_set = {item}
        rules = self.apriori.filter_rules(contains_antecedent=item_set)

        if rules.empty:
            return pd.DataFrame(columns=['consequent', 'confidence', 'lift', 'support'])

        return rules[['consequent_str', 'confidence', 'lift', 'support']].head(top_n)

    def get_summary(self) -> Dict[str, Any]:
        """获取挖掘摘要"""
        if not self.apriori:
            return {'status': '未执行挖掘'}

        itemsets_df = self.apriori.get_frequent_itemsets()
        rules_df = self.apriori.get_rules()

        return {
            'total_transactions': self.apriori.transaction_count,
            'total_frequent_itemsets': len(itemsets_df),
            'total_rules': len(rules_df),
            'avg_lift': rules_df['lift'].mean() if not rules_df.empty else 0,
            'avg_confidence': rules_df['confidence'].mean() if not rules_df.empty else 0,
            'max_itemset_length': itemsets_df['length'].max() if not itemsets_df.empty else 0
        }
