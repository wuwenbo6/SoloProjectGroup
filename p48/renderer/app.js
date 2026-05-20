const THREE = require('three');
const { OrbitControls } = require('three/examples/jsm/controls/OrbitControls.js');
const fs = require('fs');
const path = require('path');

const { readPLYFallback } = require('../worker/registration.js');
const RegistrationReportGenerator = require('./report_generator.js');

let scene, camera, renderer, controls;
let sourceCloud, targetCloud, deformedCloud;
let registrationResult = null;
let qualityStats = null;
let trajectoryLine, trajectoryPoints, fusedModelCloud;
let temporalResult = null;
let isPlaying = false;
let playInterval = null;

let sourceData = null;
let targetData = null;
let sequenceData = [];

const state = {
    showSource: true,
    showTarget: true,
    showDeformed: true,
    showErrorColors: true,
    showTrajectory: true,
    showFusedModel: true,
    pointSize: 1.0
};

function init() {
    const container = document.getElementById('canvasContainer');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    
    camera = new THREE.PerspectiveCamera(
        60,
        container.clientWidth / container.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 5);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    addGridHelper();
    
    window.addEventListener('resize', onWindowResize);
    setupEventListeners();
    animate();
    
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function addGridHelper() {
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x222222);
    scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(2);
    scene.add(axesHelper);
}

function onWindowResize() {
    const container = document.getElementById('canvasContainer');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function createPointCloudGeometry(data, colorType = 'original', errors = null) {
    const geometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(data.positions);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const colors = new Float32Array(positions.length);
    
    for (let i = 0; i < data.count; i++) {
        if (colorType === 'error' && errors && errors[i] !== undefined) {
            const normalizedError = Math.min(errors[i] / 0.2, 1.0);
            colors[i * 3] = normalizedError;
            colors[i * 3 + 1] = 1.0 - normalizedError;
            colors[i * 3 + 2] = 0;
        } else if (colorType === 'blue') {
            colors[i * 3] = 0.2;
            colors[i * 3 + 1] = 0.6;
            colors[i * 3 + 2] = 1.0;
        } else if (colorType === 'green') {
            colors[i * 3] = 0.2;
            colors[i * 3 + 1] = 1.0;
            colors[i * 3 + 2] = 0.4;
        } else if (colorType === 'yellow') {
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.8;
            colors[i * 3 + 2] = 0.1;
        } else {
            colors[i * 3] = data.colors[i * 3];
            colors[i * 3 + 1] = data.colors[i * 3 + 1];
            colors[i * 3 + 2] = data.colors[i * 3 + 2];
        }
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
}

function createPointCloudMaterial(size) {
    return new THREE.PointsMaterial({
        size: size,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9
    });
}

function updatePointClouds() {
    if (sourceCloud) scene.remove(sourceCloud);
    if (targetCloud) scene.remove(targetCloud);
    if (deformedCloud) scene.remove(deformedCloud);
    
    if (sourceData && state.showSource) {
        const geometry = createPointCloudGeometry(sourceData, 'blue');
        const material = createPointCloudMaterial(state.pointSize);
        sourceCloud = new THREE.Points(geometry, material);
        scene.add(sourceCloud);
    }
    
    if (targetData && state.showTarget) {
        const geometry = createPointCloudGeometry(targetData, 'green');
        const material = createPointCloudMaterial(state.pointSize);
        targetCloud = new THREE.Points(geometry, material);
        scene.add(targetCloud);
    }
    
    if (registrationResult && state.showDeformed) {
        const colorType = state.showErrorColors ? 'error' : 'yellow';
        const geometry = createPointCloudGeometry(
            registrationResult.deformedSource,
            colorType,
            registrationResult.errors
        );
        const material = createPointCloudMaterial(state.pointSize);
        deformedCloud = new THREE.Points(geometry, material);
        scene.add(deformedCloud);
    }
    
    updateTemporalVisualization();
}

function updateTemporalVisualization() {
    if (trajectoryLine) scene.remove(trajectoryLine);
    if (trajectoryPoints) scene.remove(trajectoryPoints);
    if (fusedModelCloud) scene.remove(fusedModelCloud);
    
    if (temporalResult && state.showTrajectory) {
        const trajectory = temporalResult.cameraTrajectory;
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = new Float32Array(trajectory.length * 3);
        
        for (let i = 0; i < trajectory.length; i++) {
            linePositions[i * 3] = trajectory[i].position[0];
            linePositions[i * 3 + 1] = trajectory[i].position[1];
            linePositions[i * 3 + 2] = trajectory[i].position[2];
        }
        
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
        trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(trajectoryLine);
        
        const pointsGeometry = new THREE.BufferGeometry();
        pointsGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const pointsMaterial = new THREE.PointsMaterial({ color: 0xff00ff, size: 0.15 });
        trajectoryPoints = new THREE.Points(pointsGeometry, pointsMaterial);
        scene.add(trajectoryPoints);
    }
    
    if (temporalResult && state.showFusedModel) {
        const geometry = createPointCloudGeometry(temporalResult.fusedModel, 'original');
        const material = createPointCloudMaterial(state.pointSize * 0.7);
        fusedModelCloud = new THREE.Points(geometry, material);
        scene.add(fusedModelCloud);
    }
}

function readPLYFile(filename) {
    try {
        return readPLYFallback(filename);
    } catch (e) {
        console.error('Error reading PLY:', e);
        throw e;
    }
}

function generateSamplePointCloud(type = 'sphere') {
    const count = 5000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
        if (type === 'sphere') {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 1.5 + Math.random() * 0.2;
            
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);
        } else {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 1.8 + Math.random() * 0.3;
            
            const scaleX = 0.8 + Math.sin(theta * 2) * 0.2;
            const scaleY = 1.2;
            const scaleZ = 1.0;
            
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta) * scaleX + 2;
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * scaleY;
            positions[i * 3 + 2] = r * Math.cos(phi) * scaleZ + 1;
        }
        
        colors[i * 3] = Math.random() * 0.3 + 0.7;
        colors[i * 3 + 1] = Math.random() * 0.3 + 0.7;
        colors[i * 3 + 2] = Math.random() * 0.3 + 0.7;
    }
    
    return { positions, colors, count };
}

