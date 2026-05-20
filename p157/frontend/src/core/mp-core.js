import { ARMCore } from './arm-core.js'
import { FreeRTOSScheduler, TaskState } from './freertos-sim.js'

export const PowerState = {
  RUN: 'run',
  WFI: 'wfi',
  SLEEP: 'sleep',
  DEEP_SLEEP: 'deep_sleep',
  OFF: 'off'
}

export class MultiCoreManager {
  constructor(coreCount = 2) {
    this.coreCount = coreCount
    this.cores = []
    this.schedulers = []
    this.sharedMemory = new Uint8Array(0x400000)
    this.globalTasks = new Map()
    this.taskAffinity = new Map()
    this.scheduleTimeline = []
    this.timelineMaxLength = 10000
    this.powerModel = new PowerModel()
    this.totalEnergy = 0
    this.currentTime = 0
    this.interCoreInterrupts = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.coreCount; i++) {
      const core = new ARMCore()
      core.memory = this.sharedMemory
      core.memory32 = new Uint32Array(this.sharedMemory.buffer)
      core.coreId = i
      const scheduler = new FreeRTOSScheduler(core)
      scheduler.coreId = i
      scheduler.init()
      this.cores.push(core)
      this.schedulers.push(scheduler)
    }
    this.setupSharedPeripherals()
  }

  setupSharedPeripherals() {
    this.sharedGIC = {
      pending: new Uint8Array(256),
      enabled: new Uint8Array(256),
      priority: new Uint8Array(256),
      targets: new Uint8Array(256)
    }
  }

  createTask(name, priority, stackSize, entryFunc, arg = 0, affinityMask = null) {
    const taskId = this.globalTasks.size + 1
    const affinity = affinityMask !== null ? affinityMask : ((1 << this.coreCount) - 1)
    this.taskAffinity.set(taskId, affinity)
    const coreId = this.selectCoreForTask(affinity)
    const scheduler = this.schedulers[coreId]
    scheduler.createTask(name, priority, stackSize, entryFunc, arg)
    const task = scheduler.tasks.get(scheduler.tasks.size)
    task.globalId = taskId
    task.affinity = affinity
    task.lastCoreId = coreId
    this.globalTasks.set(taskId, {
      globalId: taskId,
      name,
      priority,
      affinity,
      coreId
    })
    return taskId
  }

  selectCoreForTask(affinityMask) {
    let bestCore = 0
    let minLoad = Infinity
    for (let i = 0; i < this.coreCount; i++) {
      if (affinityMask & (1 << i)) {
        const load = this.getCoreLoad(i)
        if (load < minLoad) {
          minLoad = load
          bestCore = i
        }
      }
    }
    return bestCore
  }

  getCoreLoad(coreId) {
    const scheduler = this.schedulers[coreId]
    let load = 0
    for (const [id, task] of scheduler.tasks) {
      if (task.state === TaskState.READY || task.state === TaskState.RUNNING) {
        load += task.priority + 1
      }
    }
    return load
  }

  step() {
    const stepStart = this.currentTime
    for (let i = 0; i < this.coreCount; i++) {
      const core = this.cores[i]
      const scheduler = this.schedulers[i]
      const prevTask = scheduler.currentTask
      const prevState = scheduler.tasks.get(prevTask)?.state
      const result = core.step()
      if (scheduler.tickCount % 100 === 0) {
        scheduler.tick()
      }
      const currTask = scheduler.currentTask
      if (prevTask !== currTask) {
        this.recordTimelineEvent(i, prevTask, currTask, stepStart)
      }
      const power = this.powerModel.calculateCorePower(i, core, scheduler)
      this.totalEnergy += power * 0.001
    }
    this.currentTime++
    this.checkLoadBalancing()
    this.checkInterCoreInterrupts()
  }

  recordTimelineEvent(coreId, fromTask, toTask, time) {
    const event = {
      time,
      coreId,
      from: fromTask,
      to: toTask,
      timestamp: Date.now()
    }
    this.scheduleTimeline.push(event)
    if (this.scheduleTimeline.length > this.timelineMaxLength) {
      this.scheduleTimeline.shift()
    }
  }

  checkLoadBalancing() {
    if (this.currentTime % 1000 !== 0) return
    const loads = this.schedulers.map((s, i) => ({
      coreId: i,
      load: this.getCoreLoad(i),
      scheduler: s
    }))
    loads.sort((a, b) => a.load - b.load)
    if (loads[loads.length - 1].load - loads[0].load > 5) {
      this.migrateTask(
        loads[loads.length - 1].coreId,
        loads[0].coreId
      )
    }
  }

  migrateTask(fromCoreId, toCoreId) {
    const fromScheduler = this.schedulers[fromCoreId]
    const toScheduler = this.schedulers[toCoreId]
    let taskToMigrate = null
    for (const [id, task] of fromScheduler.tasks) {
      if (task.state === TaskState.READY && task.affinity & (1 << toCoreId)) {
        taskToMigrate = { id, task }
        break
      }
    }
    if (taskToMigrate) {
      const { id, task } = taskToMigrate
      fromScheduler.removeFromReadyList(id, task.priority)
      fromScheduler.tasks.delete(id)
      toScheduler.tasks.set(id, task)
      toScheduler.addToReadyList(id, task.priority)
      task.lastCoreId = toCoreId
      this.sendIPI(toCoreId, 'TASK_MIGRATED')
    }
  }

  sendIPI(coreId, type) {
    this.interCoreInterrupts.push({ coreId, type, time: this.currentTime })
  }

  checkInterCoreInterrupts() {
    for (let i = this.interCoreInterrupts.length - 1; i >= 0; i--) {
      const ipi = this.interCoreInterrupts[i]
      if (this.currentTime - ipi.time >= 10) {
        this.cores[ipi.coreId].exceptionPending = 1
        this.interCoreInterrupts.splice(i, 1)
      }
    }
  }

  exportTimeline(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.scheduleTimeline, null, 2)
    }
    if (format === 'csv') {
      let csv = 'time,core_id,from_task,to_task\n'
      for (const e of this.scheduleTimeline) {
        csv += `${e.time},${e.coreId},${e.from || 'IDLE'},${e.to || 'IDLE'}\n`
      }
      return csv
    }
    if (format === 'chrome') {
      const traceEvents = []
      for (const e of this.scheduleTimeline) {
        if (e.from !== null) {
          traceEvents.push({
            name: `Task_${e.from}`,
            ph: 'E',
            ts: e.time,
            pid: 0,
            tid: e.coreId
          })
        }
        if (e.to !== null) {
          traceEvents.push({
            name: `Task_${e.to}`,
            ph: 'B',
            ts: e.time,
            pid: 0,
            tid: e.coreId
          })
        }
      }
      return JSON.stringify({ traceEvents }, null, 2)
    }
    return null
  }

  downloadTimeline(format = 'json') {
    const data = this.exportTimeline(format)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule_timeline.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  getPowerStats() {
    return {
      totalEnergy: this.totalEnergy,
      currentPower: this.powerModel.getTotalPower(),
      corePowers: this.powerModel.corePowers,
      powerStates: this.powerModel.powerStates,
      breakdown: this.powerModel.getPowerBreakdown()
    }
  }

  getCoreStates() {
    return this.cores.map((core, i) => ({
      coreId: i,
      pc: core.getPC(),
      cycles: core.cycles,
      currentTask: this.schedulers[i].currentTask,
      powerState: this.powerModel.powerStates[i] || PowerState.RUN,
      power: this.powerModel.corePowers[i] || 0
    }))
  }
}

