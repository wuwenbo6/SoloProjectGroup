import { SceneLoader, Vector3, TransformNode } from '@babylonjs/core';

class ModelLoader {
  constructor(scene) {
    this.scene = scene;
    this.cache = new Map();
  }

  async loadModel(modelPath, modelName, position = Vector3.Zero()) {
    const cacheKey = `${modelPath}_${modelName}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      const instance = cached.instantiateHierarchy();
      instance.position = position.clone();
      return instance;
    }

    return new Promise((resolve, reject) => {
      SceneLoader.ImportMesh(
        '',
        modelPath,
        modelName,
        this.scene,
        (meshes) => {
          const root = new TransformNode(`root_${modelName}`, this.scene);
          meshes.forEach((mesh) => {
            mesh.parent = root;
          });
          root.position = position;
          
          this.cache.set(cacheKey, root);
          resolve(root);
        },
        null,
        (scene, message) => {
          reject(new Error(message));
        }
      );
    });
  }

  dispose() {
    this.cache.forEach((mesh) => mesh.dispose());
    this.cache.clear();
  }
}

export default ModelLoader;
