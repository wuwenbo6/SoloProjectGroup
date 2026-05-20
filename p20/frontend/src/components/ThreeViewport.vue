<template>
  <div ref="containerRef" class="viewport-container">
    <div class="fps-counter" v-if="showFps">
      {{ fps }} FPS
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watchEffect, nextTick } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { useSceneStore } from '../store/scene';

const props = defineProps({
  objects: {
    type: Array,
    default: () => []
  },
  selectedObjectId: {
    type: String,
    default: null
  },
  showFps: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['select-object', 'transform-change']);

const sceneStore = useSceneStore();
const containerRef = ref(null);
const fps = ref(60);

let scene, camera, renderer, orbitControls, transformControls;
let objectMap = new Map();
let animationId;
let frameCount = 0;
let lastFpsUpdate = performance.now();
let pendingObjectUpdates = new Map();
let updateFrameId = null;

const createMesh = (obj) => {
  let geometry;
  switch (obj.type) {
    case 'Cube':
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'Sphere':
      geometry = new THREE.SphereGeometry(0.5, 16, 16);
      break;
    case 'Cylinder':
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
      break;
    case 'Torus':
      geometry = new THREE.TorusGeometry(0.5, 0.2, 8, 32);
      break;
    case 'Plane':
      geometry = new THREE.PlaneGeometry(1, 1);
      break;
    default:
      geometry = new THREE.BoxGeometry(1, 1, 1);
  }

  const material = new THREE.MeshStandardMaterial({
    color: obj.color || 0xffffff,
    metalness: 0.1,
    roughness: 0.8
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.id = obj.id;
  mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
  mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
  mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = true;

  return mesh;
};

const initScene = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.matrixAutoUpdate = false;

  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  camera = new THREE.PerspectiveCamera(55, containerWidth / containerHeight, 0.5, 500);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
    stencil: false,
    depth: true
  });
  
  renderer.setSize(containerWidth, containerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  
  containerRef.value.appendChild(renderer.domElement);

  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.05;
  orbitControls.enablePan = true;
  orbitControls.screenSpacePanning = false;

  transformControls = new TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.8);
  transformControls.setMode('translate');
  
  transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
  });
  
  transformControls.addEventListener('objectChange', () => {
    if (transformControls.object) {
      const obj = transformControls.object;
      emit('transform-change', {
        objectId: obj.userData.id,
        position: {
          x: parseFloat(obj.position.x.toFixed(3)),
          y: parseFloat(obj.position.y.toFixed(3)),
          z: parseFloat(obj.position.z.toFixed(3))
        },
        rotation: {
          x: parseFloat(obj.rotation.x.toFixed(3)),
          y: parseFloat(obj.rotation.y.toFixed(3)),
          z: parseFloat(obj.rotation.z.toFixed(3))
        },
        scale: {
          x: parseFloat(obj.scale.x.toFixed(3)),
          y: parseFloat(obj.scale.y.toFixed(3)),
          z: parseFloat(obj.scale.z.toFixed(3))
        }
      });
    }
  });
  scene.add(transformControls);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(8, 12, 8);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20;
  directionalLight.shadow.camera.top = 20;
  directionalLight.shadow.camera.bottom = -20;
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x444444);
  gridHelper.material.opacity = 0.5;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  const onMouseClick = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(Array.from(objectMap.values()));

    if (intersects.length > 0) {
      emit('select-object', intersects[0].object.userData.id);
    } else if (!transformControls.dragging) {
      emit('select-object', null);
    }
  };

  renderer.domElement.addEventListener('click', onMouseClick);

  window.addEventListener('keydown', (event) => {
    switch (event.key.toLowerCase()) {
      case 'w':
        transformControls.setMode('translate');
        break;
      case 'e':
        transformControls.setMode('rotate');
        break;
      case 'r':
        transformControls.setMode('scale');
        break;
      case 'delete':
      case 'backspace':
        if (transformControls.object) {
          sceneStore.deleteObject(transformControls.object.userData.id);
        }
        break;
    }
  });

  animate();
};

const updateFps = () => {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    fps.value = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
    frameCount = 0;
    lastFpsUpdate = now;
  }
};

const animate = () => {
  animationId = requestAnimationFrame(animate);
  orbitControls.update();
  renderer.render(scene, camera);
  updateFps();
};

const processPendingUpdates = () => {
  if (pendingObjectUpdates.size === 0) return;

  const currentIds = new Set(props.objects.map(o => o.id));

  pendingObjectUpdates.forEach((obj, id) => {
    let mesh = objectMap.get(id);
    
    if (!mesh && currentIds.has(id)) {
      mesh = createMesh(obj);
      scene.add(mesh);
      objectMap.set(id, mesh);
    } else if (mesh) {
      mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
      mesh.rotation.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z);
      if (mesh.material.color.getHexString() !== new THREE.Color(obj.color).getHexString()) {
        mesh.material.color.set(obj.color);
      }
    }
  });

  pendingObjectUpdates.clear();

  objectMap.forEach((mesh, id) => {
    if (!currentIds.has(id)) {
      if (transformControls.object === mesh) {
        transformControls.detach();
      }
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      objectMap.delete(id);
    }
  });
};

watchEffect(() => {
  props.objects.forEach(obj => {
    pendingObjectUpdates.set(obj.id, obj);
  });

  if (!updateFrameId) {
    updateFrameId = requestAnimationFrame(() => {
      processPendingUpdates();
      updateFrameId = null;
    });
  }
});

watchEffect(() => {
  nextTick(() => {
    if (!scene || !transformControls) return;
    
    if (props.selectedObjectId) {
      const mesh = objectMap.get(props.selectedObjectId);
      if (mesh && transformControls.object !== mesh) {
        transformControls.attach(mesh);
      }
    } else {
      transformControls.detach();
    }
  });
});

const onResize = () => {
  if (containerRef.value && renderer && camera) {
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
  }
};

onMounted(() => {
  initScene();
  window.addEventListener('resize', onResize, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('resize', onResize);
  cancelAnimationFrame(animationId);
  if (updateFrameId) {
    cancelAnimationFrame(updateFrameId);
  }
  
  transformControls.dispose();
  orbitControls.dispose();
  
  objectMap.forEach((mesh) => {
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  objectMap.clear();
  
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
  }
});
</script>

<style scoped>
.viewport-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.fps-counter {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #4fc3f7;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-family: monospace;
  pointer-events: none;
  z-index: 100;
}
</style>
