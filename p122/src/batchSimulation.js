import * as THREE from 'three'

export class BatchSimulation {
  constructor(stressAnalysis) {
    this.stressAnalysis = stressAnalysis
    this.results = []
    this.isRunning = false
    this.onProgress = null
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  async runSimulation(model, baseMaterial, baseLoad, params) {
    this.results = []
    this.isRunning = true

    const { count, minForce, maxForce, variableType } = params

    for (let i = 0; i < count; i++) {
      if (!this.isRunning) break

      const progress = (i + 1) / count

      let currentMaterial
      let currentLoad

      switch (variableType) {
        case 'force':
          currentMaterial = { ...baseMaterial }
          const force = minForce + (maxForce - minForce) * (i / (count - 1 || 1))
          currentLoad = { ...baseLoad, magnitude: force }
          break

        case 'elasticModulus':
          const minE = baseMaterial.elasticModulus * 0.5
          const maxE = baseMaterial.elasticModulus * 2
          const e = minE + (maxE - minE) * (i / (count - 1 || 1))
          currentMaterial = { ...baseMaterial, elasticModulus: e }
          currentLoad = { ...baseLoad }
          break

        case 'direction':
          const angle = (i / count) * Math.PI * 2
          const dir = new THREE.Vector3(
            Math.cos(angle),
            -1,
            Math.sin(angle)
          ).normalize()
          currentMaterial = { ...baseMaterial }
          currentLoad = { ...baseLoad, direction: dir }
          break

        default:
          currentMaterial = { ...baseMaterial }
          currentLoad = { ...baseLoad }
      }

      const result = this.stressAnalysis.analyze(model, currentMaterial, currentLoad)

      this.results.push({
        index: i,
        progress: progress,
        variableType: variableType,
        variableValue: this.getVariableValue(currentMaterial, currentLoad, variableType),
        maxStress: result.maxStress,
        safetyFactor: result.safetyFactor,
        vonMises: result.vonMises,
        status: result.safetyFactor > 2 ? 'success' : (result.safetyFactor > 1.2 ? 'warning' : 'danger')
      })

      if (this.onProgress) {
        this.onProgress(this.results[i], i, count)
      }

      await this.delay(50)
    }

    this.isRunning = false
    return this.results
  }

  getVariableValue(material, load, type) {
    switch (type) {
      case 'force':
        return load.magnitude
      case 'elasticModulus':
        return material.elasticModulus
      case 'direction':
        return load.direction
      default:
        return null
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  stop() {
    this.isRunning = false
  }

  generateSummaryHTML() {
    if (this.results.length === 0) return ''

    const successCount = this.results.filter(r => r.status === 'success').length
    const warningCount = this.results.filter(r => r.status === 'warning').length
    const dangerCount = this.results.filter(r => r.status === 'danger').length

    const avgSafety = this.results.reduce((sum, r) => sum + r.safetyFactor, 0) / this.results.length
    const avgStress = this.results.reduce((sum, r) => sum + r.maxStress, 0) / this.results.length
    const maxStress = Math.max(...this.results.map(r => r.maxStress))
    const minStress = Math.min(...this.results.map(r => r.maxStress))

    let html = `
      <div class="wear-summary" style="grid-template-columns: repeat(2, 1fr);">
        <div class="wear-item">
          <div class="label">安全通过</div>
          <div class="value" style="color: #4ecdc4">${successCount}</div>
        </div>
        <div class="wear-item">
          <div class="label">警告状态</div>
          <div class="value" style="color: #ffe66d">${warningCount}</div>
        </div>
        <div class="wear-item">
          <div class="label">危险状态</div>
          <div class="value" style="color: #e94560">${dangerCount}</div>
        </div>
        <div class="wear-item">
          <div class="label">平均安全系数</div>
          <div class="value">${avgSafety.toFixed(2)}</div>
        </div>
      </div>
      
      <div style="margin-top: 10px; padding: 8px; background: #1a1a2e; border-radius: 4px;">
        <p style="font-size: 11px; color: #a0a0a0; margin-bottom: 4px;">
          平均应力: ${(avgStress / 1e6).toFixed(2)} MPa
        </p>
        <p style="font-size: 11px; color: #a0a0a0; margin-bottom: 4px;">
          最大应力: ${(maxStress / 1e6).toFixed(2)} MPa
        </p>
        <p style="font-size: 11px; color: #a0a0a0;">
          最小应力: ${(minStress / 1e6).toFixed(2)} MPa
        </p>
      </div>
      
      <div class="batch-results" style="max-height: 150px; overflow-y: auto; margin-top: 10px;">
    `

    this.results.forEach(r => {
      const statusColors = {
        success: '#4ecdc4',
        warning: '#ffe66d',
        danger: '#e94560'
      }

      const label = this.getResultLabel(r)

      html += `
        <div class="batch-result-item ${r.status}">
          <span>${label}</span>
          <span>${(r.maxStress / 1e6).toFixed(2)} MPa</span>
        </div>
      `
    })

    html += '</div>'

    return html
  }

  getResultLabel(result) {
    switch (result.variableType) {
      case 'force':
        return `载荷 ${result.variableValue.toFixed(0)} N`
      case 'elasticModulus':
        return `E ${(result.variableValue / 1e9).toFixed(1)} GPa`
      case 'direction':
        return `方向 ${Math.round(Math.atan2(result.variableValue.z, result.variableValue.x) * 180 / Math.PI)}°`
      default:
        return `仿真 ${result.index + 1}`
    }
  }

  getCriticalResults() {
    return {
      critical: this.results.filter(r => r.status === 'danger'),
      warnings: this.results.filter(r => r.status === 'warning'),
      safe: this.results.filter(r => r.status === 'success')
    }
  }

  getRecommendation() {
    const critical = this.results.filter(r => r.status === 'danger')

    if (critical.length === 0) {
      return {
        level: 'safe',
        message: '所有仿真结果均安全，设计方案可行'
      }
    } else if (critical.length < this.results.length * 0.3) {
      return {
        level: 'warning',
        message: '部分工况存在风险，建议优化参数范围'
      }
    } else {
      return {
        level: 'danger',
        message: '多数工况不安全，建议重新设计或更换材料'
      }
    }
  }

  generateReport() {
    if (this.results.length === 0) return ''

    const summary = this.getCriticalResults()
    const recommendation = this.getRecommendation()

    let report = '批量仿真分析报告\n'
    report += '='.repeat(40) + '\n\n'

    report += '【仿真统计】\n'
    report += `  总仿真次数: ${this.results.length}\n`
    report += `  安全通过: ${summary.safe.length}\n`
    report += `  警告状态: ${summary.warnings.length}\n`
    report += `  危险状态: ${summary.critical.length}\n\n`

    report += '【性能统计】\n'
    const avgSafety = this.results.reduce((sum, r) => sum + r.safetyFactor, 0) / this.results.length
    const maxSafety = Math.max(...this.results.map(r => r.safetyFactor))
    const minSafety = Math.min(...this.results.map(r => r.safetyFactor))

    report += `  平均安全系数: ${avgSafety.toFixed(3)}\n`
    report += `  最大安全系数: ${maxSafety.toFixed(3)}\n`
    report += `  最小安全系数: ${minSafety.toFixed(3)}\n\n`

    report += '【详细结果】\n'
    this.results.forEach((r, i) => {
      const statusText = r.status === 'success' ? '安全' : (r.status === 'warning' ? '警告' : '危险')
      const label = this.getResultLabel(r)
      report += `  ${label}: 安全系数 ${r.safetyFactor.toFixed(2)}, 应力 ${(r.maxStress / 1e6).toFixed(2)} MPa [${statusText}]\n`
    })

    report += '\n【结论建议】\n'
    report += `  ${recommendation.message}\n`

    if (summary.critical.length > 0) {
      report += '\n【危险工况】\n'
      summary.critical.forEach(r => {
        report += `  ${this.getResultLabel(r)}: 安全系数 ${r.safetyFactor.toFixed(2)}\n`
      })
    }

    return report
  }

  exportCSV() {
    if (this.results.length === 0) return ''

    let csv = '序号,变量类型,变量值,最大应力(MPa),安全系数,状态\n'

    this.results.forEach(r => {
      const valueStr = typeof r.variableValue === 'object'
        ? `${r.variableValue.x.toFixed(3)},${r.variableValue.y.toFixed(3)},${r.variableValue.z.toFixed(3)}`
        : r.variableValue.toFixed(2)

      csv += `${r.index + 1},${r.variableType},${valueStr},${(r.maxStress / 1e6).toFixed(4)},${r.safetyFactor.toFixed(4)},${r.status}\n`
    })

    return csv
  }

  visualizeBatchResults(scene) {
    const resultsGroup = new THREE.Group()
    resultsGroup.name = 'batchResultsGroup'

    const spacing = 0.3
    const cols = Math.ceil(Math.sqrt(this.results.length))

    this.results.forEach((r, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)

      const color = r.status === 'success' ? 0x4ecdc4 : (r.status === 'warning' ? 0xffe66d : 0xe94560)

      const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
      const material = new THREE.MeshPhongMaterial({ color: color })
      const cube = new THREE.Mesh(geometry, material)

      cube.position.set(
        (col - cols / 2) * spacing,
        0.1 + r.safetyFactor * 0.1,
        (row - cols / 2) * spacing
      )

      resultsGroup.add(cube)
    })

    resultsGroup.position.y = 2
    scene.add(resultsGroup)

    return resultsGroup
  }

  removeBatchVisualization(scene) {
    const group = scene.getObjectByName('batchResultsGroup')
    if (group) {
      scene.remove(group)
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
    }
  }
}
