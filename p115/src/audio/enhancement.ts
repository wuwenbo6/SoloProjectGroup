export interface EnhancerSettings {
  eq: EqualizerSettings;
  exciter: ExciterSettings;
  stereo: StereoEnhancerSettings;
  compressor: CompressorSettings;
  deesser: DeesserSettings;
  normalization: NormalizationSettings;
}

export interface EqualizerSettings {
  enabled: boolean;
  bands: EQBand[];
}

export interface EQBand {
  frequency: number;
  gain: number;
  Q: number;
  type: 'peaking' | 'lowshelf' | 'highshelf';
}

export interface ExciterSettings {
  enabled: boolean;
  drive: number;
  blend: number;
  frequency: number;
  harmonics: number;
}

export interface StereoEnhancerSettings {
  enabled: boolean;
  width: number;
  centerFocus: number;
  bassMono: number;
}

export interface CompressorSettings {
  enabled: boolean;
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
}

export interface DeesserSettings {
  enabled: boolean;
  threshold: number;
  frequency: number;
  Q: number;
}

export interface NormalizationSettings {
  enabled: boolean;
  targetLUFS: number;
  peakThreshold: number;
}

export const DEFAULT_ENHANCER: EnhancerSettings = {
  eq: {
    enabled: true,
    bands: [
      { frequency: 60, gain: 2, Q: 0.7, type: 'lowshelf' },
      { frequency: 250, gain: -1, Q: 1.4, type: 'peaking' },
      { frequency: 2000, gain: 2, Q: 1.4, type: 'peaking' },
      { frequency: 12000, gain: 3, Q: 0.7, type: 'highshelf' }
    ]
  },
  exciter: {
    enabled: true,
    drive: 30,
    blend: 50,
    frequency: 5000,
    harmonics: 3
  },
  stereo: {
    enabled: true,
    width: 120,
    centerFocus: 50,
    bassMono: 150
  },
  compressor: {
    enabled: true,
    threshold: -18,
    ratio: 4,
    attack: 10,
    release: 200,
    makeupGain: 4
  },
  deesser: {
    enabled: true,
    threshold: -24,
    frequency: 7000,
    Q: 3
  },
  normalization: {
    enabled: true,
    targetLUFS: -16,
    peakThreshold: -1
  }
};

export const ENHANCEMENT_PRESETS: Record<string, Partial<EnhancerSettings>> = {
  'warm-analog': {
    eq: {
      enabled: true,
      bands: [
        { frequency: 80, gain: 3, Q: 0.7, type: 'lowshelf' },
        { frequency: 200, gain: -2, Q: 1.4, type: 'peaking' },
        { frequency: 1500, gain: 1, Q: 1.4, type: 'peaking' },
        { frequency: 8000, gain: 2, Q: 0.7, type: 'highshelf' }
      ]
    },
    exciter: { enabled: true, drive: 40, blend: 60, frequency: 4000, harmonics: 4 },
    compressor: { enabled: true, threshold: -16, ratio: 3, attack: 15, release: 250, makeupGain: 3 }
  },
  'bright-clarity': {
    eq: {
      enabled: true,
      bands: [
        { frequency: 60, gain: 1, Q: 0.7, type: 'lowshelf' },
        { frequency: 300, gain: -1, Q: 1.4, type: 'peaking' },
        { frequency: 3000, gain: 3, Q: 1.4, type: 'peaking' },
        { frequency: 15000, gain: 4, Q: 0.7, type: 'highshelf' }
      ]
    },
    exciter: { enabled: true, drive: 50, blend: 70, frequency: 6000, harmonics: 5 },
    stereo: { enabled: true, width: 130, centerFocus: 40, bassMono: 120 }
  },
  'jazz-vocal': {
    eq: {
      enabled: true,
      bands: [
        { frequency: 100, gain: 2, Q: 0.7, type: 'lowshelf' },
        { frequency: 250, gain: -3, Q: 1.4, type: 'peaking' },
        { frequency: 3000, gain: 4, Q: 2, type: 'peaking' },
        { frequency: 10000, gain: 2, Q: 0.7, type: 'highshelf' }
      ]
    },
    exciter: { enabled: true, drive: 35, blend: 55, frequency: 5000, harmonics: 3 },
    deesser: { enabled: true, threshold: -20, frequency: 6500, Q: 3.5 }
  },
  'rock-energy': {
    eq: {
      enabled: true,
      bands: [
        { frequency: 50, gain: 4, Q: 0.7, type: 'lowshelf' },
        { frequency: 180, gain: -2, Q: 1.4, type: 'peaking' },
        { frequency: 2500, gain: 3, Q: 1.4, type: 'peaking' },
        { frequency: 8000, gain: 2, Q: 0.7, type: 'highshelf' }
      ]
    },
    exciter: { enabled: true, drive: 60, blend: 75, frequency: 3500, harmonics: 5 },
    compressor: { enabled: true, threshold: -14, ratio: 6, attack: 5, release: 150, makeupGain: 5 },
    stereo: { enabled: true, width: 140, centerFocus: 30, bassMono: 100 }
  },
  'classical-pure': {
    eq: {
      enabled: true,
      bands: [
        { frequency: 70, gain: 1, Q: 0.7, type: 'lowshelf' },
        { frequency: 400, gain: 1, Q: 1.4, type: 'peaking' },
        { frequency: 2000, gain: 1, Q: 1.4, type: 'peaking' },
        { frequency: 12000, gain: 1, Q: 0.7, type: 'highshelf' }
      ]
    },
    exciter: { enabled: false, drive: 20, blend: 30, frequency: 7000, harmonics: 2 },
    compressor: { enabled: false, threshold: -20, ratio: 2, attack: 30, release: 300, makeupGain: 2 }
  },
  'lofi-vinyl': {
    eq: {
      enabled: true,
      bands: [
        { frequency: 60, gain: 5, Q: 0.7, type: 'lowshelf' },
        { frequency: 300, gain: -4, Q: 1.4, type: 'peaking' },
        { frequency: 1500, gain: 2, Q: 1.4, type: 'peaking' },
        { frequency: 6000, gain: -2, Q: 0.7, type: 'highshelf' }
      ]
    },
    exciter: { enabled: true, drive: 70, blend: 80, frequency: 3000, harmonics: 6 },
    stereo: { enabled: true, width: 110, centerFocus: 60, bassMono: 200 }
  }
};

