import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional
from backend.app.models.database import SessionLocal, EmissionFactor, EmissionRecord, EmissionSource
from datetime import datetime


CURRENT_FACTOR_VERSION = "v1.1"


CATEGORY_SCOPE_MAPPING = {
    "燃料燃烧": 1,
    "厂区燃烧": 1,
    "自有车辆": 1,
    "电力消耗": 2,
    "外购电力": 2,
    "蒸汽消耗": 2,
    "外购蒸汽": 2,
    "热力消耗": 2,
    "运输": 3,
    "物流运输": 3,
    "公路货运": 3,
    "航空货运": 3,
    "海运货运": 3,
    "铁路货运": 3,
    "原材料": 3,
    "采购商品": 3,
    "原材料采购": 3,
    "钢铁生产": 3,
    "水泥生产": 3,
    "塑料生产": 3,
    "铝材生产": 3,
    "商务差旅": 3,
    "员工通勤": 3,
    "废弃物处理": 3,
    "包装材料": 3,
    "资本货物": 3,
    "燃料和能源相关活动": 3,
    "上游运输和配送": 3,
    "下游运输和配送": 3,
    "产品加工": 3,
    "产品使用": 3,
    "产品报废处理": 3,
    "特许经营": 3,
    "投资": 3,
}


UNIT_CONVERSION_MAP = {
    "千克": 0.001,
    "kg": 0.001,
    "公斤": 0.001,
    "吨": 1.0,
    "t": 1.0,
    "万吨": 10000.0,
    "升": 1.0,
    "L": 1.0,
    "立方米": 1.0,
    "m³": 1.0,
    "千瓦时": 1.0,
    "kWh": 1.0,
    "万kWh": 10000.0,
    "度": 1.0,
    "公里": 1.0,
    "km": 1.0,
    "吨公里": 1.0,
    "t·km": 1.0,
    "吨·公里": 1.0,
}


CATEGORY_ALIASES = {
    "外购电力": "电力消耗",
    "电力": "电力消耗",
    "天然气": "燃料燃烧",
    "汽油": "燃料燃烧",
    "柴油": "燃料燃烧",
    "煤炭": "燃料燃烧",
    "物流": "运输",
    "货运": "运输",
    "出差": "商务差旅",
    "通勤": "员工通勤",
    "垃圾处理": "废弃物处理",
    "污水": "废弃物处理",
    "钢材": "原材料",
    "塑料": "原材料",
    "水泥": "原材料",
    "铝材": "原材料",
    "采购商品": "原材料",
}


ACTIVITY_ALIASES = {
    "钢铁生产": ["钢铁", "钢材", "粗钢"],
    "塑料生产": ["塑料", "塑胶"],
    "水泥生产": ["水泥"],
    "铝材生产": ["铝材", "铝"],
    "汽油燃烧": ["汽油"],
    "柴油燃烧": ["柴油"],
    "天然气燃烧": ["天然气"],
    "煤炭燃烧": ["煤炭"],
    "外购电力": ["电力", "用电"],
    "公路货运": ["公路运输"],
    "航空货运": ["航空运输", "空运"],
    "海运货运": ["海运", "水路运输"],
    "铁路货运": ["铁路运输"],
}


