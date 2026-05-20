import type { PluginInstance, PluginParameter } from './database/types'

export interface AudioChainProcessor {
  sampleRate: number
  bufferSize: number
  plugins: PluginInstance[]
}

export function createChainProcessor(
  sampleRate: number,
  bufferSize: number
): AudioChainProcessor {
  return {
    sampleRate,
    bufferSize,
    plugins: [],
  }
}

export function addPluginToChain(
  processor: AudioChainProcessor,
  plugin: PluginInstance
): AudioChainProcessor {
  const newPlugins = [...processor.plugins, plugin]
  newPlugins.sort((a, b) => a.position - b.position)

  return {
    ...processor,
    plugins: newPlugins,
  }
}

export function removePluginFromChain(
  processor: AudioChainProcessor,
  pluginInstanceId: string
): AudioChainProcessor {
  return {
    ...processor,
    plugins: processor.plugins.filter((p) => p.id !== pluginInstanceId),
  }
}

export function reorderPluginInChain(
  processor: AudioChainProcessor,
  pluginInstanceId: string,
  newPosition: number
): AudioChainProcessor {
  const plugins = processor.plugins.map((p) => {
    if (p.id === pluginInstanceId) {
      return { ...p, position: newPosition }
    }
    return p
  })

  plugins.sort((a, b) => a.position - b.position)

  return {
    ...processor,
    plugins,
  }
}

export function setPluginBypass(
  processor: AudioChainProcessor,
  pluginInstanceId: string,
  bypassed: boolean
): AudioChainProcessor {
  return {
    ...processor,
    plugins: processor.plugins.map((p) =>
      p.id === pluginInstanceId ? { ...p, bypassed } : p
    ),
  }
}

export function updatePluginParameter(
  processor: AudioChainProcessor,
  pluginInstanceId: string,
  paramId: number,
  value: number
): AudioChainProcessor {
  return {
    ...processor,
    plugins: processor.plugins.map((p) => {
      if (p.id === pluginInstanceId) {
        const params = p.parameters.map((param) =>
          param.id === paramId ? { ...param, value, normalized: value } : param
        )
        return { ...p, parameters: params }
      }
      return p
    }),
  }
}

export function processAudioChain(
  processor: AudioChainProcessor,
  input: Float32Array[],
  output: Float32Array[]
): void {
  const numChannels = Math.min(input.length, output.length)
  const numSamples = Math.min(input[0]?.length || 0, output[0]?.length || 0)

  for (let ch = 0; ch < numChannels; ch++) {
    for (let i = 0; i < numSamples; i++) {
      output[ch][i] = input[ch]?.[i] || 0
    }
  }

  for (const plugin of processor.plugins) {
    if (plugin.bypassed) continue

    for (let ch = 0; ch < numChannels; ch++) {
      for (let i = 0; i < numSamples; i++) {
        const gain = plugin.parameters.find((p) => p.id === 0)?.value || 1
        output[ch][i] *= Math.max(0.1, Math.min(2, gain))
      }
    }
  }
}

export function getChainPluginParameters(
  processor: AudioChainProcessor,
  pluginInstanceId: string
): PluginParameter[] | null {
  const plugin = processor.plugins.find((p) => p.id === pluginInstanceId)
  return plugin?.parameters || null
}

export function exportChainState(processor: AudioChainProcessor) {
  return {
    sampleRate: processor.sampleRate,
    bufferSize: processor.bufferSize,
    plugins: processor.plugins.map((p) => ({
      id: p.id,
      pluginId: p.pluginId,
      name: p.name,
      bypassed: p.bypassed,
      parameters: p.parameters,
      position: p.position,
    })),
  }
}
