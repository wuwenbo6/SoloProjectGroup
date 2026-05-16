#include <vector>
#include <map>
#include <cmath>
#include <string>
#include <iostream>
#include <utility>
#include <functional>
#include "matrix_ops.cpp"

using namespace std;

class FEMSolver {
private:
    map<int, vector<double>> nodes;
    map<int, map<string, any>> elements;
    map<string, map<string, double>> materials;
    vector<map<string, any>> boundary_conditions;
    vector<map<string, any>> loads;
    vector<vector<double>> K;
    vector<double> F;
    vector<double> U;
    map<int, int> node_dof_map;
    int num_dofs;

    vector<vector<double>> compute_plane_stress_stiffness(
        const vector<vector<double>>& coords,
        double E, double nu, double t = 1.0) {
        
        vector<vector<double>> D = {
            {E / (1 - nu * nu), E * nu / (1 - nu * nu), 0},
            {E * nu / (1 - nu * nu), E / (1 - nu * nu), 0},
            {0, 0, E / (2 * (1 + nu))}
        };

        vector<vector<double>> B(3, 8);
        vector<vector<double>> gp = {
            {-1.0 / sqrt(3), -1.0 / sqrt(3)},
            {1.0 / sqrt(3), -1.0 / sqrt(3)},
            {1.0 / sqrt(3), 1.0 / sqrt(3)},
            {-1.0 / sqrt(3), 1.0 / sqrt(3)}
        };
        vector<double> weights = {1.0, 1.0, 1.0, 1.0};

        vector<vector<double>> Ke(8, vector<double>(8, 0.0));

        for (int g = 0; g < 4; ++g) {
            double xi = gp[g][0];
            double eta = gp[g][1];
            
            vector<double> dN = {
                -0.25 * (1 - eta), 0.25 * (1 - eta),
                0.25 * (1 + eta), -0.25 * (1 + eta),
                -0.25 * (1 - xi), -0.25 * (1 + xi),
                0.25 * (1 + xi), 0.25 * (1 - xi)
            };

            vector<vector<double>> J(2, vector<double>(2, 0.0));
            for (int i = 0; i < 4; ++i) {
                J[0][0] += dN[i] * coords[i][0];
                J[0][1] += dN[i] * coords[i][1];
                J[1][0] += dN[i + 4] * coords[i][0];
                J[1][1] += dN[i + 4] * coords[i][1];
            }

            double detJ = J[0][0] * J[1][1] - J[0][1] * J[1][0];
            
            vector<vector<double>> invJ = {
                {J[1][1] / detJ, -J[0][1] / detJ},
                {-J[1][0] / detJ, J[0][0] / detJ}
            };

            vector<double> dN_dx(8);
            for (int i = 0; i < 4; ++i) {
                dN_dx[i * 2] = invJ[0][0] * dN[i] + invJ[0][1] * dN[i + 4];
                dN_dx[i * 2 + 1] = invJ[1][0] * dN[i] + invJ[1][1] * dN[i + 4];
            }

            for (int i = 0; i < 4; ++i) {
                B[0][i * 2] = dN_dx[i * 2];
                B[0][i * 2 + 1] = 0;
                B[1][i * 2] = 0;
                B[1][i * 2 + 1] = dN_dx[i * 2 + 1];
                B[2][i * 2] = dN_dx[i * 2 + 1];
                B[2][i * 2 + 1] = dN_dx[i * 2];
            }

            vector<vector<double>> Bt = MatrixOps::transpose(B);
            vector<vector<double>> BtD = MatrixOps::matmul(Bt, D);
            vector<vector<double>> BtDB = MatrixOps::matmul(BtD, B);
            
            for (int i = 0; i < 8; ++i) {
                for (int j = 0; j < 8; ++j) {
                    Ke[i][j] += BtDB[i][j] * weights[g] * detJ * t;
                }
            }
        }

        return Ke;
    }

    void build_dof_map() {
        int dof_counter = 0;
        for (const auto& node_entry : nodes) {
            int node_id = node_entry.first;
            node_dof_map[node_id] = dof_counter;
            dof_counter += 2;
        }
        num_dofs = dof_counter;
    }

public:
    FEMSolver(const map<int, vector<double>>& n,
              const map<int, map<string, any>>& e,
              const map<string, map<string, double>>& m,
              const vector<map<string, any>>& bc,
              const vector<map<string, any>>& l)
        : nodes(n), elements(e), materials(m), boundary_conditions(bc), loads(l) {
        build_dof_map();
    }

