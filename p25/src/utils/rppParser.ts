import {
  RppNode,
  RppProject,
  RppTrack,
  RppPlugin,
  RppItem,
  RppAutomation,
  RppAutomationPoint,
  RppMidiNote,
} from '../types'

export function parseRpp(content: string): RppProject {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const ast = parseToAst(lines)
  return convertToProject(ast)
}

function parseToAst(lines: string[]): RppNode[] {
  const stack: RppNode[] = []
  const root: RppNode[] = []
  let currentParent: RppNode[] = root

  for (const line of lines) {
    if (line.startsWith('<')) {
      const match = line.match(/<(\S+)(?:\s+(.*))?/)
      if (match) {
        const [, tag, rest] = match
        const attributes = parseAttributes(rest || '')
        const node: RppNode = { tag, attributes, children: [] }

        currentParent.push(node)
        stack.push(node)
        currentParent = node.children
      }
    } else if (line.startsWith('>')) {
      stack.pop()
      currentParent = stack.length > 0
        ? stack[stack.length - 1].children
        : root
    } else {
      const parts = line.split(/\s+/)
      if (parts.length > 0) {
        const tag = parts[0]
        const attributes = parts.slice(1)
        currentParent.push({ tag, attributes, children: [] })
      }
    }
  }

  return root
}

