import numpy as np
from dolfin import *
import meshio
import warnings
from collections import defaultdict


class MeshQualityError(Exception):
    pass


class Geometry2D:
    @staticmethod
    def rectangle(x_min, x_max, y_min, y_max):
        return RectangleMesh(Point(x_min, y_min), Point(x_max, y_max), 1, 1)

    @staticmethod
    def circle(center_x, center_y, radius, resolution=16):
        return CircleMesh(Point(center_x, center_y), radius, resolution)


class MeshGenerator:
    def __init__(self):
        self.mesh = None
        self.mesh_quality = None

    def create_rectangle_mesh(self, x_min, x_max, y_min, y_max, nx, ny, structured=True):
        if structured:
            self.mesh = RectangleMesh(Point(x_min, y_min), Point(x_max, y_max), nx, ny)
        else:
            self.mesh = generate_mesh(Rectangle(Point(x_min, y_min), Point(x_max, y_max)), nx)
        return self.mesh

    def create_circle_mesh(self, center_x, center_y, radius, resolution=32):
        self.mesh = CircleMesh(Point(center_x, center_y), radius, resolution)
        return self.mesh

    def create_beam_mesh(self, length, height, nx, ny):
        self.mesh = RectangleMesh(Point(0, 0), Point(length, height), nx, ny)
        return self.mesh

    def refine_mesh(self, refinement_level=1):
        for _ in range(refinement_level):
            self.mesh = refine(self.mesh)
        return self.mesh

    def get_mesh(self):
        return self.mesh

    def get_mesh_info(self):
        if self.mesh is None:
            return None
        return {
            "num_cells": self.mesh.num_cells(),
            "num_vertices": self.mesh.num_vertices(),
            "num_edges": self.mesh.num_edges(),
            "hmax": self.mesh.hmax(),
            "hmin": self.mesh.hmin()
        }

    def export_mesh(self, filename):
        meshio.write(filename, meshio.Mesh(
            points=self.mesh.coordinates(),
            cells={"triangle": self.mesh.cells()}
        ))

    @staticmethod
    def _remove_duplicate_points(points, tolerance=1e-8):
        unique_points = []
        unique_indices = []
        for i, p in enumerate(points):
            is_duplicate = False
            for j, up in enumerate(unique_points):
                if np.linalg.norm(p - up) < tolerance:
                    unique_indices.append(j)
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_indices.append(len(unique_points))
                unique_points.append(p)
        return np.array(unique_points), unique_indices

    @staticmethod
    def _fix_non_manifold_edges(cells, num_points):
        edge_count = defaultdict(int)
        edge_cells = defaultdict(list)
        
        for cell_idx, cell in enumerate(cells):
            edges = [
                tuple(sorted((cell[0], cell[1]))),
                tuple(sorted((cell[1], cell[2]))),
                tuple(sorted((cell[2], cell[0])))
            ]
            for edge in edges:
                edge_count[edge] += 1
                edge_cells[edge].append(cell_idx)
        
        non_manifold_edges = [edge for edge, count in edge_count.items() if count != 2]
        if non_manifold_edges:
            warnings.warn(f"发现 {len(non_manifold_edges)} 条非流形边")
        
        bad_cells = set()
        for edge in non_manifold_edges:
            for cell_idx in edge_cells[edge]:
                bad_cells.add(cell_idx)
        
        if bad_cells:
            warnings.warn(f"移除 {len(bad_cells)} 个包含非流形边的单元")
            cells = np.delete(cells, list(bad_cells), axis=0)
        
        return cells

    @staticmethod
    def _fix_self_intersections(cells, points):
        return cells

    @staticmethod
    def _check_mesh_quality(cells, points):
        quality_metrics = []
        for cell in cells:
            p0, p1, p2 = points[cell[0]], points[cell[1]], points[cell[2]]
            
            a = np.linalg.norm(p1 - p0)
            b = np.linalg.norm(p2 - p1)
            c = np.linalg.norm(p0 - p2)
            
            s = (a + b + c) / 2
            area = np.sqrt(max(0, s * (s - a) * (s - b) * (s - c)))
            
            if area < 1e-12:
                continue
                
            inradius = 2 * area / (a + b + c)
            circumradius = (a * b * c) / (4 * area)
            quality = 2 * inradius / circumradius if circumradius > 0 else 0
            
            quality_metrics.append(quality)
        
        if not quality_metrics:
            return {"min_quality": 0, "mean_quality": 0, "bad_cells_ratio": 1.0}
        
        quality_metrics = np.array(quality_metrics)
        bad_cells_ratio = np.sum(quality_metrics < 0.1) / len(quality_metrics)
        
        return {
            "min_quality": np.min(quality_metrics),
            "mean_quality": np.mean(quality_metrics),
            "bad_cells_ratio": bad_cells_ratio,
            "total_cells": len(cells)
        }

    @staticmethod
    def import_mesh(filename, auto_fix=True, quality_threshold=0.01):
        try:
            mesh_data = meshio.read(filename)
            
            if "triangle" not in mesh_data.cells_dict:
                raise ValueError("STL 文件中没有三角形单元")
            
            points = mesh_data.points
            cells = mesh_data.cells_dict["triangle"]
            
            if points.shape[1] == 3:
                if np.allclose(points[:, 2], points[0, 2]):
                    points = points[:, :2]
                    warnings.warn("检测到 2D 平面 STL，已移除 z 坐标")
                else:
                    raise ValueError("3D STL 不支持，请使用 2D 平面 STL")
            
            original_num_points = len(points)
            original_num_cells = len(cells)
            
            if auto_fix:
                points, unique_indices = MeshGenerator._remove_duplicate_points(points)
                cells = np.array([[unique_indices[i] for i in cell] for cell in cells])
                
                cells = MeshGenerator._fix_non_manifold_edges(cells, len(points))
                cells = MeshGenerator._fix_self_intersections(cells, points)
            
            quality = MeshGenerator._check_mesh_quality(cells, points)
            
            if quality["min_quality"] < quality_threshold:
                warnings.warn(f"网格质量较低: 最小质量 = {quality['min_quality']:.4f}")
            
            if quality["bad_cells_ratio"] > 0.5:
                raise MeshQualityError(
                    f"超过 50% 的单元质量较差 ({quality['bad_cells_ratio']:.1%})")
            
            mesh = Mesh()
            editor = MeshEditor()
            editor.open(mesh, "triangle", 2, 2)
            editor.init_vertices(len(points))
            editor.init_cells(len(cells))
            
            for i, point in enumerate(points):
                editor.add_vertex(i, Point(float(point[0]), float(point[1])))
            
            for i, cell in enumerate(cells):
                editor.add_cell(i, np.array(cell, dtype=np.uintp))
            
            editor.close()
            
            warnings.warn(
                f"导入成功: {original_num_points} -> {len(points)} 点, "
                f"{original_num_cells} -> {len(cells)} 单元, "
                f"平均质量: {quality['mean_quality']:.4f}"
            )
            
            return mesh, quality
            
        except Exception as e:
            raise RuntimeError(f"导入 STL 失败: {str(e)}")

    def get_mesh_quality(self):
        if self.mesh is None:
            return None
        return MeshGenerator._check_mesh_quality(
            self.mesh.cells(),
            self.mesh.coordinates()
        )
