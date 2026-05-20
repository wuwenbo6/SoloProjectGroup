class Preview3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        
        this.rotationX = 0.5;
        this.rotationY = 0.3;
        this.zoom = 200;
        this.heightScale = 10;
        this.autoRotate = false;
        this.renderMode = 'solid';
        
        this.vertices = [];
        this.faces = [];
        this.depthMap = null;
        this.texture = null;
        
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        
        this.setupMouseEvents();
    }

    setupMouseEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.offsetX;
            this.lastMouseY = e.offsetY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.offsetX - this.lastMouseX;
                const dy = e.offsetY - this.lastMouseY;
                
                this.rotationY += dx * 0.005;
                this.rotationX += dy * 0.005;
                
                this.lastMouseX = e.offsetX;
                this.lastMouseY = e.offsetY;
                
                this.render();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom += e.deltaY > 0 ? -10 : 10;
            this.zoom = Math.max(50, Math.min(500, this.zoom));
            this.render();
        });
    }

    setDepthMap(depthMap, width, height) {
        this.depthMap = depthMap;
        this.mapWidth = width;
        this.mapHeight = height;
        this.generateMesh();
    }

    setTexture(imageData) {
        this.texture = imageData;
    }

    generateMesh() {
        if (!this.depthMap) return;

        this.vertices = [];
        this.faces = [];
        
        const step = 8;
        const scaleX = this.width / this.mapWidth;
        const scaleY = this.height / this.mapHeight;

        let vertexIndex = 0;
        const vertexIndices = [];

        for (let y = 0; y < this.mapHeight; y += step) {
            for (let x = 0; x < this.mapWidth; x += step) {
                const idx = y * this.mapWidth + x;
                const depth = this.depthMap[idx] || 0;
                
                this.vertices.push({
                    x: (x - this.mapWidth / 2) * scaleX * 0.5,
                    y: (y - this.mapHeight / 2) * scaleY * 0.5,
                    z: depth * this.heightScale * 10
                });

                vertexIndices.push(vertexIndex);
                vertexIndex++;
            }
        }

        const cols = Math.ceil(this.mapWidth / step);
        const rows = Math.ceil(this.mapHeight / step);

        for (let y = 0; y < rows - 1; y++) {
            for (let x = 0; x < cols - 1; x++) {
                const i = y * cols + x;
                this.faces.push([i, i + 1, i + cols + 1]);
                this.faces.push([i, i + cols + 1, i + cols]);
            }
        }
    }

    projectVertex(vertex) {
        let x = vertex.x;
        let y = vertex.y;
        let z = vertex.z;

        let cosX = Math.cos(this.rotationX);
        let sinX = Math.sin(this.rotationX);
        let newY = y * cosX - z * sinX;
        let newZ = y * sinX + z * cosX;
        y = newY;
        z = newZ;

        let cosY = Math.cos(this.rotationY);
        let sinY = Math.sin(this.rotationY);
        let newX = x * cosY + z * sinY;
        newZ = -x * sinY + z * cosY;
        x = newX;
        z = newZ;

        const perspective = 500;
        const scale = this.zoom / (perspective + z);

        return {
            x: x * scale + this.width / 2,
            y: y * scale + this.height / 2,
            z: z
        };
    }

    calculateNormal(v1, v2, v3) {
        const ax = v2.x - v1.x;
        const ay = v2.y - v1.y;
        const az = v2.z - v1.z;
        
        const bx = v3.x - v1.x;
        const by = v3.y - v1.y;
        const bz = v3.z - v1.z;
        
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        
        return {
            x: len > 0 ? nx / len : 0,
            y: len > 0 ? ny / len : 0,
            z: len > 0 ? nz / len : 0
        };
    }

    getFaceColor(face, normal) {
        if (this.renderMode === 'wireframe') {
            return '#667eea';
        }

        const lightDir = { x: 0.5, y: -0.5, z: 0.7 };
        const intensity = Math.max(0.2, normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z);

        if (this.renderMode === 'texture' && this.texture) {
            const v = this.vertices[face[0]];
            const x = Math.floor((v.x + this.mapWidth / 2));
            const y = Math.floor((v.y + this.mapHeight / 2));
            const idx = (y * this.mapWidth + x) * 4;
            
            if (idx >= 0 && idx < this.texture.data.length) {
                const r = Math.floor(this.texture.data[idx] * intensity);
                const g = Math.floor(this.texture.data[idx + 1] * intensity);
                const b = Math.floor(this.texture.data[idx + 2] * intensity);
                return `rgb(${r}, ${g}, ${b})`;
            }
        }

        const baseColor = { r: 139, g: 90, b: 43 };
        const r = Math.floor(baseColor.r * intensity);
        const g = Math.floor(baseColor.g * intensity);
        const b = Math.floor(baseColor.b * intensity);

        return `rgb(${r}, ${g}, ${b})`;
    }

    render() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.vertices.length === 0) {
            this.ctx.fillStyle = '#888';
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('请先生成木纹或刀路以获得深度图', this.width / 2, this.height / 2);
            this.ctx.font = '14px Arial';
            this.ctx.fillText('拖拽旋转 · 滚轮缩放', this.width / 2, this.height / 2 + 40);
            return;
        }

        if (this.autoRotate) {
            this.rotationY += 0.01;
        }

        const projected = this.vertices.map(v => this.projectVertex(v));

        const facesWithDepth = this.faces.map((face, index) => {
            const avgZ = (projected[face[0]].z + projected[face[1]].z + projected[face[2]].z) / 3;
            return { face, avgZ, index };
        });

        facesWithDepth.sort((a, b) => b.avgZ - a.avgZ);

        this.ctx.lineWidth = 1;

        facesWithDepth.forEach(({ face }) => {
            const v1 = projected[face[0]];
            const v2 = projected[face[1]];
            const v3 = projected[face[2]];

            const vert1 = this.vertices[face[0]];
            const vert2 = this.vertices[face[1]];
            const vert3 = this.vertices[face[2]];
            const normal = this.calculateNormal(vert1, vert2, vert3);

            if (this.renderMode === 'wireframe') {
                this.ctx.strokeStyle = '#667eea';
                this.ctx.beginPath();
                this.ctx.moveTo(v1.x, v1.y);
                this.ctx.lineTo(v2.x, v2.y);
                this.ctx.lineTo(v3.x, v3.y);
                this.ctx.closePath();
                this.ctx.stroke();
            } else {
                const color = this.getFaceColor(face, normal);
                
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.moveTo(v1.x, v1.y);
                this.ctx.lineTo(v2.x, v2.y);
                this.ctx.lineTo(v3.x, v3.y);
                this.ctx.closePath();
                this.ctx.fill();

                if (this.renderMode === 'solid') {
                    this.ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    this.ctx.stroke();
                }
            }
        });

        this.drawInfo();
    }

    drawInfo() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, 10, 150, 60);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '11px Arial';
        this.ctx.fillText(`旋转: X=${this.rotationX.toFixed(2)} Y=${this.rotationY.toFixed(2)}`, 20, 30);
        this.ctx.fillText(`缩放: ${this.zoom.toFixed(0)}`, 20, 45);
        this.ctx.fillText(`顶点: ${this.vertices.length}`, 20, 60);
    }

    resetView() {
        this.rotationX = 0.5;
        this.rotationY = 0.3;
        this.zoom = 200;
        this.render();
    }

    toggleAutoRotate() {
        this.autoRotate = !this.autoRotate;
        if (this.autoRotate) {
            this.startAnimation();
        }
    }

    startAnimation() {
        const animate = () => {
            if (this.autoRotate) {
                this.render();
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    exportOBJ() {
        let obj = '# Wood Processing 3D Model\n';
        obj += `# Vertices: ${this.vertices.length}\n`;
        obj += `# Faces: ${this.faces.length}\n\n`;

        this.vertices.forEach(v => {
            obj += `v ${(v.x / 100).toFixed(4)} ${(v.z / 100).toFixed(4)} ${(-v.y / 100).toFixed(4)}\n`;
        });

        obj += '\n';

        this.faces.forEach(face => {
            obj += `f ${face[0] + 1} ${face[1] + 1} ${face[2] + 1}\n`;
        });

        return obj;
    }

    exportSTL() {
        let stl = 'solid wood_model\n';

        this.faces.forEach(face => {
            const v1 = this.vertices[face[0]];
            const v2 = this.vertices[face[1]];
            const v3 = this.vertices[face[2]];
            const normal = this.calculateNormal(v1, v2, v3);

            stl += `  facet normal ${normal.x.toFixed(6)} ${normal.z.toFixed(6)} ${(-normal.y).toFixed(6)}\n`;
            stl += '    outer loop\n';
            stl += `      vertex ${(v1.x / 100).toFixed(6)} ${(v1.z / 100).toFixed(6)} ${(-v1.y / 100).toFixed(6)}\n`;
            stl += `      vertex ${(v2.x / 100).toFixed(6)} ${(v2.z / 100).toFixed(6)} ${(-v2.y / 100).toFixed(6)}\n`;
            stl += `      vertex ${(v3.x / 100).toFixed(6)} ${(v3.z / 100).toFixed(6)} ${(-v3.y / 100).toFixed(6)}\n`;
            stl += '    endloop\n';
            stl += '  endfacet\n';
        });

        stl += 'endsolid wood_model\n';
        return stl;
    }

    setHeightScale(scale) {
        this.heightScale = scale;
        this.generateMesh();
        this.render();
    }

    setRenderMode(mode) {
        this.renderMode = mode;
        this.render();
    }
}