import { create } from 'zustand';
import { AudioTrack, ProcessingParams, RecordingState, ExportConfig } from '../types';
import { AudioRecorder } from '../audio/recorder';
import { AudioPlayer } from '../audio/player';
import { removeClicksMultiPass } from '../audio/dsp/clickRemoval';
import { reduceNoise } from '../audio/dsp/noiseReduction';
import { correctSpeedByPitch } from '../audio/dsp/speedCorrection';
import { generateWaveformData } from '../utils/waveform';
import { encodeWAVAsync } from '../audio/formats/wav';
import { db } from '../utils/storage';

interface AudioState {
  currentTrack: AudioTrack | null;
  currentAudioData: Float32Array[];
  processedAudioData: Float32Array[];
  waveformData: number[];
  processingParams: ProcessingParams;
  recordingState: RecordingState;
  isPlaying: boolean;
  currentTime: number;
  isProcessing: boolean;
  processingProgress: number;

  recorder: AudioRecorder;
  player: AudioPlayer;

  startRecording: (deviceId?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  togglePlayPause: () => void;
  stopPlayback: () => void;
  seek: (time: number) => void;

  applyClickRemoval: () => void;
  applyNoiseReduction: () => void;
  applySpeedCorrection: () => void;
  applyAllProcessing: () => Promise<void>;

  setProcessingParams: (params: Partial<ProcessingParams>) => void;
  saveCurrentTrack: (name: string, metadata?: Partial<AudioTrack['metadata']>) => Promise<void>;
  loadTrack: (trackId: string) => Promise<void>;
  exportAudio: (filename: string, config: ExportConfig) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  currentTrack: null,
  currentAudioData: [],
  processedAudioData: [],
  waveformData: [],
  processingParams: {
    clickRemoval: { enabled: true, threshold: 50, sensitivity: 70 },
    noiseReduction: { enabled: true, strength: 50, noiseFloor: 0 },
    speedCorrection: { enabled: false, targetSpeed: 100, preservePitch: true },
    normalization: { enabled: true, targetLevel: 0.9 }
  },
  recordingState: {
    isRecording: false,
    isPaused: false,
    startTime: 0,
    duration: 0,
    inputDevice: '',
    sampleRate: 44100,
    level: 0
  },
  isPlaying: false,
  currentTime: 0,
  isProcessing: false,
  processingProgress: 0,

  recorder: new AudioRecorder(),
  player: new AudioPlayer(),

  startRecording: async (deviceId?: string) => {
    const { recorder } = get();
    await recorder.startRecording(deviceId);
    set({ recordingState: { ...get().recordingState, isRecording: true } });

    const updateLevel = () => {
      if (get().recordingState.isRecording) {
        set({
          recordingState: {
            ...get().recordingState,
            level: recorder.getCurrentLevel(),
            duration: recorder.getRecordingDuration()
          }
        });
        requestAnimationFrame(updateLevel);
      }
    };
    updateLevel();
  },

  stopRecording: async () => {
    const { recorder } = get();
    const result = recorder.stopRecording();
    
    const waveformData = generateWaveformData(result.audioData);
    
    set({
      currentAudioData: result.audioData,
      processedAudioData: result.audioData,
      recordingState: { ...get().recordingState, isRecording: false, duration: 0, level: 0 },
      waveformData
    });
  },

  togglePlayPause: () => {
    const { player, processedAudioData, currentTrack, isPlaying } = get();
    
    if (isPlaying) {
      player.pause();
      set({ isPlaying: false });
    } else if (processedAudioData.length > 0) {
      player.play(processedAudioData, currentTrack?.sampleRate || 44100);
      set({ isPlaying: true });
      
      const updateTime = () => {
        if (get().isPlaying) {
          set({ currentTime: player.getCurrentTime() });
          requestAnimationFrame(updateTime);
        }
      };
      updateTime();
    }
  },

  stopPlayback: () => {
    get().player.stop();
    set({ isPlaying: false, currentTime: 0 });
  },

  seek: (time: number) => {
    get().player.seek(time);
    set({ currentTime: time });
  },

  applyClickRemoval: async () => {
    const { currentAudioData, processingParams } = get();
    if (currentAudioData.length === 0) return;

    set({ isProcessing: true, processingProgress: 0 });
    
    const processed: Float32Array[] = [];
    for (let c = 0; c < currentAudioData.length; c++) {
      processed.push(removeClicksMultiPass(
        currentAudioData[c],
        3,
        processingParams.clickRemoval.threshold,
        processingParams.clickRemoval.sensitivity
      ));
      set({ processingProgress: ((c + 1) / currentAudioData.length) * 100 });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    set({ processedAudioData: processed, isProcessing: false, processingProgress: 0 });
  },

  applyNoiseReduction: async () => {
    const { currentAudioData, processingParams } = get();
    if (currentAudioData.length === 0) return;

    set({ isProcessing: true, processingProgress: 0 });
    
    const processed: Float32Array[] = [];
    for (let c = 0; c < currentAudioData.length; c++) {
      processed.push(reduceNoise(
        currentAudioData[c],
        0,
        0.5,
        44100,
        processingParams.noiseReduction.strength
      ));
      set({ processingProgress: ((c + 1) / currentAudioData.length) * 100 });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    set({ processedAudioData: processed, isProcessing: false, processingProgress: 0 });
  },

  applySpeedCorrection: async () => {
    const { currentAudioData, processingParams } = get();
    if (currentAudioData.length === 0) return;

    set({ isProcessing: true, processingProgress: 0 });
    
    const processed: Float32Array[] = [];
    for (let c = 0; c < currentAudioData.length; c++) {
      const result = correctSpeedByPitch(
        currentAudioData[c],
        44100,
        440,
        processingParams.speedCorrection.preservePitch
      );
      processed.push(result.corrected);
      set({ processingProgress: ((c + 1) / currentAudioData.length) * 100 });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    set({ processedAudioData: processed, isProcessing: false, processingProgress: 0 });
  },

  applyAllProcessing: async () => {
    set({ isProcessing: true, processingProgress: 0 });
    
    const { processingParams } = get();
    let audioData = get().currentAudioData;
    let progress = 0;
    const totalSteps = (processingParams.clickRemoval.enabled ? 1 : 0) +
                      (processingParams.noiseReduction.enabled ? 1 : 0) +
                      (processingParams.speedCorrection.enabled ? 1 : 0);
    
    if (totalSteps === 0) {
      set({ isProcessing: false });
      return;
    }
    
    if (processingParams.clickRemoval.enabled) {
      const newAudioData: Float32Array[] = [];
      for (let c = 0; c < audioData.length; c++) {
        newAudioData.push(removeClicksMultiPass(
          audioData[c],
          3,
          processingParams.clickRemoval.threshold,
          processingParams.clickRemoval.sensitivity
        ));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      audioData = newAudioData;
      progress += 1;
      set({ processingProgress: (progress / totalSteps) * 100 });
    }
    
    if (processingParams.noiseReduction.enabled) {
      const newAudioData: Float32Array[] = [];
      for (let c = 0; c < audioData.length; c++) {
        newAudioData.push(reduceNoise(
          audioData[c],
          0,
          0.5,
          44100,
          processingParams.noiseReduction.strength
        ));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      audioData = newAudioData;
      progress += 1;
      set({ processingProgress: (progress / totalSteps) * 100 });
    }
    
    if (processingParams.speedCorrection.enabled) {
      const newAudioData: Float32Array[] = [];
      for (let c = 0; c < audioData.length; c++) {
        const result = correctSpeedByPitch(
          audioData[c],
          44100,
          440,
          processingParams.speedCorrection.preservePitch
        );
        newAudioData.push(result.corrected);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      audioData = newAudioData;
      progress += 1;
      set({ processingProgress: (progress / totalSteps) * 100 });
    }
    
    set({ processedAudioData: audioData, isProcessing: false, processingProgress: 0 });
  },

  setProcessingParams: (params: Partial<ProcessingParams>) => {
    set(state => ({
      processingParams: { ...state.processingParams, ...params }
    }));
  },

  saveCurrentTrack: async (name: string, metadata?: Partial<AudioTrack['metadata']>) => {
    const { processedAudioData } = get();
    if (processedAudioData.length === 0) return;

    const waveformData = generateWaveformData(processedAudioData);
    const track: AudioTrack = {
      id: Date.now().toString(),
      name,
      duration: processedAudioData[0].length / 44100,
      sampleRate: 44100,
      channels: processedAudioData.length,
      audioData: [],
      waveformData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: metadata || {},
      processingHistory: []
    };

    await db.saveTrack(track, processedAudioData);
    set({ currentTrack: track });
  },

  loadTrack: async (trackId: string) => {
    const result = await db.getTrack(trackId);
    if (result) {
      set({
        currentTrack: result.track,
        currentAudioData: result.audioData,
        processedAudioData: result.audioData
      });
    }
  },

  exportAudio: async (filename: string, config: ExportConfig, onProgress?: (progress: number) => void) => {
    const { processedAudioData } = get();
    if (processedAudioData.length === 0) return;

    set({ isProcessing: true, processingProgress: 0 });
    
    const wavBuffer = await encodeWAVAsync(
      processedAudioData,
      config.sampleRate,
      config.bitDepth,
      (progress) => {
        set({ processingProgress: progress });
        if (onProgress) onProgress(progress);
      }
    );
    
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    
    set({ isProcessing: false, processingProgress: 0 });
  }
}));
