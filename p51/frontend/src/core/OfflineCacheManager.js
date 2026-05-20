import { eventBus, EVENTS } from '../core/EventBus'

export class OfflineCacheManager {
    constructor(options = {}) {
        this.options = {
            cacheName: options.cacheName || 'heritage_3d_cache',
            maxSize: options.maxSize || 100 * 1024 * 1024,
            defaultTTL: options.defaultTTL || 7 * 24 * 60 * 60 * 1000,
            enableAutoSave: options.enableAutoSave !== false,
            autoSaveInterval: options.autoSaveInterval || 30000,
            ...options
        }
        
        this.isOffline = !navigator.onLine
        this.cache = new Map()
        this.pendingSync = []
        this.stats = {
            hits: 0,
            misses: 0,
            saves: 0
        }
        
        this.init()
    }

    init() {
        this.loadFromStorage()
        this.setupNetworkListeners()
        
        if (this.options.enableAutoSave) {
            this.startAutoSave()
        }
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOffline = false
            eventBus.emit(EVENTS.OFFLINE_DISABLE)
            this.syncPendingChanges()
        })
        
        window.addEventListener('offline', () => {
            this.isOffline = true
            eventBus.emit(EVENTS.OFFLINE_ENABLE)
        })
    }

    loadFromStorage() {
        try {
            const cached = localStorage.getItem(this.options.cacheName)
            if (cached) {
                const data = JSON.parse(cached)
                Object.entries(data).forEach(([key, value]) => {
                    if (!this.isExpired(value)) {
                        this.cache.set(key, value)
                    }
                })
            }
            
            const pending = localStorage.getItem(`${this.options.cacheName}_pending`)
            if (pending) {
                this.pendingSync = JSON.parse(pending)
            }
        } catch (e) {
            console.error('Failed to load offline cache:', e)
        }
    }

    saveToStorage() {
        try {
            const data = Object.fromEntries(this.cache)
            localStorage.setItem(this.options.cacheName, JSON.stringify(data))
            localStorage.setItem(`${this.options.cacheName}_pending`, JSON.stringify(this.pendingSync))
            eventBus.emit(EVENTS.OFFLINE_CACHE_SAVE, { count: this.cache.size })
        } catch (e) {
            console.error('Failed to save offline cache:', e)
        }
    }

    isExpired(value) {
        if (!value.expiresAt) return false
        return Date.now() > value.expiresAt
    }

    async get(key, fetchFn = null) {
        const cached = this.cache.get(key)
        
        if (cached && !this.isExpired(cached)) {
            this.stats.hits++
            eventBus.emit(EVENTS.OFFLINE_CACHE_LOAD, { key, fromCache: true })
            return cached.data
        }
        
        if (this.isOffline) {
            if (cached) {
                this.stats.hits++
                return cached.data
            }
            this.stats.misses++
            throw new Error('Offline: Data not in cache')
        }
        
        if (fetchFn) {
            try {
                const data = await fetchFn()
                this.set(key, data)
                this.stats.misses++
                return data
            } catch (e) {
                if (cached) {
                    console.warn('Using stale cached data:', key)
                    return cached.data
                }
                throw e
            }
        }
        
        this.stats.misses++
        return null
    }

    set(key, data, ttl = null) {
        const expiresAt = ttl ? Date.now() + ttl : Date.now() + this.options.defaultTTL
        
        this.cache.set(key, {
            data,
            expiresAt,
            createdAt: Date.now()
        })
        
        this.stats.saves++
        
        this.trimCache()
    }

    trimCache() {
        let totalSize = this.estimateSize()
        if (totalSize <= this.options.maxSize) return
        
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0))
        
        for (const [key, value] of entries) {
            this.cache.delete(key)
            totalSize = this.estimateSize()
            if (totalSize <= this.options.maxSize) break
        }
    }

    estimateSize() {
        try {
            return new Blob([JSON.stringify(Object.fromEntries(this.cache))]).size
        } catch {
            return this.cache.size * 1024
        }
    }

    delete(key) {
        this.cache.delete(key)
    }

    has(key) {
        const cached = this.cache.get(key)
        return cached && !this.isExpired(cached)
    }

    clear() {
        this.cache.clear()
        this.pendingSync = []
        localStorage.removeItem(this.options.cacheName)
        localStorage.removeItem(`${this.options.cacheName}_pending`)
        eventBus.emit(EVENTS.OFFLINE_CACHE_CLEAR)
    }

    addPendingChange(change) {
        this.pendingSync.push({
            ...change,
            timestamp: Date.now()
        })
        this.saveToStorage()
    }

    async syncPendingChanges() {
        if (this.pendingSync.length === 0) return
        
        console.log(`Syncing ${this.pendingSync.length} pending changes...`)
        
        const changes = [...this.pendingSync]
        this.pendingSync = []
        
        for (const change of changes) {
            try {
                await this.syncChange(change)
            } catch (e) {
                console.error('Failed to sync change:', change, e)
                this.pendingSync.push(change)
            }
        }
        
        this.saveToStorage()
    }

    async syncChange(change) {
        return new Promise(resolve => {
            setTimeout(() => {
                console.log('Synced change:', change)
                resolve()
            }, 100)
        })
    }

    startAutoSave() {
        this.stopAutoSave()
        this.autoSaveTimer = setInterval(() => {
            this.saveToStorage()
        }, this.options.autoSaveInterval)
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer)
            this.autoSaveTimer = null
        }
    }

    cacheSceneState(sceneData) {
        this.set('scene_state', sceneData, 24 * 60 * 60 * 1000)
    }

    getSceneState() {
        const cached = this.cache.get('scene_state')
        return cached ? cached.data : null
    }

    cacheEquipmentList(equipmentList) {
        this.set('equipment_list', equipmentList, 12 * 60 * 60 * 1000)
    }

    async getEquipmentList(fetchFn = null) {
        return this.get('equipment_list', fetchFn)
    }

    cacheEquipmentDetail(equipmentId, detail) {
        this.set(`equipment_${equipmentId}`, detail, 24 * 60 * 60 * 1000)
    }

    async getEquipmentDetail(equipmentId, fetchFn = null) {
        return this.get(`equipment_${equipmentId}`, fetchFn)
    }

    cacheModelData(equipmentId, modelData) {
        this.set(`model_${equipmentId}`, modelData, 7 * 24 * 60 * 60 * 1000)
    }

    async getModelData(equipmentId, fetchFn = null) {
        return this.get(`model_${equipmentId}`, fetchFn)
    }

    cacheAnnotations(equipmentId, annotations) {
        this.set(`annotations_${equipmentId}`, annotations, 6 * 60 * 60 * 1000)
    }

    async getAnnotations(equipmentId, fetchFn = null) {
        return this.get(`annotations_${equipmentId}`, fetchFn)
    }

    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            pendingChanges: this.pendingSync.length,
            isOffline: this.isOffline,
            estimatedSize: this.estimateSize(),
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        }
    }

    exportCache() {
        return {
            version: 1,
            exportedAt: Date.now(),
            cache: Object.fromEntries(this.cache),
            pendingSync: this.pendingSync,
            stats: this.getStats()
        }
    }

    importCache(data) {
        try {
            Object.entries(data.cache).forEach(([key, value]) => {
                this.cache.set(key, value)
            })
            this.pendingSync = data.pendingSync || []
            this.saveToStorage()
            return true
        } catch (e) {
            console.error('Failed to import cache:', e)
            return false
        }
    }

    getCacheKeys(prefix = '') {
        return Array.from(this.cache.keys()).filter(key => key.startsWith(prefix))
    }

    cleanupExpired() {
        const now = Date.now()
        const expiredKeys = []
        
        this.cache.forEach((value, key) => {
            if (value.expiresAt && now > value.expiresAt) {
                expiredKeys.push(key)
            }
        })
        
        expiredKeys.forEach(key => this.cache.delete(key))
        
        if (expiredKeys.length > 0) {
            this.saveToStorage()
        }
        
        return expiredKeys.length
    }
}

export const offlineCache = new OfflineCacheManager()