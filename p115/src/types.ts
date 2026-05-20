export interface AudioTrack {
  id: string;
  name: string;
  artist?: string;
  album?: string;
  duration: number;
  sampleRate: number;
  channels: number;
  audioData: Float32Array[];
  waveformData: number[];
  createdAt: number;
  updatedAt: number;
  metadata: TrackMetadata;
  processingHistory: ProcessingStep[];
}

export interface TrackMetadata {
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  coverArt?: string;
  comments?: string;
  bpm?: number;
  key?: string;
}

export interface ProcessingStep {
  type: 'click_removal' | 'noise_reduction' | 'speed_correction' | 'normalization';
  timestamp: number;
  params: Record<string, any>;
  duration: number;
}

export interface ProcessingParams {
  clickRemoval: {
    enabled: boolean;
    threshold: number;
    sensitivity: number;
  };
  noiseReduction: {
    enabled: boolean;
    strength: number;
    noiseFloor: number;
  };
  speedCorrection: {
    enabled: boolean;
    targetSpeed: number;
    preservePitch: boolean;
  };
  normalization: {
    enabled: boolean;
    targetLevel: number;
  };
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  startTime: number;
  duration: number;
  inputDevice: string;
  sampleRate: number;
  level: number;
}

export interface ExportConfig {
  format: 'wav' | 'mp3' | 'flac';
  bitDepth: 16 | 24 | 32;
  sampleRate: number;
  quality: number;
}
