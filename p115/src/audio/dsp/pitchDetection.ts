export function autocorrelationFast(samples: Float32Array, maxLag: number): Float32Array {
  const n = samples.length;
  const result = new Float32Array(maxLag + 1);
  
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const centered = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    centered[i] = samples[i] - mean;
  }
  
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += centered[i] * centered[i + lag];
    }
    result[lag] = sum / (n - lag);
  }
  
  return result;
}

function parabolicInterpolation(ac: Float32Array, peak: number): number {
  if (peak <= 0 || peak >= ac.length - 1) return peak;
  
  const y0 = ac[peak - 1];
  const y1 = ac[peak];
  const y2 = ac[peak + 1];
  
  const denominator = y0 + y2 - 2 * y1;
  if (Math.abs(denominator) < 1e-10) return peak;
  
  return peak + (y0 - y2) / (2 * denominator);
}

export function detectPitch(
  samples: Float32Array,
  sampleRate: number,
  minFreq: number = 20,
  maxFreq: number = 3000
): number | null {
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);
  
  const ac = autocorrelationFast(samples, maxLag);
  
  let bestPeak = -1;
  let bestValue = -Infinity;
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] > ac[lag + 1]) {
      if (ac[lag] > bestValue) {
        bestValue = ac[lag];
        bestPeak = lag;
      }
    }
  }
  
  if (bestPeak < 0 || bestValue < 0.01 * ac[0]) {
    return null;
  }
  
  const interpolatedPeak = parabolicInterpolation(ac, bestPeak);
  
  return sampleRate / interpolatedPeak;
}

function medianFilter(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(values.length, i + halfWindow + 1);
    const window = values.slice(start, end).sort((a, b) => a - b);
    const median = window[Math.floor(window.length / 2)];
    result.push(median);
  }
  
  return result;
}

function meanFilter(values: number[], windowSize: number): number[] {
  const result: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(values.length, i + halfWindow + 1);
    const sum = values.slice(start, end).reduce((a, b) => a + b, 0);
    result.push(sum / (end - start));
  }
  
  return result;
}

export function detectAveragePitch(
  samples: Float32Array,
  sampleRate: number,
  frameSize: number = 8192,
  hopSize: number = 4096
): number {
  const pitches: number[] = [];
  const numFrames = Math.max(1, Math.floor((samples.length - frameSize) / hopSize));
  
  const actualFrames = Math.min(numFrames, 50);
  const actualHop = Math.floor(samples.length / actualFrames);
  
  for (let i = 0; i < actualFrames; i++) {
    const start = Math.min(i * actualHop, samples.length - frameSize);
    const frame = samples.slice(start, start + frameSize);
    
    let rms = 0;
    for (let j = 0; j < frame.length; j++) {
      rms += frame[j] * frame[j];
    }
    rms = Math.sqrt(rms / frame.length);
    
    if (rms < 0.01) continue;
    
    const pitch = detectPitch(frame, sampleRate, 40, 2000);
    if (pitch !== null && pitch > 40 && pitch < 2000) {
      pitches.push(pitch);
    }
  }
  
  if (pitches.length === 0) {
    return 440;
  }
  
  const medianFiltered = medianFilter(pitches, 5);
  const meanFiltered = meanFilter(medianFiltered, 3);
  
  const sorted = [...meanFiltered].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  
  const filtered = meanFiltered.filter(p => p >= q1 - 1.5 * iqr && p <= q3 + 1.5 * iqr);
  
  if (filtered.length === 0) {
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  const sum = filtered.reduce((a, b) => a + b, 0);
  const mean = sum / filtered.length;
  
  const variance = filtered.reduce((a, b) => a + (b - mean) ** 2, 0) / filtered.length;
  const stdDev = Math.sqrt(variance);
  
  const finalFiltered = filtered.filter(p => Math.abs(p - mean) <= 2 * stdDev);
  
  if (finalFiltered.length === 0) {
    return mean;
  }
  
  return finalFiltered.reduce((a, b) => a + b, 0) / finalFiltered.length;
}
