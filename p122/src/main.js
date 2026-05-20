import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ModelLoader } from './modelLoader.js'
import { StressAnalysis } from './stressAnalysis.js'
import { DeformationSim } from './deformationSim.js'
import { FatigueAnalysis } from './fatigueAnalysis.js'
import { ProjectManager } from './projectManager.js'
import { MaterialComparison } from './materialComparison.js'
import { WearPrediction } from './wearPrediction.js'
import { BatchSimulation } from './batchSimulation.js'
import { PreviewExporter } from './previewExporter.js'

class MortiseTenonApp {
  constructor() {
    this.scene = null
    this.camera = null
    this.renderer = null
    this.controls = null
    this.currentModel = null
    this.analysisResults = null
    this.fatigueResults = null
    this.activePanel = null
    this.activeBtn = null
    
    this.init()
    this.setupEventListeners()
    this.animate()
  }
  
  init() {
    const canvas = document.getElementById('threeCanvas')
    
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a1a)
    
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(5, 5, 5)
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    
    this.setupLights()
    this.setupGrid()
    
    this.modelLoader = new ModelLoader(this.scene)
    this.stressAnalysis = new StressAnalysis()
    this.deformationSim = new DeformationSim(this.scene)
    this.fatigueAnalysis = new FatigueAnalysis()
    this.projectManager = new ProjectManager()
    this.materialComparison = new MaterialComparison(this.stressAnalysis)
    this.wearPrediction = new WearPrediction()
    this.batchSimulation = new BatchSimulation(this.stressAnalysis)
    this.previewExporter = null
    
    window.addEventListener('resize', () => this.onResize())
    
