import fs from 'fs/promises'
import type { PluginParameter } from '../database/types'

export interface FxbHeader {
  magic: string
  version: number
  fxMagic: string
  numPrograms: number
  currentProgram: number
  future: string
  name: string
  chunkMagic?: string
  chunkSize?: number
  chunkVersion?: number
  uniqueId: number
  fxVersion: number
  numParams: number
  programName: string
}

export interface FxbProgram {
  name: string
  chunk?: Buffer
  params?: number[]
}

export interface FxbFile {
  header: FxbHeader
  programs: FxbProgram[]
}

const FX_MAGIC = 'CcnK'
const FXB_MAGIC = 'FxBk'
const FXP_MAGIC = 'FxCk'
const CHUNK_MAGIC = 'FxCk'

export function parseFxb(buffer: Buffer): FxbFile {
  let offset = 0

  const magic = buffer.toString('ascii', offset, offset + 4)
  offset += 4

  if (magic !== FX_MAGIC) {
    throw new Error(`Invalid FX magic: ${magic}`)
  }

  const size = buffer.readUInt32BE(offset)
  offset += 4

  const fxMagic = buffer.toString('ascii', offset, offset + 4)
  offset += 4

  if (fxMagic !== FXB_MAGIC) {
    throw new Error(`Invalid FXB magic: ${fxMagic}`)
  }

  const version = buffer.readUInt32BE(offset)
  offset += 4

  const fxId = buffer.readUInt32BE(offset)
  offset += 4

  const fxVersion = buffer.readUInt32BE(offset)
  offset += 4

  const numPrograms = buffer.readUInt32BE(offset)
  offset += 4

  const name = buffer.toString('ascii', offset, offset + 28).replace(/\0/g, '')
  offset += 28

  const currentProgram = buffer.readInt32BE(offset)
  offset += 4

  const future = buffer.toString('ascii', offset, offset + 124)
  offset += 124

  const programs: FxbProgram[] = []

  for (let i = 0; i < numPrograms; i++) {
    const programMagic = buffer.toString('ascii', offset, offset + 4)
    offset += 4

    if (programMagic === 'FxCk') {
      const programSize = buffer.readUInt32BE(offset)
      offset += 4

      const programVersion = buffer.readUInt32BE(offset)
      offset += 4

      const programFxId = buffer.readUInt32BE(offset)
      offset += 4

      const programFxVersion = buffer.readUInt32BE(offset)
      offset += 4

      const numParams = buffer.readUInt32BE(offset)
      offset += 4

      const programName = buffer.toString('ascii', offset, offset + 28).replace(/\0/g, '')
      offset += 28

      const params: number[] = []
      for (let p = 0; p < numParams; p++) {
        params.push(buffer.readFloatBE(offset))
        offset += 4
      }

      programs.push({
        name: programName,
        params,
      })
    } else if (programMagic === 'FPCh') {
      const chunkSize = buffer.readUInt32BE(offset)
      offset += 4

      const chunkVersion = buffer.readUInt32BE(offset)
      offset += 4

      const chunkFxId = buffer.readUInt32BE(offset)
      offset += 4

      const chunkFxVersion = buffer.readUInt32BE(offset)
      offset += 4

      const numProgramsInChunk = buffer.readUInt32BE(offset)
      offset += 4

      const programName = buffer.toString('ascii', offset, offset + 28).replace(/\0/g, '')
      offset += 28

      const chunk = buffer.slice(offset, offset + chunkSize)
      offset += chunkSize

      programs.push({
        name: programName,
        chunk,
      })
    } else {
      throw new Error(`Unknown program magic: ${programMagic}`)
    }
  }

  return {
    header: {
      magic: FX_MAGIC,
      version,
      fxMagic: FXB_MAGIC,
      numPrograms,
      currentProgram,
      future,
      name,
      uniqueId: fxId,
      fxVersion,
      numParams: programs[0]?.params?.length || 0,
      programName: programs[0]?.name || '',
    },
    programs,
  }
}

