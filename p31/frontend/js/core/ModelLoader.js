class ModelLoader {
    constructor(renderer) {
        this.renderer = renderer;
        this.loadedModels = new Map();
        this.loadingPromises = new Map();
        this.lodObjects = new Map();
        this.componentChunks = new Map();
        this.viewDistanceThresholds = {
            near: 3,
            medium: 8,
            far: 15
        };
    }

    async loadModelAsync(modelKey, options = {}) {
        const { onProgress, onChunkLoad, useLOD = true, chunkSize = 1 } = options;

        if (this.loadedModels.has(modelKey)) {
            return this.loadedModels.get(modelKey);
        }

        if (this.loadingPromises.has(modelKey)) {
            return this.loadingPromises.get(modelKey);
        }

        const loadPromise = this._loadModelWithChunks(modelKey, chunkSize, onProgress, onChunkLoad, useLOD);
        this.loadingPromises.set(modelKey, loadPromise);

        try {
            const modelData = await loadPromise;
            this.loadedModels.set(modelKey, modelData);
            return modelData;
        } finally {
            this.loadingPromises.delete(modelKey);
        }
    }

    async _loadModelWithChunks(modelKey, chunkSize, onProgress, onChunkLoad, useLOD) {
        const model = window.modelData[modelKey];
        if (!model) {
            throw new Error(`模型不存在: ${modelKey}`);
        }

        const totalChunks = Math.ceil(model.components.length / chunkSize);
        const loadedChunks = [];

        for (let i = 0; i < model.components.length; i += chunkSize) {
            const chunk = model.components.slice(i, i + chunkSize);
            const chunkIndex = Math.floor(i / chunkSize);

            await new Promise(resolve => setTimeout(resolve, 50));

            const meshes = chunk.map((comp, idx) => {
                const mesh = this._createComponentMesh(comp, modelKey, i + idx);
                return { mesh, component: comp, index: i + idx };
            });

            loadedChunks.push(...meshes);

            if (onChunkLoad) {
                onChunkLoad({
                    chunkIndex,
                    totalChunks,
                    progress: ((chunkIndex + 1) / totalChunks * 100,
                    loadedCount: loadedChunks.length
                });
            }

            if (onProgress) {
                onProgress({
                    loaded: loadedChunks.length,
                    total: model.components.length,
                    percent: (loadedChunks.length / model.components.length) * 100
                });
            }
        }

        if (useLOD) {
            this._setupLOD(modelKey, loadedChunks);
        }

        this.componentChunks.set(modelKey, loadedChunks);

        return {
            modelData: model,
            components: loadedChunks,
            useLOD,
            loadedAt: Date.now()
        };
    }

    _createComponentMesh(component, modelKey, index) {
        const size = component.size || { x: 1, y: 0.5, z: 0.7 };
        const geometry = this._createOptimizedGeometry(size);
        
        const colorMap = {
            mortise1: 0xe94560,
            mortise2: 0x667eea,
            mortise3: 0xf093fb,
            mortise4: 0x38ef7d
        };
        const color = colorMap[modelKey] || 0x667eea;
        
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.1,
            roughness: 0.6,
            flatShading: true
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(component.position.x, component.position.y, component.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            modelKey,
            componentIndex: index,
            componentName: component.name,
            originalPosition: new THREE.Vector3(
                component.position.x,
                component.position.y,
                component.position.z
            ),
            disassemblePosition: new THREE.Vector3(
                component.disassemblePos.x,
                component.disassemblePos.y,
                component.disassemblePos.z
            ),
            dockingPoint: new THREE.Vector3(
                component.dockingPoint.x,
                component.dockingPoint.y,
                component.dockingPoint.z
            ),
            stiffness: component.stiffness || 10000
        };

        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        const wireframe = new THREE.LineSegments(edges, lineMaterial);
        mesh.add(wireframe);

        return mesh;
    }

    _createOptimizedGeometry(size) {
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
        geometry.computeVertexNormals();
        return geometry;
    }

    _setupLOD(modelKey, components) {
        const lodGroup = new THREE.Group();
        
        components.forEach(({ mesh }) => {
            const lod = new THREE.LOD();
            
            const highDetail = mesh.clone();
            
            const mediumDetail = mesh.clone();
            mediumDetail.material = mediumDetail.material.clone();
            mediumDetail.material.wireframe = false;
            mediumDetail.material.flatShading = true;
            
            const lowDetail = new THREE.Mesh(
                new THREE.BoxGeometry(
                    mesh.geometry.parameters.width * 0.9,
                    mesh.geometry.parameters.height * 0.9,
                    mesh.geometry.parameters.depth * 0.9
                ),
                new THREE.MeshBasicMaterial({ color: mesh.material.color })
            );
            lowDetail.position.copy(mesh.position);
            
            lod.addLevel(highDetail, this.viewDistanceThresholds.near);
            lod.addLevel(mediumDetail, this.viewDistanceThresholds.medium);
            lod.addLevel(lowDetail, this.viewDistanceThresholds.far);
            
            lod.position.copy(mesh.position);
            lod.userData = mesh.userData;
            
            lodGroup.add(lod);
        });
        
        this.lodObjects.set(modelKey, lodGroup);
    }

    addModelToScene(modelKey) {
        const model = this.loadedModels.get(modelKey);
        if (!model) return;

        if (model.useLOD && this.lodObjects.has(modelKey)) {
            this.renderer.addObject(this.lodObjects.get(modelKey));
        } else {
            model.components.forEach(({ mesh }) => {
                this.renderer.addObject(mesh);
            });
        }
    }

    removeModelFromScene(modelKey) {
        const model = this.loadedModels.get(modelKey);
        if (!model) return;

        if (this.lodObjects.has(modelKey)) {
            this.renderer.removeObject(this.lodObjects.get(modelKey));
        } else {
            model.components.forEach(({ mesh }) => {
                this.renderer.removeObject(mesh);
            });
        }
    }

    getComponentMeshes(modelKey) {
        const model = this.loadedModels.get(modelKey);
        return model ? model.components.map(c => c.mesh) : [];
    }

    unloadModel(modelKey) {
        const model = this.loadedModels.get(modelKey);
        if (!model) return;

        this.removeModelFromScene(modelKey);
        
        model.components.forEach(({ mesh }) => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });

        this.loadedModels.delete(modelKey);
        this.lodObjects.delete(modelKey);
        this.componentChunks.delete(modelKey);
        
        console.log(`模型已卸载: ${modelKey}`);
    }

    unloadAll() {
        for (const modelKey of this.loadedModels.keys()) {
            this.unloadModel(modelKey);
        }
    }

    isModelLoaded(modelKey) {
        return this.loadedModels.has(modelKey);
    }

    getLoadedModelKeys() {
        return Array.from(this.loadedModels.keys());
    }

    updateLOD(cameraPosition) {
        this.lodObjects.forEach((lodGroup) => {
            lodGroup.children.forEach(lod => {
                if (lod.update) {
                    lod.update(cameraPosition);
                }
            });
        });
    }

    optimizeForDistance(modelKey, distance) {
        const components = this.componentChunks.get(modelKey);
        if (!components) return;

        components.forEach(({ mesh }) => {
            if (distance > this.viewDistanceThresholds.far) {
                mesh.visible = false;
            } else if (distance > this.viewDistanceThresholds.medium) {
                mesh.material.wireframe = true;
            } else {
                mesh.visible = true;
                mesh.material.wireframe = false;
            }
        });
    }

    getMemoryUsage() {
        let totalVertices = 0;
        let totalGeometries = 0;
        
        this.loadedModels.forEach((model) => {
            model.components.forEach(({ mesh }) => {
                if (mesh.geometry) {
                    totalGeometries++;
                    if (mesh.geometry.attributes.position) {
                        totalVertices += mesh.geometry.attributes.position.count;
                    }
                }
            });
        });

        return {
            modelsLoaded: this.loadedModels.size,
            totalGeometries,
            totalVertices,
            estimatedMB: (totalVertices * 12) / (1024 * 1024)
        };
    }
}
