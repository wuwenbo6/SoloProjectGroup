export class EventBus {
    constructor() {
        this.events = new Map()
        this.onceEvents = new Map()
    }

    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, [])
        }
        this.events.get(event).push(callback)
        return () => this.off(event, callback)
    }

    once(event, callback) {
        if (!this.onceEvents.has(event)) {
            this.onceEvents.set(event, [])
        }
        this.onceEvents.get(event).push(callback)
        return () => this.offOnce(event, callback)
    }

    off(event, callback) {
        const callbacks = this.events.get(event)
        if (callbacks) {
            const index = callbacks.indexOf(callback)
            if (index > -1) {
                callbacks.splice(index, 1)
            }
        }
    }

    offOnce(event, callback) {
        const callbacks = this.onceEvents.get(event)
        if (callbacks) {
            const index = callbacks.indexOf(callback)
            if (index > -1) {
                callbacks.splice(index, 1)
            }
        }
    }

    emit(event, ...args) {
        const callbacks = this.events.get(event)
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args)
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e)
                }
            })
        }
        
        const onceCallbacks = this.onceEvents.get(event)
        if (onceCallbacks) {
            onceCallbacks.forEach(callback => {
                try {
                    callback(...args)
                } catch (e) {
                    console.error(`EventBus once error in ${event}:`, e)
                }
            })
            this.onceEvents.delete(event)
        }
    }

    clear(event) {
        if (event) {
            this.events.delete(event)
            this.onceEvents.delete(event)
        } else {
            this.events.clear()
            this.onceEvents.clear()
        }
    }

    hasListeners(event) {
        const hasRegular = this.events.has(event) && this.events.get(event).length > 0
        const hasOnce = this.onceEvents.has(event) && this.onceEvents.get(event).length > 0
        return hasRegular || hasOnce
    }

    getListenerCount(event) {
        const regularCount = this.events.has(event) ? this.events.get(event).length : 0
        const onceCount = this.onceEvents.has(event) ? this.onceEvents.get(event).length : 0
        return regularCount + onceCount
    }
}

export const eventBus = new EventBus()

export const EVENTS = {
    RENDER_BEFORE: 'render:before',
    RENDER_AFTER: 'render:after',
    RENDER_RESIZE: 'render:resize',
    RENDER_CAMERA_CHANGE: 'render:camera:change',
    
    MODEL_LOAD_START: 'model:load:start',
    MODEL_LOAD_PROGRESS: 'model:load:progress',
    MODEL_LOAD_COMPLETE: 'model:load:complete',
    MODEL_LOAD_ERROR: 'model:load:error',
    MODEL_CHUNK_LOADED: 'model:chunk:loaded',
    MODEL_UNLOAD: 'model:unload',
    
    PART_SELECT: 'part:select',
    PART_HOVER: 'part:hover',
    PART_DISASSEMBLE: 'part:disassemble',
    PART_ASSEMBLE: 'part:assemble',
    
    DAMAGE_MARK_ADD: 'damage:mark:add',
    DAMAGE_MARK_REMOVE: 'damage:mark:remove',
    DAMAGE_MARK_CLICK: 'damage:mark:click',
    DAMAGE_MARK_HOVER: 'damage:mark:hover',
    
    ANIMATION_START: 'animation:start',
    ANIMATION_STOP: 'animation:stop',
    ANIMATION_PROGRESS: 'animation:progress',
    ANIMATION_COMPLETE: 'animation:complete',
    
    RESTORATION_SHOW: 'restoration:show',
    RESTORATION_HIDE: 'restoration:hide',
    RESTORATION_STEP_CHANGE: 'restoration:step:change',
    
    COLLAB_JOIN: 'collab:join',
    COLLAB_LEAVE: 'collab:leave',
    COLLAB_MESSAGE: 'collab:message',
    COLLAB_SYNC: 'collab:sync',
    
    OFFLINE_ENABLE: 'offline:enable',
    OFFLINE_DISABLE: 'offline:disable',
    OFFLINE_CACHE_SAVE: 'offline:cache:save',
    OFFLINE_CACHE_LOAD: 'offline:cache:load',
    OFFLINE_CACHE_CLEAR: 'offline:cache:clear',
    
    PERFORMANCE_MODE_CHANGE: 'performance:mode:change',
    PERFORMANCE_STATS_UPDATE: 'performance:stats:update',
    
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
}