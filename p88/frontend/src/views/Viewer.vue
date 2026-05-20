<template>
  <div class="viewer-page">
    <el-row :gutter="20">
      <el-col :span="6">
        <div class="page-container model-list-panel">
          <div class="card-header">
            <h3 class="card-title">模型列表</h3>
          </div>
          <el-table
            :data="furnitureList"
            style="width: 100%"
            @row-click="handleSelectModel"
            highlight-current-row
            size="small"
          >
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="category" label="分类" width="80" />
          </el-table>
        </div>

        <div v-if="similarModels.length > 0" class="page-container similar-models-panel" style="margin-top: 20px">
          <div class="card-header">
            <h3 class="card-title">相似模型推荐</h3>
          </div>
          <el-table
            :data="similarModels"
            style="width: 100%"
            @row-click="(item) => handleSelectModel(item.furniture)"
            highlight-current-row
            size="small"
          >
            <el-table-column prop="furniture.name" label="名称" />
            <el-table-column label="相似度" width="90">
              <template #default="{ row }">
                <el-tag type="success" size="small">{{ (row.similarityScore * 100).toFixed(0) }}%</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>

      <el-col :span="18">
        <div class="page-container">
          <div class="viewer-header">
            <h3 class="card-title">{{ currentModel ? currentModel.name : '3D模型展示' }}</h3>
            <div class="viewer-controls">
              <el-select v-model="currentLang" size="small" style="width: 100px" @change="changeLanguage">
                <el-option label="中文" value="zh" />
                <el-option label="English" value="en" />
                <el-option label="日本語" value="ja" />
              </el-select>

              <el-button-group>
                <el-button size="small" @click="resetCamera">重置视角</el-button>
                <el-button size="small" @click="toggleWireframe">
                  {{ wireframe ? '实体模式' : '线框模式' }}
                </el-button>
                <el-button size="small" @click="toggleAutoRotate">
                  {{ autoRotate ? '停止旋转' : '自动旋转' }}
                </el-button>
              </el-button-group>

              <el-button size="small" type="success" @click="toggleDisassembly" :disabled="disassemblySteps.length === 0">
                {{ isDisassembling ? '停止拆解' : '拆解演示' }}
              </el-button>

              <el-button size="small" type="primary" @click="toggleCollaborate">
                {{ collaborating ? '退出协同' : '多人协同' }}
              </el-button>
            </div>
          </div>

          <div class="viewer-container">
            <div ref="viewerContainerRef" class="three-viewer"></div>
            <div v-if="!currentModel" class="empty-tip">
              <el-empty description="请从左侧选择一个模型进行查看" />
            </div>
            <div v-if="loadingModel" class="loading-overlay">
              <el-progress
                type="circle"
                :percentage="loadProgress"
                :status="loadProgress === 100 ? 'success' : undefined"
              />
              <p class="loading-text">{{ loadProgress < 100 ? `正在加载... ${loadProgress}%` : '加载完成' }}</p>
            </div>
          </div>

          <div v-if="disassemblySteps.length > 0" class="disassembly-panel">
            <h4>拆解步骤控制</h4>
            <div class="step-controls">
              <el-slider
                v-model="currentStepIndex"
                :max="disassemblySteps.length - 1"
                :step="1"
                show-stops
                @change="jumpToStep"
              />
              <div class="step-buttons">
                <el-button size="small" @click="prevStep" :disabled="currentStepIndex === 0">上一步</el-button>
                <el-button size="small" @click="playAnimation" :disabled="isDisassembling">播放</el-button>
                <el-button size="small" @click="pauseAnimation" :disabled="!isDisassembling">暂停</el-button>
                <el-button size="small" @click="nextStep" :disabled="currentStepIndex >= disassemblySteps.length - 1">下一步</el-button>
              </div>
            </div>
            <div class="current-step-info">
              <el-alert
                :title="`第 ${currentStepIndex + 1} 步: ${disassemblySteps[currentStepIndex]?.title || ''}`"
                :description="disassemblySteps[currentStepIndex]?.description"
                type="info"
                :closable="false"
                show-icon
              />
            </div>
          </div>

          <div v-if="currentModel" class="model-info">
            <el-descriptions title="模型信息" :column="3" border size="small">
              <el-descriptions-item label="分类">{{ currentModel.category }}</el-descriptions-item>
              <el-descriptions-item label="材质">{{ currentModel.material }}</el-descriptions-item>
              <el-descriptions-item label="创作者">{{ currentModel.creator }}</el-descriptions-item>
              <el-descriptions-item label="尺寸">
                {{ currentModel.width }} x {{ currentModel.height }} x {{ currentModel.depth }} cm
              </el-descriptions-item>
              <el-descriptions-item label="描述" :span="2">
                {{ currentModel.description }}
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <div v-if="mortiseList.length > 0" class="mortise-info">
            <h4>榫卯结构列表</h4>
            <el-row :gutter="15">
              <el-col :span="8" v-for="item in mortiseList" :key="item.id">
                <el-card shadow="hover" size="small" class="mortise-card">
                  <template #header>
                    <div class="card-header-small">
                      <span>{{ item.name }}</span>
                      <el-tag size="small">{{ item.type }}</el-tag>
                    </div>
                  </template>
                  <div class="mortise-detail">
                    <p><strong>卯尺寸：</strong>{{ item.mortiseWidth }} x {{ item.mortiseHeight }} x {{ item.mortiseDepth }} cm</p>
                    <p><strong>榫尺寸：</strong>{{ item.tenonWidth }} x {{ item.tenonHeight }} x {{ item.tenonDepth }} cm</p>
                    <p><strong>位置：</strong>{{ item.position }}</p>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-dialog
      v-model="collaborateDialogVisible"
      title="多人协同编辑"
      width="500px"
    >
      <el-form label-width="80px">
        <el-form-item label="房间号">
          <el-input v-model="collaborationRoom" placeholder="输入或创建房间号" />
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="collaborationUser" placeholder="输入您的昵称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="collaborateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="joinCollaboration">加入协同</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { furnitureApi, mortiseApi, disassemblyApi, similarityApi } from '@/api'
import { modelLoader, createLowPolyPlaceholder, createLOD } from '@/utils/modelLoader'

