import numpy as np
from dolfin import *
import warnings


class SingularMatrixError(Exception):
    pass


class ConvergenceError(Exception):
    pass


class Material:
    def __init__(self, E, nu, rho=1.0, yield_stress=None, hardening_modulus=0.0):
        self.E = E
        self.nu = nu
        self.rho = rho
        self.yield_stress = yield_stress
        self.hardening_modulus = hardening_modulus
        self.is_plastic = yield_stress is not None

    def get_lame_parameters(self):
        mu = self.E / (2 * (1 + self.nu))
        lmbda = self.E * self.nu / ((1 + self.nu) * (1 - 2 * self.nu))
        return lmbda, mu

    def get_shear_modulus(self):
        return self.E / (2 * (1 + self.nu))

    def get_bulk_modulus(self):
        return self.E / (3 * (1 - 2 * self.nu))


class Simulation2D:
    def __init__(self, mesh, problem_type="plane_stress"):
        self.mesh = mesh
        self.problem_type = problem_type
        self.material = None
        self.boundary_conditions = []
        self.loads = []
        self.V = None
        self.u = None
        self.sigma = None
        self.epsilon = None
        self.use_regularization = True
        self.regularization_epsilon = 1e-10
        self.solver_parameters = {
            "linear_solver": "mumps",
            "preconditioner": "default",
            "report": False,
            "error_on_nonconvergence": True
        }

    def set_material(self, material):
        self.material = material

    def add_boundary_condition(self, bc):
        self.boundary_conditions.append(bc)

    def add_load(self, load):
        self.loads.append(load)

    def set_solver_parameters(self, **kwargs):
        self.solver_parameters.update(kwargs)

    def enable_regularization(self, enable=True, epsilon=1e-10):
        self.use_regularization = enable
        self.regularization_epsilon = epsilon

    def _check_boundary_conditions(self):
        if not self.boundary_conditions:
            warnings.warn("没有设置任何边界条件，可能导致刚度矩阵奇异")
            return False
        
        has_fixed_x = False
        has_fixed_y = False
        
        for bc in self.boundary_conditions:
            if bc.bc_type == "fixed":
                has_fixed_x = True
                has_fixed_y = True
            elif bc.bc_type == "displacement":
                if bc.component == 0:
                    has_fixed_x = True
                elif bc.component == 1:
                    has_fixed_y = True
        
        if not (has_fixed_x and has_fixed_y):
            warnings.warn(
                "边界条件不完整: x和y方向都需要约束。"
                f"当前: x约束={has_fixed_x}, y约束={has_fixed_y}"
            )
            return False
        
        return True

    def _epsilon(self, u):
        return sym(grad(u))

    def _sigma(self, u):
        lmbda, mu = self.material.get_lame_parameters()
        if self.problem_type == "plane_stress":
            lmbda = 2 * lmbda * mu / (lmbda + 2 * mu)
        return lmbda * tr(self._epsilon(u)) * Identity(2) + 2 * mu * self._epsilon(u)

    def solve(self):
        if self.material is None:
            raise ValueError("Material not set")

        self._check_boundary_conditions()

        self.V = VectorFunctionSpace(self.mesh, "P", 1)
        u = TrialFunction(self.V)
        v = TestFunction(self.V)

        a = inner(self._sigma(u), self._epsilon(v)) * dx

        if self.use_regularization:
            eps = self.regularization_epsilon
            a += eps * dot(u, v) * dx
            warnings.warn(f"启用正则化: epsilon = {eps}")

        L_form = Constant((0, 0)) * v[0] * dx
        for load in self.loads:
            if load.load_type == "body_force":
                L_form += dot(load.value, v) * dx
            elif load.load_type == "boundary_force":
                L_form += dot(load.value, v) * load.measure

        bcs = []
        for bc in self.boundary_conditions:
            if bc.bc_type == "fixed":
                bc_fenics = DirichletBC(self.V, bc.value, bc.subdomain)
                bcs.append(bc_fenics)
            elif bc.bc_type == "displacement":
                bc_fenics = DirichletBC(self.V.sub(bc.component), bc.value, bc.subdomain)
                bcs.append(bc_fenics)

        self.u = Function(self.V)
        
        try:
            problem = LinearVariationalProblem(a, L_form, self.u, bcs)
            solver = LinearVariationalSolver(problem)
            
            for key, value in self.solver_parameters.items():
                solver.parameters[key] = value
            
            solver.solve()
            
        except RuntimeError as e:
            if "singular" in str(e).lower() or "diverge" in str(e).lower():
                raise SingularMatrixError(
                    f"刚度矩阵奇异: {str(e)}\n"
                    "建议: 1. 检查边界条件是否完整 2. 检查网格质量 3. 增加正则化系数"
                )
            else:
                raise

        self._compute_stress_strain()

        return self.u

    def _compute_stress_strain(self):
        W = TensorFunctionSpace(self.mesh, "P", 1)
        self.epsilon = project(self._epsilon(self.u), W, solver_type="mumps")
        self.sigma = project(self._sigma(self.u), W, solver_type="mumps")

    def get_displacement(self):
        return self.u

    def get_stress(self):
        return self.sigma

    def get_strain(self):
        return self.epsilon

    def get_von_mises_stress(self):
        if self.sigma is None:
            return None

        s = self.sigma
        von_mises = sqrt(s[0, 0]**2 - s[0, 0]*s[1, 1] + s[1, 1]**2 + 3*s[0, 1]**2)
        V_scalar = FunctionSpace(self.mesh, "P", 1)
        return project(von_mises, V_scalar, solver_type="mumps")


