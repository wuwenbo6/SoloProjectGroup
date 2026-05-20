import { ParticleSystem } from './gpu/ParticleSystem';
import { SceneRenderer } from './renderer/SceneRenderer';
import { WebSocketService } from './services/WebSocketService';
import { ParticleData, SimulationConfig, HistoryFrame } from './types';

const CONFIG: SimulationConfig = {
  particleCount: 512,
  boundarySize: 20,
  speed: 5,
  energyDecayRate: 2,
  sleepThreshold: 10,
  wakeThreshold: 50,
  reproductionThreshold: 80,
  attackDistance: 2,
  terrainInfluence: 0.5,
  energyFieldStrength: 1.5,
};

class Application {
  private particleSystem!: ParticleSystem;
  private sceneRenderer!: SceneRenderer;
  private webSocketService!: WebSocketService;
  private device!: GPUDevice;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private time: number = 0;
  private isPaused: boolean = false;
  private historyFrames: HistoryFrame[] = [];
  private isPlayingBack: boolean = false;
  private playbackFrameIndex: number = 0;
  private statsSaveInterval: number = 500;
  private lastStatsSave: number = 0;
  private maxHistoryFrames: number = 300;
  private playbackSpeed: number = 1;
  private isRealtime: boolean = true;

  async init() {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('Failed to get GPU adapter');
    }

    this.device = await adapter.requestDevice();

    const container = document.getElementById('canvas-container')!;
    this.particleSystem = new ParticleSystem(this.device, CONFIG);
    this.sceneRenderer = new SceneRenderer(container, CONFIG.particleCount, CONFIG.boundarySize);
    this.webSocketService = new WebSocketService();

    this.setupWebSocketHandlers();
    this.setupUIControls();
    this.webSocketService.connect();

