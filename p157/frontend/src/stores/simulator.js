import { defineStore } from 'pinia'
import { ARMCore } from '@/core/arm-core.js'
import { FreeRTOSScheduler } from '@/core/freertos-sim.js'
import { MultiCoreManager } from '@/core/mp-core.js'

export const useSimulatorStore = defineStore('simulator', {
  state: () => ({
    arm: null,
    scheduler: null,
    mpManager: null,
    useMultiCore: false,
    coreCount: 2,
    isRunning: false,
    isPaused: false,
    speed: 1,
    runInterval: null,
    elfLoaded: false,
    elfFileName: '',
    registers: new Array(16).fill(0),
    xpsr: 0,
    tasks: [],
    queues: [],
    semaphores: [],
    traceEvents: [],
    breakpoints: [],
    currentBreakpoint: null,
    cycles: 0,
    tickCount: 0,
    snapshots: [],
    selectedSnapshot: null,
    coreStates: [],
    powerStats: {
      totalEnergy: 0,
      currentPower: 0,
      corePowers: [],
      powerStates: [],
      breakdown: {}
    },
    scheduleTimeline: []
  }),

  actions: {
    init() {
      if (this.useMultiCore) {
        this.initMultiCore()
      } else {
        this.arm = new ARMCore()
        this.scheduler = new FreeRTOSScheduler(this.arm)
        this.scheduler.init()
        this.registerSyscalls()
        this.updateState()
      }
    },

    initMultiCore() {
      this.mpManager = new MultiCoreManager(this.coreCount)
      this.arm = this.mpManager.cores[0]
      this.scheduler = this.mpManager.schedulers[0]
      this.registerSyscalls()
      this.updateMPState()
    },

    toggleMultiCore(enabled) {
      this.useMultiCore = enabled
      this.stop()
      this.init()
    },

    registerSyscalls() {
      const originalTriggerSVC = this.arm.triggerSVC.bind(this.arm)
      this.arm.triggerSVC = (svc) => {
        this.handleSyscall(svc)
        originalTriggerSVC(svc)
      }
    },

    handleSyscall(svc) {
      const r0 = this.arm.registers[0]
      const r1 = this.arm.registers[1]
      const r2 = this.arm.registers[2]
      const r3 = this.arm.registers[3]
      switch (svc) {
        case 0:
          this.scheduler.delayTask(r0)
          break
        case 1:
          const queueId = this.scheduler.createQueue(r0, r1)
          this.arm.registers[0] = queueId
          break
        case 2:
          this.scheduler.queueSend(r0, r1, r2)
          break
        case 3:
          const item = this.scheduler.queueReceive(r0, r1)
          this.arm.registers[0] = item ? item.data : 0
          break
        case 4:
          const semId = this.scheduler.createSemaphore(r0, r1)
          this.arm.registers[0] = semId
          break
        case 5:
          const taken = this.scheduler.semaphoreTake(r0, r1)
          this.arm.registers[0] = taken ? 1 : 0
          break
        case 6:
          const given = this.scheduler.semaphoreGive(r0)
          this.arm.registers[0] = given ? 1 : 0
          break
        case 7:
          const taskName = this.readString(r0)
          const taskId = this.scheduler.createTask(taskName || 'Task', r1, r2, r3)
          this.arm.registers[0] = taskId
          break
        case 8:
          this.scheduler.suspendTask(r0)
          break
        case 9:
          this.scheduler.resumeTask(r0)
          break
        case 10:
          this.scheduler.taskNotifyGive(r0)
          break
        case 11:
          const notified = this.scheduler.taskNotifyTake(r0, r1)
          this.arm.registers[0] = notified
          break
      }
    },

    readString(addr) {
      let str = ''
      let char = this.arm.read8(addr)
      let i = 0
      while (char !== 0 && i < 256) {
        str += String.fromCharCode(char)
        i++
        char = this.arm.read8(addr + i)
      }
      return str
    },

    loadELF(buffer, fileName) {
      try {
        this.arm.loadELF(buffer)
        this.arm.reset()
        this.elfLoaded = true
        this.elfFileName = fileName
        this.scheduler = new FreeRTOSScheduler(this.arm)
        this.scheduler.init()
        this.registerSyscalls()
        this.updateState()
        return true
      } catch (e) {
        console.error('ELF load error:', e)
        return false
      }
    },

    step() {
      if (this.useMultiCore) {
        if (!this.mpManager) return
        this.mpManager.step()
        this.updateMPState()
      } else {
        if (!this.elfLoaded) return
        const result = this.arm.step()
        if (this.scheduler.tickCount % 100 === 0) {
          this.scheduler.tick()
        }
        this.updateState()
        if (result.breakpoint) {
          this.currentBreakpoint = result.pc
          this.pause()
        }
      }
    },

    run() {
      if (this.isRunning || (!this.elfLoaded && !this.useMultiCore)) return
      this.isRunning = true
      this.isPaused = false
      this.currentBreakpoint = null
      this.runInterval = setInterval(() => {
        for (let i = 0; i < this.speed * 10; i++) {
          if (this.useMultiCore) {
            this.mpManager.step()
          } else {
            const result = this.arm.step()
            if (this.scheduler.tickCount % 100 === 0) {
              this.scheduler.tick()
            }
            if (result.breakpoint) {
              this.currentBreakpoint = result.pc
              this.pause()
              return
            }
          }
        }
        if (this.useMultiCore) {
          this.updateMPState()
        } else {
          this.updateState()
        }
      }, 16)
    },

    exportTimeline(format = 'json') {
      if (this.mpManager) {
        return this.mpManager.exportTimeline(format)
      }
      return null
    },

    downloadTimeline(format = 'json') {
      if (this.mpManager) {
        this.mpManager.downloadTimeline(format)
      }
    },

    pause() {
      this.isRunning = false
      this.isPaused = true
      if (this.runInterval) {
        clearInterval(this.runInterval)
        this.runInterval = null
      }
    },

    stop() {
      this.pause()
      this.arm.reset()
      this.scheduler = new FreeRTOSScheduler(this.arm)
      this.scheduler.init()
      this.registerSyscalls()
      this.updateState()
    },

    reset() {
      this.stop()
      this.run()
    },

    setSpeed(speed) {
      this.speed = speed
      if (this.isRunning) {
        this.pause()
        this.run()
      }
    },

    addBreakpoint(addr) {
      this.arm.addBreakpoint(addr)
      if (!this.breakpoints.includes(addr)) {
        this.breakpoints.push(addr)
      }
    },

    removeBreakpoint(addr) {
      this.arm.removeBreakpoint(addr)
      const idx = this.breakpoints.indexOf(addr)
      if (idx >= 0) {
        this.breakpoints.splice(idx, 1)
      }
    },

    toggleBreakpoint(addr) {
      if (this.breakpoints.includes(addr)) {
        this.removeBreakpoint(addr)
      } else {
        this.addBreakpoint(addr)
      }
    },

    updateState() {
      this.registers = [...this.arm.registers]
      this.xpsr = this.arm.xpsr
      this.cycles = this.arm.cycles
      this.tickCount = this.scheduler.tickCount
      this.tasks = this.scheduler.getTaskStates()
      this.queues = this.scheduler.getQueueStates()
      this.semaphores = this.scheduler.getSemaphoreStates()
      this.traceEvents = this.scheduler.traceEvents.slice(-50)
    },

    updateMPState() {
      if (this.mpManager) {
        this.coreStates = this.mpManager.getCoreStates()
        this.powerStats = this.mpManager.getPowerStats()
        this.scheduleTimeline = this.mpManager.scheduleTimeline.slice(-100)
        const allTasks = []
        const allQueues = []
        const allSemaphores = []
        for (const scheduler of this.mpManager.schedulers) {
          allTasks.push(...scheduler.getTaskStates().map(t => ({ ...t, coreId: scheduler.coreId })))
          allQueues.push(...scheduler.getQueueStates())
          allSemaphores.push(...scheduler.getSemaphoreStates())
        }
        this.tasks = allTasks
        this.queues = allQueues
        this.semaphores = allSemaphores
        this.cycles = this.mpManager.currentTime
        this.tickCount = this.mpManager.currentTime
      }
    },

    async saveSnapshot(name) {
      const snapshot = {
        name,
        timestamp: Date.now(),
        data: this.scheduler.getSnapshot()
      }
      try {
        const response = await fetch('/api/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(snapshot)
        })
        if (response.ok) {
          const result = await response.json()
          snapshot.id = result.id
          this.snapshots.push(snapshot)
        }
      } catch (e) {
        console.error('Save snapshot error:', e)
      }
    },

    async loadSnapshots() {
      try {
        const response = await fetch('/api/snapshots')
        if (response.ok) {
          this.snapshots = await response.json()
        }
      } catch (e) {
        console.error('Load snapshots error:', e)
      }
    },

    async loadSnapshot(id) {
      try {
        const response = await fetch(`/api/snapshots/${id}`)
        if (response.ok) {
          const snapshot = await response.json()
          this.scheduler.restoreSnapshot(snapshot.data)
          this.updateState()
        }
      } catch (e) {
        console.error('Load snapshot error:', e)
      }
    },

    async deleteSnapshot(id) {
      try {
        await fetch(`/api/snapshots/${id}`, { method: 'DELETE' })
        this.snapshots = this.snapshots.filter(s => s.id !== id)
      } catch (e) {
        console.error('Delete snapshot error:', e)
      }
    },

    createDemoTasks() {
      if (this.useMultiCore) {
        this.mpManager.createTask('Task-A', 2, 1024, 0x00001000, 0, 0b01)
        this.mpManager.createTask('Task-B', 2, 1024, 0x00001100, 0, 0b10)
        this.mpManager.createTask('Task-C', 1, 512, 0x00001200, 0, 0b11)
        this.mpManager.createTask('Task-D', 3, 512, 0x00001300, 0, 0b11)
        this.mpManager.schedulers[0].createQueue(10, 4)
        this.mpManager.schedulers[0].createSemaphore(1, 1)
        this.mpManager.schedulers[0].schedule()
        this.mpManager.schedulers[1].schedule()
        this.updateMPState()
      } else {
        this.scheduler.createTask('Producer', 2, 1024, 0x00001000)
        this.scheduler.createTask('Consumer', 1, 1024, 0x00001100)
        this.scheduler.createTask('Monitor', 3, 512, 0x00001200)
        const queueId = this.scheduler.createQueue(10, 4)
        const semId = this.scheduler.createSemaphore(1, 1)
        this.scheduler.schedule()
        this.updateState()
      }
    }
  }
})
