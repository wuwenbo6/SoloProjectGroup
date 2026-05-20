export async function encodeWAVAsync(
  audioData: Float32Array[],
  sampleRate: number,
  bitDepth: number = 16,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const numChannels = audioData.length;
  const numSamples = audioData[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  let offset = 44;
  const chunkSize = 50000;
  const totalChunks = Math.ceil(numSamples / chunkSize);
  
  for (let chunk = 0; chunk < totalChunks; chunk++) {
    const startSample = chunk * chunkSize;
    const endSample = Math.min(startSample + chunkSize, numSamples);
    
    if (bitDepth === 16) {
      for (let i = startSample; i < endSample; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, audioData[channel][i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }
    } else if (bitDepth === 24) {
      for (let i = startSample; i < endSample; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          const sample = Math.max(-1, Math.min(1, audioData[channel][i]));
          const value = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
          view.setInt8(offset, value & 0xFF);
          view.setInt8(offset + 1, (value >> 8) & 0xFF);
          view.setInt8(offset + 2, (value >> 16) & 0xFF);
          offset += 3;
        }
      }
    } else if (bitDepth === 32) {
      for (let i = startSample; i < endSample; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
          view.setFloat32(offset, audioData[channel][i], true);
          offset += 4;
        }
      }
    }
    
    if (onProgress && chunk % 5 === 0) {
      onProgress(((chunk + 1) / totalChunks) * 100);
    }
    
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  if (onProgress) {
    onProgress(100);
  }
  
  return buffer;
}

export function encodeWAV(
  audioData: Float32Array[],
  sampleRate: number,
  bitDepth: number = 16
): ArrayBuffer {
  const numChannels = audioData.length;
  const numSamples = audioData[0].length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  let offset = 44;
  
  if (bitDepth === 16) {
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioData[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioData[channel][i]));
        const value = sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF;
        view.setInt8(offset, value & 0xFF);
        view.setInt8(offset + 1, (value >> 8) & 0xFF);
        view.setInt8(offset + 2, (value >> 16) & 0xFF);
        offset += 3;
      }
    }
  } else if (bitDepth === 32) {
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        view.setFloat32(offset, audioData[channel][i], true);
        offset += 4;
      }
    }
  }
  
  return buffer;
}

export function decodeWAV(arrayBuffer: ArrayBuffer): {
  audioData: Float32Array[];
  sampleRate: number;
  bitDepth: number;
} {
  const view = new DataView(arrayBuffer);
  
  if (readString(view, 0, 4) !== 'RIFF' || readString(view, 8, 4) !== 'WAVE') {
    throw new Error('Invalid WAV file');
  }
  
  let offset = 12;
  let audioFormat = 1;
  let numChannels = 2;
  let sampleRate = 44100;
  let bitDepth = 16;
  let dataOffset = 0;
  let dataSize = 0;
  
  while (offset < arrayBuffer.byteLength) {
    const chunkId = readString(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    
    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitDepth = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    
    offset += 8 + chunkSize;
  }
  
  const bytesPerSample = bitDepth / 8;
  const numSamples = dataSize / (numChannels * bytesPerSample);
  const audioData: Float32Array[] = [];
  
  for (let i = 0; i < numChannels; i++) {
    audioData.push(new Float32Array(numSamples));
  }
  
  offset = dataOffset;
  
  if (bitDepth === 16) {
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = view.getInt16(offset, true);
        audioData[channel][i] = sample < 0 ? sample / 0x8000 : sample / 0x7FFF;
        offset += 2;
      }
    }
  } else if (bitDepth === 24) {
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const b1 = view.getUint8(offset);
        const b2 = view.getUint8(offset + 1);
        const b3 = view.getUint8(offset + 2);
        const sample = (b3 << 16) | (b2 << 8) | b1;
        const signed = sample & 0x800000 ? sample - 0x1000000 : sample;
        audioData[channel][i] = signed / 0x7FFFFF;
        offset += 3;
      }
    }
  } else if (bitDepth === 32 && audioFormat === 3) {
    for (let i = 0; i < numSamples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        audioData[channel][i] = view.getFloat32(offset, true);
        offset += 4;
      }
    }
  }
  
  return { audioData, sampleRate, bitDepth };
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function readString(view: DataView, offset: number, length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += String.fromCharCode(view.getUint8(offset + i));
  }
  return result;
}
