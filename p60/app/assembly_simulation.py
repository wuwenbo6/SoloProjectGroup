import math
from typing import Dict, List, Any
from dataclasses import dataclass


@dataclass
class AssemblyParameters:
    mortise_width: float
    mortise_height: float
    mortise_depth: float
    tenon_width: float
    tenon_height: float
    tenon_length: float
    fit_clearance: float
    shoulder_length: float
    friction_coefficient: float
    wood_compressive_strength: float
    wood_hardness: float


class AssemblySimulator:
    
    @staticmethod
    def calculate_insertion_force(
        interference: float,
        contact_area: float,
        friction_coeff: float,
        hardness: float
    ) -> float:
        contact_pressure = interference * hardness * 0.1
        normal_force = contact_pressure * contact_area
        insertion_force = normal_force * friction_coeff
        return max(insertion_force, 10.0)
    
    @staticmethod
    def calculate_contact_pressure_distribution(
        insertion_depth: float,
        max_depth: float,
        interference: float,
        hardness: float
    ) -> Dict[str, float]:
        depth_ratio = insertion_depth / max_depth
        
        base_pressure = interference * hardness * 0.1
        
        return {
            "entry_zone": base_pressure * (1.0 + 0.3 * depth_ratio),
            "middle_zone": base_pressure * (0.8 + 0.4 * depth_ratio),
            "end_zone": base_pressure * (1.2 + 0.2 * depth_ratio),
            "shoulder_zone": base_pressure * 1.5 if depth_ratio > 0.95 else 0.0
        }
    
    @staticmethod
    def calculate_stress_during_assembly(
        insertion_force: float,
        dimensions: AssemblyParameters
    ) -> Dict[str, float]:
        mortise_wall_thickness = dimensions.tenon_width * 0.5
        
        contact_area_side = dimensions.tenon_height * dimensions.mortise_depth * 2
        contact_area_end = dimensions.tenon_width * dimensions.tenon_height
        
        bending_moment = insertion_force * (dimensions.tenon_length * 0.3)
        section_modulus = (dimensions.tenon_width * dimensions.tenon_height ** 2) / 6
        bending_stress = bending_moment / section_modulus
        
        compressive_stress_mortise = insertion_force / (mortise_wall_thickness * dimensions.mortise_height * 2)
        
        shear_stress = insertion_force / contact_area_side
        
        return {
            "tenon_bending_stress": bending_stress,
            "mortise_compressive_stress": compressive_stress_mortise,
            "interface_shear_stress": shear_stress,
            "von_mises_stress": math.sqrt(bending_stress ** 2 + 3 * shear_stress ** 2)
        }
    
    @staticmethod
    def generate_assembly_stages(
        total_force: float,
        insertion_depth: float,
        dimensions: AssemblyParameters
    ) -> List[Dict[str, Any]]:
        stages = []
        num_stages = 5
        
        for i in range(num_stages + 1):
            progress = i / num_stages
            current_depth = insertion_depth * progress
            
            if progress < 0.2:
                force_factor = progress * 5 * 0.8
                stage_name = "Initial_alignment"
            elif progress < 0.6:
                force_factor = 0.8 + (progress - 0.2) * 2.5 * 0.3
                stage_name = "Main_insertion"
            elif progress < 0.95:
                force_factor = 1.1 + (progress - 0.6) * 3.33 * 0.4
                stage_name = "Tight_fit_zone"
            else:
                force_factor = 1.5 + (progress - 0.95) * 20 * 0.5
                stage_name = "Shoulder_seating"
            
            current_force = total_force * force_factor
            
            stages.append({
                "stage": stage_name,
                "progress": round(progress * 100, 1),
                "insertion_depth": round(current_depth, 4),
                "required_force": round(current_force, 2),
                "difficulty": "low" if force_factor < 1.0 else "medium" if force_factor < 1.3 else "high"
            })
        
        return stages
    
    @staticmethod
    def calculate_assembly_time(
        dimensions: AssemblyParameters,
        difficulty_score: float
    ) -> float:
        base_time = 30.0
        size_factor = (dimensions.tenon_length * dimensions.tenon_width * dimensions.tenon_height) / 10000
        clearance_factor = 0.1 / max(dimensions.fit_clearance, 0.01)
        
        total_time = base_time * (1 + size_factor * 0.5) * (1 + clearance_factor * 0.3) * difficulty_score
        return round(total_time, 1)
    
    @staticmethod
    def calculate_difficulty_score(
        fit_clearance: float,
        aspect_ratio: float,
        length_ratio: float
    ) -> float:
        clearance_score = max(0.5, 3.0 - fit_clearance * 100)
        aspect_score = 1.0 + abs(1.0 - aspect_ratio) * 0.5
        length_score = 1.0 + max(0, length_ratio - 2.0) * 0.3
        
        total_score = (clearance_score * 0.5 + aspect_score * 0.3 + length_score * 0.2)
        return round(total_score, 2)
    
    @staticmethod
    def generate_recommendations(
        difficulty_score: float,
        max_stress: float,
        material_strength: float
    ) -> str:
        recommendations = []
        
        if difficulty_score > 2.0:
            recommendations.append(
                "High assembly difficulty detected. Consider using a mallet with a soft "
                "strike surface or applying assembly lubricant to reduce friction."
            )
        
        stress_ratio = max_stress / material_strength
        if stress_ratio > 0.6:
            recommendations.append(
                f"High stress levels predicted ({stress_ratio:.1%} of material strength). "
                "Consider increasing fit clearance or using a softer wood species."
            )
        
        if difficulty_score < 1.2:
            recommendations.append(
                "Assembly should be straightforward. Use hand pressure only to seat the joint."
            )
        
        if not recommendations:
            recommendations.append(
                "Standard assembly procedure recommended. Ensure proper alignment before "
                "applying force to avoid damaging the joint."
            )
        
        return " ".join(recommendations)


def simulate_assembly(
    structure_id: int,
    assembly_force: float,
    insertion_depth: float,
    friction_coefficient: float,
    dimensions: AssemblyParameters
) -> Dict[str, Any]:
    simulator = AssemblySimulator()
    
    effective_depth = min(insertion_depth, dimensions.mortise_depth)
    
    contact_pressure = simulator.calculate_contact_pressure_distribution(
        effective_depth,
        dimensions.mortise_depth,
        max(0.5 - dimensions.fit_clearance, 0.1),
        dimensions.wood_hardness
    )
    
    stress = simulator.calculate_stress_during_assembly(assembly_force, dimensions)
    
    assembly_stages = simulator.generate_assembly_stages(
        assembly_force, effective_depth, dimensions
    )
    
    aspect_ratio = dimensions.tenon_width / dimensions.tenon_height
    length_ratio = dimensions.tenon_length / dimensions.tenon_width
    
    difficulty_score = simulator.calculate_difficulty_score(
        dimensions.fit_clearance, aspect_ratio, length_ratio
    )
    
    estimated_time = simulator.calculate_assembly_time(dimensions, difficulty_score)
    
    max_stress = max(stress.values())
    recommendations = simulator.generate_recommendations(
        difficulty_score, max_stress, dimensions.wood_compressive_strength
    )
    
    return {
        "structure_id": structure_id,
        "assembly_force": assembly_force,
        "insertion_depth": effective_depth,
        "friction_coefficient": friction_coefficient,
        "contact_pressure_distribution": contact_pressure,
        "stress_during_assembly": stress,
        "assembly_stages": assembly_stages,
        "estimated_assembly_time": estimated_time,
        "difficulty_score": difficulty_score,
        "recommendations": recommendations
    }
