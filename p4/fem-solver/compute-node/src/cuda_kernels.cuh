#ifndef CUDA_KERNELS_CUH
#define CUDA_KERNELS_CUH

#include <vector>
#include <stdexcept>

bool checkCudaAvailable();

template<typename T>
class CudaMatrix {
public:
    int rows;
    int cols;
    T* d_data;

    CudaMatrix(int r, int c) : rows(r), cols(c), d_data(nullptr) {
        cudaMalloc(&d_data, rows * cols * sizeof(T));
    }

    ~CudaMatrix() {
        if (d_data) {
            cudaFree(d_data);
        }
    }

    void copyFromHost(const std::vector<std::vector<T>>& host_data) {
        std::vector<T> flat;
        for (const auto& row : host_data) {
            flat.insert(flat.end(), row.begin(), row.end());
        }
        cudaMemcpy(d_data, flat.data(), rows * cols * sizeof(T), cudaMemcpyHostToDevice);
    }

    void copyToHost(std::vector<std::vector<T>>& host_data) {
        std::vector<T> flat(rows * cols);
        cudaMemcpy(flat.data(), d_data, rows * cols * sizeof(T), cudaMemcpyDeviceToHost);
        host_data.resize(rows);
        for (int i = 0; i < rows; ++i) {
            host_data[i].resize(cols);
            for (int j = 0; j < cols; ++j) {
                host_data[i][j] = flat[i * cols + j];
            }
        }
    }
};

template<typename T>
class CudaVector {
public:
    int size;
    T* d_data;

    CudaVector(int n) : size(n), d_data(nullptr) {
        cudaMalloc(&d_data, size * sizeof(T));
    }

    ~CudaVector() {
        if (d_data) {
            cudaFree(d_data);
        }
    }

    void copyFromHost(const std::vector<T>& host_data) {
        cudaMemcpy(d_data, host_data.data(), size * sizeof(T), cudaMemcpyHostToDevice);
    }

    void copyToHost(std::vector<T>& host_data) {
        host_data.resize(size);
        cudaMemcpy(host_data.data(), d_data, size * sizeof(T), cudaMemcpyDeviceToHost);
    }
};

void cudaMatMul(double* C, const double* A, const double* B, int m, int k, int n);
void cudaMatVec(double* y, const double* A, const double* x, int m, int n);
void cudaAxpy(double* z, double alpha, const double* x, const double* y, int n);
double cudaDot(const double* x, const double* y, int n);

#endif
