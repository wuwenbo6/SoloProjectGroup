import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from parameters import ParameterManager
from numerical import NumericalCalculator
from simulation import StressSimulation
import warnings


@dataclass
class JointConnection:
    joint_id: str
    joint_type: str
    position: Tuple[float, float, float]
    orientation: str
    connected_beams: Tuple[str, str]
    parameters: Dict[str, Any]


@dataclass
class BeamElement:
    beam_id: str
    length: float
    width: float
    height: float
    material: str
    start_pos: Tuple[float, float, float]
    end_pos: Tuple[float, float, float]


class MultiJointStructure:
    def __init__(self):
        self.beams: Dict[str, BeamElement] = {}
        self.joints: Dict[str, JointConnection] = {}
        self.loads: List[Dict[str, Any]] = []
        self.boundary_conditions: List[Dict[str, Any]] = []
        self.calculator = NumericalCalculator()
    
    def add_beam(self, 
                  beam_id: str,
                  length: float,
                  width: float,
                  height: float,
                  material: str,
                  start_pos: Tuple[float, float, float],
                  end_pos: Tuple[float, float, float]) -> None:
        self.beams[beam_id] = BeamElement(
            beam_id=beam_id,
            length=length,
            width=width,
            height=height,
            material=material,
            start_pos=start_pos,
            end_pos=end_pos
        )
    
    def add_joint(self,
                   joint_id: str,
                   joint_type: str,
                   position: Tuple[float, float, float],
                   orientation: str,
                   connected_beams: Tuple[str, str],
                   tenon_length: float,
                   tenon_width: float,
                   mortise_depth: float,
                   friction_coefficient: float = 0.5) -> None:
        if connected_beams[0] not in self.beams or connected_beams[1] not in self.beams:
            raise ValueError(f"One or both beams {connected_beams} not found in structure")
        
        beam0 = self.beams[connected_beams[0]]
        self.joints[joint_id] = JointConnection(
            joint_id=joint_id,
            joint_type=joint_type,
            position=position,
            orientation=orientation,
            connected_beams=connected_beams,
            parameters={
                'tenon_length': tenon_length,
                'tenon_width': tenon_width,
                'mortise_depth': mortise_depth,
                'friction_coefficient': friction_coefficient,
                'beam_width': beam0.width,
                'beam_height': beam0.height,
                'beam_length': beam0.length,
                'wood_type': beam0.material
            }
        )
    
    def add_load(self,
                  position: Tuple[float, float, float],
                  magnitude: float,
                  direction: Tuple[float, float, float],
                  load_type: str = 'concentrated') -> None:
        direction_norm = np.array(direction)
        direction_norm = direction_norm / np.linalg.norm(direction_norm)
        
        self.loads.append({
            'position': position,
            'magnitude': magnitude,
            'direction': direction_norm.tolist(),
            'type': load_type
        })
    
    def add_boundary_condition(self,
                                position: Tuple[float, float, float],
                                constraints: Dict[str, bool]) -> None:
        self.boundary_conditions.append({
            'position': position,
            'constraints': constraints
        })
    
    def calculate_load_distribution(self) -> Dict[str, Any]:
        if not self.joints:
            raise ValueError("No joints defined in the structure")
        
        total_load = sum(load['magnitude'] for load in self.loads)
        joint_positions = np.array([joint.position for joint in self.joints.values()])
        
        load_distribution = {}
        
        for load in self.loads:
            load_pos = np.array(load['position'])
            distances = np.linalg.norm(joint_positions - load_pos, axis=1)
            
            if np.sum(distances) == 0:
                weights = np.ones_like(distances) / len(distances)
            else:
                weights = 1.0 / (distances + 1e-6)
                weights /= weights.sum()
            
            for i, (joint_id, joint) in enumerate(self.joints.items()):
                if joint_id not in load_distribution:
                    load_distribution[joint_id] = {
                        'total_load': 0.0,
                        'axial_component': 0.0,
                        'shear_component': 0.0,
                        'bending_component': 0.0,
                        'loads': []
                    }
                
                joint_load = load['magnitude'] * weights[i]
                load_distribution[joint_id]['total_load'] += joint_load
                
                direction = np.array(load['direction'])
                load_distribution[joint_id]['axial_component'] += joint_load * direction[0]
                load_distribution[joint_id]['shear_component'] += joint_load * np.sqrt(direction[1]**2 + direction[2]**2)
                load_distribution[joint_id]['bending_component'] += joint_load * direction[1]
                
                load_distribution[joint_id]['loads'].append({
                    'magnitude': joint_load,
                    'direction': load['direction'],
                    'weight': weights[i]
                })
        
        return load_distribution
    
    def simulate_joint_interactions(self,
                                     load_distribution: Dict[str, Any]) -> Dict[str, Any]:
        joint_results = {}
        
        for joint_id, load_info in load_distribution.items():
            joint = self.joints[joint_id]
            beam = self.beams[joint.connected_beams[0]]
            
            pm = ParameterManager()
            pm.set_structure_parameters(
                wood_type=joint.parameters['wood_type'],
                joint_type=joint.joint_type,
                beam_width=joint.parameters['beam_width'],
                beam_height=joint.parameters['beam_height'],
                beam_length=joint.parameters['beam_length'],
                tenon_length=joint.parameters['tenon_length'],
                tenon_width=joint.parameters['tenon_width'],
                mortise_depth=joint.parameters['mortise_depth'],
                load_magnitude=load_info['total_load'],
                load_direction='bending' if load_info['bending_component'] > load_info['shear_component'] else 'shear',
                friction_coefficient=joint.parameters['friction_coefficient']
            )
            
            sim = StressSimulation(pm)
            result = sim.run_simulation()
            result['load_distribution'] = load_info
            result['joint_id'] = joint_id
            result['position'] = joint.position
            joint_results[joint_id] = result
        
        return joint_results
    
    def calculate_force_transfer_matrix(self,
                                         joint_results: Dict[str, Any]) -> np.ndarray:
        n_joints = len(self.joints)
        joint_ids = list(self.joints.keys())
        
        transfer_matrix = np.zeros((n_joints, n_joints))
        
        for i, id1 in enumerate(joint_ids):
            for j, id2 in enumerate(joint_ids):
                if i != j:
                    pos1 = np.array(self.joints[id1].position)
                    pos2 = np.array(self.joints[id2].position)
                    distance = np.linalg.norm(pos2 - pos1)
                    
                    if distance > 0:
                        stiffness1 = joint_results[id1]['joint_stiffness']
                        stiffness2 = joint_results[id2]['joint_stiffness']
                        
                        transfer_matrix[i, j] = min(stiffness1, stiffness2) / (distance + 1e-3)
        
        row_sums = transfer_matrix.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1
        return transfer_matrix / row_sums
    
    def run_co_simulation(self) -> Dict[str, Any]:
        if len(self.beams) == 0:
            raise ValueError("No beams defined in the structure")
        if len(self.joints) == 0:
            raise ValueError("No joints defined in the structure")
        
        load_distribution = self.calculate_load_distribution()
        joint_results = self.simulate_joint_interactions(load_distribution)
        transfer_matrix = self.calculate_force_transfer_matrix(joint_results)
        
        overall_safety_factor = min(result['safety_factors']['overall'] 
                                   for result in joint_results.values())
        overall_max_stress = max(result['max_stresses']['max_von_mises'] 
                                for result in joint_results.values())
        overall_deformation = sum(result['deformation']['total'] 
                                  for result in joint_results.values())
        
        interaction_factors = self._calculate_interaction_factors(joint_results)
        
        return {
            'structure_summary': {
                'n_beams': len(self.beams),
                'n_joints': len(self.joints),
                'total_load': sum(load['magnitude'] for load in self.loads),
                'overall_safety_factor': overall_safety_factor,
                'overall_max_stress_mpa': overall_max_stress / 1e6,
                'total_deformation_mm': overall_deformation * 1000
            },
            'load_distribution': load_distribution,
            'joint_results': joint_results,
            'force_transfer_matrix': transfer_matrix,
            'interaction_factors': interaction_factors,
            'joint_ids': list(self.joints.keys())
        }
    
    def _calculate_interaction_factors(self,
                                        joint_results: Dict[str, Any]) -> Dict[str, float]:
        interactions = {}
        joint_ids = list(self.joints.keys())
        
        for i, id1 in enumerate(joint_ids):
            interaction_sum = 0.0
            for j, id2 in enumerate(joint_ids):
                if i != j:
                    sf1 = joint_results[id1]['safety_factors']['overall']
                    sf2 = joint_results[id2]['safety_factors']['overall']
                    
                    if sf1 > 0 and sf2 > 0:
                        interaction_sum += abs(sf1 - sf2) / max(sf1, sf2)
            
            interactions[id1] = interaction_sum / max(len(joint_ids) - 1, 1)
        
        return interactions


