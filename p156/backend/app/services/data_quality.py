import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.app.models.database import (
    SessionLocal, DataQualityLog, EmissionRecord, EmissionSource
)


QUALITY_WEIGHTS = {
    "completeness": 0.35,
    "accuracy": 0.40,
    "consistency": 0.25
}

CONFIDENCE_INTERVALS = {
    "very_high": {"low": 0.95, "high": 1.05, "score_range": (90, 100)},
    "high": {"low": 0.90, "high": 1.10, "score_range": (75, 90)},
    "medium": {"low": 0.80, "high": 1.25, "score_range": (50, 75)},
    "low": {"low": 0.60, "high": 1.50, "score_range": (25, 50)},
    "very_low": {"low": 0.40, "high": 2.00, "score_range": (0, 25)}
}

SCOPE3_CATEGORY_COVERAGE = 15


class DataQualityScorer:
    def __init__(self):
        self.db = SessionLocal()
    
    def calculate_quality_score(self, record_id: str) -> Dict[str, Any]:
        record = self.db.query(EmissionRecord).filter_by(id=record_id).first()
        if not record:
            raise ValueError("排放记录不存在")
        
        sources = self.db.query(EmissionSource).filter_by(record_id=record_id).all()
        sources_df = pd.DataFrame([{
            "category": s.category,
            "subcategory": s.subcategory,
            "scope": s.scope,
            "activity_data": s.activity_data,
            "emission_factor": s.emission_factor,
            "emission": s.emission_amount
        } for s in sources])
        
        completeness = self._calculate_completeness(sources_df, record)
        accuracy = self._calculate_accuracy(sources_df)
        consistency = self._calculate_consistency(record.company_id, record.period, sources_df)
        
        overall_score = (
            completeness["score"] * QUALITY_WEIGHTS["completeness"] +
            accuracy["score"] * QUALITY_WEIGHTS["accuracy"] +
            consistency["score"] * QUALITY_WEIGHTS["consistency"]
        )
        
        confidence_level = self._determine_confidence_level(overall_score)
        ci = CONFIDENCE_INTERVALS[confidence_level]
        ci_low = record.grand_total * ci["low"]
        ci_high = record.grand_total * ci["high"]
        
        issues = completeness.get("issues", []) + accuracy.get("issues", []) + consistency.get("issues", [])
        
        log = DataQualityLog(
            record_id=record_id,
            category="overall",
            completeness_score=completeness["score"],
            accuracy_score=accuracy["score"],
            consistency_score=consistency["score"],
            overall_score=overall_score,
            confidence_interval_low=ci_low,
            confidence_interval_high=ci_high,
            issues="\n".join(issues) if issues else None
        )
        self.db.add(log)
        
        record.data_quality_score = overall_score
        record.data_confidence_level = confidence_level
        self.db.commit()
        
        return {
            "record_id": record_id,
            "overall_score": round(overall_score, 2),
            "confidence_level": confidence_level,
            "confidence_interval": {
                "low": round(ci_low, 2),
                "high": round(ci_high, 2),
                "margin_pct": round((ci_high - ci_low) / record.grand_total * 100 / 2, 2)
            },
            "breakdown": {
                "completeness": completeness,
                "accuracy": accuracy,
                "consistency": consistency
            },
            "issues": issues,
            "grade": self._get_grade(overall_score)
        }
    
    def _calculate_completeness(self, sources_df: pd.DataFrame, record: EmissionRecord) -> Dict[str, Any]:
        issues = []
        
        scope1_present = not sources_df[sources_df["scope"] == 1].empty
        scope2_present = not sources_df[sources_df["scope"] == 2].empty
        
        scope3_categories = sources_df[sources_df["scope"] == 3]["category"].nunique()
        scope3_coverage = min(100, (scope3_categories / SCOPE3_CATEGORY_COVERAGE) * 100)
        
        if not scope1_present:
            issues.append("范围一数据缺失")
        if not scope2_present:
            issues.append("范围二数据缺失")
        
        if scope3_coverage < 30:
            issues.append(f"范围三类别覆盖率低 ({scope3_categories}/{SCOPE3_CATEGORY_COVERAGE})")
        
        empty_subcategories = sources_df[
            (sources_df["activity_data"] == 0) | (sources_df["activity_data"].isna())
        ].shape[0]
        
        if empty_subcategories > 0:
            issues.append(f"{empty_subcategories} 个类别活动数据为空")
        
        scope_score = 0
        if scope1_present:
            scope_score += 35
        if scope2_present:
            scope_score += 35
        scope_score += min(30, scope3_coverage * 0.3)
        
        completeness_score = scope_score
        
        return {
            "score": round(completeness_score, 2),
            "scope1_complete": scope1_present,
            "scope2_complete": scope2_present,
            "scope3_coverage_pct": round(scope3_coverage, 2),
            "scope3_categories": scope3_categories,
            "issues": issues
        }
    
    def _calculate_accuracy(self, sources_df: pd.DataFrame) -> Dict[str, Any]:
        issues = []
        category_scores = []
        
        accuracy_weights = {
            "燃料燃烧": 0.95,
            "电力消耗": 0.98,
            "运输": 0.80,
            "原材料": 0.70,
            "商务差旅": 0.60,
            "员工通勤": 0.55,
            "废弃物处理": 0.75,
        }
        
        for _, row in sources_df.iterrows():
            category = row["category"]
            weight = accuracy_weights.get(category, 0.6)
            
            if row["activity_data"] > 0:
                category_scores.append({
                    "category": category,
                    "weight": weight,
                    "emission_share": row["emission"]
                })
        
        if category_scores:
            total_emission = sum(s["emission_share"] for s in category_scores)
            if total_emission > 0:
                weighted_score = sum(
                    s["weight"] * (s["emission_share"] / total_emission) * 100
                    for s in category_scores
                )
            else:
                weighted_score = 60
        else:
            weighted_score = 50
            issues.append("无法计算数据准确性")
        
        if weighted_score < 70:
            issues.append("高排放类别数据来源可信度较低")
        
        return {
            "score": round(weighted_score, 2),
            "issues": issues
        }
    
    def _calculate_consistency(self, company_id: str, current_period: str, sources_df: pd.DataFrame) -> Dict[str, Any]:
        issues = []
        
        prev_records = self.db.query(EmissionRecord).filter(
            EmissionRecord.company_id == company_id,
            EmissionRecord.period < current_period
        ).order_by(EmissionRecord.period.desc()).limit(3).all()
        
        if not prev_records:
            return {
                "score": 70.0,
                "baseline_available": False,
                "issues": ["无历史数据进行一致性对比"]
            }
        
        prev_sources = []
        for rec in prev_records:
            srcs = self.db.query(EmissionSource).filter_by(record_id=rec.id).all()
            for s in srcs:
                prev_sources.append({
                    "period": rec.period,
                    "category": s.category,
                    "emission": s.emission_amount
                })
        
        prev_df = pd.DataFrame(prev_sources)
        if prev_df.empty:
            return {
                "score": 70.0,
                "baseline_available": False,
                "issues": ["历史排放源数据不完整"]
            }
        
        category_consistency = []
        current_categories = sources_df["category"].unique()
        
        for category in current_categories:
            cat_current = sources_df[sources_df["category"] == category]["emission"].sum()
            cat_prev = prev_df[prev_df["category"] == category].groupby("period")["emission"].sum()
            
            if len(cat_prev) >= 2:
                prev_mean = cat_prev.mean()
                prev_std = cat_prev.std()
                
                if prev_mean > 0:
                    cv = prev_std / prev_mean
                    variation_score = max(0, 100 - cv * 100)
                    
                    deviation = abs(cat_current - prev_mean) / prev_mean
                    if deviation > 0.5:
                        issues.append(f"{category} 排放较历史均值偏差 {deviation*100:.1f}%")
                    
                    category_consistency.append({
                        "category": category,
                        "score": variation_score
                    })
        
        if category_consistency:
            consistency_score = np.mean([c["score"] for c in category_consistency])
        else:
            consistency_score = 70
        
        return {
            "score": round(consistency_score, 2),
            "baseline_available": True,
            "baseline_periods": len(prev_records),
            "issues": issues
        }
    
    def _determine_confidence_level(self, score: float) -> str:
        if score >= 90:
            return "very_high"
        elif score >= 75:
            return "high"
        elif score >= 50:
            return "medium"
        elif score >= 25:
            return "low"
        else:
            return "very_low"
    
    def _get_grade(self, score: float) -> str:
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
    
    def get_quality_history(self, company_id: str, limit: int = 12) -> List[Dict[str, Any]]:
        records = self.db.query(EmissionRecord).filter_by(
            company_id=company_id
        ).order_by(EmissionRecord.period.desc()).limit(limit).all()
        
        results = []
        for rec in records:
            results.append({
                "period": rec.period,
                "overall_score": round(rec.data_quality_score, 2) if rec.data_quality_score else None,
                "confidence_level": rec.data_confidence_level,
                "total_emission": round(rec.grand_total, 2)
            })
        
        return results
    
    def close(self):
        self.db.close()