export function serializeFxb(fxb: FxbFile): Buffer {
  const buffers: Buffer[] = []

  buffers.push(Buffer.from(FX_MAGIC, 'ascii'))

  const sizePos = buffers.length
  buffers.push(Buffer.alloc(4))

  buffers.push(Buffer.from(FXB_MAGIC, 'ascii'))

  const versionBuf = Buffer.alloc(4)
  versionBuf.writeUInt32BE(fxb.header.version, 0)
  buffers.push(versionBuf)

  const uniqueIdBuf = Buffer.alloc(4)
  uniqueIdBuf.writeUInt32BE(fxb.header.uniqueId, 0)
  buffers.push(uniqueIdBuf)

  const fxVersionBuf = Buffer.alloc(4)
  fxVersionBuf.writeUInt32BE(fxb.header.fxVersion, 0)
  buffers.push(fxVersionBuf)

  const numProgramsBuf = Buffer.alloc(4)
  numProgramsBuf.writeUInt32BE(fxb.header.numPrograms, 0)
  buffers.push(numProgramsBuf)

  const nameBuf = Buffer.alloc(28)
  nameBuf.write(fxb.header.name.substring(0, 27), 0, 'ascii')
  buffers.push(nameBuf)

  const currentProgramBuf = Buffer.alloc(4)
  currentProgramBuf.writeInt32BE(fxb.header.currentProgram, 0)
  buffers.push(currentProgramBuf)

  const futureBuf = Buffer.alloc(124)
  futureBuf.write(fxb.header.future || '', 0, 'ascii')
  buffers.push(futureBuf)

  for (const program of fxb.programs) {
    if (program.params) {
      buffers.push(Buffer.from('FxCk', 'ascii'))

      const paramsSize = program.params.length * 4
      const programSize = 4 + 4 + 4 + 28 + paramsSize
      const sizeBuf = Buffer.alloc(4)
      sizeBuf.writeUInt32BE(programSize, 0)
      buffers.push(sizeBuf)

      const versionBuf = Buffer.alloc(4)
      versionBuf.writeUInt32BE(1, 0)
      buffers.push(versionBuf)

      buffers.push(uniqueIdBuf)
      buffers.push(fxVersionBuf)

      const numParamsBuf = Buffer.alloc(4)
      numParamsBuf.writeUInt32BE(program.params.length, 0)
      buffers.push(numParamsBuf)

      const programNameBuf = Buffer.alloc(28)
      programNameBuf.write(program.name.substring(0, 27), 0, 'ascii')
      buffers.push(programNameBuf)

      for (const param of program.params) {
        const paramBuf = Buffer.alloc(4)
        paramBuf.writeFloatBE(param, 0)
        buffers.push(paramBuf)
      }
    } else if (program.chunk) {
      buffers.push(Buffer.from('FPCh', 'ascii'))

      const chunkSizeBuf = Buffer.alloc(4)
      chunkSizeBuf.writeUInt32BE(program.chunk.length, 0)
      buffers.push(chunkSizeBuf)

      const versionBuf = Buffer.alloc(4)
      versionBuf.writeUInt32BE(1, 0)
      buffers.push(versionBuf)

      buffers.push(uniqueIdBuf)
      buffers.push(fxVersionBuf)

      const numProgramsBuf = Buffer.alloc(4)
      numProgramsBuf.writeUInt32BE(1, 0)
      buffers.push(numProgramsBuf)

      const programNameBuf = Buffer.alloc(28)
      programNameBuf.write(program.name.substring(0, 27), 0, 'ascii')
      buffers.push(programNameBuf)

      buffers.push(program.chunk)
    }
  }

  const totalSize = buffers.reduce((sum, buf) => sum + buf.length, 0) - 8
  buffers[sizePos].writeUInt32BE(totalSize, 0)

  return Buffer.concat(buffers)
}

export async function readFxbFile(filePath: string): Promise<FxbFile> {
  const buffer = await fs.readFile(filePath)
  return parseFxb(buffer)
}

export async function writeFxbFile(filePath: string, fxb: FxbFile): Promise<void> {
  const buffer = serializeFxb(fxb)
  await fs.writeFile(filePath, buffer)
}

export function fxbToParameters(fxb: FxbFile, programIndex: number = 0): PluginParameter[] {
  const program = fxb.programs[programIndex]
  if (!program || !program.params) {
    return []
  }

  return program.params.map((value, index) => ({
    id: index,
    name: `Param ${index + 1}`,
    value,
    normalized: value,
    min: 0,
    max: 1,
  }))
}

export function parametersToFxb(
  parameters: PluginParameter[],
  name: string,
  pluginUniqueId: number = 0x50323544
): FxbFile {
  const params = parameters.map((p) => p.normalized ?? p.value)

  return {
    header: {
      magic: FX_MAGIC,
      version: 1,
      fxMagic: FXB_MAGIC,
      numPrograms: 1,
      currentProgram: 0,
      future: '',
      name: name.substring(0, 27),
      uniqueId: pluginUniqueId,
      fxVersion: 1,
      numParams: params.length,
      programName: name.substring(0, 27),
    },
    programs: [
      {
        name: name.substring(0, 27),
        params,
      },
    ],
  }
}
