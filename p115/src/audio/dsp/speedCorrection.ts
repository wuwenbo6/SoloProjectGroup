import { detectAveragePitch } from './pitchDetection';

export function resampleSimple(
  samples: Float32Array,
  speedRatio: number
): Float32Array {
  const inputLength = samples.length;
  const outputLength = Math.floor(inputLength / speedRatio);
  const result = new Float32Array(outputLength);
  
  for (let i = 0; i < outputLength; i++) {
    const pos = i * speedRatio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    
    if (idx >= inputLength - 1) {
      result[i] = samples[inputLength - 1];
    } else {
      result[i] = samples[idx] * (1 - frac) + samples[idx + 1] * frac;
    }
  }
  
  return result;
}

function detectSpeedRatioMultiRegion(
  samples: Float32Array,
  sampleRate: number,
  targetPitch: number = 440
): number {
  const numRegions = 5;
  const regionSize = Math.floor(samples.length / numRegions);
  const ratios: number[] = [];
  
  for (let i = 0; i < numRegions; i++) {
    const start = i * regionSize;
    const end = Math.min(start + regionSize, samples.length);
    const region = samples.slice(start, end);
    const detectedPitch = detectAveragePitch(region, sampleRate);
    const ratio = detectedPitch / targetPitch;
    
    if (ratio >= 0.8 && ratio <= 1.2) {
      ratios.push(ratio);
    }
  }
  
  if (ratios.length === 0) {
    return 1.0;
  }
  
  ratios.sort((a, b) => a - b);
  
  const median = ratios[Math.floor(ratios.length / 2)];
  
  const filtered = ratios.filter(r => Math.abs(r - median) < 0.05);
  
  if (filtered.length === 0) {
    return median;
  }
  
  return filtered.reduce((a, b) => a + b, 0) / filtered.length;
}

export function correctSpeedByPitch(
  samples: Float32Array,
  sampleRate: number,
  targetPitch: number = 440,
  preservePitch: boolean = true
): {
  corrected: Float32Array;
  speedRatio: number;
  detectedPitch: number;
} {
  const speedRatio = detectSpeedRatioMultiRegion(samples, sampleRate, targetPitch);
  const detectedPitch = speedRatio * targetPitch;
  
  let corrected: Float32Array;
  
  if (preservePitch) {
    corrected = phaseVocoder(samples, sampleRate, speedRatio);
  } else {
    corrected = resampleSimple(samples, speedRatio);
  }
  
  return { corrected, speedRatio, detectedPitch };
}

function phaseVocoder(
  samples: Float32Array,
  sampleRate: number,
  speedRatio: number
): Float32Array {
  const fftSize = 2048;
  const hopSize = 512;
  const window = createHannWindow(fftSize);
  
  const numInputFrames = Math.floor((samples.length - fftSize) / hopSize) + 1;
  const outputHopSize = Math.floor(hopSize * speedRatio);
  const outputLength = Math.floor(samples.length * speedRatio);
  const result = new Float32Array(outputLength).fill(0);
  
  let phaseAccum = new Float32Array(fftSize / 2 + 1);
  let lastPhase = new Float32Array(fftSize / 2 + 1);
  
  for (let i = 0; i < numInputFrames; i++) {
    const inputStart = i * hopSize;
    const frame = new Float32Array(fftSize);
    
    for (let j = 0; j < fftSize && inputStart + j < samples.length; j++) {
      frame[j] = samples[inputStart + j] * window[j];
    }
    
    const { magnitude, phase } = rfft(frame);
    
    if (i > 0) {
      for (let j = 0; j < phase.length; j++) {
        let deltaPhase = phase[j] - lastPhase[j];
        deltaPhase -= Math.round(deltaPhase / (2 * Math.PI)) * 2 * Math.PI;
        
        const binFreq = (j / fftSize) * sampleRate;
        const expectedPhase = (2 * Math.PI * binFreq * hopSize) / sampleRate;
        const trueFreq = binFreq + (deltaPhase - expectedPhase) * sampleRate / (2 * Math.PI * hopSize);
        
        phaseAccum[j] += (2 * Math.PI * trueFreq * outputHopSize) / sampleRate;
      }
    } else {
      phaseAccum.set(phase);
    }
    
    lastPhase.set(phase);
    
    const synthReal = new Float32Array(fftSize);
    const synthImag = new Float32Array(fftSize);
    
    for (let j = 0; j < magnitude.length; j++) {
      synthReal[j] = magnitude[j] * Math.cos(phaseAccum[j]);
      synthImag[j] = magnitude[j] * Math.sin(phaseAccum[j]);
      
      if (j > 0 && j < fftSize / 2) {
        synthReal[fftSize - j] = magnitude[j] * Math.cos(phaseAccum[j]);
        synthImag[fftSize - j] = -magnitude[j] * Math.sin(phaseAccum[j]);
      }
    }
    
    const inverse = irfft(synthReal, synthImag);
    
    const outputStart = i * outputHopSize;
    for (let j = 0; j < fftSize && outputStart + j < result.length; j++) {
      result[outputStart + j] += inverse[j] * window[j];
    }
  }
  
  let max = 0;
  for (let i = 0; i < result.length; i++) {
    max = Math.max(max, Math.abs(result[i]));
  }
  if (max > 0) {
    for (let i = 0; i < result.length; i++) {
      result[i] /= max;
    }
  }
  
  return result;
}

function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
  }
  return window;
}

function rfft(samples: Float32Array): { magnitude: Float32Array; phase: Float32Array } {
  const n = samples.length;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  real.set(samples);
  
  fft(real, imag);
  
  const magnitude = new Float32Array(n / 2 + 1);
  const phase = new Float32Array(n / 2 + 1);
  
  for (let i = 0; i <= n / 2; i++) {
    magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    phase[i] = Math.atan2(imag[i], real[i]);
  }
  
  return { magnitude, phase };
}

function irfft(real: Float32Array, imag: Float32Array): Float32Array {
  ifft(real, imag);
  return real;
}

function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  
  let j = 0;
  for (let i = 1; i < n - 1; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  
  for (let mmax = 1, istep = 2 * mmax; mmax < n; mmax = istep, istep = 2 * mmax) {
    for (let m = 0; m < mmax; m++) {
      const w = (Math.PI * m) / mmax;
      const wr = Math.cos(w);
      const wi = -Math.sin(w);
      
      for (let i = m; i < n; i += istep) {
        const j = i + mmax;
        const tr = wr * real[j] - wi * imag[j];
        const ti = wr * imag[j] + wi * real[j];
        real[j] = real[i] - tr;
        imag[j] = imag[i] - ti;
        real[i] += tr;
        imag[i] += ti;
      }
    }
  }
}

function ifft(real: Float32Array, imag: Float32Array): void {
  for (let i = 0; i < real.length; i++) {
    imag[i] = -imag[i];
  }
  fft(real, imag);
  for (let i = 0; i < real.length; i++) {
    real[i] /= real.length;
    imag[i] /= -real.length;
  }
}