def create_frame_structure(n_joints: int = 2,
                            beam_length: float = 0.3,
                            beam_width: float = 0.05,
                            beam_height: float = 0.05,
                            material: str = 'oak') -> MultiJointStructure:
    structure = MultiJointStructure()
    
    for i in range(n_joints + 1):
        structure.add_beam(
            beam_id=f'beam_{i}',
            length=beam_length,
            width=beam_width,
            height=beam_height,
            material=material,
            start_pos=(i * beam_length, 0, 0),
            end_pos=((i + 1) * beam_length, 0, 0)
        )
    
    for i in range(n_joints):
        joint_pos = ((i + 0.5) * beam_length, 0, 0)
        structure.add_joint(
            joint_id=f'joint_{i}',
            joint_type='mortise_tenon',
            position=joint_pos,
            orientation='horizontal',
            connected_beams=(f'beam_{i}', f'beam_{i+1}'),
            tenon_length=0.03,
            tenon_width=0.02,
            mortise_depth=0.02,
            friction_coefficient=0.5
        )
    
    structure.add_load(
        position=((n_joints + 0.5) * beam_length, 0, 0),
        magnitude=1000.0,
        direction=(0, -1, 0),
        load_type='concentrated'
    )
    
    structure.add_boundary_condition(
        position=(0, 0, 0),
        constraints={'x': True, 'y': True, 'z': True, 'rx': True, 'ry': True, 'rz': True}
    )
    
    return structure
