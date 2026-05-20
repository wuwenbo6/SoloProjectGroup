import { MidiMessage } from '../src/types/electron'
import vm from 'vm'
import { EventEmitter } from 'events'

interface Breakpoint {
  line: number
  enabled: boolean
  condition?: string
}

interface ScriptContext {
  sendMidi: (message: MidiMessage) => void
  log: (...args: any[]) => void
  state: Record<string, any>
  console: Console
  [key: string]: any
}

class ScriptEngine extends EventEmitter {
  private running = false
  private context: vm.Context | null = null
  private compiledScript: vm.Script | null = null
  private globalState: Record<string, any> = {}
  private messageCount = 0
  private cleanupTimer: NodeJS.Timeout | null = null
  private maxStateSize = 1024 * 1024
  
  private breakpoints: Map<number, Breakpoint> = new Map()
  private isPaused = false
  private pauseReason: string | null = null
  private callStack: any[] = []
  private currentMessage: MidiMessage | null = null
  private stepResume: (resume: boolean) => void = () => {}

  constructor(private sendMidiCallback: (message: MidiMessage) => void) {
    super()
    this.startMemoryCleanup()
  }

  private startMemoryCleanup() {
    this.cleanupTimer = setInterval(() => {
      if (this.running && global.gc) {
        try {
          global.gc()
        } catch (e) {}
      }
      this.limitStateSize()
    }, 30000)
  }

  private limitStateSize() {
    try {
      const size = Buffer.byteLength(JSON.stringify(this.globalState))
      if (size > this.maxStateSize) {
        console.warn('Script state size limit exceeded, clearing...')
        const keys = Object.keys(this.globalState)
        for (let i = 0; i < Math.ceil(keys.length / 2); i++) {
          delete this.globalState[keys[i]]
        }
      }
    } catch (e) {}
  }

  private checkBreakpoint(line: number) {
    const bp = this.breakpoints.get(line)
    if (bp && bp.enabled) {
      if (bp.condition) {
        try {
          const result = vm.runInNewContext(bp.condition, this.context!)
          if (!result) return
        } catch (e) {
          return
        }
      }
      this.isPaused = true
      this.pauseReason = `breakpoint at line ${line}`
      this.emit('paused', {
        reason: this.pauseReason, line, variables: this.getVariables() })
      return new Promise<void>((resolve) => {
        this.stepResume = resolve
      })
    }
  }

  compileScript(code: string): boolean {
    try {
      const breakpointInjectedCode = this.injectDebugCode(code)
      this.compiledScript = new vm.Script(breakpointInjectedCode, {
        filename: 'midi-script.js',
        timeout: 5000,
        lineOffset: 0,
        columnOffset: 0
      })
      return true
    } catch (error) {
      console.error('Script compilation error:', error)
      this.emit('error', error)
      return false
    }
  }

  private injectDebugCode(code: string): string {
    const lines = code.split('\n')
    const injected = lines.map((line, i) => {
      const lineNum = i + 1
      if (this.breakpoints.has(lineNum)) {
        return `__debug.checkBreakpoint(${lineNum}); ${line}`
      }
      return line
    }).join('\n')

    return `
      (function() {
        var __debug = {
        checkBreakpoint: function(line) {
          if (__debug.isPaused) return;
          var bp = __debug.breakpoints.get(line);
          if (bp && bp.enabled) {
            __debug.isPaused = true;
            __debug.pauseReason = 'breakpoint at line ' + line;
          }
        },
        breakpoints: new Map(),
        isPaused: false,
        pauseReason: null
      };
      
      __debug.breakpoints = (function() {
        var map = new Map();
        ${Array.from(this.breakpoints.values()).map(bp => 
          `map.set(${bp.line}, { enabled: ${bp.enabled}, condition: ${JSON.stringify(bp.condition)} });`
        ).join('')}
        return map;
      })();

      function handleMidiMessage(message) {
        ${injected}
      }
    })();
    `
  }

