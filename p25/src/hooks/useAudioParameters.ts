import { useState, useEffect, useCallback, useRef } from 'react'

export interface PluginParamChange {
  pluginId: string
  paramId: number
  value: number
  normalized: number
}

interface PluginParameters {
  [pluginId: string]: Map<number, number>
}

export function useAudioParameters() {
  const [parameters, setParameters] = useState<PluginParameters>({})
  const pendingUpdates = useRef<Map<string, Map<number, number>>>(new Map())
  const isBatching = useRef(false)

  useEffect(() => {
    if (!window.audioAPI) return

    const cleanup = window.audioAPI.onParamsUpdated(({ pluginId, changes }) => {
      for (const change of changes) {
        if (!pendingUpdates.current.has(pluginId)) {
          pendingUpdates.current.set(pluginId, new Map())
        }
        pendingUpdates.current.get(pluginId)!.set(change.paramId, change.value)
      }

      if (!isBatching.current) {
        isBatching.current = true
        requestAnimationFrame(() => {
          flushUpdates()
          isBatching.current = false
        })
      }
    })

    return cleanup
  }, [])

  const flushUpdates = useCallback(() => {
    if (pendingUpdates.current.size === 0) return

    setParameters((prev) => {
      const next = { ...prev }
      for (const [pluginId, params] of pendingUpdates.current.entries()) {
        if (!next[pluginId]) {
          next[pluginId] = new Map()
        }
        for (const [paramId, value] of params.entries()) {
          next[pluginId].set(paramId, value)
        }
      }
      return next
    })

    pendingUpdates.current.clear()
  }, [])

  const setParameter = useCallback(async (pluginId: string, paramId: number, value: number) => {
    if (!window.audioAPI) return { success: false }
    return window.audioAPI.setParameter(pluginId, paramId, value)
  }, [])

  const getParameter = useCallback(
    (pluginId: string, paramId: number): number | undefined => {
      return parameters[pluginId]?.get(paramId)
    },
    [parameters]
  )

  const getPluginParameters = useCallback(
    (pluginId: string): Map<number, number> | undefined => {
      return parameters[pluginId]
    },
    [parameters]
  )

  return {
    parameters,
    setParameter,
    getParameter,
    getPluginParameters,
  }
}

export function usePluginParameter(pluginId: string, paramId: number) {
  const { getParameter, setParameter } = useAudioParameters()
  const value = getParameter(pluginId, paramId) ?? 0.5

  const setValue = useCallback(
    (newValue: number) => {
      return setParameter(pluginId, paramId, newValue)
    },
    [pluginId, paramId, setParameter]
  )

  return [value, setValue] as const
}
