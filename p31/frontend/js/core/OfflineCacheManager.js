class OfflineCacheManager {
    constructor(options = {}) {
        this.dbName = options.dbName || 'MortiseTenonCache';
        this.dbVersion = options.dbVersion || 1;
        this.db = null;
        this.isInitialized = false;
        this.cacheExpiry = options.cacheExpiry || 7 * 24 * 60 * 60 * 1000;
        this.maxCacheSize = options.maxCacheSize || 50 * 1024 * 1024;
        this.currentCacheSize = 0;
    }

    async init() {
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB 打开失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('IndexedDB 初始化成功');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('models')) {
                    const modelStore = db.createObjectStore('models', { keyPath: 'id });
                    modelStore.createIndex('modelKey', 'modelKey', { unique: false });
                    modelStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('modelData')) {
                    const dataStore = db.createObjectStore('modelData', { keyPath: 'key' });
                    dataStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('apiResponses')) {
                    const apiStore = db.createObjectStore('apiResponses', { keyPath: 'url' });
                    apiStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log('IndexedDB 数据结构已升级');
            };
        });
    }

    async saveModelComponent(modelKey, componentIndex, geometryData, materialData) {
        await this._checkInitialized();

        const id = `${modelKey}_${componentIndex}`;
        const data = {
            id,
            modelKey,
            componentIndex,
            geometryData,
            materialData,
            timestamp: Date.now(),
            size: this._estimateSize(geometryData) + this._estimateSize(materialData)
        };

        await this._put('models', data);
        this.currentCacheSize += data.size;
        
        await this._enforceSizeLimit();
    }

    async getModelComponent(modelKey, componentIndex) {
        await this._checkInitialized();

        const id = `${modelKey}_${componentIndex}`;
        const data = await this._get('models', id);

        if (!data) return null;

        if (Date.now() - data.timestamp > this.cacheExpiry) {
            await this.deleteModelComponent(modelKey, componentIndex);
            return null;
        }

        return data;
    }

    async deleteModelComponent(modelKey, componentIndex) {
        await this._checkInitialized();
        const id = `${modelKey}_${componentIndex}`;
        await this._delete('models', id);
    }

    async saveModelData(modelKey, modelData) {
        await this._checkInitialized();

        const data = {
            key: modelKey,
            data: modelData,
            timestamp: Date.now(),
            size: this._estimateSize(modelData)
        };

        await this._put('modelData', data);
        this.currentCacheSize += data.size;
        await this._enforceSizeLimit();
    }

    async getModelData(modelKey) {
        await this._checkInitialized();

        const data = await this._get('modelData', modelKey);

        if (!data) return null;

        if (Date.now() - data.timestamp > this.cacheExpiry) {
            await this.deleteModelData(modelKey);
            return null;
        }

        return data.data;
    }

    async deleteModelData(modelKey) {
        await this._checkInitialized();
        await this._delete('modelData', modelKey);
    }

    async saveApiResponse(url, responseData, params = {}) {
        await this._checkInitialized();

        const data = {
            url,
            params,
            data: responseData,
            timestamp: Date.now(),
            size: this._estimateSize(responseData)
        };

        await this._put('apiResponses', data);
        this.currentCacheSize += data.size;
        await this._enforceSizeLimit();
    }

    async getApiResponse(url, params = {}) {
        await this._checkInitialized();

        const data = await this._get('apiResponses', url);

        if (!data) return null;

        if (Date.now() - data.timestamp > this.cacheExpiry) {
            await this.deleteApiResponse(url);
            return null;
        }

        return data.data;
    }

    async deleteApiResponse(url) {
        await this._checkInitialized();
        await this._delete('apiResponses', url);
    }

    async getAllCachedModelKeys() {
        await this._checkInitialized();
        const allData = await this._getAll('modelData');
        return allData.map(item => item.key);
    }

    async getCacheStats() {
        await this._checkInitialized();

        const modelCount = await this._count('models');
        const modelDataCount = await this._count('modelData');
        const apiCount = await this._count('apiResponses');
        const totalSize = await this._calculateTotalSize();

        return {
            modelCount,
            modelDataCount,
            apiCount,
            totalSize,
            maxSize: this.maxCacheSize,
            isOffline: !navigator.onLine,
            expiryDays: this.cacheExpiry / (24 * 60 * 60 * 1000)
        };
    }

    async clearExpired() {
        await this._checkInitialized();
        const now = Date.now();
        const stores = ['models', 'modelData', 'apiResponses'];
        let clearedCount = 0;

        for (const storeName of stores) {
            const items = await this._getAll(storeName);
            for (const item of items) {
                if (now - item.timestamp > this.cacheExpiry) {
                    await this._delete(storeName, item.id || item.key || item.url);
                    clearedCount++;
                }
            }
        }

        console.log(`已清除 ${clearedCount} 个过期缓存项`);
        return clearedCount;
    }

    async clearAll() {
        await this._checkInitialized();
        const stores = ['models', 'modelData', 'apiResponses', 'settings'];
        
        for (const storeName of stores) {
            await this._clearStore(storeName);
        }

        this.currentCacheSize = 0;
        console.log('所有缓存已清除');
    }

    async isModelCached(modelKey) {
        await this._checkInitialized();
        const data = await this._get('modelData', modelKey);
        return data !== null;
    }

    async saveSetting(key, value) {
        await this._checkInitialized();
        await this._put('settings', { key, value, timestamp: Date.now() });
    }

    async getSetting(key, defaultValue = null) {
        await this._checkInitialized();
        const result = await this._get('settings', key);
        return result ? result.value : defaultValue;
    }

    async cacheModelWithComponents(modelKey, modelData, components) {
        await this.saveModelData(modelKey, modelData);

        for (let i = 0; i < components.length; i++) {
            const comp = components[i];
            const geometryData = {
            type: 'BoxGeometry',
            parameters: comp.size
            };
            await this.saveModelComponent(modelKey, i, geometryData, {
            color: comp.color || 0x667eea,
                metalness: 0.1,
                roughness: 0.6
            });
        }

        console.log(`模型 ${modelKey} 已缓存到本地`);
    }

    async loadCachedModel(modelKey) {
        const modelData = await this.getModelData(modelKey);
        if (!modelData) return null;

        return {
            modelData,
            cachedAt: Date.now()
        };
    }

    wrapFetchWithCache(fetchFn) {
        return async (url, options = {}) => {
            const useCache = options.useCache !== false;
            const cacheOnly = options.cacheOnly === true;

            if (useCache && (cacheOnly || !navigator.onLine)) {
                const cached = await this.getApiResponse(url, options.params);
                if (cached) {
                    console.log('使用缓存数据:', url);
                    return { data: cached, fromCache: true };
                }

                if (cacheOnly) {
                    throw new Error('无网络且无缓存');
                }
            }

            try {
                const response = await fetchFn(url, options);
                if (useCache && response && response.data) {
                    await this.saveApiResponse(url, response.data, options.params);
                }
                return { ...response, fromCache: false };
            } catch (error) {
                if (!navigator.onLine) {
                    const cached = await this.getApiResponse(url, options.params);
                    if (cached) {
                        console.log('网络失败，使用缓存数据:', url);
                        return { data: cached, fromCache: true };
                    }
                }
                throw error;
            }
        };
    }

    _checkInitialized() {
        if (!this.isInitialized) {
            return this.init();
        }
        return Promise.resolve();
    }

    _put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    _get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    _getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _count(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async _enforceSizeLimit() {
        if (this.currentCacheSize <= this.maxCacheSize) return;

        const stores = ['models', 'modelData', 'apiResponses'];
        const allItems = [];

        for (const storeName of stores) {
            const items = await this._getAll(storeName);
            items.forEach(item => {
                allItems.push({
                    ...item,
                    _store: storeName,
                    _key: item.id || item.key || item.url
                });
            });
        }

        allItems.sort((a, b) => a.timestamp - b.timestamp);

        for (const item of allItems) {
            if (this.currentCacheSize <= this.maxCacheSize * 0.8) break;
            
            await this._delete(item._store, item._key);
            this.currentCacheSize -= (item.size || 0);
        }

        console.log('缓存大小限制已执行');
    }

    async _calculateTotalSize() {
        const stores = ['models', 'modelData', 'apiResponses'];
        let total = 0;

        for (const storeName of stores) {
            const items = await this._getAll(storeName);
            items.forEach(item => {
                total += (item.size || 0);
            });
        }

        return total;
    }

    _estimateSize(obj) {
        const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
        return new Blob([str]).size;
    }

    registerServiceWorker(swPath = '/sw.js') {
        if (!('serviceWorker' in navigator)) {
            console.log('浏览器不支持 Service Worker');
            return Promise.resolve(null);
        }

        return navigator.serviceWorker.register(swPath)
            .then(registration => {
                console.log('Service Worker 注册成功:', registration.scope);
                return registration;
            })
            .catch(error => {
                console.error('Service Worker 注册失败:', error);
                throw error;
            });
    }

    checkNetworkStatus() {
        return {
            isOnline: navigator.onLine,
            effectiveType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
            downlink: navigator.connection ? navigator.connection.downlink : 0,
            rtt: navigator.connection ? navigator.connection.rtt : 0
        };
    }

    onNetworkStatusChange(callback) {
        window.addEventListener('online', () => callback({ isOnline: true }));
        window.addEventListener('offline', () => callback({ isOnline: false }));
    }
}
