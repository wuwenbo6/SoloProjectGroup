export class ProjectManager {
  constructor() {
    this.storageKey = 'mortise_tenon_project'
  }
  
  sanitizeValue(value) {
    if (typeof value === 'number') {
      if (!isFinite(value) || isNaN(value)) {
        return 0
      }
      return value
    }
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(v => this.sanitizeValue(v))
      }
      const result = {}
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          result[key] = this.sanitizeValue(value[key])
        }
      }
      return result
    }
    return value
  }
  
  sanitizeProjectData(data) {
    const sanitized = {}
    
    if (data.material) {
      sanitized.material = {
        elasticModulus: this.clamp(parseFloat(data.material.elasticModulus) || 12e9, 1e6, 1e12),
        poissonRatio: this.clamp(parseFloat(data.material.poissonRatio) || 0.35, 0.01, 0.5),
        density: this.clamp(parseFloat(data.material.density) || 700, 10, 10000)
      }
    } else {
      sanitized.material = {
        elasticModulus: 12e9,
        poissonRatio: 0.35,
        density: 700
      }
    }
    
    if (data.load) {
      sanitized.load = {
        magnitude: this.clamp(parseFloat(data.load.magnitude) || 1000, 0, 1e6),
        direction: {
          x: this.clamp(parseFloat(data.load.direction?.x) || 0, -1, 1),
          y: this.clamp(parseFloat(data.load.direction?.y) || -1, -1, 1),
          z: this.clamp(parseFloat(data.load.direction?.z) || 0, -1, 1)
        }
      }
      
      const dirLen = Math.sqrt(
        sanitized.load.direction.x ** 2 +
        sanitized.load.direction.y ** 2 +
        sanitized.load.direction.z ** 2
      )
      if (dirLen > 0.001) {
        sanitized.load.direction.x /= dirLen
        sanitized.load.direction.y /= dirLen
        sanitized.load.direction.z /= dirLen
      }
    } else {
      sanitized.load = {
        magnitude: 1000,
        direction: { x: 0, y: -1, z: 0 }
      }
    }
    
    if (data.analysisResults) {
      sanitized.analysisResults = this.sanitizeValue(data.analysisResults)
    }
    
    return sanitized
  }
  
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }
  
  safeStringify(obj, space = 2) {
    const seen = new WeakSet()
    
    const replacer = (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      
      if (typeof value === 'number') {
        if (!isFinite(value) || isNaN(value)) {
          return 0
        }
        return Math.round(value * 1e10) / 1e10
      }
      
      return value
    }
    
    try {
      return JSON.stringify(obj, replacer, space)
    } catch (e) {
      console.error('JSON stringify error:', e)
      return JSON.stringify({ error: 'Serialization failed' }, null, space)
    }
  }
  
  save(projectData) {
    try {
      const sanitizedData = this.sanitizeProjectData(projectData)
      
      const dataToSave = {
        ...sanitizedData,
        savedAt: new Date().toISOString(),
        version: '1.1.0'
      }
      
      const validation = this.validateProjectData(dataToSave)
      if (!validation.valid) {
        console.error('Project data validation failed:', validation.error)
        return false
      }
      
      const jsonString = this.safeStringify(dataToSave, 2)
      
      localStorage.setItem(this.storageKey, jsonString)
      
      this.downloadJSON(jsonString, 'project.json')
      
      return true
    } catch (error) {
      console.error('Error saving project:', error)
      return false
    }
  }
  
  load() {
    try {
      const jsonString = localStorage.getItem(this.storageKey)
      
      if (!jsonString) {
        return null
      }
      
      const projectData = JSON.parse(jsonString)
      
      return this.sanitizeProjectData(projectData)
    } catch (error) {
      console.error('Error loading project:', error)
      return null
    }
  }
  
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const projectData = JSON.parse(e.target.result)
          const sanitizedData = this.sanitizeProjectData(projectData)
          resolve(sanitizedData)
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }
      
      reader.readAsText(file)
    })
  }
  
  downloadJSON(jsonString, filename) {
    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 100)
    } catch (e) {
      console.error('Download error:', e)
    }
  }
  
  exportReport(projectData) {
    try {
      const sanitizedData = this.sanitizeProjectData(projectData)
      const report = this.generateReport(sanitizedData)
      
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = 'analysis_report.txt'
      document.body.appendChild(a)
      a.click()
      
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }, 100)
    } catch (e) {
      console.error('Export error:', e)
    }
  }
  
  generateReport(projectData) {
    const { material, load, analysisResults, savedAt } = projectData
    
    let report = '========================================\n'
    report += '     农具榫卯结构分析报告\n'
    report += '========================================\n\n'
    
    const date = savedAt ? new Date(savedAt) : new Date()
    report += `生成时间: ${date.toLocaleString()}\n\n`
    
    report += '----------------------------------------\n'
    report += '一、材料参数\n'
    report += '----------------------------------------\n'
    report += `弹性模量: ${(material.elasticModulus / 1e9).toFixed(2)} GPa\n`
    report += `泊松比: ${material.poissonRatio.toFixed(3)}\n`
    report += `密度: ${material.density.toFixed(1)} kg/m³\n\n`
    
    report += '----------------------------------------\n'
    report += '二、载荷参数\n'
    report += '----------------------------------------\n'
    report += `力大小: ${load.magnitude.toFixed(1)} N\n`
    report += `力方向: (${load.direction.x.toFixed(3)}, ${load.direction.y.toFixed(3)}, ${load.direction.z.toFixed(3)})\n\n`
    
    if (analysisResults) {
      report += '----------------------------------------\n'
      report += '三、应力分析结果\n'
      report += '----------------------------------------\n'
      report += `最大主应力: ${(analysisResults.maxStress / 1e6).toFixed(3)} MPa\n`
      report += `最小主应力: ${(analysisResults.minStress / 1e6).toFixed(3)} MPa\n`
      report += `等效应力 (von Mises): ${(analysisResults.vonMises / 1e6).toFixed(3)} MPa\n`
      report += `屈服强度: ${(analysisResults.yieldStrength / 1e6).toFixed(3)} MPa\n`
      report += `安全系数: ${analysisResults.safetyFactor.toFixed(3)}\n\n`
      
      report += '----------------------------------------\n'
      report += '四、截面参数\n'
      report += '----------------------------------------\n'
      report += `横截面积: ${(analysisResults.crossSectionArea * 1e4).toFixed(2)} cm²\n`
      report += `体积: ${(analysisResults.volume * 1e6).toFixed(2)} cm³\n`
      report += `剪切模量: ${(analysisResults.shearModulus / 1e9).toFixed(3)} GPa\n\n`
      
      report += '----------------------------------------\n'
      report += '五、评估结论\n'
      report += '----------------------------------------\n'
      
      if (analysisResults.safetyFactor >= 2.0) {
        report += '✓ 结构安全，安全系数充足\n'
      } else if (analysisResults.safetyFactor >= 1.5) {
        report += '⚠ 结构基本安全，建议适当优化\n'
      } else {
        report += '✗ 结构不安全，需要重新设计\n'
      }
      
      if (analysisResults.maxStress > analysisResults.yieldStrength) {
        report += '✗ 最大应力超过屈服强度，存在塑性变形风险\n'
      } else {
        report += '✓ 应力在屈服强度范围内\n'
      }
    }
    
    report += '\n========================================\n'
    report += '           报告结束\n'
    report += '========================================\n'
    
    return report
  }
  
  clearStorage() {
    try {
      localStorage.removeItem(this.storageKey)
    } catch (e) {
      console.error('Clear storage error:', e)
    }
  }
  
  getProjectList() {
    const projects = []
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.storageKey)) {
          try {
            const data = JSON.parse(localStorage.getItem(key))
            projects.push({
              key: key,
              savedAt: data.savedAt || new Date().toISOString(),
              name: data.name || '未命名项目'
            })
          } catch (e) {
          }
        }
      }
    } catch (e) {
      console.error('Get project list error:', e)
    }
    
    return projects.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
  }
  
  validateProjectData(data) {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: '数据格式错误' }
    }
    
    const requiredFields = ['material', 'load']
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        return {
          valid: false,
          error: `缺少必要字段: ${field}`
        }
      }
    }
    
    const materialFields = ['elasticModulus', 'poissonRatio', 'density']
    for (const field of materialFields) {
      if (!(field in data.material)) {
        return {
          valid: false,
          error: `材料参数缺少字段: ${field}`
        }
      }
      if (typeof data.material[field] !== 'number' || !isFinite(data.material[field])) {
        return {
          valid: false,
          error: `材料参数 ${field} 数值无效`
        }
      }
    }
    
    const loadFields = ['magnitude', 'direction']
    for (const field of loadFields) {
      if (!(field in data.load)) {
        return {
          valid: false,
          error: `载荷参数缺少字段: ${field}`
        }
      }
    }
    
    if (typeof data.load.magnitude !== 'number' || !isFinite(data.load.magnitude)) {
      return {
        valid: false,
        error: '载荷大小数值无效'
      }
    }
    
    const dirFields = ['x', 'y', 'z']
    for (const field of dirFields) {
      if (!(field in data.load.direction)) {
        return {
          valid: false,
          error: `载荷方向缺少字段: ${field}`
        }
      }
      if (typeof data.load.direction[field] !== 'number' || !isFinite(data.load.direction[field])) {
        return {
          valid: false,
          error: `载荷方向 ${field} 数值无效`
        }
      }
    }
    
    return {
      valid: true,
      error: null
    }
  }
}