const route = useRoute()
const viewerContainerRef = ref(null)
const furnitureList = ref([])
const similarModels = ref([])
const currentModel = ref(null)
const currentLang = ref('zh')
const mortiseList = ref([])
const disassemblySteps = ref([])
const wireframe = ref(false)
const autoRotate = ref(false)
const collaborating = ref(false)
const collaborateDialogVisible = ref(false)
const collaborationRoom = ref('')
const collaborationUser = ref('')
const loadingModel = ref(false)
const loadProgress = ref(0)
const isDisassembling = ref(false)
const currentStepIndex = ref(0)

let scene = null
let camera = null
let renderer = null
let controls = null
let loadedModel = null
let animationId = null
let websocket = null
let animationFrameId = null
let originalPositions = new Map()

onMounted(async () => {
  await loadFurnitureList()
  const furnitureId = route.params.id
  if (furnitureId) {
    const furniture = furnitureList.value.find(f => f.id === parseInt(furnitureId))
    if (furniture) {
      handleSelectModel(furniture)
    }
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  if (websocket) {
    websocket.close()
  }
  if (renderer) {
    renderer.dispose()
  }
})

const loadFurnitureList = async () => {
  try {
    const res = await furnitureApi.list()
    furnitureList.value = res.data || []
  } catch (error) {
    console.error('加载家具列表失败:', error)
  }
}

const handleSelectModel = async (furniture) => {
  currentModel.value = furniture
  await Promise.all([
    loadMortiseList(furniture.id),
    loadDisassemblySteps(furniture.id),
    loadSimilarModels(furniture.id)
  ])
  await nextTick()
  initThreeJS()
  if (furniture.modelPath) {
    loadModelWithChunks(furniture.modelPath)
  } else {
    loadDemoModel()
  }
}

const loadMortiseList = async (furnitureId) => {
  try {
    const res = await mortiseApi.getByFurnitureId(furnitureId)
    mortiseList.value = res.data || []
  } catch (error) {
    console.error('加载榫卯列表失败:', error)
  }
}

const loadDisassemblySteps = async (furnitureId) => {
  try {
    const res = await disassemblyApi.getByFurnitureId(furnitureId)
    disassemblySteps.value = res.data || []
    if (disassemblySteps.value.length > 0) {
      ElMessage.info(`发现 ${disassemblySteps.value.length} 个拆解步骤`)
    }
  } catch (error) {
    console.error('加载拆解步骤失败:', error)
  }
}

const loadSimilarModels = async (furnitureId) => {
  try {
    const res = await similarityApi.findSimilar(furnitureId, 5)
    similarModels.value = res.data || []
  } catch (error) {
    console.error('加载相似模型失败:', error)
  }
}

const changeLanguage = async () => {
  if (currentModel.value) {
    ElMessage.success(`已切换到 ${currentLang.value === 'zh' ? '中文' : currentLang.value === 'en' ? 'English' : '日本語'}`)
  }
}

const initThreeJS = () => {
  if (!viewerContainerRef.value) return

  if (renderer) {
    renderer.dispose()
  }

  const container = viewerContainerRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf8f9fa)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000)
  camera.position.set(5, 5, 5)

  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  container.innerHTML = ''
  container.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minDistance = 1
  controls.maxDistance = 50
  controls.enablePan = true

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.0)
  mainLight.position.set(10, 15, 10)
  mainLight.castShadow = true
  mainLight.shadow.mapSize.width = 2048
  mainLight.shadow.mapSize.height = 2048
  mainLight.shadow.camera.near = 0.5
  mainLight.shadow.camera.far = 50
  scene.add(mainLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
  fillLight.position.set(-10, 10, -10)
  scene.add(fillLight)

  const gridHelper = new THREE.GridHelper(10, 20, 0xcccccc, 0xe8e8e8)
  scene.add(gridHelper)

  const axesHelper = new THREE.AxesHelper(5)
  scene.add(axesHelper)

  window.addEventListener('resize', handleResize)

  animate()
}

