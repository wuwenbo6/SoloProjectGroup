<template>
  <div class="volume-renderer">
    <div class="renderer-container" ref="containerRef"></div>
    
    <div class="controls-panel">
      <el-card class="control-card">
        <template #header>
          <div class="card-header">
            <span>传递函数控制</span>
          </div>
        </template>
        
        <div class="control-item">
          <label>颜色映射</label>
          <el-select v-model="colorMap" size="small" style="width: 100%">
            <el-option label="灰度" value="gray" />
            <el-option label="彩虹" value="rainbow" />
            <el-option label="热力" value="heat" />
            <el-option label="地震" value="seismic" />
          </el-select>
        </div>

        <div class="control-item">
          <label>不透明度阈值</label>
          <el-slider
            v-model="opacityThreshold"
            :min="0"
            :max="100"
            size="small"
          />
        </div>

        <div class="control-item">
          <label>采样率</label>
          <el-slider
            v-model="sampleRate"
            :min="100"
            :max="500"
            size="small"
          />
        </div>

        <div class="control-item">
          <label>边缘增强</label>
          <el-slider
            v-model="edgeEnhancement"
            :min="0"
            :max="3"
            :step="0.1"
            size="small"
          />
        </div>

        <div class="control-item">
          <label>亮度</label>
          <el-slider
            v-model="brightness"
            :min="0.5"
            :max="2"
            :step="0.1"
            size="small"
          />
        </div>

        <div class="control-item">
          <label>对比度</label>
          <el-slider
            v-model="contrast"
            :min="0.5"
            :max="3"
            :step="0.1"
            size="small"
          />
        </div>

        <el-divider style="margin: 10px 0" />

        <div class="control-item">
          <label>X轴切片位置</label>
          <el-slider
            v-model="xSlice"
            :min="0"
            :max="100"
            size="small"
            :disabled="!enableXSlice"
          />
          <el-switch v-model="enableXSlice" size="small" />
        </div>

        <div class="control-item">
          <label>Y轴切片位置</label>
          <el-slider
            v-model="ySlice"
            :min="0"
            :max="100"
            size="small"
            :disabled="!enableYSlice"
          />
          <el-switch v-model="enableYSlice" size="small" />
        </div>

        <div class="control-item">
          <label>Z轴切片位置</label>
          <el-slider
            v-model="zSlice"
            :min="0"
            :max="100"
            size="small"
            :disabled="!enableZSlice"
          />
          <el-switch v-model="enableZSlice" size="small" />
        </div>

        <div class="control-item">
          <el-button size="small" @click="resetCamera">重置视角</el-button>
          <el-button size="small" @click="toggleWireframe">线框模式</el-button>
        </div>
      </el-card>

      <el-card class="info-card">
        <template #header>数据信息</template>
        <div v-if="volumeData" class="info-item">
          <span>尺寸:</span>
          <span>{{ volumeData.shape?.join(' × ') }}</span>
        </div>
        <div v-if="volumeData" class="info-item">
          <span>振幅范围:</span>
          <span>{{ volumeData.min_amplitude?.toFixed(2) }} ~ {{ volumeData.max_amplitude?.toFixed(2) }}</span>
        </div>
      </el-card>
    </div>

    <el-progress
      v-if="loading"
      :percentage="loadProgress"
      class="load-progress"
      :text-inside="true"
      :stroke-width="20"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useSeismicStore } from '../stores/seismic'
import { ElMessage } from 'element-plus'

const props = defineProps({
  fileId: {
    type: Number,
    required: true
  }
})

const store = useSeismicStore()
const containerRef = ref(null)

const volumeData = ref(null)
const loading = ref(false)
const loadProgress = ref(0)

const colorMap = ref('seismic')
const opacityThreshold = ref(20)
const sampleRate = ref(200)
const edgeEnhancement = ref(1.0)
const brightness = ref(1.0)
const contrast = ref(1.0)

const xSlice = ref(50)
const ySlice = ref(50)
const zSlice = ref(50)
const enableXSlice = ref(false)
const enableYSlice = ref(false)
const enableZSlice = ref(false)
const wireframeMode = ref(false)

let scene = null
let camera = null
let renderer = null
let controls = null
let volumeMesh = null
let sliceMeshes = []
let animationId = null

const initThree = () => {
  if (!containerRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(2, 2, 2)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  containerRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 5, 5)
  scene.add(directionalLight)

  addAxesHelper()
  animate()

  window.addEventListener('resize', onWindowResize)
}

const addAxesHelper = () => {
  const axesHelper = new THREE.AxesHelper(1.5)
  scene.add(axesHelper)
}

