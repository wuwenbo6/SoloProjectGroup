import * as THREE from 'three'

export class WearPrediction {
  constructor() {
    this.predictions = null
    this.wearData = []
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  predict(model, load, materialParams, wearParams) {
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const contactArea = Math.max(size.x * size.z, 0.01)

    const pressure = load.magnitude / contactArea
    const slidingDistance = this.estimateSlidingDistance(load, wearParams)

    this.wearData = []

    for (let day = 1; day <= wearParams.days; day++) {
      const wearDepth = this.calculateArchardWear(
        pressure,
        slidingDistance * day,
        wearParams.frictionCoeff,
        wearParams.hardness
      )

      const wearVolume = wearDepth * contactArea
      const massLoss = wearVolume * materialParams.density
      const remainingLife = this.estimateRemainingLife(wearDepth, size.y)

      this.wearData.push({
        day: day,
        wearDepth: wearDepth,
        wearVolume: wearVolume,
        massLoss: massLoss,
        remainingLife: remainingLife,
        wearRate: wearDepth / day
      })
    }

    const finalPrediction = this.wearData[this.wearData.length - 1]

    this.predictions = {
      final: finalPrediction,
      dailyData: this.wearData,
      contactArea: contactArea,
      pressure: pressure,
      criticalWearDepth: size.y * 0.1,
      wearTrend: this.calculateWearTrend(),
      recommendation: this.generateRecommendation(finalPrediction, size.y)
    }

    return this.predictions
  }

  calculateArchardWear(pressure, slidingDistance, frictionCoeff, hardness) {
    const wearCoeff = frictionCoeff * 1e-8
    const wearDepth = wearCoeff * pressure * slidingDistance / hardness
    return this.clamp(wearDepth, 0, 1)
  }

  estimateSlidingDistance(load, wearParams) {
    const dailyCycles = wearParams.hoursPerDay * 3600
    const cycleDistance = 0.01
    return dailyCycles * cycleDistance
  }

  estimateRemainingLife(currentWear, maxDimension) {
    const maxAllowableWear = maxDimension * 0.1
    const wearRate = currentWear / this.wearData.length
    const remainingDays = (maxAllowableWear - currentWear) / wearRate
    return this.clamp(remainingDays, 0, 10000)
  }

  calculateWearTrend() {
    if (this.wearData.length < 2) return 0

    const first = this.wearData[0].wearRate
    const last = this.wearData[this.wearData.length - 1].wearRate
    return (last - first) / first
  }

  generateRecommendation(prediction, sizeY) {
    const wearPercent = (prediction.wearDepth / sizeY) * 100

    if (wearPercent < 1) {
      return {
        level: 'low',
        message: '磨损程度低，使用寿命充足',
        maintenanceInterval: Math.round(prediction.remainingLife * 0.7) + '天'
      }
    } else if (wearPercent < 5) {
      return {
        level: 'medium',
        message: '磨损程度中等，建议定期检查',
        maintenanceInterval: Math.round(prediction.remainingLife * 0.5) + '天'
      }
    } else {
      return {
        level: 'high',
        message: '磨损程度较高，建议加强维护或更换材料',
        maintenanceInterval: Math.round(prediction.remainingLife * 0.3) + '天'
      }
    }
  }

  generateWearChart() {
    if (!this.predictions) return ''

    let html = '<div class="wear-chart">'

    const maxWear = Math.max(...this.wearData.map(d => d.wearDepth))
    const step = Math.max(1, Math.floor(this.wearData.length / 20))

    for (let i = 0; i < this.wearData.length; i += step) {
      const wearPercent = (this.wearData[i].wearDepth / maxWear) * 100
      html += `<div class="wear-bar" style="height: ${Math.max(wearPercent, 2)}%"></div>`
    }

    html += '</div>'

    return html
  }

  generateSummaryHTML() {
    if (!this.predictions) return ''

    const p = this.predictions

    let html = '<div class="wear-summary">'

    html += `
      <div class="wear-item">
        <div class="label">累计磨损深度</div>
        <div class="value">${(p.final.wearDepth * 1000).toFixed(2)} μm</div>
      </div>
      <div class="wear-item">
        <div class="label">体积磨损量</div>
        <div class="value">${(p.final.wearVolume * 1e6).toFixed(2)} mm³</div>
      </div>
      <div class="wear-item">
        <div class="label">质量损失</div>
        <div class="value">${(p.final.massLoss * 1000).toFixed(3)} g</div>
      </div>
      <div class="wear-item">
        <div class="label">预估剩余寿命</div>
        <div class="value">${Math.round(p.final.remainingLife)} 天</div>
      </div>
    `

    html += '</div>'

    const levelColors = {
      low: '#4ecdc4',
      medium: '#ffe66d',
      high: '#e94560'
    }

    html += `
      <div style="margin-top: 10px; padding: 8px; background: #1a1a2e; border-radius: 4px;">
        <p style="font-size: 11px; color: ${levelColors[p.recommendation.level]}; margin-bottom: 4px;">
          ⚠ ${p.recommendation.message}
        </p>
        <p style="font-size: 10px; color: #a0a0a0;">
          建议维护周期: ${p.recommendation.maintenanceInterval}
        </p>
      </div>
    `

    return html
  }

  visualizeWear(model, scene) {
    if (!this.predictions) return

    const wearGroup = new THREE.Group()
    wearGroup.name = 'wearGroup'

    const wearPercent = this.predictions.final.wearDepth / this.predictions.criticalWearDepth
    const wearColor = wearPercent > 0.5 ? 0xe94560 : (wearPercent > 0.2 ? 0xffe66d : 0x4ecdc4)

    model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const positions = child.geometry.attributes.position
        const colors = []

        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i)
          const colorFactor = this.clamp(1 - y / 2 + wearPercent * 0.5, 0, 1)

          const color = new THREE.Color()
          color.setHSL(0.02, colorFactor, 0.4 + colorFactor * 0.2)

          colors.push(color.r, color.g, color.b)
        }

