import { ARMCore } from './arm-core.js'

export const TaskState = {
  READY: 'ready',
  RUNNING: 'running',
  BLOCKED: 'blocked',
  SUSPENDED: 'suspended',
  DELETED: 'deleted'
}

export class FreeRTOSScheduler {
  constructor(armCore) {
    this.arm = armCore
    this.tasks = new Map()
    this.queues = new Map()
    this.semaphores = new Map()
    this.currentTask = null
    this.tickCount = 0
    this.priorityReadyLists = new Map()
    this.topReadyPriority = 0
    this.syscallHandler = null
    this.traceEvents = []
  }

  init() {
    for (let i = 0; i < 32; i++) {
      this.priorityReadyLists.set(i, [])
    }
  }

  createTask(name, priority, stackSize, entryFunc, arg = 0) {
    const taskId = this.tasks.size + 1
    const stackBase = 0x20010000 + taskId * 0x1000
    const task = {
      id: taskId,
      name: name,
      priority: priority,
      basePriority: priority,
      state: TaskState.READY,
      stackBase: stackBase,
      stackSize: stackSize,
      sp: stackBase + stackSize - 64,
      pc: entryFunc,
      lr: 0xFFFFFFFD,
      registers: new Uint32Array(16),
      stateVars: {},
      notifications: 0,
      delayUntil: 0,
      blockingObject: null,
      eventBits: 0,
      mutexHolder: false
    }
    task.registers[0] = arg
    task.registers[15] = entryFunc
    this.tasks.set(taskId, task)
    this.addToReadyList(taskId, priority)
    this.addTraceEvent('TASK_CREATE', { taskId, name, priority })
    return taskId
  }

  addToReadyList(taskId, priority) {
    if (!this.priorityReadyLists.has(priority)) {
      this.priorityReadyLists.set(priority, [])
    }
    const list = this.priorityReadyLists.get(priority)
    if (!list.includes(taskId)) {
      list.push(taskId)
    }
    if (priority > this.topReadyPriority) {
      this.topReadyPriority = priority
    }
  }

  removeFromReadyList(taskId, priority) {
    const list = this.priorityReadyLists.get(priority)
    if (list) {
      const idx = list.indexOf(taskId)
      if (idx >= 0) {
        list.splice(idx, 1)
      }
    }
  }

  selectNextTask() {
    for (let prio = 31; prio >= 0; prio--) {
      const list = this.priorityReadyLists.get(prio)
      if (list && list.length > 0) {
        return list[0]
      }
    }
    return null
  }

  switchContext(nextTaskId) {
    if (this.currentTask) {
      const current = this.tasks.get(this.currentTask)
      if (current) {
        current.sp = this.arm.getSP()
        current.pc = this.arm.getPC()
        current.lr = this.arm.getLR()
        for (let i = 0; i < 16; i++) {
          current.registers[i] = this.arm.registers[i]
        }
        if (current.state === TaskState.RUNNING) {
          current.state = TaskState.READY
          this.addToReadyList(this.currentTask, current.priority)
        }
      }
    }
    const next = this.tasks.get(nextTaskId)
    if (next) {
      this.arm.setSP(next.sp)
      this.arm.setPC(next.pc)
      this.arm.setLR(next.lr)
      for (let i = 0; i < 16; i++) {
        this.arm.registers[i] = next.registers[i]
      }
      next.state = TaskState.RUNNING
      this.removeFromReadyList(nextTaskId, next.priority)
      this.currentTask = nextTaskId
      this.addTraceEvent('TASK_SWITCH', { from: this.currentTask, to: nextTaskId })
    }
  }

  tick() {
    this.tickCount++
    for (const [taskId, task] of this.tasks) {
      if (task.state === TaskState.BLOCKED && task.delayUntil > 0) {
        task.delayUntil--
        if (task.delayUntil === 0) {
          this.unblockTask(taskId)
        }
      }
    }
    this.schedule()
  }

  schedule() {
    const nextTask = this.selectNextTask()
    if (nextTask && nextTask !== this.currentTask) {
      const current = this.tasks.get(this.currentTask)
      if (!current || this.tasks.get(nextTask).priority > current.priority) {
        this.switchContext(nextTask)
      }
    }
  }

