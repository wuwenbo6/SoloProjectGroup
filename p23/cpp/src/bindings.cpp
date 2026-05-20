#include <emscripten/bind.h>
#include "quantum_state.h"
#include <vector>
#include <string>
#include <stdexcept>

using namespace emscripten;

class QuantumStateWrapper {
public:
    QuantumStateWrapper(int num_qubits) {
        try {
            qs_ = new QuantumState(num_qubits);
        } catch (const std::exception& e) {
            EM_ASM({
                console.error("QuantumState constructor error:", UTF8ToString($0));
            }, e.what());
            throw;
        }
    }
    
    ~QuantumStateWrapper() {
        delete qs_;
    }
    
    void applyHadamard(int qubit) {
        try { qs_->apply_hadamard(qubit); }
        catch (const std::exception& e) { log_error("applyHadamard", e.what()); throw; }
    }
    
    void applyX(int qubit) {
        try { qs_->apply_x(qubit); }
        catch (const std::exception& e) { log_error("applyX", e.what()); throw; }
    }
    
    void applyY(int qubit) {
        try { qs_->apply_y(qubit); }
        catch (const std::exception& e) { log_error("applyY", e.what()); throw; }
    }
    
    void applyZ(int qubit) {
        try { qs_->apply_z(qubit); }
        catch (const std::exception& e) { log_error("applyZ", e.what()); throw; }
    }
    
    void applyCNOT(int control, int target) {
        try { qs_->apply_cnot(control, target); }
        catch (const std::exception& e) { log_error("applyCNOT", e.what()); throw; }
    }
    
    emscripten::val measureAll() {
        try {
            auto result = qs_->measure_all();
            return emscripten::val::array(result.begin(), result.end());
        } catch (const std::exception& e) { log_error("measureAll", e.what()); throw; }
    }
    
    int measure(int qubit) {
        try { return qs_->measure(qubit); }
        catch (const std::exception& e) { log_error("measure", e.what()); throw; }
    }
    
    emscripten::val getStatevector() {
        auto state = qs_->get_statevector();
        emscripten::val result = emscripten::val::array();
        for (size_t i = 0; i < state.size(); ++i) {
            emscripten::val obj = emscripten::val::object();
            obj.set("real", state[i].real());
            obj.set("imag", state[i].imag());
            result.set(i, obj);
        }
        return result;
    }
    
    emscripten::val getProbabilities() {
        auto probs = qs_->get_probabilities();
        return emscripten::val::array(probs.begin(), probs.end());
    }
    
    int getNumQubits() { return qs_->get_num_qubits(); }
    
    int getMaxQubits() { return QuantumState::MAX_QUBITS; }
    
    void reset() { qs_->reset(); }
    
private:
    QuantumState* qs_;
    
    void log_error(const char* func, const char* msg) {
        EM_ASM({
            console.error("QuantumState", UTF8ToString($0), "error:", UTF8ToString($1));
        }, func, msg);
    }
};

EMSCRIPTEN_BINDINGS(quantum_simulator) {
    class_<QuantumStateWrapper>("QuantumState")
        .constructor<int>()
        .function("applyHadamard", &QuantumStateWrapper::applyHadamard)
        .function("applyX", &QuantumStateWrapper::applyX)
        .function("applyY", &QuantumStateWrapper::applyY)
        .function("applyZ", &QuantumStateWrapper::applyZ)
        .function("applyCNOT", &QuantumStateWrapper::applyCNOT)
        .function("measureAll", &QuantumStateWrapper::measureAll)
        .function("measure", &QuantumStateWrapper::measure)
        .function("getStatevector", &QuantumStateWrapper::getStatevector)
        .function("getProbabilities", &QuantumStateWrapper::getProbabilities)
        .function("getNumQubits", &QuantumStateWrapper::getNumQubits)
        .function("getMaxQubits", &QuantumStateWrapper::getMaxQubits)
        .function("reset", &QuantumStateWrapper::reset);
}
