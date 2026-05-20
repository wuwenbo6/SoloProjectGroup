class WoodProcessingApp {
    constructor() {
        this.woodGenerator = null;
        this.toolpathSimulator = null;
        this.stressCalculator = null;
        this.depthRenderer = null;
        this.preview3D = null;
        this.fileManager = null;
        this.currentProjectId = null;
        this.currentTab = 'wood';
        this.selectedProjectId = null;
        this.batchRunning = false;
        
        this.init();
    }

    init() {
        this.initCanvas();
        this.initModules();
        this.initEventListeners();
        this.updateProjectList();
        this.updateStatus('准备就绪');
        
        this.woodGenerator.generate({
            woodType: 'oak',
            ringDensity: 15,
            roughness: 50
        });
    }

    initCanvas() {
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            canvas.width = 800;
            canvas.height = 600;
        });

        document.getElementById('woodCanvas').classList.add('active');
    }

    initModules() {
        this.woodGenerator = new WoodGenerator(document.getElementById('woodCanvas'));
        this.toolpathSimulator = new ToolpathSimulator(document.getElementById('toolpathCanvas'));
        this.stressCalculator = new StressCalculator(document.getElementById('stressCanvas'));
        this.depthRenderer = new DepthRenderer(document.getElementById('depthCanvas'));
        this.preview3D = new Preview3D(document.getElementById('preview3DCanvas'));
        this.fileManager = new FileManager();
    }

    initEventListeners() {
        document.getElementById('generateWoodBtn').addEventListener('click', () => this.generateWood());
        document.getElementById('autoMatchBtn').addEventListener('click', () => this.autoMatchWood());
        
        document.getElementById('startToolpathBtn').addEventListener('click', () => this.startToolpath());
        document.getElementById('stopToolpathBtn').addEventListener('click', () => this.stopToolpath());
        
        document.getElementById('calculateStressBtn').addEventListener('click', () => this.calculateStress());
        document.getElementById('runFullSimulationBtn').addEventListener('click', () => this.runFullSimulation());
        document.getElementById('materialPreset').addEventListener('change', (e) => this.applyMaterialPreset(e.target.value));
        
        document.getElementById('renderDepthBtn').addEventListener('click', () => this.renderDepth());
        
        document.getElementById('saveBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => this.importProject(e));
        
        document.getElementById('deleteProjectBtn').addEventListener('click', () => this.deleteProject());
        document.getElementById('exportImageBtn').addEventListener('click', () => this.exportImage());
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportData());
        
        document.getElementById('startBatchBtn').addEventListener('click', () => this.startBatchGeneration());
        
        document.getElementById('resetViewBtn').addEventListener('click', () => this.preview3D.resetView());
        document.getElementById('autoRotateBtn').addEventListener('click', () => this.toggleAutoRotate());
        document.getElementById('renderMode').addEventListener('change', (e) => this.preview3D.setRenderMode(e.target.value));
        document.getElementById('export3DObjBtn').addEventListener('click', () => this.export3D('obj'));
        document.getElementById('export3DStlBtn').addEventListener('click', () => this.export3D('stl'));
        document.getElementById('heightScale').addEventListener('input', (e) => {
            document.getElementById('heightScaleValue').textContent = e.target.value;
            this.preview3D.setHeightScale(parseFloat(e.target.value));
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        this.initRangeSliders();
    }

    initRangeSliders() {
        const sliders = [
            { id: 'ringDensity', display: 'ringDensityValue', suffix: '' },
            { id: 'textureRoughness', display: 'textureRoughnessValue', suffix: '' },
            { id: 'toolDiameter', display: 'toolDiameterValue', suffix: 'mm' },
            { id: 'feedRate', display: 'feedRateValue', suffix: '' },
            { id: 'cutDepth', display: 'cutDepthValue', suffix: 'mm' },
            { id: 'lightIntensity', display: 'lightIntensityValue', suffix: '%' },
            { id: 'lightAngle', display: 'lightAngleValue', suffix: '°' },
            { id: 'ambientLight', display: 'ambientLightValue', suffix: '' },
            { id: 'heightScale', display: 'heightScaleValue', suffix: '' }
        ];

        sliders.forEach(slider => {
            const element = document.getElementById(slider.id);
            const display = document.getElementById(slider.display);
            if (element && display) {
                display.textContent = element.value + slider.suffix;
            }
        });
    }

    generateWood() {
        const woodType = document.getElementById('woodType').value;
        const ringDensity = parseInt(document.getElementById('ringDensity').value);
        const roughness = parseInt(document.getElementById('textureRoughness').value);

        this.woodGenerator.generate({
            woodType,
            ringDensity,
            roughness
        });

        this.update3DFromWood();
        this.updateStatus('木纹生成完成');
    }

    autoMatchWood() {
        const mode = document.getElementById('autoMatchMode').value;
        if (mode === 'none') {
            this.updateStatus('请选择自动匹配模式');
            return;
        }

        const match = this.woodGenerator.autoMatch(mode);
        if (match) {
            document.getElementById('woodType').value = match.woodType;
            document.getElementById('ringDensity').value = match.ringDensity;
            document.getElementById('ringDensityValue').textContent = match.ringDensity;
            document.getElementById('textureRoughness').value = match.roughness;
            document.getElementById('textureRoughnessValue').textContent = match.roughness;

            this.woodGenerator.generate({
                woodType: match.woodType,
                ringDensity: match.ringDensity,
                roughness: match.roughness
            });

            this.update3DFromWood();
            this.updateStatus(`自动匹配完成: ${match.description}`);
        }
    }

    startToolpath() {
        const toolType = document.getElementById('toolType').value;
        const toolDiameter = parseFloat(document.getElementById('toolDiameter').value);
        const feedRate = parseFloat(document.getElementById('feedRate').value);
        const cutDepth = parseFloat(document.getElementById('cutDepth').value);

        this.toolpathSimulator.start({
            toolType,
            toolDiameter,
            feedRate,
            cutDepth
        });

        this.updateStatus('刀路模拟运行中...');
    }

    stopToolpath() {
        this.toolpathSimulator.stop();
        this.update3DFromToolpath();
        this.updateStatus('刀路模拟已停止');
    }

    applyMaterialPreset(preset) {
        if (preset === 'custom') return;

        const material = this.stressCalculator.getMaterialPreset(preset);
        document.getElementById('materialStrength').value = material.strength;
        document.getElementById('elasticModulus').value = material.elasticModulus;
        document.getElementById('poissonRatio').value = material.poissonRatio;
        
        this.updateStatus(`已应用材质预设: ${material.name}`);
    }

    calculateStress() {
        const materialStrength = parseFloat(document.getElementById('materialStrength').value);
        const elasticModulus = parseFloat(document.getElementById('elasticModulus').value);
        const poissonRatio = parseFloat(document.getElementById('poissonRatio').value);
        const cuttingForce = parseFloat(document.getElementById('cuttingForce').value);
        const toolDiameter = parseFloat(document.getElementById('toolDiameter').value);
        const accuracy = document.getElementById('simulationAccuracy').value;

        const depthMap = this.toolpathSimulator.getCutDepthMap();

        const result = this.stressCalculator.calculateStress(depthMap, {
            materialStrength,
            elasticModulus,
            poissonRatio,
            cuttingForce,
            toolDiameter,
            accuracy
        });

        this.stressCalculator.visualize();
        document.getElementById('stressResult').textContent = this.stressCalculator.getResultText();
        this.switchTab('stress');
        this.updateStatus('应力计算完成');
    }

    runFullSimulation() {
        this.updateStatus('正在运行完整受力仿真...');
        
        setTimeout(() => {
            this.calculateStress();
            this.updateStatus('完整受力仿真完成');
        }, 100);
    }

    renderDepth() {
        const lightIntensity = parseFloat(document.getElementById('lightIntensity').value);
        const lightAngle = parseFloat(document.getElementById('lightAngle').value);
        const ambientLight = parseFloat(document.getElementById('ambientLight').value);

        let depthMap = this.woodGenerator.getDepthMap();
        
        if (this.toolpathSimulator.getCutDepthMap().some(v => v > 0)) {
            depthMap = this.toolpathSimulator.getCutDepthMap();
        }

        this.depthRenderer.render(depthMap, {
            lightIntensity,
            lightAngle,
            ambientLight
        });

        this.switchTab('depth');
        this.updateStatus('深度渲染完成');
    }

    switchTab(tab) {
        this.currentTab = tab;

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.querySelectorAll('canvas').forEach(canvas => {
            canvas.classList.remove('active');
        });

        document.getElementById(`${tab}Canvas`).classList.add('active');

        if (tab === '3d') {
            this.update3DPreview();
        }
    }

    update3DFromWood() {
        const depthMap = this.woodGenerator.getDepthMap();
        if (depthMap) {
            this.preview3D.setDepthMap(depthMap, this.woodGenerator.width, this.woodGenerator.height);
            const canvas = document.getElementById('woodCanvas');
            const ctx = canvas.getContext('2d');
            this.preview3D.setTexture(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
    }

    update3DFromToolpath() {
        const depthMap = this.toolpathSimulator.getCutDepthMap();
        if (depthMap && depthMap.some(v => v > 0)) {
            this.preview3D.setDepthMap(depthMap, this.toolpathSimulator.width, this.toolpathSimulator.height);
        }
    }

    update3DPreview() {
        const depthMap = this.toolpathSimulator.getCutDepthMap();
        if (depthMap && depthMap.some(v => v > 0)) {
            this.update3DFromToolpath();
        } else {
            this.update3DFromWood();
        }
        this.preview3D.render();
    }

    toggleAutoRotate() {
        this.preview3D.toggleAutoRotate();
        const btn = document.getElementById('autoRotateBtn');
        btn.textContent = this.preview3D.autoRotate ? '停止旋转' : '自动旋转';
    }

    export3D(format) {
        let content, filename, mimeType;

        if (format === 'obj') {
            content = this.preview3D.exportOBJ();
            filename = 'wood_model.obj';
            mimeType = 'text/plain';
        } else {
            content = this.preview3D.exportSTL();
            filename = 'wood_model.stl';
            mimeType = 'application/octet-stream';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.updateStatus(`已导出 ${format.toUpperCase()} 3D模型`);
    }

    startBatchGeneration() {
        if (this.batchRunning) {
            this.updateStatus('批量生成已在进行中...');
            return;
        }

        const count = parseInt(document.getElementById('batchCount').value);
        const variation = document.getElementById('variationLevel').value;
        const content = document.getElementById('batchContent').value;

        const woodTypes = ['oak', 'pine', 'walnut', 'mahogany', 'maple', 'cherry', 'ash', 'beech'];
        let variationRange;
        switch (variation) {
            case 'low':
                variationRange = { ring: [-3, 3], rough: [-10, 10] };
                break;
            case 'medium':
                variationRange = { ring: [-7, 7], rough: [-20, 20] };
                break;
            case 'high':
                variationRange = { ring: [-12, 12], rough: [-30, 30] };
                break;
        }

        const progressDiv = document.getElementById('batchProgress');
        progressDiv.style.display = 'block';
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        let current = 0;
        this.batchRunning = true;

        const generateNext = () => {
            if (current >= count || !this.batchRunning) {
                this.batchRunning = false;
                progressDiv.style.display = 'none';
                this.updateStatus(`批量生成完成: 已生成 ${count} 个项目`);
                this.updateProjectList();
                return;
            }

            const woodType = woodTypes[Math.floor(Math.random() * woodTypes.length)];
            const baseRing = 15;
            const baseRough = 50;
            const ringDensity = Math.max(5, Math.min(30, baseRing + Math.floor(Math.random() * (variationRange.ring[1] - variationRange.ring[0]) + variationRange.ring[0])));
            const roughness = Math.max(0, Math.min(100, baseRough + Math.floor(Math.random() * (variationRange.rough[1] - variationRange.rough[0]) + variationRange.rough[0])));

            this.woodGenerator.generate({ woodType, ringDensity, roughness });
            
            if (content === 'full') {
                this.toolpathSimulator.reset();
                this.toolpathSimulator.start({
                    toolType: 'flat',
                    toolDiameter: 6 + Math.random() * 10,
                    feedRate: 150 + Math.random() * 200,
                    cutDepth: 1 + Math.random() * 4
                });
            }

            const projectData = {
                woodData: this.woodGenerator.getData(),
                toolpathData: content === 'full' ? this.toolpathSimulator.getData() : null,
                settings: { woodType, ringDensity, textureRoughness: roughness }
            };

            this.fileManager.createProject(`批量_${woodType}_${current + 1}`, projectData);

            current++;
            const progress = (current / count) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${current}/${count}`;

            this.updateStatus(`批量生成中: ${current}/${count}`);

            setTimeout(generateNext, 100);
        };

        generateNext();
    }

    saveProject() {
        try {
            const projectName = document.getElementById('projectName').value || '未命名项目';

            const projectData = {
                woodData: this.woodGenerator.getData(),
                toolpathData: this.toolpathSimulator.getData(),
                stressData: this.stressCalculator.getData(),
                settings: {
                    woodType: document.getElementById('woodType').value,
                    ringDensity: document.getElementById('ringDensity').value,
                    textureRoughness: document.getElementById('textureRoughness').value,
                    toolType: document.getElementById('toolType').value,
                    toolDiameter: document.getElementById('toolDiameter').value,
                    feedRate: document.getElementById('feedRate').value,
                    cutDepth: document.getElementById('cutDepth').value,
                    materialStrength: document.getElementById('materialStrength').value,
                    elasticModulus: document.getElementById('elasticModulus').value,
                    poissonRatio: document.getElementById('poissonRatio').value,
                    materialDensity: document.getElementById('materialDensity').value,
                    cuttingForce: document.getElementById('cuttingForce').value,
                    lightIntensity: document.getElementById('lightIntensity').value,
                    lightAngle: document.getElementById('lightAngle').value,
                    ambientLight: document.getElementById('ambientLight').value
                }
            };

            if (this.currentProjectId) {
                const result = this.fileManager.updateProject(this.currentProjectId, projectData);
                if (result) {
                    this.updateStatus('项目已更新');
                } else {
                    this.updateStatus('项目更新失败');
                }
            } else {
                const project = this.fileManager.createProject(projectName, projectData);
                if (project) {
                    this.currentProjectId = project.id;
                    this.updateStatus('项目已保存');
                } else {
                    this.updateStatus('项目保存失败');
                }
            }

            this.updateProjectList();
        } catch (e) {
            console.error('保存项目失败:', e);
            this.updateStatus('保存失败: ' + e.message);
        }
    }

    loadProject(projectId) {
        try {
            const project = this.fileManager.getProject(projectId);
            if (!project) {
                this.updateStatus('项目不存在');
                return;
            }

            this.currentProjectId = projectId;
            document.getElementById('projectName').value = project.name || '';

            if (project.woodData) {
                this.woodGenerator.loadData(project.woodData);
            }

            if (project.toolpathData) {
                this.toolpathSimulator.loadData(project.toolpathData);
            }

            if (project.stressData) {
                this.stressCalculator.loadData(project.stressData);
                document.getElementById('stressResult').textContent = this.stressCalculator.getResultText();
            }

            if (project.settings) {
                const settings = project.settings;
                this.setInputValue('woodType', settings.woodType, 'oak');
                this.setInputValue('ringDensity', settings.ringDensity, 15);
                this.setInputValue('textureRoughness', settings.textureRoughness, 50);
                this.setInputValue('toolType', settings.toolType, 'flat');
                this.setInputValue('toolDiameter', settings.toolDiameter, 6);
                this.setInputValue('feedRate', settings.feedRate, 200);
                this.setInputValue('cutDepth', settings.cutDepth, 2);
                this.setInputValue('materialStrength', settings.materialStrength, 50);
                this.setInputValue('elasticModulus', settings.elasticModulus, 12);
                this.setInputValue('poissonRatio', settings.poissonRatio, 0.35);
                this.setInputValue('materialDensity', settings.materialDensity, 650);
                this.setInputValue('cuttingForce', settings.cuttingForce, 100);
                this.setInputValue('lightIntensity', settings.lightIntensity, 70);
                this.setInputValue('lightAngle', settings.lightAngle, 45);
                this.setInputValue('ambientLight', settings.ambientLight, 20);
            }

            this.update3DFromWood();
            this.updateStatus('项目已加载');
        } catch (e) {
            console.error('加载项目失败:', e);
            this.updateStatus('项目加载失败: ' + e.message);
        }
    }

    setInputValue(id, value, defaultValue) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value !== undefined && value !== null ? value : defaultValue;
        }
    }

    importProject(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileManager.importFromJSON(file)
            .then(project => {
                if (project) {
                    this.updateProjectList();
                    this.updateStatus('项目导入成功');
                } else {
                    this.updateStatus('导入失败: 项目数据无效');
                }
            })
            .catch(err => {
                this.updateStatus('导入失败: ' + err.message);
            });

        event.target.value = '';
    }

    deleteProject() {
        try {
            if (!this.selectedProjectId) {
                this.updateStatus('请先选择要删除的项目');
                return;
            }

            if (confirm('确定要删除这个项目吗？')) {
                const success = this.fileManager.deleteProject(this.selectedProjectId);
                
                if (success) {
                    if (this.currentProjectId === this.selectedProjectId) {
                        this.currentProjectId = null;
                    }
                    this.selectedProjectId = null;
                    this.updateStatus('项目已删除');
                } else {
                    this.updateStatus('删除失败');
                }
                
                this.updateProjectList();
            }
        } catch (e) {
            console.error('删除项目失败:', e);
            this.updateStatus('删除失败: ' + e.message);
        }
    }

    exportImage() {
        try {
            const activeCanvas = document.querySelector('canvas.active');
            if (activeCanvas) {
                this.fileManager.exportImage(activeCanvas, `${this.currentTab}_view.png`);
                this.updateStatus('图片已导出');
            } else {
                this.updateStatus('没有可导出的画布');
            }
        } catch (e) {
            console.error('导出图片失败:', e);
            this.updateStatus('导出失败: ' + e.message);
        }
    }

    exportData() {
        try {
            const projectData = {
                woodData: this.woodGenerator.getData(),
                toolpathData: this.toolpathSimulator.getData(),
                stressData: this.stressCalculator.getData()
            };
            this.fileManager.exportToJSON({ name: 'export_data', ...projectData });
            this.updateStatus('数据已导出');
        } catch (e) {
            console.error('导出数据失败:', e);
            this.updateStatus('导出失败: ' + e.message);
        }
    }

    updateProjectList() {
        try {
            const listContainer = document.getElementById('projectList');
            const projects = this.fileManager.getAllProjects();

            listContainer.innerHTML = '';

            if (projects.length === 0) {
                listContainer.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">暂无保存的项目</div>';
                return;
            }

            projects.forEach(project => {
                if (!project) return;
                
                const item = document.createElement('div');
                item.className = 'project-item';
                if (project.id === this.selectedProjectId) {
                    item.classList.add('selected');
                }

                const date = new Date(project.updatedAt || project.createdAt);
                const dateStr = date.toLocaleDateString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                item.innerHTML = `
                    <div>${project.name || '未命名'}</div>
                    <div class="project-date">${dateStr}</div>
                `;

                item.addEventListener('click', () => {
                    this.selectedProjectId = project.id;
                    this.loadProject(project.id);
                    this.updateProjectList();
                });

                listContainer.appendChild(item);
            });
        } catch (e) {
            console.error('更新项目列表失败:', e);
        }
    }

    updateStatus(message) {
        try {
            const statusBox = document.getElementById('statusInfo');
            if (statusBox) {
                statusBox.innerHTML = `<p>${message || ''}</p>`;
            }
        } catch (e) {
            console.error('更新状态失败:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new WoodProcessingApp();
    } catch (e) {
        console.error('应用初始化失败:', e);
    }
});