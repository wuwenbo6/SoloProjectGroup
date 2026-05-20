#include "quantum_state.h"
#include <cmath>
#include <algorithm>
#include <iostream>

QuantumState::QuantumState(int num_qubits) 
    : num_qubits_(num_qubits), rng_(std::random_device{}()) {
    
    if (num_qubits < 1 || num_qubits > MAX_QUBITS) {
        throw std::invalid_argument(
            "Number of qubits must be between 1 and " + 
            std::to_string(MAX_QUBITS)
        );
    }
    
    dim_ = 1ULL << num_qubits;
    
    try {
        state_.reserve(dim_);
        state_.resize(dim_, Complex(0, 0));
    } catch (const std::bad_alloc& e) {
        throw std::runtime_error(
            "Failed to allocate memory for quantum state: " + 
            std::string(e.what())
        );
    }
    
    if (state_.size() != dim_) {
        throw std::runtime_error("Vector resize failed - size mismatch");
    }
    
    state_[0] = Complex(1, 0);
}

void QuantumState::reset() {
    std::fill(state_.begin(), state_.end(), Complex(0, 0));
    state_[0] = Complex(1, 0);
}

void QuantumState::validate_qubit(int qubit) const {
    if (qubit < 0 || qubit >= num_qubits_) {
        throw std::out_of_range(
            "Invalid qubit index: " + std::to_string(qubit) + 
            ", expected 0 to " + std::to_string(num_qubits_ - 1)
        );
    }
}

void QuantumState::apply_single_qubit_gate(int qubit, const Complex mat[4]) {
    validate_qubit(qubit);
    
    const uint64_t mask = 1ULL << qubit;
    const uint64_t stride = mask;
    
    for (uint64_t base = 0; base < dim_; base += (mask << 1)) {
        for (uint64_t i = 0; i < stride; ++i) {
            const uint64_t idx0 = base + i;
            const uint64_t idx1 = idx0 + stride;
            
            if (idx1 >= dim_) {
                throw std::out_of_range("Index out of bounds in gate application");
            }
            
            const Complex val0 = state_[idx0];
            const Complex val1 = state_[idx1];
            
            state_[idx0] = mat[0] * val0 + mat[1] * val1;
            state_[idx1] = mat[2] * val0 + mat[3] * val1;
        }
    }
}

void QuantumState::apply_hadamard(int qubit) {
    const double inv_sqrt2 = 1.0 / std::sqrt(2.0);
    const Complex mat[4] = {
        Complex(inv_sqrt2, 0), Complex(inv_sqrt2, 0),
        Complex(inv_sqrt2, 0), Complex(-inv_sqrt2, 0)
    };
    apply_single_qubit_gate(qubit, mat);
}

void QuantumState::apply_x(int qubit) {
    const Complex mat[4] = {
        Complex(0, 0), Complex(1, 0),
        Complex(1, 0), Complex(0, 0)
    };
    apply_single_qubit_gate(qubit, mat);
}

void QuantumState::apply_y(int qubit) {
    const Complex mat[4] = {
        Complex(0, 0), Complex(0, -1),
        Complex(0, 1), Complex(0, 0)
    };
    apply_single_qubit_gate(qubit, mat);
}

void QuantumState::apply_z(int qubit) {
    const Complex mat[4] = {
        Complex(1, 0), Complex(0, 0),
        Complex(0, 0), Complex(-1, 0)
    };
    apply_single_qubit_gate(qubit, mat);
}

void QuantumState::apply_cnot(int control, int target) {
    validate_qubit(control);
    validate_qubit(target);
    
    if (control == target) {
        throw std::invalid_argument("Control and target must be different qubits");
    }
    
    const uint64_t ctrl_mask = 1ULL << control;
    const uint64_t tgt_mask = 1ULL << target;
    const uint64_t inner_stride = 1ULL << std::min(control, target);
    const uint64_t outer_stride = 1ULL << (std::max(control, target) + 1);
    
    for (uint64_t base1 = 0; base1 < dim_; base1 += outer_stride) {
        for (uint64_t base0 = base1; base0 < base1 + (outer_stride >> 1); base0 += (inner_stride << 1)) {
            for (uint64_t i = 0; i < inner_stride; ++i) {
                const uint64_t idx = base0 + i;
                
                if (idx + ctrl_mask >= dim_ || idx + tgt_mask >= dim_) {
                    continue;
                }
                
                if ((idx + ctrl_mask) & ctrl_mask) {
                    const uint64_t idx_swap = idx ^ tgt_mask;
                    if (idx_swap < dim_ && idx < idx_swap) {
                        std::swap(state_[idx], state_[idx_swap]);
                    }
                }
            }
        }
    }
}

std::vector<int> QuantumState::measure_all() {
    const std::vector<double> probs = get_probabilities();
    std::uniform_real_distribution<double> dist(0.0, 1.0);
    const double r = dist(rng_);
    
    double cumulative = 0.0;
    uint64_t result = 0;
    for (uint64_t i = 0; i < dim_; ++i) {
        cumulative += probs[i];
        if (r <= cumulative) {
            result = i;
            break;
        }
    }
    
    reset();
    if (result < dim_) {
        state_[result] = Complex(1, 0);
    }
    
    std::vector<int> bits(num_qubits_);
    for (int i = 0; i < num_qubits_; ++i) {
        bits[i] = (result >> i) & 1;
    }
    return bits;
}

int QuantumState::measure(int qubit) {
    validate_qubit(qubit);
    
    const uint64_t mask = 1ULL << qubit;
    double prob0 = 0.0;
    
    for (uint64_t i = 0; i < dim_; ++i) {
        if (!(i & mask)) {
            prob0 += std::norm(state_[i]);
        }
    }
    
    std::uniform_real_distribution<double> dist(0.0, 1.0);
    const double r = dist(rng_);
    const int result = (r <= prob0) ? 0 : 1;
    
    const double norm_factor = std::sqrt(result == 0 ? prob0 : (1.0 - prob0));
    if (norm_factor > 1e-10) {
        for (uint64_t i = 0; i < dim_; ++i) {
            if (((i >> qubit) & 1) != result) {
                state_[i] = Complex(0, 0);
            } else {
                state_[i] /= norm_factor;
            }
        }
    } else {
        reset();
    }
    
    return result;
}

std::vector<Complex> QuantumState::get_statevector() const {
    return state_;
}

std::vector<double> QuantumState::get_probabilities() const {
    std::vector<double> probs(dim_);
    for (uint64_t i = 0; i < dim_; ++i) {
        probs[i] = std::norm(state_[i]);
    }
    return probs;
}