        child.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
        if (child.material) {
          child.material.vertexColors = true
          child.material.needsUpdate = true
        }
      }
    })

    const wearIndicator = this.createWearIndicator(wearPercent)
    wearGroup.add(wearIndicator)

    scene.add(wearGroup)
    return wearGroup
  }

  createWearIndicator(wearPercent) {
    const group = new THREE.Group()

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64

    ctx.fillStyle = 'rgba(26, 26, 46, 0.9)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = wearPercent > 0.5 ? '#e94560' : '#4ecdc4'
    ctx.font = 'bold 20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`磨损率: ${(wearPercent * 100).toFixed(1)}%`, canvas.width / 2, canvas.height / 2)

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(material)
    sprite.position.set(0, 2, 0)
    sprite.scale.set(2, 0.5, 1)

    group.add(sprite)
    return group
  }

  removeWearVisualization(scene) {
    const wearGroup = scene.getObjectByName('wearGroup')
    if (wearGroup) {
      scene.remove(wearGroup)
      wearGroup.traverse((child) => {
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

  generateReport() {
    if (!this.predictions) return ''

    const p = this.predictions

    let report = '磨损趋势预测分析报告\n'
    report += '='.repeat(40) + '\n\n'

    report += '【模拟参数】\n'
    report += `  使用周期: ${p.dailyData.length} 天\n`
    report += `  接触面积: ${(p.contactArea * 1e4).toFixed(2)} cm²\n`
    report += `  接触压力: ${(p.pressure / 1e6).toFixed(2)} MPa\n\n`

    report += '【预测结果】\n'
    report += `  累计磨损深度: ${(p.final.wearDepth * 1000).toFixed(2)} μm\n`
    report += `  体积磨损量: ${(p.final.wearVolume * 1e6).toFixed(2)} mm³\n`
    report += `  质量损失: ${(p.final.massLoss * 1000).toFixed(3)} g\n`
    report += `  平均磨损率: ${(p.final.wearRate * 1e6).toFixed(2)} μm/天\n`
    report += `  预估剩余寿命: ${Math.round(p.final.remainingLife)} 天\n\n`

    report += '【趋势分析】\n'
    if (p.wearTrend > 0.1) {
      report += '  磨损呈加速趋势，建议加强检查频率\n'
    } else if (p.wearTrend > -0.1) {
      report += '  磨损趋势稳定，按常规周期维护即可\n'
    } else {
      report += '  磨损呈减缓趋势，表明磨合已完成\n'
    }

    report += '\n【维护建议】\n'
    report += `  ${p.recommendation.message}\n`
    report += `  建议维护周期: ${p.recommendation.maintenanceInterval}\n`

    return report
  }

  exportCSV() {
    if (!this.predictions) return ''

    let csv = '天数,磨损深度(μm),体积磨损(mm³),质量损失(g),磨损率(μm/天)\n'

    this.wearData.forEach(d => {
      csv += `${d.day},${(d.wearDepth * 1000).toFixed(4)},${(d.wearVolume * 1e6).toFixed(4)},${(d.massLoss * 1000).toFixed(4)},${(d.wearRate * 1e6).toFixed(4)}\n`
    })

    return csv
  }
}
