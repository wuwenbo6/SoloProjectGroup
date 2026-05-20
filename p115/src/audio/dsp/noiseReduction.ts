import { FFT, createHann, applyWindow } from '../../utils/fft';


export function estimateNoiseProfile(
  noiseSamples: Float32Array,
  fftSize: number = 2048
): Float32Array {
  const window = createHann(fftSize);
  const hopSize = fftSize / 2;
  const numFrames = Math.floor((noiseSamples.length - fftSize) / hopSize) + 1;
  const noiseProfile = new Float32Array(fftSize / 2 + 1).fill(0);
  
  const fft = new FFT(fftSize);
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = noiseSamples.slice(start, start + fftSize);
    const windowed = applyWindow(frame, window);
    
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    for (let j = 0; j < fftSize; j++) {
      real[j] = windowed[j];
    }
    
    fft.transform(real, imag);
    
    for (let j = 0; j <= fftSize / 2; j++) {
      const magnitude = Math.sqrt(real[j] * real[j] + imag[j] * imag[j]);
      noiseProfile[j] += magnitude;
    }
  }
  
  for (let i = 0; i < noiseProfile.length; i++) {
    noiseProfile[i] /= numFrames;
  }
  
  return noiseProfile;
}

export function spectralSubtraction(
  samples: Float32Array,
  noiseProfile: Float32Array,
  strength: number = 50,
  fftSize: number = 2048
): Float32Array {
  const window = createHann(fftSize);
  const hopSize = fftSize / 2;
  const numFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
  const result = new Float32Array(samples.length).fill(0);
  
  const alpha = 1 + strength / 50;
  const beta = 0.01;
  
  const fft = new FFT(fftSize);
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = samples.slice(start, start + fftSize);
    const windowed = applyWindow(frame, window);
    
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    for (let j = 0; j < fftSize; j++) {
      real[j] = windowed[j];
    }
    
    fft.transform(real, imag);
    
    for (let j = 0; j <= fftSize / 2; j++) {
      const magnitude = Math.sqrt(real[j] * real[j] + imag[j] * imag[j]);
      const phase = Math.atan2(imag[j], real[j]);
      
      let newMagnitude = magnitude - alpha * noiseProfile[j];
      newMagnitude = Math.max(newMagnitude, beta * magnitude);
      
      real[j] = newMagnitude * Math.cos(phase);
      imag[j] = newMagnitude * Math.sin(phase);
      
      if (j > 0 && j < fftSize / 2) {
        real[fftSize - j] = newMagnitude * Math.cos(phase);
        imag[fftSize - j] = -newMagnitude * Math.sin(phase);
      }
    }
    
    fft.inverse(real, imag);
    
    for (let j = 0; j < fftSize; j++) {
      if (start + j < result.length) {
        result[start + j] += real[j] * window[j];
      }
    }
  }
  
  return result;
}

export function reduceNoise(
  samples: Float32Array,
  noiseSampleStart: number = 0,
  noiseSampleDuration: number = 0.5,
  sampleRate: number = 44100,
  strength: number = 50
): Float32Array {
  const noiseStartIdx = Math.floor(noiseSampleStart * sampleRate);
  const noiseEndIdx = Math.floor((noiseSampleStart + noiseSampleDuration) * sampleRate);
  const noiseSamples = samples.slice(noiseStartIdx, noiseEndIdx);
  
  const noiseProfile = estimateNoiseProfile(noiseSamples);
  
  return spectralSubtraction(samples, noiseProfile, strength);
}
