class WoodGenerator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.woodData = null;
    }

    noise2D(x, y, seed = 0) {
        const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453123;
        return n - Math.floor(n);
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 3;
        const u = h < 2 ? x : y;
        const v = h < 2 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    smoothNoise(x, y, seed) {
        const corners = (this.noise2D(x-1, y-1, seed) + this.noise2D(x+1, y-1, seed) + 
                        this.noise2D(x-1, y+1, seed) + this.noise2D(x+1, y+1, seed)) / 16;
        const sides = (this.noise2D(x-1, y, seed) + this.noise2D(x+1, y, seed) + 
                      this.noise2D(x, y-1, seed) + this.noise2D(x, y+1, seed)) / 8;
        const center = this.noise2D(x, y, seed) / 4;
        return corners + sides + center;
    }

    interpolatedNoise(x, y, seed) {
        const intX = Math.floor(x);
        const fracX = x - intX;
        const intY = Math.floor(y);
        const fracY = y - intY;

        const u = this.fade(fracX);
        const v = this.fade(fracY);

        const aa = this.noise2D(intX, intY, seed);
        const ab = this.noise2D(intX, intY + 1, seed);
        const ba = this.noise2D(intX + 1, intY, seed);
        const bb = this.noise2D(intX + 1, intY + 1, seed);

        const x1 = this.lerp(aa, ba, u);
        const x2 = this.lerp(ab, bb, u);
        
        return this.lerp(x1, x2, v);
    }

    perlinNoise(x, y, seed, octaves = 4) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.interpolatedNoise(x * frequency, y * frequency, seed + i * 1000) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return total / maxValue;
    }

    getWoodColors(type) {
        const colors = {
            oak: { base: [139, 90, 43], ring: [101, 67, 33], variation: 20 },
            pine: { base: [194, 158, 100], ring: [160, 120, 70], variation: 25 },
            walnut: { base: [90, 60, 40], ring: [60, 40, 25], variation: 15 },
            mahogany: { base: [140, 60, 60], ring: [100, 40, 40], variation: 18 },
            maple: { base: [220, 200, 170], ring: [190, 170, 140], variation: 12 },
            cherry: { base: [180, 100, 80], ring: [140, 70, 55], variation: 16 },
            ash: { base: [200, 180, 140], ring: [170, 150, 110], variation: 22 },
            beech: { base: [210, 190, 150], ring: [180, 160, 120], variation: 14 }
        };
        return colors[type] || colors.oak;
    }

    getWoodPresets(type) {
        const presets = {
            oak: { ringDensity: 18, roughness: 45, grainStrength: 0.7 },
            pine: { ringDensity: 12, roughness: 60, grainStrength: 0.5 },
            walnut: { ringDensity: 22, roughness: 35, grainStrength: 0.8 },
            mahogany: { ringDensity: 20, roughness: 40, grainStrength: 0.75 },
            maple: { ringDensity: 16, roughness: 30, grainStrength: 0.6 },
            cherry: { ringDensity: 19, roughness: 38, grainStrength: 0.65 },
            ash: { ringDensity: 14, roughness: 55, grainStrength: 0.55 },
            beech: { ringDensity: 17, roughness: 42, grainStrength: 0.62 }
        };
        return presets[type] || presets.oak;
    }

    getAutoMatchPresets(mode) {
        const presets = {
            furniture: {
                woodTypes: ['oak', 'walnut', 'cherry'],
                ringDensityRange: [15, 25],
                roughnessRange: [30, 50],
                description: '适合家具制作的优质木纹'
            },
            flooring: {
                woodTypes: ['oak', 'maple', 'beech'],
                ringDensityRange: [12, 20],
                roughnessRange: [25, 45],
                description: '适合地板铺设的均匀木纹'
            },
            craft: {
                woodTypes: ['pine', 'ash', 'maple'],
                ringDensityRange: [8, 18],
                roughnessRange: [40, 70],
                description: '适合工艺雕刻的多样化木纹'
            },
            luxury: {
                woodTypes: ['walnut', 'mahogany', 'cherry'],
                ringDensityRange: [20, 30],
                roughnessRange: [20, 40],
                description: '高端定制的精选名贵木纹'
            }
        };
        return presets[mode] || presets.furniture;
    }

    autoMatch(mode) {
        if (mode === 'none') return null;
        
        const preset = this.getAutoMatchPresets(mode);
        const woodType = preset.woodTypes[Math.floor(Math.random() * preset.woodTypes.length)];
        const ringDensity = Math.floor(preset.ringDensityRange[0] + 
            Math.random() * (preset.ringDensityRange[1] - preset.ringDensityRange[0]));
        const roughness = Math.floor(preset.roughnessRange[0] + 
            Math.random() * (preset.roughnessRange[1] - preset.roughnessRange[0]));
        
        return {
            woodType,
            ringDensity,
            roughness,
            description: preset.description
        };
    }

    generate(options = {}) {
        const {
            woodType = 'oak', ringDensity = 15, roughness = 50, seed = Date.now() } = options;

        const colors = this.getWoodColors(woodType);
        const imageData = this.ctx.createImageData(this.width, this.height);
        const data = imageData.data;

        this.woodData = {
            type: woodType,
            ringDensity: ringDensity,
            roughness: roughness,
            seed: seed,
            depthMap: new Float32Array(this.width * this.height)
        };

        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const scale = 0.008;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (y * this.width + x) * 4;
                
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                const noiseVal = this.perlinNoise(x * 0.015, y * 0.015, seed, 4);
                
                const ringNoise = this.perlinNoise(
                    Math.cos(angle) * distance * scale + 100,
                    Math.sin(angle) * distance * scale + 100,
                    seed + 500,
                    3
                );
                
                const adjustedDistance = distance + ringNoise * roughness * 1.5;
                const ringWave = Math.sin(adjustedDistance * ringDensity * 0.08);
                const ringEffect = (ringWave + 1) * 0.5;
                
                const grainNoise = this.perlinNoise(
                    x * 0.08 + angle * 3,
                    y * 0.08,
                    seed + 1500,
                    5
                );
                const grainEffect = (grainNoise - 0.5) * roughness * 0.008;
                
                let r = colors.base[0] + (colors.ring[0] - colors.base[0]) * ringEffect;
                let g = colors.base[1] + (colors.ring[1] - colors.base[1]) * ringEffect;
                let b = colors.base[2] + (colors.ring[2] - colors.base[2]) * ringEffect;
                
                const variation = (noiseVal - 0.5) * colors.variation;
                r = r + variation + grainEffect * 25;
                g = g + variation * 0.8 + grainEffect * 20;
                b = b + variation * 0.6 + grainEffect * 15;
                
                const depthNoise = this.perlinNoise(x * 0.025, y * 0.025, seed + 2500, 3);
                this.woodData.depthMap[y * this.width + x] = depthNoise * 0.3 + ringEffect * 0.7;
                
                data[idx] = Math.min(255, Math.max(0, Math.floor(r)));
                data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g)));
                data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b)));
                data[idx + 3] = 255;
            }
        }

        this.ctx.putImageData(imageData, 0, 0);
        return this.woodData;
    }

    getDepthMap() {
        return this.woodData ? this.woodData.depthMap : null;
    }

    getData() {
        return this.woodData;
    }

    loadData(data) {
        if (!data) return;
        
        this.woodData = data;
        this.generate({
            woodType: data.type || 'oak',
            ringDensity: Number(data.ringDensity) || 15,
            roughness: Number(data.roughness) || 50,
            seed: Number(data.seed) || Date.now()
        });
    }
}