  private createContext(): vm.Context {
    const sandbox: ScriptContext = {
      sendMidi: this.sendMidiCallback,
      log: (...args: any[]) => {
        console.log('[Script]', ...args)
        this.emit('log', args)
      },
      state: this.globalState,
      console: {
        log: (...args) => console.log('[Script]', ...args),
        error: (...args) => console.error('[Script]', ...args),
        warn: (...args) => console.warn('[Script]', ...args)
      }
    }

    return vm.createContext(sandbox, {
      microtaskMode: 'afterEvaluate'
    })
  }

  start(code: string) {
    this.stop()
    
    if (!this.compileScript(code)) {
      throw new Error('Failed to compile script')
    }

    this.context = this.createContext()
    this.messageCount = 0
    this.running = true
    
    try {
      this.compiledScript!.runInContext(this.context!, {
        timeout: 5000,
        displayErrors: true
      })
    } catch (error) {
      console.error('Script execution error:', error)
      this.stop()
      throw error
    }
  }

  stop() {
    this.running = false
    this.isPaused = false
    if (this.context) {
      const keys = Object.keys(this.context)
      for (const key of keys) {
        if (key !== 'state' && key !== 'sendMidi' && key !== 'log' && key !== 'console') {
          delete this.context[key]
        }
      }
      this.context = null
    }
    if (this.compiledScript) {
      this.compiledScript = null
    }
    this.messageCount = 0
  }

  processMidiMessage(message: MidiMessage) {
    if (!this.running || !this.context) return

    this.currentMessage = message
    this.messageCount++
    if (this.messageCount > 100000) {
      console.warn('Message count limit exceeded, resetting counter')
      this.messageCount = 0
    }

    try {
      if (this.isPaused) {
        return
      }

      const result = vm.runInContext(
        `if (typeof handleMidiMessage === 'function') { handleMidiMessage(message) }`,
        this.context,
        { timeout: 100, displayErrors: true }
      )
    } catch (error) {
      console.error('Script error processing MIDI message:', error)
    }
  }

  setBreakpoint(line: number, condition?: string) {
    this.breakpoints.set(line, { line, enabled: true, condition })
    this.emit('breakpointSet', { line, condition })
  }

  removeBreakpoint(line: number) {
    this.breakpoints.delete(line)
    this.emit('breakpointRemoved', { line })
  }

  getBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values())
  }

  resume() {
    this.isPaused = false
    this.pauseReason = null
    this.stepResume(true)
    this.emit('resumed')
  }

  stepOver() {
    this.emit('step', 'over')
    this.stepResume(true)
  }

  stepInto() {
    this.emit('step', 'into')
    this.stepResume(true)
  }

  stepOut() {
    this.emit('step', 'out')
    this.stepResume(true)
  }

  getVariables(): Record<string, any> {
    if (!this.context) return {}
    const vars: Record<string, any> = {}
    for (const key of Object.keys(this.context)) {
      if (!key.startsWith('__')) {
        try {
          vars[key] = JSON.parse(JSON.stringify(this.context[key]))
        } catch (e) {
          vars[key] = '[object]'
        }
      }
    }
    vars.message = this.currentMessage
    return vars
  }

  evaluate(expression: string): any {
    if (!this.context) return null
    try {
      return vm.runInContext(expression, this.context, { timeout: 100 })
    } catch (e) {
      return String(e)
    }
  }

  isRunning() {
    return this.running
  }

  isDebugPaused() {
    return this.isPaused
  }

  destroy() {
    this.stop()
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.removeAllListeners()
    Object.keys(this.globalState).forEach(key => {
      delete this.globalState[key]
    })
    this.breakpoints.clear()
  }
}

let scriptEngine: ScriptEngine | null = null

export function initScriptEngine(sendMidiCallback: (message: MidiMessage) => void) {
  if (scriptEngine) {
    scriptEngine.destroy()
  }
  scriptEngine = new ScriptEngine(sendMidiCallback)
}

export function getScriptEngine(): ScriptEngine {
  if (!scriptEngine) {
    throw new Error('Script engine not initialized')
  }
  return scriptEngine
}