export class PowerModel {
  constructor() {
    this.corePowers = []
    this.powerStates = []
    this.powerConfig = {
      run: 100,
      wfi: 20,
      sleep: 5,
      deep_sleep: 1,
      off: 0.1,
      taskActiveBase: 5,
      taskPriorityFactor: 0.5,
      memoryAccess: 0.1,
      peripheralAccess: 0.2
    }
    this.activityCounters = []
  }

  calculateCorePower(coreId, core, scheduler) {
    let power = 0
    const task = scheduler.tasks.get(scheduler.currentTask)
    if (task && task.state === TaskState.RUNNING) {
      power += this.powerConfig.run
      power += this.powerConfig.taskActiveBase
      power += task.priority * this.powerConfig.taskPriorityFactor
      this.powerStates[coreId] = PowerState.RUN
    } else if (core.exceptionPending > 0 || core.pendingException > 0) {
      power += this.powerConfig.run * 0.8
      this.powerStates[coreId] = PowerState.RUN
    } else {
      power += this.powerConfig.wfi
      this.powerStates[coreId] = PowerState.WFI
    }
    this.corePowers[coreId] = power
    return power
  }

  getTotalPower() {
    return this.corePowers.reduce((a, b) => a + (b || 0), 0)
  }

  getPowerBreakdown() {
    return {
      core: this.corePowers.reduce((a, b) => a + (b || 0), 0),
      memory: this.corePowers.length * this.powerConfig.memoryAccess * 10,
      peripherals: this.corePowers.length * this.powerConfig.peripheralAccess * 5
    }
  }

  setPowerState(coreId, state) {
    this.powerStates[coreId] = state
  }

  estimateEnergyConsumption(durationMs) {
    const avgPower = this.getTotalPower()
    return avgPower * durationMs / 3600000
  }
}