const createTransferFunction = (value, colorMapType) => {
  const normalized = (value + 1) / 2

  switch (colorMapType) {
    case 'gray':
      return new THREE.Color(normalized, normalized, normalized)
    case 'rainbow':
      const hue = normalized * 0.85
      return new THREE.Color().setHSL(hue, 1, 0.5)
    case 'heat':
      return new THREE.Color(
        Math.min(1, normalized * 2),
        Math.max(0, (normalized - 0.5) * 2),
        0
      )
    case 'seismic':
      if (normalized < 0.5) {
        return new THREE.Color(0, normalized * 2, 1 - normalized * 2)
      } else {
        return new THREE.Color((normalized - 0.5) * 2, 1 - (normalized - 0.5) * 2, 0)
      }
    default:
      return new THREE.Color(normalized, normalized, normalized)
  }
}

const createVolumeTexture = (data, gradient, shape) => {
  const width = shape[0]
  const height = shape[1]
  const depth = shape[2]

  const textureData = new Uint8Array(width * height * depth * 4)
  
  const minVal = Math.min(...data)
  const maxVal = Math.max(...data)
  const range = maxVal - minVal || 1

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (z * height * width + y * width + x)
        const value = data[idx]
        const grad = gradient ? gradient[idx] : 0
        const normalized = (value - minVal) / range
        
        const color = createTransferFunction(normalized * 2 - 1, colorMap.value)
        
        const baseAlpha = normalized * 100 > opacityThreshold.value ? 
                          Math.min(1, normalized * 0.5 + 0.2) : 0
        
        const edgeAlpha = grad * edgeEnhancement.value
        const finalAlpha = Math.min(1, baseAlpha + edgeAlpha * 0.3)

        textureData[idx * 4] = Math.floor(color.r * 255)
        textureData[idx * 4 + 1] = Math.floor(color.g * 255)
        textureData[idx * 4 + 2] = Math.floor(color.b * 255)
        textureData[idx * 4 + 3] = Math.floor(finalAlpha * 255)
      }
    }
  }

  const texture = new THREE.Data3DTexture(textureData, width, height, depth)
  texture.format = THREE.RGBAFormat
  texture.type = THREE.UnsignedByteType
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.unpackAlignment = 1
  texture.needsUpdate = true

  return texture
}

const createVolumeShaderMaterial = (texture) => {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_volume: { value: texture },
      u_sampleRate: { value: sampleRate.value },
      u_brightness: { value: brightness.value },
      u_contrast: { value: contrast.value },
      u_edgeEnhancement: { value: edgeEnhancement.value },
      u_xSlice: { value: enableXSlice.value ? xSlice.value / 100 : -1 },
      u_ySlice: { value: enableYSlice.value ? ySlice.value / 100 : -1 },
      u_zSlice: { value: enableZSlice.value ? zSlice.value / 100 : -1 }
    },
    vertexShader: `
      varying vec3 v_uv;
      varying vec3 v_position;
      
      void main() {
        v_uv = position * 0.5 + 0.5;
        v_position = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler3D u_volume;
      uniform float u_sampleRate;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_edgeEnhancement;
      uniform float u_xSlice;
      uniform float u_ySlice;
      uniform float u_zSlice;
      
      varying vec3 v_uv;
      varying vec3 v_position;
      
      vec4 sampleVolume(vec3 pos) {
        vec4 color = texture(u_volume, pos);
        color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
        color.rgb *= u_brightness;
        return clamp(color, 0.0, 1.0);
      }
      
      void main() {
        vec3 rayDir = normalize(cameraPosition - v_position);
        vec3 rayPos = v_uv;
        
        vec4 color = vec4(0.0);
        float stepSize = 1.0 / u_sampleRate;
        float gradStep = stepSize * 2.0;
        
        for (int i = 0; i < 400; i++) {
          if (color.a >= 0.98) break;
          
          vec3 samplePos = rayPos + rayDir * stepSize * float(i);
          
          if (samplePos.x < 0.0 || samplePos.x > 1.0 ||
              samplePos.y < 0.0 || samplePos.y > 1.0 ||
              samplePos.z < 0.0 || samplePos.z > 1.0) break;
          
          if (u_xSlice > 0.0 && abs(samplePos.x - u_xSlice) < 0.005) {
            vec4 sliceColor = sampleVolume(samplePos);
            sliceColor.a = 1.0;
            color = mix(color, sliceColor, sliceColor.a * 0.8);
          }
          else if (u_ySlice > 0.0 && abs(samplePos.y - u_ySlice) < 0.005) {
            vec4 sliceColor = sampleVolume(samplePos);
            sliceColor.a = 1.0;
            color = mix(color, sliceColor, sliceColor.a * 0.8);
          }
          else if (u_zSlice > 0.0 && abs(samplePos.z - u_zSlice) < 0.005) {
            vec4 sliceColor = sampleVolume(samplePos);
            sliceColor.a = 1.0;
            color = mix(color, sliceColor, sliceColor.a * 0.8);
          }
          else if (u_xSlice < 0.0 && u_ySlice < 0.0 && u_zSlice < 0.0) {
            vec4 centerColor = sampleVolume(samplePos);
            
            vec3 gradX = sampleVolume(samplePos + vec3(gradStep, 0, 0)).rgb - 
                        sampleVolume(samplePos - vec3(gradStep, 0, 0)).rgb;
            vec3 gradY = sampleVolume(samplePos + vec3(0, gradStep, 0)).rgb - 
                        sampleVolume(samplePos - vec3(0, gradStep, 0)).rgb;
            vec3 gradZ = sampleVolume(samplePos + vec3(0, 0, gradStep)).rgb - 
                        sampleVolume(samplePos - vec3(0, 0, gradStep)).rgb;
            
            float gradMag = length(vec3(length(gradX), length(gradY), length(gradZ)));
            
            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
            vec3 normal = normalize(vec3(length(gradX), length(gradY), length(gradZ)) + 0.001);
            float diffuse = max(dot(normal, lightDir), 0.3);
            
            float edgeFactor = 1.0 + gradMag * u_edgeEnhancement * 2.0;
            float enhancedAlpha = centerColor.a * edgeFactor * 0.15;
            
            vec3 shadedColor = centerColor.rgb * diffuse * edgeFactor;
            
            color.rgb += (1.0 - color.a) * shadedColor * enhancedAlpha;
            color.a += (1.0 - color.a) * enhancedAlpha;
          }
        }
        
        gl_FragColor = color;
      }
    `,
    transparent: true,
    side: THREE.BackSide
  })
}