  blockTask(taskId, timeout = 0) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.state = TaskState.BLOCKED
      task.delayUntil = timeout
      this.removeFromReadyList(taskId, task.priority)
      this.addTraceEvent('TASK_BLOCK', { taskId, timeout })
    }
  }

  unblockTask(taskId) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.state = TaskState.READY
      task.blockingObject = null
      this.addToReadyList(taskId, task.priority)
      this.addTraceEvent('TASK_UNBLOCK', { taskId })
      this.schedule()
    }
  }

  suspendTask(taskId) {
    const task = this.tasks.get(taskId)
    if (task) {
      const oldState = task.state
      task.state = TaskState.SUSPENDED
      this.removeFromReadyList(taskId, task.priority)
      this.addTraceEvent('TASK_SUSPEND', { taskId, from: oldState })
    }
  }

  resumeTask(taskId) {
    const task = this.tasks.get(taskId)
    if (task && task.state === TaskState.SUSPENDED) {
      task.state = TaskState.READY
      this.addToReadyList(taskId, task.priority)
      this.addTraceEvent('TASK_RESUME', { taskId })
    }
  }

  delayTask(ticks) {
    if (this.currentTask) {
      const task = this.tasks.get(this.currentTask)
      if (task) {
        this.blockTask(this.currentTask, ticks)
        this.schedule()
      }
    }
  }

  delayUntilTask(previousWakeTime, increment) {
    if (this.currentTask) {
      const task = this.tasks.get(this.currentTask)
      if (task) {
        const now = this.tickCount
        const delay = previousWakeTime + increment - now
        if (delay > 0) {
          this.blockTask(this.currentTask, delay)
        }
        task.stateVars.previousWakeTime = previousWakeTime + increment
        this.schedule()
      }
    }
  }

  createQueue(queueLength, itemSize) {
    const queueId = this.queues.size + 1
    const queue = {
      id: queueId,
      length: queueLength,
      itemSize: itemSize,
      items: [],
      tasksWaitingToSend: [],
      tasksWaitingToReceive: [],
      mutexHolder: null
    }
    this.queues.set(queueId, queue)
    this.addTraceEvent('QUEUE_CREATE', { queueId, queueLength, itemSize })
    return queueId
  }

  queueSend(queueId, item, timeout = 0) {
    const queue = this.queues.get(queueId)
    if (!queue) return false
    if (queue.items.length >= queue.length) {
      if (this.currentTask && timeout > 0) {
        queue.tasksWaitingToSend.push(this.currentTask)
        this.blockTask(this.currentTask, timeout)
        this.tasks.get(this.currentTask).blockingObject = { type: 'queue', id: queueId, op: 'send' }
        this.schedule()
      }
      return false
    }
    queue.items.push({ data: item, time: this.tickCount })
    this.addTraceEvent('QUEUE_SEND', { queueId, itemCount: queue.items.length })
    if (queue.tasksWaitingToReceive.length > 0) {
      const taskId = queue.tasksWaitingToReceive.shift()
      this.unblockTask(taskId)
    }
    return true
  }

  queueReceive(queueId, timeout = 0) {
    const queue = this.queues.get(queueId)
    if (!queue) return null
    if (queue.items.length === 0) {
      if (this.currentTask && timeout > 0) {
        queue.tasksWaitingToReceive.push(this.currentTask)
        this.blockTask(this.currentTask, timeout)
        this.tasks.get(this.currentTask).blockingObject = { type: 'queue', id: queueId, op: 'receive' }
        this.schedule()
      }
      return null
    }
    const item = queue.items.shift()
    this.addTraceEvent('QUEUE_RECEIVE', { queueId, itemCount: queue.items.length })
    if (queue.tasksWaitingToSend.length > 0) {
      const taskId = queue.tasksWaitingToSend.shift()
      this.unblockTask(taskId)
    }
    return item
  }

  createSemaphore(maxCount = 1, initialCount = 0) {
    const semId = this.semaphores.size + 1
    const sem = {
      id: semId,
      maxCount: maxCount,
      count: initialCount,
      type: maxCount === 1 ? 'mutex' : 'counting',
      tasksWaiting: [],
      holder: null
    }
    this.semaphores.set(semId, sem)
    this.addTraceEvent('SEMAPHORE_CREATE', { semId, type: sem.type, maxCount, initialCount })
    return semId
  }

  semaphoreTake(semId, timeout = 0) {
    const sem = this.semaphores.get(semId)
    if (!sem) return false
    if (sem.count <= 0) {
      if (this.currentTask && timeout > 0) {
        sem.tasksWaiting.push(this.currentTask)
        this.blockTask(this.currentTask, timeout)
        this.tasks.get(this.currentTask).blockingObject = { type: 'semaphore', id: semId, op: 'take' }
        this.schedule()
      }
      return false
    }
    sem.count--
    if (sem.type === 'mutex') {
      sem.holder = this.currentTask
      const task = this.tasks.get(this.currentTask)
      if (task) {
        task.mutexHolder = true
      }
    }
    this.addTraceEvent('SEMAPHORE_TAKE', { semId, count: sem.count })
    return true
  }

  semaphoreGive(semId) {
    const sem = this.semaphores.get(semId)
    if (!sem) return false
    if (sem.count >= sem.maxCount) {
      return false
    }
    sem.count++
    if (sem.type === 'mutex') {
      sem.holder = null
      const task = this.tasks.get(this.currentTask)
      if (task) {
        task.mutexHolder = false
      }
    }
    this.addTraceEvent('SEMAPHORE_GIVE', { semId, count: sem.count })
    if (sem.tasksWaiting.length > 0) {
      const taskId = sem.tasksWaiting.shift()
      this.unblockTask(taskId)
    }
    return true
  }

  taskNotifyGive(taskId) {
    const task = this.tasks.get(taskId)
    if (task) {
      task.notifications++
      if (task.state === TaskState.BLOCKED && task.blockingObject?.type === 'notification') {
        this.unblockTask(taskId)
      }
      this.addTraceEvent('TASK_NOTIFY', { taskId, count: task.notifications })
    }
  }

  taskNotifyTake(clearCount = true, timeout = 0) {
    if (!this.currentTask) return 0
    const task = this.tasks.get(this.currentTask)
    if (!task) return 0
    if (task.notifications === 0 && timeout > 0) {
      task.blockingObject = { type: 'notification' }
      this.blockTask(this.currentTask, timeout)
      this.schedule()
      return 0
    }
    const count = task.notifications
    if (clearCount) {
      task.notifications = 0
    } else {
      task.notifications--
    }
    return count
  }

  prioritySet(taskId, newPriority) {
    const task = this.tasks.get(taskId)
    if (task) {
      const oldPriority = task.priority
      task.priority = newPriority
      if (task.state === TaskState.READY) {
        this.removeFromReadyList(taskId, oldPriority)
        this.addToReadyList(taskId, newPriority)
      }
      this.addTraceEvent('PRIORITY_SET', { taskId, oldPriority, newPriority })
    }
  }

  addTraceEvent(type, data) {
    this.traceEvents.push({
      time: this.tickCount,
      cycle: this.arm.cycles,
      type,
      data
    })
    if (this.traceEvents.length > 1000) {
      this.traceEvents.shift()
    }
  }

  getTaskStates() {
    const result = []
    for (const [id, task] of this.tasks) {
      result.push({
        id: task.id,
        name: task.name,
        priority: task.priority,
        state: task.state,
        stackUsage: task.stackBase + task.stackSize - task.sp,
        stackSize: task.stackSize,
        notifications: task.notifications
      })
    }
    return result
  }

  getQueueStates() {
    const result = []
    for (const [id, queue] of this.queues) {
      result.push({
        id: queue.id,
        length: queue.length,
        itemSize: queue.itemSize,
        count: queue.items.length,
        waitingSend: queue.tasksWaitingToSend.length,
        waitingReceive: queue.tasksWaitingToReceive.length
      })
    }
    return result
  }

  getSemaphoreStates() {
    const result = []
    for (const [id, sem] of this.semaphores) {
      result.push({
        id: sem.id,
        type: sem.type,
        maxCount: sem.maxCount,
        count: sem.count,
        waiting: sem.tasksWaiting.length,
        holder: sem.holder
      })
    }
    return result
  }

  getSnapshot() {
    return {
      tickCount: this.tickCount,
      currentTask: this.currentTask,
      tasks: Array.from(this.tasks.entries()),
      queues: Array.from(this.queues.entries()),
      semaphores: Array.from(this.semaphores.entries()),
      armState: this.arm.getState(),
      traceEvents: [...this.traceEvents]
    }
  }

  restoreSnapshot(snapshot) {
    this.tickCount = snapshot.tickCount
    this.currentTask = snapshot.currentTask
    this.tasks = new Map(snapshot.tasks)
    this.queues = new Map(snapshot.queues)
    this.semaphores = new Map(snapshot.semaphores)
    this.arm.restoreState(snapshot.armState)
    this.traceEvents = [...snapshot.traceEvents]
    for (let i = 0; i < 32; i++) {
      this.priorityReadyLists.set(i, [])
    }
    for (const [id, task] of this.tasks) {
      if (task.state === TaskState.READY) {
        this.addToReadyList(id, task.priority)
      }
    }
  }
}
