export class ARMCore {
  constructor() {
    this.registers = new Uint32Array(16)
    this.xpsr = 0
    this.sp_main = 0x20000000
    this.sp_process = 0x20010000
    this.control = 0
    this.primask = 0
    this.faultmask = 0
    this.basepri = 0
    this.memory = new Uint8Array(0x200000)
    this.memory32 = new Uint32Array(this.memory.buffer)
    this.breakpoints = new Set()
    this.isRunning = false
    this.cycles = 0
    this.systick = {
      ctrl: 0,
      load: 0,
      val: 0,
      calib: 0
    }
    this.nvic = {
      iser: new Uint32Array(8),
      icer: new Uint32Array(8),
      ispr: new Uint32Array(8),
      icpr: new Uint32Array(8),
      iabr: new Uint32Array(8),
      ipr: new Uint8Array(240)
    }
    this.exceptionPending = 0
    this.exceptionLatencyCounter = 0
    this.pendingException = 0
    this.exceptionActive = new Uint8Array(256)
  }

  reset() {
    this.registers.fill(0)
    this.xpsr = 0x01000000
    this.control = 0
    this.primask = 0
    this.faultmask = 0
    this.basepri = 0
    this.cycles = 0
    const sp = this.read32(0x00000000)
    const pc = this.read32(0x00000004)
    this.sp_main = sp
    this.setSP(sp)
    this.setPC(pc & 0xFFFFFFFE)
    this.systick = { ctrl: 0, load: 0, val: 0, calib: 0 }
    this.nvic.iser.fill(0)
    this.nvic.icer.fill(0)
    this.nvic.ispr.fill(0)
    this.nvic.icpr.fill(0)
    this.nvic.iabr.fill(0)
    this.nvic.ipr.fill(0)
    this.exceptionPending = 0
    this.exceptionActive.fill(0)
  }

  getSP() {
    return (this.control & 2) ? this.sp_process : this.sp_main
  }

  setSP(val) {
    if (this.control & 2) {
      this.sp_process = val & 0xFFFFFFFC
    } else {
      this.sp_main = val & 0xFFFFFFFC
    }
  }

  getPC() {
    return this.registers[15]
  }

  setPC(val) {
    this.registers[15] = val & 0xFFFFFFFE
  }

  getLR() {
    return this.registers[14]
  }

  setLR(val) {
    this.registers[14] = val
  }

  read8(addr) {
    if (addr >= 0 && addr < this.memory.length) {
      return this.memory[addr]
    }
    return this.handleMMIORead(addr, 1)
  }

  read16(addr) {
    if (addr >= 0 && addr < this.memory.length - 1) {
      return this.memory[addr] | (this.memory[addr + 1] << 8)
    }
    return this.handleMMIORead(addr, 2)
  }

  read32(addr) {
    if (addr >= 0 && addr < this.memory.length - 3) {
      return this.memory[addr] | (this.memory[addr + 1] << 8) |
             (this.memory[addr + 2] << 16) | (this.memory[addr + 3] << 24)
    }
    return this.handleMMIORead(addr, 4)
  }

  write8(addr, val) {
    if (addr >= 0 && addr < this.memory.length) {
      this.memory[addr] = val & 0xFF
      return
    }
    this.handleMMIOWrite(addr, val, 1)
  }

  write16(addr, val) {
    if (addr >= 0 && addr < this.memory.length - 1) {
      this.memory[addr] = val & 0xFF
      this.memory[addr + 1] = (val >> 8) & 0xFF
      return
    }
    this.handleMMIOWrite(addr, val, 2)
  }

  write32(addr, val) {
    if (addr >= 0 && addr < this.memory.length - 3) {
      this.memory[addr] = val & 0xFF
      this.memory[addr + 1] = (val >> 8) & 0xFF
      this.memory[addr + 2] = (val >> 16) & 0xFF
      this.memory[addr + 3] = (val >> 24) & 0xFF
      return
    }
    this.handleMMIOWrite(addr, val, 4)
  }

  handleMMIORead(addr, size) {
    const reg = addr & 0xFFFFF000
    if (reg === 0xE000E000) {
      return this.readSysTick(addr, size)
    }
    if (reg >= 0xE000E100 && reg <= 0xE000E4EF) {
      return this.readNVIC(addr, size)
    }
    return 0
  }

