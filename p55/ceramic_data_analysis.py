import numpy as np
import pandas as pd
import json
import os
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime
from collections import defaultdict
from scipy import stats
from scipy.stats import ttest_ind, f_oneway
from simulation import FiringConfig
from numerics import NumericalUtils


@dataclass
class HistoricalFiringRecord:
    batch_id: str
    clay_type: str
    glaze_type: str
    target_temp: float
    heating_rate: float
    holding_time: float
    cooling_rate: float
    atmosphere: str
    success_rate: float
    quality_score: float
    defects: List[str] = field(default_factory=list)
    notes: str = ""
    firing_date: str = ""
    operator: str = ""
    kiln_id: str = ""
    actual_curve: Optional[Dict[str, List[float]]] = None


@dataclass
class ProcessScheme:
    scheme_id: str
    scheme_name: str
    config: FiringConfig
    recommended_clay: List[str]
    recommended_glaze: List[str]
    expected_quality: float
    confidence_level: float
    basis_batches: List[str]
    optimization_goals: Dict[str, float]
    constraints: Dict[str, Tuple[float, float]]


class HistoricalDataInterface:
    def __init__(self, data_dir: str = "historical_data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.records: Dict[str, HistoricalFiringRecord] = {}
        self._load_all_records()

    def _load_all_records(self):
        json_path = os.path.join(self.data_dir, "firing_records.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for record_data in data:
                        record = HistoricalFiringRecord(
                            batch_id=record_data['batch_id'],
                            clay_type=record_data['clay_type'],
                            glaze_type=record_data.get('glaze_type', 'default'),
                            target_temp=record_data['target_temp'],
                            heating_rate=record_data['heating_rate'],
                            holding_time=record_data['holding_time'],
                            cooling_rate=record_data['cooling_rate'],
                            atmosphere=record_data.get('atmosphere', 'oxidation'),
                            success_rate=record_data.get('success_rate', 80.0),
                            quality_score=record_data.get('quality_score', 7.0),
                            defects=record_data.get('defects', []),
                            notes=record_data.get('notes', ''),
                            firing_date=record_data.get('firing_date', ''),
                            operator=record_data.get('operator', ''),
                            kiln_id=record_data.get('kiln_id', 'K1'),
                            actual_curve=record_data.get('actual_curve')
                        )
                        self.records[record.batch_id] = record
            except Exception as e:
                print(f"加载历史数据失败: {e}")

    def _save_all_records(self):
        json_path = os.path.join(self.data_dir, "firing_records.json")
        data_list = []
        for record in self.records.values():
            record_dict = asdict(record)
            data_list.append(record_dict)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data_list, f, indent=2, ensure_ascii=False)

    def import_single_record(self, record: HistoricalFiringRecord) -> bool:
        if record.batch_id in self.records:
            print(f"警告: 批次 {record.batch_id} 已存在，将被覆盖")
        self.records[record.batch_id] = record
        self._save_all_records()
        return True

    def import_batch_records(self, records: List[HistoricalFiringRecord]) -> int:
        count = 0
        for record in records:
            self.records[record.batch_id] = record
            count += 1
        self._save_all_records()
        return count

    def import_from_csv(self, csv_path: str) -> int:
        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"CSV文件不存在: {csv_path}")

        df = pd.read_csv(csv_path)
        imported = 0

        for _, row in df.iterrows():
            batch_id = row.get('batch_id', f"B{len(self.records) + imported:04d}")
            if isinstance(batch_id, (int, float)):
                batch_id = f"B{int(batch_id):04d}"

            record = HistoricalFiringRecord(
                batch_id=str(batch_id),
                clay_type=str(row.get('clay_type', 'porcelain')),
                glaze_type=str(row.get('glaze_type', 'default')),
                target_temp=float(row.get('target_temp', 1280.0)),
                heating_rate=float(row.get('heating_rate', 150.0)),
                holding_time=float(row.get('holding_time', 120.0)),
                cooling_rate=float(row.get('cooling_rate', 100.0)),
                atmosphere=str(row.get('atmosphere', 'oxidation')),
                success_rate=float(row.get('success_rate', 80.0)),
                quality_score=float(row.get('quality_score', 7.0)),
                defects=str(row.get('defects', '')).split(',') if pd.notna(row.get('defects')) else [],
                notes=str(row.get('notes', '')),
                firing_date=str(row.get('firing_date', datetime.now().strftime('%Y-%m-%d'))),
                operator=str(row.get('operator', '')),
                kiln_id=str(row.get('kiln_id', 'K1'))
            )
            self.records[record.batch_id] = record
            imported += 1

        self._save_all_records()
        return imported

    def generate_demo_data(self, n_batches: int = 50) -> int:
        clay_types = ['porcelain', 'stoneware', 'earthenware', 'bone_china']
        glaze_types = ['transparent', 'celadon', 'white', 'black', 'blue', 'red']
        atmospheres = ['oxidation', 'reduction', 'neutral']
        defects_list = ['cracking', 'blistering', 'crawling', 'pinholes', 'glaze_run', 'deformation']

        np.random.seed(42)
        records = []

        for i in range(n_batches):
            clay = np.random.choice(clay_types, p=[0.4, 0.3, 0.2, 0.1])
            base_temp = {'porcelain': 1280, 'stoneware': 1250, 'earthenware': 1100, 'bone_china': 1260}[clay]
            base_heating = {'porcelain': 150, 'stoneware': 120, 'earthenware': 100, 'bone_china': 130}[clay]

            temp_variation = np.random.normal(0, 25)
            heating_variation = np.random.normal(0, 15)

            success_rate = np.clip(85 + np.random.normal(0, 10) - abs(temp_variation) * 0.3, 30, 100)
            quality_score = np.clip(7.5 + np.random.normal(0, 1.0) - abs(heating_variation) * 0.02, 3, 10)

            n_defects = np.random.poisson(max(0, (10 - quality_score) / 2))
            defects = np.random.choice(defects_list, min(n_defects, 3), replace=False).tolist()

            record = HistoricalFiringRecord(
                batch_id=f"DEMO_B{i + 1:03d}",
                clay_type=clay,
                glaze_type=np.random.choice(glaze_types),
                target_temp=base_temp + temp_variation,
                heating_rate=base_heating + heating_variation,
                holding_time=90 + np.random.normal(0, 30),
                cooling_rate=80 + np.random.normal(0, 20),
                atmosphere=np.random.choice(atmospheres, p=[0.6, 0.3, 0.1]),
                success_rate=success_rate,
                quality_score=quality_score,
                defects=defects,
                notes=f"自动生成的演示批次数据 #{i+1}",
                firing_date=f"2025-{np.random.randint(1,13):02d}-{np.random.randint(1,29):02d}",
                operator=np.random.choice(['张工', '李工', '王工', '赵工']),
                kiln_id=np.random.choice(['K1', 'K2', 'K3'])
            )
            records.append(record)

        return self.import_batch_records(records)

    def query_records(self, **filters) -> List[HistoricalFiringRecord]:
        results = list(self.records.values())

        for key, value in filters.items():
            if key == 'clay_type':
                results = [r for r in results if r.clay_type == value]
            elif key == 'atmosphere':
                results = [r for r in results if r.atmosphere == value]
            elif key == 'min_success_rate':
                results = [r for r in results if r.success_rate >= value]
            elif key == 'min_quality':
                results = [r for r in results if r.quality_score >= value]
            elif key == 'kiln_id':
                results = [r for r in results if r.kiln_id == value]

        return results

    def get_statistics_summary(self) -> Dict[str, Any]:
        if not self.records:
            return {'total_records': 0}

        records_list = list(self.records.values())

        stats = {
            'total_records': len(records_list),
            'date_range': {
                'earliest': min(r.firing_date for r in records_list if r.firing_date),
                'latest': max(r.firing_date for r in records_list if r.firing_date)
            },
            'by_clay_type': {},
            'by_atmosphere': {},
            'quality_metrics': {
                'avg_success_rate': np.mean([r.success_rate for r in records_list]),
                'std_success_rate': np.std([r.success_rate for r in records_list]),
                'avg_quality_score': np.mean([r.quality_score for r in records_list]),
                'std_quality_score': np.std([r.quality_score for r in records_list])
            },
            'top_batches': sorted(records_list, key=lambda x: x.quality_score, reverse=True)[:5],
            'common_defects': self._get_defect_statistics(records_list)
        }

        for clay in set(r.clay_type for r in records_list):
            clay_records = [r for r in records_list if r.clay_type == clay]
            stats['by_clay_type'][clay] = {
                'count': len(clay_records),
                'avg_success': np.mean([r.success_rate for r in clay_records]),
                'avg_quality': np.mean([r.quality_score for r in clay_records]),
                'avg_temp': np.mean([r.target_temp for r in clay_records])
            }

        for atm in set(r.atmosphere for r in records_list):
            atm_records = [r for r in records_list if r.atmosphere == atm]
            stats['by_atmosphere'][atm] = {
                'count': len(atm_records),
                'avg_success': np.mean([r.success_rate for r in atm_records]),
                'avg_quality': np.mean([r.quality_score for r in atm_records])
            }

        return stats

    def _get_defect_statistics(self, records: List[HistoricalFiringRecord]) -> Dict[str, int]:
        defect_counts = defaultdict(int)
        for record in records:
            for defect in record.defects:
                if defect:
                    defect_counts[defect.strip()] += 1
        return dict(sorted(defect_counts.items(), key=lambda x: -x[1]))


