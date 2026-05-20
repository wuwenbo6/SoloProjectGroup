import { removeClicks } from './dsp/clickRemoval';
import { reduceNoise } from './dsp/noiseReduction';
import { correctSpeedByPitch } from './dsp/speedCorrection';
import { applyFullEnhancement, EnhancerSettings, DEFAULT_ENHANCER } from './enhancement';
import { TURNTABLE_PRESETS, TurntablePreset, applyPresetEQ, applyAntiRumble } from './turntablePresets';
import { computeFingerprint, identifyByFingerprint, searchMetadata, SearchResult, MetadataSearchQuery } from './metadata';
import { encodeWAVAsync } from './formats/wav';

export interface TrackJob {
  id: string;
  name: string;
  audioData: Float32Array[];
  sampleRate: number;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  priority: number;
  error?: string;
  outputPath?: string;
  blob?: Blob;
  metadata?: {
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    genre?: string;
  };
  processingOptions: ProcessingOptions;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface ProcessingOptions {
  clickRemoval: { enabled: boolean; sensitivity: number; threshold: number };
  noiseReduction: { enabled: boolean; strength: number; noiseProfile?: number };
  speedCorrection: { enabled: boolean; targetPitch: number; preservePitch: boolean };
  enhancement: { enabled: boolean; preset?: string; customSettings?: Partial<EnhancerSettings> };
  turntablePreset: { enabled: boolean; presetId: string };
  metadataLookup: { enabled: boolean; autoMatch: boolean; searchQuery?: Partial<MetadataSearchQuery> };
  export: { format: 'wav' | 'mp3'; bitDepth: number; quality: number; autoSave: boolean };
}

export interface BatchProcessingState {
  jobs: Map<string, TrackJob>;
  activeJobId?: string;
  isRunning: boolean;
  isPaused: boolean;
  concurrency: number;
  totalProgress: number;
}

export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  clickRemoval: { enabled: true, sensitivity: 70, threshold: 50 },
  noiseReduction: { enabled: true, strength: 50 },
  speedCorrection: { enabled: true, targetPitch: 440, preservePitch: true },
  enhancement: { enabled: true, preset: 'warm-analog' },
  turntablePreset: { enabled: true, presetId: 'technics-sl1200' },
  metadataLookup: { enabled: true, autoMatch: true },
  export: { format: 'wav', bitDepth: 24, quality: 100, autoSave: true }
};

class BatchProcessor {
  private state: BatchProcessingState = {
    jobs: new Map(),
    isRunning: false,
    isPaused: false,
    concurrency: 1,
    totalProgress: 0
  };
  
  private listeners: Set<(state: BatchProcessingState) => void> = new Set();
  private processLoopId?: number;
  
  addJob(
    audioData: Float32Array[],
    sampleRate: number,
    name: string,
    options?: Partial<ProcessingOptions>,
    priority: number = 10
  ): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: TrackJob = {
      id: jobId,
      name,
      audioData,
      sampleRate,
      status: 'pending',
      progress: 0,
      priority,
      processingOptions: { ...DEFAULT_PROCESSING_OPTIONS, ...options },
      createdAt: Date.now()
    };
    
    this.state.jobs.set(jobId, job);
    this.notifyListeners();
    