  handleMMIOWrite(addr, val, size) {
    const reg = addr & 0xFFFFF000
    if (reg === 0xE000E000) {
      this.writeSysTick(addr, val, size)
      return
    }
    if (reg >= 0xE000E100 && reg <= 0xE000E4EF) {
      this.writeNVIC(addr, val, size)
      return
    }
  }

  readSysTick(addr, size) {
    const offset = addr - 0xE000E000
    switch (offset) {
      case 0x10: return this.systick.ctrl
      case 0x14: return this.systick.load
      case 0x18: return this.systick.val
      case 0x1C: return this.systick.calib
      default: return 0
    }
  }

  writeSysTick(addr, val, size) {
    const offset = addr - 0xE000E000
    switch (offset) {
      case 0x10: this.systick.ctrl = val & 0x7; break
      case 0x14: this.systick.load = val & 0xFFFFFF; break
      case 0x18: this.systick.val = 0; break
    }
  }

  readNVIC(addr, size) {
    const offset = addr - 0xE000E000
    const idx = Math.floor((offset - 0x100) / 4)
    const byteIdx = offset - 0x300
    if (offset >= 0x100 && offset < 0x120) return this.nvic.iser[idx]
    if (offset >= 0x180 && offset < 0x1A0) return this.nvic.ispr[idx]
    if (offset >= 0x200 && offset < 0x220) return this.nvic.iabr[idx]
    if (offset >= 0x300 && offset < 0x3F0) return this.nvic.ipr[byteIdx]
    return 0
  }

  writeNVIC(addr, val, size) {
    const offset = addr - 0xE000E000
    const idx = Math.floor((offset - 0x100) / 4)
    const byteIdx = offset - 0x300
    if (offset >= 0x100 && offset < 0x120) this.nvic.iser[idx] |= val
    if (offset >= 0x180 && offset < 0x1A0) this.nvic.ispr[idx] |= val
    if (offset >= 0x300 && offset < 0x3F0) this.nvic.ipr[byteIdx] = val & 0xFF
  }

  setThumb() {
    this.xpsr |= 0x01000000
  }

  isThumb() {
    return (this.xpsr & 0x01000000) !== 0
  }

  setFlags(n, z, c, v) {
    this.xpsr &= 0x0FFFFFFF
    if (n) this.xpsr |= 0x80000000
    if (z) this.xpsr |= 0x40000000
    if (c) this.xpsr |= 0x20000000
    if (v) this.xpsr |= 0x10000000
  }

  getN() { return (this.xpsr & 0x80000000) !== 0 }
  getZ() { return (this.xpsr & 0x40000000) !== 0 }
  getC() { return (this.xpsr & 0x20000000) !== 0 }
  getV() { return (this.xpsr & 0x10000000) !== 0 }

  addBreakpoint(addr) {
    this.breakpoints.add(addr)
  }

  removeBreakpoint(addr) {
    this.breakpoints.delete(addr)
  }

  hasBreakpoint(addr) {
    return this.breakpoints.has(addr)
  }

  step() {
    if (this.pendingException > 0) {
      this.exceptionLatencyCounter--
      if (this.exceptionLatencyCounter <= 0) {
        this.takeException(this.pendingException)
        this.pendingException = 0
        this.cycles += 12
        this.tickSysTick()
        return { breakpoint: false, pc: this.getPC(), cycles: 12 }
      }
    }
    const pc = this.getPC()
    if (this.hasBreakpoint(pc)) {
      return { breakpoint: true, pc }
    }
    const instr = this.fetchInstruction()
    const instrCycles = this.getInstructionCycles(instr)
    this.executeInstruction(instr)
    this.cycles += instrCycles
    this.tickSysTick()
    if (this.exceptionPending > 0 && this.pendingException === 0) {
      this.pendingException = this.exceptionPending
      this.exceptionPending = 0
      this.exceptionLatencyCounter = this.getInterruptLatency()
    }
    return { breakpoint: false, pc: this.getPC(), cycles: instrCycles }
  }

  getInterruptLatency() {
    const baseLatency = 12
    const randomJitter = Math.floor(Math.random() * 4)
    return baseLatency + randomJitter
  }

