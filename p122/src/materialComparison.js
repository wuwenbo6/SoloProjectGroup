import * as THREE from 'three'

export class MaterialComparison {
  constructor(stressAnalysis) {
    this.stressAnalysis = stressAnalysis
    this.results = []
    this.colors = ['#e94560', '#4ecdc4', '#ffe66d']
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  compareMaterials(model, load, materials) {
    this.results = []

    materials.forEach((material, index) => {
      const result = this.stressAnalysis.analyze(model, material, load)
      
      this.results.push({
        name: material.name || `材质 ${index + 1}`,
        material: material,
        maxStress: result.maxStress,
        minStress: result.minStress,
        vonMises: result.vonMises,
        safetyFactor: result.safetyFactor,
        deformation: this.estimateDeformation(material, load, result),
        color: this.colors[index % this.colors.length],
        index: index
      })
    })

    return this.results
  }

  estimateDeformation(material, load, stressResult) {
    const deformation = (load.magnitude * 0.01) / material.elasticModulus
    return this.clamp(deformation * 1000, 0.001, 10)
  }

  getBestMaterial() {
    if (this.results.length === 0) return null
    
    return this.results.reduce((best, current) => {
      const bestScore = best.safetyFactor / best.maxStress
      const currentScore = current.safetyFactor / current.maxStress
      return currentScore > bestScore ? current : best
    })
  }

  getWorstMaterial() {
    if (this.results.length === 0) return null
    
    return this.results.reduce((worst, current) => {
      const worstScore = worst.safetyFactor / worst.maxStress
      const currentScore = current.safetyFactor / current.maxStress
      return currentScore < worstScore ? current : worst
    })
  }

  generateComparisonTable() {
    if (this.results.length === 0) return ''

    const best = this.getBestMaterial()
    const worst = this.getWorstMaterial()

    let html = `
      <table class="comparison-table">
        <thead>
          <tr>
            <th>材质</th>
            <th>最大应力 (MPa)</th>
            <th>安全系数</th>
            <th>变形量 (mm)</th>
          </tr>
        </thead>
        <tbody>
    `

    this.results.forEach(result => {
      const isBest = best && result.name === best.name
      const isWorst = worst && result.name === worst.name
      const rowClass = isBest ? 'best-result' : (isWorst ? 'worst-result' : '')

      html += `
        <tr class="${rowClass}">
          <td style="color: ${result.color}">${result.name}</td>
          <td>${(result.maxStress / 1e6).toFixed(2)}</td>
          <td>${result.safetyFactor.toFixed(2)}</td>
          <td>${result.deformation.toFixed(3)}</td>
        </tr>
      `
    })

    html += `
        </tbody>
      </table>
      <div style="margin-top: 10px; font-size: 11px; color: #a0a0a0;">
        <p>✓ 推荐: <span style="color: ${best.color}">${best.name}</span> (安全系数最高)</p>
        <p>⚠ 注意: <span style="color: ${worst.color}">${worst.name}</span> 应力表现较差</p>
      </div>
    `

    return html
  }

  generateComparisonReport() {
    if (this.results.length === 0) return ''

    const best = this.getBestMaterial()

    let report = '多材质受力对比分析报告\n'
    report += '='.repeat(40) + '\n\n'

    this.results.forEach(result => {
      report += `【${result.name}】\n`
      report += `  最大主应力: ${(result.maxStress / 1e6).toFixed(2)} MPa\n`
      report += `  安全系数: ${result.safetyFactor.toFixed(2)}\n`
      report += `  预估变形: ${result.deformation.toFixed(4)} mm\n\n`
    })

    report += '='.repeat(40) + '\n'
    report += `推荐材质: ${best.name}\n`
    report += `推荐理由: 安全系数最高 (${best.safetyFactor.toFixed(2)})，应力表现最优\n`

    return report
  }

  createComparisonScene(scene, model) {
    const comparisonGroup = new THREE.Group()
    comparisonGroup.name = 'comparisonGroup'

    const spacing = 3
    this.results.forEach((result, index) => {
      const clone = model.clone()
      clone.position.x = (index - (this.results.length - 1) / 2) * spacing

      const color = new THREE.Color(result.color)
      
      clone.traverse((child) => {
        if (child.isMesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(m => {
              const newMat = m.clone()
              newMat.color = color.clone()
              newMat.transparent = true
              newMat.opacity = 0.8
              return newMat
            })
          } else {
            child.material = child.material.clone()
            child.material.color = color.clone()
            child.material.transparent = true
            child.material.opacity = 0.8
          }
        }
      })

      const labelCanvas = this.createLabelCanvas(result.name, result.color)
      const labelTexture = new THREE.CanvasTexture(labelCanvas)
      const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture })
      const labelSprite = new THREE.Sprite(labelMaterial)
      labelSprite.position.y = 1.5
      labelSprite.scale.set(1.5, 0.5, 1)
      clone.add(labelSprite)

      comparisonGroup.add(clone)
    })

    scene.add(comparisonGroup)
    return comparisonGroup
  }

  createLabelCanvas(text, color) {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64

    ctx.fillStyle = 'rgba(26, 26, 46, 0.9)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = color
    ctx.font = 'bold 28px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)

    return canvas
  }

  removeComparisonScene(scene) {
    const comparisonGroup = scene.getObjectByName('comparisonGroup')
    if (comparisonGroup) {
      scene.remove(comparisonGroup)
      comparisonGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
  }

  calculateStressRatio() {
    if (this.results.length < 2) return []
    
    const ratios = []
    const base = this.results[0]
    
    for (let i = 1; i < this.results.length; i++) {
      ratios.push({
        name: this.results[i].name,
        stressRatio: this.results[i].maxStress / base.maxStress,
        safetyRatio: this.results[i].safetyFactor / base.safetyFactor,
        improvement: ((base.maxStress - this.results[i].maxStress) / base.maxStress * 100).toFixed(1)
      })
    }
    
    return ratios
  }
}
