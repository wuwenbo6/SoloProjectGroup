class DepthRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
    }

    render(depthMap, options = {}) {
        const {
            lightIntensity = 70,
            lightAngle = 45,
            ambientLight = 20
        } = options;

        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        const lightRad = lightAngle * Math.PI / 180;
        const lightDirX = Math.cos(lightRad);
        const lightDirY = Math.sin(lightRad);
        const lightDirZ = 0.7;

        const normalMap = this.calculateNormals(depthMap);

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const normalIdx = y * this.width + x;

                const nx = normalMap[normalIdx].x;
                const ny = normalMap[normalIdx].y;
                const nz = normalMap[normalIdx].z;

                const diffuse = Math.max(0, nx * lightDirX + ny * lightDirY + nz * lightDirZ);
                
                const depth = depthMap ? depthMap[normalIdx] || 0.5 : 0.5;
                
                const totalLight = ambientLight / 100 + diffuse * lightIntensity / 100;
                
                const baseColor = this.getHeightColor(depth);
                
                data[idx] = Math.min(255, Math.floor(baseColor.r * totalLight));
                data[idx + 1] = Math.min(255, Math.floor(baseColor.g * totalLight));
                data[idx + 2] = Math.min(255, Math.floor(baseColor.b * totalLight));
                data[idx + 3] = 255;
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.drawLightIndicator(lightAngle, lightIntensity);
    }

    calculateNormals(depthMap) {
        const normals = [];
        const scale = 50;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = y * this.width + x;
                
                const depthL = x > 0 ? (depthMap ? depthMap[idx - 1] : 0.5) : 0.5;
                const depthR = x < this.width - 1 ? (depthMap ? depthMap[idx + 1] : 0.5) : 0.5;
                const depthU = y > 0 ? (depthMap ? depthMap[idx - this.width] : 0.5) : 0.5;
                const depthD = y < this.height - 1 ? (depthMap ? depthMap[idx + this.width] : 0.5) : 0.5;

                const dx = (depthR - depthL) * scale;
                const dy = (depthD - depthU) * scale;

                const len = Math.sqrt(dx * dx + dy * dy + 1);
                normals[idx] = {
                    x: -dx / len,
                    y: -dy / len,
                    z: 1 / len
                };
            }
        }

        return normals;
    }

    getHeightColor(depth) {
        let r, g, b;

        if (depth < 0.33) {
            const t = depth / 0.33;
            r = Math.floor(80 + t * 40);
            g = Math.floor(50 + t * 30);
            b = Math.floor(30 + t * 20);
        } else if (depth < 0.66) {
            const t = (depth - 0.33) / 0.33;
            r = Math.floor(120 + t * 40);
            g = Math.floor(80 + t * 40);
            b = Math.floor(50 + t * 30);
        } else {
            const t = (depth - 0.66) / 0.34;
            r = Math.floor(160 + t * 40);
            g = Math.floor(120 + t * 40);
            b = Math.floor(80 + t * 40);
        }

        return { r, g, b };
    }

    drawLightIndicator(angle, intensity) {
        const centerX = 60;
        const centerY = this.height - 60;
        const radius = 30;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
        this.ctx.fill();

        const rad = angle * Math.PI / 180;
        const arrowLen = radius * 0.8;
        const endX = centerX + Math.cos(rad) * arrowLen;
        const endY = centerY - Math.sin(rad) * arrowLen;

        this.ctx.strokeStyle = `rgba(255, 255, 200, ${intensity / 100})`;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();

        this.ctx.fillStyle = `rgba(255, 255, 200, ${intensity / 100})`;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '11px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`光源: ${angle}°`, centerX, centerY + radius + 25);
        this.ctx.fillText(`强度: ${intensity}%`, centerX, centerY + radius + 40);
    }

    renderHeightMap(depthMap) {
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const depth = depthMap ? depthMap[y * this.width + x] || 0 : 0;
                const gray = Math.floor(depth * 255);

                data[idx] = gray;
                data[idx + 1] = gray;
                data[idx + 2] = gray;
                data[idx + 3] = 255;
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    getData() {
        return {
            rendered: true
        };
    }

    loadData(data) {
    }
}