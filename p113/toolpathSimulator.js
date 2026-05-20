class ToolpathSimulator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.isRunning = false;
        this.animationId = null;
        this.currentPosition = { x: 0, y: 0 };
        this.toolpath = [];
        this.currentPathIndex = 0;
        this.cutDepthMap = new Float32Array(this.width * this.height);
    }

    generateToolpath(toolType, toolDiameter, cutDepth, pattern = 'raster') {
        this.toolpath = [];
        const stepOver = toolDiameter * 0.6;
        const margin = toolDiameter * 3;
        const safeHeight = 10;
        
        if (pattern === 'raster') {
            let y = margin;
            let direction = 1;
            
            while (y < this.height - margin) {
                const startX = direction > 0 ? margin : this.width - margin;
                const endX = direction > 0 ? this.width - margin : margin;
                
                this.toolpath.push({ x: startX, y, z: safeHeight });
                this.toolpath.push({ x: startX, y, z: cutDepth });
                this.toolpath.push({ x: endX, y, z: cutDepth });
                this.toolpath.push({ x: endX, y, z: safeHeight });
                
                y += stepOver;
                direction *= -1;
            }
        } else if (pattern === 'contour') {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            let radius = Math.min(this.width, this.height) / 2 - margin;
            
            while (radius > toolDiameter) {
                const startAngle = 0;
                const startX = centerX + Math.cos(startAngle) * radius;
                const startY = centerY + Math.sin(startAngle) * radius;
                
                this.toolpath.push({ x: startX, y: startY, z: safeHeight });
                this.toolpath.push({ x: startX, y: startY, z: cutDepth });
                
                for (let angle = 0.05; angle <= Math.PI * 2 + 0.05; angle += 0.05) {
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    this.toolpath.push({ x, y, z: cutDepth });
                }
                
                this.toolpath.push({ x: startX, y: startY, z: safeHeight });
                radius -= stepOver;
            }
        } else if (pattern === 'spiral') {
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const maxRadius = Math.min(this.width, this.height) / 2 - margin;
            const angleStep = 0.1;
            const radiusStep = stepOver * angleStep / (2 * Math.PI);
            
            let radius = toolDiameter;
            let angle = 0;
            
            const startX = centerX + Math.cos(angle) * radius;
            const startY = centerY + Math.sin(angle) * radius;
            this.toolpath.push({ x: startX, y: startY, z: safeHeight });
            this.toolpath.push({ x: startX, y: startY, z: cutDepth });
            
            while (radius < maxRadius) {
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                this.toolpath.push({ x, y, z: cutDepth });
                angle += angleStep;
                radius += radiusStep;
            }
            
            const lastPoint = this.toolpath[this.toolpath.length - 1];
            this.toolpath.push({ x: lastPoint.x, y: lastPoint.y, z: safeHeight });
        }

        return this.toolpath;
    }

    getToolShape(type, diameter) {
        const shapes = {
            flat: (x, y, d) => {
                return Math.abs(x) <= d / 2 && Math.abs(y) <= d / 2 ? 1 : 0;
            },
            ball: (x, y, d) => {
                const dist = Math.sqrt(x * x + y * y);
                return dist <= d / 2 ? Math.sqrt((d / 2) ** 2 - dist ** 2) / (d / 2) : 0;
            },
            'v-shaped': (x, y, d) => {
                const dist = Math.sqrt(x * x + y * y);
                return dist <= d / 2 ? 1 - (dist / (d / 2)) : 0;
            }
        };
        return shapes[type] || shapes.flat;
    }

    updateCutDepth(position, toolType, toolDiameter, cutDepth) {
        const toolShape = this.getToolShape(toolType, toolDiameter);
        const radius = Math.ceil(toolDiameter / 2);

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = Math.floor(position.x) + dx;
                const y = Math.floor(position.y) + dy;
                
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    const depthFactor = toolShape(dx, dy, toolDiameter);
                    const newDepth = this.cutDepthMap[y * this.width + x] + cutDepth * depthFactor * 0.01;
                    this.cutDepthMap[y * this.width + x] = Math.min(1, newDepth);
                }
            }
        }
    }

    drawBackground() {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    drawToolpath() {
        if (this.toolpath.length < 2) return;
        
        this.ctx.lineWidth = 1.5;
        
        for (let i = 1; i < this.toolpath.length; i++) {
            const prev = this.toolpath[i - 1];
            const curr = this.toolpath[i];
            
            if (prev.z >= 5 || curr.z >= 5) {
                this.ctx.strokeStyle = 'rgba(255, 150, 100, 0.4)';
                this.ctx.setLineDash([5, 5]);
            } else {
                this.ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)';
                this.ctx.setLineDash([]);
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(prev.x, prev.y);
            this.ctx.lineTo(curr.x, curr.y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
    }

    drawCutArea() {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const depth = this.cutDepthMap[y * this.width + x];
                
                if (depth > 0) {
                    data[idx] = Math.floor(100 + depth * 100);
                    data[idx + 1] = Math.floor(100 + depth * 80);
                    data[idx + 2] = Math.floor(200 - depth * 50);
                    data[idx + 3] = Math.floor(100 + depth * 155);
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    drawTool(position, toolType, toolDiameter) {
        const radius = toolDiameter / 2;
        
        this.ctx.save();
        this.ctx.translate(position.x, position.y);
        
        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 2;
        
        if (toolType === 'flat') {
            this.ctx.strokeRect(-radius, -radius, toolDiameter, toolDiameter);
        } else if (toolType === 'ball') {
            this.ctx.beginPath();
            this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        } else if (toolType === 'v-shaped') {
            this.ctx.beginPath();
            this.ctx.moveTo(0, -radius);
            this.ctx.lineTo(radius, radius);
            this.ctx.lineTo(-radius, radius);
            this.ctx.closePath();
            this.ctx.stroke();
        }
        
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }

    start(options = {}) {
        const {
            toolType = 'flat',
            toolDiameter = 6,
            feedRate = 200,
            cutDepth = 2,
            pattern = 'raster'
        } = options;

        this.isRunning = true;
        this.currentPathIndex = 0;
        this.generateToolpath(toolType, toolDiameter, cutDepth, pattern);
        
        if (this.toolpath.length > 0) {
            this.currentPosition = { ...this.toolpath[0] };
        }

        const animate = () => {
            if (!this.isRunning) return;
            
            this.drawBackground();
            this.drawCutArea();
            this.drawToolpath();
            
            if (this.currentPathIndex < this.toolpath.length - 1) {
                const next = this.toolpath[this.currentPathIndex + 1];
                
                const dx = next.x - this.currentPosition.x;
                const dy = next.y - this.currentPosition.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const moveSpeed = Math.max(feedRate * 0.01, 0.5);
                
                if (dist < moveSpeed) {
                    this.currentPathIndex++;
                    if (this.currentPathIndex < this.toolpath.length) {
                        this.currentPosition = { ...this.toolpath[this.currentPathIndex] };
                    }
                } else {
                    this.currentPosition.x += (dx / dist) * moveSpeed;
                    this.currentPosition.y += (dy / dist) * moveSpeed;
                }
                
                if (next.z < 5) {
                    this.updateCutDepth(this.currentPosition, toolType, toolDiameter, cutDepth);
                }
            }
            
            this.drawTool(this.currentPosition, toolType, toolDiameter);
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    getCutDepthMap() {
        return this.cutDepthMap;
    }

    reset() {
        this.stop();
        this.currentPathIndex = 0;
        this.toolpath = [];
        this.cutDepthMap.fill(0);
        this.drawBackground();
    }

    getData() {
        return {
            toolpath: this.toolpath,
            cutDepthMap: Array.from(this.cutDepthMap),
            currentPathIndex: this.currentPathIndex
        };
    }

    loadData(data) {
        try {
            if (data && Array.isArray(data.toolpath)) {
                this.toolpath = data.toolpath.slice(0, 10000).map(p => ({
                    x: Number(p.x) || 0,
                    y: Number(p.y) || 0,
                    z: Number(p.z) || 0
                }));
            } else {
                this.toolpath = [];
            }
            
            if (data && Array.isArray(data.cutDepthMap)) {
                this.cutDepthMap = new Float32Array(data.cutDepthMap.slice(0, this.width * this.height));
            } else {
                this.cutDepthMap = new Float32Array(this.width * this.height);
            }
            
            this.currentPathIndex = Math.min(Number(data.currentPathIndex) || 0, this.toolpath.length - 1);
            
            this.drawBackground();
            this.drawCutArea();
            this.drawToolpath();
        } catch (e) {
            console.error('加载刀路数据失败:', e);
            this.toolpath = [];
            this.cutDepthMap = new Float32Array(this.width * this.height);
            this.currentPathIndex = 0;
            this.drawBackground();
        }
    }
}