function parseAttributes(attrStr: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < attrStr.length; i++) {
    const char = attrStr[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ' ' && !inQuotes) {
      if (current.length > 0) {
        result.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current.length > 0) {
    result.push(current)
  }

  return result
}

function convertToProject(ast: RppNode[]): RppProject {
  const projectNode = ast.find((n) => n.tag === 'REAPER_PROJECT') || ast[0]

  let bpm = 120
  let sampleRate = 44100
  let timeSignature: [number, number] = [4, 4]
  let duration = 0

  if (projectNode) {
    const tempoNode = findNode(projectNode, 'TEMPO')
    if (tempoNode && tempoNode.attributes.length > 0) {
      bpm = parseFloat(tempoNode.attributes[0]) || 120
    }

    const samplerateNode = findNode(projectNode, 'SAMPLERATE')
    if (samplerateNode && samplerateNode.attributes.length > 0) {
      sampleRate = parseFloat(samplerateNode.attributes[0]) || 44100
    }

    const tsNode = findNode(projectNode, 'TIMESIG')
    if (tsNode && tsNode.attributes.length >= 2) {
      timeSignature = [
        parseInt(tsNode.attributes[0]) || 4,
        parseInt(tsNode.attributes[1]) || 4,
      ]
    }
  }

  const trackNodes = findAllNodes(projectNode || { tag: '', attributes: [], children: ast }, 'TRACK')
  const tracks = trackNodes.map((node, idx) => convertTrack(node, idx))

  for (const track of tracks) {
    for (const item of track.items) {
      if (item.endTime > duration) {
        duration = item.endTime
      }
    }
  }

  return {
    name: 'Imported Project',
    bpm,
    sampleRate,
    timeSignature,
    tracks,
    duration,
  }
}

function convertTrack(node: RppNode, index: number): RppTrack {
  let name = `Track ${index + 1}`
  let volume = 1
  let pan = 0
  let muted = false
  let solo = false
  let color = '#6B7280'

  const nameNode = findNode(node, 'NAME')
  if (nameNode && nameNode.attributes.length > 0) {
    name = nameNode.attributes[0].replace(/"/g, '')
  }

  const volPanNode = findNode(node, 'VOLPAN')
  if (volPanNode && volPanNode.attributes.length >= 2) {
    volume = parseFloat(volPanNode.attributes[0]) || 1
    pan = parseFloat(volPanNode.attributes[1]) || 0
  }

  const muteNode = findNode(node, 'MUTE')
  if (muteNode && muteNode.attributes.length > 0) {
    muted = muteNode.attributes[0] === '1'
  }

  const soloNode = findNode(node, 'SOLO')
  if (soloNode && soloNode.attributes.length > 0) {
    solo = soloNode.attributes[0] === '1'
  }

  const colorNode = findNode(node, 'COLOR')
  if (colorNode && colorNode.attributes.length > 0) {
    color = reaperColorToHex(parseInt(colorNode.attributes[0]))
  }

  const pluginNodes = findAllNodes(node, 'FXCHAIN')
  const plugins = pluginNodes.flatMap((fxNode) =>
    findAllNodes(fxNode, 'VST').map((vstNode, idx) => convertPlugin(vstNode, idx))
  )

  const itemNodes = findAllNodes(node, 'ITEM')
  const items = itemNodes.map((itemNode) => convertItem(itemNode))

  const automation: RppAutomation[] = []
  const envNodes = findAllNodes(node, 'FXENV')
  for (const envNode of envNodes) {
    const param = envNode.attributes[0] || 'volume'
    const points: RppAutomationPoint[] = []
    const ptNodes = findAllNodes(envNode, 'PT')
    for (const ptNode of ptNodes) {
      if (ptNode.attributes.length >= 2) {
        points.push({
          time: parseFloat(ptNode.attributes[0]),
          value: parseFloat(ptNode.attributes[1]),
          curve: ptNode.attributes.length >= 3 ? parseFloat(ptNode.attributes[2]) : 0,
        })
      }
    }
    if (points.length > 0) {
      automation.push({ parameter: param, points })
    }
  }

  return {
    name,
    trackNumber: index + 1,
    volume,
    pan,
    muted,
    solo,
    color,
    plugins,
    items,
    automation,
  }
}

function convertPlugin(node: RppNode, position: number): RppPlugin {
  let name = 'Unknown Plugin'
  let vendor = 'Unknown'
  let bypassed = false
  let latency = 0

  if (node.attributes.length >= 2) {
    name = node.attributes[0].replace(/"/g, '')
    vendor = node.attributes[1].replace(/"/g, '')
  }

  const bypassNode = findNode(node, 'BYPASS')
  if (bypassNode && bypassNode.attributes.length > 0) {
    bypassed = bypassNode.attributes[0] === '1'
  }

  const parameters: { [key: string]: number } = {}
  const paramNodes = findAllNodes(node, 'PARM')
  for (const paramNode of paramNodes) {
    if (paramNode.attributes.length >= 2) {
      const paramName = paramNode.attributes[0].replace(/"/g, '')
      const value = parseFloat(paramNode.attributes[1])
      parameters[paramName] = value
    }
  }

  return {
    name,
    vendor,
    bypassed,
    position,
    parameters,
    latency,
  }
}

function convertItem(node: RppNode): RppItem {
  let name = 'Item'
  let startTime = 0
  let endTime = 0
  let type: 'audio' | 'midi' = 'audio'
  let filePath: string | undefined

  const nameNode = findNode(node, 'NAME')
  if (nameNode && nameNode.attributes.length > 0) {
    name = nameNode.attributes[0].replace(/"/g, '')
  }

  const posNode = findNode(node, 'POSITION')
  if (posNode && posNode.attributes.length > 0) {
    startTime = parseFloat(posNode.attributes[0])
  }

  const lengthNode = findNode(node, 'LENGTH')
  if (lengthNode && lengthNode.attributes.length > 0) {
    endTime = startTime + parseFloat(lengthNode.attributes[0])
  }

  const sourceNode = findNode(node, 'SOURCE')
  if (sourceNode && sourceNode.attributes.length > 0) {
    const sourceType = sourceNode.attributes[0]
    if (sourceType === 'MIDI') {
      type = 'midi'
    }
  }

  const fileNode = findNode(node, 'FILE')
  if (fileNode && fileNode.attributes.length > 0) {
    filePath = fileNode.attributes[0].replace(/"/g, '')
  }

  const notes: RppMidiNote[] = []
  if (type === 'midi') {
    const evtNodes = findAllNodes(node, 'EVENT')
    for (const evtNode of evtNodes) {
      if (evtNode.attributes.length >= 4 && evtNode.attributes[0] === 'NOTE') {
        notes.push({
          noteNumber: parseInt(evtNode.attributes[1]),
          startTime: parseFloat(evtNode.attributes[2]),
          endTime: parseFloat(evtNode.attributes[3]),
          velocity: evtNode.attributes.length >= 5 ? parseInt(evtNode.attributes[4]) : 100,
        })
      }
    }
  }

  return {
    name,
    startTime,
    endTime,
    type,
    filePath,
    notes,
  }
}

function findNode(node: RppNode, tag: string): RppNode | undefined {
  if (node.tag === tag) return node
  for (const child of node.children) {
    const found = findNode(child, tag)
    if (found) return found
  }
  return undefined
}

function findAllNodes(node: RppNode, tag: string): RppNode[] {
  const results: RppNode[] = []
  if (node.tag === tag) results.push(node)
  for (const child of node.children) {
    results.push(...findAllNodes(child, tag))
  }
  return results
}

function reaperColorToHex(colorNum: number): string {
  if (isNaN(colorNum)) return '#6B7280'
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16',
    '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#78716C', '#6B7280',
  ]
  return colors[colorNum % colors.length] || '#6B7280'
}

export function generateTestRpp(): string {
  return `<REAPER_PROJECT 0.1 "6.0"
  <TEMPO 120
  >
  <SAMPLERATE 44100
  >
  <TIMESIG 4 4
  >
  <TRACK
    <NAME "Lead Vocal"
    >
    <VOLPAN 1 0
    >
    <COLOR 0
    >
    <MUTE 0
    >
    <SOLO 0
    >
    <FXCHAIN
      <VST "ReaEQ" "Cockos"
        <BYPASS 0
        >
        <PARM "Gain" 0.5
        >
        <PARM "Freq" 1000
        >
      >
    >
    <ITEM
      <NAME "Vocal Take 1"
      >
      <POSITION 0
      >
      <LENGTH 4.5
      >
      <SOURCE "MIDI"
      >
      <EVENT NOTE 60 0 0.5 100
      >
      <EVENT NOTE 64 0.5 1 90
      >
    >
  >
  <TRACK
    <NAME "Drums"
    >
    <VOLPAN 0.8 0
    >
    <COLOR 3
    >
    <MUTE 0
    >
    <SOLO 1
    >
    <ITEM
      <NAME "Kick Loop"
      >
      <POSITION 0
      >
      <LENGTH 8
      >
      <SOURCE "WAV"
      >
      <FILE "kick.wav"
      >
    >
  >
>
`
}
