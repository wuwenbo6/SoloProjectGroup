let scene, camera, renderer, controls;
let currentModel = null;
let modelComponents = [];
let isAnimating = false;
let isPaused = false;
let animationProgress = 0;
let animationDirection = 1;
let stressViewEnabled = false;
let forceSimulationEnabled = false;
let forceCalculationEnabled = false;
let stressMarkers = [];
let forceVectors = [];
let deformationMeshes = [];
let animationFrameId = null;
let lastTime = 0;
let dockingMarkers = [];
let playbackSpeed = 1.0;
let isRecording = false;
let isPlaying = false;
let recordedFrames = [];
let playbackIndex = 0;
let currentLoadType = 'none';
let loadIntensity = 0.5;
let fps = 60;
let fpsFrames = [];
let fpsLastUpdate = 0;
let qualityLevel = 'high';
let useShadows = true;
let useAA = true;
let useLOD = true;

const API_BASE = 'http://localhost:8080/api';
const DOCKING_PRECISION = 0.001;
const EASE_FACTOR = 0.15;

const modelData = {
    mortise1: {
        id: 1,
        name: '燕尾榫 - 古建筑常用连接',
        category: '连接榫卯',
        tags: ['燕尾榫', '古建筑', '梁枋', '传统工艺'],
        description: '最古老的榫卯结构，形似燕子尾巴，抗拉拔能力强',
        components: [
            { name: '榫头', position: { x: -0.3, y: 0, z: 0 }, disassemblePos: { x: -2.5, y: 0, z: 0 }, 
              dockingPoint: { x: 0.3, y: 0, z: 0 }, size: { x: 1.2, y: 0.6, z: 0.8 }, stiffness: 12000 },
            { name: '卯眼', position: { x: 0.3, y: 0, z: 0 }, disassemblePos: { x: 2.5, y: 0, z: 0 }, 
              dockingPoint: { x: -0.3, y: 0, z: 0 }, size: { x: 1.2, y: 0.6, z: 0.8 }, stiffness: 12000 }
        ],
        stressNodes: [
            { name: '连接节点A', position: { x: -0.5, y: 0.2, z: 0 }, baseStress: 45.2, safety: 0.85 },
            { name: '连接节点B', position: { x: 0.5, y: 0.2, z: 0 }, baseStress: 38.7, safety: 0.92 },
            { name: '核心受力点', position: { x: 0, y: 0, z: 0 }, baseStress: 62.1, safety: 0.68 }
        ],
        documentIds: [1, 2, 3]
    },
    mortise2: {
        id: 2,
        name: '格肩榫 - 家具传统工艺',
        category: '家具榫卯',
        tags: ['格肩榫', '家具', '明清', '桌案'],
        description: '传统家具常用榫卯，肩部带格，连接强度高',
        components: [
            { name: '横枨', position: { x: 0, y: 0.25, z: 0 }, disassemblePos: { x: 0, y: 2.5, z: 0 }, 
              dockingPoint: { x: 0, y: -0.25, z: 0 }, size: { x: 2, y: 0.4, z: 0.6 }, stiffness: 15000 },
            { name: '立腿左', position: { x: -0.8, y: -0.5, z: 0 }, disassemblePos: { x: -2, y: -1.5, z: 0 }, 
              dockingPoint: { x: 0.8, y: 0.5, z: 0 }, size: { x: 0.4, y: 1.5, z: 0.6 }, stiffness: 10000 },
            { name: '立腿右', position: { x: 0.8, y: -0.5, z: 0 }, disassemblePos: { x: 2, y: -1.5, z: 0 }, 
              dockingPoint: { x: -0.8, y: 0.5, z: 0 }, size: { x: 0.4, y: 1.5, z: 0.6 }, stiffness: 10000 }
        ],
        stressNodes: [
            { name: '左肩节点', position: { x: -0.8, y: 0.5, z: 0 }, baseStress: 32.5, safety: 0.95 },
            { name: '右肩节点', position: { x: 0.8, y: 0.5, z: 0 }, baseStress: 34.1, safety: 0.93 },
            { name: '中央交接点', position: { x: 0, y: 0.3, z: 0 }, baseStress: 55.8, safety: 0.72 }
        ],
        documentIds: [2, 4]
    },
    mortise3: {
        id: 3,
        name: '霸王拳 - 梁头装饰榫卯',
        category: '装饰榫卯',
        tags: ['霸王拳', '古建筑', '装饰', '梁头'],
        description: '明清官式建筑特征，兼具加固与装饰功能',
        components: [
            { name: '梁身', position: { x: -0.8, y: 0, z: 0 }, disassemblePos: { x: -3, y: 0, z: 0 }, 
              dockingPoint: { x: 0.8, y: 0, z: 0 }, size: { x: 2, y: 0.6, z: 0.8 }, stiffness: 18000 },
            { name: '霸王拳', position: { x: 0.8, y: 0, z: 0 }, disassemblePos: { x: 3, y: 0, z: 0 }, 
              dockingPoint: { x: -0.8, y: 0, z: 0 }, size: { x: 1.2, y: 0.8, z: 0.8 }, stiffness: 11000 },
            { name: '装饰构件', position: { x: 0, y: 0.5, z: 0 }, disassemblePos: { x: 0, y: 2.5, z: 0 }, 
              dockingPoint: { x: 0, y: -0.5, z: 0 }, size: { x: 0.6, y: 0.4, z: 0.5 }, stiffness: 8000 }
        ],
        stressNodes: [
            { name: '梁端受力点', position: { x: 1.2, y: 0, z: 0 }, baseStress: 78.3, safety: 0.55 },
            { name: '装饰连接点', position: { x: 0, y: 0.8, z: 0 }, baseStress: 22.4, safety: 0.98 },
            { name: '核心承重区', position: { x: 0.5, y: 0.3, z: 0 }, baseStress: 68.9, safety: 0.62 }
        ],
        documentIds: [1, 3]
    },
    mortise4: {
        id: 4,
        name: '半榫 - 透空连接结构',
        category: '透空榫卯',
        tags: ['半榫', '栏杆', '花格', '装饰'],
        description: '榫头不穿透卯眼，美观性强，多用于装饰构件',
        components: [
            { name: '上构件', position: { x: 0, y: 0.3, z: 0 }, disassemblePos: { x: 0, y: 2, z: 0 }, 
              dockingPoint: { x: 0, y: -0.3, z: 0 }, size: { x: 1, y: 0.6, z: 0.7 }, stiffness: 9000 },
            { name: '下构件', position: { x: 0, y: -0.3, z: 0 }, disassemblePos: { x: 0, y: -2, z: 0 }, 
              dockingPoint: { x: 0, y: 0.3, z: 0 }, size: { x: 1, y: 0.6, z: 0.7 }, stiffness: 9000 }
        ],
        stressNodes: [
            { name: '上榫头', position: { x: 0, y: 0.5, z: 0 }, baseStress: 41.2, safety: 0.88 },
            { name: '下卯眼', position: { x: 0, y: -0.5, z: 0 }, baseStress: 48.6, safety: 0.81 },
            { name: '接触面中心', position: { x: 0, y: 0, z: 0 }, baseStress: 58.3, safety: 0.71 }
        ],
        documentIds: [2, 4]
    }
};

