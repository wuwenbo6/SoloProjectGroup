from backend.app.models.database import SessionLocal, EmissionFactor, IndustryBenchmark, ReductionSuggestion, Company, User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def init_emission_factors():
    db = SessionLocal()
    
    factors_v1_0 = [
        {"version": "v1.0", "source_type": "燃料燃烧", "activity": "汽油燃烧", "unit": "升", "factor_value": 2.31, "standard": "EPA", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
        {"version": "v1.0", "source_type": "燃料燃烧", "activity": "柴油燃烧", "unit": "升", "factor_value": 2.68, "standard": "EPA", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
        {"version": "v1.0", "source_type": "燃料燃烧", "activity": "天然气燃烧", "unit": "立方米", "factor_value": 2.16, "standard": "EPA", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
        {"version": "v1.0", "source_type": "电力消耗", "activity": "外购电力", "unit": "千瓦时", "factor_value": 0.5839, "standard": "EPA", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
        {"version": "v1.0", "source_type": "运输", "activity": "公路货运", "unit": "吨公里", "factor_value": 0.135, "standard": "EPA", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
        {"version": "v1.0", "source_type": "原材料", "activity": "钢铁生产", "unit": "吨", "factor_value": 1.85, "standard": "IPCC", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
        {"version": "v1.0", "source_type": "原材料", "activity": "塑料生产", "unit": "吨", "factor_value": 2.54, "standard": "EPA", "year": 2023, "is_active": 0, "description": "v1.0 历史版本"},
    ]
    
    factors_v1_1 = [
        {"version": "v1.1", "source_type": "燃料燃烧", "activity": "汽油燃烧", "unit": "升", "factor_value": 2.31, "standard": "EPA", "year": 2024, "is_active": 1, "description": "2024 EPA 更新版"},
        {"version": "v1.1", "source_type": "燃料燃烧", "activity": "柴油燃烧", "unit": "升", "factor_value": 2.68, "standard": "EPA", "year": 2024, "is_active": 1, "description": "2024 EPA 更新版"},
        {"version": "v1.1", "source_type": "燃料燃烧", "activity": "天然气燃烧", "unit": "立方米", "factor_value": 2.16, "standard": "EPA", "year": 2024, "is_active": 1, "description": "2024 EPA 更新版"},
        {"version": "v1.1", "source_type": "燃料燃烧", "activity": "煤炭燃烧", "unit": "吨", "factor_value": 2.86, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "2024 IPCC 第六次评估报告"},
        {"version": "v1.1", "source_type": "电力消耗", "activity": "外购电力", "unit": "千瓦时", "factor_value": 0.5839, "standard": "EPA", "year": 2024, "is_active": 1, "description": "全国电网平均排放因子"},
        {"version": "v1.1", "source_type": "蒸汽消耗", "activity": "外购蒸汽", "unit": "吨", "factor_value": 0.11, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "2024 IPCC 更新版"},
        {"version": "v1.1", "source_type": "运输", "activity": "公路货运", "unit": "吨公里", "factor_value": 0.135, "standard": "EPA", "year": 2024, "is_active": 1, "description": "重型货车平均"},
        {"version": "v1.1", "source_type": "运输", "activity": "航空货运", "unit": "吨公里", "factor_value": 0.58, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "国际航班平均"},
        {"version": "v1.1", "source_type": "运输", "activity": "海运货运", "unit": "吨公里", "factor_value": 0.015, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "集装箱船平均"},
        {"version": "v1.1", "source_type": "运输", "activity": "铁路货运", "unit": "吨公里", "factor_value": 0.028, "standard": "EPA", "year": 2024, "is_active": 1, "description": "电力机车为主"},
        {"version": "v1.1", "source_type": "原材料", "activity": "钢铁生产", "unit": "吨", "factor_value": 1.85, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "长流程炼钢平均"},
        {"version": "v1.1", "source_type": "原材料", "activity": "水泥生产", "unit": "吨", "factor_value": 0.83, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "包括工艺排放"},
        {"version": "v1.1", "source_type": "原材料", "activity": "塑料生产", "unit": "吨", "factor_value": 2.54, "standard": "EPA", "year": 2024, "is_active": 1, "description": "聚乙烯平均"},
        {"version": "v1.1", "source_type": "原材料", "activity": "铝材生产", "unit": "吨", "factor_value": 8.24, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "电解铝平均"},
        {"version": "v1.1", "source_type": "商务差旅", "activity": "航空出差", "unit": "公里", "factor_value": 0.255, "standard": "EPA", "year": 2024, "is_active": 1, "description": "经济舱平均"},
        {"version": "v1.1", "source_type": "商务差旅", "activity": "酒店住宿", "unit": "晚", "factor_value": 0.032, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "三星级酒店平均"},
        {"version": "v1.1", "source_type": "废弃物处理", "activity": "垃圾填埋", "unit": "吨", "factor_value": 0.52, "standard": "EPA", "year": 2024, "is_active": 1, "description": "包括甲烷排放"},
        {"version": "v1.1", "source_type": "废弃物处理", "activity": "污水处理", "unit": "立方米", "factor_value": 0.0023, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "一级处理平均"},
        {"version": "v1.1", "source_type": "员工通勤", "activity": "私家车通勤", "unit": "公里/人", "factor_value": 0.21, "standard": "EPA", "year": 2024, "is_active": 1, "description": "小客车平均"},
        {"version": "v1.1", "source_type": "员工通勤", "activity": "公共交通通勤", "unit": "公里/人", "factor_value": 0.089, "standard": "IPCC", "year": 2024, "is_active": 1, "description": "公交+地铁平均"},
    ]
    
    all_factors = factors_v1_0 + factors_v1_1
    
    for f in all_factors:
        existing = db.query(EmissionFactor).filter_by(
            version=f["version"],
            source_type=f["source_type"],
            activity=f["activity"],
            standard=f["standard"]
        ).first()
        if not existing:
            db.add(EmissionFactor(**f))
    
    db.commit()
    db.close()
    print("排放系数初始化完成")


def init_industry_benchmarks():
    db = SessionLocal()
    
    benchmarks = [
        {"industry_code": "制造业", "metric": "单位产值碳排放", "average_value": 0.85, "top25_value": 0.42, "year": 2023},
        {"industry_code": "电子信息", "metric": "单位产值碳排放", "average_value": 0.32, "top25_value": 0.15, "year": 2023},
        {"industry_code": "汽车制造", "metric": "单位产值碳排放", "average_value": 0.67, "top25_value": 0.33, "year": 2023},
        {"industry_code": "化工", "metric": "单位产值碳排放", "average_value": 2.15, "top25_value": 1.08, "year": 2023},
        {"industry_code": "食品加工", "metric": "单位产值碳排放", "average_value": 0.52, "top25_value": 0.26, "year": 2023},
        {"industry_code": "纺织服装", "metric": "单位产值碳排放", "average_value": 0.44, "top25_value": 0.22, "year": 2023},
        {"industry_code": "医药", "metric": "单位产值碳排放", "average_value": 0.38, "top25_value": 0.19, "year": 2023},
        {"industry_code": "物流运输", "metric": "单位营收碳排放", "average_value": 0.95, "top25_value": 0.48, "year": 2023},
        {"industry_code": "零售", "metric": "单位营收碳排放", "average_value": 0.12, "top25_value": 0.06, "year": 2023},
        {"industry_code": "IT服务", "metric": "单位营收碳排放", "average_value": 0.08, "top25_value": 0.04, "year": 2023},
    ]
    
    for b in benchmarks:
        existing = db.query(IndustryBenchmark).filter_by(
            industry_code=b["industry_code"],
            metric=b["metric"],
            year=b["year"]
        ).first()
        if not existing:
            db.add(IndustryBenchmark(**b))
    
    db.commit()
    db.close()
    print("行业基准初始化完成")


def init_reduction_suggestions():
    db = SessionLocal()
    
    suggestions = [
        {"category": "能源优化", "title": "更换LED照明系统", "description": "将传统荧光灯更换为LED灯具，可降低照明能耗约60%，同时延长灯具使用寿命。", "estimated_reduction_pct": 5.2, "cost_level": "中", "payback_period": "2-3年"},
        {"category": "能源优化", "title": "安装智能电表监控系统", "description": "实时监控各部门用电情况，识别能源浪费点，优化用电调度。", "estimated_reduction_pct": 3.8, "cost_level": "低", "payback_period": "1-2年"},
        {"category": "能源优化", "title": "优化空调系统运行", "description": "调整空调温度设定，定期清洗滤网，安装智能温控系统。", "estimated_reduction_pct": 8.5, "cost_level": "中", "payback_period": "1-2年"},
        {"category": "运输优化", "title": "优化物流路线", "description": "使用智能路线规划系统，减少运输里程和空载率。", "estimated_reduction_pct": 12.3, "cost_level": "低", "payback_period": "6个月"},
        {"category": "运输优化", "title": "更换新能源物流车辆", "description": "逐步将燃油货车更换为电动或氢能车辆，降低运输排放。", "estimated_reduction_pct": 45.0, "cost_level": "高", "payback_period": "5-7年"},
        {"category": "运输优化", "title": "推广铁路和水路运输", "description": "对于长距离大宗货物，优先选择铁路或水路运输方式。", "estimated_reduction_pct": 28.6, "cost_level": "中", "payback_period": "1-2年"},
        {"category": "供应链优化", "title": "供应商碳管理", "description": "将碳排放纳入供应商评估体系，推动上游供应商减排。", "estimated_reduction_pct": 15.2, "cost_level": "中", "payback_period": "2-3年"},
        {"category": "供应链优化", "title": "本地化采购", "description": "优先选择本地供应商，减少原材料运输距离。", "estimated_reduction_pct": 6.8, "cost_level": "低", "payback_period": "即时"},
        {"category": "供应链优化", "title": "包装轻量化", "description": "优化产品包装设计，减少包装材料使用，采用可回收材料。", "estimated_reduction_pct": 4.2, "cost_level": "低", "payback_period": "6个月"},
        {"category": "办公管理", "title": "推行远程办公政策", "description": "允许员工每周1-2天远程办公，减少通勤排放。", "estimated_reduction_pct": 8.1, "cost_level": "低", "payback_period": "即时"},
        {"category": "办公管理", "title": "无纸化办公", "description": "全面推行电子化办公流程，减少纸张消耗。", "estimated_reduction_pct": 2.5, "cost_level": "低", "payback_period": "3个月"},
        {"category": "生产优化", "title": "余热回收利用", "description": "安装余热回收系统，将生产过程中产生的余热用于供暖或发电。", "estimated_reduction_pct": 18.5, "cost_level": "高", "payback_period": "3-4年"},
        {"category": "生产优化", "title": "设备节能改造", "description": "对高能耗生产设备进行节能改造，提高能源利用效率。", "estimated_reduction_pct": 12.8, "cost_level": "高", "payback_period": "3-5年"},
        {"category": "可再生能源", "title": "安装屋顶光伏", "description": "在厂房屋顶安装太阳能光伏系统，自产绿色电力。", "estimated_reduction_pct": 25.0, "cost_level": "高", "payback_period": "6-8年"},
        {"category": "可再生能源", "title": "购买绿色电力", "description": "通过直购电或绿证方式，购买可再生能源电力。", "estimated_reduction_pct": 40.0, "cost_level": "中", "payback_period": "即时"},
    ]
    
    for s in suggestions:
        existing = db.query(ReductionSuggestion).filter_by(title=s["title"]).first()
        if not existing:
            db.add(ReductionSuggestion(**s))
    
    db.commit()
    db.close()
    print("减排建议初始化完成")


def init_demo_company():
    db = SessionLocal()
    
    company = db.query(Company).filter_by(name="演示科技有限公司").first()
    if not company:
        company = Company(
            name="演示科技有限公司",
            industry="电子信息"
        )
        db.add(company)
        db.flush()
        
        user = User(
            company_id=company.id,
            email="demo@company.com",
            role="admin",
            password_hash=pwd_context.hash("demo123456")
        )
        db.add(user)
    
    db.commit()
    db.close()
    print("演示企业初始化完成")
    print("登录账号: demo@company.com / demo123456")


def init_all_data():
    init_emission_factors()
    init_industry_benchmarks()
    init_reduction_suggestions()
    init_demo_company()
    print("所有数据初始化完成!")


if __name__ == "__main__":
    init_all_data()