const handleResize = () => {
  if (!viewerContainerRef.value || !camera || !renderer) return

  const container = viewerContainerRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

const animate = () => {
  animationId = requestAnimationFrame(animate)

  if (controls) {
    controls.autoRotate = autoRotate.value
    controls.autoRotateSpeed = 2
    controls.update()
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

const loadModelWithChunks = async (modelPath) => {
  if (!scene) return

  if (loadedModel) {
    scene.remove(loadedModel)
  }

  loadingModel.value = true
  loadProgress.value = 0

  const placeholder = createLowPolyPlaceholder()
  scene.add(placeholder)

  try {
    const fullPath = modelPath.startsWith('http') ? modelPath : `/api${modelPath}`

    const sceneModel = await modelLoader.loadModel(fullPath, {
      onProgress: (progress) => {
        loadProgress.value = progress.percent
      },
      onChunkLoad: (chunkInfo) => {
        console.log(`分块加载进度: ${chunkInfo.percent}%`)
      },
      chunkSize: 30000,
      priority: 1
    })

    scene.remove(placeholder)

    centerAndScaleModel(sceneModel)

    const lod = createLOD(sceneModel, [3, 8, 15])
    scene.add(lod)
    loadedModel = lod

    saveOriginalPositions(lod)

    loadProgress.value = 100
    ElMessage.success('模型加载完成')
  } catch (error) {
    console.error('模型加载失败:', error)
    ElMessage.warning('模型加载失败，显示演示模型')
    scene.remove(placeholder)
    loadDemoModel()
  } finally {
    loadingModel.value = false
  }
}

const loadDemoModel = () => {
  if (!scene) return

  if (loadedModel) {
    scene.remove(loadedModel)
  }

  const group = new THREE.Group()

  const tableGeometry = new THREE.BoxGeometry(2, 0.1, 1)
  const tableMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    roughness: 0.8,
    metalness: 0.2
  })
  const tableTop = new THREE.Mesh(tableGeometry, tableMaterial)
  tableTop.position.y = 1
  tableTop.castShadow = true
  tableTop.receiveShadow = true
  group.add(tableTop)

  const legGeometry = new THREE.BoxGeometry(0.1, 1, 0.1)
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x654321,
    roughness: 0.9
  })

  const positions = [
    [-0.85, 0.5, -0.4],
    [0.85, 0.5, -0.4],
    [-0.85, 0.5, 0.4],
    [0.85, 0.5, 0.4]
  ]

  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeometry, legMaterial)
    leg.position.set(pos[0], pos[1], pos[2])
    leg.castShadow = true
    group.add(leg)
  })

  const tenonGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.08)
  const tenonMaterial = new THREE.MeshStandardMaterial({
    color: 0xFF6B6B,
    roughness: 0.6
  })

  const tenonPositions = [
    [-0.85, 1.02, -0.4],
    [0.85, 1.02, -0.4],
    [-0.85, 1.02, 0.4],
    [0.85, 1.02, 0.4]
  ]

  tenonPositions.forEach(pos => {
    const tenon = new THREE.Mesh(tenonGeometry, tenonMaterial)
    tenon.position.set(pos[0], pos[1], pos[2])
    tenon.castShadow = true
    group.add(tenon)
  })

  loadedModel = group
  scene.add(loadedModel)
  saveOriginalPositions(group)
}

