export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private recordedData: Float32Array[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;
  private sampleRate: number = 44100;

  async startRecording(deviceId?: string): Promise<void> {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.sampleRate
    });
    
    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    };
    
    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 2, 2);
    
    this.recordedData = [new Float32Array(0), new Float32Array(0)];
    
    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      
      for (let channel = 0; channel < 2; channel++) {
        const inputData = e.inputBuffer.getChannelData(channel);
        const newData = new Float32Array(this.recordedData[channel].length + inputData.length);
        newData.set(this.recordedData[channel]);
        newData.set(inputData, this.recordedData[channel].length);
        this.recordedData[channel] = newData;
      }
    };
    
    this.sourceNode.connect(this.analyserNode);
    this.analyserNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
    
    this.isRecording = true;
    this.startTime = Date.now();
  }

  stopRecording(): {
    audioData: Float32Array[];
    duration: number;
    sampleRate: number;
  } {
    this.isRecording = false;
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }
    
    if (this.analyserNode) {
      this.analyserNode.disconnect();
    }
    
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    const duration = this.recordedData[0].length / this.sampleRate;
    
    return {
      audioData: this.recordedData,
      duration,
      sampleRate: this.sampleRate
    };
  }

  getCurrentLevel(): number {
    if (!this.analyserNode || !this.isRecording) return 0;
    
    const dataArray = new Float32Array(this.analyserNode.fftSize);
    this.analyserNode.getFloatTimeDomainData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    
    return Math.sqrt(sum / dataArray.length);
  }

  getRecordingDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }

  static async getInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  }
}
