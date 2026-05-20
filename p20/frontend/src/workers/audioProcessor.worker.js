class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.isProcessing = false;
    this.isMuted = false;
    this.silenceCounter = 0;
    this.speakingThreshold = 30;
    this.silenceThreshold = 10;
    this.lastSpeakingState = false;
    this.processInterval = null;
    this.bufferSize = 2048;
  }

  init(stream) {
    try {
      if (typeof AudioContext !== 'undefined') {
        this.audioContext = new AudioContext({ latencyHint: 'interactive' });
      } else if (typeof webkitAudioContext !== 'undefined') {
        this.audioContext = new webkitAudioContext({ latencyHint: 'interactive' });
      } else {
        throw new Error('Web Audio API not supported');
      }

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.bufferSize;
      this.analyser.smoothingTimeConstant = 0.5;

      this.source.connect(this.analyser);

      this.isProcessing = true;
      this.startVAD();

      postMessage({ type: 'init-success' });
    } catch (error) {
      postMessage({ type: 'error', error: error.message });
    }
  }

  startVAD() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const process = () => {
      if (!this.isProcessing) return;

      if (!this.isMuted) {
        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        const sampleCount = Math.min(40, dataArray.length);
        for (let i = 0; i < sampleCount; i++) {
          sum += dataArray[i];
        }
        const average = sum / sampleCount;

        let isSpeaking = false;
        if (average > this.speakingThreshold) {
          isSpeaking = true;
          this.silenceCounter = 0;
        } else {
          this.silenceCounter++;
          if (this.silenceCounter < this.silenceThreshold) {
            isSpeaking = this.lastSpeakingState;
          }
        }

        if (isSpeaking !== this.lastSpeakingState) {
          this.lastSpeakingState = isSpeaking;
          postMessage({ 
            type: 'speaking-state', 
            speaking: isSpeaking,
            level: average
          });
        }
      }

      this.processInterval = setTimeout(process, 100);
    };

    process();
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted) {
      this.silenceCounter = this.silenceThreshold;
      if (this.lastSpeakingState) {
        this.lastSpeakingState = false;
        postMessage({ type: 'speaking-state', speaking: false, level: 0 });
      }
    }
  }

  setThresholds({ speaking, silence }) {
    if (speaking !== undefined) this.speakingThreshold = speaking;
    if (silence !== undefined) this.silenceThreshold = silence;
  }

  stop() {
    this.isProcessing = false;
    if (this.processInterval) {
      clearTimeout(this.processInterval);
      this.processInterval = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.source = null;
  }
}

const processor = new AudioProcessor();

onmessage = (e) => {
  const { type, payload } = e.data;
  
  switch (type) {
    case 'init':
      processor.init(payload.stream);
      break;
    case 'set-muted':
      processor.setMuted(payload.muted);
      break;
    case 'set-thresholds':
      processor.setThresholds(payload);
      break;
    case 'stop':
      processor.stop();
      postMessage({ type: 'stopped' });
      break;
  }
};
