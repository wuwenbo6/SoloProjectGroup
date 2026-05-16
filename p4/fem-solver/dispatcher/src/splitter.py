import numpy as np
from typing import Dict, List, Any, Tuple
from collections import defaultdict


class MeshSplitter:
    def __init__(self, num_subdomains: int = 4):
        self.num_subdomains = num_subdomains

    def split(self, model_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        nodes = model_data['nodes']
        elements = model_data['elements']
        materials = model_data['materials']
        bcs = model_data['boundary_conditions']
        loads = model_data['loads']

        node_ids = list(nodes.keys())
        elem_ids = list(elements.keys())

        if self.num_subdomains == 1:
            subdomain = self._create_subdomain(
                0, node_ids, elem_ids, nodes, elements, materials, bcs, loads, []
            )
            return [subdomain]

        centroids = self._compute_centroids(node_ids, elem_ids, nodes, elements)

        subdomains_elems = self._kmeans_split(centroids, self.num_subdomains)

        all_elem_subdomains = {}
        for subdomain_idx, elem_subset in enumerate(subdomains_elems):
            for idx in elem_subset:
                all_elem_subdomains[elem_ids[idx]] = subdomain_idx

        subdomains = []
        for i, elem_subset in enumerate(subdomains_elems):
            node_subset = self._get_nodes_from_elements(elem_subset, elements)
            interface_nodes = self._find_interface_nodes(
                node_subset, elements, elem_subset, all_elem_subdomains, i
            )
            subdomain = self._create_subdomain(
                i, node_subset, elem_subset, nodes, elements, materials, bcs, loads, interface_nodes
            )
            subdomains.append(subdomain)

        return subdomains

    def _compute_centroids(self, node_ids: List[int], 
                          elem_ids: List[int], 
                          nodes: Dict[int, np.ndarray],
                          elements: Dict[int, Dict[str, Any]]) -> np.ndarray:
        centroids = []
        for eid in elem_ids:
            elem = elements[eid]
            elem_nodes = elem['nodes']
            coords = np.array([nodes[nid] for nid in elem_nodes])
            centroid = np.mean(coords, axis=0)
            centroids.append(centroid)
        return np.array(centroids)

    def _kmeans_split(self, centroids: np.ndarray, k: int) -> List[List[int]]:
        num_points = centroids.shape[0]
        
        indices = np.random.choice(num_points, k, replace=False)
        centers = centroids[indices]
        
        for _ in range(100):
            distances = np.linalg.norm(centroids[:, np.newaxis] - centers, axis=2)
            labels = np.argmin(distances, axis=1)
            
            new_centers = []
            for i in range(k):
                cluster_points = centroids[labels == i]
                if len(cluster_points) > 0:
                    new_centers.append(np.mean(cluster_points, axis=0))
                else:
                    new_centers.append(centers[i])
            new_centers = np.array(new_centers)
            
            if np.allclose(centers, new_centers):
                break
            centers = new_centers

        subdomains_elems = []
        for i in range(k):
            subdomains_elems.append(list(np.where(labels == i)[0]))
        
        return subdomains_elems

    def _get_nodes_from_elements(self, elem_indices: List[int], 
                                  elements: Dict[int, Dict[str, Any]]) -> List[int]:
        elem_ids = list(elements.keys())
        nodes_set = set()
        for idx in elem_indices:
            eid = elem_ids[idx]
            elem = elements[eid]
            nodes_set.update(elem['nodes'])
        return list(nodes_set)

    def _create_subdomain(self, subdomain_id: int,
                          node_subset: List[int],
                          elem_subset: List[int],
                          nodes: Dict[int, np.ndarray],
                          elements: Dict[int, Dict[str, Any]],
                          materials: Dict[str, Dict[str, float]],
                          bcs: List[Dict[str, Any]],
                          loads: List[Dict[str, Any]],
                          interface_nodes: List[int]) -> Dict[str, Any]:
        elem_ids = list(elements.keys())
        
        subdomain_nodes = {}
        for nid in node_subset:
            subdomain_nodes[nid] = nodes[nid].tolist()
        
        subdomain_elements = {}
        for idx in elem_subset:
            eid = elem_ids[idx]
            subdomain_elements[eid] = elements[eid]
        
        subdomain_bcs = []
        for bc in bcs:
            if bc['node'] in node_subset:
                subdomain_bcs.append(bc)
        
        subdomain_loads = []
        for load in loads:
            if load['node'] in node_subset:
                subdomain_loads.append(load)
        
        return {
            'subdomain_id': subdomain_id,
            'nodes': subdomain_nodes,
            'elements': subdomain_elements,
            'materials': materials,
            'boundary_conditions': subdomain_bcs,
            'loads': subdomain_loads,
            'interface_nodes': interface_nodes
        }

    def _find_interface_nodes(self, node_subset: List[int],
                               elements: Dict[int, Dict[str, Any]],
                               elem_subset: List[int],
                               all_elem_subdomains: Dict[int, int],
                               current_subdomain_id: int) -> List[int]:
        node_set = set(node_subset)
        elem_ids = list(elements.keys())
        
        interface_nodes = set()
        
        for idx in elem_subset:
            eid = elem_ids[idx]
            elem = elements[eid]
            
            for nid in elem['nodes']:
                if nid not in node_set:
                    continue
                
                is_interface = False
                for other_eid, other_elem in elements.items():
                    if other_eid == eid:
                        continue
                    
                    if nid in other_elem['nodes']:
                        other_subdomain = all_elem_subdomains.get(other_eid, current_subdomain_id)
                        if other_subdomain != current_subdomain_id:
                            is_interface = True
                            break
                
                if is_interface:
                    interface_nodes.add(nid)
        
        return list(interface_nodes)

    def get_subdomain_sizes(self, subdomains: List[Dict[str, Any]]) -> List[Dict[str, int]]:
        sizes = []
        for subdomain in subdomains:
            sizes.append({
                'subdomain_id': subdomain['subdomain_id'],
                'num_nodes': len(subdomain['nodes']),
                'num_elements': len(subdomain['elements'])
            })
        return sizes