  getInstructionCycles(instr) {
    if (instr.type === '16bit') {
      const op = instr.value
      if ((op & 0xF800) === 0x4700) return 3
      if ((op & 0xF800) === 0xD000) return 2
      if ((op & 0xF800) === 0xE000) return 3
      if ((op & 0xF800) === 0xB400 || (op & 0xF800) === 0xBC00) return 4
      if ((op & 0xF000) === 0x6000 || (op & 0xF000) === 0x6800) return 2
      return 1
    } else {
      const op1 = (instr.value >> 16) & 0xFFFF
      if ((op1 & 0xF800) === 0xF000) return 4
      return 2
    }
  }

  fetchInstruction() {
    const pc = this.getPC()
    if ((pc & 1) || this.isThumb()) {
      const instr16 = this.read16(pc & 0xFFFFFFFE)
      if ((instr16 & 0xF800) >= 0xE800) {
        const instr32 = this.read16((pc & 0xFFFFFFFE) + 2)
        this.setPC(pc + 4)
        return { type: '32bit', value: (instr16 << 16) | instr32 }
      }
      this.setPC(pc + 2)
      return { type: '16bit', value: instr16 }
    }
    const instr = this.read32(pc)
    this.setPC(pc + 4)
    return { type: '32bit', value: instr }
  }

  executeInstruction(instr) {
    if (instr.type === '16bit') {
      this.executeThumb16(instr.value)
    } else {
      this.executeThumb32(instr.value)
    }
  }

