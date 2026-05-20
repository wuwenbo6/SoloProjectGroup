class FSTWriter {
  constructor() {
    this.signals = new Map();
    this.signalIdCounter = 0;
    this.time = 0;
    this.changes = [];
    this.signalNames = [];
  }

  addSignal(name, width = 1) {
    if (this.signals.has(name)) {
      return this.signals.get(name).id;
    }
    const id = this.signalIdCounter++;
    this.signals.set(name, { id, width, value: 0 });
    this.signalNames.push({ name, id, width });
    return id;
  }

  setSignalValue(name, value) {
    const signal = this.signals.get(name);
    if (signal && signal.value !== value) {
      signal.value = value;
      this.changes.push({ time: this.time, id: signal.id, value, width: signal.width });
    }
  }

  advanceTime(delta = 1) {
    this.time += delta;
  }

  setTime(time) {
    this.time = time;
  }

  generateFST() {
    const buffer = [];
    
    buffer.push(this.encodeString('FST2'));
    buffer.push(this.encodeU32(2));
    buffer.push(this.encodeU32(this.signalNames.length));
    
    this.signalNames.forEach(sig => {
      buffer.push(this.encodeU32(sig.id));
      buffer.push(this.encodeU32(sig.width));
      buffer.push(this.encodeString(sig.name));
    });
    
    let lastTime = 0;
    this.changes.forEach(change => {
      if (change.time !== lastTime) {
        buffer.push(0xff);
        buffer.push(this.encodeU64(change.time));
        lastTime = change.time;
      }
      buffer.push(this.encodeU32(change.id));
      buffer.push(this.encodeU64(change.value));
    });
    
    return Buffer.concat(buffer);
  }

  generateJSON() {
    const signals = {};
    this.signalNames.forEach(sig => {
      signals[sig.name] = { id: sig.id, width: sig.width };
    });
    
    return {
      signals,
      changes: this.changes,
      maxTime: this.time
    };
  }

  encodeString(str) {
    const buf = Buffer.alloc(str.length + 1);
    buf.write(str);
    buf.writeUInt8(0, str.length);
    return buf;
  }

  encodeU32(val) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(val);
    return buf;
  }

  encodeU64(val) {
    const buf = Buffer.alloc(8);
    buf.writeUInt32LE(val & 0xffffffff, 0);
    buf.writeUInt32LE(Math.floor(val / 0x100000000), 4);
    return buf;
  }

  reset() {
    this.time = 0;
    this.changes = [];
    this.signals.forEach(sig => sig.value = 0);
  }
}

class WaveformTracer {
  constructor(simulator) {
    this.simulator = simulator;
    this.fst = new FSTWriter();
    this.enabled = false;
    this.initSignals();
  }

  initSignals() {
    this.fst.addSignal('pc', 32);
    this.fst.addSignal('instruction', 32);
    
    for (let i = 0; i < 32; i++) {
      this.fst.addSignal(`x${i}`, 32);
    }
    
    this.fst.addSignal('uart_tx', 1);
    this.fst.addSignal('uart_rx', 1);
    this.fst.addSignal('uart_txe', 1);
    this.fst.addSignal('uart_rxf', 1);
    
    this.fst.addSignal('timer_value', 32);
    this.fst.addSignal('timer_irq', 1);
    
    this.fst.addSignal('irq_pending', 1);
    this.fst.addSignal('mstatus_mie', 1);
    this.fst.addSignal('mip_mtip', 1);
  }

  enable() {
    this.enabled = true;
    this.fst.reset();
  }

  disable() {
    this.enabled = false;
  }

  trace() {
    if (!this.enabled) return;

    this.fst.setSignalValue('pc', this.simulator.pc);
    
    try {
      const inst = this.simulator.readUint32(this.simulator.pc);
      this.fst.setSignalValue('instruction', inst);
    } catch (e) {}

    for (let i = 0; i < 32; i++) {
      this.fst.setSignalValue(`x${i}`, this.simulator.registers[i]);
    }

    if (this.simulator.uart) {
      this.fst.setSignalValue('uart_tx', this.simulator.uart.tx ? 1 : 0);
      this.fst.setSignalValue('uart_rx', this.simulator.uart.rx ? 1 : 0);
      this.fst.setSignalValue('uart_txe', this.simulator.uart.txEmpty ? 1 : 0);
      this.fst.setSignalValue('uart_rxf', this.simulator.uart.rxFull ? 1 : 0);
    }

    if (this.simulator.timer) {
      this.fst.setSignalValue('timer_value', this.simulator.timer.value);
      this.fst.setSignalValue('timer_irq', this.simulator.timer.irq ? 1 : 0);
    }

    this.fst.setSignalValue('irq_pending', this.simulator.irqPending ? 1 : 0);
    this.fst.setSignalValue('mstatus_mie', (this.simulator.mstatus & 0x8) ? 1 : 0);
    this.fst.setSignalValue('mip_mtip', (this.simulator.mip & 0x80) ? 1 : 0);

    this.fst.advanceTime(10);
  }

  getWaveformJSON() {
    return this.fst.generateJSON();
  }

  getFSTFile() {
    return this.fst.generateFST();
  }

  reset() {
    this.fst.reset();
  }
}

module.exports = { FSTWriter, WaveformTracer };
