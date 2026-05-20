class QuantumState {
  static MAX_QUBITS = 15;
  
  constructor(numQubits) {
    if (numQubits < 1 || numQubits > QuantumState.MAX_QUBITS) {
      throw new Error(`Number of qubits must be between 1 and ${QuantumState.MAX_QUBITS}`);
    }
    
    this.numQubits = numQubits;
    this.dim = 1 << numQubits;
    
    try {
      this.state = new Array(this.dim);
      for (let i = 0; i < this.dim; i++) {
        this.state[i] = { real: 0, imag: 0 };
      }
    } catch (e) {
      throw new Error(`Failed to allocate memory: ${e.message}`);
    }
    
    this.state[0].real = 1;
    this._rng = Math.random;
  }

  _validateQubit(qubit) {
    if (qubit < 0 || qubit >= this.numQubits) {
      throw new Error(`Invalid qubit index: ${qubit}, expected 0 to ${this.numQubits - 1}`);
    }
  }

  applyHadamard(qubit) {
    this._validateQubit(qubit);
    const sqrt2Inv = 1 / Math.sqrt(2);
    const mask = 1 << qubit;

    for (let base = 0; base < this.dim; base += mask << 1) {
      for (let i = 0; i < mask; i++) {
        const idx0 = base + i;
        const idx1 = idx0 + mask;

        if (idx1 >= this.dim) continue;

        const val0Real = this.state[idx0].real;
        const val0Imag = this.state[idx0].imag;
        const val1Real = this.state[idx1].real;
        const val1Imag = this.state[idx1].imag;

        this.state[idx0].real = sqrt2Inv * (val0Real + val1Real);
        this.state[idx0].imag = sqrt2Inv * (val0Imag + val1Imag);
        this.state[idx1].real = sqrt2Inv * (val0Real - val1Real);
        this.state[idx1].imag = sqrt2Inv * (val0Imag - val1Imag);
      }
    }
  }

  applyX(qubit) {
    this._validateQubit(qubit);
    const mask = 1 << qubit;

    for (let base = 0; base < this.dim; base += mask << 1) {
      for (let i = 0; i < mask; i++) {
        const idx0 = base + i;
        const idx1 = idx0 + mask;

        if (idx1 >= this.dim) continue;

        const tempReal = this.state[idx0].real;
        const tempImag = this.state[idx0].imag;

        this.state[idx0].real = this.state[idx1].real;
        this.state[idx0].imag = this.state[idx1].imag;
        this.state[idx1].real = tempReal;
        this.state[idx1].imag = tempImag;
      }
    }
  }

  applyY(qubit) {
    this._validateQubit(qubit);
    const mask = 1 << qubit;

    for (let base = 0; base < this.dim; base += mask << 1) {
      for (let i = 0; i < mask; i++) {
        const idx0 = base + i;
        const idx1 = idx0 + mask;

        if (idx1 >= this.dim) continue;

        const tempReal = this.state[idx0].real;
        const tempImag = this.state[idx0].imag;

        this.state[idx0].real = this.state[idx1].imag;
        this.state[idx0].imag = -this.state[idx1].real;
        this.state[idx1].real = -tempImag;
        this.state[idx1].imag = tempReal;
      }
    }
  }

  applyZ(qubit) {
    this._validateQubit(qubit);
    const mask = 1 << qubit;

    for (let i = 0; i < this.dim; i++) {
      if (i & mask) {
        this.state[i].real *= -1;
        this.state[i].imag *= -1;
      }
    }
  }

  applyCNOT(control, target) {
    this._validateQubit(control);
    this._validateQubit(target);
    
    if (control === target) {
      throw new Error('Control and target must be different qubits');
    }
    
    const ctrlMask = 1 << control;
    const tgtMask = 1 << target;

    for (let i = 0; i < this.dim; i++) {
      if (i & ctrlMask) {
        const j = i ^ tgtMask;
        if (j < this.dim && i < j) {
          const tempReal = this.state[i].real;
          const tempImag = this.state[i].imag;
          this.state[i].real = this.state[j].real;
          this.state[i].imag = this.state[j].imag;
          this.state[j].real = tempReal;
          this.state[j].imag = tempImag;
        }
      }
    }
  }

  measureAll() {
    const probs = this.getProbabilities();
    const r = this._rng();

    let cumulative = 0;
    let result = 0;
    for (let i = 0; i < this.dim; i++) {
      cumulative += probs[i];
      if (r <= cumulative) {
        result = i;
        break;
      }
    }

    this.state.forEach(s => {
      s.real = 0;
      s.imag = 0;
    });
    this.state[result].real = 1;

    const bits = new Array(this.numQubits);
    for (let i = 0; i < this.numQubits; i++) {
      bits[i] = (result >> i) & 1;
    }
    return bits;
  }

  measure(qubit) {
    const mask = 1 << qubit;
    let prob0 = 0;

    for (let i = 0; i < this.dim; i++) {
      if (!(i & mask)) {
        prob0 += this.state[i].real ** 2 + this.state[i].imag ** 2;
      }
    }

    const r = this._rng();
    const result = r <= prob0 ? 0 : 1;

    const normFactor = Math.sqrt(result === 0 ? prob0 : 1 - prob0);
    for (let i = 0; i < this.dim; i++) {
      if (((i >> qubit) & 1) !== result) {
        this.state[i].real = 0;
        this.state[i].imag = 0;
      } else {
        this.state[i].real /= normFactor;
        this.state[i].imag /= normFactor;
      }
    }

    return result;
  }

  getStatevector() {
    return this.state.map(s => ({ real: s.real, imag: s.imag }));
  }

  getProbabilities() {
    return this.state.map(s => s.real ** 2 + s.imag ** 2);
  }

  getNumQubits() {
    return this.numQubits;
  }

  reset() {
    this.state.forEach(s => {
      s.real = 0;
      s.imag = 0;
    });
    this.state[0].real = 1;
  }
}

export default QuantumState;