function setupEventListeners() {
    document.getElementById('browseSource').addEventListener('click', async () => {
        const result = await window.electronAPI.openFileDialog([
            { name: 'PLY Files', extensions: ['ply'] },
            { name: 'All Files', extensions: ['*'] }
        ]);
        
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            document.getElementById('sourceFile').value = path.basename(filePath);
            
            try {
                sourceData = readPLYFile(filePath);
                document.getElementById('sourceInfo').textContent = 
                    `${sourceData.count} points loaded`;
                updatePointClouds();
                fitCameraToClouds();
            } catch (e) {
                alert('Error loading file: ' + e.message);
            }
        }
    });
    
    document.getElementById('browseTarget').addEventListener('click', async () => {
        const result = await window.electronAPI.openFileDialog([
            { name: 'PLY Files', extensions: ['ply'] },
            { name: 'All Files', extensions: ['*'] }
        ]);
        
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            document.getElementById('targetFile').value = path.basename(filePath);
            
            try {
                targetData = readPLYFile(filePath);
                document.getElementById('targetInfo').textContent = 
                    `${targetData.count} points loaded`;
                updatePointClouds();
                fitCameraToClouds();
            } catch (e) {
                alert('Error loading file: ' + e.message);
            }
        }
    });
    
    document.getElementById('loadSample').addEventListener('click', () => {
        sourceData = generateSamplePointCloud('sphere');
        targetData = generateSamplePointCloud('deformed');
        
        document.getElementById('sourceFile').value = 'sample_source.ply';
        document.getElementById('sourceInfo').textContent = `${sourceData.count} points (sample)`;
        
        document.getElementById('targetFile').value = 'sample_target.ply';
        document.getElementById('targetInfo').textContent = `${targetData.count} points (sample)`;
        
        updatePointClouds();
        fitCameraToClouds();
    });
    
    document.getElementById('startRegistration').addEventListener('click', async () => {
        if (!sourceData || !targetData) {
            alert('Please load both source and target point clouds first');
            return;
        }
        
        const params = {
            numNodes: parseInt(document.getElementById('numNodes').value),
            maxIterations: parseInt(document.getElementById('maxIterations').value),
            alpha: parseFloat(document.getElementById('alpha').value),
            beta: parseFloat(document.getElementById('beta').value),
            enableDownsampling: document.getElementById('enableDownsampling').checked,
            downsampleVoxelSize: parseFloat(document.getElementById('voxelSize').value),
            enableChunkedRegistration: document.getElementById('enableChunked').checked,
            numChunks: parseInt(document.getElementById('numChunks').value),
            enableVisibilityTest: document.getElementById('enableVisibility').checked,
            visibilityEpsilon: 0.001,
            enableMultiView: document.getElementById('enableMultiView').checked,
            numViews: parseInt(document.getElementById('numViews').value),
            enableColorFiltering: document.getElementById('enableColorFilter').checked,
            spatialSigma: parseFloat(document.getElementById('spatialSigma').value),
            colorSigma: parseFloat(document.getElementById('colorSigma').value)
        };
        
        document.getElementById('startRegistration').disabled = true;
        document.getElementById('cancelRegistration').disabled = false;
        document.getElementById('progressContainer').classList.remove('hidden');
        
        try {
            const result = await window.electronAPI.startRegistration(
                sourceData, targetData, params
            );
            
            if (result.success) {
                registrationResult = result;
                
                document.getElementById('avgError').textContent = 
                    result.averageError.toFixed(4);
                document.getElementById('maxError').textContent = 
                    result.maxError.toFixed(4);
                
                document.getElementById('progressText').textContent = 'Evaluating registration quality...';
                
                try {
                    qualityStats = await window.electronAPI.evaluateQuality(
                        registrationResult.deformedSource,
                        targetData,
                        { outlierThreshold: 3.0 }
                    );
                    
                    document.getElementById('rmse').textContent = 
                        qualityStats.rmse.toFixed(4);
                    document.getElementById('outlierRatio').textContent = 
                        (qualityStats.outlierRatio * 100).toFixed(2) + '%';
                    
                    document.getElementById('generateReport').disabled = false;
                } catch (qualityError) {
                    console.warn('Quality evaluation failed:', qualityError);
                }
                
                updatePointClouds();
                document.getElementById('saveResults').disabled = false;
                
                alert('Registration completed successfully!');
            } else {
                alert('Registration failed: ' + result.message);
            }
        } catch (e) {
            alert('Error during registration: ' + e.message);
            console.error(e);
        } finally {
            document.getElementById('startRegistration').disabled = false;
            document.getElementById('cancelRegistration').disabled = true;
            document.getElementById('progressContainer').classList.add('hidden');
        }
    });
    
    document.getElementById('cancelRegistration').addEventListener('click', async () => {
        await window.electronAPI.cancelRegistration();
    });
    
    document.getElementById('saveResults').addEventListener('click', async () => {
        if (!registrationResult) return;
        
        const result = await window.electronAPI.saveFileDialog([
            { name: 'PLY Files', extensions: ['ply'] }
        ]);
        
        if (!result.canceled) {
            savePLY(result.filePath, registrationResult.deformedSource);
            alert('Deformed point cloud saved successfully!');
        }
    });
    
    document.getElementById('generateReport').addEventListener('click', async () => {
        if (!qualityStats || !registrationResult) {
            alert('No registration results available to generate report');
            return;
        }
        
        try {
            const result = await window.electronAPI.showSaveDialog([
                { name: 'HTML Report', extensions: ['html'] }
            ]);
            
            if (!result.canceled) {
                const reportGenerator = new RegistrationReportGenerator();
                const reportHtml = reportGenerator.generateQualityReport(
                    qualityStats,
                    registrationResult,
                    sourceData,
                    targetData
                );
                
                fs.writeFileSync(result.filePath, reportHtml, 'utf-8');
                alert('Quality report generated successfully!');
            }
        } catch (e) {
            alert('Error generating report: ' + e.message);
            console.error(e);
        }
    });
    
    document.getElementById('showSource').addEventListener('change', (e) => {
        state.showSource = e.target.checked;
        updatePointClouds();
    });
    
    document.getElementById('showTarget').addEventListener('change', (e) => {
        state.showTarget = e.target.checked;
        updatePointClouds();
    });
    
    document.getElementById('showDeformed').addEventListener('change', (e) => {
        state.showDeformed = e.target.checked;
        updatePointClouds();
    });
    
    document.getElementById('showErrorColors').addEventListener('change', (e) => {
        state.showErrorColors = e.target.checked;
        updatePointClouds();
    });
    
    document.getElementById('pointSize').addEventListener('input', (e) => {
        state.pointSize = parseFloat(e.target.value);
        updatePointClouds();
    });
    
    document.getElementById('showTrajectory').addEventListener('change', (e) => {
        state.showTrajectory = e.target.checked;
        updatePointClouds();
    });
    
    document.getElementById('showFusedModel').addEventListener('change', (e) => {
        state.showFusedModel = e.target.checked;
        updatePointClouds();
    });
    
    document.getElementById('browseSequence').addEventListener('click', async () => {
        const result = await window.electronAPI.openMultipleFilesDialog([
            { name: 'PLY Files', extensions: ['ply'] },
            { name: 'All Files', extensions: ['*'] }
        ]);
        
        if (!result.canceled && result.filePaths.length > 0) {
            sequenceData = [];
            document.getElementById('sequenceFiles').value = 
                `${result.filePaths.length} files selected`;
            
            for (const filePath of result.filePaths) {
                try {
                    const cloud = readPLYFile(filePath);
                    sequenceData.push(cloud);
                } catch (e) {
                    console.error('Error loading:', filePath, e);
                }
            }
            
            const totalPoints = sequenceData.reduce((sum, c) => sum + c.count, 0);
            document.getElementById('sequenceInfo').textContent = 
                `${sequenceData.length} frames, ${totalPoints} total points`;
            
            document.getElementById('frameSlider').max = sequenceData.length - 1;
            document.getElementById('frameSlider').disabled = false;
            
            updatePointClouds();
            fitCameraToClouds();
        }
    });
    
    document.getElementById('frameSlider').addEventListener('input', (e) => {
        const frameIndex = parseInt(e.target.value);
        document.getElementById('frameNumber').textContent = frameIndex;
        
        if (sequenceData[frameIndex]) {
            sourceData = sequenceData[frameIndex];
            updatePointClouds();
        }
    });
    
    document.getElementById('startTemporalRegistration').addEventListener('click', async () => {
        if (sequenceData.length < 2) {
            alert('Please load at least 2 point cloud frames first');
            return;
        }
        
        const params = {
            useKeyframes: document.getElementById('useKeyframes').checked,
            keyframeInterval: parseInt(document.getElementById('keyframeInterval').value),
            fusionVoxelSize: parseFloat(document.getElementById('fusionVoxelSize').value)
        };
        
        document.getElementById('startTemporalRegistration').disabled = true;
        document.getElementById('cancelRegistration').disabled = false;
        document.getElementById('progressContainer').classList.remove('hidden');
        
        window.electronAPI.onTemporalRegistrationProgress((data) => {
            document.getElementById('progressBar').style.width = `${data.progress * 100}%`;
            document.getElementById('progressText').textContent = 
                `Frame ${data.currentFrame}/${data.totalFrames}: ${data.stage}`;
        });
        
        try {
            const result = await window.electronAPI.startTemporalRegistration(
                sequenceData, params
            );
            
            if (result.success) {
                temporalResult = result;
                
                updatePointClouds();
                document.getElementById('saveResults').disabled = false;
                document.getElementById('playSequence').disabled = false;
                
                alert(`Temporal registration completed!\n${result.totalFrames} frames processed`);
            } else {
                alert('Temporal registration failed: ' + result.message);
            }
        } catch (e) {
            alert('Error during temporal registration: ' + e.message);
            console.error(e);
        } finally {
            document.getElementById('startTemporalRegistration').disabled = false;
            document.getElementById('cancelRegistration').disabled = true;
            document.getElementById('progressContainer').classList.add('hidden');
        }
    });
    
    document.getElementById('playSequence').addEventListener('click', () => {
        if (!temporalResult) return;
        
        if (isPlaying) {
            clearInterval(playInterval);
            isPlaying = false;
            document.getElementById('playSequence').textContent = 'Play Sequence';
        } else {
            isPlaying = true;
            document.getElementById('playSequence').textContent = 'Stop';
            
            let currentFrame = 0;
            playInterval = setInterval(() => {
                if (currentFrame >= temporalResult.registeredFrames.length) {
                    clearInterval(playInterval);
                    isPlaying = false;
                    document.getElementById('playSequence').textContent = 'Play Sequence';
                    return;
                }
                
                document.getElementById('frameSlider').value = currentFrame;
                document.getElementById('frameNumber').textContent = currentFrame;
                sourceData = temporalResult.registeredFrames[currentFrame];
                updatePointClouds();
                
                currentFrame++;
            }, 100);
        }
    });
}

