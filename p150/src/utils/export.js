import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const exporter = new GLTFExporter();

export const createSceneFromNodes = (nodes) => {
  const scene = new THREE.Scene();

  Object.values(nodes).forEach((nodeData) => {
    let mesh;
    let geometry;
    let material;

    switch (nodeData.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
        break;
      case 'plane':
        geometry = new THREE.PlaneGeometry(1, 1);
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const matData = nodeData.material || {};
    material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(matData.color || '#4a90d9'),
      metalness: matData.metalness || 0.1,
      roughness: matData.roughness || 0.5,
    });

    if (matData.map && typeof matData.map === 'string') {
      const loader = new THREE.TextureLoader();
      loader.load(matData.map, (texture) => {
        material.map = texture;
        material.needsUpdate = true;
      });
    }

    mesh = new THREE.Mesh(geometry, material);

    if (nodeData.position) {
      mesh.position.set(
        nodeData.position.x || 0,
        nodeData.position.y || 0,
        nodeData.position.z || 0
      );
    }

    if (nodeData.rotation) {
      mesh.rotation.set(
        nodeData.rotation.x || 0,
        nodeData.rotation.y || 0,
        nodeData.rotation.z || 0
      );
    }

    if (nodeData.scale) {
      mesh.scale.set(
        nodeData.scale.x || 1,
        nodeData.scale.y || 1,
        nodeData.scale.z || 1
      );
    }

    mesh.userData = {
      nodeId: nodeData.id,
      nodeType: nodeData.type,
    };

    scene.add(mesh);
  });

  return scene;
};

export const exportGLTF = (nodes, filename = 'scene.gltf') => {
  const scene = createSceneFromNodes(nodes);

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (gltf) => {
        const data = JSON.stringify(gltf, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        downloadBlob(blob, filename);
        resolve();
      },
      (error) => {
        reject(error);
      },
      {
        trs: false,
        onlyVisible: true,
        binary: false,
        maxTextureSize: 4096,
      }
    );
  });
};

export const exportGLB = (nodes, filename = 'scene.glb') => {
  const scene = createSceneFromNodes(nodes);

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (glb) => {
        const blob = new Blob([glb], { type: 'application/octet-stream' });
        downloadBlob(blob, filename);
        resolve();
      },
      (error) => {
        reject(error);
      },
      {
        trs: false,
        onlyVisible: true,
        binary: true,
        maxTextureSize: 4096,
      }
    );
  });
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
