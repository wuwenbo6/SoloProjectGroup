import re
import numpy as np
from typing import Dict, List, Tuple, Any


class INPParser:
    def __init__(self):
        self.nodes: Dict[int, np.ndarray] = {}
        self.elements: Dict[int, Dict[str, Any]] = {}
        self.materials: Dict[str, Dict[str, float]] = {}
        self.boundary_conditions: List[Dict[str, Any]] = []
        self.loads: List[Dict[str, Any]] = []
        self.element_sets: Dict[str, List[int]] = {}
        self.node_sets: Dict[str, List[int]] = {}

    def parse(self, filepath: str) -> Dict[str, Any]:
        current_section = None
        current_element_type = None
        current_material = None
        current_elset = None
        current_nset = None

        with open(filepath, 'r') as f:
            for line in f:
                line = line.strip()
                
                if not line or line.startswith('**'):
                    continue
                
                if line.startswith('*'):
                    section = line[1:].lower().split(',')[0].strip()
                    
                    if section == 'node':
                        current_section = 'node'
                    elif section == 'element':
                        current_section = 'element'
                        match = re.search(r'type\s*=\s*(\w+)', line.lower())
                        if match:
                            current_element_type = match.group(1).upper()
                        match = re.search(r'elset\s*=\s*(\w+)', line.lower())
                        if match:
                            current_elset = match.group(1)
                    elif section == 'material':
                        current_section = 'material'
                        match = re.search(r'name\s*=\s*(\w+)', line.lower())
                        if match:
                            current_material = match.group(1)
                            self.materials[current_material] = {}
                    elif section == 'elastic':
                        current_section = 'elastic'
                    elif section == 'boundary':
                        current_section = 'boundary'
                    elif section == 'cload':
                        current_section = 'cload'
                    elif section == 'elset':
                        current_section = 'elset'
                        match = re.search(r'elset\s*=\s*(\w+)', line.lower())
                        if match:
                            current_elset = match.group(1)
                            self.element_sets[current_elset] = []
                    elif section == 'nset':
                        current_section = 'nset'
                        match = re.search(r'nset\s*=\s*(\w+)', line.lower())
                        if match:
                            current_nset = match.group(1)
                            self.node_sets[current_nset] = []
                    elif section == 'end step':
                        current_section = None
                    else:
                        current_section = None
                    continue
                
                if current_section == 'node':
                    parts = line.split(',')
                    node_id = int(parts[0].strip())
                    coords = np.array([float(p.strip()) for p in parts[1:4]])
                    self.nodes[node_id] = coords
                
                elif current_section == 'element':
                    parts = line.split(',')
                    elem_id = int(parts[0].strip())
                    node_ids = [int(p.strip()) for p in parts[1:]]
                    self.elements[elem_id] = {
                        'type': current_element_type,
                        'nodes': node_ids,
                        'elset': current_elset
                    }
                    if current_elset and current_elset in self.element_sets:
                        self.element_sets[current_elset].append(elem_id)
                
                elif current_section == 'elastic':
                    parts = line.split(',')
                    if len(parts) >= 2 and current_material:
                        youngs_modulus = float(parts[0].strip())
                        poisson_ratio = float(parts[1].strip())
                        self.materials[current_material]['E'] = youngs_modulus
                        self.materials[current_material]['nu'] = poisson_ratio
                
                elif current_section == 'boundary':
                    parts = line.split(',')
                    if len(parts) >= 3:
                        node_id = int(parts[0].strip())
                        dof = int(parts[1].strip())
                        value = float(parts[2].strip()) if len(parts) > 2 else 0.0
                        self.boundary_conditions.append({
                            'node': node_id,
                            'dof': dof,
                            'value': value
                        })
                
                elif current_section == 'cload':
                    parts = line.split(',')
                    if len(parts) >= 3:
                        node_id = int(parts[0].strip())
                        dof = int(parts[1].strip())
                        value = float(parts[2].strip())
                        self.loads.append({
                            'node': node_id,
                            'dof': dof,
                            'value': value
                        })
                
                elif current_section == 'elset':
                    for part in line.split(','):
                        part = part.strip()
                        if part and current_elset:
                            if '-' in part:
                                start, end = part.split('-')
                                self.element_sets[current_elset].extend(
                                    range(int(start), int(end) + 1)
                                )
                            else:
                                self.element_sets[current_elset].append(int(part))
                
                elif current_section == 'nset':
                    for part in line.split(','):
                        part = part.strip()
                        if part and current_nset:
                            if '-' in part:
                                start, end = part.split('-')
                                self.node_sets[current_nset].extend(
                                    range(int(start), int(end) + 1)
                                )
                            else:
                                self.node_sets[current_nset].append(int(part))
        
        return {
            'nodes': self.nodes,
            'elements': self.elements,
            'materials': self.materials,
            'boundary_conditions': self.boundary_conditions,
            'loads': self.loads,
            'element_sets': self.element_sets,
            'node_sets': self.node_sets
        }

    def get_model_summary(self) -> Dict[str, int]:
        return {
            'num_nodes': len(self.nodes),
            'num_elements': len(self.elements),
            'num_materials': len(self.materials),
            'num_bcs': len(self.boundary_conditions),
            'num_loads': len(self.loads)
        }
