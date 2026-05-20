export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private currentAudioData: Float32Array[] | null = null;
  private currentSampleRate: number = 44100;

  async play(
    audioData: Float32Array[],
    sampleRate: number = 44100,
    startOffset: number = 0
  ): Promise<void> {
    this.stop();
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate
    });
    
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1;
    
    const numberOfChannels = audioData.length;
    const buffer = this.audioContext.createBuffer(
      numberOfChannels,
      audioData[0].length,
      sampleRate
    );
    
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      channelData.set(audioData[channel]);
    }
    
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = buffer;
    
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);
    
    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.pauseTime = 0;
      }
    };
    
    this.currentAudioData = audioData;
    this.currentSampleRate = sampleRate;
    
    const offset = Math.min(startOffset, buffer.duration);
    this.sourceNode.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;
  }

  pause(): void {
    if (!this.isPlaying || !this.audioContext) return;
    
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.stop();
  }

  resume(): void {
    if (this.isPlaying || !this.currentAudioData) return;
    
    this.play(this.currentAudioData, this.currentSampleRate, this.pauseTime);
    this.pauseTime = 0;
  }

  stop(): void {
    this.isPlaying = false;
    
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {}
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  getCurrentTime(): number {
    if (!this.isPlaying || !this.audioContext) {
      return this.pauseTime;
    }
    return this.audioContext.currentTime - this.startTime;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  seek(time: number): void {
    if (!this.currentAudioData) return;
    
    const wasPlaying = this.isPlaying;
    this.stop();
    
    if (wasPlaying) {
      this.play(this.currentAudioData, this.currentSampleRate, time);
    } else {
      this.pauseTime = time;
    }
  }
}
