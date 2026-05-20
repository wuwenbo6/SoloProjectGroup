export interface TurntablePreset {
  id: string;
  name: string;
  manufacturer: string;
  description: string;
  eq: EQPreset;
  antiRumble: RumbleSettings;
  speedCalibration: SpeedSettings;
  stylusType: 'spherical' | 'elliptical' | 'conical' | 'microridge' | 'line-contact';
  cartridgeOutput: number;
}

export interface EQPreset {
  lowShelf: { frequency: number; gain: number; Q: number };
  lowMid: { frequency: number; gain: number; Q: number };
  highMid: { frequency: number; gain: number; Q: number };
  highShelf: { frequency: number; gain: number; Q: number };
  riaaCorrection: boolean;
}

export interface RumbleSettings {
  enabled: boolean;
  highPassFreq: number;
  filterOrder: number;
  notchFreq: number;
  notchQ: number;
}

export interface SpeedSettings {
  baseSpeed: 33.3 | 45 | 78;
  calibrationFactor: number;
  wowAndFlutter: number;
}

export const TURNTABLE_PRESETS: TurntablePreset[] = [
  {
    id: 'technics-sl1200',
    name: 'Technics SL-1200',
    manufacturer: 'Technics',
    description: '经典 DJ 唱机，中性音色，出色的速度稳定性',
    eq: {
      lowShelf: { frequency: 80, gain: 0, Q: 0.7 },
      lowMid: { frequency: 250, gain: 0, Q: 1.4 },
      highMid: { frequency: 2000, gain: 1.5, Q: 1.4 },
      highShelf: { frequency: 8000, gain: 1, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 20,
      filterOrder: 2,
      notchFreq: 60,
      notchQ: 10
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 1.0005,
      wowAndFlutter: 0.01
    },
    stylusType: 'elliptical',
    cartridgeOutput: 4.5
  },
  {
    id: 'rega-planar3',
    name: 'Rega Planar 3',
    manufacturer: 'Rega',
    description: '英国 Hi-Fi 经典，温暖音色，音乐感强',
    eq: {
      lowShelf: { frequency: 60, gain: 2, Q: 0.7 },
      lowMid: { frequency: 200, gain: -1, Q: 1.4 },
      highMid: { frequency: 1500, gain: 2, Q: 1.4 },
      highShelf: { frequency: 10000, gain: 1.5, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 15,
      filterOrder: 2,
      notchFreq: 50,
      notchQ: 12
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 0.9998,
      wowAndFlutter: 0.015
    },
    stylusType: 'elliptical',
    cartridgeOutput: 5.0
  },
  {
    id: 'audio-technica-lp120',
    name: 'Audio-Technica LP120',
    manufacturer: 'Audio-Technica',
    description: '入门级直驱唱机，性价比高',
    eq: {
      lowShelf: { frequency: 80, gain: -1, Q: 0.7 },
      lowMid: { frequency: 300, gain: -2, Q: 1.4 },
      highMid: { frequency: 2500, gain: 2.5, Q: 1.4 },
      highShelf: { frequency: 12000, gain: 2, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 25,
      filterOrder: 2,
      notchFreq: 60,
      notchQ: 8
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 1.001,
      wowAndFlutter: 0.025
    },
    stylusType: 'conical',
    cartridgeOutput: 3.5
  },
  {
    id: 'pro-ject-debut',
    name: 'Pro-Ject Debut Carbon',
    manufacturer: 'Pro-Ject',
    description: '奥地利制造，碳纤维唱臂，精准还原',
    eq: {
      lowShelf: { frequency: 70, gain: 1, Q: 0.7 },
      lowMid: { frequency: 220, gain: 0.5, Q: 1.4 },
      highMid: { frequency: 1800, gain: 1, Q: 1.4 },
      highShelf: { frequency: 9000, gain: 0.5, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 18,
      filterOrder: 3,
      notchFreq: 50,
      notchQ: 15
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 1.0,
      wowAndFlutter: 0.008
    },
    stylusType: 'elliptical',
    cartridgeOutput: 4.0
  },
  {
    id: 'thorens-td124',
    name: 'Thorens TD 124',
    manufacturer: 'Thorens',
    description: '瑞士经典，惰轮驱动，强劲低频',
    eq: {
      lowShelf: { frequency: 50, gain: 3, Q: 0.7 },
      lowMid: { frequency: 180, gain: -1.5, Q: 1.4 },
      highMid: { frequency: 1200, gain: 2.5, Q: 1.4 },
      highShelf: { frequency: 7000, gain: 1, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 30,
      filterOrder: 1,
      notchFreq: 50,
      notchQ: 6
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 0.9995,
      wowAndFlutter: 0.03
    },
    stylusType: 'spherical',
    cartridgeOutput: 6.0
  },
  {
    id: 'vintage-generic',
    name: 'Vintage Generic',
    manufacturer: 'Generic',
    description: '通用老唱机预设，补偿老化特性',
    eq: {
      lowShelf: { frequency: 60, gain: 4, Q: 0.7 },
      lowMid: { frequency: 200, gain: -2, Q: 1.4 },
      highMid: { frequency: 3000, gain: 4, Q: 1.4 },
      highShelf: { frequency: 8000, gain: 3, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 35,
      filterOrder: 2,
      notchFreq: 60,
      notchQ: 5
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 0.998,
      wowAndFlutter: 0.05
    },
    stylusType: 'spherical',
    cartridgeOutput: 3.0
  },
  {
    id: '78-rpm-vintage',
    name: '78 RPM Vintage',
    manufacturer: 'Generic',
    description: '78转粗纹唱片专用预设',
    eq: {
      lowShelf: { frequency: 100, gain: 6, Q: 0.7 },
      lowMid: { frequency: 400, gain: -3, Q: 1.4 },
      highMid: { frequency: 2000, gain: 5, Q: 1.4 },
      highShelf: { frequency: 5000, gain: 4, Q: 0.7 },
      riaaCorrection: false
    },
    antiRumble: {
      enabled: true,
      highPassFreq: 50,
      filterOrder: 2,
      notchFreq: 60,
      notchQ: 5
    },
    speedCalibration: {
      baseSpeed: 78,
      calibrationFactor: 1.0,
      wowAndFlutter: 0.06
    },
    stylusType: 'spherical',
    cartridgeOutput: 5.0
  },
  {
    id: 'neutral-reference',
    name: 'Neutral Reference',
    manufacturer: 'Reference',
    description: '中性参考预设，最小化染色',
    eq: {
      lowShelf: { frequency: 80, gain: 0, Q: 0.7 },
      lowMid: { frequency: 250, gain: 0, Q: 1.4 },
      highMid: { frequency: 2000, gain: 0, Q: 1.4 },
      highShelf: { frequency: 10000, gain: 0, Q: 0.7 },
      riaaCorrection: true
    },
    antiRumble: {
      enabled: false,
      highPassFreq: 20,
      filterOrder: 1,
      notchFreq: 60,
      notchQ: 10
    },
    speedCalibration: {
      baseSpeed: 33.3,
      calibrationFactor: 1.0,
      wowAndFlutter: 0
    },
    stylusType: 'elliptical',
    cartridgeOutput: 4.0
  }
];

export interface CalibrationProfile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  presetId: string;
  customEQ: EQPreset;
  speedOffset: number;
  azimuth: number;
  vta: number;
  antiSkating: number;
  notes?: string;
}

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  id: 'default',
  name: '默认校准',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  presetId: 'neutral-reference',
  customEQ: {
    lowShelf: { frequency: 80, gain: 0, Q: 0.7 },
    lowMid: { frequency: 250, gain: 0, Q: 1.4 },
    highMid: { frequency: 2000, gain: 0, Q: 1.4 },
    highShelf: { frequency: 10000, gain: 0, Q: 0.7 },
    riaaCorrection: true
  },
  speedOffset: 0,
  azimuth: 0,
  vta: 0,
  antiSkating: 0
};

export function getPresetById(id: string): TurntablePreset | undefined {
  return TURNTABLE_PRESETS.find(p => p.id === id);
}

export function applyPresetEQ(
  samples: Float32Array,
  sampleRate: number,
  eq: EQPreset
): Float32Array {
  const result = new Float32Array(samples);
  
  biquadFilterInPlace(result, sampleRate, 'lowshelf', eq.lowShelf.frequency, eq.lowShelf.Q, eq.lowShelf.gain);
  biquadFilterInPlace(result, sampleRate, 'peaking', eq.lowMid.frequency, eq.lowMid.Q, eq.lowMid.gain);
  biquadFilterInPlace(result, sampleRate, 'peaking', eq.highMid.frequency, eq.highMid.Q, eq.highMid.gain);
  biquadFilterInPlace(result, sampleRate, 'highshelf', eq.highShelf.frequency, eq.highShelf.Q, eq.highShelf.gain);
  
  return result;
}

function biquadFilterInPlace(
  samples: Float32Array,
  sampleRate: number,
  type: 'lowshelf' | 'highshelf' | 'peaking',
  freq: number,
  Q: number,
  gain: number
): void {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  const A = Math.pow(10, gain / 40);
  
  let b0, b1, b2, a0, a1, a2;
  
  if (type === 'lowshelf') {
    b0 = A * ((A + 1) - (A - 1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha);
    b1 = 2 * A * ((A - 1) - (A + 1) * Math.cos(w0));
    b2 = A * ((A + 1) - (A - 1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha);
    a0 = (A + 1) + (A - 1) * Math.cos(w0) + 2 * Math.sqrt(A) * alpha;
    a1 = -2 * ((A - 1) + (A + 1) * Math.cos(w0));
    a2 = (A + 1) + (A - 1) * Math.cos(w0) - 2 * Math.sqrt(A) * alpha;
  } else if (type === 'highshelf') {
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

export function applyAntiRumble(
  samples: Float32Array,
  sampleRate: number,
  settings: RumbleSettings
): Float32Array {
  if (!settings.enabled) return samples;
  
  const result = new Float32Array(samples);
  
  highPassFilterInPlace(result, sampleRate, settings.highPassFreq, settings.filterOrder);
  
  if (settings.notchFreq > 0) {
    notchFilterInPlace(result, sampleRate, settings.notchFreq, settings.notchQ);
  }
  
  return result;
}

function highPassFilterInPlace(
  samples: Float32Array,
  sampleRate: number,
  cutoff: number,
  order: number
): void {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  
  for (let pass = 0; pass < order; pass++) {
    let prevInput = samples[0];
    let prevOutput = samples[0];
    
    for (let i = 1; i < samples.length; i++) {
      const currentInput = samples[i];
      const currentOutput = alpha * (prevOutput + currentInput - prevInput);
      samples[i] = currentOutput;
      prevInput = currentInput;
      prevOutput = currentOutput;
    }
  }
}

function notchFilterInPlace(
  samples: Float32Array,
  sampleRate: number,
  freq: number,
  Q: number
): void {
  const w0 = 2 * Math.PI * freq / sampleRate;
  const alpha = Math.sin(w0) / (2 * Q);
  
  const b0 = 1;
  const b1 = -2 * Math.cos(w0);
  const b2 = 1;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w0);
  const a2 = 1 - alpha;
  
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
