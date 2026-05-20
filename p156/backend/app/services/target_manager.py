import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from backend.app.models.database import (
    SessionLocal, ReductionTarget, EmissionRecord, Company
)


class TargetManager:
    def __init__(self):
        self.db = SessionLocal()
    
    def create_sbti_target(self, company_id: str, target_data: Dict[str, Any]) -> Dict[str, Any]:
        base_year = target_data["base_year"]
        base_record = self._get_year_emission(company_id, base_year)
        
        if not base_record:
            raise ValueError(f"基准年 {base_year} 无排放数据")
        
        base_emission = base_record["total"]
        target_reduction_pct = target_data["target_reduction_pct"]
        target_year = target_data["target_year"]
        
        target = ReductionTarget(
            company_id=company_id,
            target_name=target_data["target_name"],
            target_type=target_data["target_type"],
            scope=target_data["scope"],
            base_year=base_year,
            base_emission=base_emission,
            target_year=target_year,
            target_reduction_pct=target_reduction_pct,
            sbti_aligned=target_data.get("sbti_aligned", 1)
        )
        
        self.db.add(target)
        self.db.commit()
        self.db.refresh(target)
        
        return self._format_target(target)
    
    def update_target_progress(self, target_id: str) -> Dict[str, Any]:
        target = self.db.query(ReductionTarget).filter_by(id=target_id).first()
        if not target:
            raise ValueError("目标不存在")
        
        current_year = str(datetime.now().year)
        current_record = self._get_year_emission(target.company_id, current_year)
        
        if current_record:
            if target.scope == "all":
                current_emission = current_record["total"]
            elif target.scope == "scope1":
                current_emission = current_record["scope1"]
            elif target.scope == "scope2":
                current_emission = current_record["scope2"]
            elif target.scope == "scope3":
                current_emission = current_record["scope3"]
            else:
                current_emission = current_record["total"]
            
            achieved_reduction = 1 - (current_emission / target.base_emission)
            achieved_reduction_pct = max(0, achieved_reduction * 100)
            
            target.current_emission = current_emission
            target.achieved_reduction_pct = achieved_reduction_pct
            target.status = self._calculate_target_status(target)
            target.updated_at = datetime.utcnow()
            
            self.db.commit()
        
        return self._format_target(target)
    
    def _calculate_target_status(self, target: ReductionTarget) -> str:
        years_passed = int(target.target_year) - int(target.base_year)
        years_left = int(target.target_year) - datetime.now().year
        
        if years_passed <= 0:
            return "on_track"
        
        expected_annual_reduction = target.target_reduction_pct / years_passed
        expected_total_reduction = expected_annual_reduction * (years_passed - years_left)
        
        if target.achieved_reduction_pct >= expected_total_reduction * 1.1:
            return "exceeding"
        elif target.achieved_reduction_pct >= expected_total_reduction * 0.9:
            return "on_track"
        elif target.achieved_reduction_pct >= expected_total_reduction * 0.7:
            return "at_risk"
        else:
            return "off_track"
    
    def get_company_targets(self, company_id: str) -> List[Dict[str, Any]]:
        targets = self.db.query(ReductionTarget).filter_by(
            company_id=company_id
        ).order_by(ReductionTarget.created_at.desc()).all()
        
        return [self._format_target(t) for t in targets]
    
    def get_target_tracking(self, target_id: str) -> Dict[str, Any]:
        target = self.db.query(ReductionTarget).filter_by(id=target_id).first()
        if not target:
            raise ValueError("目标不存在")
        
        base_year = int(target.base_year)
        target_year = int(target.target_year)
        
        trajectory = []
        years = range(base_year, target_year + 1)
        annual_reduction = target.target_reduction_pct / (target_year - base_year)
        
        for year in years:
            expected_pct = (year - base_year) * annual_reduction
            expected_emission = target.base_emission * (1 - expected_pct / 100)
            
            year_record = self._get_year_emission(target.company_id, str(year))
            actual_emission = year_record.get("total", None) if year_record else None
            
            trajectory.append({
                "year": year,
                "expected_emission": round(expected_emission, 2),
                "expected_reduction_pct": round(expected_pct, 2),
                "actual_emission": round(actual_emission, 2) if actual_emission else None
            })
        
        return {
            "target": self._format_target(target),
            "trajectory": trajectory
        }
    
    def _get_year_emission(self, company_id: str, year: str) -> Optional[Dict[str, Any]]:
        records = self.db.query(EmissionRecord).filter(
            EmissionRecord.company_id == company_id,
            EmissionRecord.period.startswith(year)
        ).all()
        
        if not records:
            return None
        
        total = sum(r.grand_total for r in records)
        return {
            "total": total,
            "scope1": sum(r.scope1_total for r in records),
            "scope2": sum(r.scope2_total for r in records),
            "scope3": sum(r.scope3_total for r in records)
        }
    
    def _format_target(self, target: ReductionTarget) -> Dict[str, Any]:
        target_emission = target.base_emission * (1 - target.target_reduction_pct / 100)
        
        return {
            "id": target.id,
            "target_name": target.target_name,
            "target_type": target.target_type,
            "scope": target.scope,
            "base_year": target.base_year,
            "base_emission": round(target.base_emission, 2),
            "target_year": target.target_year,
            "target_reduction_pct": target.target_reduction_pct,
            "target_emission": round(target_emission, 2),
            "current_emission": round(target.current_emission, 2) if target.current_emission else None,
            "achieved_reduction_pct": round(target.achieved_reduction_pct, 2),
            "progress_pct": round(min(100, (target.achieved_reduction_pct / target.target_reduction_pct) * 100), 2) if target.target_reduction_pct > 0 else 0,
            "status": target.status,
            "sbti_aligned": bool(target.sbti_aligned),
            "created_at": target.created_at.isoformat() if target.created_at else None
        }
    
    def delete_target(self, target_id: str) -> bool:
        target = self.db.query(ReductionTarget).filter_by(id=target_id).first()
        if target:
            self.db.delete(target)
            self.db.commit()
            return True
        return False
    
    def close(self):
        self.db.close()
