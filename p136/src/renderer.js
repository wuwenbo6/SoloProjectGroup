const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

let lightFieldProcessor;
let currentImage = null;
let currentView = 'refocus';
let isProcessing = false;
let debounceTimer = null;
let currentPointCloud = null;

let cameraAngleX = 0;
let cameraAngleY = 0;
let cameraZoom = 1;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

try {
    const addonPath = path.join(__dirname, '..', 'build', 'Release', 'lightfield_addon.node');
    if (fs.existsSync(addonPath)) {
        const addon = require(addonPath);
        lightFieldProcessor = new addon.LightFieldProcessor();
    }
} catch (error) {
    console.error('Failed to load addon:', error);
}

const loadBtn = document.getElementById('loadBtn');
const focusSlider = document.getElementById('focusSlider');
const apertureSlider = document.getElementById('apertureSlider');
const depthValue = document.getElementById('depthValue');
const apertureValue = document.getElementById('apertureValue');
const fileInfo = document.getElementById('fileInfo');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const placeholder = document.getElementById('placeholder');
const displayCanvas = document.getElementById('displayCanvas');
const pointcloudCanvas = document.getElementById('pointcloud-canvas');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const memoryInfo = document.getElementById('memoryInfo');
const viewTabs = document.querySelectorAll('.view-tab');
const generatePointCloudBtn = document.getElementById('generatePointCloudBtn');
const exportPlyBtn = document.getElementById('exportPlyBtn');
const batchBtn = document.getElementById('batchBtn');
const batchProgress = document.getElementById('batchProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const outputFolderInput = document.getElementById('outputFolder');
const clickHint = document.getElementById('clickHint');
const pointInfo = document.getElementById('pointInfo');
const focusDepthDisplay = document.getElementById('focusDepthDisplay');
const refocusControls = document.getElementById('refocusControls');
const focalLengthInput = document.getElementById('focalLength');

function setProcessing(processing) {
    isProcessing = processing;
    if (processing) {
        statusDot.classList.add('processing');
        statusText.textContent = 'Processing...';
    } else {
        statusDot.classList.remove('processing');
        statusText.textContent = 'Ready';
    }
    updateMemoryInfo();
}

function updateMemoryInfo() {
    if (process.memoryUsage) {
        const usage = process.memoryUsage();
        const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
        const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
        memoryInfo.textContent = `Memory: ${heapMB} MB / ${totalMB} MB`;
    }
}

function displayImageData(imageData) {
    if (!imageData) return;

    const { width, height, channels, data } = imageData;

    displayCanvas.width = width;
    displayCanvas.height = height;
    displayCanvas.style.display = 'block';
    pointcloudCanvas.style.display = 'none';
    placeholder.style.display = 'none';

    const ctx = displayCanvas.getContext('2d');
    const imageDataObj = ctx.createImageData(width, height);

    for (let i = 0, j = 0; i < data.length; i += channels, j += 4) {
        imageDataObj.data[j] = data[i];
        imageDataObj.data[j + 1] = data[i + 1];
        imageDataObj.data[j + 2] = data[i + 2];
        imageDataObj.data[j + 3] = 255;
    }

    ctx.putImageData(imageDataObj, 0, 0);
    currentImage = imageData;

    if (global.gc) {
        setTimeout(() => global.gc(), 100);
    }
}

async function loadLightField() {
    if (!lightFieldProcessor) {
        alert('Native addon not loaded. Please build the project first.');
        return;
    }

    const result = await ipcRenderer.invoke('open-file-dialog');
    if (result.canceled || result.filePaths.length === 0) return;

    const filePath = result.filePaths[0];
    const viewsX = parseInt(document.getElementById('viewsX').value);
    const viewsY = parseInt(document.getElementById('viewsY').value);

    setProcessing(true);
    loadBtn.disabled = true;

    try {
        const success = await lightFieldProcessor.loadLightField(filePath, viewsX, viewsY);

        if (success) {
            const dims = await lightFieldProcessor.getDimensions();
            fileInfo.textContent = `Loaded: ${path.basename(filePath)}\nResolution: ${dims.width}x${dims.height}\nViews: ${dims.numViewsX}x${dims.numViewsY}`;

            focusSlider.disabled = false;
            apertureSlider.disabled = false;
            exportBtn.disabled = false;
            clearBtn.disabled = false;
            generatePointCloudBtn.disabled = false;
            exportPlyBtn.disabled = false;
            batchBtn.disabled = false;
            clickHint.style.display = 'block';
            pointInfo.style.display = 'block';

            updateRefocus();
        } else {
            alert('Failed to load light field image');
        }
    } catch (error) {
        console.error('Error loading light field:', error);
        alert('Error loading light field: ' + error.message);
    } finally {
        setProcessing(false);
        loadBtn.disabled = false;
    }
}

async function updateRefocus() {
    if (!lightFieldProcessor || isProcessing) return;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
        setProcessing(true);

        try {
            const focusDepth = parseFloat(focusSlider.value);
            const aperture = parseFloat(apertureSlider.value);

            depthValue.textContent = focusDepth.toFixed(2);
            apertureValue.textContent = aperture.toFixed(2);
            focusDepthDisplay.textContent = focusDepth.toFixed(2);

            const result = await lightFieldProcessor.refocus(focusDepth, aperture);
            if (result) {
                displayImageData(result);
            }
        } catch (error) {
            console.error('Error during refocus:', error);
        } finally {
            setProcessing(false);
        }
    }, 50);
}

