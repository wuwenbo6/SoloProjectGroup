class VRManager {
  constructor() {
    this.isVRMode = false;
    this.isVRSupported = false;
    this.xrSession = null;
    this.xrRefSpace = null;
    this.gl = null;
    this.vrButton = null;
    this.init();
  }

  init() {
    const urlParams = new URLSearchParams(window.location.search);
    this.isVRMode = urlParams.get('vr') === '1';
    
    if (this.isVRMode) {
      this.checkVRSupport();
    }
  }

  async checkVRSupport() {
    if (!navigator.xr) {
      console.log('WebXR not supported');
      this.isVRSupported = false;
      return;
    }

    try {
      this.isVRSupported = await navigator.xr.isSessionSupported('immersive-vr');
      console.log('VR supported:', this.isVRSupported);
      
      if (this.isVRSupported) {
        this.createVRButton();
      }
    } catch (error) {
      console.error('Error checking VR support:', error);
      this.isVRSupported = false;
    }
  }

  createVRButton() {
    const button = document.createElement('button');
    button.style.position = 'fixed';
    button.style.bottom = '100px';
    button.style.right = '100px';
    button.style.padding = '15px 30px';
    button.style.background = 'linear-gradient(90deg, #9B59B6, #E67E22)';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '8px';
    button.style.fontSize = '16px';
    button.style.fontWeight = 'bold';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';
    button.style.boxShadow = '0 4px 15px rgba(155, 89, 182, 0.4)';
    button.textContent = '🥽 进入VR模式';
    
    button.onclick = () => this.enterVR();
    
    document.body.appendChild(button);
    this.vrButton = button;
  }

  async enterVR() {
    if (!this.isVRSupported) {
      alert('您的设备不支持VR模式');
      return;
    }

    try {
      this.xrSession = await navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['bounded-floor', 'hand-tracking']
      });

      this.setupXRSession();
      
      this.vrButton.textContent = '⏹️ 退出VR';
      this.vrButton.onclick = () => this.exitVR();
      
      console.log('VR session started');
    } catch (error) {
      console.error('Error entering VR:', error);
      alert('进入VR模式失败: ' + error.message);
    }
  }

  async setupXRSession() {
    const canvas = document.createElement('canvas');
    this.gl = canvas.getContext('webgl', { xrCompatible: true });
    
    await this.xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
    });

    this.xrRefSpace = await this.xrSession.requestReferenceSpace('local-floor');
    
    this.xrSession.requestAnimationFrame(this.onXRFrame.bind(this));

    this.xrSession.addEventListener('end', () => {
      this.onVREnded();
    });
  }

  onXRFrame(time, frame) {
    const session = frame.session;
    session.requestAnimationFrame(this.onXRFrame.bind(this));

    const pose = frame.getViewerPose(this.xrRefSpace);
    
    if (pose) {
      for (const view of pose.views) {
        const viewport = session.renderState.baseLayer.getViewport(view);
        this.gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
        
        this.updateVRPlayerPosition(pose);
      }
    }
  }

  updateVRPlayerPosition(pose) {
    if (typeof game !== 'undefined' && game.scene) {
      const scene = game.scene.scenes[0];
      if (scene && scene.player) {
        const position = pose.transform.position;
        const playerX = 400 + position.x * 50;
        const playerY = 300 + position.z * 50;
        
        scene.player.x = Phaser.Math.Clamp(playerX, 50, 750);
        scene.player.y = Phaser.Math.Clamp(playerY, 50, 550);
        
        if (typeof network !== 'undefined') {
          network.sendPlayerMove(scene.player.x, scene.player.y);
        }
      }
    }
  }

  async exitVR() {
    if (this.xrSession) {
      await this.xrSession.end();
    }
  }

  onVREnded() {
    this.xrSession = null;
    this.xrRefSpace = null;
    
    if (this.vrButton) {
      this.vrButton.textContent = '🥽 进入VR模式';
      this.vrButton.onclick = () => this.enterVR();
    }
    
    console.log('VR session ended');
  }

  unlockVRAchievement(playerId) {
    if (playerId) {
      fetch('/api/achievements/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          achievementId: 'vr_explorer'
        })
      }).catch(err => console.error('Failed to unlock VR achievement:', err));
    }
  }
}

let vrManager = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    vrManager = new VRManager();
  });
} else {
  vrManager = new VRManager();
}

function onRejoinedRoom(message) {
  if (typeof onRoomJoined === 'function') {
    onRoomJoined(message);
  }
}
