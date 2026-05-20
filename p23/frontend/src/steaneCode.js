class SteaneCode {
  static NUM_QUBITS = 7
  static NUM_ANCILLAS = 6

  constructor() {
    this.state = new Array(128).fill(null).map(() => ({ real: 0, imag: 0 }))
    this.state[0].real = 1
    this.ancillas = new Array(6).fill(0)
    this.noiseHistory = []
    this.errorLocations = { x: [], z: [] }
    this.correctionApplied = false
  }

  reset() {
    this.state = new Array(128).fill(null).map(() => ({ real: 0, imag: 0 }))
    this.state[0].real = 1
    this.ancillas = new Array(6).fill(0)
    this.noiseHistory = []
    this.errorLocations = { x: [], z: [] }
    this.correctionApplied = false
  }

  applyHadamard(qubit) {
    const sqrt2Inv = 1 / Math.sqrt(2)
    const mask = 1 << qubit
    const newState = new Array(128).fill(null).map(() => ({ real: 0, imag: 0 }))
    
    for (let i = 0; i < 128; i++) {
      const amplitude = this.state[i]
      if (amplitude.real === 0 && amplitude.imag === 0) continue
      
      const flipped = i ^ mask
      newState[i].real += sqrt2Inv * amplitude.real
      newState[i].imag += sqrt2Inv * amplitude.imag
      newState[flipped].real += sqrt2Inv * amplitude.real
      newState[flipped].imag += sqrt2Inv * amplitude.imag
    }
    
    this.state = newState
  }

  applyCNOT(control, target) {
    const ctrlMask = 1 << control
    const tgtMask = 1 << target
    const newState = new Array(128).fill(null).map(() => ({ real: 0, imag: 0 }))
    
    for (let i = 0; i < 128; i++) {
      const amplitude = this.state[i]
      if (amplitude.real === 0 && amplitude.imag === 0) continue
      
      if (i & ctrlMask) {
        const flipped = i ^ tgtMask
        newState[flipped].real += amplitude.real
        newState[flipped].imag += amplitude.imag
      } else {
        newState[i].real += amplitude.real
        newState[i].imag += amplitude.imag
      }
    }
    
    this.state = newState
  }

  encodeLogicalZero() {
    this.reset()
    
    this.applyHadamard(0)
    this.applyHadamard(1)
    this.applyHadamard(2)
    
    this.applyCNOT(0, 3)
    this.applyCNOT(1, 4)
    this.applyCNOT(2, 5)
    
    this.applyCNOT(0, 6)
    this.applyCNOT(1, 6)
    this.applyCNOT(2, 6)
    
    this.noiseHistory.push({ type: 'encode', message: '已编码 |0⟩_L 逻辑态' })
    return true
  }

  encodeLogicalOne() {
    this.reset()
    this.state[1].real = 0
    this.state[0].real = 0
    
    const maskX = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 6)
    for (let i = 0; i < 128; i++) {
      this.state[i].real = 0
    }
    this.state[maskX].real = 1
    
    this.applyHadamard(0)
    this.applyHadamard(1)
    this.applyHadamard(2)
    
    this.applyCNOT(0, 3)
    this.applyCNOT(1, 4)
    this.applyCNOT(2, 5)
    
    this.applyCNOT(0, 6)
    this.applyCNOT(1, 6)
    this.applyCNOT(2, 6)
    
    this.noiseHistory.push({ type: 'encode', message: '已编码 |1⟩_L 逻辑态' })
    return true
  }

  applyBitFlipNoise(qubit, probability = 0.5) {
    if (qubit < 0 || qubit >= 7) return false
    
    if (Math.random() < probability) {
      const mask = 1 << qubit
      const newState = new Array(128).fill(null).map(() => ({ real: 0, imag: 0 }))
      
      for (let i = 0; i < 128; i++) {
        const amplitude = this.state[i]
        if (amplitude.real === 0 && amplitude.imag === 0) continue
        
        const flipped = i ^ mask
        newState[flipped].real += amplitude.real
        newState[flipped].imag += amplitude.imag
      }
      
      this.state = newState
      this.errorLocations.x.push(qubit)
      this.noiseHistory.push({
        type: 'bitflip',
        qubit,
        message: `在量子比特 q${qubit} 上应用了比特翻转噪声`
      })
      return true
    }
    
    this.noiseHistory.push({
      type: 'no_noise',
      message: `未在 q${qubit} 上产生比特翻转`
    })
    return false
  }

  applyPhaseFlipNoise(qubit, probability = 0.5) {
    if (qubit < 0 || qubit >= 7) return false
    
    if (Math.random() < probability) {
      const mask = 1 << qubit
      
      for (let i = 0; i < 128; i++) {
        if (i & mask) {
          this.state[i].real *= -1
          this.state[i].imag *= -1
        }
      }
      
      this.errorLocations.z.push(qubit)
      this.noiseHistory.push({
        type: 'phaseflip',
        qubit,
        message: `在量子比特 q${qubit} 上应用了相位翻转噪声`
      })
      return true
    }
    
    this.noiseHistory.push({
      type: 'no_noise',
      message: `未在 q${qubit} 上产生相位翻转`
    })
    return false
  }

  measureStabilizers() {
    const xStabilizers = [
      [0, 2, 4, 6],
      [1, 2, 5, 6],
      [3, 4, 5, 6]
    ]
    
    const zStabilizers = [
      [0, 2, 4, 6],
      [1, 2, 5, 6],
      [3, 4, 5, 6]
    ]
    
    const xSyndromes = []
    const zSyndromes = []
    
    for (let i = 0; i < 3; i++) {
      let xParity = 0
      for (const q of xStabilizers[i]) {
        xParity ^= this.errorLocations.x.includes(q) ? 1 : 0
      }
      xSyndromes.push(xParity)
    }
    
    for (let i = 0; i < 3; i++) {
      let zParity = 0
      for (const q of zStabilizers[i]) {
        zParity ^= this.errorLocations.z.includes(q) ? 1 : 0
      }
      zSyndromes.push(zParity)
    }
    
    this.ancillas = [...xSyndromes, ...zSyndromes]
    
    this.noiseHistory.push({
      type: 'syndrome',
      xSyndromes,
      zSyndromes,
      message: `稳定子测量结果: X=${xSyndromes.join(',')}, Z=${zSyndromes.join(',')}`
    })
    
    return { xSyndromes, zSyndromes }
  }

  decodeError(xSyndromes, zSyndromes) {
    const xLUT = {
      '0,0,0': -1,
      '1,0,0': 0,
      '0,1,0': 1,
      '1,1,0': 2,
      '0,0,1': 3,
      '1,0,1': 4,
      '0,1,1': 5,
      '1,1,1': 6
    }
    
    const xErrorQubit = xLUT[xSyndromes.join(',')]
    const zErrorQubit = xLUT[zSyndromes.join(',')]
    
    this.noiseHistory.push({
      type: 'decode',
      xErrorQubit,
      zErrorQubit,
      message: `检测到错误: X在q${xErrorQubit}, Z在q${zErrorQubit}`
    })
    
    return { xErrorQubit, zErrorQubit }
  }

  applyCorrection(xErrorQubit, zErrorQubit) {
    if (xErrorQubit >= 0 && xErrorQubit < 7) {
      const mask = 1 << xErrorQubit
      const newState = new Array(128).fill(null).map(() => ({ real: 0, imag: 0 }))
      
      for (let i = 0; i < 128; i++) {
        const amplitude = this.state[i]
        if (amplitude.real === 0 && amplitude.imag === 0) continue
        
        const flipped = i ^ mask
        newState[flipped].real += amplitude.real
        newState[flipped].imag += amplitude.imag
      }
      
      this.state = newState
      this.noiseHistory.push({ type: 'correct_x', qubit: xErrorQubit, message: `在 q${xErrorQubit} 应用X纠错门` })
    }
    
    if (zErrorQubit >= 0 && zErrorQubit < 7) {
      const mask = 1 << zErrorQubit
      
      for (let i = 0; i < 128; i++) {
        if (i & mask) {
          this.state[i].real *= -1
          this.state[i].imag *= -1
        }
      }
      this.noiseHistory.push({ type: 'correct_z', qubit: zErrorQubit, message: `在 q${zErrorQubit} 应用Z纠错门` })
    }
    
    this.correctionApplied = true
    this.errorLocations = { x: [], z: [] }
    
    return true
  }

  decodeLogicalState() {
    const xMask = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 6)
    let logicalZeroProb = 0
    let logicalOneProb = 0
    
    for (let i = 0; i < 128; i++) {
      const prob = this.state[i].real ** 2 + this.state[i].imag ** 2
      if (prob === 0) continue
      
      if ((i & xMask) === 0) {
        logicalZeroProb += prob
      } else {
        logicalOneProb += prob
      }
    }
    
    return {
      zero: logicalZeroProb,
      one: logicalOneProb
    }
  }

  getStateVector() {
    return this.state
  }

  getProbabilities() {
    return this.state.map(s => s.real ** 2 + s.imag ** 2)
  }

  getNoiseHistory() {
    return [...this.noiseHistory]
  }

  static getStabilizerGenerators() {
    return {
      X: [
        { qubits: [0, 2, 4, 6], name: 'X₀X₂X₄X₆' },
        { qubits: [1, 2, 5, 6], name: 'X₁X₂X₅X₆' },
        { qubits: [3, 4, 5, 6], name: 'X₃X₄X₅X₆' }
      ],
      Z: [
        { qubits: [0, 2, 4, 6], name: 'Z₀Z₂Z₄Z₆' },
        { qubits: [1, 2, 5, 6], name: 'Z₁Z₂Z₅Z₆' },
        { qubits: [3, 4, 5, 6], name: 'Z₃Z₄Z₅Z₆' }
      ]
    }
  }

  static getCodeDescription() {
    return `Steane码是CSS型量子纠错码，[[7,1,3]]码，使用7个物理量子比特编码1个逻辑量子比特，能纠正任意单量子比特错误。
    
稳定子生成元：
X稳定子：X₀X₂X₄X₆, X₁X₂X₅X₆, X₃X₄X₅X₆
Z稳定子：Z₀Z₂Z₄Z₆, Z₁Z₂Z₅Z₆, Z₃Z₄Z₅Z₆

逻辑操作：
X_L = X₀X₁X₂X₃X₄X₅X₆
Z_L = Z₀Z₁Z₂Z₃Z₄Z₅Z₆`
  }
}

export default SteaneCode
