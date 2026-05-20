import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

async function execCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr })
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

async function checkCompilerAvailable() {
  try {
    await execCommand('arm-none-eabi-gcc', ['--version'])
    return true
  } catch (e) {
    return false
  }
}

export async function compileCode(sourceCode, options = {}) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arm-compile-'))
  
  try {
    const srcFile = path.join(tmpDir, 'main.c')
    const outFile = path.join(tmpDir, 'output.elf')
    
    await fs.writeFile(srcFile, sourceCode)
    
    const args = [
      '-mcpu=cortex-m4',
      '-mthumb',
      '-mfloat-abi=hard',
      '-mfpu=fpv4-sp-d16',
      '-O0',
      '-g3',
      '-ffunction-sections',
      '-fdata-sections',
      '-Wall',
      '-Wextra',
      options.cFlags || '',
      srcFile,
      '-o', outFile,
      '-T', options.linkScript || 'default.ld',
      '-nostdlib',
      '-ffreestanding'
    ].filter(Boolean)
    
    try {
      await execCommand('arm-none-eabi-gcc', args, { cwd: tmpDir })
    } catch (e) {
      return {
        success: false,
        error: e.stderr || e.error?.message,
        stdout: e.stdout,
        stderr: e.stderr
      }
    }
    
    const elfBuffer = await fs.readFile(outFile)
    
    let sizeInfo = null
    try {
      const sizeResult = await execCommand('arm-none-eabi-size', ['-A', outFile])
      sizeInfo = sizeResult.stdout
    } catch (e) {
      sizeInfo = 'Size information unavailable'
    }
    
    return {
      success: true,
      elfBuffer: Buffer.from(elfBuffer).toString('base64'),
      sizeInfo,
      fileName: 'output.elf'
    }
    
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

export async function getCompilerInfo() {
  const available = await checkCompilerAvailable()
  if (!available) {
    return {
      available: false,
      version: 'Not installed'
    }
  }
  
  try {
    const result = await execCommand('arm-none-eabi-gcc', ['--version'])
    return {
      available: true,
      version: result.stdout.split('\n')[0]
    }
  } catch (e) {
    return {
      available: false,
      version: 'Error getting version'
    }
  }
}

export default {
  compileCode,
  getCompilerInfo,
  checkCompilerAvailable
}