    console.log('Application initialized successfully');
  }

  private setupWebSocketHandlers() {
    this.webSocketService.onConnect(() => {
      this.updateConnectionStatus(true);
    });

    this.webSocketService.onDisconnect(() => {
      this.updateConnectionStatus(false);
    });

    this.webSocketService.onFullSync((particles) => {
      console.log('Received full sync with', particles.length, 'particles');
    });

    this.webSocketService.onParticlesSync((particles) => {
    });

    this.webSocketService.onParticleDeath((particleId) => {
      console.log('Particle death:', particleId);
    });
  }

  private setupUIControls() {
    const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
    const addEnergyBtn = document.getElementById('add-energy-btn') as HTMLButtonElement;
    const loadHistoryBtn = document.getElementById('load-history-btn') as HTMLButtonElement;
    const playbackBtn = document.getElementById('playback-btn') as HTMLButtonElement;
    const timelineSlider = document.getElementById('timeline-slider') as HTMLInputElement;
    const speedBtn = document.getElementById('speed-btn') as HTMLButtonElement;
    const prevFrameBtn = document.getElementById('prev-frame-btn') as HTMLButtonElement;
    const nextFrameBtn = document.getElementById('next-frame-btn') as HTMLButtonElement;

    resetBtn.addEventListener('click', () => {
      this.particleSystem.reset();
      this.historyFrames = [];
      this.isPlayingBack = false;
      this.isRealtime = true;
      playbackBtn.textContent = '播放回放';
      timelineSlider.value = '0';
      this.updateTimelineUI();
    });

    pauseBtn.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      pauseBtn.textContent = this.isPaused ? '继续' : '暂停';
    });

    addEnergyBtn.addEventListener('click', () => {
      this.particleSystem.addEnergy(30);
    });

    loadHistoryBtn.addEventListener('click', () => {
      this.loadHistory();
    });

    playbackBtn.addEventListener('click', () => {
      if (this.historyFrames.length === 0) {
        alert('没有历史数据可回放，请先运行一段时间模拟');
        return;
      }
      
      this.isPlayingBack = !this.isPlayingBack;
      this.isRealtime = !this.isPlayingBack;
      
      if (this.isPlayingBack) {
        playbackBtn.textContent = '停止回放';
        this.playbackFrameIndex = 0;
      } else {
        playbackBtn.textContent = '播放回放';
      }
      
      this.updateTimelineUI();
    });

    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        const speeds = [0.5, 1, 2, 4];
        const currentIndex = speeds.indexOf(this.playbackSpeed);
        this.playbackSpeed = speeds[(currentIndex + 1) % speeds.length];
        speedBtn.textContent = `${this.playbackSpeed}x`;
      });
    }

    if (prevFrameBtn) {
      prevFrameBtn.addEventListener('click', () => {
        if (this.historyFrames.length === 0) return;
        this.isPlayingBack = false;
        this.isRealtime = false;
        playbackBtn.textContent = '播放回放';
        this.playbackFrameIndex = Math.max(0, this.playbackFrameIndex - 1);
        this.displayHistoryFrame(this.historyFrames[this.playbackFrameIndex]);
        this.updateTimelineUI();
      });
    }

    if (nextFrameBtn) {
      nextFrameBtn.addEventListener('click', () => {
        if (this.historyFrames.length === 0) return;
        this.isPlayingBack = false;
        this.isRealtime = false;
        playbackBtn.textContent = '播放回放';
        this.playbackFrameIndex = Math.min(this.historyFrames.length - 1, this.playbackFrameIndex + 1);
        this.displayHistoryFrame(this.historyFrames[this.playbackFrameIndex]);
        this.updateTimelineUI();
      });
    }

    timelineSlider.addEventListener('input', (e) => {
      if (this.historyFrames.length === 0) return;
      
      const value = parseInt((e.target as HTMLInputElement).value);
      this.playbackFrameIndex = Math.floor((value / 100) * (this.historyFrames.length - 1));
      
      if (this.historyFrames[this.playbackFrameIndex]) {
        this.isPlayingBack = false;
        this.isRealtime = false;
        playbackBtn.textContent = '播放回放';
        this.displayHistoryFrame(this.historyFrames[this.playbackFrameIndex]);
        this.updateTimelineUI();
      }
    });
  }

  private updateTimelineUI(): void {
    const timelineSlider = document.getElementById('timeline-slider') as HTMLInputElement;
    const frameInfo = document.getElementById('frame-info') as HTMLElement;
    
    if (this.historyFrames.length > 0) {
      timelineSlider.disabled = false;
      timelineSlider.value = String((this.playbackFrameIndex / (this.historyFrames.length - 1)) * 100);
      
      if (frameInfo) {
        frameInfo.textContent = `帧: ${this.playbackFrameIndex + 1}/${this.historyFrames.length}`;
      }
    } else {
      timelineSlider.disabled = true;
      timelineSlider.value = '0';
      
      if (frameInfo) {
        frameInfo.textContent = '无历史数据';
      }
    }
  }

  private captureHistoryFrame(): void {
    if (!this.isRealtime || this.isPlayingBack) return;

    const particles = this.particleSystem.getParticles();
    const frame: HistoryFrame = {
      timestamp: this.time,
      particles: particles.map(p => ({
        id: p.id,
        position: { x: p.position[0], y: p.position[1], z: p.position[2] },
        velocity: { x: p.velocity[0], y: p.velocity[1], z: p.velocity[2] },
        state: p.state,
        energy: p.energy,
      })),
    };

    this.historyFrames.push(frame);
    
    if (this.historyFrames.length > this.maxHistoryFrames) {
      this.historyFrames.shift();
    }
  }

  private displayHistoryFrame(frame: HistoryFrame): void {
    const particles = this.particleSystem.getParticles();
    
    for (let i = 0; i < particles.length && i < frame.particles.length; i++) {
      const particle = particles[i];
      const frameParticle = frame.particles[i];
      
      particle.position[0] = frameParticle.position.x;
      particle.position[1] = frameParticle.position.y;
      particle.position[2] = frameParticle.position.z;
      particle.velocity[0] = frameParticle.velocity.x;
      particle.velocity[1] = frameParticle.velocity.y;
      particle.velocity[2] = frameParticle.velocity.z;
      particle.state = frameParticle.state;
      particle.energy = frameParticle.energy;
    }

    this.sceneRenderer.updateParticles(particles);
    this.sceneRenderer.updateHeatmap(particles);
    this.updateStats();
  }

  private updateConnectionStatus(connected: boolean) {
    const statusElement = document.getElementById('connection-status')!;
    if (connected) {
      statusElement.textContent = '已连接';
      statusElement.className = 'connected';
    } else {
      statusElement.textContent = '未连接';
      statusElement.className = 'disconnected';
    }
  }

  private updateStats() {
    const stats = this.particleSystem.getStats();
    
    (document.getElementById('total-particles')!).textContent = stats.total.toString();
    (document.getElementById('foraging-particles')!).textContent = stats.foraging.toString();
    (document.getElementById('attacking-particles')!).textContent = stats.attacking.toString();
    (document.getElementById('reproducing-particles')!).textContent = stats.reproducing.toString();
    (document.getElementById('sleeping-particles')!).textContent = stats.sleeping.toString();
    (document.getElementById('average-energy')!).textContent = stats.averageEnergy.toFixed(1);
  }

  private async saveStatsToServer() {
    const stats = this.particleSystem.getStats();
    
    try {
      await fetch('/api/stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          total_particles: stats.total,
          foraging_particles: stats.foraging,
          attacking_particles: stats.attacking,
          reproducing_particles: stats.reproducing,
          sleeping_particles: stats.sleeping,
          average_energy: stats.averageEnergy,
          avg_speed: CONFIG.speed,
        }),
      });
    } catch (error) {
      console.error('Failed to save stats:', error);
    }
  }

  private async saveParticleHistory() {
    const particles = this.particleSystem.getParticles();
    const particleData: ParticleData[] = particles.map(p => ({
      id: p.id,
      position: { x: p.position[0], y: p.position[1], z: p.position[2] },
      velocity: { x: p.velocity[0], y: p.velocity[1], z: p.velocity[2] },
      state: p.state,
      energy: p.energy,
    }));

    try {
      await fetch('/api/particle-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ particles: particleData }),
      });
    } catch (error) {
      console.error('Failed to save particle history:', error);
    }
  }

  private async loadHistory() {
    try {
      const response = await fetch('/api/particle-history?limit=100');
      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        const groupedByTimestamp = new Map<number, ParticleData[]>();
        
        for (const item of data.data) {
          const timestamp = new Date(item.timestamp).getTime();
          if (!groupedByTimestamp.has(timestamp)) {
            groupedByTimestamp.set(timestamp, []);
          }
          
          groupedByTimestamp.get(timestamp)!.push({
            id: item.particle_id,
            position: { x: item.position_x, y: item.position_y, z: item.position_z },
            velocity: { x: 0, y: 0, z: 0 },
            state: item.state,
            energy: item.energy || 50,
          });
        }
        
        this.historyFrames = Array.from(groupedByTimestamp.entries())
          .sort(([a], [b]) => a - b)
          .map(([timestamp, particles]) => ({ timestamp, particles }));
        
        const timelineSlider = document.getElementById('timeline-slider') as HTMLInputElement;
        const playbackBtn = document.getElementById('playback-btn') as HTMLButtonElement;
        
        timelineSlider.disabled = false;
        playbackBtn.disabled = false;
        
        console.log('Loaded', this.historyFrames.length, 'history frames');
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  start() {
    this.lastTime = performance.now();
    this.animate();
  }

  private animate = () => {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (!this.isPaused) {
      if (this.isRealtime && !this.isPlayingBack) {
        this.time += deltaTime;
        this.particleSystem.update(deltaTime);
        
        const particles = this.particleSystem.getParticles();
        this.sceneRenderer.updateParticles(particles);
        this.sceneRenderer.updateHeatmap(particles);
        this.sceneRenderer.update(deltaTime);
        
        if (currentTime - this.lastStatsSave > this.statsSaveInterval) {
          this.captureHistoryFrame();
          this.lastStatsSave = currentTime;
          this.updateTimelineUI();
        }
        
        if (Math.random() < 0.05) {
          const particleData: ParticleData[] = particles.slice(0, 50).map(p => ({
            id: p.id,
            position: { x: p.position[0], y: p.position[1], z: p.position[2] },
            velocity: { x: p.velocity[0], y: p.velocity[1], z: p.velocity[2] },
            state: p.state,
            energy: p.energy,
          }));
          this.webSocketService.sendParticleUpdate(particleData);
        }
      } else if (this.isPlayingBack && this.historyFrames.length > 0) {
        this.playbackFrameIndex = Math.min(
          this.historyFrames.length - 1,
          this.playbackFrameIndex + this.playbackSpeed * deltaTime * 30
        );
        
        if (this.playbackFrameIndex >= this.historyFrames.length - 1) {
          this.isPlayingBack = false;
          (document.getElementById('playback-btn') as HTMLButtonElement).textContent = '播放回放';
        }
        
        const frameIndex = Math.floor(this.playbackFrameIndex);
        const frame = this.historyFrames[frameIndex];
        if (frame) {
          this.displayHistoryFrame(frame);
          this.sceneRenderer.update(deltaTime);
          this.updateTimelineUI();
          
          const seconds = Math.floor(frame.timestamp);
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          const playbackTime = document.getElementById('playback-time') as HTMLElement;
          if (playbackTime) {
            playbackTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          }
        }
      }
    }

    this.sceneRenderer.render();
    this.updateStats();

    this.animationId = requestAnimationFrame(this.animate);
  };

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.webSocketService.disconnect();
  }
}

async function main() {
  try {
    const app = new Application();
    await app.init();
    app.start();
  } catch (error) {
    console.error('Failed to start application:', error);
    alert('Failed to start application: ' + (error as Error).message);
  }
}

main();
