import numpy as np
from typing import Dict, Any


class VTKExporter:
    def __init__(self):
        pass

    def export(self, result_data: Dict[str, Any], output_path: str):
        nodes = result_data['nodes']
        elements = result_data['elements']
        displacements = result_data['displacements']
        stresses = result_data.get('stresses', {})

        with open(output_path, 'w') as f:
            self._write_header(f)
            self._write_points(f, nodes)
            self._write_cells(f, elements)
            self._write_cell_types(f, elements)
            self._write_point_data(f, nodes, displacements)
            self._write_cell_data(f, elements, stresses)

    def _write_header(self, f):
        f.write('# vtk DataFile Version 3.0\n')
        f.write('FEM Analysis Results\n')
        f.write('ASCII\n\n')

    def _write_points(self, f, nodes: Dict[int, np.ndarray]):
        f.write(f'DATASET UNSTRUCTURED_GRID\n')
        f.write(f'POINTS {len(nodes)} float\n')
        
        node_ids = sorted(nodes.keys())
        for nid in node_ids:
            coords = nodes[nid]
            if len(coords) == 2:
                f.write(f'{coords[0]} {coords[1]} 0.0\n')
            else:
                f.write(f'{coords[0]} {coords[1]} {coords[2]}\n')
        f.write('\n')

    def _write_cells(self, f, elements: Dict[int, Dict[str, Any]]):
        elem_ids = sorted(elements.keys())
        total_size = 0
        
        for eid in elem_ids:
            elem = elements[eid]
            node_ids = elem['nodes']
            total_size += 1 + len(node_ids)
        
        f.write(f'CELLS {len(elements)} {total_size}\n')
        
        for eid in elem_ids:
            elem = elements[eid]
            node_ids = elem['nodes']
            node_id_map = {nid: idx for idx, nid in enumerate(sorted(elem['nodes']))}
            for i, nid in enumerate(node_ids):
                node_ids[i] = node_id_map[nid]
            f.write(f'{len(node_ids)} ' + ' '.join(map(str, node_ids)) + '\n')
        f.write('\n')

    def _write_cell_types(self, f, elements: Dict[int, Dict[str, Any]]):
        elem_ids = sorted(elements.keys())
        f.write(f'CELL_TYPES {len(elements)}\n')
        
        for eid in elem_ids:
            elem = elements[eid]
            elem_type = elem.get('type', 'CPS4')
            
            if elem_type in ['CPS4', 'CPE4', 'QUAD4']:
                vtk_type = 9
            elif elem_type in ['CPS3', 'CPE3', 'TRI3']:
                vtk_type = 5
            elif elem_type in ['C3D8', 'HEX8']:
                vtk_type = 12
            else:
                vtk_type = 9
            
            f.write(f'{vtk_type}\n')
        f.write('\n')

    def _write_point_data(self, f, nodes: Dict[int, np.ndarray], 
                          displacements: Dict[int, np.ndarray]):
        node_ids = sorted(nodes.keys())
        f.write(f'POINT_DATA {len(node_ids)}\n')
        
        f.write('VECTORS Displacement float\n')
        for nid in node_ids:
            if nid in displacements:
                disp = displacements[nid]
                if len(disp) == 2:
                    f.write(f'{disp[0]} {disp[1]} 0.0\n')
                else:
                    f.write(f'{disp[0]} {disp[1]} {disp[2]}\n')
            else:
                f.write('0.0 0.0 0.0\n')
        f.write('\n')
        
        f.write('SCALARS Displacement_Magnitude float\n')
        f.write('LOOKUP_TABLE default\n')
        for nid in node_ids:
            if nid in displacements:
                disp = displacements[nid]
                mag = np.linalg.norm(disp)
                f.write(f'{mag}\n')
            else:
                f.write('0.0\n')
        f.write('\n')

    def _write_cell_data(self, f, elements: Dict[int, Dict[str, Any]], 
                         stresses: Dict[int, np.ndarray]):
        elem_ids = sorted(elements.keys())
        f.write(f'CELL_DATA {len(elem_ids)}\n')
        
        f.write('SCALARS Stress_XX float\n')
        f.write('LOOKUP_TABLE default\n')
        for eid in elem_ids:
            if eid in stresses:
                stress = stresses[eid]
                f.write(f'{stress[0]}\n')
            else:
                f.write('0.0\n')
        f.write('\n')
        
        f.write('SCALARS Stress_YY float\n')
        f.write('LOOKUP_TABLE default\n')
        for eid in elem_ids:
            if eid in stresses:
                stress = stresses[eid]
                f.write(f'{stress[1]}\n')
            else:
                f.write('0.0\n')
        f.write('\n')
        
        f.write('SCALARS Stress_XY float\n')
        f.write('LOOKUP_TABLE default\n')
        for eid in elem_ids:
            if eid in stresses:
                stress = stresses[eid]
                f.write(f'{stress[2]}\n')
            else:
                f.write('0.0\n')
        f.write('\n')
        
        f.write('SCALARS Von_Mises float\n')
        f.write('LOOKUP_TABLE default\n')
        for eid in elem_ids:
            if eid in stresses:
                stress = stresses[eid]
                sxx, syy, sxy = stress[0], stress[1], stress[2]
                von_mises = np.sqrt(sxx**2 - sxx * syy + syy**2 + 3 * sxy**2)
                f.write(f'{von_mises}\n')
            else:
                f.write('0.0\n')
        f.write('\n')