async function computeAllInFocus() {
    if (!lightFieldProcessor) return;

    setProcessing(true);

    try {
        const result = await lightFieldProcessor.computeAllInFocus();
        if (result) {
            displayImageData(result);
        }
    } catch (error) {
        console.error('Error computing all-in-focus:', error);
    } finally {
        setProcessing(false);
    }
}

async function computeDepthMap() {
    if (!lightFieldProcessor) return;

    setProcessing(true);

    try {
        const result = await lightFieldProcessor.computeDepthMap();
        if (result) {
            displayImageData(result);
        }
    } catch (error) {
        console.error('Error computing depth map:', error);
    } finally {
        setProcessing(false);
    }
}

async function handleImageClick(event) {
    if (!lightFieldProcessor || isProcessing || currentView !== 'refocus') return;

    const rect = displayCanvas.getBoundingClientRect();
    const scaleX = displayCanvas.width / rect.width;
    const scaleY = displayCanvas.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

    setProcessing(true);
    statusText.textContent = 'Estimating focus depth...';

    try {
        const estimatedDepth = await lightFieldProcessor.estimateFocusDepth(x, y, 31);
        focusSlider.value = estimatedDepth;
        await updateRefocus();
    } catch (error) {
        console.error('Error estimating focus depth:', error);
    } finally {
        setProcessing(false);
    }
}

async function generatePointCloud() {
    if (!lightFieldProcessor) return;

    setProcessing(true);
    statusText.textContent = 'Generating point cloud...';

    try {
        const focalLength = parseFloat(focalLengthInput.value);
        const pointCloud = await lightFieldProcessor.generatePointCloud(focalLength, focalLength);
        currentPointCloud = pointCloud;
        renderPointCloud(pointCloud);
    } catch (error) {
        console.error('Error generating point cloud:', error);
    } finally {
        setProcessing(false);
    }
}