const centerAndScaleModel = (model) => {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  model.position.set(0, 0, 0)
  model.position.sub(center)
  model.position.y += size.y / 2

  const maxDim = Math.max(size.x, size.y, size.z)
  const targetSize = 3
  const scale = targetSize / maxDim
  model.scale.setScalar(scale)
}

const saveOriginalPositions = (model) => {
  originalPositions.clear()
  model.traverse((child) => {
    if (child.isMesh) {
      originalPositions.set(child.uuid, {
        position: child.position.clone(),
        rotation: child.rotation.clone()
      })
    }
  })
}

const resetCamera = () => {
  if (camera && controls) {
    camera.position.set(5, 5, 5)
    controls.target.set(0, 0, 0)
    controls.update()
  }
}

const toggleWireframe = () => {
  wireframe.value = !wireframe.value
  if (loadedModel) {
    loadedModel.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => {
            m.wireframe = wireframe.value
          })
        } else {
          child.material.wireframe = wireframe.value
        }
      }
    })
  }
}

const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value
}

const toggleDisassembly = () => {
  if (disassemblySteps.value.length === 0) {
    ElMessage.warning('该模型暂无拆解步骤')
    return
  }

  isDisassembling.value = !isDisassembling.value

  if (isDisassembling.value) {
    playAnimation()
  } else {
    pauseAnimation()
    resetToOriginalPosition()
  }
}

const playAnimation = () => {
  if (currentStepIndex.value >= disassemblySteps.value.length - 1) {
    currentStepIndex.value = 0
    resetToOriginalPosition()
  }
  animateStep()
}

const animateStep = () => {
  if (!isDisassembling.value) return
  if (currentStepIndex.value >= disassemblySteps.value.length) {
    isDisassembling.value = false
    return
  }

  const step = disassemblySteps.value[currentStepIndex.value]
  executeStepAnimation(step)

  setTimeout(() => {
    if (isDisassembling.value) {
      currentStepIndex.value++
      animateStep()
    }
  }, 2000)
}

