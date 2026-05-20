import * as THREE from 'three'

export class PreviewExporter {
  constructor(renderer, scene, camera) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.exportCanvas = null
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  async exportImage(options = {}) {
    const {
      width = 1920,
      height = 1080,
      format = 'png',
      showGrid = true,
      showAxes = true,
      showWireframe = false
    } = options

    const originalSize = {
      width: this.renderer.domElement.width,
      height: this.renderer.domElement.height
    }

    this.renderer.setSize(width, height)

    const originalCameraSize = { fov: this.camera.fov, aspect: this.camera.aspect }
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()

    const helpers = []
    if (!showGrid) {
      this.scene.traverse(obj => {
        if (obj instanceof THREE.GridHelper) {
          obj.visible = false
          helpers.push(obj)
        }
      })
    }

    if (!showAxes) {
      this.scene.traverse(obj => {
        if (obj instanceof THREE.AxesHelper) {
          obj.visible = false
          helpers.push(obj)
        }
      })
    }

    const wireframeMaterials = []
    if (showWireframe) {
      this.scene.traverse(obj => {
        if (obj.isMesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => {
              m.wireframe = true
              wireframeMaterials.push(m)
            })
          } else {
            obj.material.wireframe = true
            wireframeMaterials.push(obj.material)
          }
        }
      })
    }

    this.renderer.render(this.scene, this.camera)

    const dataURL = this.renderer.domElement.toDataURL(
      format === 'png' ? 'image/png' : 'image/jpeg',
      0.95
    )

    helpers.forEach(h => h.visible = true)
    wireframeMaterials.forEach(m => m.wireframe = false)

    this.renderer.setSize(originalSize.width, originalSize.height)
    this.camera.fov = originalCameraSize.fov
    this.camera.aspect = originalCameraSize.aspect
    this.camera.updateProjectionMatrix()

    return dataURL
  }

  downloadImage(options = {}) {
    return this.exportImage(options).then(dataURL => {
      const link = document.createElement('a')
      link.download = `preview_${Date.now()}.${options.format || 'png'}`
      link.href = dataURL
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      return dataURL
    })
  }

  exportOBJ(model) {
    let objData = '# OBJ Export from Mortise and Tenon Analysis\n'
    objData += `# Export Date: ${new Date().toISOString()}\n\n`

    let vertexIndex = 1
    let faceIndex = 1

    const processMesh = (mesh) => {
      if (!mesh.geometry) return ''

      let data = `o ${mesh.name || 'mesh_' + faceIndex}\n`

      const positions = mesh.geometry.attributes.position
      if (positions) {
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i)
          const y = positions.getY(i)
          const z = positions.getZ(i)
          data += `v ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
        }
      }

      const normals = mesh.geometry.attributes.normal
      if (normals) {
        for (let i = 0; i < normals.count; i++) {
          const x = normals.getX(i)
          const y = normals.getY(i)
          const z = normals.getZ(i)
          data += `vn ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
        }
      }

      const uvs = mesh.geometry.attributes.uv
      if (uvs) {
        for (let i = 0; i < uvs.count; i++) {
          const u = uvs.getX(i)
          const v = uvs.getY(i)
          data += `vt ${u.toFixed(6)} ${v.toFixed(6)}\n`
        }
      }

      if (mesh.geometry.index) {
        const indices = mesh.geometry.index
        for (let i = 0; i < indices.count; i += 3) {
          const i0 = indices.getX(i) + vertexIndex
          const i1 = indices.getX(i + 1) + vertexIndex
          const i2 = indices.getX(i + 2) + vertexIndex
          data += `f ${i0}//${i0} ${i1}//${i1} ${i2}//${i2}\n`
        }
      } else if (positions) {
        for (let i = 0; i < positions.count; i += 3) {
          const i0 = i + vertexIndex
          const i1 = i + vertexIndex + 1
          const i2 = i + vertexIndex + 2
          data += `f ${i0}//${i0} ${i1}//${i1} ${i2}//${i2}\n`
        }
      }

      if (positions) {
        vertexIndex += positions.count
      }
      faceIndex++

      return data + '\n'
    }

    if (model.isGroup) {
      model.traverse(child => {
        if (child.isMesh) {
          objData += processMesh(child)
        }
      })
    } else if (model.isMesh) {
      objData += processMesh(model)
    }

    return objData
  }

  downloadOBJ(model) {
    const objData = this.exportOBJ(model)

    const blob = new Blob([objData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.download = `model_${Date.now()}.obj`
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return objData
  }

  exportSTL(model, binary = false) {
    if (binary) {
      return this.exportSTLBinary(model)
    }
    return this.exportSTLASCII(model)
  }

  exportSTLASCII(model) {
    let stlData = 'solid MortiseAndTenonModel\n'

    const processMesh = (mesh) => {
      if (!mesh.geometry) return ''

      let data = ''
      const positions = mesh.geometry.attributes.position
      const normals = mesh.geometry.attributes.normal

      const processFace = (i0, i1, i2) => {
        const v0 = new THREE.Vector3(
          positions.getX(i0),
          positions.getY(i0),
          positions.getZ(i0)
        )
        const v1 = new THREE.Vector3(
          positions.getX(i1),
          positions.getY(i1),
          positions.getZ(i1)
        )
        const v2 = new THREE.Vector3(
          positions.getX(i2),
          positions.getY(i2),
          positions.getZ(i2)
        )

        const normal = new THREE.Vector3()
        if (normals) {
          normal.set(
            (normals.getX(i0) + normals.getX(i1) + normals.getX(i2)) / 3,
            (normals.getY(i0) + normals.getY(i1) + normals.getY(i2)) / 3,
            (normals.getZ(i0) + normals.getZ(i1) + normals.getZ(i2)) / 3
          ).normalize()
        } else {
          normal.crossVectors(
            new THREE.Vector3().subVectors(v1, v0),
            new THREE.Vector3().subVectors(v2, v0)
          ).normalize()
        }

        data += `facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`
        data += 'outer loop\n'
        data += `vertex ${v0.x.toFixed(6)} ${v0.y.toFixed(6)} ${v0.z.toFixed(6)}\n`
        data += `vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`
        data += `vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`
        data += 'endloop\nendfacet\n'
      }

      if (mesh.geometry.index) {
        const indices = mesh.geometry.index
        for (let i = 0; i < indices.count; i += 3) {
          processFace(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2))
        }
      } else if (positions) {
        for (let i = 0; i < positions.count; i += 3) {
          processFace(i, i + 1, i + 2)
        }
      }

      return data
    }

    if (model.isGroup) {
      model.traverse(child => {
        if (child.isMesh) {
          stlData += processMesh(child)
        }
      })
    } else if (model.isMesh) {
      stlData += processMesh(model)
    }

    stlData += 'endsolid MortiseAndTenonModel\n'
    return stlData
  }

  exportSTLBinary(model) {
    let facets = []

    const processMesh = (mesh) => {
      if (!mesh.geometry) return

      const positions = mesh.geometry.attributes.position
      const normals = mesh.geometry.attributes.normal

      const processFace = (i0, i1, i2) => {
        const v0 = [positions.getX(i0), positions.getY(i0), positions.getZ(i0)]
        const v1 = [positions.getX(i1), positions.getY(i1), positions.getZ(i1)]
        const v2 = [positions.getX(i2), positions.getY(i2), positions.getZ(i2)]

        let normal = [0, 0, 0]
        if (normals) {
          normal = [
            (normals.getX(i0) + normals.getX(i1) + normals.getX(i2)) / 3,
            (normals.getY(i0) + normals.getY(i1) + normals.getY(i2)) / 3,
            (normals.getZ(i0) + normals.getZ(i1) + normals.getZ(i2)) / 3
          ]
          const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2)
          if (len > 0) {
            normal = normal.map(n => n / len)
          }
        }

        facets.push({ normal, vertices: [v0, v1, v2] })
      }

      if (mesh.geometry.index) {
        const indices = mesh.geometry.index
        for (let i = 0; i < indices.count; i += 3) {
          processFace(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2))
        }
      } else if (positions) {
        for (let i = 0; i < positions.count; i += 3) {
          processFace(i, i + 1, i + 2)
        }
      }
    }

    if (model.isGroup) {
      model.traverse(child => {
        if (child.isMesh) processMesh(child)
      })
    } else if (model.isMesh) {
      processMesh(model)
    }

    const buffer = new ArrayBuffer(84 + facets.length * 50)
    const dataView = new DataView(buffer)

    const header = 'Binary STL from Mortise and Tenon Analysis'
    for (let i = 0; i < 80; i++) {
      dataView.setUint8(i, i < header.length ? header.charCodeAt(i) : 0)
    }

    dataView.setUint32(80, facets.length, true)

    let offset = 84
    facets.forEach(facet => {
      facet.normal.forEach(n => {
        dataView.setFloat32(offset, n, true)
        offset += 4
      })

      facet.vertices.forEach(v => {
        v.forEach(coord => {
          dataView.setFloat32(offset, coord, true)
          offset += 4
        })
      })

      dataView.setUint16(offset, 0, true)
      offset += 2
    })

    return new Blob([buffer], { type: 'application/octet-stream' })
  }

  downloadSTL(model, binary = false) {
    if (binary) {
      const blob = this.exportSTLBinary(model)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `model_${Date.now()}.stl`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return blob
    } else {
      const stlData = this.exportSTLASCII(model)
      const blob = new Blob([stlData], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `model_${Date.now()}.stl`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return stlData
    }
  }

  generateThumbnail(width = 200, height = 150) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    const imageData = ctx.createImageData(width, height)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 26
      imageData.data[i + 1] = 26
      imageData.data[i + 2] = 46
      imageData.data[i + 3] = 255
    }
    ctx.putImageData(imageData, 0, 0)

    ctx.fillStyle = '#4ecdc4'
    ctx.fillRect(width * 0.25, height * 0.3, width * 0.5, height * 0.4)

    ctx.fillStyle = '#e94560'
    ctx.fillRect(width * 0.1, height * 0.4, width * 0.2, height * 0.2)

    return canvas.toDataURL('image/png')
  }

  exportReport(model, analysisResults) {
    let report = '='.repeat(60) + '\n'
    report += '           农具榫卯结构完整分析报告\n'
    report += '='.repeat(60) + '\n\n'
    report += `生成时间: ${new Date().toLocaleString()}\n\n`

    report += '-'.repeat(60) + '\n'
    report += '一、模型信息\n'
    report += '-'.repeat(60) + '\n'

    let vertexCount = 0
    let faceCount = 0

    const countMesh = (mesh) => {
      if (!mesh.geometry) return
      const positions = mesh.geometry.attributes.position
      if (positions) vertexCount += positions.count
      if (mesh.geometry.index) {
        faceCount += mesh.geometry.index.count / 3
      } else if (positions) {
        faceCount += positions.count / 3
      }
    }

    if (model.isGroup) {
      model.traverse(child => { if (child.isMesh) countMesh(child) })
    } else if (model.isMesh) {
      countMesh(model)
    }

    report += `  顶点数: ${vertexCount}\n`
    report += `  面数: ${Math.round(faceCount)}\n\n`

    if (analysisResults) {
      report += '-'.repeat(60) + '\n'
      report += '二、应力分析结果\n'
      report += '-'.repeat(60) + '\n'
      report += `  最大主应力: ${(analysisResults.maxStress / 1e6).toFixed(3)} MPa\n`
      report += `  最小主应力: ${(analysisResults.minStress / 1e6).toFixed(3)} MPa\n`
      report += `  等效应力: ${(analysisResults.vonMises / 1e6).toFixed(3)} MPa\n`
      report += `  安全系数: ${analysisResults.safetyFactor.toFixed(3)}\n\n`

      report += '-'.repeat(60) + '\n'
      report += '三、评估结论\n'
      report += '-'.repeat(60) + '\n'

      if (analysisResults.safetyFactor >= 2.0) {
        report += '  ✓ 结构安全，安全系数充足\n'
      } else if (analysisResults.safetyFactor >= 1.5) {
        report += '  ⚠ 结构基本安全，建议适当优化\n'
      } else {
        report += '  ✗ 结构不安全，需要重新设计\n'
      }

      if (analysisResults.maxStress > analysisResults.yieldStrength) {
        report += '  ✗ 最大应力超过屈服强度，存在塑性变形风险\n'
      } else {
        report += '  ✓ 应力在屈服强度范围内\n'
      }
    }

    report += '\n' + '='.repeat(60) + '\n'
    report += '                 报告结束\n'
    report += '='.repeat(60) + '\n'

    return report
  }

  downloadReport(model, analysisResults) {
    const report = this.exportReport(model, analysisResults)
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.download = `analysis_report_${Date.now()}.txt`
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return report
  }
}
