const assembler = require('./assembler');
const { UART, Timer, CLINT, PLIC } = require('./peripherals');
const { WaveformTracer } = require('./waveform');

const REGISTER_NAMES = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6'
];

class RISCVSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.registers = new Uint32Array(32);
    this.pc = 0x10000;
    this.memory = new Uint8Array(1024 * 1024);
    this.breakpoints = new Set();
    this.watchpoints = new Map();
    this.running = false;
    this.runInterval = null;
    
    this.csr = {
      mstatus: 0,
      mie: 0,
      mtvec: 0,
      mscratch: 0,
      mepc: 0,
      mcause: 0,
      mtval: 0,
      mip: 0
    };
    
    this.irqPending = false;
    this.inHandler = false;
    
    this.uart = new UART();
    this.timer = new Timer();
    this.clint = new CLINT();
    this.plic = new PLIC();
    
    this.tracer = new WaveformTracer(this);
    this.cycleCount = 0;
  }

  loadELF(elf) {
    elf.segments.forEach(segment => {
      const start = segment.vaddr - 0x10000;
      for (let i = 0; i < segment.filesz; i++) {
        this.memory[start + i] = segment.data[i];
      }
    });
    this.pc = elf.entry;
  }

  loadProgram(code, address = 0x10000) {
    const offset = address - 0x10000;
    for (let i = 0; i < code.length; i++) {
      this.memory[offset + i] = code[i];
    }
    this.pc = address;
  }

  getRegisters() {
    const regs = {};
    for (let i = 0; i < 32; i++) {
      regs[REGISTER_NAMES[i]] = this.registers[i];
    }
    return regs;
  }

  getPC() {
    return this.pc;
  }

  getMemory(address, length = 4) {
    const data = [];
    for (let i = 0; i < length; i++) {
      const offset = (address + i) - 0x10000;
      if (offset >= 0 && offset < this.memory.length) {
        data.push(this.memory[offset] || 0);
      } else {
        data.push(0);
      }
    }
    return data;
  }

  setBreakpoint(address) {
    this.breakpoints.add(address);
  }

  removeBreakpoint(address) {
    this.breakpoints.delete(address);
  }

  getBreakpoints() {
    return Array.from(this.breakpoints);
  }

  setWatchpoint(address, type = 'read-write') {
    this.watchpoints.set(address, type);
  }

  removeWatchpoint(address) {
    this.watchpoints.delete(address);
  }

  getWatchpoints() {
    return Array.from(this.watchpoints.entries()).map(([addr, type]) => ({ address: addr, type }));
  }

  checkAlignment(address, bytes) {
    if ((address & (bytes - 1)) !== 0) {
      throw new Error(`Load/store misaligned address: 0x${address.toString(16)}, need ${bytes} bytes alignment`);
    }
  }

  isMMIO(address) {
    return address >= 0x40000000;
  }

  readMMIO(address) {
    if (address >= 0x40000000 && address < 0x40001000) {
      return this.uart.readByte(address - 0x40000000);
    }
    if (address >= 0x40001000 && address < 0x40002000) {
      return this.timer.read(address - 0x40001000);
    }
    if (address >= 0x40010000 && address < 0x40020000) {
      return this.clint.read(address - 0x40010000);
    }
    if (address >= 0x40020000 && address < 0x40100000) {
      return this.plic.read(address - 0x40020000);
    }
    return 0;
  }

  writeMMIO(address, value) {
    if (address >= 0x40000000 && address < 0x40001000) {
      this.uart.writeByte(address - 0x40000000, value);
    } else if (address >= 0x40001000 && address < 0x40002000) {
      this.timer.write(address - 0x40001000, value);
    } else if (address >= 0x40010000 && address < 0x40020000) {
      this.clint.write(address - 0x40010000, value);
    } else if (address >= 0x40020000 && address < 0x40100000) {
      this.plic.write(address - 0x40020000, value);
    }
  }

  getOffset(address) {
    const offset = address - 0x10000;
    if (offset < 0 || offset >= this.memory.length) {
      throw new Error(`Memory access out of bounds: 0x${address.toString(16)}`);
    }
    return offset;
  }

  readUint8(address) {
    if (this.isMMIO(address)) {
      return this.readMMIO(address) & 0xff;
    }
    const offset = this.getOffset(address);
    return this.memory[offset] || 0;
  }

  readUint16(address) {
    this.checkAlignment(address, 2);
    if (this.isMMIO(address)) {
      return this.readMMIO(address) & 0xffff;
    }
    const offset = this.getOffset(address);
    return (this.memory[offset] | (this.memory[offset + 1] << 8)) >>> 0;
  }

  readUint32(address) {
    this.checkAlignment(address, 4);
    if (this.isMMIO(address)) {
      return this.readMMIO(address) >>> 0;
    }
    const offset = this.getOffset(address);
    return (this.memory[offset] |
            (this.memory[offset + 1] << 8) |
            (this.memory[offset + 2] << 16) |
            (this.memory[offset + 3] << 24)) >>> 0;
  }

  writeUint8(address, value) {
    if (this.isMMIO(address)) {
      this.writeMMIO(address, value);
      return;
    }
    const offset = this.getOffset(address);
    this.memory[offset] = value & 0xff;
  }

  writeUint16(address, value) {
    this.checkAlignment(address, 2);
    if (this.isMMIO(address)) {
      this.writeMMIO(address, value);
      return;
    }
    const offset = this.getOffset(address);
    this.memory[offset] = value & 0xff;
    this.memory[offset + 1] = (value >> 8) & 0xff;
  }

  writeUint32(address, value) {
    this.checkAlignment(address, 4);
    if (this.isMMIO(address)) {
      this.writeMMIO(address, value);
      return;
    }
    const offset = this.getOffset(address);
    this.memory[offset] = value & 0xff;
    this.memory[offset + 1] = (value >> 8) & 0xff;
    this.memory[offset + 2] = (value >> 16) & 0xff;
    this.memory[offset + 3] = (value >> 24) & 0xff;
  }

  readCSR(csr) {
    switch (csr) {
      case 0x300: return this.csr.mstatus;
      case 0x304: return this.csr.mie;
      case 0x305: return this.csr.mtvec;
      case 0x340: return this.csr.mscratch;
      case 0x341: return this.csr.mepc;
      case 0x342: return this.csr.mcause;
      case 0x343: return this.csr.mtval;
      case 0x344: return this.csr.mip;
      default: return 0;
    }
  }

  writeCSR(csr, value) {
    switch (csr) {
      case 0x300: this.csr.mstatus = value & 0xffffffff; break;
      case 0x304: this.csr.mie = value & 0xffffffff; break;
      case 0x305: this.csr.mtvec = value & 0xfffffffc; break;
      case 0x340: this.csr.mscratch = value; break;
      case 0x341: this.csr.mepc = value; break;
      case 0x342: this.csr.mcause = value; break;
      case 0x343: this.csr.mtval = value; break;
    }
  }

  checkInterrupt() {
    const mieMtie = (this.csr.mie >> 7) & 1;
    const mstatusMie = (this.csr.mstatus >> 3) & 1;
    
    if (this.clint.hasIrq() && mieMtie && mstatusMie && !this.inHandler) {
      return true;
    }
    
    if (this.plic.hasIrq() && mstatusMie && !this.inHandler) {
      return true;
    }
    
    return false;
  }

  takeInterrupt() {
    this.csr.mepc = this.pc;
    this.csr.mcause = 0x80000007;
    this.csr.mstatus = (this.csr.mstatus & ~0x8) | ((this.csr.mstatus & 0x8) << 4);
    
    const vec = this.csr.mtvec & ~0x3;
    const mode = this.csr.mtvec & 0x3;
    
    if (mode === 1) {
      this.pc = vec + (this.csr.mcause & 0xfffffff) * 4;
    } else {
      this.pc = vec;
    }
    
    this.inHandler = true;
    this.irqPending = true;
  }

  mret() {
    this.csr.mstatus = (this.csr.mstatus & ~0x88) | ((this.csr.mstatus >> 4) & 0x8);
    this.pc = this.csr.mepc;
    this.inHandler = false;
    this.irqPending = false;
    this.clint.msip = 0;
  }

  tickPeripherals() {
    this.uart.tick(1);
    this.timer.tick(1);
    this.clint.tick(1);
    this.cycleCount++;
    
    this.plic.setIrq(0, this.uart.rxFull);
    this.plic.setIrq(1, this.timer.irq);
    
    if ((this.csr.mip >> 7) & 1) {
      this.clint.msip = 1;
    }
    
    this.tracer.trace();
  }

  step() {
    this.tickPeripherals();
    
    if (this.checkInterrupt()) {
      this.takeInterrupt();
      return { mnemonic: 'irq', pc: 0, nextPC: this.pc };
    }
    
    this.registers[0] = 0;

    this.checkAlignment(this.pc, 4);
    const instruction = this.readUint32(this.pc);
    
    const opcode = instruction & 0x7f;
    const rd = (instruction >> 7) & 0x1f;
    const rs1 = (instruction >> 15) & 0x1f;
    const rs2 = (instruction >> 20) & 0x1f;
    const funct3 = (instruction >> 12) & 0x7;
    const funct7 = (instruction >> 25) & 0x7f;
    const csr = (instruction >> 20) & 0xfff;
    const zimm = rs1;
    const immI = ((instruction >> 20) << 20) >> 20;
    const immS = (((instruction >> 7) & 0x1f) | ((instruction >> 25) << 5)) << 20 >> 20;
    const immB = (((instruction >> 8) & 0xf) << 1 | ((instruction >> 25) << 5) | ((instruction >> 7) & 0x1) << 11 | ((instruction >> 31) << 12)) << 19 >> 19;
    const immU = instruction & 0xfffff000;
    const immJ = (((instruction >> 21) & 0x3ff) << 1 | ((instruction >> 20) & 0x1) << 11 | ((instruction >> 12) & 0xff) << 12 | ((instruction >> 31) << 20)) << 11 >> 11;

    const rs1Val = this.registers[rs1];
    const rs2Val = this.registers[rs2];
    const oldPC = this.pc;
    let nextPC = this.pc + 4;
    let mnemonic = 'unknown';
    let rdResult = null;

    switch (opcode) {
      case 0x37:
        mnemonic = 'lui';
        rdResult = immU;
        break;
      case 0x17:
        mnemonic = 'auipc';
        rdResult = this.pc + immU;
        break;
      case 0x6f:
        mnemonic = 'jal';
        rdResult = this.pc + 4;
        nextPC = this.pc + immJ;
        break;
      case 0x67:
        mnemonic = 'jalr';
        const target = rs1Val + immI;
        rdResult = this.pc + 4;
        nextPC = target & ~1;
        break;
      case 0x63:
        switch (funct3) {
          case 0x0: mnemonic = 'beq'; if (rs1Val === rs2Val) nextPC = this.pc + immB; break;
          case 0x1: mnemonic = 'bne'; if (rs1Val !== rs2Val) nextPC = this.pc + immB; break;
          case 0x4: mnemonic = 'blt'; if (rs1Val < rs2Val) nextPC = this.pc + immB; break;
          case 0x5: mnemonic = 'bge'; if (rs1Val >= rs2Val) nextPC = this.pc + immB; break;
          case 0x6: mnemonic = 'bltu'; if ((rs1Val >>> 0) < (rs2Val >>> 0)) nextPC = this.pc + immB; break;
          case 0x7: mnemonic = 'bgeu'; if ((rs1Val >>> 0) >= (rs2Val >>> 0)) nextPC = this.pc + immB; break;
        }
        break;
      case 0x03: {
        const loadAddr = rs1Val + immI;
        switch (funct3) {
          case 0x0: mnemonic = 'lb'; rdResult = (this.readUint8(loadAddr) << 24) >> 24; break;
          case 0x1: mnemonic = 'lh'; rdResult = (this.readUint16(loadAddr) << 16) >> 16; break;
          case 0x2: mnemonic = 'lw'; rdResult = this.readUint32(loadAddr); break;
          case 0x4: mnemonic = 'lbu'; rdResult = this.readUint8(loadAddr) >>> 0; break;
          case 0x5: mnemonic = 'lhu'; rdResult = this.readUint16(loadAddr) >>> 0; break;
        }
        break;
      }
      case 0x23: {
        const storeAddr = rs1Val + immS;
        switch (funct3) {
          case 0x0: mnemonic = 'sb'; this.writeUint8(storeAddr, rs2Val & 0xff); break;
          case 0x1: mnemonic = 'sh'; this.writeUint16(storeAddr, rs2Val & 0xffff); break;
          case 0x2: mnemonic = 'sw'; this.writeUint32(storeAddr, rs2Val); break;
        }
        break;
      }
      case 0x13:
        switch (funct3) {
          case 0x0: mnemonic = 'addi'; rdResult = rs1Val + immI; break;
          case 0x2: mnemonic = 'slti'; rdResult = rs1Val < immI ? 1 : 0; break;
          case 0x3: mnemonic = 'sltiu'; rdResult = (rs1Val >>> 0) < (immI >>> 0) ? 1 : 0; break;
          case 0x4: mnemonic = 'xori'; rdResult = rs1Val ^ immI; break;
          case 0x6: mnemonic = 'ori'; rdResult = rs1Val | immI; break;
          case 0x7: mnemonic = 'andi'; rdResult = rs1Val & immI; break;
          case 0x1: mnemonic = 'slli'; rdResult = rs1Val << (immI & 0x1f); break;
          case 0x5:
            if ((immI >> 10) === 0) { mnemonic = 'srli'; rdResult = rs1Val >>> (immI & 0x1f); }
            else { mnemonic = 'srai'; rdResult = rs1Val >> (immI & 0x1f); }
            break;
        }
        break;
      case 0x33:
        switch (funct7) {
          case 0x00:
            switch (funct3) {
              case 0x0: mnemonic = 'add'; rdResult = rs1Val + rs2Val; break;
              case 0x1: mnemonic = 'sll'; rdResult = rs1Val << (rs2Val & 0x1f); break;
              case 0x2: mnemonic = 'slt'; rdResult = rs1Val < rs2Val ? 1 : 0; break;
              case 0x3: mnemonic = 'sltu'; rdResult = (rs1Val >>> 0) < (rs2Val >>> 0) ? 1 : 0; break;
              case 0x4: mnemonic = 'xor'; rdResult = rs1Val ^ rs2Val; break;
              case 0x5: mnemonic = 'srl'; rdResult = rs1Val >>> (rs2Val & 0x1f); break;
              case 0x6: mnemonic = 'or'; rdResult = rs1Val | rs2Val; break;
              case 0x7: mnemonic = 'and'; rdResult = rs1Val & rs2Val; break;
            }
            break;
          case 0x20:
            switch (funct3) {
              case 0x0: mnemonic = 'sub'; rdResult = rs1Val - rs2Val; break;
              case 0x5: mnemonic = 'sra'; rdResult = rs1Val >> (rs2Val & 0x1f); break;
            }
            break;
        }
        break;
      case 0x0f:
        mnemonic = 'fence';
        break;
      case 0x73:
        if (funct3 === 0) {
          if (instruction === 0x00000073) {
            mnemonic = 'ecall';
          } else if (instruction === 0x00100073) {
            mnemonic = 'ebreak';
          } else if (instruction === 0x30200073) {
            mnemonic = 'mret';
            this.mret();
            return { instruction, mnemonic, pc: oldPC, nextPC: this.pc };
          } else if (instruction === 0x10500073) {
            mnemonic = 'wfi';
          }
        } else {
          const csrVal = this.readCSR(csr);
          switch (funct3) {
            case 0x1:
              mnemonic = 'csrrw';
              rdResult = csrVal;
              this.writeCSR(csr, rs1Val);
              break;
            case 0x2:
              mnemonic = 'csrrs';
              rdResult = csrVal;
              this.writeCSR(csr, csrVal | rs1Val);
              break;
            case 0x3:
              mnemonic = 'csrrc';
              rdResult = csrVal;
              this.writeCSR(csr, csrVal & ~rs1Val);
              break;
            case 0x5:
              mnemonic = 'csrrwi';
              rdResult = csrVal;
              this.writeCSR(csr, zimm);
              break;
            case 0x6:
              mnemonic = 'csrrsi';
              rdResult = csrVal;
              this.writeCSR(csr, csrVal | zimm);
              break;
            case 0x7:
              mnemonic = 'csrrci';
              rdResult = csrVal;
              this.writeCSR(csr, csrVal & ~zimm);
              break;
          }
        }
        break;
    }

    this.pc = nextPC;
    if (rdResult !== null && rd !== 0) {
      this.registers[rd] = rdResult;
    }
    this.registers[0] = 0;

    return {
      instruction,
      mnemonic,
      pc: oldPC,
      nextPC
    };
  }

  run(callback) {
    this.running = true;
    this.runInterval = setInterval(() => {
      if (!this.running) {
        clearInterval(this.runInterval);
        return;
      }

      if (this.breakpoints.has(this.pc)) {
        this.running = false;
        clearInterval(this.runInterval);
        callback({ type: 'breakpoint', pc: this.pc });
        return;
      }

      const result = this.step();
      callback({
        type: 'step',
        ...result,
        registers: this.getRegisters(),
        pc: this.pc
      });
    }, 100);
  }

  pause() {
    this.running = false;
    if (this.runInterval) {
      clearInterval(this.runInterval);
      this.runInterval = null;
    }
  }

  assemble(code) {
    return assembler.assemble(code);
  }
}

module.exports = RISCVSimulator;