  executeThumb16(op) {
    const rd = op & 0x7
    const rn = (op >> 3) & 0x7
    const rm = (op >> 6) & 0x7
    if ((op & 0xF800) === 0x1800) {
      this.registers[rd] = this.registers[rn] + this.registers[rm]
      const n = (this.registers[rd] >> 31) & 1
      const z = this.registers[rd] === 0 ? 1 : 0
      this.setFlags(n, z, this.getC(), this.getV())
      return
    }
    if ((op & 0xF800) === 0x1A00) {
      this.registers[rd] = this.registers[rn] - this.registers[rm]
      const n = (this.registers[rd] >> 31) & 1
      const z = this.registers[rd] === 0 ? 1 : 0
      this.setFlags(n, z, this.getC(), this.getV())
      return
    }
    if ((op & 0xE000) === 0x0000 && (op & 0x1800) === 0x0000) {
      const imm = (op >> 6) & 0x1F
      this.registers[rd] = this.registers[rn] << imm
      const n = (this.registers[rd] >> 31) & 1
      const z = this.registers[rd] === 0 ? 1 : 0
      this.setFlags(n, z, this.getC(), this.getV())
      return
    }
    if ((op & 0xE000) === 0x0000 && (op & 0x1800) === 0x0800) {
      const imm = (op >> 6) & 0x1F
      this.registers[rd] = this.registers[rn] >> imm
      const n = (this.registers[rd] >> 31) & 1
      const z = this.registers[rd] === 0 ? 1 : 0
      this.setFlags(n, z, this.getC(), this.getV())
      return
    }
    if ((op & 0xF800) === 0x2000) {
      const imm = op & 0xFF
      this.registers[rd] = imm
      return
    }
    if ((op & 0xF800) === 0x3000) {
      const imm = op & 0xFF
      this.registers[rd] += imm
      return
    }
    if ((op & 0xF000) === 0x4000) {
      const op2 = (op >> 6) & 0xF
      switch (op2) {
        case 0: this.registers[rd] = this.registers[rd] & this.registers[rn]; break
        case 1: this.registers[rd] = this.registers[rd] ^ this.registers[rn]; break
        case 2: this.registers[rd] = this.registers[rd] << this.registers[rn]; break
        case 3: this.registers[rd] = this.registers[rd] >> this.registers[rn]; break
        case 4: this.registers[rd] = this.registers[rd] + this.registers[rn]; break
        case 5: this.registers[rd] = this.registers[rd] - this.registers[rn]; break
        case 6: this.registers[rd] = this.registers[rd] & this.registers[rn]; break
        case 7: this.registers[rd] = this.registers[rd] - this.registers[rn]; break
      }
      const n = (this.registers[rd] >> 31) & 1
      const z = this.registers[rd] === 0 ? 1 : 0
      this.setFlags(n, z, this.getC(), this.getV())
      return
    }
    if ((op & 0xF800) === 0x4800) {
      const imm = (op & 0xFF) << 2
      this.registers[rd] = this.read32(this.getPC() + imm)
      return
    }
    if ((op & 0xF000) === 0x6000) {
      const imm = ((op >> 6) & 0x1F) << 2
      const addr = this.registers[rn] + imm
      this.write32(addr, this.registers[rd])
      return
    }
    if ((op & 0xF000) === 0x6800) {
      const imm = ((op >> 6) & 0x1F) << 2
      const addr = this.registers[rn] + imm
      this.registers[rd] = this.read32(addr)
      return
    }
    if ((op & 0xF000) === 0x7000) {
      const imm = ((op >> 6) & 0x1F)
      const addr = this.registers[rn] + imm
      this.write8(addr, this.registers[rd])
      return
    }
    if ((op & 0xF000) === 0x7800) {
      const imm = ((op >> 6) & 0x1F)
      const addr = this.registers[rn] + imm
      this.registers[rd] = this.read8(addr)
      return
    }
    if ((op & 0xF800) === 0xB100) {
      const cond = (op >> 8) & 0xF
      if (this.checkCondition(cond)) {
        this.setPC(this.getPC() + 4)
      }
      return
    }
    if ((op & 0xF800) === 0xB400 && (op & 0x0800) === 0) {
      const reglist = op & 0xFF
      let sp = this.getSP()
      for (let i = 0; i < 8; i++) {
        if (reglist & (1 << i)) {
          sp -= 4
          this.write32(sp, this.registers[i])
        }
      }
      this.setSP(sp)
      return
    }
    if ((op & 0xF800) === 0xBC00 && (op & 0x0800) === 0) {
      const reglist = op & 0xFF
      let sp = this.getSP()
      for (let i = 0; i < 8; i++) {
        if (reglist & (1 << i)) {
          this.registers[i] = this.read32(sp)
          sp += 4
        }
      }
      this.setSP(sp)
      return
    }
    if ((op & 0xF800) === 0xB000) {
      const imm7 = op & 0x7F
      if (op & 0x0080) {
        this.setSP(this.getSP() - (imm7 << 2))
      } else {
        this.setSP(this.getSP() + (imm7 << 2))
      }
      return
    }
    if ((op & 0xFF00) === 0x4700) {
      const rm = (op >> 3) & 0xF
      this.setPC(this.registers[rm])
      return
    }
    if ((op & 0xF800) === 0xD000) {
      const cond = (op >> 8) & 0xF
      const imm8 = (op & 0xFF) << 1
      if (this.checkCondition(cond)) {
        this.setPC(this.getPC() + imm8 + 2)
      }
      return
    }
    if ((op & 0xF800) === 0xE000) {
      const imm11 = (op & 0x7FF) << 1
      this.setPC(this.getPC() + imm11 + 2)
      return
    }
    if ((op & 0xFF87) === 0x4687) {
      const rd = (op >> 3) & 0xF
      const rm = op & 0x8 ? 15 : (op & 0x7)
      this.registers[rd] = this.registers[rm + (op & 0x8 ? 8 : 0)]
      return
    }
    if ((op & 0xFF00) === 0xDF00) {
      const svc = op & 0xFF
      this.triggerSVC(svc)
      return
    }
  }

  executeThumb32(op) {
    const op1 = (op >> 16) & 0xFFFF
    const op2 = op & 0xFFFF
    if ((op1 & 0xF800) === 0xF000 && (op2 & 0x8000) === 0x8000) {
      const imm11 = op2 & 0x7FF
      const imm10 = op1 & 0x3FF
      const s = (op1 >> 10) & 1
      const j1 = (op2 >> 13) & 1
      const j2 = (op2 >> 11) & 1
      let offset = (imm10 << 11) | imm11
      offset = s ? offset - (1 << 21) : offset
      this.setLR(this.getPC() | 1)
      this.setPC(this.getPC() + offset * 2)
      return
    }
    if ((op1 & 0xFE00) === 0xF200 || (op1 & 0xFE00) === 0xF600) {
      const isWide = (op1 & 0x400) !== 0
      const rd = op2 & 0xF
      let imm = ((op1 & 0x3F) << 4) | ((op2 >> 4) & 0xF)
      if (isWide) imm = (imm << 8) | (op2 & 0xFF)
      if (op1 & 0x0400) this.registers[rd] &= 0xFFFF0000
      this.registers[rd] |= imm
      return
    }
  }

