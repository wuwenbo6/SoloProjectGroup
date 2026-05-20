import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.app.models.database import (
    SessionLocal, Company, EmissionRecord, EmissionSource, IndustryBenchmark
)


class BenchmarkAnalyzer:
    def __init__(self):
        self.db = SessionLocal()
    
    def get_industry_benchmark(self, industry: str) -> Optional[Dict[str, Any]]:
        benchmark = self.db.query(IndustryBenchmark).filter_by(
            industry=industry,
            is_active=1
        ).order_by(IndustryBenchmark.year.desc()).first()
        
        if not benchmark:
            return None
        
        return {
            "industry": benchmark.industry,
            "year": benchmark.year,
            "benchmark_scope1": benchmark.benchmark_scope1,
            "benchmark_scope2": benchmark.benchmark_scope2,
            "benchmark_scope3": benchmark.benchmark_scope3,
            "benchmark_total": benchmark.benchmark_total,
            "p25_total": benchmark.p25_total,
            "p50_total": benchmark.p50_total,
            "p75_total": benchmark.p75_total,
            "sample_size": benchmark.sample_size
        }
    
    def compare_with_industry(self, company_id: str, period: str = None) -> Dict[str, Any]:
        company = self.db.query(Company).filter_by(id=company_id).first()
        if not company:
            raise ValueError("公司不存在")
        
        if period:
            record = self.db.query(EmissionRecord).filter_by(
                company_id=company_id,
                period=period
            ).first()
        else:
            record = self.db.query(EmissionRecord).filter_by(
                company_id=company_id
            ).order_by(EmissionRecord.period.desc()).first()
        
        if not record:
            raise ValueError("无排放数据")
        
        benchmark = self.get_industry_benchmark(company.industry)
        
        if not benchmark:
            return {
                "company": {
                    "name": company.name,
                    "industry": company.industry,
                    "period": record.period,
                    "scope1": record.scope1_total,
                    "scope2": record.scope2_total,
                    "scope3": record.scope3_total,
                    "total": record.grand_total
                },
                "benchmark_available": False,
                "message": f"暂无 {company.industry} 行业的基准数据"
            }
        
        comparison = self._calculate_comparison(record, benchmark)
        
        peer_companies = self._get_peer_companies(company.industry, company.id)
        peer_rank = self._calculate_peer_rank(record.grand_total, company.industry)
        
        return {
            "company": {
                "name": company.name,
                "industry": company.industry,
                "period": record.period,
                "scope1": round(record.scope1_total, 2),
                "scope2": round(record.scope2_total, 2),
                "scope3": round(record.scope3_total, 2),
                "total": round(record.grand_total, 2)
            },
            "benchmark": benchmark,
            "comparison": comparison,
            "peer_rank": peer_rank,
            "peer_count": len(peer_companies),
            "benchmark_available": True
        }
    
    def _calculate_comparison(self, record: EmissionRecord, benchmark: Dict[str, Any]) -> Dict[str, Any]:
        def calc_diff(actual: float, bench: float) -> Dict:
            if bench == 0:
                ratio = 1.0
            else:
                ratio = actual / bench
            return {
                "difference": round(actual - bench, 2),
                "ratio": round(ratio * 100, 1),
                "better": actual < bench
            }
        
        percentile = self._calculate_percentile(record.grand_total, benchmark)
        
        return {
            "scope1": calc_diff(record.scope1_total, benchmark["benchmark_scope1"]),
            "scope2": calc_diff(record.scope2_total, benchmark["benchmark_scope2"]),
            "scope3": calc_diff(record.scope3_total, benchmark["benchmark_scope3"]),
            "total": calc_diff(record.grand_total, benchmark["benchmark_total"]),
            "percentile": percentile,
            "performance_level": self._get_performance_level(percentile)
        }
    
    def _calculate_percentile(self, value: float, benchmark: Dict[str, Any]) -> int:
        if value <= benchmark["p25_total"]:
            return 25
        elif value <= benchmark["p50_total"]:
            return 50
        elif value <= benchmark["p75_total"]:
            return 75
        else:
            return 90
    
    def _get_performance_level(self, percentile: int) -> str:
        if percentile <= 25:
            return "行业领先"
        elif percentile <= 50:
            return "优于平均"
        elif percentile <= 75:
            return "行业平均"
        else:
            return "低于平均"
    
    def _get_peer_companies(self, industry: str, exclude_company_id: str = None) -> List[Dict[str, Any]]:
        query = self.db.query(Company).filter_by(industry=industry)
        if exclude_company_id:
            query = query.filter(Company.id != exclude_company_id)
        
        companies = query.all()
        results = []
        
        for comp in companies:
            latest_record = self.db.query(EmissionRecord).filter_by(
                company_id=comp.id
            ).order_by(EmissionRecord.period.desc()).first()
            
            if latest_record:
                results.append({
                    "company_id": comp.id,
                    "company_name": comp.name,
                    "total_emission": round(latest_record.grand_total, 2),
                    "period": latest_record.period
                })
        
        return sorted(results, key=lambda x: x["total_emission"])
    
    def _calculate_peer_rank(self, total_emission: float, industry: str) -> Dict[str, Any]:
        peers = self._get_peer_companies(industry)
        if not peers:
            return {"rank": None, "total_peers": 0}
        
        all_emissions = [p["total_emission"] for p in peers] + [total_emission]
        all_emissions_sorted = sorted(all_emissions)
        
        rank = all_emissions_sorted.index(total_emission) + 1
        
        return {
            "rank": rank,
            "total_peers": len(all_emissions_sorted),
            "rank_pct": round(rank / len(all_emissions_sorted) * 100, 1)
        }
    
    def get_multicompany_comparison(self, company_ids: List[str], period: str = None) -> Dict[str, Any]:
        companies_data = []
        
        for cid in company_ids:
            company = self.db.query(Company).filter_by(id=cid).first()
            if not company:
                continue
            
            if period:
                record = self.db.query(EmissionRecord).filter_by(
                    company_id=cid,
                    period=period
                ).first()
            else:
                record = self.db.query(EmissionRecord).filter_by(
                    company_id=cid
                ).order_by(EmissionRecord.period.desc()).first()
            
            if not record:
                continue
            
            scope_breakdown = self._get_scope_breakdown(record.id)
            
            companies_data.append({
                "company_id": company.id,
                "company_name": company.name,
                "industry": company.industry,
                "period": record.period,
                "scope1": round(record.scope1_total, 2),
                "scope2": round(record.scope2_total, 2),
                "scope3": round(record.scope3_total, 2),
                "total": round(record.grand_total, 2),
                "scope_breakdown": scope_breakdown,
                "intensity": round(record.grand_total / company.revenue * 1000000, 2) if company.revenue > 0 else None
            })
        
        companies_data_sorted = sorted(companies_data, key=lambda x: x["total"])
        
        return {
            "companies": companies_data_sorted,
            "period": period,
            "summary": {
                "avg_total": round(np.mean([c["total"] for c in companies_data]), 2),
                "min_total": round(min([c["total"] for c in companies_data]), 2),
                "max_total": round(max([c["total"] for c in companies_data]), 2),
                "median_total": round(np.median([c["total"] for c in companies_data]), 2)
            }
        }
    
    def _get_scope_breakdown(self, record_id: str) -> List[Dict[str, Any]]:
        sources = self.db.query(EmissionSource).filter_by(record_id=record_id).all()
        df = pd.DataFrame([{
            "category": s.category,
            "scope": s.scope,
            "emission": s.emission_amount
        } for s in sources])
        
        if df.empty:
            return []
        
        breakdown = df.groupby("category")["emission"].sum().sort_values(ascending=False)
        return [
            {"category": cat, "emission": round(em, 2)}
            for cat, em in breakdown.head(5).items()
        ]
    
    def get_industry_list(self) -> List[str]:
        industries = self.db.query(Company.industry).distinct().all()
        return [i[0] for i in industries if i[0]]
    
    def close(self):
        self.db.close()
