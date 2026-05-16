import numpy as np
from typing import Dict, List, Any


class ResultMerger:
    def __init__(self):
        pass

    def merge(self, model_data: Dict[str, Any], 
              subdomain_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        
        nodes = model_data['nodes']
        elements = model_data['elements']
        
        merged_displacements = self._merge_displacements(nodes, subdomain_results)
        stresses = self._compute_stresses(nodes, elements, merged_displacements, model_data['materials'])
        
        return {
            'nodes': nodes,
            'elements': elements,
            'displacements': merged_displacements,
            'stresses': stresses
        }

    def _merge_displacements(self, nodes: Dict[int, np.ndarray],
                             subdomain_results: List[Dict[str, Any]]) -> Dict[int, np.ndarray]:
        all_displacements: Dict[int, List[np.ndarray]] = {}
        subdomain_interface_nodes: Dict[int, set] = {}
        
        for subdomain_id, result in enumerate(subdomain_results):
            subdomain_disps = result['displacements']
            interface_nodes = result.get('interface_nodes', [])
            subdomain_interface_nodes[subdomain_id] = set(interface_nodes)
            
            for node_id_str, disp in subdomain_disps.items():
                node_id = int(node_id_str)
                if node_id not in all_displacements:
                    all_displacements[node_id] = []
                all_displacements[node_id].append(np.array(disp))
        
        merged_displacements: Dict[int, np.ndarray] = {}
        for node_id, disps_list in all_displacements.items():
            if len(disps_list) == 1:
                merged_displacements[node_id] = disps_list[0]
            else:
                weights = []
                for i, disp in enumerate(disps_list):
                    if node_id in subdomain_interface_nodes.get(i, set()):
                        weights.append(1.0)
                    else:
                        weights.append(2.0)
                
                total_weight = sum(weights)
                weighted_sum = np.zeros_like(disps_list[0])
                for i, disp in enumerate(disps_list):
                    weighted_sum += weights[i] * disp
                
                merged_displacements[node_id] = weighted_sum / total_weight
        
        return merged_displacements

    def _compute_stresses(self, nodes: Dict[int, np.ndarray],
                           elements: Dict[int, Dict[str, Any]],
                           displacements: Dict[int, np.ndarray],
                           materials: Dict[str, Dict[str, float]]) -> Dict[int, np.ndarray]:
        
        stresses: Dict[int, np.ndarray] = {}
        
        E = 210000.0
        nu = 0.3
        if materials:
            first_mat = list(materials.values())[0]
            E = first_mat.get('E', 210000.0)
            nu = first_mat.get('nu', 0.3)
        
        D = np.array([
            [E / (1 - nu**2), E * nu / (1 - nu**2), 0],
            [E * nu / (1 - nu**2), E / (1 - nu**2), 0],
            [0, 0, E / (2 * (1 + nu))]
        ])
        
        for elem_id, elem in elements.items():
            node_ids = elem['nodes']
            elem_type = elem.get('type', 'CPS4')
            
            if elem_type in ['CPS4', 'CPE4'] and len(node_ids) == 4:
                coords = np.array([nodes[nid] for nid in node_ids])
                elem_disps = []
                for nid in node_ids:
                    if nid in displacements:
                        elem_disps.extend(displacements[nid])
                    else:
                        elem_disps.extend([0.0, 0.0])
                
                elem_disps = np.array(elem_disps)
                elem_stress = self._compute_element_stress(coords, elem_disps, D)
                stresses[elem_id] = elem_stress
        
        return stresses

    def _compute_element_stress(self, coords: np.ndarray,
                                   u: np.ndarray, D: np.ndarray) -> np.ndarray:
        gp = np.array([
            [-1.0 / np.sqrt(3), -1.0 / np.sqrt(3)],
            [1.0 / np.sqrt(3), -1.0 / np.sqrt(3)],
            [1.0 / np.sqrt(3), 1.0 / np.sqrt(3)],
            [-1.0 / np.sqrt(3), 1.0 / np.sqrt(3)]
        ])
        
        stress_sum = np.zeros(3)
        
        for xi, eta in gp:
            dN = np.array([
                -0.25 * (1 - eta), 0.25 * (1 - eta),
                0.25 * (1 + eta), -0.25 * (1 + eta),
                -0.25 * (1 - xi), -0.25 * (1 + xi),
                0.25 * (1 + xi), 0.25 * (1 - xi)
            ])
            
            J = np.zeros((2, 2))
            for i in range(4):
                J[0, 0] += dN[i] * coords[i, 0]
                J[0, 1] += dN[i] * coords[i, 1]
                J[1, 0] += dN[i + 4] * coords[i, 0]
                J[1, 1] += dN[i + 4] * coords[i, 1]
            
            detJ = np.linalg.det(J)
            invJ = np.linalg.inv(J)
            
            dN_dx = np.zeros(8)
            for i in range(4):
                dN_dx[i * 2] = invJ[0, 0] * dN[i] + invJ[0, 1] * dN[i + 4]
                dN_dx[i * 2 + 1] = invJ[1, 0] * dN[i] + invJ[1, 1] * dN[i + 4]
            
            B = np.zeros((3, 8))
            for i in range(4):
                B[0, i * 2] = dN_dx[i * 2]
                B[1, i * 2 + 1] = dN_dx[i * 2 + 1]
                B[2, i * 2] = dN_dx[i * 2 + 1]
                B[2, i * 2 + 1] = dN_dx[i * 2]
            
            stress = D @ B @ u
            stress_sum += stress
        
        return stress_sum / 4.0

    def serialize_for_json(self, result: Dict[str, Any]) -> Dict[str, Any]:
        serialized = {}
        
        serialized['nodes'] = {
            str(k): v.tolist() if isinstance(v, np.ndarray) else v
            for k, v in result['nodes'].items()
        }
        
        serialized['elements'] = result['elements']
        
        serialized['displacements'] = {
            str(k): v.tolist() if isinstance(v, np.ndarray) else v
            for k, v in result['displacements'].items()
        }
        
        serialized['stresses'] = {
            str(k): v.tolist() if isinstance(v, np.ndarray) else v
            for k, v in result['stresses'].items()
        }
        
        return serialized