  checkCondition(cond) {
    switch (cond) {
      case 0: return this.getZ()
      case 1: return !this.getZ()
      case 2: return this.getC()
      case 3: return !this.getC()
      case 4: return this.getN()
      case 5: return !this.getN()
      case 6: return this.getV()
      case 7: return !this.getV()
      case 8: return this.getC() && !this.getZ()
      case 9: return !this.getC() || this.getZ()
      case 10: return this.getN() === this.getV()
      case 11: return this.getN() !== this.getV()
      case 12: return !this.getZ() && (this.getN() === this.getV())
      case 13: return this.getZ() || (this.getN() !== this.getV())
      case 14: return true
      default: return false
    }
  }

  tickSysTick() {
    if (this.systick.ctrl & 1) {
      if (this.systick.val === 0) {
        this.systick.val = this.systick.load
        if (this.systick.ctrl & 2) {
          this.setPendSV(15)
        }
      } else {
        this.systick.val--
      }
    }
  }

  setPendSV(prio) {
    this.exceptionPending = 15
  }

  triggerSVC(svc) {
    this.exceptionPending = 11
  }

  takeException(excNum) {
    const sp = this.getSP() - 32
    this.write32(sp, this.registers[0])
    this.write32(sp + 4, this.registers[1])
    this.write32(sp + 8, this.registers[2])
    this.write32(sp + 12, this.registers[3])
    this.write32(sp + 16, this.registers[12])
    this.write32(sp + 20, this.registers[14])
    this.write32(sp + 24, this.getPC())
    this.write32(sp + 28, this.xpsr)
    this.setSP(sp)
    const vector = this.read32(excNum * 4)
    this.setLR(0xFFFFFFF9)
    this.setPC(vector & 0xFFFFFFFE)
    this.exceptionActive[excNum] = 1
  }

  returnFromException() {
    const sp = this.getSP()
    this.registers[0] = this.read32(sp)
    this.registers[1] = this.read32(sp + 4)
    this.registers[2] = this.read32(sp + 8)
    this.registers[3] = this.read32(sp + 12)
    this.registers[12] = this.read32(sp + 16)
    const lr = this.read32(sp + 20)
    const pc = this.read32(sp + 24)
    this.xpsr = this.read32(sp + 28)
    this.setSP(sp + 32)
    this.setPC(pc)
    this.setLR(lr)
  }

  loadELF(elfBuffer) {
    const view = new DataView(elfBuffer)
    const magic = view.getUint32(0, true)
    if (magic !== 0x464C457F) {
      throw new Error('Invalid ELF file')
    }
    const e_type = view.getUint16(16, true)
    const e_machine = view.getUint16(18, true)
    if (e_machine !== 0x28) {
      throw new Error('Not an ARM ELF file')
    }
    const e_phoff = view.getUint32(28, true)
    const e_phentsize = view.getUint16(42, true)
    const e_phnum = view.getUint16(44, true)
    for (let i = 0; i < e_phnum; i++) {
      const offset = e_phoff + i * e_phentsize
      const p_type = view.getUint32(offset, true)
      const p_offset = view.getUint32(offset + 4, true)
      const p_vaddr = view.getUint32(offset + 8, true)
      const p_filesz = view.getUint32(offset + 16, true)
      const p_memsz = view.getUint32(offset + 20, true)
      if (p_type === 1) {
        for (let j = 0; j < p_filesz; j++) {
          this.memory[p_vaddr + j] = view.getUint8(p_offset + j)
        }
      }
    }
    return true
  }

  getState() {
    return {
      registers: [...this.registers],
      xpsr: this.xpsr,
      sp_main: this.sp_main,
      sp_process: this.sp_process,
      control: this.control,
      cycles: this.cycles,
      pc: this.getPC()
    }
  }

  restoreState(state) {
    this.registers.set(state.registers)
    this.xpsr = state.xpsr
    this.sp_main = state.sp_main
    this.sp_process = state.sp_process
    this.control = state.control
    this.cycles = state.cycles
  }
}