    void assemble_stiffness_matrix() {
        K = MatrixOps::create_sparse(num_dofs, num_dofs);

        #pragma omp parallel for
        for (const auto& elem_entry : elements) {
            int elem_id = elem_entry.first;
            const auto& elem = elem_entry.second;
            vector<int> node_ids = any_cast<vector<int>>(elem.at("nodes"));
            
            vector<vector<double>> coords;
            for (int nid : node_ids) {
                coords.push_back(nodes.at(nid));
            }

            double E = 210000.0;
            double nu = 0.3;
            if (!materials.empty()) {
                const auto& mat = materials.begin()->second;
                if (mat.find("E") != mat.end()) E = mat.at("E");
                if (mat.find("nu") != mat.end()) nu = mat.at("nu");
            }

            vector<vector<double>> Ke;
            string elem_type = any_cast<string>(elem.at("type"));
            if (elem_type == "CPS4" || elem_type == "CPE4") {
                Ke = compute_plane_stress_stiffness(coords, E, nu);
            } else {
                continue;
            }

            vector<int> dofs;
            for (int nid : node_ids) {
                int base_dof = node_dof_map[nid];
                dofs.push_back(base_dof);
                dofs.push_back(base_dof + 1);
            }

            for (int i = 0; i < dofs.size(); ++i) {
                for (int j = 0; j < dofs.size(); ++j) {
                    MatrixOps::add_to_sparse(K, dofs[i], dofs[j], Ke[i][j]);
                }
            }
        }
    }

    void apply_boundary_conditions() {
        map<int, pair<int, double>> bc_dofs;
        
        for (const auto& bc : boundary_conditions) {
            int node_id = any_cast<int>(bc.at("node"));
            int dof = any_cast<int>(bc.at("dof")) - 1;
            double value = any_cast<double>(bc.at("value"));
            
            if (node_dof_map.find(node_id) != node_dof_map.end()) {
                int global_dof = node_dof_map[node_id] + dof;
                if (global_dof >= 0 && global_dof < num_dofs) {
                    bc_dofs[global_dof] = {node_id, value};
                }
            }
        }
        
        for (const auto& entry : bc_dofs) {
            int global_dof = entry.first;
            double value = entry.second.second;
            
            for (int j = 0; j < num_dofs; ++j) {
                if (bc_dofs.find(j) == bc_dofs.end()) {
                    F[j] -= K[j][global_dof] * value;
                }
            }
        }
        
        for (const auto& entry : bc_dofs) {
            int global_dof = entry.first;
            double value = entry.second.second;
            
            for (int j = 0; j < num_dofs; ++j) {
                K[global_dof][j] = 0.0;
                K[j][global_dof] = 0.0;
            }
            K[global_dof][global_dof] = 1.0;
            F[global_dof] = value;
        }
    }

    void assemble_force_vector() {
        F = vector<double>(num_dofs, 0.0);

        for (const auto& load : loads) {
            int node_id = any_cast<int>(load.at("node"));
            int dof = any_cast<int>(load.at("dof")) - 1;
            double value = any_cast<double>(load.at("value"));
            
            if (node_dof_map.find(node_id) != node_dof_map.end()) {
                int global_dof = node_dof_map[node_id] + dof;
                if (global_dof >= 0 && global_dof < num_dofs) {
                    F[global_dof] = value;
                }
            }
        }
    }

    vector<vector<double>> compute_modified_incomplete_cholesky() {
        int n = K.size();
        vector<vector<double>> L = MatrixOps::create_sparse(n, n);
        
        double diag_factor = 0.975;
        double drop_tol = 1e-8;
        
        vector<double> diag(n);
        for (int i = 0; i < n; ++i) {
            diag[i] = K[i][i];
        }
        
        for (int i = 0; i < n; ++i) {
            for (int j = 0; j <= i; ++j) {
                double sum = K[i][j];
                
                for (int k = 0; k < j; ++k) {
                    sum -= L[i][k] * L[j][k];
                }
                
                if (i == j) {
                    if (sum <= 0.0) {
                        sum = max(1e-10, fabs(diag[i]) * 0.01);
                    }
                    L[i][j] = sqrt(sum);
                } else {
                    if (fabs(L[j][j]) > 1e-14) {
                        double val = sum / L[j][j];
                        if (fabs(val) > drop_tol) {
                            L[i][j] = val;
                        }
                    }
                }
            }
        }
        
        double max_diag_ratio = 0.0;
        for (int i = 0; i < n; ++i) {
            if (fabs(L[i][i]) > 1e-14) {
                double ratio = sqrt(K[i][i]) / L[i][i];
                if (ratio > max_diag_ratio) {
                    max_diag_ratio = ratio;
                }
            }
        }
        
        if (max_diag_ratio > 100.0) {
            for (int i = 0; i < n; ++i) {
                L[i][i] *= sqrt(diag_factor);
            }
        }
        
        return L;
    }
    
    vector<double> solve_lower_triangular(const vector<vector<double>>& L, const vector<double>& b) {
        int n = L.size();
        vector<double> y(n, 0.0);
        
        for (int i = 0; i < n; ++i) {
            double sum = b[i];
            for (int j = 0; j < i; ++j) {
                sum -= L[i][j] * y[j];
            }
            if (fabs(L[i][i]) > 1e-14) {
                y[i] = sum / L[i][i];
            } else {
                y[i] = sum;
            }
        }
        
        return y;
    }
    