function fitCameraToClouds() {
    const center = new THREE.Vector3(0, 0, 0);
    let count = 0;
    
    if (sourceData) {
        for (let i = 0; i < sourceData.count; i++) {
            center.x += sourceData.positions[i * 3];
            center.y += sourceData.positions[i * 3 + 1];
            center.z += sourceData.positions[i * 3 + 2];
        }
        count += sourceData.count;
    }
    
    if (targetData) {
        for (let i = 0; i < targetData.count; i++) {
            center.x += targetData.positions[i * 3];
            center.y += targetData.positions[i * 3 + 1];
            center.z += targetData.positions[i * 3 + 2];
        }
        count += targetData.count;
    }
    
    if (count > 0) {
        center.divideScalar(count);
        controls.target.copy(center);
        camera.position.copy(center);
        camera.position.z += 5;
        controls.update();
    }
}

function savePLY(filename, cloudData) {
    let content = 'ply\n';
    content += 'format ascii 1.0\n';
    content += `element vertex ${cloudData.count}\n`;
    content += 'property float x\n';
    content += 'property float y\n';
    content += 'property float z\n';
    content += 'property uchar red\n';
    content += 'property uchar green\n';
    content += 'property uchar blue\n';
    content += 'end_header\n';
    
    for (let i = 0; i < cloudData.count; i++) {
        const x = cloudData.positions[i * 3];
        const y = cloudData.positions[i * 3 + 1];
        const z = cloudData.positions[i * 3 + 2];
        const r = Math.floor(cloudData.colors[i * 3] * 255);
        const g = Math.floor(cloudData.colors[i * 3 + 1] * 255);
        const b = Math.floor(cloudData.colors[i * 3 + 2] * 255);
        
        content += `${x} ${y} ${z} ${r} ${g} ${b}\n`;
    }
    
    fs.writeFileSync(filename, content);
}

init();
