import * as easymidi from 'easymidi'
import { MidiDevice, MidiMessage } from '../src/types/electron'
import { EventEmitter } from 'events'

class MidiManager extends EventEmitter {
  private input: easymidi.Input | null = null
  private output: easymidi.Output | null = null
  private currentInputId: string | null = null
  private currentOutputId: string | null = null
  private reconnectInterval: NodeJS.Timeout | null = null
  private messageHandlers: Set<(msg: MidiMessage) => void> = new Set()

  constructor() {
    super()
    this.startReconnectMonitor()
  }

  private startReconnectMonitor() {
    this.reconnectInterval = setInterval(() => {
      if (this.currentInputId && !this.input) {
        this.tryReconnectInput()
      }
      if (this.currentOutputId && !this.output) {
        this.tryReconnectOutput()
      }
    }, 2000)
  }

  private tryReconnectInput() {
    if (!this.currentInputId) return
    
    const inputs = this.getInputs()
    const device = inputs.find(d => d.id === this.currentInputId)
    if (device) {
      console.log('Attempting to reconnect MIDI input:', device.name)
      this.connectInput(this.currentInputId)
    }
  }

  private tryReconnectOutput() {
    if (!this.currentOutputId) return
    
    const outputs = this.getOutputs()
    const device = outputs.find(d => d.id === this.currentOutputId)
    if (device) {
      console.log('Attempting to reconnect MIDI output:', device.name)
      this.connectOutput(this.currentOutputId)
    }
  }

  getInputs(): MidiDevice[] {
    try {
      return easymidi.getInputs().map((name, index) => ({
        id: `input-${index}`,
        name,
        type: 'input' as const
      }))
    } catch (error) {
      console.error('Failed to get MIDI inputs:', error)
      return []
    }
  }

  getOutputs(): MidiDevice[] {
    try {
      return easymidi.getOutputs().map((name, index) => ({
        id: `output-${index}`,
        name,
        type: 'output' as const
      }))
    } catch (error) {
      console.error('Failed to get MIDI outputs:', error)
      return []
    }
  }

  private setupMessageHandlers(input: easymidi.Input) {
    const handler = (type: string) => (msg: any) => {
      const message = { ...msg, type }
      this.emit('message', message)
      this.messageHandlers.forEach(cb => {
        try { cb(message) } catch (e) {}
      })
    }

    input.on('noteon', handler('noteon'))
    input.on('noteoff', handler('noteoff'))
    input.on('cc', handler('cc'))
    input.on('pitch', handler('pitch'))
    input.on('program', handler('program'))
    input.on('sysex', handler('sysex'))
  }

  connectInput(deviceId: string): boolean {
    this.disconnectInput()
    
    const inputs = this.getInputs()
    const device = inputs.find(d => d.id === deviceId)
    
    if (!device) return false

    try {
      this.input = new easymidi.Input(device.name)
      this.currentInputId = deviceId
      
      this.setupMessageHandlers(this.input)
      
      this.input.on('error', (error) => {
        console.error('MIDI input error:', error)
        this.emit('device-error', { deviceId, type: 'input', error })
      })

      this.emit('device-connected', { deviceId, type: 'input', name: device.name })
      return true
    } catch (error) {
      console.error('Failed to connect MIDI input:', error)
      this.emit('device-error', { deviceId, type: 'input', error })
      return false
    }
  }

  connectOutput(deviceId: string): boolean {
    this.disconnectOutput()
    
    const outputs = this.getOutputs()
    const device = outputs.find(d => d.id === deviceId)
    
    if (!device) return false

    try {
      this.output = new easymidi.Output(device.name)
      this.currentOutputId = deviceId
      
      this.emit('device-connected', { deviceId, type: 'output', name: device.name })
      return true
    } catch (error) {
      console.error('Failed to connect MIDI output:', error)
      this.emit('device-error', { deviceId, type: 'output', error })
      return false
    }
  }

  disconnectInput() {
    if (this.input) {
      try {
        this.input.removeAllListeners()
        this.input.close()
      } catch (error) {
        console.error('Error disconnecting MIDI input:', error)
      }
      this.input = null
    }
    this.currentInputId = null
  }

  disconnectOutput() {
    if (this.output) {
      try {
        this.output.close()
      } catch (error) {
        console.error('Error disconnecting MIDI output:', error)
      }
      this.output = null
    }
    this.currentOutputId = null
  }

  sendMessage(message: MidiMessage) {
    if (!this.output) return

    try {
      switch (message.type) {
        case 'noteon':
          this.output.send('noteon', {
            note: message.note!,
            velocity: message.velocity!,
            channel: message.channel
          })
          break
        case 'noteoff':
          this.output.send('noteoff', {
            note: message.note!,
            velocity: message.velocity!,
            channel: message.channel
          })
          break
        case 'cc':
          this.output.send('cc', {
            controller: message.controller!,
            value: message.value!,
            channel: message.channel
          })
          break
        case 'pitch':
          this.output.send('pitch', {
            value: message.value!,
            channel: message.channel
          })
          break
      }
    } catch (error) {
      console.error('Failed to send MIDI message:', error)
    }
  }

  destroy() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval)
    }
    this.disconnectInput()
    this.disconnectOutput()
    this.removeAllListeners()
  }
}

export const midiManager = new MidiManager()

export function initMidiModule() {
  console.log('MIDI module initialized with auto-reconnect')
}