    vector<double> solve_upper_triangular(const vector<vector<double>>& L, const vector<double>& y) {
        int n = L.size();
        vector<double> x(n, 0.0);
        
        for (int i = n - 1; i >= 0; --i) {
            double sum = y[i];
            for (int j = i + 1; j < n; ++j) {
                sum -= L[j][i] * x[j];
            }
            if (fabs(L[i][i]) > 1e-14) {
                x[i] = sum / L[i][i];
            } else {
                x[i] = sum;
            }
        }
        
        return x;
    }

    vector<double> jacobi_preconditioner(const vector<double>& r) {
        vector<double> z(num_dofs);
        #pragma omp parallel for
        for (int i = 0; i < num_dofs; ++i) {
            if (fabs(K[i][i]) > 1e-14) {
                z[i] = r[i] / K[i][i];
            } else {
                z[i] = r[i];
            }
        }
        return z;
    }

    vector<double> preconditioned_conjugate_gradient(int max_iter = 10000, double tol = 1e-8) {
        U = vector<double>(num_dofs, 0.0);
        
        vector<vector<double>> L;
        bool use_ichol = true;
        
        try {
            L = compute_modified_incomplete_cholesky();
            for (int i = 0; i < num_dofs; ++i) {
                if (fabs(L[i][i]) < 1e-14) {
                    use_ichol = false;
                    break;
                }
            }
        } catch (...) {
            use_ichol = false;
        }
        
        function<vector<double>(const vector<double>&)> apply_preconditioner;
        
        if (use_ichol) {
            apply_preconditioner = [&](const vector<double>& r) -> vector<double> {
                vector<double> y = solve_lower_triangular(L, r);
                return solve_upper_triangular(L, y);
            };
        } else {
            apply_preconditioner = [&](const vector<double>& r) -> vector<double> {
                return jacobi_preconditioner(r);
            };
        }
        
        vector<double> r = F;
        vector<double> z = apply_preconditioner(r);
        
        vector<double> p = z;
        double rz_old = MatrixOps::dot(r, z);
        double initial_norm = sqrt(MatrixOps::dot(F, F));
        
        if (initial_norm < 1e-14) {
            cout << "Zero initial force vector" << endl;
            return U;
        }
        
        double best_rel_error = 1.0;
        vector<double> best_U = U;
        int stagnation_count = 0;
        double prev_rel_error = 1.0;
        
        for (int iter = 0; iter < max_iter; ++iter) {
            vector<double> Ap = MatrixOps::matvec(K, p);
            double pAp = MatrixOps::dot(p, Ap);
            
            if (fabs(pAp) < 1e-14) {
                cout << "Numerical breakdown: pAp near zero at iteration " << iter + 1 << endl;
                break;
            }
            
            double alpha = rz_old / pAp;
            
            U = MatrixOps::axpy(alpha, p, U);
            r = MatrixOps::axpy(-alpha, Ap, r);
            
            double r_norm = sqrt(MatrixOps::dot(r, r));
            double rel_error = r_norm / initial_norm;
            
            if (rel_error < best_rel_error) {
                best_rel_error = rel_error;
                best_U = U;
                stagnation_count = 0;
            } else {
                stagnation_count++;
            }
            
            if (rel_error < tol) {
                cout << "Converged in " << iter + 1 << " iterations, relative error: " << rel_error << endl;
                return U;
            }
            
            if (stagnation_count > 100) {
                cout << "Convergence stagnated. Restarting with Jacobi preconditioner..." << endl;
                apply_preconditioner = [&](const vector<double>& r) -> vector<double> {
                    return jacobi_preconditioner(r);
                };
                stagnation_count = 0;
            }
            
            z = apply_preconditioner(r);
            
            double rz_new = MatrixOps::dot(r, z);
            
            if (fabs(rz_old) < 1e-14) {
                cout << "Numerical breakdown: rz_old near zero" << endl;
                break;
            }
            
            double beta = rz_new / rz_old;
            p = MatrixOps::axpy(beta, p, z);
            rz_old = rz_new;
            
            if (iter > 0 && iter % 1000 == 0) {
                cout << "Iteration " << iter << ", relative error: " << rel_error << endl;
            }
            
            if (iter == max_iter - 1) {
                cout << "WARNING: Did not converge after " << max_iter << " iterations. Best relative error: " << best_rel_error << endl;
                U = best_U;
            }
        }

        return U;
    }

    map<int, vector<double>> get_displacements() {
        map<int, vector<double>> displacements;
        for (const auto& entry : node_dof_map) {
            int node_id = entry.first;
            int dof = entry.second;
            displacements[node_id] = {U[dof], U[dof + 1]};
        }
        return displacements;
    }

    vector<double> solve() {
        assemble_stiffness_matrix();
        apply_boundary_conditions();
        assemble_force_vector();
        return preconditioned_conjugate_gradient();
    }
};
