from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict
from math import radians, sin, cos, sqrt, atan2
from datetime import datetime

from app.core.database import get_traceability_db, get_batch_db
from app.models.traceability import RawMaterial
from app.models.batch import MaterialBatch
from app.utils.security import authenticate

router = APIRouter(prefix="/geo", tags=["地理信息"])


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0

    lat1_rad = radians(lat1)
    lon1_rad = radians(lon1)
    lat2_rad = radians(lat2)
    lon2_rad = radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = sin(dlat / 2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c


@router.get("/materials/nearby")
async def get_materials_nearby(
    latitude: float = Query(..., description="中心纬度"),
    longitude: float = Query(..., description="中心经度"),
    radius_km: float = Query(50.0, ge=0.1, description="搜索半径(公里)"),
    category: Optional[str] = Query(None, description="原料分类筛选"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial).filter(
        RawMaterial.latitude.isnot(None),
        RawMaterial.longitude.isnot(None),
        RawMaterial.is_active == True
    )

    if category:
        query = query.filter(RawMaterial.category == category)

    materials = query.all()

    nearby_materials = []
    for material in materials:
        distance = calculate_distance(
            latitude, longitude,
            material.latitude, material.longitude
        )
        if distance <= radius_km:
            nearby_materials.append({
                "material_code": material.material_code,
                "name": material.name,
                "category": material.category,
                "origin_province": material.origin_province,
                "origin_city": material.origin_city,
                "origin_village": material.origin_village,
                "latitude": material.latitude,
                "longitude": material.longitude,
                "distance_km": round(distance, 2),
                "craft_type": material.craft_type,
                "harvest_date": material.harvest_date.isoformat() if material.harvest_date else None
            })

    nearby_materials.sort(key=lambda x: x["distance_km"])

    return {
        "center": {"latitude": latitude, "longitude": longitude},
        "radius_km": radius_km,
        "total": len(nearby_materials),
        "materials": nearby_materials
    }


@router.get("/materials/bounds")
async def get_materials_by_bounds(
    min_lat: float = Query(..., description="最小纬度"),
    max_lat: float = Query(..., description="最大纬度"),
    min_lng: float = Query(..., description="最小经度"),
    max_lng: float = Query(..., description="最大经度"),
    category: Optional[str] = Query(None, description="原料分类筛选"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial).filter(
        RawMaterial.latitude.isnot(None),
        RawMaterial.longitude.isnot(None),
        RawMaterial.latitude >= min_lat,
        RawMaterial.latitude <= max_lat,
        RawMaterial.longitude >= min_lng,
        RawMaterial.longitude <= max_lng,
        RawMaterial.is_active == True
    )

    if category:
        query = query.filter(RawMaterial.category == category)

    materials = query.all()

    return {
        "bounds": {
            "min_latitude": min_lat,
            "max_latitude": max_lat,
            "min_longitude": min_lng,
            "max_longitude": max_lng
        },
        "total": len(materials),
        "materials": [
            {
                "material_code": mat.material_code,
                "name": mat.name,
                "category": mat.category,
                "origin_province": mat.origin_province,
                "origin_city": mat.origin_city,
                "latitude": mat.latitude,
                "longitude": mat.longitude,
                "craft_type": mat.craft_type
            }
            for mat in materials
        ]
    }


@router.get("/statistics/province")
async def get_statistics_by_province(
    category: Optional[str] = Query(None, description="原料分类筛选"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial).filter(RawMaterial.is_active == True)
    if category:
        query = query.filter(RawMaterial.category == category)

    materials = query.all()

    province_stats: Dict[str, Dict] = {}
    for material in materials:
        province = material.origin_province or "未知"
        if province not in province_stats:
            province_stats[province] = {
                "count": 0,
                "cities": set(),
                "categories": set(),
                "material_codes": []
            }
        province_stats[province]["count"] += 1
        if material.origin_city:
            province_stats[province]["cities"].add(material.origin_city)
        if material.category:
            province_stats[province]["categories"].add(material.category)
        province_stats[province]["material_codes"].append(material.material_code)

    result = []
    for province, stats in province_stats.items():
        result.append({
            "province": province,
            "count": stats["count"],
            "city_count": len(stats["cities"]),
            "categories": list(stats["categories"]),
            "material_codes": stats["material_codes"]
        })

    result.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_provinces": len(result),
        "total_materials": len(materials),
        "statistics": result
    }


@router.get("/statistics/city")
async def get_statistics_by_city(
    province: Optional[str] = Query(None, description="省份筛选"),
    category: Optional[str] = Query(None, description="原料分类筛选"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial).filter(RawMaterial.is_active == True)
    if province:
        query = query.filter(RawMaterial.origin_province == province)
    if category:
        query = query.filter(RawMaterial.category == category)

    materials = query.all()

    city_stats: Dict[str, Dict] = {}
    for material in materials:
        city = material.origin_city or "未知"
        if city not in city_stats:
            city_stats[city] = {
                "province": material.origin_province,
                "count": 0,
                "villages": set(),
                "avg_coordinates": {"lat": 0.0, "lng": 0.0},
                "coordinates_count": 0
            }
        city_stats[city]["count"] += 1
        if material.origin_village:
            city_stats[city]["villages"].add(material.origin_village)
        if material.latitude and material.longitude:
            city_stats[city]["avg_coordinates"]["lat"] += material.latitude
            city_stats[city]["avg_coordinates"]["lng"] += material.longitude
            city_stats[city]["coordinates_count"] += 1

    result = []
    for city, stats in city_stats.items():
        if stats["coordinates_count"] > 0:
            stats["avg_coordinates"]["lat"] /= stats["coordinates_count"]
            stats["avg_coordinates"]["lng"] /= stats["coordinates_count"]

        result.append({
            "city": city,
            "province": stats["province"],
            "count": stats["count"],
            "village_count": len(stats["villages"]),
            "avg_coordinates": stats["avg_coordinates"] if stats["coordinates_count"] > 0 else None
        })

    result.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_cities": len(result),
        "total_materials": len(materials),
        "statistics": result
    }


@router.get("/distance/calculate")
async def calculate_material_distance(
    material_code1: str = Query(..., description="第一个原料编号"),
    material_code2: str = Query(..., description="第二个原料编号"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    mat1 = db.query(RawMaterial).filter(RawMaterial.material_code == material_code1).first()
    mat2 = db.query(RawMaterial).filter(RawMaterial.material_code == material_code2).first()

    if not mat1 or not mat2:
        return {"error": "原料不存在", "valid": False}

    if not mat1.latitude or not mat1.longitude or not mat2.latitude or not mat2.longitude:
        return {"error": "原料缺少地理坐标信息", "valid": False}

    distance = calculate_distance(
        mat1.latitude, mat1.longitude,
        mat2.latitude, mat2.longitude
    )

    return {
        "valid": True,
        "material1": {
            "code": mat1.material_code,
            "name": mat1.name,
            "location": f"{mat1.origin_province}{mat1.origin_city}",
            "coordinates": {"latitude": mat1.latitude, "longitude": mat1.longitude}
        },
        "material2": {
            "code": mat2.material_code,
            "name": mat2.name,
            "location": f"{mat2.origin_province}{mat2.origin_city}",
            "coordinates": {"latitude": mat2.latitude, "longitude": mat2.longitude}
        },
        "distance_km": round(distance, 2)
    }


@router.get("/batches/location")
async def get_batches_by_location(
    province: Optional[str] = Query(None, description="省份"),
    city: Optional[str] = Query(None, description="城市"),
    status: Optional[str] = Query(None, description="批次状态"),
    batch_db: Session = Depends(get_batch_db),
    trace_db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    materials_query = trace_db.query(RawMaterial).filter(RawMaterial.is_active == True)
    if province:
        materials_query = materials_query.filter(RawMaterial.origin_province == province)
    if city:
        materials_query = materials_query.filter(RawMaterial.origin_city == city)

    materials = materials_query.all()
    material_codes = [m.material_code for m in materials]

    batches_query = batch_db.query(MaterialBatch).filter(
        MaterialBatch.material_code.in_(material_codes)
    )
    if status:
        batches_query = batches_query.filter(MaterialBatch.status == status)

    batches = batches_query.order_by(MaterialBatch.created_at.desc()).all()

    return {
        "filter": {
            "province": province,
            "city": city,
            "status": status
        },
        "total_materials": len(materials),
        "total_batches": len(batches),
        "batches": [
            {
                "batch_id": batch.batch_id,
                "material_code": batch.material_code,
                "material_name": batch.material_name,
                "location": f"{province or ''}{city or ''}",
                "production_date": batch.production_date.isoformat() if batch.production_date else None,
                "quantity": batch.quantity,
                "unit": batch.unit,
                "grade": batch.grade,
                "status": batch.status,
                "warning_status": batch.warning_status
            }
            for batch in batches
        ]
    }


@router.get("/heatmap/data")
async def get_heatmap_data(
    category: Optional[str] = Query(None, description="原料分类筛选"),
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    query = db.query(RawMaterial).filter(
        RawMaterial.latitude.isnot(None),
        RawMaterial.longitude.isnot(None),
        RawMaterial.is_active == True
    )
    if category:
        query = query.filter(RawMaterial.category == category)

    materials = query.all()

    heatmap_points = []
    for material in materials:
        heatmap_points.append({
            "latitude": material.latitude,
            "longitude": material.longitude,
            "weight": 1,
            "material_code": material.material_code,
            "name": material.name,
            "category": material.category
        })

    return {
        "total_points": len(heatmap_points),
        "heatmap_data": heatmap_points
    }


@router.get("/regions/list")
async def get_all_regions(
    db: Session = Depends(get_traceability_db),
    auth: dict = Depends(authenticate)
):
    materials = db.query(RawMaterial).filter(
        RawMaterial.is_active == True
    ).all()

    region_tree: Dict[str, Dict] = {}

    for material in materials:
        province = material.origin_province or "未知省份"
        city = material.origin_city or "未知城市"
        village = material.origin_village or "未知村落"

        if province not in region_tree:
            region_tree[province] = {"cities": {}, "count": 0}

        if city not in region_tree[province]["cities"]:
            region_tree[province]["cities"][city] = {"villages": set(), "count": 0}

        region_tree[province]["count"] += 1
        region_tree[province]["cities"][city]["count"] += 1
        region_tree[province]["cities"][city]["villages"].add(village)

    result = []
    for province, p_data in region_tree.items():
        cities_list = []
        for city, c_data in p_data["cities"].items():
            cities_list.append({
                "name": city,
                "count": c_data["count"],
                "villages": list(c_data["villages"]),
                "village_count": len(c_data["villages"])
            })
        cities_list.sort(key=lambda x: x["count"], reverse=True)

        result.append({
            "province": province,
            "count": p_data["count"],
            "cities": cities_list,
            "city_count": len(cities_list)
        })

    result.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_provinces": len(result),
        "regions": result
    }
