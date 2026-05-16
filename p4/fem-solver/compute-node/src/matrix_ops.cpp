#include <vector>
#include <cmath>
#include <omp.h>
#include <stdexcept>
#include <iostream>
#include <mutex>

#ifdef USE_CUDA
#include "cuda_kernels.cuh"
#endif

using namespace std;

class MatrixOps {
private:
    static bool& useCuda() {
        static bool use_cuda = false;
        return use_cuda;
    }
    
    static once_flag& initFlag() {
        static once_flag flag;
        return flag;
    }

public:
    static void initCuda() {
        call_once(initFlag(), []() {
#ifdef USE_CUDA
            useCuda() = checkCudaAvailable();
            if (useCuda()) {
                cout << "CUDA acceleration enabled" << endl;
            } else {
                cout << "CUDA not available, using CPU only" << endl;
            }
#else
            cout << "Compiled without CUDA support" << endl;
#endif
        });
    }

    static vector<vector<double>> matmul(const vector<vector<double>>& A, 
                                          const vector<vector<double>>& B) {
        if (A.empty() || B.empty() || A[0].size() != B.size()) {
            throw invalid_argument("Matrix dimensions mismatch");
        }
        
        int m = A.size();
        int k = A[0].size();
        int n = B[0].size();
        
#ifdef USE_CUDA
        if (useCuda() && m >= 64 && n >= 64) {
            try {
                CudaMatrix<double> d_A(m, k);
                CudaMatrix<double> d_B(k, n);
                CudaMatrix<double> d_C(m, n);
                
                d_A.copyFromHost(A);
                d_B.copyFromHost(B);
                
                cudaMatMul(d_C.d_data, d_A.d_data, d_B.d_data, m, k, n);
                
                vector<vector<double>> result;
                d_C.copyToHost(result);
                return result;
            } catch (...) {
                cerr << "CUDA matmul failed, falling back to CPU" << endl;
            }
        }
#endif
        
        vector<vector<double>> result(m, vector<double>(n, 0.0));
        
        #pragma omp parallel for collapse(2)
        for (int i = 0; i < m; ++i) {
            for (int j = 0; j < n; ++j) {
                double sum = 0.0;
                for (int p = 0; p < k; ++p) {
                    sum += A[i][p] * B[p][j];
                }
                result[i][j] = sum;
            }
        }
        
        return result;
    }

    static vector<double> matvec(const vector<vector<double>>& A, 
                                  const vector<double>& v) {
        if (A.empty() || A[0].size() != v.size()) {
            throw invalid_argument("Matrix-vector dimensions mismatch");
        }
        
        int m = A.size();
        int n = v.size();
        
#ifdef USE_CUDA
        if (useCuda() && m >= 128) {
            try {
                CudaMatrix<double> d_A(m, n);
                CudaVector<double> d_v(n);
                CudaVector<double> d_y(m);
                
                d_A.copyFromHost(A);
                d_v.copyFromHost(v);
                
                cudaMatVec(d_y.d_data, d_A.d_data, d_v.d_data, m, n);
                
                vector<double> result;
                d_y.copyToHost(result);
                return result;
            } catch (...) {
                cerr << "CUDA matvec failed, falling back to CPU" << endl;
            }
        }
#endif
        
        vector<double> result(m, 0.0);
        
        #pragma omp parallel for
        for (int i = 0; i < m; ++i) {
            double sum = 0.0;
            for (int j = 0; j < n; ++j) {
                sum += A[i][j] * v[j];
            }
            result[i] = sum;
        }
        
        return result;
    }

    static vector<vector<double>> transpose(const vector<vector<double>>& A) {
        if (A.empty()) return {};
        
        int n = A.size();
        int m = A[0].size();
        
        vector<vector<double>> result(m, vector<double>(n));
        
        #pragma omp parallel for collapse(2)
        for (int i = 0; i < n; ++i) {
            for (int j = 0; j < m; ++j) {
                result[j][i] = A[i][j];
            }
        }
        
        return result;
    }

    static double dot(const vector<double>& a, const vector<double>& b) {
        if (a.size() != b.size()) {
            throw invalid_argument("Vector dimensions mismatch");
        }
        
        int n = a.size();
        
#ifdef USE_CUDA
        if (useCuda() && n >= 1024) {
            try {
                CudaVector<double> d_x(n);
                CudaVector<double> d_y(n);
                
                d_x.copyFromHost(a);
                d_y.copyFromHost(b);
                
                return cudaDot(d_x.d_data, d_y.d_data, n);
            } catch (...) {
                cerr << "CUDA dot failed, falling back to CPU" << endl;
            }
        }
#endif
        
        double result = 0.0;
        
        #pragma omp parallel for reduction(+:result)
        for (int i = 0; i < n; ++i) {
            result += a[i] * b[i];
        }
        
        return result;
    }

    static vector<double> axpy(double alpha, const vector<double>& x, 
                                const vector<double>& y) {
        if (x.size() != y.size()) {
            throw invalid_argument("Vector dimensions mismatch");
        }
        
        int n = x.size();
        
#ifdef USE_CUDA
        if (useCuda() && n >= 1024) {
            try {
                CudaVector<double> d_x(n);
                CudaVector<double> d_y(n);
                CudaVector<double> d_z(n);
                
                d_x.copyFromHost(x);
                d_y.copyFromHost(y);
                
                cudaAxpy(d_z.d_data, alpha, d_x.d_data, d_y.d_data, n);
                
                vector<double> result;
                d_z.copyToHost(result);
                return result;
            } catch (...) {
                cerr << "CUDA axpy failed, falling back to CPU" << endl;
            }
        }
#endif
        
        vector<double> result(n);
        
        #pragma omp parallel for
        for (int i = 0; i < n; ++i) {
            result[i] = alpha * x[i] + y[i];
        }
        
        return result;
    }

    static double norm2(const vector<double>& v) {
        return sqrt(dot(v, v));
    }

    static vector<vector<double>> add(const vector<vector<double>>& A, 
                                       const vector<vector<double>>& B) {
        if (A.size() != B.size() || A[0].size() != B[0].size()) {
            throw invalid_argument("Matrix dimensions mismatch");
        }
        
        vector<vector<double>> result(A.size(), vector<double>(A[0].size()));
        
        #pragma omp parallel for collapse(2)
        for (int i = 0; i < A.size(); ++i) {
            for (int j = 0; j < A[0].size(); ++j) {
                result[i][j] = A[i][j] + B[i][j];
            }
        }
        
        return result;
    }

    static vector<vector<double>> scalar_mult(const vector<vector<double>>& A, 
                                               double scalar) {
        vector<vector<double>> result = A;
        
        #pragma omp parallel for collapse(2)
        for (auto& row : result) {
            for (double& val : row) {
                val *= scalar;
            }
        }
        
        return result;
    }

    static void add_to_sparse(vector<vector<double>>& K, int i, int j, double val) {
        if (i >= 0 && i < K.size() && j >= 0 && j < K[0].size()) {
            #pragma omp atomic
            K[i][j] += val;
        }
    }

    static vector<vector<double>> create_sparse(int n, int m) {
        return vector<vector<double>>(n, vector<double>(m, 0.0));
    }
};
