#ifndef QUANTUM_STATE_H
#define QUANTUM_STATE_H

#include <complex>
#include <vector>
#include <random>
#include <cstdint>
#include <stdexcept>
#include <new>

using Complex = std::complex<double>;

class QuantumState {
public:
    static constexpr int MAX_QUBITS = 15;
    
    explicit QuantumState(int num_qubits);
    
    void apply_hadamard(int qubit);
    void apply_x(int qubit);
    void apply_y(int qubit);
    void apply_z(int qubit);
    void apply_cnot(int control, int target);
    
    std::vector<int> measure_all();
    int measure(int qubit);
    
    std::vector<Complex> get_statevector() const;
    std::vector<double> get_probabilities() const;
    int get_num_qubits() const { return num_qubits_; }
    uint64_t get_dim() const { return dim_; }
    
    void reset();
    
private:
    int num_qubits_;
    uint64_t dim_;
    std::vector<Complex> state_;
    std::mt19937 rng_;
    
    void validate_qubit(int qubit) const;
    void apply_single_qubit_gate(int qubit, const Complex mat[4]);
};

#endif