class ProcessSchemeGenerator:
    def __init__(self, data_interface: HistoricalDataInterface):
        self.data_interface = data_interface

    def generate_scheme(self, target_clay: str, target_glaze: str = "default",
                        optimization_goal: str = "quality",
                        constraints: Optional[Dict[str, Tuple[float, float]]] = None) -> ProcessScheme:
        if constraints is None:
            constraints = {
                'target_temp': (1000, 1400),
                'heating_rate': (50, 300),
                'holding_time': (30, 240),
                'cooling_rate': (30, 200)
            }

        similar_records = self.data_interface.query_records(clay_type=target_clay)

        if not similar_records:
            similar_records = list(self.data_interface.records.values())[:10]

        if optimization_goal == "quality":
            top_records = sorted(similar_records, key=lambda x: x.quality_score, reverse=True)[:10]
        elif optimization_goal == "success_rate":
            top_records = sorted(similar_records, key=lambda x: x.success_rate, reverse=True)[:10]
        elif optimization_goal == "energy":
            top_records = sorted(similar_records, key=lambda x: x.target_temp * x.holding_time)[:10]
        elif optimization_goal == "speed":
            total_time = lambda r: (r.target_temp - 25) / r.heating_rate * 60 + r.holding_time + (r.target_temp - 25) / r.cooling_rate * 60
            top_records = sorted(similar_records, key=total_time)[:10]
        else:
            top_records = sorted(similar_records, key=lambda x: x.quality_score, reverse=True)[:10]

        if not top_records:
            top_records = similar_records[:5] if similar_records else []

        if top_records:
            optimized_params = self._optimize_parameters(top_records, constraints, optimization_goal)
            expected_quality = np.mean([r.quality_score for r in top_records])
            confidence = min(0.95, len(top_records) / 15)
        else:
            optimized_params = {
                'target_temp': 1280.0,
                'heating_rate': 150.0,
                'holding_time': 120.0,
                'cooling_rate': 100.0
            }
            expected_quality = 7.0
            confidence = 0.5

        config = FiringConfig(
            target_temp=optimized_params['target_temp'],
            heating_rate=optimized_params['heating_rate'],
            holding_time=optimized_params['holding_time'],
            cooling_rate=optimized_params['cooling_rate'],
            clay_type=target_clay,
            atmosphere=self._recommend_atmosphere(target_clay, top_records)
        )

        scheme_id = f"SCHEME_{target_clay.upper()}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        return ProcessScheme(
            scheme_id=scheme_id,
            scheme_name=f"{target_clay}优化工艺方案",
            config=config,
            recommended_clay=[target_clay],
            recommended_glaze=[target_glaze],
            expected_quality=expected_quality,
            confidence_level=confidence,
            basis_batches=[r.batch_id for r in top_records],
            optimization_goals={optimization_goal: 1.0},
            constraints=constraints
        )

    def _optimize_parameters(self, records: List[HistoricalFiringRecord],
                            constraints: Dict[str, Tuple[float, float]],
                            goal: str) -> Dict[str, float]:
        def weighted_avg(values, weights):
            if sum(weights) == 0:
                return np.mean(values)
            return np.average(values, weights=weights)

        if goal == "quality":
            weights = [r.quality_score for r in records]
        elif goal == "success_rate":
            weights = [r.success_rate for r in records]
        elif goal == "energy":
            weights = [1 / (1 + r.target_temp * r.holding_time / 100000) for r in records]
        else:
            weights = [1.0 for _ in records]

        params = {
            'target_temp': weighted_avg([r.target_temp for r in records], weights),
            'heating_rate': weighted_avg([r.heating_rate for r in records], weights),
            'holding_time': weighted_avg([r.holding_time for r in records], weights),
            'cooling_rate': weighted_avg([r.cooling_rate for r in records], weights)
        }

        for key, (min_val, max_val) in constraints.items():
            params[key] = np.clip(params[key], min_val, max_val)

        return params

    def _recommend_atmosphere(self, clay_type: str, records: List[HistoricalFiringRecord]) -> str:
        if not records:
            return 'oxidation' if clay_type == 'porcelain' else 'reduction'

        atm_scores = defaultdict(list)
        for r in records:
            atm_scores[r.atmosphere].append(r.quality_score)

        best_atm = max(atm_scores.keys(), key=lambda x: np.mean(atm_scores[x]) if atm_scores[x] else 0)
        return best_atm

    def generate_multiple_schemes(self, target_clay: str,
                                  n_schemes: int = 3) -> List[ProcessScheme]:
        goals = ["quality", "success_rate", "speed", "energy"][:n_schemes]
        schemes = []

        for goal in goals:
            scheme = self.generate_scheme(target_clay, optimization_goal=goal)
            scheme.scheme_name = f"{target_clay}_{goal}_优化方案"
            schemes.append(scheme)

        return schemes

    def evaluate_scheme(self, scheme: ProcessScheme) -> Dict[str, float]:
        similar_records = self.data_interface.query_records(clay_type=scheme.config.clay_type)

        if not similar_records:
            return {
                'expected_success_rate': 80.0,
                'expected_quality': 7.0,
                'risk_level': 0.5
            }

        temp_diff = [abs(scheme.config.target_temp - r.target_temp) for r in similar_records]
        heating_diff = [abs(scheme.config.heating_rate - r.heating_rate) for r in similar_records]

        similarity_scores = 1 / (1 + np.array(temp_diff) / 50 + np.array(heating_diff) / 30)
        best_matches = sorted(zip(similar_records, similarity_scores), key=lambda x: -x[1])[:5]

        expected_success = np.average([r[0].success_rate for r in best_matches],
                                     weights=[r[1] for r in best_matches])
        expected_quality = np.average([r[0].quality_score for r in best_matches],
                                     weights=[r[1] for r in best_matches])

        risk_level = 1 - np.mean([r[1] for r in best_matches])

        return {
            'expected_success_rate': expected_success,
            'expected_quality': expected_quality,
            'risk_level': risk_level,
            'best_match_similarity': max(similarity_scores)
        }

    def export_scheme_to_json(self, scheme: ProcessScheme, output_dir: str = "schemes") -> str:
        os.makedirs(output_dir, exist_ok=True)
        filepath = os.path.join(output_dir, f"{scheme.scheme_id}.json")

        scheme_dict = {
            'scheme_id': scheme.scheme_id,
            'scheme_name': scheme.scheme_name,
            'config': asdict(scheme.config),
            'recommended_clay': scheme.recommended_clay,
            'recommended_glaze': scheme.recommended_glaze,
            'expected_quality': scheme.expected_quality,
            'confidence_level': scheme.confidence_level,
            'basis_batches': scheme.basis_batches,
            'optimization_goals': scheme.optimization_goals,
            'constraints': scheme.constraints,
            'evaluation': self.evaluate_scheme(scheme),
            'generated_at': datetime.now().isoformat()
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(scheme_dict, f, indent=2, ensure_ascii=False)

        return filepath


class MultiBatchAnalyzer:
    def __init__(self, data_interface: HistoricalDataInterface):
        self.data_interface = data_interface

    def compare_batches(self, batch_ids: List[str],
                        metrics: Optional[List[str]] = None) -> Dict[str, Any]:
        if metrics is None:
            metrics = ['target_temp', 'heating_rate', 'holding_time', 'cooling_rate',
                      'success_rate', 'quality_score']

        records = [self.data_interface.records[bid] for bid in batch_ids
                   if bid in self.data_interface.records]

        if not records:
            return {'error': 'No valid batches found'}

        comparison = {
            'batch_ids': batch_ids,
            'n_batches': len(records),
            'metrics': {},
            'statistics': {},
            'correlations': {},
            'recommendations': []
        }

        for metric in metrics:
            values = [getattr(r, metric) for r in records]
            comparison['metrics'][metric] = {
                'values': values,
                'mean': np.mean(values),
                'std': np.std(values),
                'min': min(values),
                'max': max(values),
                'range': max(values) - min(values),
                'cv': np.std(values) / np.mean(values) if np.mean(values) != 0 else 0
            }

        quality_values = [r.quality_score for r in records]
        success_values = [r.success_rate for r in records]

        if len(records) >= 3:
            temp_values = [r.target_temp for r in records]
            heating_values = [r.heating_rate for r in records]

            if len(set(quality_values)) > 1 and len(set(temp_values)) > 1:
                corr_temp_quality, _ = stats.pearsonr(temp_values, quality_values)
                comparison['correlations']['temp_vs_quality'] = corr_temp_quality

            if len(set(quality_values)) > 1 and len(set(heating_values)) > 1:
                corr_heat_quality, _ = stats.pearsonr(heating_values, quality_values)
                comparison['correlations']['heating_vs_quality'] = corr_heat_quality

        best_idx = np.argmax(quality_values)
        best_batch = records[best_idx]

        comparison['recommendations'].append({
            'type': 'BEST_PRACTICE',
            'message': f"推荐参考批次 {best_batch.batch_id}，其品质分数 {best_batch.quality_score:.1f} 最高",
            'reference_batch': best_batch.batch_id,
            'parameters': {
                'target_temp': best_batch.target_temp,
                'heating_rate': best_batch.heating_rate,
                'holding_time': best_batch.holding_time
            }
        })

        if len(records) >= 3:
            high_quality = [r for r in records if r.quality_score >= 8.0]
            if high_quality:
                avg_temp_high = np.mean([r.target_temp for r in high_quality])
                comparison['recommendations'].append({
                    'type': 'PARAMETER_TUNING',
                    'message': f"高品质批次平均烧成温度 {avg_temp_high:.0f}°C",
                    'recommended_temp': avg_temp_high
                })

        comparison['statistics']['overall_quality'] = {
            'top_25_percentile': np.percentile(quality_values, 75),
            'bottom_25_percentile': np.percentile(quality_values, 25),
            'median': np.median(quality_values)
        }

        return comparison

    def trend_analysis(self, start_date: Optional[str] = None,
                       end_date: Optional[str] = None) -> Dict[str, Any]:
        records = list(self.data_interface.records.values())

        if start_date:
            records = [r for r in records if r.firing_date >= start_date]
        if end_date:
            records = [r for r in records if r.firing_date <= end_date]

        records = sorted(records, key=lambda x: x.firing_date)

        if len(records) < 5:
            return {'error': 'Insufficient data for trend analysis'}

        analysis = {
            'time_period': {
                'start': records[0].firing_date,
                'end': records[-1].firing_date,
                'n_batches': len(records)
            },
            'quality_trend': None,
            'success_rate_trend': None,
            'parameter_trends': {},
            'improvement_rate': 0.0,
            'defect_trends': {}
        }

        quality_values = [r.quality_score for r in records]
        success_values = [r.success_rate for r in records]
        x_indices = list(range(len(records)))

        if len(set(quality_values)) > 1:
            q_slope, q_intercept, q_r, _, _ = stats.linregress(x_indices, quality_values)
            analysis['quality_trend'] = {
                'slope': q_slope,
                'intercept': q_intercept,
                'r_squared': q_r ** 2,
                'direction': 'improving' if q_slope > 0 else 'declining' if q_slope < 0 else 'stable'
            }

        if len(set(success_values)) > 1:
            s_slope, s_intercept, s_r, _, _ = stats.linregress(x_indices, success_values)
            analysis['success_rate_trend'] = {
                'slope': s_slope,
                'intercept': s_intercept,
                'r_squared': s_r ** 2,
                'direction': 'improving' if s_slope > 0 else 'declining' if s_slope < 0 else 'stable'
            }

        for param in ['target_temp', 'heating_rate', 'holding_time']:
            values = [getattr(r, param) for r in records]
            if len(set(values)) > 1:
                slope, _, r, _, _ = stats.linregress(x_indices, values)
                analysis['parameter_trends'][param] = {
                    'trend': slope,
                    'r_squared': r ** 2
                }

        if analysis['quality_trend']:
            analysis['improvement_rate'] = analysis['quality_trend']['slope'] * 100 / np.mean(quality_values)

        defect_by_date = defaultdict(list)
        for r in records:
            for defect in r.defects:
                if defect:
                    defect_by_date[r.firing_date].append(defect)

        for date, defects in sorted(defect_by_date.items()):
            for defect in defects:
                if defect not in analysis['defect_trends']:
                    analysis['defect_trends'][defect] = []
                analysis['defect_trends'][defect].append(date)

        return analysis

    def anova_test(self, group_by: str = 'clay_type',
                   metric: str = 'quality_score') -> Dict[str, Any]:
        records = list(self.data_interface.records.values())

        groups = defaultdict(list)
        for r in records:
            key = getattr(r, group_by)
            groups[key].append(getattr(r, metric))

        groups = {k: v for k, v in groups.items() if len(v) >= 3}

        if len(groups) < 2:
            return {'error': 'Need at least 2 groups with 3+ samples each'}

        f_stat, p_value = f_oneway(*groups.values())

        return {
            'group_by': group_by,
            'metric': metric,
            'f_statistic': f_stat,
            'p_value': p_value,
            'significant': p_value < 0.05,
            'group_stats': {
                k: {'count': len(v), 'mean': np.mean(v), 'std': np.std(v)}
                for k, v in groups.items()
            },
            'interpretation': f"不同{group_by}之间的{metric}差异{'具有' if p_value < 0.05 else '没有'}统计学显著性"
        }

    def generate_comparison_report(self, batch_ids: List[str]) -> str:
        comparison = self.compare_batches(batch_ids)

        lines = [
            "=" * 70,
            f"多批次对比分析报告 - 共 {comparison['n_batches']} 个批次",
            "=" * 70,
            "",
            "【参数统计对比】"
        ]

        for metric, stats in comparison['metrics'].items():
            lines.append(f"\n{metric}:")
            lines.append(f"  均值: {stats['mean']:.2f} ± {stats['std']:.2f}")
            lines.append(f"  范围: [{stats['min']:.2f}, {stats['max']:.2f}]")
            lines.append(f"  变异系数: {stats['cv']:.2%}")

        lines.append("\n【相关性分析】")
        for name, corr in comparison['correlations'].items():
            lines.append(f"  {name}: {corr:.3f}")

        lines.append("\n【优化建议】")
        for i, rec in enumerate(comparison['recommendations'], 1):
            lines.append(f"  {i}. {rec['message']}")

        lines.append("\n" + "=" * 70)

        return "\n".join(lines)

    def defect_root_cause_analysis(self, defect_type: str) -> Dict[str, Any]:
        records = list(self.data_interface.records.values())
        records_with_defect = [r for r in records if defect_type in r.defects]
        records_without_defect = [r for r in records if defect_type not in r.defects]

        if len(records_with_defect) < 3 or len(records_without_defect) < 3:
            return {'error': 'Insufficient samples for analysis'}

        analysis = {
            'defect_type': defect_type,
            'occurrence_rate': len(records_with_defect) / len(records),
            'parameter_analysis': {},
            'significant_factors': []
        }

        for param in ['target_temp', 'heating_rate', 'holding_time', 'cooling_rate']:
            vals_with = [getattr(r, param) for r in records_with_defect]
            vals_without = [getattr(r, param) for r in records_without_defect]

            if len(set(vals_with + vals_without)) > 2:
                t_stat, p_val = ttest_ind(vals_with, vals_without, equal_var=False)
                significant = p_val < 0.05
            else:
                t_stat, p_val = 0, 1.0
                significant = False

            analysis['parameter_analysis'][param] = {
                'mean_with_defect': np.mean(vals_with),
                'mean_without_defect': np.mean(vals_without),
                'p_value': p_val,
                'significant': significant
            }

            if significant:
                direction = "higher" if np.mean(vals_with) > np.mean(vals_without) else "lower"
                analysis['significant_factors'].append({
                    'parameter': param,
                    'effect': f"{direction} values are associated with this defect",
                    'p_value': p_val
                })

        return analysis
