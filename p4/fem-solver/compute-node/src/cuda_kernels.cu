#include "cuda_kernels.cuh"
#include <cuda_runtime.h>
#include <iostream>

#define BLOCK_SIZE 16

__global__ void matMulKernel(double* C, const double* A, const double* B, int m, int k, int n) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < m && col < n) {
        double sum = 0.0;
        for (int i = 0; i < k; ++i) {
            sum += A[row * k + i] * B[i * n + col];
        }
        C[row * n + col] = sum;
    }
}

__global__ void matVecKernel(double* y, const double* A, const double* x, int m, int n) {
    int row = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < m) {
        double sum = 0.0;
        for (int j = 0; j < n; ++j) {
            sum += A[row * n + j] * x[j];
        }
        y[row] = sum;
    }
}

__global__ void axpyKernel(double* z, double alpha, const double* x, const double* y, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        z[idx] = alpha * x[idx] + y[idx];
    }
}

__global__ void dotProductKernel(double* result, const double* x, const double* y, int n) {
    __shared__ double shared_sum[BLOCK_SIZE];
    int tid = threadIdx.x;
    int idx = blockIdx.x * BLOCK_SIZE + threadIdx.x;

    if (tid < BLOCK_SIZE) {
        shared_sum[tid] = 0.0;
    }
    __syncthreads();

    while (idx < n) {
        shared_sum[tid] += x[idx] * y[idx];
        idx += gridDim.x * BLOCK_SIZE;
    }
    __syncthreads();

    for (int s = BLOCK_SIZE / 2; s > 0; s >>= 1) {
        if (tid < s) {
            shared_sum[tid] += shared_sum[tid + s];
        }
        __syncthreads();
    }

    if (tid == 0) {
        result[blockIdx.x] = shared_sum[0];
    }
}

bool checkCudaAvailable() {
    int deviceCount;
    cudaGetDeviceCount(&deviceCount);
    return deviceCount > 0;
}

void cudaMatMul(double* C, const double* A, const double* B, int m, int k, int n) {
    dim3 blockDim(BLOCK_SIZE, BLOCK_SIZE);
    dim3 gridDim((n + blockDim.x - 1) / blockDim.x, (m + blockDim.y - 1) / blockDim.y);
    matMulKernel<<<gridDim, blockDim>>>(C, A, B, m, k, n);
    cudaDeviceSynchronize();
}

void cudaMatVec(double* y, const double* A, const double* x, int m, int n) {
    int blockSize = BLOCK_SIZE;
    int gridSize = (m + blockSize - 1) / blockSize;
    matVecKernel<<<gridSize, blockSize>>>(y, A, x, m, n);
    cudaDeviceSynchronize();
}

void cudaAxpy(double* z, double alpha, const double* x, const double* y, int n) {
    int blockSize = BLOCK_SIZE;
    int gridSize = (n + blockSize - 1) / blockSize;
    axpyKernel<<<gridSize, blockSize>>>(z, alpha, x, y, n);
    cudaDeviceSynchronize();
}

double cudaDot(const double* x, const double* y, int n) {
    const int numBlocks = 64;
    double* d_partialSums;
    cudaMalloc(&d_partialSums, numBlocks * sizeof(double));

    dotProductKernel<<<numBlocks, BLOCK_SIZE>>>(d_partialSums, x, y, n);
    cudaDeviceSynchronize();

    double h_partialSums[numBlocks];
    cudaMemcpy(h_partialSums, d_partialSums, numBlocks * sizeof(double), cudaMemcpyDeviceToHost);

    double result = 0.0;
    for (int i = 0; i < numBlocks; ++i) {
        result += h_partialSums[i];
    }

    cudaFree(d_partialSums);
    return result;
}
