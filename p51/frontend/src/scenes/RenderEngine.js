import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class RenderEngine {
    constructor(container, options = {}) {
        this.container = container
        this.options = options
        
        this.scene = null
        this.camera = null
        this.renderer = null
        this.controls = null
        
        this.animationId = null
        this.isPaused = false
        
        this.performanceMode = options.performanceMode || 'auto'
        this.pixelRatio = options.pixelRatio || 1
        
        this.onBeforeRender = options.onBeforeRender || (() => {})
        this.onAfterRender = options.onAfterRender || (() => {})
        
        this.init()
    }

    init() {
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(this.options.backgroundColor || 0x0a0a1a)
        
        if (this.options.fog !== false) {
            this.scene.fog = new THREE.Fog(this.scene.background, 30, 100)
        }
        
        const { clientWidth, clientHeight } = this.container
        this.camera = new THREE.PerspectiveCamera(
            this.options.fov || 45,
            clientWidth / clientHeight,
            this.options.near || 0.1,
            this.options.far || 1000
        )
        this.camera.position.set(8, 6, 8)
        
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.options.antialias !== false,
            powerPreference: 'high-performance'
        })
        this.renderer.setSize(clientWidth, clientHeight)
        this.renderer.setPixelRatio(this.pixelRatio)
        this.renderer.shadowMap.enabled = this.options.shadows !== false
        this.renderer.shadowMap.type = this.options.shadowMapType || THREE.PCFSoftShadowMap
        this.container.appendChild(this.renderer.domElement)
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement)
        this.controls.enableDamping = true
        this.controls.dampingFactor = 0.05
        this.controls.minDistance = this.options.minDistance || 3
        this.controls.maxDistance = this.options.maxDistance || 30
        this.controls.autoRotate = false
        
        this.setupLights()
        
        if (this.options.ground !== false) {
            this.setupGround()
        }
        
        window.addEventListener('resize', () => this.onResize())
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
        this.scene.add(ambientLight)

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
        mainLight.position.set(10, 15, 10)
        mainLight.castShadow = true
        mainLight.shadow.mapSize.width = this.performanceMode === 'low' ? 512 : 1024
        mainLight.shadow.mapSize.height = this.performanceMode === 'low' ? 512 : 1024
        this.scene.add(mainLight)

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3)
        fillLight.position.set(-10, 5, -10)
        this.scene.add(fillLight)
        
        this.mainLight = mainLight
    }

    setupGround() {
        const gridHelper = new THREE.GridHelper(50, 50, 0x333366, 0x222244)
        this.scene.add(gridHelper)
        
        const groundGeometry = new THREE.PlaneGeometry(50, 50)
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x16213e,
            transparent: true,
            opacity: 0.8
        })
        const ground = new THREE.Mesh(groundGeometry, groundMaterial)
        ground.rotation.x = -Math.PI / 2
        ground.position.y = -0.01
        ground.receiveShadow = true
        this.scene.add(ground)
    }

    start() {
        this.isPaused = false
        this.animate()
    }

    stop() {
        this.isPaused = true
        if (this.animationId) {
            cancelAnimationFrame(this.animationId)
            this.animationId = null
        }
    }

    animate() {
        if (this.isPaused) return
        
        this.animationId = requestAnimationFrame(() => this.animate())
        
        this.onBeforeRender()
        
        this.controls.update()
        this.renderer.render(this.scene, this.camera)
        
        this.onAfterRender()
    }

    onResize() {
        const { clientWidth, clientHeight } = this.container
        this.camera.aspect = clientWidth / clientHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(clientWidth, clientHeight)
    }

    setCameraPosition(x, y, z) {
        this.camera.position.set(x, y, z)
    }

    setAutoRotate(enabled, speed = 1.0) {
        this.controls.autoRotate = enabled
        this.controls.autoRotateSpeed = speed
    }

    addObject(object) {
        this.scene.add(object)
    }

    removeObject(object) {
        this.scene.remove(object)
    }

    getObjectByName(name) {
        return this.scene.getObjectByName(name)
    }

    getObjectsByType(type) {
        const results = []
        this.scene.traverse(obj => {
            if (obj.type === type) {
                results.push(obj)
            }
        })
        return results
    }

    applyPerformanceSettings(mode) {
        this.performanceMode = mode
        
        const pixelRatios = { low: 0.75, medium: 1, high: window.devicePixelRatio }
        this.renderer.setPixelRatio(pixelRatios[mode] || 1)
        
        const shadowSizes = { low: 512, medium: 1024, high: 2048 }
        const size = shadowSizes[mode]
        
        this.renderer.shadowMap.enabled = mode !== 'low'
        this.renderer.shadowMap.type = mode === 'low' ? 
            THREE.BasicShadowMap : THREE.PCFSoftShadowMap
        
        this.scene.traverse(object => {
            if (object.isLight && object.castShadow && object.shadow) {
                object.shadow.mapSize.set(size, size)
                object.shadow.needsUpdate = true
            }
        })
    }

    resetView() {
        this.camera.position.set(8, 6, 8)
        this.controls.target.set(0, 0, 0)
        this.controls.update()
    }

    dispose() {
        this.stop()
        this.renderer.dispose()
        this.controls.dispose()
        window.removeEventListener('resize', () => this.onResize())
        
        this.scene.traverse(object => {
            if (object.geometry) object.geometry.dispose()
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose())
                } else {
                    object.material.dispose()
                }
            }
        })
        
        if (this.container && this.renderer.domElement.parentNode) {
            this.container.removeChild(this.renderer.domElement)
        }
    }

    getStats() {
        let triangles = 0
        let meshes = 0
        let lights = 0
        
        this.scene.traverse(obj => {
            if (obj.isMesh) {
                meshes++
                if (obj.geometry && obj.geometry.index) {
                    triangles += obj.geometry.index.count / 3
                } else if (obj.geometry && obj.geometry.attributes.position) {
                    triangles += obj.geometry.attributes.position.count / 3
                }
            }
            if (obj.isLight) lights++
        })
        
        return {
            meshes,
            lights,
            triangles: Math.round(triangles),
            pixelRatio: this.renderer.getPixelRatio()
        }
    }
}