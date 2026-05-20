class SceneRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationFrameId = null;
        this.lastTime = 0;
        this.fps = 60;
        this.fpsFrames = [];
        this.fpsLastUpdate = 0;
        this.qualityLevel = 'high';
        this.useShadows = true;
        this.useAA = true;
        this.useLOD = true;
        this.lights = {};
        this.grid = null;
        
        this.init();
    }

    init() {
        try {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x1a1a2e);
            
            this.camera = new THREE.PerspectiveCamera(
                60, 
                (window.innerWidth - 340) / window.innerHeight, 
                0.1, 
                1000
            );
            this.camera.position.set(5, 3, 5);
            
            this.renderer = new THREE.WebGLRenderer({ 
                canvas: this.canvas, 
                antialias: this.useAA,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            });
            this.renderer.setSize(window.innerWidth - 340, window.innerHeight);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.useAA ? 2 : 1));
            this.renderer.shadowMap.enabled = this.useShadows;
            this.renderer.shadowMap.type = this.useShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
            
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.minDistance = 1.5;
            this.controls.maxDistance = 15;
            this.controls.enablePan = true;
            
            this.setupLights();
            this.setupGrid();
            
            window.addEventListener('resize', this.debounce(this.onWindowResize.bind(this), 100));
            
            this.startAnimationLoop();
            
            console.log('3D场景渲染器初始化成功');
            this.updateQualityDisplay();
        } catch (error) {
            console.error('3D场景初始化失败:', error);
            throw error;
        }
    }

    setupLights() {
        const ambientIntensity = this.qualityLevel === 'low' ? 0.5 : 0.7;
        this.lights.ambient = new THREE.AmbientLight(0x404040, ambientIntensity);
        this.scene.add(this.lights.ambient);
        
        const directionalIntensity = this.qualityLevel === 'low' ? 0.7 : 0.9;
        this.lights.directional = new THREE.DirectionalLight(0xffffff, directionalIntensity);
        this.lights.directional.position.set(8, 12, 8);
        this.lights.directional.castShadow = this.useShadows;
        
        if (this.useShadows) {
            const shadowSize = this.qualityLevel === 'low' ? 512 : 1024;
            this.lights.directional.shadow.mapSize.width = shadowSize;
            this.lights.directional.shadow.mapSize.height = shadowSize;
        }
        this.lights.directional.shadow.camera.near = 0.5;
        this.lights.directional.shadow.camera.far = 50;
        this.scene.add(this.lights.directional);
        
        if (this.qualityLevel !== 'low') {
            this.lights.point1 = new THREE.PointLight(0xe94560, 0.4, 25);
            this.lights.point1.position.set(-6, 4, -6);
            this.scene.add(this.lights.point1);
            
            this.lights.point2 = new THREE.PointLight(0x533483, 0.4, 25);
            this.lights.point2.position.set(6, 4, 6);
            this.scene.add(this.lights.point2);
        }
    }

    setupGrid() {
        const gridDivisions = this.qualityLevel === 'low' ? 10 : 20;
        this.grid = new THREE.GridHelper(10, gridDivisions, 0x333366, 0x222244);
        this.scene.add(this.grid);
        
        const axes = new THREE.AxesHelper(3);
        this.scene.add(axes);
    }

    setQualityLevel(level) {
        this.qualityLevel = level;
        this.useShadows = level !== 'low';
        this.useAA = level !== 'low';
        
        this.renderer.shadowMap.enabled = this.useShadows;
        this.renderer.shadowMap.type = this.useShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.useAA ? 2 : 1));
        
        this.updateLighting();
        this.updateQualityDisplay();
    }

    updateLighting() {
        const ambientIntensity = this.qualityLevel === 'low' ? 0.5 : 0.7;
        this.lights.ambient.intensity = ambientIntensity;
        
        const directionalIntensity = this.qualityLevel === 'low' ? 0.7 : 0.9;
        this.lights.directional.intensity = directionalIntensity;
    }

    updateQualityDisplay() {
        const display = document.getElementById('quality-display');
        if (display) {
            const qualityText = { high: '高性能', medium: '平衡', low: '节能' };
            display.textContent = `画质: ${qualityText[this.qualityLevel]} | FPS: ${this.fps}`;
        }
    }

    updateFPS(currentTime) {
        this.fpsFrames.push(currentTime);
        if (this.fpsFrames.length > 60) {
            this.fpsFrames.shift();
        }
        
        if (currentTime - this.fpsLastUpdate > 500) {
            const elapsed = this.fpsFrames[this.fpsFrames.length - 1] - this.fpsFrames[0];
            this.fps = Math.round((this.fpsFrames.length * 1000) / elapsed);
            this.updateQualityDisplay();
            this.fpsLastUpdate = currentTime;
        }
    }

    startAnimationLoop() {
        const animate = (currentTime) => {
            this.animationFrameId = requestAnimationFrame(animate);
            
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            this.updateFPS(currentTime);
            this.controls.update();
            this.render();
            
            if (window.onSceneUpdate) {
                window.onSceneUpdate(deltaTime);
            }
        };
        
        this.animationFrameId = requestAnimationFrame(animate);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        const width = window.innerWidth - 340;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    setBackground(color) {
        this.scene.background = new THREE.Color(color);
    }

    addObject(object) {
        this.scene.add(object);
    }

    removeObject(object) {
        this.scene.remove(object);
    }

    getCameraPosition() {
        return this.camera.position.clone();
    }

    setCameraPosition(x, y, z) {
        this.camera.position.set(x, y, z);
    }

    dispose() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.renderer.dispose();
        this.controls.dispose();
    }

    captureScreenshot() {
        this.render();
        return this.canvas.toDataURL('image/png');
    }
}
