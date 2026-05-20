class StressCalculator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.stressMap = new Float32Array(this.width * this.height);
        this.strainMap = new Float32Array(this.width * this.height);
        this.displacementMap = new Float32Array(this.width * this.height);
        this.result = null;
    }

    getMaterialPreset(preset) {
        const presets = {
            'oak-hard': { name: '硬橡木', strength: 55, elasticModulus: 12, poissonRatio: 0.35, density: 750 },
            'pine-soft': { name: '软松木', strength: 35, elasticModulus: 8.5, poissonRatio: 0.33, density: 500 },
            'walnut-premium': { name: '优质胡桃木', strength: 65, elasticModulus: 11.5, poissonRatio: 0.34, density: 680 },
            'maple-dense': { name: '致密枫木', strength: 60, elasticModulus: 12.6, poissonRatio: 0.36, density: 700 },
            'bamboo': { name: '竹材', strength: 80, elasticModulus: 15, poissonRatio: 0.32, density: 650 },
            'plywood': { name: '胶合板', strength: 45, elasticModulus: 10, poissonRatio: 0.30, density: 600 },
            'mdf': { name: '中密度纤维板', strength: 30, elasticModulus: 4, poissonRatio: 0.28, density: 700 },
            'custom': { name: '自定义', strength: 50, elasticModulus: 12, poissonRatio: 0.35, density: 650 }
        };
        return presets[preset] || presets.custom;
    }

    calculateStress(depthMap, options = {}) {
        const {
            materialStrength = 50,
            cuttingForce = 100,
            toolDiameter = 6,
            elasticModulus = 12,
            poissonRatio = 0.35,
            accuracy = 'medium'
        } = options;

        this.result = {
            maxStress: 0,
            minStress: Infinity,
            avgStress: 0,
            maxStrain: 0,
            maxDisplacement: 0,
            criticalAreas: 0,
            safetyFactor: 0,
            fatigueLife: 0,
            isValid: true
        };

        let totalStress = 0;
        let count = 0;
        const safeToolDiameter = Math.max(0.1, toolDiameter);
        const safeCuttingForce = Math.max(0.1, cuttingForce);
        const step = accuracy === 'low' ? 4 : (accuracy === 'high' ? 1 : 2);

        for (let y = 0; y < this.height; y += step) {
            for (let x = 0; x < this.width; x += step) {
                for (let dy = 0; dy < step && y + dy < this.height; dy++) {
                    for (let dx = 0; dx < step && x + dx < this.width; dx++) {
                        const px = x + dx;
                        const py = y + dy;
                        const idx = py * this.width + px;
                        const depth = depthMap ? (depthMap[idx] || 0) : 0.5;
                        
                        const localStress = this.calculatePointStress(px, py, depth, safeCuttingForce, safeToolDiameter);
                        
                        if (!isFinite(localStress) || isNaN(localStress)) {
                            this.stressMap[idx] = 0;
                            this.strainMap[idx] = 0;
                            this.displacementMap[idx] = 0;
                            continue;
                        }
                        
                        this.stressMap[idx] = Math.max(0, Math.min(1000, localStress));
                        this.strainMap[idx] = this.stressMap[idx] / (elasticModulus * 1000);
                        this.displacementMap[idx] = this.strainMap[idx] * 10;
                        
                        this.result.maxStress = Math.max(this.result.maxStress, this.stressMap[idx]);
                        this.result.minStress = Math.min(this.result.minStress, this.stressMap[idx]);
                        this.result.maxStrain = Math.max(this.result.maxStrain, this.strainMap[idx]);
                        this.result.maxDisplacement = Math.max(this.result.maxDisplacement, this.displacementMap[idx]);
                        totalStress += this.stressMap[idx];
                        count++;
                    }
                }
            }
        }

        if (count > 0) {
            this.result.avgStress = totalStress / count;
        } else {
            this.result.avgStress = 0;
            this.result.isValid = false;
        }

        if (this.result.maxStress > 0.001) {
            this.result.safetyFactor = materialStrength / this.result.maxStress;
            this.result.fatigueLife = Math.pow(materialStrength / this.result.maxStress, 5) * 1000;
        } else {
            this.result.safetyFactor = 100;
            this.result.fatigueLife = 100000;
        }

        this.result.criticalAreas = this.countCriticalAreas(materialStrength * 0.8);

        return this.result;
    }

    calculatePointStress(x, y, depth, cuttingForce, toolDiameter) {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
        
        const distRatio = maxDist > 0 ? distFromCenter / maxDist : 0;
        const edgeFactor = 1 + distRatio * 0.5;
        const depthFactor = 1 + Math.min(depth, 1) * 2;
        
        const radius = toolDiameter / 2;
        const area = Math.PI * radius * radius;
        
        if (area < 0.001) return 0;
        
        const baseStress = cuttingForce / area;
        
        return baseStress * edgeFactor * depthFactor;
    }

    countCriticalAreas(threshold) {
        let count = 0;
        for (let i = 0; i < this.stressMap.length; i++) {
            if (this.stressMap[i] > threshold) {
                count++;
            }
        }
        return count;
    }

    getStressColor(stress, maxStress) {
        if (!isFinite(stress) || isNaN(stress)) {
            return { r: 100, g: 100, b: 100 };
        }
        
        const safeMax = Math.max(maxStress, 0.001);
        const normalized = Math.max(0, Math.min(1, stress / safeMax));
        
        let r, g, b;
        
        if (normalized < 0.33) {
            const t = normalized / 0.33;
            r = 0;
            g = Math.floor(100 + t * 155);
            b = Math.floor(255 - t * 155);
        } else if (normalized < 0.66) {
            const t = (normalized - 0.33) / 0.33;
            r = Math.floor(t * 255);
            g = 255;
            b = 0;
        } else {
            const t = (normalized - 0.66) / 0.34;
            r = 255;
            g = Math.floor(255 - t * 200);
            b = Math.floor(t * 100);
        }
        
        return {
            r: Math.max(0, Math.min(255, r)),
            g: Math.max(0, Math.min(255, g)),
            b: Math.max(0, Math.min(255, b))
        };
    }

    visualize() {
        if (!this.result) return;
        
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                const stressIdx = y * this.width + x;
                
                const stress = this.stressMap[stressIdx];
                const color = this.getStressColor(stress, this.result.maxStress);
                
                data[idx] = color.r;
                data[idx + 1] = color.g;
                data[idx + 2] = color.b;
                data[idx + 3] = 220;
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
        this.drawColorBar();
        this.drawStressLegend();
    }

    drawColorBar() {
        const barWidth = 30;
        const barHeight = 200;
        const startX = this.width - barWidth - 20;
        const startY = 20;

        for (let i = 0; i < barHeight; i++) {
            const stress = (1 - i / barHeight) * this.result.maxStress;
            const color = this.getStressColor(stress, this.result.maxStress);
            
            this.ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            this.ctx.fillRect(startX, startY + i, barWidth, 1);
        }

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX, startY, barWidth, barHeight);
    }

    drawStressLegend() {
        if (!this.result) return;

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(20, 20, 200, 140);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('应力分析结果', 30, 40);
        
        this.ctx.fillStyle = '#aaa';
        this.ctx.font = '11px Arial';
        this.ctx.fillText(`最大应力: ${this.safeFloat(this.result.maxStress)} MPa`, 30, 60);
        this.ctx.fillText(`最小应力: ${this.safeFloat(this.result.minStress === Infinity ? 0 : this.result.minStress)} MPa`, 30, 80);
        this.ctx.fillText(`平均应力: ${this.safeFloat(this.result.avgStress)} MPa`, 30, 100);
        this.ctx.fillText(`安全系数: ${this.safeFloat(this.result.safetyFactor)}`, 30, 120);
        this.ctx.fillText(`危险区域: ${this.result.criticalAreas} 像素`, 30, 140);
    }

    safeFloat(value, decimals = 2) {
        if (!isFinite(value) || isNaN(value)) {
            return '0.00';
        }
        return value.toFixed(decimals);
    }

    getResultText() {
        if (!this.result) return '无应力数据';

        let text = `多材质受力仿真结果:\n\n`;
        text += `最大应力: ${this.safeFloat(this.result.maxStress)} MPa\n`;
        text += `最小应力: ${this.safeFloat(this.result.minStress === Infinity ? 0 : this.result.minStress)} MPa\n`;
        text += `平均应力: ${this.safeFloat(this.result.avgStress)} MPa\n`;
        text += `最大应变: ${(this.result.maxStrain * 1000).toFixed(4)} ‰\n`;
        text += `最大位移: ${this.safeFloat(this.result.maxDisplacement)} μm\n`;
        text += `安全系数: ${this.safeFloat(this.result.safetyFactor)}\n`;
        text += `疲劳寿命: ~${this.formatFatigueLife(this.result.fatigueLife)}\n`;
        text += `危险区域: ${this.result.criticalAreas} 像素\n\n`;

        if (this.result.safetyFactor >= 3) {
            text += '✓ 安全系数优秀，非常耐用';
        } else if (this.result.safetyFactor >= 2) {
            text += '✓ 安全系数良好';
        } else if (this.result.safetyFactor >= 1) {
            text += '⚠ 安全系数较低，建议优化';
        } else {
            text += '✗ 存在断裂风险！';
        }

        return text;
    }

    formatFatigueLife(life) {
        if (life >= 1000000) {
            return (life / 1000000).toFixed(1) + 'M 周期';
        } else if (life >= 1000) {
            return (life / 1000).toFixed(1) + 'K 周期';
        }
        return life.toFixed(0) + ' 周期';
    }

    getData() {
        return {
            stressMap: Array.from(this.stressMap),
            result: this.result
        };
    }

    loadData(data) {
        try {
            if (data && Array.isArray(data.stressMap)) {
                this.stressMap = new Float32Array(data.stressMap.slice(0, this.width * this.height));
            } else {
                this.stressMap = new Float32Array(this.width * this.height);
            }
            
            if (data && data.result) {
                this.result = {
                    maxStress: Number(data.result.maxStress) || 0,
                    minStress: Number(data.result.minStress) || 0,
                    avgStress: Number(data.result.avgStress) || 0,
                    criticalAreas: Number(data.result.criticalAreas) || 0,
                    safetyFactor: Number(data.result.safetyFactor) || 0,
                    isValid: true
                };
            } else {
                this.result = null;
            }
            
            if (this.result) {
                this.visualize();
            }
        } catch (e) {
            console.error('加载应力数据失败:', e);
            this.stressMap = new Float32Array(this.width * this.height);
            this.result = null;
        }
    }
}