const executeStepAnimation = (step) => {
  if (!loadedModel) return

  const componentName = step.componentName
  const animationType = step.animationType || 'translate'
  const params = typeof step.animationParams === 'string'
    ? JSON.parse(step.animationParams || '{}')
    : step.animationParams || {}

  let found = false
  loadedModel.traverse((child) => {
    if (child.isMesh && child.name.includes(componentName || '')) {
      found = true
      animateMesh(child, animationType, params)
    }
  })

  if (!found && loadedModel.children.length > 0) {
    const randomIndex = currentStepIndex.value % loadedModel.children.length
    const child = loadedModel.children[randomIndex]
    if (child && child.isMesh) {
      animateMesh(child, animationType, params)
    }
  }
}

const animateMesh = (mesh, animationType, params) => {
  const duration = (params.duration || 1.5) * 1000
  const startTime = Date.now()

  const startPos = mesh.position.clone()
  const startRot = mesh.rotation.clone()

  const targetPos = new THREE.Vector3(
    params.x || 0,
    params.y || 2,
    params.z || 0
  )

  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)

    if (animationType === 'translate') {
      mesh.position.lerpVectors(startPos, startPos.clone().add(targetPos), eased)
    } else if (animationType === 'rotate') {
      mesh.rotation.x = startRot.x + (params.rx || 0) * eased
      mesh.rotation.y = startRot.y + (params.ry || Math.PI / 2) * eased
      mesh.rotation.z = startRot.z + (params.rz || 0) * eased
    } else if (animationType === 'explode') {
      const direction = mesh.position.clone().normalize()
      mesh.position.copy(startPos.clone().add(direction.multiplyScalar(eased * 3)))
    }

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  animate()
}

const pauseAnimation = () => {
  isDisassembling.value = false
}

const resetToOriginalPosition = () => {
  if (!loadedModel) return

  loadedModel.traverse((child) => {
    if (child.isMesh) {
      const original = originalPositions.get(child.uuid)
      if (original) {
        child.position.copy(original.position)
        child.rotation.copy(original.rotation)
      }
    }
  })
  currentStepIndex.value = 0
}

const prevStep = () => {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
    jumpToStep(currentStepIndex.value)
  }
}

const nextStep = () => {
  if (currentStepIndex.value < disassemblySteps.value.length - 1) {
    currentStepIndex.value++
    jumpToStep(currentStepIndex.value)
  }
}

const jumpToStep = (index) => {
  currentStepIndex.value = index
  resetToOriginalPosition()

  for (let i = 0; i <= index; i++) {
    const step = disassemblySteps.value[i]
    executeStepAnimation(step)
  }
}

let localVersion = 0
let pendingEdits = []
const MAX_PENDING_EDITS = 50

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2)

const joinCollaboration = () => {
  if (!collaborationRoom.value || !collaborationUser.value) {
    ElMessage.warning('请输入房间号和用户名')
    return
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProtocol}//localhost:8080/api/ws/collaborate`

  websocket = new WebSocket(wsUrl)

  websocket.onopen = () => {
    ElMessage.success('已连接到协同服务器')
    collaborating.value = true
    collaborateDialogVisible.value = false
    localVersion = 0

    websocket.send(JSON.stringify({
      type: 'join',
      roomId: collaborationRoom.value,
      userId: collaborationUser.value,
      userName: collaborationUser.value
    }))
  }

  websocket.onmessage = (event) => {
    const data = JSON.parse(event.data)
    handleCollaborationMessage(data)
  }

  websocket.onerror = (error) => {
    console.error('WebSocket错误:', error)
    ElMessage.error('连接协同服务器失败')
  }

  websocket.onclose = () => {
    if (collaborating.value) {
      ElMessage.warning('与协同服务器断开连接')
      collaborating.value = false
    }
  }
}

const toggleCollaborate = () => {
  if (collaborating.value) {
    if (websocket) {
      websocket.close()
      websocket = null
    }
    collaborating.value = false
    ElMessage.success('已退出协同模式')
  } else {
    collaborateDialogVisible.value = true
  }
}