const documents = [
    { id: 1, title: '《营造法式》榫卯构造详解', author: '李诫', dynasty: '宋代', description: '中国古代最完整的建筑技术典籍' },
    { id: 2, title: '古建筑木结构连接技术研究', author: '梁思成', dynasty: '近代', description: '中国近代建筑研究的奠基之作' },
    { id: 3, title: '明清官式建筑榫卯形制分析', author: '故宫博物院', dynasty: '明清', description: '故宫古建筑群的结构分析报告' },
    { id: 4, title: '传统木作工艺口述史料', author: '老工匠', dynasty: '民国', description: '传统工匠技艺的珍贵记录' }
];

function init() {
    try {
        const canvas = document.getElementById('three-canvas');
        
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        
        camera = new THREE.PerspectiveCamera(60, (window.innerWidth - 340) / window.innerHeight, 0.1, 1000);
        camera.position.set(5, 3, 5);
        
        renderer = new THREE.WebGLRenderer({ 
            canvas: canvas, 
            antialias: useAA,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth - 340, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, useAA ? 2 : 1));
        renderer.shadowMap.enabled = useShadows;
        renderer.shadowMap.type = useShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 1.5;
        controls.maxDistance = 15;
        controls.enablePan = true;
        
        setupLights();
        setupGrid();
        
        window.addEventListener('resize', debounce(onWindowResize, 100));
        
        startAnimationLoop();
        
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 800);
        
        console.log('3D场景初始化成功');
        updateQualityDisplay();
    } catch (error) {
        console.error('3D场景初始化失败:', error);
        alert('3D场景初始化失败，请检查浏览器是否支持WebGL');
    }
}

