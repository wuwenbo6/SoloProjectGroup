import * as THREE from 'three'

export class ModelLoader {
  constructor(scene) {
    this.scene = scene
  }
  
  async loadFile(file) {
    const extension = file.name.split('.').pop().toLowerCase()
    
    switch (extension) {
      case 'json':
        return this.loadJSON(file)
      case 'obj':
        return this.loadOBJ(file)
      case 'glb':
      case 'gltf':
        return this.loadGLTF(file)
      default:
        return this.createDefaultMortiseTenon()
    }
  }
  
  async loadJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          if (data.type === 'mortise_tenon') {
            const model = this.createMortiseTenonFromParams(data.params)
            resolve(model)
          } else {
            resolve(this.createDefaultMortiseTenon())
          }
        } catch (err) {
          reject(err)
        }
      }
      reader.readAsText(file)
    })
  }
  
  async loadOBJ(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const contents = e.target.result
        const geometry = this.parseOBJ(contents)
        const material = new THREE.MeshPhongMaterial({
          color: 0x8B4513,
          shininess: 30
        })
        const mesh = new THREE.Mesh(geometry, material)
        this.scene.add(mesh)
        resolve(mesh)
      }
      reader.readAsText(file)
    })
  }
  
  async loadGLTF(file) {
    return this.createDefaultMortiseTenon()
  }
  
  parseOBJ(contents) {
    const geometry = new THREE.BufferGeometry()
    const vertices = []
    const normals = []
    const uvs = []
    const indices = []
    
    const lines = contents.split('\n')
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const type = parts[0]
      
      if (type === 'v') {
        vertices.push(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        )
      } else if (type === 'vn') {
        normals.push(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        )
      } else if (type === 'vt') {
        uvs.push(
          parseFloat(parts[1]),
          parseFloat(parts[2])
        )
      } else if (type === 'f') {
        for (let i = 1; i <= 3; i++) {
          const faceParts = parts[i].split('/')
          indices.push(parseInt(faceParts[0]) - 1)
        }
      }
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    if (normals.length > 0) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    }
    if (uvs.length > 0) {
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    }
    if (indices.length > 0) {
      geometry.setIndex(indices)
    }
    
    geometry.computeVertexNormals()
    return geometry
  }
  
  createDefaultMortiseTenon() {
    const group = new THREE.Group()
    
    const tenonMaterial = new THREE.MeshPhongMaterial({
      color: 0xCD853F,
      shininess: 30
    })
    
    const mortiseMaterial = new THREE.MeshPhongMaterial({
      color: 0x8B4513,
      shininess: 30
    })
    
    const tenon = this.createTenon(tenonMaterial)
    const mortise = this.createMortise(mortiseMaterial)
    
    mortise.position.x = 1.1
    
    group.add(tenon)
    group.add(mortise)
    
    this.scene.add(group)
    
    return group
  }
  
  createTenon(material) {
    const group = new THREE.Group()
    
    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.4, 0.6),
      material
    )
    mainBody.position.x = -0.25
    group.add(mainBody)
    
    const tenonPart = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 0.4),
      material
    )
    tenonPart.position.x = 0.9
    tenonPart.position.y = 0.05
    group.add(tenonPart)
    
    return group
  }
  
  createMortise(material) {
    const group = new THREE.Group()
    
    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.4, 0.6),
      material
    )
    mainBody.position.x = 0.25
    group.add(mainBody)
    
    const holeShape = new THREE.Shape()
    holeShape.moveTo(-0.5, -0.2)
    holeShape.lineTo(0.5, -0.2)
    holeShape.lineTo(0.5, 0.2)
    holeShape.lineTo(-0.5, 0.2)
    holeShape.lineTo(-0.5, -0.2)
    
    const outerShape = new THREE.Shape()
    outerShape.moveTo(-0.8, -0.3)
    outerShape.lineTo(0.8, -0.3)
    outerShape.lineTo(0.8, 0.3)
    outerShape.lineTo(-0.8, 0.3)
    outerShape.lineTo(-0.8, -0.3)
    
    outerShape.holes.push(holeShape)
    
    const extrudeSettings = {
      depth: 0.5,
      bevelEnabled: false
    }
    
    const mortiseGeometry = new THREE.ExtrudeGeometry(outerShape, extrudeSettings)
    mortiseGeometry.rotateY(Math.PI / 2)
    mortiseGeometry.translate(0, 0, 0)
    
    const mortiseHole = new THREE.Mesh(mortiseGeometry, material)
    mortiseHole.position.x = -0.5
    group.add(mortiseHole)
    
    return group
  }
  
  createMortiseTenonFromParams(params) {
    const group = new THREE.Group()
    
    const tenonMaterial = new THREE.MeshPhongMaterial({
      color: 0xCD853F,
      shininess: 30
    })
    
    const mortiseMaterial = new THREE.MeshPhongMaterial({
      color: 0x8B4513,
      shininess: 30
    })
    
    const tenonWidth = params.tenonWidth || 0.4
    const tenonHeight = params.tenonHeight || 0.3
    const tenonLength = params.tenonLength || 0.8
    const beamWidth = params.beamWidth || 0.6
    const beamHeight = params.beamHeight || 0.4
    const beamLength = params.beamLength || 1.5
    
    const tenonBody = new THREE.Mesh(
      new THREE.BoxGeometry(beamLength, beamHeight, beamWidth),
      tenonMaterial
    )
    tenonBody.position.x = -beamLength / 2
    group.add(tenonBody)
    
    const tenonPart = new THREE.Mesh(
      new THREE.BoxGeometry(tenonLength, tenonHeight, tenonWidth),
      tenonMaterial
    )
    tenonPart.position.x = tenonLength / 2
    tenonPart.position.y = (tenonHeight - beamHeight) / 2
    group.add(tenonPart)
    
    const mortiseBody = new THREE.Mesh(
      new THREE.BoxGeometry(beamLength, beamHeight, beamWidth),
      mortiseMaterial
    )
    mortiseBody.position.x = beamLength + tenonLength
    group.add(mortiseBody)
    
    this.scene.add(group)
    
    return group
  }
}