    setTimeout(() => {
      this.loadDefaultModel()
      this.initExporter()
    }, 100)
  }
  
  initExporter() {
    this.previewExporter = new PreviewExporter(
      this.renderer,
      this.scene,
      this.camera
    )
  }
  
  loadDefaultModel() {
    this.currentModel = this.modelLoader.createDefaultMortiseTenon()
    this.updateModelInfo()
    this.fitCameraToModel()
  }
  
  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    this.scene.add(ambientLight)
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(10, 10, 10)
    this.scene.add(directionalLight)
    
    const pointLight = new THREE.PointLight(0xe94560, 0.5)
    pointLight.position.set(-5, 5, -5)
    this.scene.add(pointLight)
  }
  
  setupGrid() {
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
    this.scene.add(gridHelper)
    
    const axesHelper = new THREE.AxesHelper(3)
    this.scene.add(axesHelper)
  }
  
  setupEventListeners() {
    document.getElementById('loadModelBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click()
    })
    
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (file) {
        this.currentModel = await this.modelLoader.loadFile(file)
        this.updateModelInfo()
        this.fitCameraToModel()
      }
    })
    
    document.getElementById('stressAnalysisBtn').addEventListener('click', () => {
      this.performStressAnalysis()
    })
    
    document.getElementById('deformationBtn').addEventListener('click', () => {
      this.performDeformation()
    })
    
    document.getElementById('fatigueBtn').addEventListener('click', () => {
      this.performFatigueAnalysis()
    })
    
    document.getElementById('materialCompareBtn').addEventListener('click', () => {
      this.togglePanel('materialComparePanel', 'materialCompareBtn')
      this.performMaterialComparison()
    })
    
    document.getElementById('wearBtn').addEventListener('click', () => {
      this.togglePanel('wearPanel', 'wearBtn')
      this.performWearPrediction()
    })
    
    document.getElementById('batchBtn').addEventListener('click', () => {
      this.togglePanel('batchPanel', 'batchBtn')
      this.startBatchSimulation()
    })
    
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.togglePanel('exportPanel', 'exportBtn')
    })
    
    document.getElementById('exportBtn').addEventListener('click', () => {
      setTimeout(() => this.doExport(), 100)
    })
    
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveProject()
    })
    
    document.getElementById('loadBtn').addEventListener('click', () => {
      this.loadProject()
    })
  }
  
  togglePanel(panelId, btnId) {
    const panels = ['materialComparePanel', 'wearPanel', 'batchPanel', 'exportPanel']
    const buttons = ['materialCompareBtn', 'wearBtn', 'batchBtn', 'exportBtn']
    
    panels.forEach(p => {
      document.getElementById(p).style.display = 'none'
    })
    
    buttons.forEach(b => {
      document.getElementById(b).classList.remove('active')
    })
    
    if (this.activePanel !== panelId) {
      document.getElementById(panelId).style.display = 'block'
      document.getElementById(btnId).classList.add('active')
      this.activePanel = panelId
      this.activeBtn = btnId
    } else {
      this.activePanel = null
      this.activeBtn = null
    }
  }
  
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }
  
  safeParseFloat(value, defaultValue) {
    const parsed = parseFloat(value)
    if (isNaN(parsed) || !isFinite(parsed)) {
      return defaultValue
    }
    return parsed
  }
  
  getMaterialParams() {
    const elasticModulusGPa = this.safeParseFloat(document.getElementById('elasticModulus').value, 12)
    const poissonRatio = this.safeParseFloat(document.getElementById('poissonRatio').value, 0.35)
    const density = this.safeParseFloat(document.getElementById('density').value, 700)
    
    return {
      elasticModulus: this.clamp(elasticModulusGPa, 0.001, 1000) * 1e9,
      poissonRatio: this.clamp(poissonRatio, 0.01, 0.5),
      density: this.clamp(density, 10, 10000)
    }
  }
  
  getLoadParams() {
    const magnitude = this.safeParseFloat(document.getElementById('forceMagnitude').value, 1000)
    const dirX = this.safeParseFloat(document.getElementById('forceDirX').value, 0)
    const dirY = this.safeParseFloat(document.getElementById('forceDirY').value, -1)
    const dirZ = this.safeParseFloat(document.getElementById('forceDirZ').value, 0)
    
    const dir = new THREE.Vector3(dirX, dirY, dirZ)
    const len = dir.length()
    if (len > 0.001) {
      dir.normalize()
    } else {
      dir.set(0, -1, 0)
    }
    
    return {
      magnitude: this.clamp(magnitude, 0, 1e6),
      direction: dir
    }
  }
  
  performStressAnalysis() {
    if (!this.currentModel) {
      alert('请先加载模型')
      return
    }
    
    const material = this.getMaterialParams()
    const load = this.getLoadParams()
    
    this.analysisResults = this.stressAnalysis.analyze(
      this.currentModel,
      material,
      load
    )
    
    this.displayStressResults()
    this.visualizeStress()
  }
  
  performDeformation() {
    if (!this.currentModel) {
      alert('请先加载模型')
      return
    }
    
    const material = this.getMaterialParams()
    const load = this.getLoadParams()
    
    this.deformationSim.simulate(
      this.currentModel,
      material,
      load
    )
  }
  
  performFatigueAnalysis() {
    if (!this.currentModel) {
      alert('请先加载模型')
      return
    }
    
    const material = this.getMaterialParams()
    const load = this.getLoadParams()
    
    this.fatigueResults = this.fatigueAnalysis.calculate(
      this.currentModel,
      material,
      load,
      this.analysisResults
    )
    
    this.displayFatigueResults(this.fatigueResults)
  }
  
  performMaterialComparison() {
    if (!this.currentModel) {
      return
    }
    
    const material1Name = document.getElementById('material1Name').value || '橡木'
    const material1E = this.safeParseFloat(document.getElementById('material1E').value, 12) * 1e9
    
    const material2Name = document.getElementById('material2Name').value || '松木'
    const material2E = this.safeParseFloat(document.getElementById('material2E').value, 8) * 1e9
    
    const material3Name = document.getElementById('material3Name').value || '榉木'
    const material3E = this.safeParseFloat(document.getElementById('material3E').value, 10) * 1e9
    
    const materials = [
      { name: material1Name, elasticModulus: material1E, poissonRatio: 0.35, density: 700 },
      { name: material2Name, elasticModulus: material2E, poissonRatio: 0.35, density: 500 },
      { name: material3Name, elasticModulus: material3E, poissonRatio: 0.35, density: 650 }
    ]
    
    const load = this.getLoadParams()
    
    const comparisonResults = this.materialComparison.compareMaterials(
      this.currentModel,
      load,
      materials
    )
    
    this.materialComparisonResults = comparisonResults
    
    this.displayMaterialComparisonResults()
  }
  
  performWearPrediction() {
    if (!this.currentModel) {
      alert('请先加载模型')
      return
    }
    
    const frictionCoeff = this.safeParseFloat(document.getElementById('frictionCoeff').value, 0.3)
    const usageDays = this.safeParseFloat(document.getElementById('usageDays').value, 365)
    const dailyHours = this.safeParseFloat(document.getElementById('dailyHours').value, 4)
    const surfaceHardness = this.safeParseFloat(document.getElementById('surfaceHardness').value, 150)
    
    const material = this.getMaterialParams()
    const load = this.getLoadParams()
    
    this.wearResults = this.wearPrediction.predict(
      this.currentModel,
      load,
      material,
      {
        frictionCoeff: frictionCoeff,
        days: usageDays,
        hoursPerDay: dailyHours,
        hardness: surfaceHardness
      }
    )
    
    this.displayWearResults()
  }
  
  async startBatchSimulation() {
    if (!this.currentModel) {
      alert('请先加载模型')
      return
    }
    
    const count = Math.round(this.safeParseFloat(document.getElementById('batchCount').value, 10))
    const minForce = this.safeParseFloat(document.getElementById('minForce').value, 500)
    const maxForce = this.safeParseFloat(document.getElementById('maxForce').value, 5000)
    const variableType = document.getElementById('batchVariable').value
    
    const material = this.getMaterialParams()
    const baseLoad = this.getLoadParams()
    
    const progressBar = document.getElementById('progressFill')
    const progressText = document.getElementById('progressText')
    
    this.batchSimulation.onProgress = (result, index, total) => {
      const percent = ((index + 1) / total) * 100
      progressBar.style.width = percent + '%'
      progressText.textContent = Math.round(percent) + '%'
    }
    
    const results = await this.batchSimulation.runSimulation(
      this.currentModel,
      material,
      baseLoad,
      { count, minForce, maxForce, variableType }
    )
    
    this.batchResults = results
    this.displayBatchResults()
  }
  
  doExport() {
    if (!this.currentModel) {
      alert('请先加载模型')
      return
    }
    
    const width = this.safeParseFloat(document.getElementById('exportWidth').value, 1920)
    const height = this.safeParseFloat(document.getElementById('exportHeight').value, 1080)
    const format = document.getElementById('exportFormat').value
    const showGrid = document.getElementById('showGrid').checked
    const showAxes = document.getElementById('showAxes').checked
    const showWireframe = document.getElementById('showWireframe').checked
    
    if (format === 'png' || format === 'jpeg') {
      this.previewExporter.downloadImage({
        width, height, format, showGrid, showAxes, showWireframe
      })
    } else if (format === 'obj') {
      this.previewExporter.downloadOBJ(this.currentModel)
    } else if (format === 'stl') {
      this.previewExporter.downloadSTL(this.currentModel, false)
    }
  }
  
  displayStressResults() {
    const resultsDiv = document.getElementById('analysisResults')
    const r = this.analysisResults
    
    resultsDiv.innerHTML = `
      <div class="result-item">
        <div class="label">最大主应力</div>
        <div class="value ${r.maxStress > r.yieldStrength ? 'warning' : ''}">
          ${(r.maxStress / 1e6).toFixed(2)} MPa
        </div>
      </div>
      <div class="result-item">
        <div class="label">最小主应力</div>
        <div class="value">${(r.minStress / 1e6).toFixed(2)} MPa</div>
      </div>
      <div class="result-item">
        <div class="label">等效应力 (von Mises)</div>
        <div class="value ${r.vonMises > r.yieldStrength ? 'warning' : ''}">
          ${(r.vonMises / 1e6).toFixed(2)} MPa
        </div>
      </div>
      <div class="result-item">
        <div class="label">屈服强度</div>
        <div class="value">${(r.yieldStrength / 1e6).toFixed(2)} MPa</div>
      </div>
      <div class="result-item">
        <div class="label">安全系数</div>
        <div class="value ${r.safetyFactor < 1.5 ? 'warning' : ''}">
          ${r.safetyFactor.toFixed(2)}
        </div>
      </div>
    `
  }
  
  displayFatigueResults(fatigueResult) {
    const resultsDiv = document.getElementById('analysisResults')
    
    resultsDiv.innerHTML = `
      <div class="result-item">
        <div class="label">疲劳寿命</div>
        <div class="value ${fatigueResult.cycles < 1e6 ? 'warning' : ''}">
          ${fatigueResult.cycles.toExponential(2)} 次
        </div>
      </div>
      <div class="result-item">
        <div class="label">疲劳损伤</div>
        <div class="value ${fatigueResult.damage > 0.1 ? 'warning' : ''}">
          ${fatigueResult.damage.toFixed(4)}
        </div>
      </div>
      <div class="result-item">
        <div class="label">疲劳强度系数</div>
        <div class="value">${fatigueResult.fatigueStrengthCoeff.toFixed(2)}</div>
      </div>
      <div class="result-item">
        <div class="label">应力幅</div>
        <div class="value">${(fatigueResult.stressAmplitude / 1e6).toFixed(2)} MPa</div>
      </div>
      <div class="result-item">
        <div class="label">平均应力</div>
        <div class="value">${(fatigueResult.meanStress / 1e6).toFixed(2)} MPa</div>
      </div>
    `
  }
  
  displayMaterialComparisonResults() {
    const resultsDiv = document.getElementById('analysisResults')
    
    resultsDiv.innerHTML = this.materialComparison.generateComparisonTable()
  }
  
  displayWearResults() {
    const resultsDiv = document.getElementById('analysisResults')
    
    resultsDiv.innerHTML = this.wearPrediction.generateWearChart() + 
                           this.wearPrediction.generateSummaryHTML()
  }
  
  displayBatchResults() {
    const resultsDiv = document.getElementById('analysisResults')
    
    resultsDiv.innerHTML = this.batchSimulation.generateSummaryHTML()
  }
  
  visualizeStress() {
    if (!this.currentModel || !this.analysisResults) return
    
    const maxStress = this.analysisResults.maxStress
    const minStress = this.analysisResults.minStress
    
    const stressRange = Math.max(maxStress - minStress, 1e6)
    
    const applyColorsToMesh = (mesh) => {
      if (!mesh.geometry) return
      
      const geometry = mesh.geometry
      const colors = []
      const positions = geometry.attributes.position.array
      const count = positions.length / 3
      
      for (let i = 0; i < count; i++) {
        const stress = minStress + Math.random() * stressRange
        const normalizedStress = this.clamp((stress - minStress) / stressRange, 0, 1)
        
        const color = new THREE.Color()
        color.setHSL(0.66 * (1 - normalizedStress), 1, 0.5)
        
        colors.push(color.r, color.g, color.b)
      }
      
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => {
            m.vertexColors = true
            m.needsUpdate = true
          })
        } else {
          mesh.material.vertexColors = true
          mesh.material.needsUpdate = true
        }
      }
    }
    
    if (this.currentModel.isGroup) {
      this.currentModel.traverse((child) => {
        if (child.isMesh) {
          applyColorsToMesh(child)
        }
      })
    } else if (this.currentModel.isMesh) {
      applyColorsToMesh(this.currentModel)
    }
  }
  
  updateModelInfo() {
    const infoDiv = document.getElementById('modelInfo')
    const box = new THREE.Box3().setFromObject(this.currentModel)
    const size = box.getSize(new THREE.Vector3())
    
    let vertexCount = 0
    let faceCount = 0
    
    const countGeometry = (mesh) => {
      if (!mesh.geometry) return
      
      const posAttr = mesh.geometry.attributes.position
      if (posAttr) {
        vertexCount += posAttr.count
      }
      
      if (mesh.geometry.index) {
        faceCount += mesh.geometry.index.count / 3
      } else if (posAttr) {
        faceCount += posAttr.count / 3
      }
    }
    
    if (this.currentModel.isGroup) {
      this.currentModel.traverse((child) => {
        if (child.isMesh) {
          countGeometry(child)
        }
      })
    } else if (this.currentModel.isMesh) {
      countGeometry(this.currentModel)
    }
    
    infoDiv.innerHTML = `
      <div class="model-info-item">
        <span class="label">顶点数</span>
        <span class="value">${vertexCount}</span>
      </div>
      <div class="model-info-item">
        <span class="label">面数</span>
        <span class="value">${Math.round(faceCount)}</span>
      </div>
      <div class="model-info-item">
        <span class="label">尺寸 X</span>
        <span class="value">${size.x.toFixed(2)} m</span>
      </div>
      <div class="model-info-item">
        <span class="label">尺寸 Y</span>
        <span class="value">${size.y.toFixed(2)} m</span>
      </div>
      <div class="model-info-item">
        <span class="label">尺寸 Z</span>
        <span class="value">${size.z.toFixed(2)} m</span>
      </div>
    `
  }
  
  fitCameraToModel() {
    const box = new THREE.Box3().setFromObject(this.currentModel)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= 1.5
    
    this.camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ)
    this.controls.target.copy(center)
    this.controls.update()
  }
  
  saveProject() {
    const projectData = {
      material: this.getMaterialParams(),
      load: this.getLoadParams(),
      analysisResults: this.analysisResults,
      fatigueResults: this.fatigueResults,
      timestamp: new Date().toISOString()
    }
    
    this.projectManager.save(projectData)
  }
  
  loadProject() {
    const projectData = this.projectManager.load()
    if (projectData) {
      document.getElementById('elasticModulus').value = projectData.material.elasticModulus / 1e9
      document.getElementById('poissonRatio').value = projectData.material.poissonRatio
      document.getElementById('density').value = projectData.material.density
      
      document.getElementById('forceMagnitude').value = projectData.load.magnitude
      document.getElementById('forceDirX').value = projectData.load.direction.x
      document.getElementById('forceDirY').value = projectData.load.direction.y
      document.getElementById('forceDirZ').value = projectData.load.direction.z
      
      this.analysisResults = projectData.analysisResults
      if (this.analysisResults) {
        this.displayStressResults()
      }
      
      alert('方案加载成功')
    }
  }
  
  onResize() {
    const canvas = this.renderer.domElement
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight)
  }
  
  animate() {
    requestAnimationFrame(() => this.animate())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }
}

new MortiseTenonApp()
