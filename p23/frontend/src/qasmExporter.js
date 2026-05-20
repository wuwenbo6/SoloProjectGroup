class QASMExporter {
  static generateQASM(gates, numQubits, circuitName = 'quantum_circuit') {
    const lines = []
    
    lines.push(`// Generated Quantum Circuit: ${circuitName}`)
    lines.push(`// Qubits: ${numQubits}`)
    lines.push(`// Gates: ${gates.length}`)
    lines.push('')
    
    lines.push('OPENQASM 2.0;')
    lines.push('include "qelib1.inc";')
    lines.push('')
    
    lines.push(`qreg q[${numQubits}];`)
    lines.push(`creg c[${numQubits}];`)
    lines.push('')
    
    const gateMappings = {
      'H': 'h',
      'X': 'x',
      'Y': 'y',
      'Z': 'z',
      'CNOT': 'cx'
    }
    
    gates.forEach((gate, index) => {
      const qasmGate = gateMappings[gate.type]
      if (!qasmGate) return
      
      if (gate.type === 'CNOT') {
        lines.push(`// Gate ${index + 1}: CNOT q${gate.qubit} -> q${gate.target}`)
        lines.push(`${qasmGate} q[${gate.qubit}], q[${gate.target}];`)
      } else {
        lines.push(`// Gate ${index + 1}: ${gate.type} q${gate.qubit}`)
        lines.push(`${qasmGate} q[${gate.qubit}];`)
      }
    })
    
    lines.push('')
    lines.push('// Measurement')
    for (let i = 0; i < numQubits; i++) {
      lines.push(`measure q[${i}] -> c[${i}];`)
    }
    
    return lines.join('\n')
  }
  
  static generateQASM3(gates, numQubits, circuitName = 'quantum_circuit') {
    const lines = []
    
    lines.push(`// Generated Quantum Circuit (QASM 3.0): ${circuitName}`)
    lines.push(`// Qubits: ${numQubits}, Gates: ${gates.length}`)
    lines.push('')
    
    lines.push('OPENQASM 3.0;')
    lines.push('include "stdgates.inc";')
    lines.push('')
    
    lines.push(`qubit[${numQubits}] q;`)
    lines.push(`bit[${numQubits}] c;`)
    lines.push('')
    
    const gateMappings = {
      'H': 'h',
      'X': 'x',
      'Y': 'y',
      'Z': 'z',
      'CNOT': 'cx'
    }
    
    gates.forEach((gate, index) => {
      const qasmGate = gateMappings[gate.type]
      if (!qasmGate) return
      
      if (gate.type === 'CNOT') {
        lines.push(`${qasmGate} q[${gate.qubit}], q[${gate.target}];`)
      } else {
        lines.push(`${qasmGate} q[${gate.qubit}];`)
      }
    })
    
    lines.push('')
    lines.push(`c = measure q;`)
    
    return lines.join('\n')
  }
  
  static downloadQASM(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  static validateQASM(qasm) {
    const checks = {
      hasOpenQASM: qasm.includes('OPENQASM'),
      hasQreg: qasm.includes('qreg'),
      hasCreg: qasm.includes('creg'),
      gates: (qasm.match(/(h|x|y|z|cx)\s+q\[\d+\]/g) || []).length,
      hasMeasure: qasm.includes('measure')
    }
    
    return {
      valid: checks.hasOpenQASM && checks.hasQreg && checks.hasCreg,
      ...checks
    }
  }
  
  static getBackendOptions() {
    return [
      { id: 'ibmq_qasm_simulator', name: 'IBM QASM Simulator', type: 'simulator', provider: 'IBM', qubits: 32 },
      { id: 'ibmq_qasm_simulator_gpu', name: 'IBM QASM Simulator (GPU)', type: 'simulator', provider: 'IBM', qubits: 32 },
      { id: 'simulator_statevector', name: 'Statevector Simulator', type: 'simulator', provider: 'IBM', qubits: 32 },
      { id: 'simulator_mps', name: 'MPS Simulator', type: 'simulator', provider: 'IBM', qubits: 100 },
      { id: 'ibm_perth', name: 'IBM Perth', type: 'hardware', provider: 'IBM', qubits: 7, status: 'available' },
      { id: 'ibm_lagos', name: 'IBM Lagos', type: 'hardware', provider: 'IBM', qubits: 7, status: 'available' },
      { id: 'ibm_nairobi', name: 'IBM Nairobi', type: 'hardware', provider: 'IBM', qubits: 7, status: 'available' },
      { id: 'local_simulator', name: 'Local JavaScript Simulator', type: 'local', provider: 'Local', qubits: 15 }
    ]
  }
  
  static estimateRuntime(numQubits, numGates, backendType) {
    if (backendType === 'local') {
      return Math.pow(2, numQubits - 8) * numGates * 0.01
    } else if (backendType === 'simulator') {
      return Math.pow(2, numQubits - 15) * numGates * 0.05 + 10
    } else {
      return Math.min(3600, Math.pow(2, numQubits - 10) * numGates * 0.1 + 60)
    }
  }
}

export default QASMExporter