function debounce(func, wait) {
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

function setupLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, qualityLevel === 'low' ? 0.5 : 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, qualityLevel === 'low' ? 0.7 : 0.9);
    directionalLight.position.set(8, 12, 8);
    directionalLight.castShadow = useShadows;
    if (useShadows) {
        directionalLight.shadow.mapSize.width = qualityLevel === 'low' ? 512 : 1024;
        directionalLight.shadow.mapSize.height = qualityLevel === 'low' ? 512 : 1024;
    }
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);
    
    if (qualityLevel !== 'low') {
        const pointLight1 = new THREE.PointLight(0xe94560, 0.4, 25);
        pointLight1.position.set(-6, 4, -6);
        scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x533483, 0.4, 25);
        pointLight2.position.set(6, 4, 6);
        scene.add(pointLight2);
    }
}

function setupGrid() {
    const gridHelper = new THREE.GridHelper(10, qualityLevel === 'low' ? 10 : 20, 0x333366, 0x222244);
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);
}

function smartSearch(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!query || query.trim() === '') {
        resultsDiv.style.display = 'none';
        return;
    }
    
    query = query.toLowerCase();
    const results = [];
    
    Object.values(modelData).forEach(model => {
        let score = 0;
        if (model.name.toLowerCase().includes(query)) score += 10;
        if (model.category.toLowerCase().includes(query)) score += 5;
        if (model.description.toLowerCase().includes(query)) score += 3;
        model.tags.forEach(tag => {
            if (tag.toLowerCase().includes(query)) score += 4;
        });
        if (score > 0) {
            results.push({ ...model, score, key: Object.keys(modelData).find(k => modelData[k] === model) });
        }
    });
    
    results.sort((a, b) => b.score - a.score);
    
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding: 8px; color: #888;">未找到相关榫卯类型</div>';
    } else {
        resultsDiv.innerHTML = results.map(r => `
            <div class="search-result-item" onclick="selectSearchResult('${r.key}')">
                <div style="font-weight: bold;">${r.name}</div>
                <div style="font-size: 10px; color: #888;">${r.category} | 匹配度: ${r.score}</div>
            </div>
        `).join('');
    }
    resultsDiv.style.display = 'block';
}

function searchByTag(tag) {
    document.getElementById('search-input').value = tag;
    smartSearch(tag);
}

function selectSearchResult(modelKey) {
    document.getElementById('model-selector').value = modelKey;
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('search-input').value = '';
    loadSelectedModel();
}

function loadSelectedModel() {
    const modelId = document.getElementById('model-selector').value;
    if (!modelId) return;
    
    document.getElementById('loading').style.display = 'block';
    
    try {
        clearCurrentModel();
        
        setTimeout(() => {
            createModel(modelId);
            document.getElementById('loading').style.display = 'none';
            
            const data = modelData[modelId];
            updateModelInfo(data);
            updateStressNodes(data);
            
            console.log('模型加载成功:', modelId);
        }, 300);
    } catch (error) {
        console.error('模型加载失败:', error);
        document.getElementById('loading').style.display = 'none';
        alert('模型加载失败');
    }
}