    return jobId;
  }
  
  addJobsFromAlbum(
    tracks: { audioData: Float32Array[]; name: string }[],
    sampleRate: number,
    albumName: string,
    artist?: string,
    options?: Partial<ProcessingOptions>
  ): string[] {
    const jobIds: string[] = [];
    
    tracks.forEach((track, index) => {
      const jobId = this.addJob(
        track.audioData,
        sampleRate,
        track.name,
        {
          ...options,
          metadataLookup: {
            ...options?.metadataLookup,
            searchQuery: {
              album: albumName,
              artist,
              trackNumber: index + 1
            }
          }
        },
        tracks.length - index
      );
      jobIds.push(jobId);
    });
    
    return jobIds;
  }
  
  removeJob(jobId: string): boolean {
    const job = this.state.jobs.get(jobId);
    if (!job) return false;
    
    if (job.status === 'processing') {
      return false;
    }
    
    this.state.jobs.delete(jobId);
    this.notifyListeners();
    return true;
  }
  
  clearCompleted(): void {
    const completedIds: string[] = [];
    for (const [id, job] of this.state.jobs) {
      if (job.status === 'completed' || job.status === 'failed') {
        completedIds.push(id);
      }
    }
    completedIds.forEach(id => this.state.jobs.delete(id));
    this.notifyListeners();
  }
  
  start(): void {
    if (this.state.isRunning) return;
    
    this.state.isRunning = true;
    this.state.isPaused = false;
    this.notifyListeners();
    
    this.processLoop();
  }
  
  pause(): void {
    this.state.isPaused = true;
    this.notifyListeners();
  }
  
  resume(): void {
    if (!this.state.isRunning) {
      this.start();
      return;
    }
    
    this.state.isPaused = false;
    this.notifyListeners();
    this.processLoop();
  }
  
  stop(): void {
    this.state.isRunning = false;
    this.state.isPaused = false;
    
    for (const job of this.state.jobs.values()) {
      if (job.status === 'processing') {
        job.status = 'queued';
        job.progress = 0;
      }
    }
    
    this.notifyListeners();
  }
  
  setConcurrency(concurrency: number): void {
    this.state.concurrency = Math.max(1, Math.min(4, concurrency));
    this.notifyListeners();
  }
  
  updateJobOptions(jobId: string, options: Partial<ProcessingOptions>): boolean {
    const job = this.state.jobs.get(jobId);
    if (!job || job.status === 'processing') return false;
    
    job.processingOptions = { ...job.processingOptions, ...options };
    this.notifyListeners();
    return true;
  }
  
  getJob(jobId: string): TrackJob | undefined {
    return this.state.jobs.get(jobId);
  }
  
  getAllJobs(): TrackJob[] {
    return Array.from(this.state.jobs.values());
  }
  
  getState(): BatchProcessingState {
    return { ...this.state, jobs: new Map(this.state.jobs) };
  }
  
  subscribe(callback: (state: BatchProcessingState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }
  
  private async processLoop(): Promise<void> {
    if (this.processLoopId) {
      cancelAnimationFrame(this.processLoopId);
    }
    
    const loop = async () => {
      if (!this.state.isRunning || this.state.isPaused) return;
      
      const activeCount = Array.from(this.state.jobs.values()).filter(j => j.status === 'processing').length;
      
      if (activeCount < this.state.concurrency) {
        const pendingJobs = Array.from(this.state.jobs.values())
          .filter(j => j.status === 'pending' || j.status === 'queued')
          .sort((a, b) => b.priority - a.priority);
        
        if (pendingJobs.length > 0) {
          const job = pendingJobs[0];
          this.processJob(job.id);
        }
      }
      
      const totalJobs = this.state.jobs.size;
      if (totalJobs > 0) {
        const totalProgress = Array.from(this.state.jobs.values())
          .reduce((sum, j) => sum + j.progress, 0) / totalJobs;
        this.state.totalProgress = totalProgress;
      }
      
      const hasPending = Array.from(this.state.jobs.values())
        .some(j => j.status === 'pending' || j.status === 'queued');
      
      if (hasPending || activeCount > 0) {
        this.processLoopId = requestAnimationFrame(loop);
      } else {
        this.state.isRunning = false;
        this.notifyListeners();
      }
    };
    
    loop();
  }
  
  private async processJob(jobId: string): Promise<void> {
    const job = this.state.jobs.get(jobId);
    if (!job || job.status === 'processing') return;
    
    job.status = 'processing';
    job.startedAt = Date.now();
    job.progress = 0;
    this.notifyListeners();
    
    try {
      let processedChannels = [...job.audioData.map(ch => new Float32Array(ch))];
      
      if (job.processingOptions.turntablePreset.enabled) {
        const preset = TURNTABLE_PRESETS.find(p => p.id === job.processingOptions.turntablePreset.presetId);
        if (preset) {
          for (let i = 0; i < processedChannels.length; i++) {
            processedChannels[i] = applyAntiRumble(processedChannels[i], job.sampleRate, preset.antiRumble);
          }
          job.progress = 10;
          this.notifyListeners();
          await this.delay(10);
        }
      }
      
      if (job.processingOptions.clickRemoval.enabled) {
        for (let i = 0; i < processedChannels.length; i++) {
          processedChannels[i] = removeClicks(
            processedChannels[i],
            job.processingOptions.clickRemoval.threshold,
            job.processingOptions.clickRemoval.sensitivity
          );
        }
        job.progress = 25;
        this.notifyListeners();
        await this.delay(10);
      }
      
      if (job.processingOptions.noiseReduction.enabled) {
        for (let i = 0; i < processedChannels.length; i++) {
          processedChannels[i] = reduceNoise(
            processedChannels[i],
            0,
            0.5,
            job.sampleRate,
            job.processingOptions.noiseReduction.strength
          );
        }
        job.progress = 40;
        this.notifyListeners();
        await this.delay(10);
      }
      
      if (job.processingOptions.speedCorrection.enabled) {
        for (let i = 0; i < processedChannels.length; i++) {
          const result = correctSpeedByPitch(
            processedChannels[i],
            job.sampleRate,
            job.processingOptions.speedCorrection.targetPitch,
            job.processingOptions.speedCorrection.preservePitch
          );
          processedChannels[i] = result.corrected;
        }
        job.progress = 55;
        this.notifyListeners();
        await this.delay(10);
      }
      
      if (job.processingOptions.enhancement.enabled) {
        let enhancerSettings = { ...DEFAULT_ENHANCER };
        if (job.processingOptions.enhancement.preset) {
          const preset = (window as any).ENHANCEMENT_PRESETS?.[job.processingOptions.enhancement.preset];
          if (preset) {
            enhancerSettings = { ...enhancerSettings, ...preset };
          }
        }
        if (job.processingOptions.enhancement.customSettings) {
          enhancerSettings = { ...enhancerSettings, ...job.processingOptions.enhancement.customSettings };
        }
        
        processedChannels = await applyFullEnhancement(
          processedChannels,
          job.sampleRate,
          enhancerSettings,
          (progress) => {
            job.progress = 55 + progress * 0.25;
            this.notifyListeners();
          }
        );
        job.progress = 80;
        this.notifyListeners();
        await this.delay(10);
      }
      
      if (job.processingOptions.metadataLookup.enabled) {
        const monoSamples = new Float32Array(processedChannels[0].length);
        for (let i = 0; i < monoSamples.length; i++) {
          monoSamples[i] = processedChannels.reduce((sum, ch) => sum + ch[i], 0) / processedChannels.length;
        }
        
        const { fingerprint, length } = computeFingerprint(monoSamples, job.sampleRate);
        
        const fingerResult = await identifyByFingerprint(fingerprint, length);
        
        if (fingerResult && fingerResult.score > 0.5) {
          job.progress = 90;
          this.notifyListeners();
        }
        
        const searchQuery: MetadataSearchQuery = {
          title: job.name.replace(/\.[^/.]+$/, ''),
          duration: length,
          ...job.processingOptions.metadataLookup.searchQuery
        };
        
        const results = await searchMetadata(searchQuery);
        if (results.length > 0) {
          const bestMatch = results[0].data;
          job.metadata = {
            title: (bestMatch as any).title,
            artist: (bestMatch as any).artist,
            album: (bestMatch as any).album,
            year: (bestMatch as any).year,
            genre: (bestMatch as any).genre
          };
        }
        job.progress = 95;
        this.notifyListeners();
        await this.delay(10);
      }
      
      if (job.processingOptions.export.autoSave) {
        const wavBuffer = await encodeWAVAsync(
          processedChannels,
          job.sampleRate,
          job.processingOptions.export.bitDepth,
          (progress) => {
            job.progress = 95 + progress * 0.05;
            this.notifyListeners();
          }
        );
        
        job.blob = new Blob([wavBuffer], { type: 'audio/wav' });
        job.outputPath = job.metadata ? 
          `${job.metadata.artist || 'Unknown'}_${job.metadata.album || 'Unknown'}_${job.metadata.title || job.name}.wav` :
          `${job.name}.wav`;
      }
      
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = Date.now();
      
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    this.notifyListeners();
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    estimatedTimeRemaining?: number;
  } {
    const jobs = Array.from(this.state.jobs.values());
    const stats = {
      total: jobs.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };
    
    let totalDuration = 0;
    let completedDuration = 0;
    
    for (const job of jobs) {
      switch (job.status) {
        case 'pending': case 'queued': stats.pending++; break;
        case 'processing': stats.processing++; break;
        case 'completed': stats.completed++; break;
        case 'failed': stats.failed++; break;
      }
      
      const duration = job.audioData[0].length / job.sampleRate;
      totalDuration += duration;
      if (job.status === 'completed') {
        completedDuration += duration;
      }
    }
    
    return stats;
  }
  
  downloadJob(jobId: string): boolean {
    const job = this.state.jobs.get(jobId);
    if (!job || job.status !== 'completed' || !job.blob) return false;
    
    const url = URL.createObjectURL(job.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = job.outputPath || `${job.name}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    
    return true;
  }
  
  downloadAll(): void {
    const completedJobs = Array.from(this.state.jobs.values())
      .filter(j => j.status === 'completed' && j.blob);
    
    let delay = 0;
    for (const job of completedJobs) {
      setTimeout(() => this.downloadJob(job.id), delay);
      delay += 500;
    }
  }
}

export const batchProcessor = new BatchProcessor();

export function autoSplitTracks(
  audioData: Float32Array,
  sampleRate: number,
  minSilenceDuration: number = 1.5,
  minTrackDuration: number = 20,
  thresholdDb: number = -40
): { start: number; end: number; duration: number }[] {
  const frameSize = Math.floor(sampleRate * 0.1);
  const hopSize = Math.floor(sampleRate * 0.05);
  const threshold = Math.pow(10, thresholdDb / 20);
  
  const energy: number[] = [];
  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      sum += audioData[i + j] * audioData[i + j];
    }
    energy.push(Math.sqrt(sum / frameSize));
  }
  
  const minSilenceFrames = Math.floor(minSilenceDuration * sampleRate / hopSize);
  const minTrackFrames = Math.floor(minTrackDuration * sampleRate / hopSize);
  
  const silenceRegions: { start: number; end: number }[] = [];
  let silenceStart = -1;
  
  for (let i = 0; i < energy.length; i++) {
    const isSilence = energy[i] < threshold;
    
    if (isSilence && silenceStart === -1) {
      silenceStart = i;
    } else if (!isSilence && silenceStart !== -1) {
      if (i - silenceStart >= minSilenceFrames) {
        silenceRegions.push({ start: silenceStart, end: i });
      }
      silenceStart = -1;
    }
  }
  
  const tracks: { start: number; end: number; duration: number }[] = [];
  let trackStart = 0;
  
  for (const silence of silenceRegions) {
    const silenceMid = Math.floor((silence.start + silence.end) / 2);
    
    if (silenceMid - trackStart >= minTrackFrames) {
      tracks.push({
        start: trackStart * hopSize / sampleRate,
        end: silenceMid * hopSize / sampleRate,
        duration: (silenceMid - trackStart) * hopSize / sampleRate
      });
      trackStart = silenceMid;
    }
  }
  
  if (energy.length - trackStart >= minTrackFrames) {
    tracks.push({
      start: trackStart * hopSize / sampleRate,
      end: audioData.length / sampleRate,
      duration: (energy.length - trackStart) * hopSize / sampleRate
    });
  }
  
  return tracks;
}

export function generateTrackNames(
  tracks: { start: number; end: number; duration: number }[],
  albumName?: string,
  artist?: string
): { name: string; startTime: number; endTime: number }[] {
  return tracks.map((track, index) => ({
    name: `${albumName || 'Album'} - Track ${index + 1}`,
    startTime: track.start,
    endTime: track.end
  }));
}