const createVolumeMesh = async () => {
  loading.value = true
  loadProgress.value = 0

  try {
    const data = await store.getVolumeData(props.fileId)
    volumeData.value = data
    loadProgress.value = 50

    const texture = createVolumeTexture(data.data, data.gradient || [], data.shape)
    loadProgress.value = 80

    if (volumeMesh) {
      scene.remove(volumeMesh)
      volumeMesh.geometry.dispose()
      volumeMesh.material.dispose()
    }

    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = createVolumeShaderMaterial(texture)
    material.wireframe = wireframeMode.value

    volumeMesh = new THREE.Mesh(geometry, material)
    scene.add(volumeMesh)
    
    loadProgress.value = 100
  } catch (error) {
    ElMessage.error('加载体数据失败')
  } finally {
    loading.value = false
  }
}

const updateVolume = () => {
  if (!volumeData.value) return

  const texture = createVolumeTexture(
    volumeData.value.data, 
    volumeData.value.gradient || [], 
    volumeData.value.shape
  )
  
  if (volumeMesh) {
    volumeMesh.material.uniforms.u_volume.value = texture
    volumeMesh.material.uniforms.u_sampleRate.value = sampleRate.value
    volumeMesh.material.uniforms.u_brightness.value = brightness.value
    volumeMesh.material.uniforms.u_contrast.value = contrast.value
    volumeMesh.material.uniforms.u_edgeEnhancement.value = edgeEnhancement.value
    volumeMesh.material.uniforms.u_xSlice.value = enableXSlice.value ? xSlice.value / 100 : -1
    volumeMesh.material.uniforms.u_ySlice.value = enableYSlice.value ? ySlice.value / 100 : -1
    volumeMesh.material.uniforms.u_zSlice.value = enableZSlice.value ? zSlice.value / 100 : -1
    volumeMesh.material.wireframe = wireframeMode.value
    volumeMesh.material.needsUpdate = true
  }
}

const resetCamera = () => {
  camera.position.set(2, 2, 2)
  controls.target.set(0, 0, 0)
  controls.update()
}

const toggleWireframe = () => {
  wireframeMode.value = !wireframeMode.value
  if (volumeMesh) {
    volumeMesh.material.wireframe = wireframeMode.value
  }
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

const onWindowResize = () => {
  if (!containerRef.value) return
  
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

watch([
  colorMap, opacityThreshold, sampleRate,
  edgeEnhancement, brightness, contrast,
  xSlice, ySlice, zSlice,
  enableXSlice, enableYSlice, enableZSlice
], () => {
  updateVolume()
})

watch(() => props.fileId, async (newId) => {
  if (newId) {
    await createVolumeMesh()
  }
}, { immediate: true })

onMounted(async () => {
  await nextTick()
  initThree()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', onWindowResize)
  
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<style scoped>
.volume-renderer {
  display: flex;
  height: 100%;
  gap: 20px;
}

.renderer-container {
  flex: 1;
  background: #1a1a2e;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.controls-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.control-card, .info-card {
  padding: 10px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.control-item {
  margin-bottom: 15px;
}

.control-item label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.control-item .el-switch {
  float: right;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
}

.info-item span:first-child {
  color: #909399;
}

.load-progress {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
}
</style>
