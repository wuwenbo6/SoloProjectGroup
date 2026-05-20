from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..auth import get_current_active_user
from .. import models, schemas
from ..stress_analysis import (
    perform_stress_analysis,
    JointDimensions,
    MaterialProperties
)
from ..stress_alert import check_structure_safety
from ..data_export import (
    export_stress_analysis_to_csv,
    export_structures_to_csv,
    generate_export_filename
)
from ..structure_classifier import classify_joint, get_all_joint_types

router = APIRouter(prefix="/analysis", tags=["Stress Analysis"])


@router.post("/stress", response_model=schemas.StressAnalysisResponse)
def analyze_stress(
    request: schemas.StressAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    structure = db.query(models.MortiseTenonStructure).options(
        joinedload(models.MortiseTenonStructure.wood_type)
    ).filter(
        models.MortiseTenonStructure.id == request.structure_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()

    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    wood_type = structure.wood_type
    if not wood_type:
        raise HTTPException(status_code=400, detail="Wood type not found")

    if request.use_third_party_data:
        third_party_data = db.query(models.ThirdPartyTestData).filter(
            models.ThirdPartyTestData.wood_type_id == wood_type.id,
            models.ThirdPartyTestData.is_synced == True
        ).order_by(
            models.ThirdPartyTestData.created_at.desc()
        ).first()

        if third_party_data:
            material = MaterialProperties(
                elastic_modulus=third_party_data.elastic_modulus,
                shear_modulus=third_party_data.shear_modulus,
                tensile_strength=third_party_data.tensile_strength,
                compressive_strength=third_party_data.compressive_strength,
                bending_strength=third_party_data.bending_strength
            )
        else:
            material = MaterialProperties(
                elastic_modulus=wood_type.elastic_modulus,
                shear_modulus=wood_type.shear_modulus,
                tensile_strength=wood_type.tensile_strength,
                compressive_strength=wood_type.compressive_strength,
                bending_strength=wood_type.bending_strength
            )
    else:
        material = MaterialProperties(
            elastic_modulus=wood_type.elastic_modulus,
            shear_modulus=wood_type.shear_modulus,
            tensile_strength=wood_type.tensile_strength,
            compressive_strength=wood_type.compressive_strength,
            bending_strength=wood_type.bending_strength
        )

    dimensions = JointDimensions(
        mortise_width=structure.mortise_width,
        mortise_height=structure.mortise_height,
        mortise_depth=structure.mortise_depth,
        tenon_width=structure.tenon_width,
        tenon_height=structure.tenon_height,
        tenon_length=structure.tenon_length,
        fit_clearance=structure.fit_clearance,
        shoulder_length=structure.shoulder_length
    )

    result = perform_stress_analysis(
        structure_id=structure.id,
        force_direction=request.force_direction,
        applied_force=request.applied_force,
        dimensions=dimensions,
        material=material,
        use_third_party_data=request.use_third_party_data
    )

    db_analysis = models.StressAnalysis(
        structure_id=structure.id,
        force_direction=request.force_direction,
        applied_force=request.applied_force,
        max_stress=result["max_stress"],
        min_stress=result["min_stress"],
        avg_stress=result["avg_stress"],
        stress_distribution=result["stress_distribution"],
        safety_factor=result["safety_factor"],
        failure_probability=result["failure_probability"],
        critical_points=result["critical_points"],
        used_third_party_data=result["used_third_party_data"]
    )

    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)

    return db_analysis


@router.get("/stress", response_model=List[schemas.StressAnalysisResponse])
def list_stress_analyses(
    structure_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.StressAnalysis).options(
        joinedload(models.StressAnalysis.structure).joinedload(models.MortiseTenonStructure.wood_type)
    ).join(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.owner_id == current_user.id
    )

    if structure_id:
        query = query.filter(models.StressAnalysis.structure_id == structure_id)

    analyses = query.order_by(
        models.StressAnalysis.created_at.desc()
    ).offset(skip).limit(limit).all()
    return analyses


@router.get("/stress/{analysis_id}", response_model=schemas.StressAnalysisResponse)
def get_stress_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    analysis = db.query(models.StressAnalysis).options(
        joinedload(models.StressAnalysis.structure).joinedload(models.MortiseTenonStructure.wood_type)
    ).join(models.MortiseTenonStructure).filter(
        models.StressAnalysis.id == analysis_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis


@router.delete("/stress/{analysis_id}")
def delete_stress_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    analysis = db.query(models.StressAnalysis).join(models.MortiseTenonStructure).filter(
        models.StressAnalysis.id == analysis_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    db.delete(analysis)
    db.commit()
    return {"message": "Analysis deleted successfully"}


@router.get("/alert/{structure_id}")
def get_stress_alerts(
    structure_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    structure = db.query(models.MortiseTenonStructure).options(
        joinedload(models.MortiseTenonStructure.wood_type),
        joinedload(models.MortiseTenonStructure.stress_analyses)
    ).filter(
        models.MortiseTenonStructure.id == structure_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()

    if not structure:
        raise HTTPException(status_code=404, detail="Structure not found")

    wood_type = structure.wood_type
    if not wood_type:
        raise HTTPException(status_code=400, detail="Wood type not found")

    wood_props = {
        "elastic_modulus": wood_type.elastic_modulus,
        "tensile_strength": wood_type.tensile_strength,
        "compressive_strength": wood_type.compressive_strength
    }

    analyses_data = []
    for analysis in structure.stress_analyses:
        analyses_data.append({
            "id": analysis.id,
            "force_direction": analysis.force_direction,
            "max_stress": analysis.max_stress,
            "safety_factor": analysis.safety_factor,
            "failure_probability": analysis.failure_probability,
            "critical_points": analysis.critical_points or [],
            "stress_distribution": analysis.stress_distribution or {}
        })

    result = check_structure_safety(
        structure_id=structure_id,
        stress_results=analyses_data,
        wood_properties=wood_props
    )

    return result


@router.get("/export/stress/csv")
def export_stress_csv(
    structure_id: Optional[int] = None,
    include_details: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.StressAnalysis).options(
        joinedload(models.StressAnalysis.structure).joinedload(models.MortiseTenonStructure.wood_type)
    ).join(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.owner_id == current_user.id
    )

    if structure_id:
        query = query.filter(models.StressAnalysis.structure_id == structure_id)

    analyses = query.order_by(models.StressAnalysis.created_at.desc()).all()

    analyses_dict = []
    for a in analyses:
        structure = a.structure
        analyses_dict.append({
            "id": a.id,
            "structure_id": a.structure_id,
            "structure": {
                "name": structure.name if structure else "",
                "wood_type": {
                    "name": structure.wood_type.name if structure and structure.wood_type else "",
                    "elastic_modulus": structure.wood_type.elastic_modulus if structure and structure.wood_type else 0,
                    "tensile_strength": structure.wood_type.tensile_strength if structure and structure.wood_type else 0,
                    "compressive_strength": structure.wood_type.compressive_strength if structure and structure.wood_type else 0
                } if structure and structure.wood_type else {}
            },
            "force_direction": a.force_direction,
            "applied_force": a.applied_force,
            "max_stress": a.max_stress,
            "min_stress": a.min_stress,
            "avg_stress": a.avg_stress,
            "safety_factor": a.safety_factor,
            "failure_probability": a.failure_probability,
            "used_third_party_data": a.used_third_party_data,
            "created_at": a.created_at
        })

    csv_data = export_stress_analysis_to_csv(analyses_dict, include_details)
    filename = generate_export_filename("stress_analysis")

    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/structures/csv")
def export_structures_csv(
    include_stress_history: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.MortiseTenonStructure).options(
        joinedload(models.MortiseTenonStructure.wood_type)
    ).filter(
        models.MortiseTenonStructure.owner_id == current_user.id
    )

    if include_stress_history:
        query = query.options(
            joinedload(models.MortiseTenonStructure.stress_analyses)
        )

    structures = query.order_by(models.MortiseTenonStructure.created_at.desc()).all()

    structures_dict = []
    for s in structures:
        wood_type = s.wood_type
        structures_dict.append({
            "id": s.id,
            "name": s.name,
            "structure_type": s.structure_type,
            "description": s.description,
            "mortise_width": s.mortise_width,
            "mortise_height": s.mortise_height,
            "mortise_depth": s.mortise_depth,
            "tenon_width": s.tenon_width,
            "tenon_height": s.tenon_height,
            "tenon_length": s.tenon_length,
            "fit_clearance": s.fit_clearance,
            "shoulder_length": s.shoulder_length,
            "wood_type_id": s.wood_type_id,
            "wood_type": {"name": wood_type.name} if wood_type else {},
            "created_at": s.created_at,
            "updated_at": s.updated_at,
            "stress_analyses": [
                {
                    "max_stress": a.max_stress,
                    "safety_factor": a.safety_factor
                }
                for a in s.stress_analyses
            ] if include_stress_history else []
        })

    csv_data = export_structures_to_csv(structures_dict, include_stress_history)
    filename = generate_export_filename("joint_structures")

    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/classify")
def classify_structure(
    request: schemas.MortiseTenonStructureCreate,
    current_user: models.User = Depends(get_current_active_user)
):
    params = {
        "mortise_width": request.mortise_width,
        "mortise_height": request.mortise_height,
        "mortise_depth": request.mortise_depth,
        "tenon_width": request.tenon_width,
        "tenon_height": request.tenon_height,
        "tenon_length": request.tenon_length,
        "fit_clearance": request.fit_clearance,
        "shoulder_length": request.shoulder_length
    }

    result = classify_joint(params)
    return result


@router.get("/joint-types")
def get_joint_types(
    current_user: models.User = Depends(get_current_active_user)
):
    return {"joint_types": get_all_joint_types()}
