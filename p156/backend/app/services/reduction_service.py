from typing import List, Dict, Any
from backend.app.models.database import SessionLocal, ReductionSuggestion, IndustryBenchmark, EmissionRecord
import pandas as pd


class ReductionService:
    def __init__(self):
        self.db = SessionLocal()
    
    def get_industry_benchmark(self, industry: str) -> Dict[str, Any]:
        benchmarks = self.db.query(IndustryBenchmark).filter_by(
            industry_code=industry,
            year=2023
        ).all()
        
        return {
            "industry": industry,
            "benchmarks": [{
                "metric": b.metric,
                "average_value": b.average_value,
                "top25_value": b.top25_value,
                "year": b.year
            } for b in benchmarks]
        }
    
    def get_suggestions(self, company_id: str, industry: str = None) -> List[Dict[str, Any]]:
        suggestions = self.db.query(ReductionSuggestion).all()
        
        latest_record = self.db.query(EmissionRecord).filter_by(
            company_id=company_id
        ).order_by(EmissionRecord.calculated_at.desc()).first()
        
        total_emission = latest_record.grand_total if latest_record else 1000
        
        result = []
        for s in suggestions:
            estimated_reduction = total_emission * s.estimated_reduction_pct / 100
            
            priority = "high"
            if s.cost_level == "高" and s.estimated_reduction_pct < 10:
                priority = "low"
            elif s.cost_level == "低" and s.estimated_reduction_pct >= 5:
                priority = "high"
            elif s.estimated_reduction_pct >= 15:
                priority = "high"
            else:
                priority = "medium"
            
            result.append({
                "id": s.id,
                "title": s.title,
                "description": s.description,
                "category": s.category,
                "cost_level": s.cost_level,
                "payback_period": s.payback_period,
                "estimated_reduction_pct": s.estimated_reduction_pct,
                "estimated_reduction_amount": round(estimated_reduction, 2),
                "priority": priority
            })
        
        result.sort(key=lambda x: (
            0 if x["priority"] == "high" else 1 if x["priority"] == "medium" else 2,
            -x["estimated_reduction_pct"]
        ))
        
        return result
    
    def compare_with_benchmark(self, company_id: str, industry: str) -> Dict[str, Any]:
        benchmark = self.get_industry_benchmark(industry)
        
        records = self.db.query(EmissionRecord).filter_by(
            company_id=company_id
        ).order_by(EmissionRecord.period.desc()).limit(4).all()
        
        if not records:
            return {
                "industry": industry,
                "company_emission": 0,
                "benchmarks": benchmark["benchmarks"],
                "comparison": []
            }
        
        avg_emission = sum(r.grand_total for r in records) / len(records)
        
        comparisons = []
        for b in benchmark["benchmarks"]:
            comparisons.append({
                "metric": b["metric"],
                "company_value": avg_emission,
                "industry_average": b["average_value"],
                "industry_top25": b["top25_value"],
                "vs_average_pct": round((avg_emission - b["average_value"]) / b["average_value"] * 100, 2) if b["average_value"] > 0 else 0,
                "gap_to_top25": round(avg_emission - b["top25_value"], 2)
            })
        
        return {
            "industry": industry,
            "company_emission": round(avg_emission, 2),
            "benchmarks": benchmark["benchmarks"],
            "comparisons": comparisons
        }
    
    def close(self):
        self.db.close()
