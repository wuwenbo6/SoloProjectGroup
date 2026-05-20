import csv
import io
from typing import List, Dict, Any
from datetime import datetime


def export_stress_analysis_to_csv(
    analyses: List[Dict[str, Any]],
    include_details: bool = True
) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)

    header = [
        "分析ID",
        "结构ID",
        "结构名称",
        "受力方向",
        "作用力(N)",
        "最大应力(MPa)",
        "最小应力(MPa)",
        "平均应力(MPa)",
        "安全系数",
        "失效概率",
        "使用第三方数据",
        "创建时间"
    ]

    if include_details:
        header.extend([
            "木材类型",
            "弹性模量(MPa)",
            "抗拉强度(MPa)",
            "抗压强度(MPa)"
        ])

    writer.writerow(header)

    for analysis in analyses:
        structure = analysis.get("structure", {})
        wood_type = structure.get("wood_type", {}) if isinstance(structure, dict) else {}

        row = [
            analysis.get("id", ""),
            analysis.get("structure_id", ""),
            structure.get("name", "") if isinstance(structure, dict) else "",
            analysis.get("force_direction", ""),
            f"{analysis.get('applied_force', 0):.2f}",
            f"{analysis.get('max_stress', 0):.4f}",
            f"{analysis.get('min_stress', 0):.4f}",
            f"{analysis.get('avg_stress', 0):.4f}",
            f"{analysis.get('safety_factor', 0):.4f}",
            f"{analysis.get('failure_probability', 0):.4f}",
            "是" if analysis.get("used_third_party_data", False) else "否",
            analysis.get("created_at", "").isoformat() if hasattr(analysis.get("created_at"), 'isoformat') else str(analysis.get("created_at", ""))
        ]

        if include_details:
            row.extend([
                wood_type.get("name", "") if isinstance(wood_type, dict) else "",
                f"{wood_type.get('elastic_modulus', 0):.2f}" if isinstance(wood_type, dict) else "",
                f"{wood_type.get('tensile_strength', 0):.2f}" if isinstance(wood_type, dict) else "",
                f"{wood_type.get('compressive_strength', 0):.2f}" if isinstance(wood_type, dict) else ""
            ])

        writer.writerow(row)

    return output.getvalue().encode('utf-8-sig')


def export_structures_to_csv(
    structures: List[Dict[str, Any]],
    include_stress_history: bool = False
) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)

    header = [
        "结构ID",
        "结构名称",
        "结构类型",
        "描述",
        "卯眼宽度(mm)",
        "卯眼高度(mm)",
        "卯眼深度(mm)",
        "榫头宽度(mm)",
        "榫头高度(mm)",
        "榫头长度(mm)",
        "配合间隙(mm)",
        "肩长(mm)",
        "木材类型ID",
        "木材类型名称",
        "创建时间",
        "更新时间"
    ]

    if include_stress_history:
        header.extend([
            "应力分析次数",
            "最新最大应力(MPa)",
            "平均安全系数",
            "最高风险等级"
        ])

    writer.writerow(header)

    for structure in structures:
        wood_type = structure.get("wood_type", {}) or {}
        analyses = structure.get("stress_analyses", []) or []

        row = [
            structure.get("id", ""),
            structure.get("name", ""),
            structure.get("structure_type", ""),
            structure.get("description", ""),
            f"{structure.get('mortise_width', 0):.2f}",
            f"{structure.get('mortise_height', 0):.2f}",
            f"{structure.get('mortise_depth', 0):.2f}",
            f"{structure.get('tenon_width', 0):.2f}",
            f"{structure.get('tenon_height', 0):.2f}",
            f"{structure.get('tenon_length', 0):.2f}",
            f"{structure.get('fit_clearance', 0):.2f}",
            f"{structure.get('shoulder_length', 0):.2f}",
            structure.get("wood_type_id", ""),
            wood_type.get("name", "") if hasattr(wood_type, 'get') else "",
            structure.get("created_at", "").isoformat() if hasattr(structure.get("created_at"), 'isoformat') else str(structure.get("created_at", "")),
            structure.get("updated_at", "").isoformat() if hasattr(structure.get("updated_at"), 'isoformat') else str(structure.get("updated_at", ""))
        ]

        if include_stress_history and analyses:
            safety_factors = [a.get("safety_factor", 0) for a in analyses if a.get("safety_factor")]
            avg_safety = sum(safety_factors) / len(safety_factors) if safety_factors else 0
            max_stress = max([abs(a.get("max_stress", 0)) for a in analyses], default=0)

            row.extend([
                str(len(analyses)),
                f"{max_stress:.4f}",
                f"{avg_safety:.4f}",
                _get_risk_level(analyses)
            ])
        elif include_stress_history:
            row.extend(["0", "0", "0", "无数据"])

        writer.writerow(row)

    return output.getvalue().encode('utf-8-sig')


def _get_risk_level(analyses: List[Dict[str, Any]]) -> str:
    if not analyses:
        return "无数据"

    min_safety = min([a.get("safety_factor", 10) for a in analyses], default=10)
    if min_safety <= 1.5:
        return "严重危险"
    elif min_safety <= 2.5:
        return "警告"
    elif min_safety <= 3.0:
        return "注意"
    else:
        return "安全"


def generate_export_filename(prefix: str, format: str = "csv") -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{prefix}_{timestamp}.{format}"