export function applyEqualizer(
  samples: Float32Array,
  sampleRate: number,
  settings: EqualizerSettings
): Float32Array {
  if (!settings.enabled) return samples;
  
  const result = new Float32Array(samples);
  
  for (const band of settings.bands) {
    applyEQBandInPlace(result, sampleRate, band);
  }
  
  return result;
}

function applyEQBandInPlace(
  samples: Float32Array,
  sampleRate: number,
  band: EQBand
): void {
  const w0 = 2 * Math.PI * band.frequency / sampleRate;
  const alpha = Math.sin(w0) / (2 * band.Q);
  const A = Math.pow(10, band.gain / 40);
  
  let b0, b1, b2, a0, a1, a2;
  
  if (band.type === 'lowshelf') {
    b0 = A * ((A + 1) - (A - 1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha);
    b1 = 2 * A * ((A - 1) - (A + 1) * Math.cos(w0));
    b2 = A * ((A + 1) - (A - 1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha);
    a0 = (A + 1) + (A - 1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha;
    a1 = -2 * ((A - 1) + (A + 1) * Math.cos(w0));
    a2 = (A + 1) + (A - 1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha;
  } else if (band.type === 'highshelf') {
    b0 = A * ((A + 1) + (A - 1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha);
    b1 = -2 * A * ((A - 1) + (A + 1) * Math.cos(w0));
    b2 = A * ((A + 1) + (A - 1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha);
    a0 = (A + 1) - (A - 1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha;
    a1 = 2 * ((A - 1) - (A + 1) * Math.cos(w0));
    a2 = (A + 1) - (A - 1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha;
  } else {
    b0 = 1 + alpha * A;
    b1 = -2 * Math.cos(w0);
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * Math.cos(w0);
    a2 = 1 - alpha / A;
  }
  
  let x1 = 0, x2 = 0;
  let y1 = 0, y2 = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    samples[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
}

export function applyExciter(
  samples: Float32Array,
  sampleRate: number,
  settings: ExciterSettings
): Float32Array {
  if (!settings.enabled) return samples;
  
  const result = new Float32Array(samples.length);
  const highpass = new Float32Array(samples.length);
  
  const hpfFreq = settings.frequency;
  const rc = 1 / (2 * Math.PI * hpfFreq);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  
  let prevHPFInput = samples[0];
  let prevHPFOutput = samples[0];
  
  for (let i = 0; i < samples.length; i++) {
    const currentInput = samples[i];
    highpass[i] = alpha * (prevHPFOutput + currentInput - prevHPFInput);
    prevHPFInput = currentInput;
    prevHPFOutput = highpass[i];
  }
  
  const drive = settings.drive / 100 * 5;
  const blend = settings.blend / 100;
  const harmonicCount = Math.floor(settings.harmonics);
  
  for (let i = 0; i < samples.length; i++) {
    let excited = 0;
    const h = highpass[i] * drive;
    
    for (let n = 1; n <= harmonicCount; n++) {
      const harmonic = Math.pow(Math.abs(h), n) * Math.sign(h);
      excited += harmonic / n;
    }
    
    excited = Math.tanh(excited);
    
    result[i] = samples[i] + excited * blend;
  }
  
  return result;
}

export function applyStereoEnhancer(
  leftChannel: Float32Array,
  rightChannel: Float32Array,
  sampleRate: number,
  settings: StereoEnhancerSettings
): { left: Float32Array; right: Float32Array } {
  if (!settings.enabled) return { left: leftChannel, right: rightChannel };
  
  const n = leftChannel.length;
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  const mid = new Float32Array(n);
  const side = new Float32Array(n);
  
  for (let i = 0; i < n; i++) {
    mid[i] = (leftChannel[i] + rightChannel[i]) * 0.5;
    side[i] = (leftChannel[i] - rightChannel[i]) * 0.5;
  }
  
  const widthFactor = settings.width / 100;
  const centerFactor = settings.centerFocus / 100;
  
  for (let i = 0; i < n; i++) {
    side[i] *= widthFactor;
    mid[i] *= (1 + (1 - centerFactor) * 0.5);
  }
  
  const bassFreq = settings.bassMono;
  const rc = 1 / (2 * Math.PI * bassFreq);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  
  let prevLeftInput = leftChannel[0];
  let prevRightInput = rightChannel[0];
  let prevLeftOutput = 0;
  let prevRightOutput = 0;
  
  for (let i = 0; i < n; i++) {
    left[i] = mid[i] + side[i];
    right[i] = mid[i] - side[i];
    
    const lowLeft = alpha * (prevLeftOutput + left[i] - prevLeftInput);
    const lowRight = alpha * (prevRightOutput + right[i] - prevRightInput);
    const lowMono = (lowLeft + lowRight) * 0.5;
    
    left[i] = lowMono + (left[i] - lowLeft);
    right[i] = lowMono + (right[i] - lowRight);
    
    prevLeftInput = leftChannel[i];
    prevRightInput = rightChannel[i];
    prevLeftOutput = lowLeft;
    prevRightOutput = lowRight;
  }
  
  return { left, right };
}

export function applyCompressor(
  samples: Float32Array,
  sampleRate: number,
  settings: CompressorSettings
): Float32Array {
  if (!settings.enabled) return samples;
  
  const result = new Float32Array(samples.length);
  const envelope = new Float32Array(samples.length);
  
  const attackCoef = Math.exp(-1 / (settings.attack * sampleRate / 1000));
  const releaseCoef = Math.exp(-1 / (settings.release * sampleRate / 1000));
  
  let envelopeValue = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const rectified = Math.abs(samples[i]);
    
    if (rectified > envelopeValue) {
      envelopeValue = attackCoef * envelopeValue + (1 - attackCoef) * rectified;
    } else {
      envelopeValue = releaseCoef * envelopeValue + (1 - releaseCoef) * rectified;
    }
    
    envelope[i] = envelopeValue;
  }
  
  const threshold = Math.pow(10, settings.threshold / 20);
  const makeupGain = Math.pow(10, settings.makeupGain / 20);
  
  for (let i = 0; i < samples.length; i++) {
    let gain = 1;
    
    if (envelope[i] > threshold) {
      const overThreshold = envelope[i] / threshold;
      const reduction = Math.pow(overThreshold, 1 - 1 / settings.ratio);
      gain = reduction / overThreshold;
    }
    
    result[i] = samples[i] * gain * makeupGain;
  }
  
  return result;
}

export function applyDeesser(
  samples: Float32Array,
  sampleRate: number,
  settings: DeesserSettings
): Float32Array {
  if (!settings.enabled) return samples;
  
  const result = new Float32Array(samples);
  
  const w0 = 2 * Math.PI * settings.frequency / sampleRate;
  const alpha = Math.sin(w0) / (2 * settings.Q);
  
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  
  let x1 = 0, x2 = 0;
  let y1 = 0, y2 = 0;
  
  const threshold = Math.pow(10, settings.threshold / 20);
  const envelope = new Float32Array(samples.length);
  const attackCoef = Math.exp(-1 / (0.005 * sampleRate));
  const releaseCoef = Math.exp(-1 / (0.05 * sampleRate));
  let env = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const bandpass = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    
    const rectified = Math.abs(bandpass);
    env = rectified > env 
      ? attackCoef * env + (1 - attackCoef) * rectified
      : releaseCoef * env + (1 - releaseCoef) * rectified;
    envelope[i] = env;
    
    let gain = 1;
    if (env > threshold) {
      gain = threshold / env;
      gain = Math.sqrt(gain);
    }
    
    const dryGain = 1 - (1 - gain) * 0.5;
    result[i] = samples[i] * dryGain + bandpass * gain * 0.5;
    
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = bandpass;
  }
  
  return result;
}

export function normalizePeak(
  samples: Float32Array,
  targetdB: number
): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  
  if (peak === 0) return samples;
  
  const target = Math.pow(10, targetdB / 20);
  const gain = target / peak;
  
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[i] * gain;
  }
  
  return result;
}

export function measureLUFS(
  samples: Float32Array,
  sampleRate: number
): number {
  const prefiltered = new Float32Array(samples);
  
  applyEQBandInPlace(prefiltered, sampleRate, {
    frequency: 100, gain: 0, Q: 0.5, type: 'highshelf'
  });
  applyEQBandInPlace(prefiltered, sampleRate, {
    frequency: 1000, gain: -6.9, Q: 0.707, type: 'peaking'
  });
  
  const blockSize = Math.floor(0.4 * sampleRate);
  const overlap = 0.75;
  const hopSize = Math.floor(blockSize * (1 - overlap));
  
  const blocks: number[] = [];
  
  for (let i = 0; i + blockSize <= samples.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += prefiltered[i + j] * prefiltered[i + j];
    }
    const mean = sum / blockSize;
    if (mean > 0) {
      blocks.push(-0.691 + 10 * Math.log10(mean));
    }
  }
  
  blocks.sort((a, b) => a - b);
  
  const absThreshold = -70;
  const relThreshold = -10;
  
  let aboveAbs = blocks.filter(l => l > absThreshold);
  if (aboveAbs.length === 0) return absThreshold;
  
  const absGamma = aboveAbs.reduce((a, b) => a + b, 0) / aboveAbs.length;
  let aboveRel = blocks.filter(l => l > absGamma + relThreshold);
  
  if (aboveRel.length === 0) return absGamma;
  
  const lufs = aboveRel.reduce((a, b) => a + b, 0) / aboveRel.length;
  
  return lufs;
}

export function normalizeLUFS(
  samples: Float32Array,
  sampleRate: number,
  targetLUFS: number
): Float32Array {
  const currentLUFS = measureLUFS(samples, sampleRate);
  const gainDiff = targetLUFS - currentLUFS;
  const gain = Math.pow(10, gainDiff / 20);
  
  const result = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }
  
  return result;
}

export async function applyFullEnhancement(
  channels: Float32Array[],
  sampleRate: number,
  settings: EnhancerSettings,
  onProgress?: (progress: number) => void
): Promise<Float32Array[]> {
  const result: Float32Array[] = [];
  
  for (let c = 0; c < channels.length; c++) {
    let processed = new Float32Array(channels[c]);
    
    processed = applyEqualizer(processed, sampleRate, settings.eq);
    if (onProgress) onProgress(20 + c * 10);
    
    processed = applyExciter(processed, sampleRate, settings.exciter);
    if (onProgress) onProgress(40 + c * 10);
    
    processed = applyDeesser(processed, sampleRate, settings.deesser);
    if (onProgress) onProgress(60 + c * 10);
    
    processed = applyCompressor(processed, sampleRate, settings.compressor);
    if (onProgress) onProgress(80 + c * 10);
    
    if (settings.normalization.enabled) {
      processed = normalizePeak(processed, settings.normalization.peakThreshold);
      processed = normalizeLUFS(processed, sampleRate, settings.normalization.targetLUFS);
    }
    
    result.push(processed);
    if (onProgress) onProgress(90 + c * 5);
  }
  
  if (result.length === 2) {
    const enhanced = applyStereoEnhancer(result[0], result[1], sampleRate, settings.stereo);
    result[0] = enhanced.left;
    result[1] = enhanced.right;
  }
  
  if (onProgress) onProgress(100);
  
  return result;
}
