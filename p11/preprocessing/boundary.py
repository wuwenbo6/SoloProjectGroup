from dolfin import *
import numpy as np


class Boundary(SubDomain):
    def __init__(self, boundary_func):
        super().__init__()
        self.boundary_func = boundary_func

    def inside(self, x, on_boundary):
        return on_boundary and self.boundary_func(x)


class BoundaryCondition:
    def __init__(self, bc_type, value, subdomain, component=None):
        self.bc_type = bc_type
        self.value = Constant(value) if isinstance(value, (int, float, list, tuple)) else value
        self.subdomain = subdomain
        self.component = component

    @staticmethod
    def create_fixed(subdomain):
        return BoundaryCondition("fixed", (0, 0), subdomain)

    @staticmethod
    def create_displacement(subdomain, value, component=0):
        return BoundaryCondition("displacement", value, subdomain, component)

    @staticmethod
    def left_boundary(x, on_boundary):
        return on_boundary and near(x[0], 0)

    @staticmethod
    def right_boundary(x, on_boundary):
        return on_boundary and near(x[0], 1)

    @staticmethod
    def bottom_boundary(x, on_boundary):
        return on_boundary and near(x[1], 0)

    @staticmethod
    def top_boundary(x, on_boundary):
        return on_boundary and near(x[1], 1)


class Load:
    def __init__(self, load_type, value, measure=None):
        self.load_type = load_type
        self.value = Constant(value) if isinstance(value, (int, float, list, tuple)) else value
        self.measure = measure

    @staticmethod
    def create_body_force(value):
        return Load("body_force", value)

    @staticmethod
    def create_boundary_force(value, subdomain, mesh, degree=2):
        boundary_markers = MeshFunction("size_t", mesh, mesh.topology().dim() - 1)
        boundary_markers.set_all(0)
        subdomain.mark(boundary_markers, 1)
        ds = Measure("ds", domain=mesh, subdomain_data=boundary_markers)
        return Load("boundary_force", value, ds(1))

    @staticmethod
    def create_pressure(value, subdomain, mesh):
        boundary_markers = MeshFunction("size_t", mesh, mesh.topology().dim() - 1)
        boundary_markers.set_all(0)
        subdomain.mark(boundary_markers, 1)
        ds = Measure("ds", domain=mesh, subdomain_data=boundary_markers)
        n = FacetNormal(mesh)
        return Load("boundary_force", -value * n, ds(1))
