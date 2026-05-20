class UART {
  constructor() {
    this.rxBuffer = [];
    this.txBuffer = [];
    this.rx = 1;
    this.tx = 1;
    this.txEmpty = true;
    this.rxFull = false;
    this.divisor = 16;
    this.cycleCount = 0;
    this.lcr = 0;
    this.lsr = 0x60;
    this.txShift = 0;
    this.txBitCount = 0;
    this.rxShift = 0;
    this.rxBitCount = 0;
  }

  readByte(addr) {
    switch (addr & 0x7) {
      case 0:
        if (this.rxBuffer.length > 0) {
          const data = this.rxBuffer.shift();
          this.updateLSR();
          return data;
        }
        return 0;
      case 1:
        return 0;
      case 2:
        return 0;
      case 5:
        return this.lsr;
      default:
        return 0;
    }
  }

  writeByte(addr, value) {
    switch (addr & 0x7) {
      case 0:
        this.txBuffer.push(value);
        this.txEmpty = false;
        this.updateLSR();
        break;
      case 1:
        break;
      case 3:
        this.lcr = value;
        break;
    }
  }

  updateLSR() {
    this.lsr = 0x40;
    if (this.txBuffer.length === 0 && this.txBitCount === 0) {
      this.lsr |= 0x20;
    }
    if (this.rxBuffer.length > 0) {
      this.lsr |= 0x01;
    }
  }

  tick(cycles = 1) {
    this.cycleCount += cycles;
    
    while (this.cycleCount >= this.divisor) {
      this.cycleCount -= this.divisor;
      
      if (this.txBitCount > 0) {
        this.txBitCount--;
        if (this.txBitCount === 0) {
          this.updateLSR();
        }
      } else if (this.txBuffer.length > 0) {
        const byte = this.txBuffer.shift();
        this.txShift = byte;
        this.txBitCount = 10;
        if (this.onTx) {
          this.onTx(byte);
        }
      }
      
      if (this.rxBitCount > 0) {
        this.rxBitCount--;
        if (this.rxBitCount === 0) {
          if (this.rxBuffer.length < 16) {
            this.rxBuffer.push(this.rxShift & 0xff);
            this.updateLSR();
          }
        }
      }
    }
    
    this.txEmpty = (this.txBitCount === 0 && this.txBuffer.length === 0);
    this.rxFull = this.rxBuffer.length > 0;
  }

  rxByte(byte) {
    if (this.rxBuffer.length < 16) {
      this.rxBuffer.push(byte);
      this.updateLSR();
    }
  }
}

class Timer {
  constructor() {
    this.value = 0;
    this.compare = 0xffffffff;
    this.irq = false;
    this.enabled = true;
  }

  tick(cycles = 1) {
    if (!this.enabled) return;
    
    const oldValue = this.value;
    this.value += cycles;
    
    if (oldValue < this.compare && this.value >= this.compare) {
      this.irq = true;
    }
    
    if (this.value >= this.compare) {
      this.irq = true;
    }
  }

  read(addr) {
    switch (addr) {
      case 0:
        return this.value & 0xffffffff;
      case 4:
        return this.compare & 0xffffffff;
      case 8:
        return this.irq ? 1 : 0;
      default:
        return 0;
    }
  }

  write(addr, value) {
    switch (addr) {
      case 0:
        this.value = value;
        this.irq = false;
        break;
      case 4:
        this.compare = value;
        this.irq = false;
        break;
    }
  }

  clearIrq() {
    this.irq = false;
  }
}

class CLINT {
  constructor() {
    this.msip = 0;
    this.mtime = 0;
    this.mtimecmp = 0xffffffff;
  }

  tick(cycles = 1) {
    this.mtime += cycles;
    if (this.mtime >= this.mtimecmp) {
      this.msip = 1;
    }
  }

  read(addr) {
    switch (addr) {
      case 0:
        return this.msip;
      case 8:
        return this.mtime & 0xffffffff;
      case 12:
        return Math.floor(this.mtime / 0x100000000);
      case 16:
        return this.mtimecmp & 0xffffffff;
      case 20:
        return Math.floor(this.mtimecmp / 0x100000000);
      default:
        return 0;
    }
  }

  write(addr, value) {
    switch (addr) {
      case 0:
        this.msip = value & 1;
        break;
      case 16:
        this.mtimecmp = (this.mtimecmp & 0xffffffff00000000) | value;
        break;
      case 20:
        this.mtimecmp = (BigInt(value) << 32n) | BigInt(this.mtimecmp & 0xffffffff);
        this.msip = 0;
        break;
    }
  }

  hasIrq() {
    return this.msip !== 0;
  }
}

class PLIC {
  constructor() {
    this.pending = 0;
    this.enabled = 0;
    this.threshold = 0;
    this.claims = 0;
  }

  setIrq(source, active) {
    if (active) {
      this.pending |= (1 << source);
    } else {
      this.pending &= ~(1 << source);
    }
  }

  read(addr) {
    switch (addr & 0xfff) {
      case 0:
        return this.pending;
      case 4:
        return this.enabled;
      case 0x200000:
        return this.threshold;
      case 0x200004:
        return this.claim();
      default:
        return 0;
    }
  }

  write(addr, value) {
    switch (addr & 0xfff) {
      case 4:
        this.enabled = value;
        break;
      case 0x200000:
        this.threshold = value;
        break;
      case 0x200004:
        this.complete(value);
        break;
    }
  }

  claim() {
    const active = this.pending & this.enabled;
    if (active === 0) return 0;
    
    let highest = 31 - Math.clz32(active);
    if (highest > this.threshold) {
      this.pending &= ~(1 << highest);
      this.claims |= (1 << highest);
      return highest;
    }
    return 0;
  }

  complete(id) {
    this.claims &= ~(1 << id);
  }

  hasIrq() {
    return (this.pending & this.enabled) !== 0;
  }
}

module.exports = { UART, Timer, CLINT, PLIC };
