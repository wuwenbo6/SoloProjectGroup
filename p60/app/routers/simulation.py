from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from ..auth import get_current_active_user
from .. import models, schemas
from ..assembly_simulation import simulate_assembly, AssemblyParameters

router = APIRouter(prefix="/simulation", tags=["Assembly Simulation"])


@router.post("/assembly", response_model=schemas.AssemblySimulationResponse)
def simulate_assembly_process(
    request: schemas.AssemblySimulationRequest,
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

    dimensions = AssemblyParameters(
        mortise_width=structure.mortise_width,
        mortise_height=structure.mortise_height,
        mortise_depth=structure.mortise_depth,
        tenon_width=structure.tenon_width,
        tenon_height=structure.tenon_height,
        tenon_length=structure.tenon_length,
        fit_clearance=structure.fit_clearance,
        shoulder_length=structure.shoulder_length,
        friction_coefficient=request.friction_coefficient,
        wood_compressive_strength=wood_type.compressive_strength,
        wood_hardness=wood_type.hardness
    )

    result = simulate_assembly(
        structure_id=structure.id,
        assembly_force=request.assembly_force,
        insertion_depth=request.insertion_depth,
        friction_coefficient=request.friction_coefficient,
        dimensions=dimensions
    )

    db_simulation = models.AssemblySimulation(
        structure_id=structure.id,
        assembly_force=request.assembly_force,
        insertion_depth=result["insertion_depth"],
        friction_coefficient=request.friction_coefficient,
        contact_pressure_distribution=result["contact_pressure_distribution"],
        stress_during_assembly=result["stress_during_assembly"],
        assembly_stages=result["assembly_stages"],
        estimated_assembly_time=result["estimated_assembly_time"],
        difficulty_score=result["difficulty_score"],
        recommendations=result["recommendations"]
    )

    db.add(db_simulation)
    db.commit()
    db.refresh(db_simulation)

    return db_simulation


@router.get("/assembly", response_model=List[schemas.AssemblySimulationResponse])
def list_assembly_simulations(
    structure_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(models.AssemblySimulation).options(
        joinedload(models.AssemblySimulation.structure).joinedload(models.MortiseTenonStructure.wood_type)
    ).join(models.MortiseTenonStructure).filter(
        models.MortiseTenonStructure.owner_id == current_user.id
    )

    if structure_id:
        query = query.filter(models.AssemblySimulation.structure_id == structure_id)

    simulations = query.order_by(
        models.AssemblySimulation.created_at.desc()
    ).offset(skip).limit(limit).all()
    return simulations


@router.get("/assembly/{simulation_id}", response_model=schemas.AssemblySimulationResponse)
def get_assembly_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    simulation = db.query(models.AssemblySimulation).options(
        joinedload(models.AssemblySimulation.structure).joinedload(models.MortiseTenonStructure.wood_type)
    ).join(models.MortiseTenonStructure).filter(
        models.AssemblySimulation.id == simulation_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()

    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return simulation


@router.delete("/assembly/{simulation_id}")
def delete_assembly_simulation(
    simulation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    simulation = db.query(models.AssemblySimulation).join(models.MortiseTenonStructure).filter(
        models.AssemblySimulation.id == simulation_id,
        models.MortiseTenonStructure.owner_id == current_user.id
    ).first()

    if not simulation:
        raise HTTPException(status_code=404, detail="Simulation not found")

    db.delete(simulation)
    db.commit()
    return {"message": "Simulation deleted successfully"}
