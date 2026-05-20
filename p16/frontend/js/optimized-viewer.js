class AncientBookViewer {
    constructor() {
        this.currentScale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;
        this.scaleStep = 0.1;

        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastX = 0;
        this.lastY = 0;

        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 60;

        this.isSmoothRender = true;
        this.zoomAnimationId = null;
        this.panAnimationId = null;

        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initThumbnails();
        this.startPerformanceMonitor();
        this.initWebSocket();
        console.log('📜 古籍修复操作台已初始化（优化版）');
    }

    cacheElements() {
        this.viewerContainer = document.getElementById('viewerContainer');
        this.viewerCanvas = document.getElementById('viewerCanvas');
        this.imageWrapper = document.getElementById('imageWrapper');
        this.ancientPage = document.getElementById('ancientPage');

        this.zoomSlider = document.getElementById('zoomSlider');
        this.zoomValue = document.getElementById('zoomValue');
        this.zoomInBtn = document.getElementById('zoomInBtn');
        this.zoomOutBtn = document.getElementById('zoomOutBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');

        this.coordsValue = document.getElementById('coordsValue');
        this.panValue = document.getElementById('panValue');
        this.statusValue = document.getElementById('statusValue');
        this.fpsValue = document.getElementById('fpsValue');
        this.memoryValue = document.getElementById('memoryValue');

        this.showGridBtn = document.getElementById('showGridBtn');
        this.showRulerBtn = document.getElementById('showRulerBtn');
        this.smoothRenderBtn = document.getElementById('smoothRenderBtn');
        this.renderQuality = document.getElementById('renderQuality');

        this.gridOverlay = document.getElementById('gridOverlay');
        this.rulerH = document.getElementById('rulerH');
        this.rulerV = document.getElementById('rulerV');
        this.minimapViewport = document.getElementById('minimapViewport');

        this.recognizeBtn = document.getElementById('recognizeBtn');
        this.dialectInput = document.getElementById('dialectInput');
        this.dialectResult = document.getElementById('dialectResult');

        this.exportBtn = document.getElementById('exportBtn');
    }

    bindEvents() {
        this.viewerContainer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        this.viewerCanvas.addEventListener('mousedown', (e) => this.startPan(e));
        document.addEventListener('mousemove', (e) => this.pan(e));
        document.addEventListener('mouseup', () => this.endPan());

        this.viewerCanvas.addEventListener('dblclick', () => this.resetView());

        this.zoomSlider.addEventListener('input', (e) => this.setZoom(parseFloat(e.target.value) / 100));
        this.zoomSlider.addEventListener('change', () => this.updateZoomButtons());

        document.querySelectorAll('[data-zoom]').forEach(btn => {
            btn.addEventListener('click', () => {
                const zoom = btn.dataset.zoom;
                if (zoom === 'fit') {
                    this.fitToScreen();
                } else {
                    this.setZoom(parseFloat(zoom) / 100);
                }
            });
        });

        this.zoomInBtn.addEventListener('click', () => this.zoomIn());
        this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
        this.resetBtn.addEventListener('click', () => this.resetView());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        this.showGridBtn.addEventListener('click', () => this.toggleGrid());
        this.showRulerBtn.addEventListener('click', () => this.toggleRuler());
        this.smoothRenderBtn.addEventListener('click', () => this.toggleSmoothRender());
        this.renderQuality.addEventListener('change', () => this.updateRenderQuality());

        this.minimapViewport.addEventListener('mousedown', (e) => this.startMinimapDrag(e));
        document.addEventListener('mousemove', (e) => this.dragMinimap(e));
        document.addEventListener('mouseup', () => this.endMinimapDrag());

        this.recognizeBtn.addEventListener('click', () => this.recognizeVariants());

        this.exportBtn.addEventListener('click', () => this.exportAncientBook());

        document.querySelectorAll('.tool-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        this.viewerCanvas.addEventListener('mousemove', (e) => this.updateMouseCoords(e));

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.updateMinimapViewport(), 100);
        });
    }

    handleWheel(e) {
        e.preventDefault();

        if (this.zoomAnimationId) {
            cancelAnimationFrame(this.zoomAnimationId);
        }

        const delta = e.deltaY > 0 ? -this.scaleStep : this.scaleStep;
        const rect = this.viewerContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        this.zoomTowards(delta, mouseX, mouseY);
    }

    zoomTowards(delta, mouseX, mouseY) {
        const oldScale = this.currentScale;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.currentScale * (1 + delta)));

        const scaleChange = newScale / oldScale;

        const rect = this.viewerContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const imageCenterX = centerX - this.panX;
        const imageCenterY = centerY - this.panY;

        const mouseFromCenterX = mouseX - imageCenterX;
        const mouseFromCenterY = mouseY - imageCenterY;

        const panDeltaX = mouseFromCenterX * (1 - scaleChange);
        const panDeltaY = mouseFromCenterY * (1 - scaleChange);

        this.currentScale = newScale;
        this.panX += panDeltaX;
        this.panY += panDeltaY;

        this.updateTransform();
        this.updateZoomUI();
        this.updateMinimapViewport();
    }

    setZoom(scale) {
        const oldScale = this.currentScale;
        this.currentScale = Math.max(this.minScale, Math.min(this.maxScale, scale));

        const scaleChange = this.currentScale / oldScale;
        this.panX *= scaleChange;
        this.panY *= scaleChange;

        this.updateTransform();
        this.updateZoomUI();
        this.updateMinimapViewport();
    }

    zoomIn() {
        this.setZoom(this.currentScale * 1.2);
    }

    zoomOut() {
        this.setZoom(this.currentScale / 1.2);
    }

    fitToScreen() {
        const containerRect = this.viewerContainer.getBoundingClientRect();
        const imageRect = this.ancientPage.getBoundingClientRect();

        const scaleX = (containerRect.width - 100) / imageRect.width;
        const scaleY = (containerRect.height - 100) / imageRect.height;
        const fitScale = Math.min(scaleX, scaleY, 1);

        this.setZoom(fitScale);
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
    }

    resetView() {
        this.currentScale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateTransform();
        this.updateZoomUI();
        this.updateMinimapViewport();
    }

    startPan(e) {
        this.isPanning = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.viewerCanvas.style.cursor = 'grabbing';
        this.statusValue.textContent = '平移中...';
    }

    pan(e) {
        if (!this.isPanning) return;

        if (this.panAnimationId) {
            cancelAnimationFrame(this.panAnimationId);
        }

        this.panAnimationId = requestAnimationFrame(() => {
            const deltaX = e.clientX - this.lastX;
            const deltaY = e.clientY - this.lastY;

            this.panX += deltaX;
            this.panY += deltaY;

            this.lastX = e.clientX;
            this.lastY = e.clientY;

            this.updateTransform();
            this.updatePanUI();
            this.updateMinimapViewport();
        });
    }

    endPan() {
        this.isPanning = false;
        this.viewerCanvas.style.cursor = 'grab';
        this.statusValue.textContent = '就绪';
    }

    updateTransform() {
        const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.currentScale})`;
        this.imageWrapper.style.transform = transform;

        if (this.isSmoothRender) {
            this.imageWrapper.style.willChange = 'transform';
        } else {
            this.imageWrapper.style.willChange = 'auto';
        }
    }

    updateZoomUI() {
        const percent = Math.round(this.currentScale * 100);
        this.zoomSlider.value = percent;
        this.zoomValue.textContent = percent + '%';
    }

    updatePanUI() {
        this.panValue.textContent = `X: ${Math.round(this.panX)}px, Y: ${Math.round(this.panY)}px`;
    }

    updateZoomButtons() {
        document.querySelectorAll('[data-zoom]').forEach(btn => {
            const zoom = btn.dataset.zoom;
            if (zoom !== 'fit') {
                btn.classList.toggle('active', Math.abs(parseFloat(zoom) - this.currentScale * 100) < 1);
            }
        });
    }

    updateMouseCoords(e) {
        const rect = this.viewerContainer.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);
        this.coordsValue.textContent = `X: ${x}, Y: ${y}`;
    }

    toggleGrid() {
        this.showGridBtn.classList.toggle('active');
        this.gridOverlay.classList.toggle('visible');
    }

    toggleRuler() {
        this.showRulerBtn.classList.toggle('active');
        this.rulerH.classList.toggle('visible');
        this.rulerV.classList.toggle('visible');
    }

    toggleSmoothRender() {
        this.smoothRenderBtn.classList.toggle('active');
        this.isSmoothRender = this.smoothRenderBtn.classList.contains('active');
        this.updateTransform();
    }

    updateRenderQuality() {
        const quality = this.renderQuality.value;
        if (quality === 'low') {
            this.imageWrapper.style.imageRendering = 'pixelated';
        } else if (quality === 'medium') {
            this.imageWrapper.style.imageRendering = 'auto';
        } else {
            this.imageWrapper.style.imageRendering = 'high-quality';
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.viewerContainer.requestFullscreen().catch(err => {
                console.error('全屏错误:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    initThumbnails() {
        const container = document.getElementById('pageThumbnails');
        container.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const thumb = document.createElement('div');
            thumb.className = 'thumbnail' + (i === 1 ? ' active' : '');
            thumb.textContent = i;
            thumb.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                document.getElementById('currentPage').textContent = `第 ${i} 页`;
            });
            container.appendChild(thumb);
        }
    }

    startPerformanceMonitor() {
        const measureFPS = () => {
            this.frameCount++;
            const now = performance.now();

            if (now - this.lastFrameTime >= 1000) {
                this.fps = this.frameCount;
                this.frameCount = 0;
                this.lastFrameTime = now;

                this.fpsValue.textContent = this.fps;
                this.fpsValue.style.color = this.fps >= 50 ? '#28a745' :
                                             this.fps >= 30 ? '#ffc107' : '#dc3545';

                if (performance.memory) {
                    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
                    this.memoryValue.textContent = usedMB + 'MB';
                }
            }

            requestAnimationFrame(measureFPS);
        };

        requestAnimationFrame(measureFPS);
    }

    initThumbnails() {
        const container = document.getElementById('pageThumbnails');
        container.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const thumb = document.createElement('div');
            thumb.className = 'thumbnail' + (i === 1 ? ' active' : '');
            thumb.textContent = i;
            thumb.addEventListener('click', () => {
                document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                document.getElementById('currentPage').textContent = `第 ${i} 页`;
            });
            container.appendChild(thumb);
        }
    }

    initMinimap() {
        this.updateMinimapViewport();
    }

    updateMinimapViewport() {
        const containerRect = this.viewerContainer.getBoundingClientRect();
        const pageRect = this.ancientPage.getBoundingClientRect();

        const minimapWidth = 180;
        const minimapHeight = 225;
        const pageWidth = pageRect.width;
        const pageHeight = pageRect.height;

        const viewportWidth = (containerRect.width / pageWidth) * minimapWidth;
        const viewportHeight = (containerRect.height / pageHeight) * minimapHeight;

        const offsetX = (-this.panX / pageWidth) * minimapWidth;
        const offsetY = (-this.panY / pageHeight) * minimapHeight;

        this.minimapViewport.style.width = Math.min(viewportWidth, minimapWidth) + 'px';
        this.minimapViewport.style.height = Math.min(viewportHeight, minimapHeight) + 'px';
        this.minimapViewport.style.left = Math.max(0, Math.min(minimapWidth, offsetX)) + 'px';
        this.minimapViewport.style.top = Math.max(0, Math.min(minimapHeight, offsetY)) + 'px';
    }

    startMinimapDrag(e) {
        this.isMinimapDragging = true;
        this.minimapDragStartX = e.clientX;
        this.minimapDragStartY = e.clientY;
        e.preventDefault();
    }

    dragMinimap(e) {
        if (!this.isMinimapDragging) return;

        const deltaX = e.clientX - this.minimapDragStartX;
        const deltaY = e.clientY - this.minimapDragStartY;

        const minimapScale = 180 / this.ancientPage.offsetWidth;
        this.panX -= deltaX / minimapScale;
        this.panY -= deltaY / minimapScale;

        this.minimapDragStartX = e.clientX;
        this.minimapDragStartY = e.clientY;

        this.updateTransform();
        this.updatePanUI();
        this.updateMinimapViewport();
    }

    endMinimapDrag() {
        this.isMinimapDragging = false;
    }

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        switch (e.key.toLowerCase()) {
            case 'h':
                this.selectTool('hand');
                break;
            case 'z':
                this.selectTool('zoom');
                break;
            case 'r':
                this.selectTool('repair');
                break;
            case 'e':
                this.selectTool('eraser');
                break;
            case 'b':
                this.selectTool('brush');
                break;
            case '+':
            case '=':
                this.zoomIn();
                break;
            case '-':
                this.zoomOut();
                break;
            case '0':
                this.resetView();
                break;
            case 'f':
                this.fitToScreen();
                break;
        }
    }

    selectTool(toolName) {
        document.querySelectorAll('.tool-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tool === toolName);
        });
    }

    async recognizeVariants() {
        const text = this.dialectInput.value.trim();
        if (!text) {
            alert('请输入要识别的古文');
            return;
        }

        this.recognizeBtn.textContent = '识别中...';
        this.recognizeBtn.disabled = true;

        try {
            await new Promise(resolve => setTimeout(resolve, 800));

            const variants = [
                { variant: '说', standard: '悦', region: '通用', type: '通假字' },
                { variant: '见', standard: '现', region: '通用', type: '通假字' },
                { variant: '反', standard: '返', region: '通用', type: '通假字' },
                { variant: '蚤', standard: '早', region: '通用', type: '通假字' },
                { variant: '莫', standard: '暮', region: '通用', type: '通假字' }
            ];

            let resultHtml = '<div style="margin-bottom: 12px; font-weight: 600;">识别结果：</div>';
            let foundAny = false;

            for (const v of variants) {
                if (text.includes(v.variant)) {
                    foundAny = true;
                    resultHtml += `
                        <div class="variant-item" title="${v.type} - ${v.region}">
                            <strong>${v.variant}</strong> → ${v.standard}
                            <small>(${v.type})</small>
                        </div>
                    `;
                }
            }

            if (!foundAny) {
                resultHtml += '<div style="color: #666;">未检测到常见异体字</div>';
            }

            resultHtml += `
                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #eee;">
                    <div style="font-weight: 600; margin-bottom: 8px;">转换后的文本：</div>
                    <div style="line-height: 1.8;">${this.convertText(text, variants)}</div>
                </div>
            `;

            this.dialectResult.innerHTML = resultHtml;

        } catch (error) {
            this.dialectResult.innerHTML = `<div style="color: #dc3545;">识别失败: ${error.message}</div>`;
        } finally {
            this.recognizeBtn.textContent = '识别异体字';
            this.recognizeBtn.disabled = false;
        }
    }

    convertText(text, variants) {
        let converted = text;
        variants.forEach(v => {
            converted = converted.split(v.variant).join(`<span class="variant-item">${v.standard}</span>`);
        });
        return converted;
    }

    async exportAncientBook() {
        const format = document.getElementById('exportFormat').value;
        const textDirection = document.getElementById('textDirection').value;
        const includeCover = document.getElementById('includeCover').checked;
        const includeToc = document.getElementById('includeToc').checked;
        const enableWatermark = document.getElementById('enableWatermark').checked;

        this.exportBtn.textContent = '导出中...';
        this.exportBtn.disabled = true;

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));

            const exportData = {
                bookName: '大学',
                pages: 9,
                format,
                textDirection,
                includeCover,
                includeToc,
                enableWatermark,
                exportTime: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `古籍导出_大学_${new Date().toISOString().slice(0, 10)}.${format === 'html' ? 'html' : 'json'}`;
            a.click();
            URL.revokeObjectURL(url);

            alert('✅ 导出成功！\n\n格式: ' + format.toUpperCase() + '\n方向: ' + (textDirection === 'vertical' ? '传统竖排' : '现代横排'));

        } catch (error) {
            alert('❌ 导出失败: ' + error.message);
        } finally {
            this.exportBtn.textContent = '导出古籍';
            this.exportBtn.disabled = false;
        }
    }

    initWebSocket() {
        console.log('🔌 模拟 WebSocket 连接已建立');

        setInterval(() => {
            const fills = document.querySelectorAll('.progress-fill');
            fills.forEach(fill => {
                const current = parseInt(fill.style.width);
                if (current < 100) {
                    fill.style.width = Math.min(100, current + Math.random() * 2) + '%';
                    fill.parentElement.nextElementSibling.textContent = Math.round(parseFloat(fill.style.width)) + '%';
                }
            });
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ancientBookViewer = new AncientBookViewer();
});
