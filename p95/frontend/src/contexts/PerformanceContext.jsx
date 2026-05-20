import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react'

const PerformanceContext = createContext()

const CACHE_TTL = 5 * 60 * 1000

export const PerformanceProvider = ({ children }) => {
  const cacheRef = useRef({})
  const pendingRequestsRef = useRef({})

  const getCachedData = useCallback((key) => {
    const cacheEntry = cacheRef.current[key]
    if (!cacheEntry) return null

    const now = Date.now()
    if (now - cacheEntry.timestamp > CACHE_TTL) {
      delete cacheRef.current[key]
      return null
    }

    return cacheEntry.data
  }, [])

  const setCachedData = useCallback((key, data) => {
    cacheRef.current[key] = {
      data,
      timestamp: Date.now()
    }
  }, [])

  const invalidateCache = useCallback((keyPattern) => {
    if (!keyPattern) {
      cacheRef.current = {}
      return
    }

    Object.keys(cacheRef.current).forEach((key) => {
      if (key.includes(keyPattern)) {
        delete cacheRef.current[key]
      }
    })
  }, [])

  const fetchWithCache = useCallback(async (key, fetchFn, options = {}) => {
    const { forceRefresh = false, ttl = CACHE_TTL } = options

    if (!forceRefresh) {
      const cached = getCachedData(key)
      if (cached) {
        return cached
      }
    }

    if (pendingRequestsRef.current[key]) {
      return pendingRequestsRef.current[key]
    }

    try {
      const promise = fetchFn()
      pendingRequestsRef.current[key] = promise

      const data = await promise
      cacheRef.current[key] = {
        data,
        timestamp: Date.now(),
        ttl
      }

      return data
    } finally {
      delete pendingRequestsRef.current[key]
    }
  }, [getCachedData])

  const prefetch = useCallback((key, fetchFn) => {
    if (!getCachedData(key)) {
      fetchWithCache(key, fetchFn).catch(() => {})
    }
  }, [fetchWithCache, getCachedData])

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      Object.keys(cacheRef.current).forEach((key) => {
        const entry = cacheRef.current[key]
        const ttl = entry.ttl || CACHE_TTL
        if (now - entry.timestamp > ttl) {
          delete cacheRef.current[key]
        }
      })
    }, 60 * 1000)

    return () => clearInterval(cleanupInterval)
  }, [])

  const value = {
    getCachedData,
    setCachedData,
    invalidateCache,
    fetchWithCache,
    prefetch
  }

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  )
}

export const usePerformance = () => {
  const context = useContext(PerformanceContext)
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider')
  }
  return context
}

export default PerformanceContext