class PlaneStress(Simulation2D):
    def __init__(self, mesh):
        super().__init__(mesh, problem_type="plane_stress")


class PlaneStrain(Simulation2D):
    def __init__(self, mesh):
        super().__init__(mesh, problem_type="plane_strain")


class NonlinearSimulation2D:
    def __init__(self, mesh, problem_type="plane_stress"):
        self.mesh = mesh
        self.problem_type = problem_type
        self.material = None
        self.boundary_conditions = []
        self.loads = []
        self.V = None
        self.u = None
        self.sigma = None
        self.epsilon = None
        self.epsilon_p = None
        self.equivalent_plastic_strain = None
        
        self.nonlinear_solver_params = {
            "max_iterations": 50,
            "relative_tolerance": 1e-6,
            "absolute_tolerance": 1e-8,
            "relaxation_factor": 1.0,
            "line_search": True
        }
        
        self.convergence_history = []

    def set_material(self, material):
        self.material = material

    def add_boundary_condition(self, bc):
        self.boundary_conditions.append(bc)

    def add_load(self, load):
        self.loads.append(load)

    def set_nonlinear_solver_params(self, **kwargs):
        self.nonlinear_solver_params.update(kwargs)

    def _epsilon(self, u):
        return sym(grad(u))

    def _compute_sigma(self, epsilon, epsilon_p_old, eq_p_old):
        E = self.material.E
        nu = self.material.nu
        mu = E / (2 * (1 + nu))
        lmbda = E * nu / ((1 + nu) * (1 - 2 * nu))
        
        if self.problem_type == "plane_stress":
            lmbda = 2 * lmbda * mu / (lmbda + 2 * mu)
        
        sigma_el = lmbda * tr(epsilon) * Identity(2) + 2 * mu * epsilon
        
        if not self.material.is_plastic:
            return sigma_el, epsilon_p_old, eq_p_old
        
        sigma_dev = sigma_el - (1/2) * tr(sigma_el) * Identity(2)
        von_mises = sqrt(3/2 * inner(sigma_dev, sigma_dev))
        
        yield_stress = self.material.yield_stress + self.material.hardening_modulus * eq_p_old
        
        f = von_mises - yield_stress
        
        def elastic():
            return sigma_el, epsilon_p_old, eq_p_old
        
        def plastic():
            n = 3/(2*von_mises) * sigma_dev
            dlambda = f / (3*mu + self.material.hardening_modulus)
            sigma_new = sigma_el - 2*mu*dlambda*n
            epsilon_p_new = epsilon_p_old + dlambda * n
            eq_p_new = eq_p_old + dlambda
            return sigma_new, epsilon_p_new, eq_p_new
        
        return conditional(lt(f, 0), elastic(), plastic())

    def solve_incremental(self, num_load_steps=10):
        if self.material is None:
            raise ValueError("Material not set")

        self.V = VectorFunctionSpace(self.mesh, "P", 1)
        V_scalar = FunctionSpace(self.mesh, "P", 1)
        V_tensor = TensorFunctionSpace(self.mesh, "P", 1)

        self.u = Function(self.V)
        u_test = TestFunction(self.V)
        du = TrialFunction(self.V)

        self.epsilon_p = Function(V_tensor, name="plastic_strain")
        self.equivalent_plastic_strain = Function(V_scalar, name="equivalent_plastic_strain")
        
        epsilon_p_old = Function(V_tensor)
        eq_p_old = Function(V_scalar)

        bcs = []
        for bc in self.boundary_conditions:
            if bc.bc_type == "fixed":
                bc_fenics = DirichletBC(self.V, bc.value, bc.subdomain)
                bcs.append(bc_fenics)
            elif bc.bc_type == "displacement":
                bc_fenics = DirichletBC(self.V.sub(bc.component), bc.value, bc.subdomain)
                bcs.append(bc_fenics)

        total_load_scale = 1.0
        self.convergence_history = []

        for step in range(num_load_steps):
            load_factor = (step + 1) / num_load_steps * total_load_scale
            print(f"\n荷载步 {step+1}/{num_load_steps}, 荷载系数: {load_factor:.3f}")

            du = TrialFunction(self.V)
            residual = inner(self._sigma(self.u), self._epsilon(u_test)) * dx
            
            for load in self.loads:
                if load.load_type == "body_force":
                    residual -= load_factor * dot(load.value, u_test) * dx
                elif load.load_type == "boundary_force":
                    residual -= load_factor * dot(load.value, u_test) * load.measure

            J = derivative(residual, self.u)

            problem = NonlinearVariationalProblem(residual, self.u, bcs, J)
            solver = NonlinearVariationalSolver(problem)
            
            solver.parameters["newton_solver"]["maximum_iterations"] = self.nonlinear_solver_params["max_iterations"]
            solver.parameters["newton_solver"]["relative_tolerance"] = self.nonlinear_solver_params["relative_tolerance"]
            solver.parameters["newton_solver"]["absolute_tolerance"] = self.nonlinear_solver_params["absolute_tolerance"]
            solver.parameters["newton_solver"]["relaxation_parameter"] = self.nonlinear_solver_params["relaxation_factor"]
            solver.parameters["newton_solver"]["linear_solver"] = "mumps"

            try:
                n_iter, converged = solver.solve()
                self.convergence_history.append({
                    "step": step + 1,
                    "load_factor": load_factor,
                    "iterations": n_iter,
                    "converged": converged
                })
                print(f"  收敛: 迭代 {n_iter} 次")
            except RuntimeError as e:
                raise ConvergenceError(f"非线性求解在荷载步 {step+1} 发散: {str(e)}")

        self._compute_stress_strain()
        return self.u

    def _compute_stress_strain(self):
        self.epsilon = project(self._epsilon(self.u), TensorFunctionSpace(self.mesh, "P", 1), solver_type="mumps")
        self.sigma = project(self._sigma(self.u), TensorFunctionSpace(self.mesh, "P", 1), solver_type="mumps")

    def get_displacement(self):
        return self.u

    def get_stress(self):
        return self.sigma

    def get_strain(self):
        return self.epsilon

    def get_plastic_strain(self):
        return self.epsilon_p

    def get_equivalent_plastic_strain(self):
        return self.equivalent_plastic_strain

    def get_von_mises_stress(self):
        if self.sigma is None:
            return None
        s = self.sigma
        von_mises = sqrt(s[0, 0]**2 - s[0, 0]*s[1, 1] + s[1, 1]**2 + 3*s[0, 1]**2)
        V_scalar = FunctionSpace(self.mesh, "P", 1)
        return project(von_mises, V_scalar, solver_type="mumps")


class NonlinearPlaneStress(NonlinearSimulation2D):
    def __init__(self, mesh):
        super().__init__(mesh, problem_type="plane_stress")


class NonlinearPlaneStrain(NonlinearSimulation2D):
    def __init__(self, mesh):
        super().__init__(mesh, problem_type="plane_strain")