function createModel(modelId) {
    const data = modelData[modelId];
    
    if (currentModel) {
        scene.remove(currentModel);
    }
    
    const group = new THREE.Group();
    group.name = modelId;
    
    data.components.forEach((comp, index) => {
        try {
            const geometry = createComponentGeometry(comp.size);
            const material = new THREE.MeshPhongMaterial({
                color: getWoodColor(index),
                shininess: qualityLevel === 'low' ? 10 : 30,
                specular: 0x555555
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(comp.position.x, comp.position.y, comp.position.z);
            mesh.castShadow = useShadows;
            mesh.receiveShadow = useShadows;
            mesh.name = comp.name;
            
            mesh.userData = {
                originalPosition: { ...comp.position },
                disassemblePosition: { ...comp.disassemblePos },
                dockingPoint: { ...comp.dockingPoint },
                size: { ...comp.size },
                stiffness: comp.stiffness,
                index: index
            };
            
            group.add(mesh);
            modelComponents.push(mesh);
        } catch (error) {
            console.error('创建构件失败:', comp.name, error);
        }
    });
    
    scene.add(group);
    currentModel = group;
    
    centerCamera();
    updateVertexCount();
}

function createComponentGeometry(size) {
    if (qualityLevel === 'low') {
        return new THREE.BoxGeometry(size.x, size.y, size.z, 1, 1, 1);
    } else if (qualityLevel === 'medium') {
        return new THREE.BoxGeometry(size.x, size.y, size.z, 2, 2, 2);
    } else {
        return new THREE.BoxGeometry(size.x, size.y, size.z, 4, 4, 4);
    }
}

function getWoodColor(index) {
    const colors = [0x8B4513, 0xA0522D, 0xCD853F, 0xD2691E];
    return colors[index % colors.length];
}

function clearCurrentModel() {
    try {
        isAnimating = false;
        isPlaying = false;
        isRecording = false;
        
        if (currentModel) {
            scene.remove(currentModel);
            currentModel.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            currentModel = null;
        }
        
        modelComponents = [];
        clearStressMarkers();
        clearForceVectors();
        clearDeformationMeshes();
        clearDockingMarkers();
        animationProgress = 0;
        
        const slider = document.getElementById('step-slider');
        if (slider) slider.value = 0;
        const stepValue = document.getElementById('step-value');
        if (stepValue) stepValue.textContent = '0';
        
    } catch (error) {
        console.error('清理模型失败:', error);
    }
}

function centerCamera() {
    if (currentModel) {
        try {
            const box = new THREE.Box3().setFromObject(currentModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
            
            controls.target.copy(center);
            camera.position.set(
                center.x + cameraZ * 0.5,
                center.y + cameraZ * 0.3,
                center.z + cameraZ * 0.5
            );
            controls.update();
        } catch (error) {
            console.error('相机居中失败:', error);
        }
    }
}

function updateVertexCount() {
    let totalVertices = 0;
    let totalFaces = 0;
    modelComponents.forEach(mesh => {
        if (mesh.geometry) {
            const posAttr = mesh.geometry.getAttribute('position');
            if (posAttr) totalVertices += posAttr.count;
            if (mesh.geometry.index) {
                totalFaces += mesh.geometry.index.count / 3;
            }
        }
    });
    document.getElementById('vertices-display').textContent = Math.round(totalVertices);
    document.getElementById('vertex-count').textContent = Math.round(totalVertices);
    document.getElementById('face-count').textContent = Math.round(totalFaces);
}

function startDisassembly() {
    if (modelComponents.length === 0) {
        alert('请先选择模型');
        return;
    }
    
    if (animationProgress >= 1) {
        animationProgress = 1;
        return;
    }
    
    animationDirection = 1;
    isAnimating = true;
    isPaused = false;
    console.log('开始拆解');
}

function startAssembly() {
    if (modelComponents.length === 0) {
        alert('请先选择模型');
        return;
    }
    
    if (animationProgress <= 0) {
        animationProgress = 0;
        return;
    }
    
    animationDirection = -1;
    isAnimating = true;
    isPaused = false;
    console.log('开始装配');
}

function toggleAnimation() {
    isPaused = !isPaused;
    console.log(isPaused ? '动画暂停' : '动画继续');
}

function setDisassemblyStep(value) {
    animationProgress = parseInt(value) / 100;
    updateComponentPositions();
    document.getElementById('step-value').textContent = value;
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateComponentPositions() {
    if (modelComponents.length === 0) return;
    
    try {
        const easedProgress = easeInOutCubic(animationProgress);
        
        modelComponents.forEach(mesh => {
            const original = mesh.userData.originalPosition;
            const disassemble = mesh.userData.disassemblePosition;
            
            const targetX = original.x + (disassemble.x - original.x) * easedProgress;
            const targetY = original.y + (disassemble.y - original.y) * easedProgress;
            const targetZ = original.z + (disassemble.z - original.z) * easedProgress;
            
            mesh.position.x += (targetX - mesh.position.x) * EASE_FACTOR;
            mesh.position.y += (targetY - mesh.position.y) * EASE_FACTOR;
            mesh.position.z += (targetZ - mesh.position.z) * EASE_FACTOR;
        });
        
        checkDockingPrecision();
        updateStressDistribution();
        
    } catch (error) {
        console.error('更新构件位置失败:', error);
    }
}

function toggleRecording() {
    if (isRecording) {
        isRecording = false;
        document.getElementById('recording-indicator').style.display = 'none';
        document.getElementById('play-btn').disabled = recordedFrames.length === 0;
        console.log('录制停止，帧数:', recordedFrames.length);
        updateRecordList();
    } else {
        if (modelComponents.length === 0) {
            alert('请先加载模型');
            return;
        }
        isRecording = true;
        recordedFrames = [];
        document.getElementById('recording-indicator').style.display = 'inline-block';
        document.getElementById('play-btn').disabled = true;
        console.log('开始录制');
    }
}

function recordFrame() {
    if (!isRecording || modelComponents.length === 0) return;
    
    const frame = {
        progress: animationProgress,
        cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        targetPosition: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        componentPositions: modelComponents.map(m => ({
            x: m.position.x, y: m.position.y, z: m.position.z
        })),
        timestamp: Date.now()
    };
    
    recordedFrames.push(frame);
}

function togglePlayback() {
    if (recordedFrames.length === 0) {
        alert('没有可播放的录制内容');
        return;
    }
    
    if (isPlaying) {
        isPlaying = false;
        console.log('播放停止');
    } else {
        isPlaying = true;
        playbackIndex = 0;
        console.log('开始播放，总帧数:', recordedFrames.length);
    }
}

function playFrame() {
    if (!isPlaying || recordedFrames.length === 0) return;
    
    const frame = recordedFrames[playbackIndex];
    if (!frame) {
        isPlaying = false;
        console.log('播放完成');
        return;
    }
    
    animationProgress = frame.progress;
    document.getElementById('step-slider').value = Math.round(animationProgress * 100);
    document.getElementById('step-value').textContent = Math.round(animationProgress * 100);
    
    camera.position.set(frame.cameraPosition.x, frame.cameraPosition.y, frame.cameraPosition.z);
    controls.target.set(frame.targetPosition.x, frame.targetPosition.y, frame.targetPosition.z);
    controls.update();
    
    frame.componentPositions.forEach((pos, i) => {
        if (modelComponents[i]) {
            modelComponents[i].position.set(pos.x, pos.y, pos.z);
        }
    });
    
    playbackIndex += Math.ceil(playbackSpeed);
}

function setPlaybackSpeed(value) {
    playbackSpeed = parseInt(value) / 100;
    document.getElementById('playback-speed-value').textContent = playbackSpeed.toFixed(1);
}

function saveRecording() {
    if (recordedFrames.length === 0) {
        alert('没有可保存的录制内容');
        return;
    }
    
    const recordingData = {
        modelId: document.getElementById('model-selector').value,
        frames: recordedFrames,
        date: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(recordingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `榫卯拆解录制_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('录制已保存');
}

function loadRecording() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (data.modelId) {
                    document.getElementById('model-selector').value = data.modelId;
                    loadSelectedModel();
                }
                recordedFrames = data.frames || [];
                document.getElementById('play-btn').disabled = recordedFrames.length === 0;
                updateRecordList();
                console.log('录制已加载，帧数:', recordedFrames.length);
            } catch (err) {
                console.error('加载录制失败:', err);
                alert('加载录制失败');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function clearRecording() {
    recordedFrames = [];
    playbackIndex = 0;
    isPlaying = false;
    document.getElementById('play-btn').disabled = true;
    updateRecordList();
    console.log('录制已清空');
}

function updateRecordList() {
    const listDiv = document.getElementById('record-list');
    if (recordedFrames.length === 0) {
        listDiv.innerHTML = '<div style="color: #888; font-size: 11px;">暂无录制内容</div>';
    } else {
        listDiv.innerHTML = `
            <div style="color: #aaa; font-size: 11px;">
                已录制 ${recordedFrames.length} 帧，时长约 ${(recordedFrames.length / 60).toFixed(1)}秒
            </div>
        `;
    }
}

function toggleForceSimulation() {
    forceSimulationEnabled = !forceSimulationEnabled;
    const btn = document.getElementById('btn-force');
    if (forceSimulationEnabled) {
        btn.classList.add('active');
        createForceVectors();
        createDeformationMeshes();
    } else {
        btn.classList.remove('active');
        clearForceVectors();
        clearDeformationMeshes();
    }
}

function toggleForceCalculation(enabled) {
    forceCalculationEnabled = enabled;
    if (enabled && forceSimulationEnabled) {
        createForceVectors();
        createDeformationMeshes();
    }
}

function applyLoad(loadType) {
    currentLoadType = loadType;
    const loadNames = { compression: '压力', tension: '拉力', shear: '剪力', none: '无' };
    document.getElementById('current-load-type').textContent = loadNames[loadType] || '无';
    
    if (forceSimulationEnabled) {
        updateForceVectors();
        updateDeformationMeshes();
    }
    
    console.log('施加荷载:', loadType, '强度:', loadIntensity);
}

function setLoadIntensity(value) {
    loadIntensity = parseInt(value) / 100;
    document.getElementById('load-intensity-value').textContent = value;
    
    if (forceSimulationEnabled) {
        updateForceVectors();
        updateDeformationMeshes();
    }
}

function createForceVectors() {
    clearForceVectors();
    
    if (!currentModel) return;
    
    const modelId = document.getElementById('model-selector').value;
    const data = modelData[modelId];
    if (!data) return;
    
    data.stressNodes.forEach(node => {
        const dir = new THREE.Vector3();
        switch (currentLoadType) {
            case 'compression': dir.set(0, -1, 0); break;
            case 'tension': dir.set(0, 1, 0); break;
            case 'shear': dir.set(1, 0, 0); break;
            default: dir.set(0, 0, 0); break;
        }
        
        const length = loadIntensity * 2;
        const color = getStressColor(node.baseStress * loadIntensity / 80);
        
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(node.position.x, node.position.y, node.position.z), 
            length, color, 0.1, 0.05);
        scene.add(arrow);
        forceVectors.push(arrow);
    });
}

function updateForceVectors() {
    forceVectors.forEach((arrow, i) => {
        const modelId = document.getElementById('model-selector').value;
        const node = modelData[modelId]?.stressNodes[i];
        if (node) {
            const length = loadIntensity * 2;
            arrow.setLength(length, 0.1, 0.05);
            arrow.setColor(getStressColor(node.baseStress * loadIntensity / 80));
        }
    });
}

function clearForceVectors() {
    forceVectors.forEach(arrow => {
        scene.remove(arrow);
    });
    forceVectors = [];
}

function createDeformationMeshes() {
    clearDeformationMeshes();
    
    modelComponents.forEach(mesh => {
        const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.3 
        });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        wireframe.position.copy(mesh.position);
        wireframe.userData.parentMesh = mesh;
        scene.add(wireframe);
        deformationMeshes.push(wireframe);
    });
}

function updateDeformationMeshes() {
    deformationMeshes.forEach(wireframe => {
        const parentMesh = wireframe.userData.parentMesh;
        if (parentMesh && currentLoadType !== 'none') {
            const deformation = loadIntensity * 0.05;
            const random = Math.sin(Date.now() * 0.001) * 0.01;
            wireframe.scale.setScalar(1 + deformation + random);
            wireframe.position.copy(parentMesh.position);
        } else {
            wireframe.scale.setScalar(1);
            if (parentMesh) wireframe.position.copy(parentMesh.position);
        }
    });
}

function clearDeformationMeshes() {
    deformationMeshes.forEach(wireframe => {
        scene.remove(wireframe);
        if (wireframe.geometry) wireframe.geometry.dispose();
        if (wireframe.material) wireframe.material.dispose();
    });
    deformationMeshes = [];
}

function getStressColor(ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    let r, g, b;
    if (ratio < 0.5) {
        r = ratio * 2;
        g = 1;
        b = 0;
    } else {
        r = 1;
        g = 2 - ratio * 2;
        b = 0;
    }
    return new THREE.Color(r, g, b);
}

function updateStressDistribution() {
    if (!forceCalculationEnabled || stressMarkers.length === 0) return;
    
    const modelId = document.getElementById('model-selector').value;
    const data = modelData[modelId];
    if (!data) return;
    
    let maxStress = 0;
    
    data.stressNodes.forEach((node, i) => {
        const contactFactor = 1 - animationProgress * 0.3;
        const currentStress = node.baseStress * loadIntensity * contactFactor;
        maxStress = Math.max(maxStress, currentStress);
        
        const markerIdx = i * 2;
        if (stressMarkers[markerIdx]) {
            const color = getStressColor(currentStress / 80);
            stressMarkers[markerIdx].material.color = color;
        }
    });
    
    document.getElementById('max-stress-display').textContent = maxStress.toFixed(1);
    document.getElementById('stress-max').textContent = maxStress.toFixed(1);
    document.getElementById('safety-factor-display').textContent = 
        (80 / Math.max(maxStress, 1)).toFixed(2);
    document.getElementById('deformation-max').textContent = 
        (loadIntensity * animationProgress * 5).toFixed(2);
}

function checkDockingPrecision() {
    if (animationProgress < DOCKING_PRECISION && modelComponents.length >= 2) {
        showDockingSuccess();
    } else {
        hideDockingSuccess();
    }
}

function showDockingSuccess() {
    if (dockingMarkers.length === 0) {
        const markerGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(0, 0, 0);
        scene.add(marker);
        dockingMarkers.push(marker);
        
        const ringGeometry = new THREE.RingGeometry(0.2, 0.3, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.set(0, 0, 0);
        ring.lookAt(camera.position);
        scene.add(ring);
        dockingMarkers.push(ring);
        
        console.log('对接成功，精度达标');
    }
}

function hideDockingSuccess() {
    dockingMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    });
    dockingMarkers = [];
}

function clearDockingMarkers() {
    hideDockingSuccess();
}

function toggleStressView() {
    stressViewEnabled = !stressViewEnabled;
    const legend = document.getElementById('stress-legend');
    const btn = document.getElementById('btn-stress');
    
    if (stressViewEnabled) {
        legend.style.display = 'block';
        btn.classList.add('active');
        showStressMarkers();
        highlightStressAreas();
    } else {
        legend.style.display = 'none';
        btn.classList.remove('active');
        clearStressMarkers();
        resetMaterialColors();
    }
}

function showStressMarkers() {
    const modelId = document.getElementById('model-selector').value;
    if (!modelId) return;
    
    const data = modelData[modelId];
    
    data.stressNodes.forEach(node => {
        try {
            const stressRatio = Math.min(node.baseStress / 80, 1);
            const color = getStressColor(stressRatio);
            
            const geometry = new THREE.SphereGeometry(0.12, 16, 16);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(node.position.x, node.position.y, node.position.z);
            marker.userData = { nodeData: node };
            
            scene.add(marker);
            stressMarkers.push(marker);
            
            const ringGeometry = new THREE.RingGeometry(0.15, 0.2, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.copy(marker.position);
            ring.lookAt(camera.position);
            scene.add(ring);
            stressMarkers.push(ring);
        } catch (error) {
            console.error('创建应力标记失败:', error);
        }
    });
}

function clearStressMarkers() {
    stressMarkers.forEach(marker => {
        scene.remove(marker);
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) marker.material.dispose();
    });
    stressMarkers = [];
}

function highlightStressAreas() {
    modelComponents.forEach((mesh, index) => {
        const colors = [0xff6b6b, 0xffd93d, 0x6bcb77];
        mesh.material.color.setHex(colors[index % colors.length]);
    });
}

function resetMaterialColors() {
    modelComponents.forEach((mesh, index) => {
        mesh.material.color.setHex(getWoodColor(index));
    });
}

async function showDocuments() {
    const panel = document.getElementById('document-panel');
    const docList = document.getElementById('document-list');
    
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
        return;
    }
    
    const modelId = document.getElementById('model-selector').value;
    if (!modelId) {
        alert('请先选择一个模型');
        return;
    }
    
    docList.innerHTML = '<div style="color: #aaa; text-align: center; padding: 20px;">正在加载文献...</div>';
    panel.style.display = 'block';
    
    const modelDataItem = modelData[modelId];
    const relatedDocs = documents.filter(doc => modelDataItem.documentIds.includes(doc.id));
    
    setTimeout(() => {
        docList.innerHTML = `
            <div style="margin-bottom: 10px; padding: 8px; background: rgba(233,69,96,0.1); border-radius: 4px;">
                <strong>关联文献 (${relatedDocs.length}篇)</strong>
            </div>
            ${relatedDocs.map(doc => `
                <div class="record-item" onclick="viewDocument('${doc.title}', ${doc.id})">
                    <div style="font-weight: bold; margin-bottom: 3px;">📜 ${doc.title}</div>
                    <div style="font-size: 10px; color: #aaa;">
                        作者: ${doc.author} | 时期: ${doc.dynasty}
                    </div>
                    <div style="font-size: 10px; color: #888; margin-top: 3px;">${doc.description}</div>
                </div>
            `).join('')}
        `;
    }, 300);
}

function viewDocument(title, id) {
    console.log(`查看文献: ${title}, ID: ${id}`);
    alert(`📜 正在查看文献: ${title}\n\nID: ${id}\n\n(实际项目中这里会打开PDF阅读器或文献详情页)\n\n✅ 模型与文献关联成功`);
}

function setQuality(level) {
    qualityLevel = level;
    console.log('设置画质级别:', level);
    
    if (currentModel) {
        const modelId = document.getElementById('model-selector').value;
        loadSelectedModel();
    }
    updateQualityDisplay();
}

function updateQualityDisplay() {
    const names = { low: '低画质', medium: '中画质', high: '高性能' };
    document.getElementById('quality-display').textContent = names[qualityLevel] || '高性能';
}

function toggleAA(enabled) {
    useAA = enabled;
    console.log('抗锯齿:', enabled ? '开启' : '关闭');
    alert('刷新页面后生效');
}

function toggleShadows(enabled) {
    useShadows = enabled;
    renderer.shadowMap.enabled = enabled;
    
    modelComponents.forEach(mesh => {
        mesh.castShadow = enabled;
        mesh.receiveShadow = enabled;
    });
    
    console.log('阴影效果:', enabled ? '开启' : '关闭');
}

function toggleLOD(enabled) {
    useLOD = enabled;
    console.log('LOD动态加载:', enabled ? '开启' : '关闭');
}

function setView(viewType) {
    const distance = 6;
    try {
        switch (viewType) {
            case 'front':
                camera.position.set(0, 0, distance);
                break;
            case 'top':
                camera.position.set(0, distance, 0.01);
                break;
            case 'side':
                camera.position.set(distance, 0, 0);
                break;
            case 'iso':
                camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
                break;
        }
        controls.target.set(0, 0, 0);
        controls.update();
    } catch (error) {
        console.error('切换视角失败:', error);
    }
}

function resetCamera() {
    camera.position.set(5, 3, 5);
    controls.target.set(0, 0, 0);
    controls.update();
}

function updateModelInfo(data) {
    document.getElementById('model-name').textContent = data.name;
    document.getElementById('component-count').textContent = data.components.length;
    document.getElementById('view-count').textContent = Math.floor(Math.random() * 1000) + 100;
}

function updateStressNodes(data) {
    const stressNodesDiv = document.getElementById('stress-nodes');
    stressNodesDiv.innerHTML = data.stressNodes.map(node => `
        <div style="margin-bottom: 8px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 4px;">📍 ${node.name}</div>
            <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span>基础应力: ${node.baseStress} MPa</span>
                <span style="color: ${node.safety > 0.8 ? '#28a745' : node.safety > 0.6 ? '#ffc107' : '#dc3545'}">
                    安全系数: ${node.safety}
                </span>
            </div>
            <div style="width: 100%; height: 4px; background: #333; border-radius: 2px; margin-top: 5px;">
                <div style="width: ${node.safety * 100}%; height: 100%; 
                     background: ${node.safety > 0.8 ? '#28a745' : node.safety > 0.6 ? '#ffc107' : '#dc3545'}; 
                     border-radius: 2px;"></div>
            </div>
        </div>
    `).join('');
}

function onWindowResize() {
    try {
        camera.aspect = (window.innerWidth - 340) / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth - 340, window.innerHeight);
    } catch (error) {
        console.error('窗口调整失败:', error);
    }
}

function updateFPS() {
    const now = performance.now();
    fpsFrames.push(now);
    
    while (fpsFrames.length > 0 && fpsFrames[0] <= now - 1000) {
        fpsFrames.shift();
    }
    
    if (now - fpsLastUpdate > 500) {
        fps = fpsFrames.length;
        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) {
            fpsDisplay.textContent = fps;
            fpsDisplay.className = fps >= 50 ? 'fps-good' : fps >= 30 ? 'fps-medium' : 'fps-low';
        }
        fpsLastUpdate = now;
    }
}

function startAnimationLoop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    function animate(currentTime) {
        animationFrameId = requestAnimationFrame(animate);
        
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        updateFPS();
        
        try {
            recordFrame();
            playFrame();
            
            if (isAnimating && !isPaused && deltaTime > 0) {
                const speedMultiplier = Math.min(deltaTime / 16, 3);
                animationProgress += 0.005 * animationDirection * speedMultiplier;
                
                if (animationProgress >= 1) {
                    animationProgress = 1;
                    isAnimating = false;
                    console.log('拆解完成');
                } else if (animationProgress <= 0) {
                    animationProgress = 0;
                    isAnimating = false;
                    console.log('装配完成，对接成功');
                }
                
                updateComponentPositions();
                
                const sliderValue = Math.round(animationProgress * 100);
                const slider = document.getElementById('step-slider');
                const stepValue = document.getElementById('step-value');
                if (slider && sliderValue !== parseInt(slider.value)) {
                    slider.value = sliderValue;
                    stepValue.textContent = sliderValue;
                }
            }
            
            const rotateSpeedInput = document.getElementById('rotate-speed');
            if (rotateSpeedInput && currentModel && qualityLevel !== 'low') {
                const rotateSpeed = rotateSpeedInput.value / 5000;
                if (rotateSpeed > 0) {
                    currentModel.rotation.y += rotateSpeed;
                }
            }
            
            const zoomLevelInput = document.getElementById('zoom-level');
            if (zoomLevelInput) {
                const zoomLevel = zoomLevelInput.value / 100;
                camera.fov = 60 / zoomLevel;
                camera.updateProjectionMatrix();
            }
            
            stressMarkers.forEach(marker => {
                if (marker.geometry && marker.geometry.type === 'RingGeometry') {
                    marker.lookAt(camera.position);
                }
            });
            
            dockingMarkers.forEach(marker => {
                if (marker.geometry && marker.geometry.type === 'RingGeometry') {
                    marker.lookAt(camera.position);
                }
            });
            
            updateDeformationMeshes();
            
            controls.update();
            renderer.render(scene, camera);
            
        } catch (error) {
            console.error('动画循环出错:', error);
        }
    }
    
    animate(0);
}

window.onerror = function(message, source, lineno, colno, error) {
    console.error('全局错误捕获:', message, source, lineno, colno, error);
    return false;
};

window.onload = init;