function renderPointCloud(pointCloud) {
    displayCanvas.style.display = 'none';
    placeholder.style.display = 'none';
    pointcloudCanvas.style.display = 'block';

    const container = pointcloudCanvas.parentElement;
    pointcloudCanvas.width = container.clientWidth;
    pointcloudCanvas.height = container.clientHeight;

    const ctx = pointcloudCanvas.getContext('2d');
    const width = pointcloudCanvas.width;
    const height = pointcloudCanvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    if (!pointCloud || pointCloud.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const point of pointCloud) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const scale = Math.min(width, height) / Math.max(maxX - minX, maxY - minY, maxZ - minZ) * 0.4 * cameraZoom;

    const sortedPoints = [...pointCloud].map(p => {
        const cosX = Math.cos(cameraAngleX);
        const sinX = Math.sin(cameraAngleX);
        const cosY = Math.cos(cameraAngleY);
        const sinY = Math.sin(cameraAngleY);

        let x = p.x - centerX;
        let y = p.y - centerY;
        let z = p.z - centerZ;

        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;

        return { x: x2, y: y1, z: z2, r: p.r, g: p.g, b: p.b };
    }).sort((a, b) => b.z - a.z);

    for (const point of sortedPoints) {
        const screenX = width / 2 + point.x * scale;
        const screenY = height / 2 + point.y * scale;

        const depthFactor = (point.z - minZ) / (maxZ - minZ + 1e-6);
        const size = 1 + depthFactor * 2;

        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${point.r}, ${point.g}, ${point.b})`;
        ctx.fill();
    }
}

function setupPointCloudInteraction() {
    pointcloudCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || currentView !== 'pointcloud') return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        cameraAngleY += dx * 0.01;
        cameraAngleX += dy * 0.01;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        if (currentPointCloud) {
            renderPointCloud(currentPointCloud);
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    pointcloudCanvas.addEventListener('wheel', (e) => {
        if (currentView !== 'pointcloud') return;
        e.preventDefault();
        cameraZoom *= e.deltaY > 0 ? 0.9 : 1.1;
        cameraZoom = Math.max(0.1, Math.min(5, cameraZoom));
        if (currentPointCloud) {
            renderPointCloud(currentPointCloud);
        }
    });
}

async function exportPly() {
    if (!currentPointCloud || currentPointCloud.length === 0) {
        alert('No point cloud to export. Generate one first.');
        return;
    }

    const result = await ipcRenderer.invoke('save-file-dialog', 'pointcloud.ply');
    if (result.canceled) return;

    let plyContent = `ply
format ascii 1.0
element vertex ${currentPointCloud.length}
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
`;

    for (const point of currentPointCloud) {
        plyContent += `${point.x} ${point.y} ${point.z} ${point.r} ${point.g} ${point.b}\n`;
    }

    fs.writeFileSync(result.filePath, plyContent);
    alert('Point cloud exported successfully!');
}

async function selectOutputFolder() {
    const result = await ipcRenderer.invoke('open-folder-dialog');
    if (!result.canceled && result.filePaths.length > 0) {
        outputFolderInput.value = result.filePaths[0];
    }
}

async function batchProcess() {
    if (!lightFieldProcessor) {
        alert('Native addon not loaded.');
        return;
    }

    const folderResult = await ipcRenderer.invoke('open-folder-dialog');
    if (folderResult.canceled) return;

    const inputFolder = folderResult.filePaths[0];
    let outputFolder = outputFolderInput.value;

    if (!outputFolder) {
        const outputResult = await ipcRenderer.invoke('open-folder-dialog');
        if (outputResult.canceled) return;
        outputFolder = outputResult.filePaths[0];
        outputFolderInput.value = outputFolder;
    }

    const files = fs.readdirSync(inputFolder)
        .filter(f => /\.(jpg|jpeg|png|bmp|tiff)$/i.test(f))
        .map(f => path.join(inputFolder, f));

    if (files.length === 0) {
        alert('No image files found in the selected folder.');
        return;
    }

    batchProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = `0 / ${files.length}`;

    const viewsX = parseInt(document.getElementById('viewsX').value);
    const viewsY = parseInt(document.getElementById('viewsY').value);

    for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        statusText.textContent = `Processing: ${path.basename(filePath)}`;
        progressFill.style.width = `${(i / files.length) * 100}%`;
        progressText.textContent = `${i} / ${files.length}`;

        try {
            const success = await lightFieldProcessor.loadLightField(filePath, viewsX, viewsY);
            if (!success) {
                console.warn(`Failed to load ${filePath}`);
                continue;
            }

            const baseName = path.basename(filePath, path.extname(filePath));

            const allInFocus = await lightFieldProcessor.computeAllInFocus();
            if (allInFocus) {
                const allInFocusCanvas = document.createElement('canvas');
                allInFocusCanvas.width = allInFocus.width;
                allInFocusCanvas.height = allInFocus.height;
                const ctx = allInFocusCanvas.getContext('2d');
                const imageData = ctx.createImageData(allInFocus.width, allInFocus.height);
                for (let j = 0, k = 0; j < allInFocus.data.length; j += allInFocus.channels, k += 4) {
                    imageData.data[k] = allInFocus.data[j];
                    imageData.data[k + 1] = allInFocus.data[j + 1];
                    imageData.data[k + 2] = allInFocus.data[j + 2];
                    imageData.data[k + 3] = 255;
                }
                ctx.putImageData(imageData, 0, 0);
                const pngData = allInFocusCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(path.join(outputFolder, `${baseName}_allfocus.png`), pngData, 'base64');
            }

            const depthMap = await lightFieldProcessor.computeDepthMap();
            if (depthMap) {
                const depthCanvas = document.createElement('canvas');
                depthCanvas.width = depthMap.width;
                depthCanvas.height = depthMap.height;
                const ctx = depthCanvas.getContext('2d');
                const imageData = ctx.createImageData(depthMap.width, depthMap.height);
                for (let j = 0, k = 0; j < depthMap.data.length; j += depthMap.channels, k += 4) {
                    imageData.data[k] = depthMap.data[j];
                    imageData.data[k + 1] = depthMap.data[j + 1];
                    imageData.data[k + 2] = depthMap.data[j + 2];
                    imageData.data[k + 3] = 255;
                }
                ctx.putImageData(imageData, 0, 0);
                const pngData = depthCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
                fs.writeFileSync(path.join(outputFolder, `${baseName}_depth.png`), pngData, 'base64');
            }

            lightFieldProcessor.releaseMemory();

        } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
        }
    }

    progressFill.style.width = '100%';
    progressText.textContent = `${files.length} / ${files.length}`;
    statusText.textContent = 'Batch processing complete!';
    setTimeout(() => {
        batchProgress.style.display = 'none';
        setProcessing(false);
    }, 2000);
}

async function exportImage() {
    if (!currentImage) return;

    const result = await ipcRenderer.invoke('save-file-dialog', `lightfield_${currentView}.png`);
    if (result.canceled) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = currentImage.width;
    exportCanvas.height = currentImage.height;
    const ctx = exportCanvas.getContext('2d');
    ctx.drawImage(displayCanvas, 0, 0);

    const dataUrl = exportCanvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

    fs.writeFileSync(result.filePath, base64Data, 'base64');
    alert('Image exported successfully!');
}

async function clearMemory() {
    if (!lightFieldProcessor) return;

    try {
        await lightFieldProcessor.releaseMemory();

        displayCanvas.style.display = 'none';
        pointcloudCanvas.style.display = 'none';
        placeholder.style.display = 'flex';
        clickHint.style.display = 'none';
        pointInfo.style.display = 'none';
        currentImage = null;
        currentPointCloud = null;

        focusSlider.disabled = true;
        apertureSlider.disabled = true;
        exportBtn.disabled = true;
        clearBtn.disabled = true;
        generatePointCloudBtn.disabled = true;
        exportPlyBtn.disabled = true;
        batchBtn.disabled = true;

        fileInfo.textContent = 'Memory cleared';
        updateMemoryInfo();

        if (global.gc) {
            global.gc();
        }
    } catch (error) {
        console.error('Error clearing memory:', error);
    }
}

function switchView(view) {
    currentView = view;

    viewTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });

    if (view === 'pointcloud') {
        refocusControls.style.display = 'none';
        if (!currentPointCloud) {
            generatePointCloud();
        } else {
            renderPointCloud(currentPointCloud);
        }
    } else {
        refocusControls.style.display = view === 'refocus' ? 'block' : 'none';
        displayCanvas.style.display = 'block';
        pointcloudCanvas.style.display = 'none';
        placeholder.style.display = currentImage ? 'none' : 'flex';

        switch (view) {
            case 'refocus':
                updateRefocus();
                break;
            case 'allFocus':
                computeAllInFocus();
                break;
            case 'depth':
                computeDepthMap();
                break;
        }
    }
}

loadBtn.addEventListener('click', loadLightField);
focusSlider.addEventListener('input', () => {
    if (currentView === 'refocus') updateRefocus();
});
apertureSlider.addEventListener('input', () => {
    if (currentView === 'refocus') updateRefocus();
});
exportBtn.addEventListener('click', exportImage);
clearBtn.addEventListener('click', clearMemory);
displayCanvas.addEventListener('click', handleImageClick);
generatePointCloudBtn.addEventListener('click', generatePointCloud);
exportPlyBtn.addEventListener('click', exportPly);
batchBtn.addEventListener('click', batchProcess);
outputFolderInput.addEventListener('click', selectOutputFolder);

viewTabs.forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
});

setupPointCloudInteraction();
setInterval(updateMemoryInfo, 2000);
updateMemoryInfo();
