<template>
  <div class="three-viewer">
    <div ref="containerRef" class="viewer-container">
      <div v-if="loading" class="loading-overlay">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p>模型加载中... {{ loadingProgress }}%</p>
        <el-progress 
          :percentage="loadingProgress" 
          :stroke-width="8"
          style="width: 200px; margin-top: 15px;"
        />
      </div>
    </div>
    <div class="controls">
      <el-button-group>
        <el-button @click="resetCamera">重置视角</el-button>
        <el-button @click="toggleAutoRotate">自动旋转</el-button>
        <el-button @click="toggleWireframe">线框模式</el-button>
      </el-button-group>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Loading } from '@element-plus/icons-vue'
import { furnitureModelAssembler, modelChunkLoader, LODManager } from '@/utils/modelLoader'

const props = defineProps({
  parts: {
    type: Array,
    default: () => []
  },
  currentStep: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['partClick', 'loadComplete'])

const containerRef = ref()
const loading = ref(false)
const loadingProgress = ref(0)
const isWireframe = ref(false)

let scene, camera, renderer, controls, animationId
let partMeshes = new Map()
let isAutoRotate = ref(false)
let lodManager = null
let modelGroup = null

onMounted(() => {
  initScene()
  startAnimationLoop()
  window.addEventListener('resize', onWindowResize)
  
  if (props.parts.length > 0) {
    nextTick(() => {
      loadFurnitureModel(props.parts)
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  stopAnimationLoop()
  disposeResources()
  furnitureModelAssembler.clear()
})

watch(() => props.parts, (newParts) => {
  if (newParts.length > 0) {
    loadFurnitureModel(newParts)
  }
}, { deep: true })

watch(() => props.currentStep, (newStep) => {
  updatePartPositions(newStep)
})

const initScene = () => {
  const container = containerRef.value
  if (!container) return
  
  const width = container.clientWidth
  const height = container.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f2f5)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(5, 5, 5)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.screenSpacePanning = true
  controls.minDistance = 2
  controls.maxDistance = 20
  controls.maxPolarAngle = Math.PI / 2

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 7)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 1024
  directionalLight.shadow.mapSize.height = 1024
  scene.add(directionalLight)

  const gridHelper = new THREE.GridHelper(10, 10, 0xcccccc, 0xeeeeee)
  scene.add(gridHelper)

  lodManager = new LODManager(scene, camera)
}

const loadFurnitureModel = async (partsData) => {
  loading.value = true
  loadingProgress.value = 0

  if (modelGroup) {
    scene.remove(modelGroup)
    modelGroup = null
  }
  partMeshes.clear()

  const colors = [0x8B4513, 0xA0522D, 0xCD853F, 0xD2691E, 0xDEB887, 0xF5DEB3]

  const enhancedParts = partsData.map((part, index) => ({
    ...part,
    color: '#' + colors[index % colors.length].toString(16).padStart(6, '0')
  }))

  try {
    modelGroup = await furnitureModelAssembler.assembleFurniture(
      enhancedParts,
      (progress) => {
        loadingProgress.value = progress
      }
    )

    scene.add(modelGroup)
    
    partMeshes = new Map(furnitureModelAssembler.getAllParts().map(mesh => [
      mesh.userData.partId,
      mesh
    ]))

    fitCameraToSelection()
    
    loading.value = false
    emit('loadComplete', { success: true, partCount: partMeshes.size })
  } catch (error) {
    console.error('模型加载失败:', error)
    loading.value = false
    emit('loadComplete', { success: false, error: error.message })
  }
}

const fitCameraToSelection = () => {
  if (!modelGroup) return

  const box = new THREE.Box3().setFromObject(modelGroup)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxSize = Math.max(size.x, size.y, size.z)
  const fitHeightDistance = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360))
  const fitWidthDistance = fitHeightDistance / camera.aspect
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.5

  const direction = camera.position.clone().sub(center).normalize()
  camera.position.copy(center).add(direction.multiplyScalar(distance))
  camera.lookAt(center)

  controls.target.copy(center)
  controls.update()
}

let targetStep = 0
const updatePartPositions = () => {
  targetStep = props.currentStep
  
  partMeshes.forEach((mesh) => {
    const stepOrder = mesh.userData.stepOrder || 1
    
    if (stepOrder <= targetStep) {
      if (mesh.userData.disassembledPosition) {
        mesh.position.lerp(mesh.userData.disassembledPosition, 0.08)
      }
    } else {
      if (mesh.userData.originalPosition) {
        mesh.position.lerp(mesh.userData.originalPosition, 0.08)
      }
    }
  })
}

const onWindowResize = () => {
  const container = containerRef.value
  if (!container) return
  
  const width = container.clientWidth
  const height = container.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const startAnimationLoop = () => {
  const animate = () => {
    animationId = requestAnimationFrame(animate)
    
    if (isAutoRotate.value) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 1.0
    } else {
      controls.autoRotate = false
    }
    
    if (partMeshes.size > 0) {
      updatePartPositions()
    }
    
    if (lodManager) {
      lodManager.update()
    }
    
    controls.update()
    renderer.render(scene, camera)
  }
  
  animate()
}

const stopAnimationLoop = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

const disposeResources = () => {
  if (renderer) {
    renderer.dispose()
    renderer = null
  }

  if (lodManager) {
    lodManager.clear()
    lodManager = null
  }
}

const resetCamera = () => {
  fitCameraToSelection()
}

const toggleAutoRotate = () => {
  isAutoRotate.value = !isAutoRotate.value
}

const toggleWireframe = () => {
  isWireframe.value = !isWireframe.value
  
  partMeshes.forEach((mesh) => {
    if (mesh.material) {
      mesh.material.wireframe = isWireframe.value
    }
  })
}
</script>

<style scoped>
.three-viewer {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 500px;
}

.viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #f0f2f5;
  border-radius: 8px;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(240, 242, 245, 0.95);
  z-index: 100;
}

.loading-overlay p {
  margin-top: 10px;
  color: #666;
}

.controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}
</style>