const sendEdit = (field, value) => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return

  if (pendingEdits.length >= MAX_PENDING_EDITS) {
    ElMessage.warning('编辑队列已满，请稍后再试')
    return
  }

  const editId = generateId()
  const editMessage = {
    type: 'edit',
    field,
    value,
    version: localVersion,
    editId,
    timestamp: Date.now()
  }

  pendingEdits.push({
    id: editId,
    field,
    value,
    sent: false
  })

  try {
    websocket.send(JSON.stringify(editMessage))
  } catch (e) {
    console.error('发送编辑失败:', e)
  }
}

const sendCommit = (data) => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return

  const commitId = generateId()
  websocket.send(JSON.stringify({
    type: 'commit',
    commitId,
    version: localVersion,
    data
  }))
}

const requestSync = () => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) return

  websocket.send(JSON.stringify({
    type: 'sync'
  }))
}

const handleCollaborationMessage = (data) => {
  switch (data.type) {
    case 'userJoin':
      ElMessage.info(`${data.userName} 加入了协同`)
      if (data.state) {
        applyState(data.state)
        localVersion = data.version
      }
      break
    case 'userLeave':
      ElMessage.info('有用户离开了协同')
      break
    case 'cursor':
      console.log('用户光标位置:', data)
      break
    case 'edit':
      applyEdit(data)
      break
    case 'ack':
      handleAck(data)
      break
    case 'conflict':
      handleConflict(data)
      break
    case 'sync':
      applyState(data.state)
      localVersion = data.version
      break
    case 'commit':
      console.log('收到提交:', data)
      break
    case 'error':
      ElMessage.error(`协同错误: ${data.message}`)
      break
  }
}

const applyEdit = (data) => {
  const { field, value, version } = data
  console.log(`应用编辑: ${field} =`, value)

  if (version > localVersion) {
    localVersion = version
  }

  if (currentModel.value) {
    currentModel.value[field] = value
  }
}

const applyState = (state) => {
  if (!state || !currentModel.value) return

  Object.keys(state).forEach(key => {
    currentModel.value[key] = state[key]
  })
}

const handleAck = (data) => {
  const index = pendingEdits.findIndex(e => e.id === data.id)
  if (index !== -1) {
    pendingEdits.splice(index, 1)
  }

  if (!data.success && data.message) {
    ElMessage.warning(data.message)
  }
}

const handleConflict = (data) => {
  ElMessage.warning('检测到编辑冲突，正在同步最新状态...')
  console.log('版本冲突 - 客户端:', data.clientVersion, '服务器:', data.serverVersion)

  if (data.state) {
    applyState(data.state)
    localVersion = data.serverVersion
  }

  pendingEdits.forEach(edit => {
    applyEdit({
      field: edit.field,
      value: edit.value,
      version: localVersion
    })
  })
}

watch(() => route.params.id, async (newId) => {
  if (newId) {
    const furniture = furnitureList.value.find(f => f.id === parseInt(newId))
    if (furniture) {
      handleSelectModel(furniture)
    }
  }
})
</script>

<style scoped>
.viewer-page {
  height: 100%;
}

.model-list-panel,
.similar-models-panel {
  height: calc(50vh - 80px);
  overflow-y: auto;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.viewer-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.viewer-container {
  position: relative;
  width: 100%;
  height: 450px;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  margin-bottom: 20px;
}

.three-viewer {
  width: 100%;
  height: 100%;
}

.empty-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
}

.loading-text {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.disassembly-panel {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.disassembly-panel h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
}

.step-controls {
  margin-bottom: 15px;
}

.step-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
}

.current-step-info {
  margin-top: 15px;
}

.model-info {
  margin-bottom: 20px;
}

.mortise-info h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  font-weight: 600;
}

.mortise-card {
  margin-bottom: 15px;
}

.card-header-small {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.mortise-detail p {
  margin: 5px 0;
  font-size: 13px;
  color: #666;
}
</style>
