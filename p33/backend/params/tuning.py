from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from database import get_db
from models import CameraProfile

router = APIRouter()


class FilmParams(BaseModel):
    id: Optional[int] = None
    name: str
    camera_model: str
    film_type: str
    film_format: str = "135"
    description: Optional[str] = None
    
    scan_resolution: int = 2400
    exposure_compensation: float = 0.0
    contrast: float = 1.0
    brightness: float = 0.0
    saturation: float = 1.0
    color_temperature: int = 5500
    sharpness: float = 1.0
    noise_reduction: int = 50
    scratch_removal: bool = True
    fade_correction: bool = True


class ParamsImportExport(BaseModel):
    version: str = "1.0"
    profiles: List[FilmParams]


@router.get("/profiles", response_model=List[FilmParams])
async def list_profiles(db: Session = Depends(get_db)):
    profiles = db.query(CameraProfile).all()
    return [
        FilmParams(
            id=p.id,
            name=p.name,
            camera_model=p.camera_model,
            film_type=p.film_type,
            film_format=p.film_format,
            description=p.description,
            scan_resolution=p.scan_resolution,
            exposure_compensation=p.exposure_compensation,
            contrast=p.contrast,
            brightness=p.brightness,
            saturation=p.saturation,
            color_temperature=p.color_temperature,
            sharpness=p.sharpness,
            noise_reduction=p.noise_reduction,
            scratch_removal=p.scratch_removal,
            fade_correction=p.fade_correction
        )
        for p in profiles
    ]


@router.get("/profiles/{profile_id}", response_model=FilmParams)
async def get_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(CameraProfile).filter(CameraProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="参数方案不存在")
    return FilmParams(
        id=profile.id,
        name=profile.name,
        camera_model=profile.camera_model,
        film_type=profile.film_type,
        film_format=profile.film_format,
        description=profile.description,
        scan_resolution=profile.scan_resolution,
        exposure_compensation=profile.exposure_compensation,
        contrast=profile.contrast,
        brightness=profile.brightness,
        saturation=profile.saturation,
        color_temperature=profile.color_temperature,
        sharpness=profile.sharpness,
        noise_reduction=profile.noise_reduction,
        scratch_removal=profile.scratch_removal,
        fade_correction=profile.fade_correction
    )


@router.post("/profiles", response_model=FilmParams)
async def create_profile(params: FilmParams, db: Session = Depends(get_db)):
    profile = CameraProfile(
        name=params.name,
        camera_model=params.camera_model,
        film_type=params.film_type,
        film_format=params.film_format,
        description=params.description,
        scan_resolution=params.scan_resolution,
        exposure_compensation=params.exposure_compensation,
        contrast=params.contrast,
        brightness=params.brightness,
        saturation=params.saturation,
        color_temperature=params.color_temperature,
        sharpness=params.sharpness,
        noise_reduction=params.noise_reduction,
        scratch_removal=params.scratch_removal,
        fade_correction=params.fade_correction
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    params.id = profile.id
    return params


@router.put("/profiles/{profile_id}", response_model=FilmParams)
async def update_profile(profile_id: int, params: FilmParams, db: Session = Depends(get_db)):
    profile = db.query(CameraProfile).filter(CameraProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="参数方案不存在")
    
    profile.name = params.name
    profile.camera_model = params.camera_model
    profile.film_type = params.film_type
    profile.film_format = params.film_format
    profile.description = params.description
    profile.scan_resolution = params.scan_resolution
    profile.exposure_compensation = params.exposure_compensation
    profile.contrast = params.contrast
    profile.brightness = params.brightness
    profile.saturation = params.saturation
    profile.color_temperature = params.color_temperature
    profile.sharpness = params.sharpness
    profile.noise_reduction = params.noise_reduction
    profile.scratch_removal = params.scratch_removal
    profile.fade_correction = params.fade_correction
    
    db.commit()
    return params


@router.delete("/profiles/{profile_id}")
async def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.query(CameraProfile).filter(CameraProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="参数方案不存在")
    db.delete(profile)
    db.commit()
    return {"status": "deleted"}


@router.post("/export")
async def export_profiles(db: Session = Depends(get_db)):
    profiles = db.query(CameraProfile).all()
    data = ParamsImportExport(
        profiles=[
            FilmParams(
                id=p.id,
                name=p.name,
                camera_model=p.camera_model,
                film_type=p.film_type,
                film_format=p.film_format,
                description=p.description,
                scan_resolution=p.scan_resolution,
                exposure_compensation=p.exposure_compensation,
                contrast=p.contrast,
                brightness=p.brightness,
                saturation=p.saturation,
                color_temperature=p.color_temperature,
                sharpness=p.sharpness,
                noise_reduction=p.noise_reduction,
                scratch_removal=p.scratch_removal,
                fade_correction=p.fade_correction
            )
            for p in profiles
        ]
    )
    return data


@router.post("/import")
async def import_profiles(data: ParamsImportExport, db: Session = Depends(get_db)):
    imported = 0
    for params in data.profiles:
        profile = CameraProfile(
            name=params.name,
            camera_model=params.camera_model,
            film_type=params.film_type,
            film_format=params.film_format,
            description=params.description,
            scan_resolution=params.scan_resolution,
            exposure_compensation=params.exposure_compensation,
            contrast=params.contrast,
            brightness=params.brightness,
            saturation=params.saturation,
            color_temperature=params.color_temperature,
            sharpness=params.sharpness,
            noise_reduction=params.noise_reduction,
            scratch_removal=params.scratch_removal,
            fade_correction=params.fade_correction
        )
        db.add(profile)
        imported += 1
    db.commit()
    return {"imported": imported}


@router.get("/presets/{film_format}")
async def get_presets(film_format: str):
    presets = {
        "135": [
            {"name": "柯达Gold 200", "iso": 200, "color_temp": 5200},
            {"name": "富士Provia 100F", "iso": 100, "color_temp": 5500},
            {"name": "伊尔福HP5", "iso": 400, "color_temp": 5000}
        ],
        "120": [
            {"name": "柯达Portra 400", "iso": 400, "color_temp": 5200},
            {"name": "富士Velvia 50", "iso": 50, "color_temp": 5500},
            {"name": "伊尔福Delta 100", "iso": 100, "color_temp": 5000}
        ]
    }
    return presets.get(film_format, [])