class CarbonCalculator:
    def __init__(self, version: Optional[str] = None):
        self.db = SessionLocal()
        self.target_version = version or CURRENT_FACTOR_VERSION
        self.factors_df = self._load_emission_factors()
    
    def _load_emission_factors(self) -> pd.DataFrame:
        factors = self.db.query(EmissionFactor).filter_by(
            version=self.target_version,
            is_active=1
        ).all()
        
        if not factors:
            factors = self.db.query(EmissionFactor).filter_by(is_active=1).all()
        
        data = []
        for f in factors:
            scope = CATEGORY_SCOPE_MAPPING.get(f.source_type, 3)
            data.append({
                "factor_id": f.id,
                "category": f.source_type,
                "source_type": f.source_type,
                "activity": f.activity,
                "unit": f.unit,
                "factor_value": f.factor_value,
                "standard": f.standard,
                "version": f.version,
                "scope": scope
            })
        
        df = pd.DataFrame(data)
        df = self._expand_with_aliases(df)
        return df
    
    def _expand_with_aliases(self, df: pd.DataFrame) -> pd.DataFrame:
        alias_rows = []
        
        for _, row in df.iterrows():
            category = row["category"]
            activity = row["activity"]
            
            for alias_category, mapped_category in CATEGORY_ALIASES.items():
                if mapped_category == category:
                    new_row = row.copy()
                    new_row["category"] = alias_category
                    alias_rows.append(new_row)
            
            for std_activity, aliases in ACTIVITY_ALIASES.items():
                if std_activity == activity:
                    for alias_activity in aliases:
                        new_row = row.copy()
                        new_row["activity"] = alias_activity
                        alias_rows.append(new_row)
        
        if alias_rows:
            alias_df = pd.DataFrame(alias_rows)
            df = pd.concat([df, alias_df], ignore_index=True)
        
        df = df.drop_duplicates(subset=["category", "activity", "unit"], keep="first")
        return df
    
    def _normalize_and_convert_units(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        for idx, row in df.iterrows():
            unit = str(row["unit"]).strip()
            value = float(row["activity_data"])
            
            conversion_factor = UNIT_CONVERSION_MAP.get(unit, 1.0)
            converted_value = value * conversion_factor
            
            if unit in ["千克", "kg", "公斤"]:
                std_unit = "吨"
            elif unit in ["公里", "km"]:
                std_unit = "公里"
            elif unit in ["千瓦时", "kWh", "度"]:
                std_unit = "千瓦时"
            elif unit in ["吨公里", "t·km", "吨·公里"]:
                std_unit = "吨公里"
            else:
                std_unit = unit
            
            df.at[idx, "activity_data"] = converted_value
            df.at[idx, "unit"] = std_unit
        
        return df
    
    def _normalize_category_and_activity(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        
        for idx, row in df.iterrows():
            category = str(row["category"]).strip()
            activity = str(row["activity"]).strip()
            
            normalized_category = CATEGORY_ALIASES.get(category, category)
            
            normalized_activity = activity
            for std_activity, aliases in ACTIVITY_ALIASES.items():
                if activity in aliases:
                    normalized_activity = std_activity
                    break
            
            df.at[idx, "category"] = normalized_category
            df.at[idx, "activity"] = normalized_activity
            df.at[idx, "original_category"] = category
            df.at[idx, "original_activity"] = activity
        
        return df
    
    def calculate_from_dataframe(self, df: pd.DataFrame, company_id: str, period: str) -> Dict[str, Any]:
        required_columns = ["category", "activity", "activity_data", "unit"]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必要列: {col}")
        
        df = df.copy()
        
        df = self._normalize_category_and_activity(df)
        df = self._normalize_and_convert_units(df)
        
        merged_df = df.merge(
            self.factors_df,
            on=["category", "activity", "unit"],
            how="left"
        )
        
        missing_factors = merged_df[merged_df["factor_value"].isna()]
        if not missing_factors.empty:
            missing_items = missing_factors[["category", "activity", "unit"]].drop_duplicates()
            
            suggestions = []
            for _, item in missing_items.iterrows():
                matching = self.factors_df[
                    (self.factors_df["category"] == item["category"]) &
                    (self.factors_df["activity"] == item["activity"])
                ]
                if not matching.empty:
                    suggestions.append({
                        "input": f"{item['category']} - {item['activity']} - {item['unit']}",
                        "available_units": matching["unit"].unique().tolist()
                    })
            
            error_msg = f"未找到匹配的排放系数，请检查类别、活动名称和单位是否正确。未匹配项: {missing_items.to_dict('records')}"
            if suggestions:
                error_msg += f"。建议参考单位: {suggestions}"
            raise ValueError(error_msg)
        
        merged_df["emission_amount"] = merged_df["activity_data"] * merged_df["factor_value"]
        merged_df["scope"] = merged_df["scope"].astype(int)
        
        scope_summary = merged_df.groupby("scope")["emission_amount"].sum().reindex([1, 2, 3], fill_value=0)
        
        category_summary = merged_df.groupby(["category", "activity"]).agg({
            "activity_data": "sum",
            "emission_amount": "sum",
            "scope": "first"
        }).reset_index()
        
        actual_version = merged_df["version"].iloc[0] if "version" in merged_df.columns and not merged_df["version"].empty else self.target_version
        
        record = EmissionRecord(
            company_id=company_id,
            period=period,
            factor_version=actual_version,
            scope1_total=float(scope_summary.get(1, 0)),
            scope2_total=float(scope_summary.get(2, 0)),
            scope3_total=float(scope_summary.get(3, 0)),
            grand_total=float(scope_summary.sum()),
            calculated_at=datetime.utcnow()
        )
        self.db.add(record)
        self.db.flush()
        
        for _, row in merged_df.iterrows():
            source = EmissionSource(
                record_id=record.id,
                category=row["category"],
                subcategory=row.get("original_category", row.get("subcategory", "")),
                scope=int(row["scope"]),
                activity_data=float(row["activity_data"]),
                unit=row["unit"],
                emission_factor=float(row["factor_value"]),
                emission_amount=float(row["emission_amount"])
            )
            self.db.add(source)
        
        self.db.commit()
        
        return {
            "record_id": record.id,
            "period": period,
            "factor_version": actual_version,
            "scope1": float(scope_summary.get(1, 0)),
            "scope2": float(scope_summary.get(2, 0)),
            "scope3": float(scope_summary.get(3, 0)),
            "total": float(scope_summary.sum()),
            "breakdown": category_summary.to_dict("records")
        }
    
    def get_trend_data(self, company_id: str, months: int = 12) -> List[Dict[str, Any]]:
        records = self.db.query(EmissionRecord).filter_by(
            company_id=company_id
        ).order_by(EmissionRecord.period).limit(months).all()
        
        return [{
            "period": r.period,
            "factor_version": r.factor_version,
            "scope1": r.scope1_total,
            "scope2": r.scope2_total,
            "scope3": r.scope3_total,
            "total": r.grand_total
        } for r in records]
    
    def get_emission_breakdown(self, record_id: str, scope: int = None) -> List[Dict[str, Any]]:
        query = self.db.query(EmissionSource).filter_by(record_id=record_id)
        if scope:
            query = query.filter_by(scope=scope)
        
        sources = query.all()
        df = pd.DataFrame([{
            "category": s.category,
            "subcategory": s.subcategory,
            "scope": s.scope,
            "activity_data": s.activity_data,
            "unit": s.unit,
            "emission_factor": s.emission_factor,
            "emission": s.emission_amount
        } for s in sources])
        
        if df.empty:
            return []
        
        summary = df.groupby(["category", "scope"]).agg({
            "emission": "sum",
            "activity_data": "sum"
        }).reset_index()
        
        return summary.sort_values("emission", ascending=False).to_dict("records")
    
    def get_hotspot_analysis(self, record_id: str) -> Dict[str, Any]:
        sources = self.db.query(EmissionSource).filter_by(record_id=record_id).all()
        df = pd.DataFrame([{
            "category": s.category,
            "subcategory": s.subcategory,
            "scope": s.scope,
            "emission": s.emission_amount
        } for s in sources])
        
        if df.empty:
            return {"hotspots": [], "total": 0}
        
        total_emission = df["emission"].sum()
        
        category_emissions = df.groupby("category")["emission"].sum().sort_values(ascending=False)
        category_pct = (category_emissions / total_emission * 100).round(2)
        
        hotspots = []
        cumulative = 0
        for category, emission in category_emissions.items():
            pct = category_pct[category]
            cumulative += pct
            hotspots.append({
                "category": category,
                "emission": float(emission),
                "percentage": float(pct),
                "cumulative": float(cumulative),
                "level": "high" if pct > 20 else "medium" if pct > 10 else "low"
            })
        
        return {
            "hotspots": hotspots,
            "total": float(total_emission),
            "top_contributors": hotspots[:5]
        }
    
    def close(self):
        self.db.close()


def generate_sample_data() -> pd.DataFrame:
    data = [
        {"category": "燃料燃烧", "activity": "汽油燃烧", "subcategory": "公司车辆", "activity_data": 5000, "unit": "升"},
        {"category": "燃料燃烧", "activity": "天然气燃烧", "subcategory": "锅炉供暖", "activity_data": 12000, "unit": "立方米"},
        {"category": "电力消耗", "activity": "外购电力", "subcategory": "生产用电", "activity_data": 250000, "unit": "千瓦时"},
        {"category": "电力消耗", "activity": "外购电力", "subcategory": "办公用电", "activity_data": 50000, "unit": "千瓦时"},
        {"category": "运输", "activity": "公路货运", "subcategory": "原材料运输", "activity_data": 80000, "unit": "吨公里"},
        {"category": "运输", "activity": "航空货运", "subcategory": "成品运输", "activity_data": 15000, "unit": "吨公里"},
        {"category": "原材料", "activity": "钢铁生产", "subcategory": "采购钢材", "activity_data": 300, "unit": "吨"},
        {"category": "原材料", "activity": "塑料生产", "subcategory": "采购塑料", "activity_data": 150, "unit": "吨"},
        {"category": "商务差旅", "activity": "航空出差", "subcategory": "国内出差", "activity_data": 50000, "unit": "公里"},
        {"category": "员工通勤", "activity": "私家车通勤", "subcategory": "员工通勤", "activity_data": 200000, "unit": "公里/人"},
    ]
    return pd.DataFrame(data)


def get_available_versions(db_session=None) -> List[str]:
    if db_session is None:
        db_session = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        versions = db_session.query(EmissionFactor.version).distinct().order_by(EmissionFactor.version.desc()).all()
        return [v[0] for v in versions]
    finally:
        if should_close:
            db_session.close()
