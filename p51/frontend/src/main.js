import { Scene3DManager } from './scenes/Scene3DManager'
import { equipmentApi, archiveApi, restorationApi } from './services/api'
import { HeritageDatabaseAPI, CollaborationAPI, ScoringAPI } from './services/newApi'
import { CollaborationManager } from './utils/CollaborationManager'
import { offlineCache } from './core/OfflineCacheManager'
import { eventBus, EVENTS } from './core/EventBus'

class HeritageApp {
    constructor() {
        this.scene3D = null
        this.currentEquipment = null
        this.equipmentList = []
        this.activeMode = 'rotate'
        this.currentArchives = []
        this.selectedArchive = null
        this.selectedDamage = null
        this.recommendedPlans = []
        
        this.heritageDbApi = new HeritageDatabaseAPI()
        this.collabApi = new CollaborationAPI()
        this.scoringApi = new ScoringAPI()
        this.collaborationManager = new CollaborationManager()
        
        this.currentScoreId = 1
        this.currentPlanId = 1
        this.currentReviewId = 1
        
        this.performanceMode = 'medium'
        this.offlineMode = !navigator.onLine
        
        this.init()
    }

    init() {
        this.init3DScene()
        this.bindEvents()
        this.setupGlobalListeners()
        this.loadMockData()
        this.loadDatabaseData()
        this.setupCollaborationListeners()
        this.updateViewMode('查看模式')
    }

    init3DScene() {
        const container = document.getElementById('canvasContainer')
        this.scene3D = new Scene3DManager(container, {
            performanceMode: this.performanceMode,
            enableChunkLoading: true,
            offlineEnabled: true
        })
    }

    setupGlobalListeners() {
        window.addEventListener('online', () => {
            this.offlineMode = false
            this.updateViewMode('网络已连接')
        })

        window.addEventListener('offline', () => {
            this.offlineMode = true
            this.updateViewMode('离线模式 - 使用缓存数据')
        })

        eventBus.on(EVENTS.MODEL_LOAD_PROGRESS, ({ progress, loaded, total }) => {
            console.log(`加载进度: ${progress}% (${loaded}/${total})`)
        })

        eventBus.on(EVENTS.PERFORMANCE_MODE_CHANGE, ({ mode }) => {
            this.performanceMode = mode
        })
    }

    bindEvents() {
        document.getElementById('equipmentSelect').addEventListener('change', (e) => {
            this.selectEquipment(e.target.value)
        })

        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filterByCategory(e.target.value)
        })

        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchEquipment(e.target.value)
        })

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab, e.target.closest('.sidebar-tabs').classList.contains('right-tabs') ? 'right' : 'left')
            })
        })

        document.getElementById('btnRotate').addEventListener('click', () => {
            this.setActiveMode('rotate')
            this.scene3D.setAutoRotate(true)
            this.updateViewMode('360°旋转模式')
        })

        document.getElementById('btnDisassemble').addEventListener('click', () => {
            this.setActiveMode('disassemble')
            if (this.scene3D.isDisassembled) {
                this.scene3D.assemble()
                this.updateViewMode('组装状态')
            } else {
                this.scene3D.disassemble()
                this.updateViewMode('部件拆解模式')
            }
        })

        document.getElementById('btnMarkDamage').addEventListener('click', () => {
            this.setActiveMode('damage')
            if (this.scene3D.damageMarks.some(m => m.visible)) {
                this.scene3D.hideDamageMarks()
                this.updateViewMode('查看模式')
            } else {
                this.scene3D.showDamageMarks()
                this.updateViewMode('破损标注模式')
            }
        })

        document.getElementById('btnRestore').addEventListener('click', () => {
            this.setActiveMode('restore')
            if (this.scene3D.isRestored) {
                this.scene3D.hideRestoration()
                this.updateViewMode('原始状态')
            } else {
                this.scene3D.showRestoration()
                this.updateViewMode('复原效果预览')
            }
        })

        document.getElementById('btnReset').addEventListener('click', () => {
            this.scene3D.resetView()
            this.setActiveMode('rotate')
            this.updateViewMode('查看模式')
        })

        document.getElementById('btnCompare').addEventListener('click', () => {
            const equipmentA = document.getElementById('compareA').value
            const equipmentB = document.getElementById('compareB').value
            if (equipmentA && equipmentB) {
                this.compareEquipment(equipmentA, equipmentB)
            } else {
                alert('请选择两台设备进行对比')
            }
        })

        document.getElementById('damageLevelFilter').addEventListener('change', (e) => {
            this.scene3D.showDamageMarksByLevel(e.target.value)
            this.updateDamageStats()
        })

        document.getElementById('btnRecord').addEventListener('click', () => {
            this.toggleRecording()
        })

        document.getElementById('btnPlay').addEventListener('click', () => {
            this.scene3D.playRecording()
        })

        document.getElementById('btnSaveRecord').addEventListener('click', () => {
            this.saveRecording()
        })

        document.getElementById('btnRecommend').addEventListener('click', () => {
            this.showRecommendations()
        })

        document.getElementById('closeRecommend').addEventListener('click', () => {
            document.getElementById('recommendationPanel').classList.add('hidden')
        })

        document.getElementById('performanceMode').addEventListener('change', (e) => {
            this.setPerformanceMode(e.target.value)
        })

        document.getElementById('btnSyncDatabase').addEventListener('click', () => {
            this.syncDatabase()
        })

        document.getElementById('btnCreateSession').addEventListener('click', () => {
            this.createCollaborationSession()
        })

        document.getElementById('btnJoinSession').addEventListener('click', () => {
            this.joinCollaborationSession()
        })

        document.getElementById('btnLeaveSession').addEventListener('click', () => {
            this.leaveCollaborationSession()
        })

        this.setupScoreSliders()

        document.getElementById('btnSubmitScore').addEventListener('click', () => {
            this.submitScore()
        })

        document.getElementById('btnSubmitReview').addEventListener('click', () => {
            this.submitReview()
        })

        document.getElementById('btnStartWorkflow').addEventListener('click', () => {
            this.startWorkflow()
        })
    }

    setupScoreSliders() {
        const sliders = [
            { id: 'scoreTechnical', valueId: 'scoreTechnicalValue' },
            { id: 'scoreHistorical', valueId: 'scoreHistoricalValue' },
            { id: 'scoreMaterial', valueId: 'scoreMaterialValue' },
            { id: 'scoreProcess', valueId: 'scoreProcessValue' },
            { id: 'scoreAesthetic', valueId: 'scoreAestheticValue' },
            { id: 'scoreDurability', valueId: 'scoreDurabilityValue' },
            { id: 'scoreCost', valueId: 'scoreCostValue' }
        ]

        sliders.forEach(({ id, valueId }) => {
            const slider = document.getElementById(id)
            const valueDisplay = document.getElementById(valueId)
            slider.addEventListener('input', () => {
                valueDisplay.textContent = slider.value
                this.updateTotalScore()
            })
        })

        this.updateTotalScore()
    }

    updateTotalScore() {
        const weights = {
            scoreTechnical: 0.20,
            scoreHistorical: 0.25,
            scoreMaterial: 0.15,
            scoreProcess: 0.15,
            scoreAesthetic: 0.10,
            scoreDurability: 0.10,
            scoreCost: 0.05
        }

        let total = 0
        Object.entries(weights).forEach(([id, weight]) => {
            const value = parseInt(document.getElementById(id).value) || 0
            total += value * weight
        })

        total = Math.round(total)
        document.getElementById('totalScore').textContent = total
        
        let grade = 'D'
        if (total >= 90) grade = 'S'
        else if (total >= 80) grade = 'A'
        else if (total >= 70) grade = 'B'
        else if (total >= 60) grade = 'C'
        
        const gradeBadge = document.getElementById('gradeBadge')
        gradeBadge.textContent = grade
        gradeBadge.className = `grade-badge grade-${grade.toLowerCase()}`
    }

    setActiveMode(mode) {
        this.activeMode = mode
        document.querySelectorAll('.toolbar-btn').forEach(btn => {
            btn.classList.remove('active')
        })
        const btnId = {
            'rotate': 'btnRotate',
            'disassemble': 'btnDisassemble',
            'damage': 'btnMarkDamage',
            'restore': 'btnRestore'
        }[mode]
        if (btnId) {
            document.getElementById(btnId).classList.add('active')
        }
    }

    updateViewMode(text) {
        document.getElementById('viewMode').textContent = `当前模式: ${text}`
    }

    async loadDatabaseData() {
        try {
            const stats = await this.heritageDbApi.getStatistics()
            if (stats.code === 200 && stats.data) {
                document.getElementById('totalEquipment').textContent = stats.data.total || 0
                document.getElementById('totalCategories').textContent = stats.data.categories || 0
            }

            const categories = await this.heritageDbApi.getCategories()
            if (categories.code === 200 && categories.data) {
                const categorySelect = document.getElementById('categoryFilter')
                categories.data.forEach(cat => {
                    const option = document.createElement('option')
                    option.value = cat
                    option.textContent = cat
                    categorySelect.appendChild(option)
                })
            }

            const list = await this.heritageDbApi.getEquipmentList()
            if (list.code === 200 && list.data) {
                this.renderDatabaseEquipmentList(list.data)
            }
        } catch (e) {
            console.error('Load database data failed:', e)
        }
    }

    renderDatabaseEquipmentList(equipmentList) {
        const container = document.getElementById('databaseEquipmentList')
        container.innerHTML = equipmentList.map(eq => `
            <div class="equipment-item" data-id="${eq.id}">
                <div class="equipment-name">${eq.name}</div>
                <div class="equipment-meta">${eq.equipmentType || eq.category} | ${eq.factory}</div>
            </div>
        `).join('')

        container.querySelectorAll('.equipment-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id
                document.getElementById('equipmentSelect').value = id
                this.selectEquipment(id)
            })
        })
    }

    async filterByCategory(category) {
        if (!category) {
            const list = await this.heritageDbApi.getEquipmentList()
            if (list.code === 200 && list.data) {
                this.renderDatabaseEquipmentList(list.data)
            }
            return
        }

        const list = await this.heritageDbApi.getEquipmentByCategory(category)
        if (list.code === 200 && list.data) {
            this.renderDatabaseEquipmentList(list.data)
        }
    }

    async searchEquipment(keyword) {
        if (!keyword.trim()) {
            const list = await this.heritageDbApi.getEquipmentList()
            if (list.code === 200 && list.data) {
                this.renderDatabaseEquipmentList(list.data)
            }
            return
        }

        const list = await this.heritageDbApi.searchEquipment(keyword)
        if (list.code === 200 && list.data) {
            this.renderDatabaseEquipmentList(list.data)
        }
    }

    async syncDatabase() {
        const btn = document.getElementById('btnSyncDatabase')
        btn.textContent = '同步中...'
        btn.disabled = true

        try {
            await this.heritageDbApi.syncData()
            alert('数据同步成功！')
            await this.loadDatabaseData()
        } catch (e) {
            alert('数据同步失败: ' + e.message)
        } finally {
            btn.textContent = '同步外部数据'
            btn.disabled = false
        }
    }

    async loadMockData() {
        try {
            this.equipmentList = this.getMockEquipmentList()
            this.populateEquipmentSelect()
        } catch (error) {
            console.error('Load mock data failed:', error)
        }
    }

    getMockEquipmentList() {
        return [
            {
                id: 1,
                name: '蒸汽机车-上游型',
                equipmentType: '动力设备',
                factory: '大连机车车辆厂',
                manufactureYear: 1972,
                location: '工业博物馆A区',
                description: '该型机车是中国国产第一代干线蒸汽机车'
            },
            {
                id: 2,
                name: '立式车床-C5112',
                equipmentType: '加工设备',
                factory: '齐齐哈尔第一机床厂',
                manufactureYear: 1965,
                location: '工业博物馆B区',
                description: '大型金属切削设备，用于粗加工和精加工'
            },
            {
                id: 3,
                name: '蒸汽发电机',
                equipmentType: '动力设备',
                factory: '哈尔滨电机厂',
                manufactureYear: 1958,
                location: '工业博物馆C区',
                description: '大跃进时期的主力发电设备'
            }
        ]
    }

    getMockParts(equipmentId) {
        const partsMap = {
            1: [
                { id: 'p1', name: '锅炉主体', material: '铸铁', partNo: 'B-001' },
                { id: 'p2', name: '气缸组件', material: '铸钢', partNo: 'C-002' },
                { id: 'p3', name: '传动轮组', material: '合金钢', partNo: 'W-003' },
                { id: 'p4', name: '驾驶室', material: '钢板', partNo: 'C-004' },
                { id: 'p5', name: '煤水车', material: '铸铁', partNo: 'T-005' }
            ],
            2: [
                { id: 'p1', name: '主轴箱', material: '铸铁', partNo: 'Z-001' },
                { id: 'p2', name: '工作台', material: '铸钢', partNo: 'G-002' },
                { id: 'p3', name: '进给机构', material: '合金钢', partNo: 'J-003' },
                { id: 'p4', name: '刀架系统', material: '硬质合金', partNo: 'D-004' }
            ],
            3: [
                { id: 'p1', name: '定子绕组', material: '铜', partNo: 'D-001' },
                { id: 'p2', name: '转子', material: '硅钢片', partNo: 'Z-002' },
                { id: 'p3', name: '励磁系统', material: '铜合金', partNo: 'L-003' },
                { id: 'p4', name: '冷却系统', material: '铸铁', partNo: 'L-004' }
            ]
        }
        return partsMap[equipmentId] || []
    }

    getMockDamageMarks(equipmentId) {
        const damageMap = {
            1: [
                { id: 'd1', position: '锅炉左侧', damageType: '锈蚀', severity: 'high', description: '大面积氧化锈蚀，需要除锈和防腐处理' },
                { id: 'd2', position: '气缸前端', damageType: '裂纹', severity: 'medium', description: '表面微裂纹，建议进行探伤检测' },
                { id: 'd3', position: '轮轴连接处', damageType: '磨损', severity: 'low', description: '正常使用磨损，定期润滑维护' }
            ],
            2: [
                { id: 'd1', position: '主轴密封处', damageType: '渗漏', severity: 'high', description: '润滑油渗漏，需要更换密封件' },
                { id: 'd2', position: '工作台导轨', damageType: '划痕', severity: 'medium', description: '表面划痕影响精度，需要研磨修复' }
            ],
            3: [
                { id: 'd1', position: '绕组端部', damageType: '老化', severity: 'high', description: '绝缘老化，需要重新绝缘处理' },
                { id: 'd2', position: '轴承座', damageType: '磨损', severity: 'medium', description: '轴承磨损，建议更换' }
            ]
        }
        return damageMap[equipmentId] || []
    }

    getMockArchives(equipmentId) {
        const archiveMap = {
            1: [
                { id: 'a1', title: '蒸汽机车设计图纸', type: '图纸', date: '1970-03-15', description: '包含总装配图和部件详细图纸' },
                { id: 'a2', title: '出厂检验报告', type: '文档', date: '1972-08-20', description: '大连机车车辆厂出厂质量检测报告' },
                { id: 'a3', title: '维修历史记录', type: '记录', date: '1985-06-10', description: '历次大修和维修记录档案' }
            ],
            2: [
                { id: 'a1', title: '车床安装手册', type: '手册', date: '1965-02-10', description: '设备安装调试指导手册' },
                { id: 'a2', title: '操作规范', type: '文档', date: '1965-05-01', description: '设备安全操作规范' }
            ],
            3: [
                { id: 'a1', title: '发电机说明书', type: '说明书', date: '1958-09-01', description: '设备技术说明书和维护手册' },
                { id: 'a2', title: '试运行记录', type: '记录', date: '1958-12-15', description: '设备安装调试和试运行记录' }
            ]
        }
        return archiveMap[equipmentId] || []
    }

    getMockRestorationProgress(equipmentId) {
        const progressMap = {
            1: [
                { stepName: '清洗除锈', status: 'completed' },
                { stepName: '裂纹检测', status: 'completed' },
                { stepName: '防腐处理', status: 'in-progress' },
                { stepName: '部件修复', status: 'pending' },
                { stepName: '重新涂装', status: 'pending' },
                { stepName: '动平衡测试', status: 'pending' }
            ]
        }
        return progressMap[equipmentId] || []
    }

    populateEquipmentSelect() {
        const select = document.getElementById('equipmentSelect')
        const compareA = document.getElementById('compareA')
        const compareB = document.getElementById('compareB')

        this.equipmentList.forEach(equipment => {
            const option = new Option(equipment.name, equipment.id)
            select.add(option)
            compareA.add(new Option(equipment.name, equipment.id))
            compareB.add(new Option(equipment.name, equipment.id))
        })
    }

    selectEquipment(equipmentId) {
        const equipment = this.equipmentList.find(e => e.id == equipmentId)
        if (!equipment) return

        this.currentEquipment = equipment
        
        const parts = this.getMockParts(equipmentId).map((part, i) => ({
            ...part,
            position: {
                x: (i - parts.length / 2) * 1.5,
                y: 0,
                z: Math.sin(i * 0.5) * 1
            },
            geometryType: ['box', 'cylinder', 'sphere'][i % 3],
            color: 0x4a90d9 + i * 0x10101
        }))
        
        this.scene3D.loadEquipment(equipment, parts)
        
        const damageMarks = this.getMockDamageMarks(equipmentId)
        const markData = damageMarks.map((m, i) => ({
            id: m.id,
            position: {
                x: (Math.random() - 0.5) * 3,
                y: 0.5 + Math.random(),
                z: (Math.random() - 0.5) * 3
            },
            severity: m.severity
        }))
        this.scene3D.showDamageMarks(markData)
        
        setTimeout(() => {
            this.updateDamageStats()
            this.updatePerformanceInfo()
        }, 500)
        
        this.renderEquipmentInfo(equipment)
        this.renderPartsList(this.getMockParts(equipmentId))
        this.renderDamageMarks(damageMarks)
        this.renderArchives(this.getMockArchives(equipmentId))
        this.renderRestorationProgress(this.getMockRestorationProgress(equipmentId))
        this.loadScoreHistory(equipmentId)
        this.loadReviewHistory(equipmentId)
        
        document.getElementById('modelInfo').textContent = `当前设备: ${equipment.name}`
    }

    renderEquipmentInfo(equipment) {
        const container = document.getElementById('equipmentInfo')
        container.innerHTML = `
            <div class="info-item">
                <label>设备名称</label>
                <span>${equipment.name}</span>
            </div>
            <div class="info-item">
                <label>设备类型</label>
                <span>${equipment.equipmentType}</span>
            </div>
            <div class="info-item">
                <label>制造厂家</label>
                <span>${equipment.factory}</span>
            </div>
            <div class="info-item">
                <label>制造年份</label>
                <span>${equipment.manufactureYear}年</span>
            </div>
            <div class="info-item">
                <label>存放位置</label>
                <span>${equipment.location}</span>
            </div>
            <div class="info-item full">
                <label>设备描述</label>
                <span>${equipment.description}</span>
            </div>
        `
    }

    renderPartsList(parts) {
        const container = document.getElementById('partsList')
        container.innerHTML = parts.map(part => `
            <div class="part-item" data-part-id="${part.id}">
                <div class="part-name">${part.name}</div>
                <div class="part-material">材质: ${part.material} | 编号: ${part.partNo}</div>
            </div>
        `).join('')

        container.querySelectorAll('.part-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.part-item').forEach(i => i.classList.remove('selected'))
                item.classList.add('selected')
                const partId = item.dataset.partId
                this.scene3D.selectPart(partId)
                
                if (this.collaborationManager.isConnected) {
                    this.collaborationManager.sendPartSelect(partId, 'click')
                }
            })
        })
    }

    renderDamageMarks(damageMarks) {
        const container = document.getElementById('damageList')
        container.innerHTML = damageMarks.map(damage => `
            <div class="damage-item" data-damage-id="${damage.id}">
                <div class="damage-type">${damage.position} - ${damage.damageType}</div>
                <span class="damage-severity severity-${damage.severity}">${this.getSeverityText(damage.severity)}</span>
                <div style="font-size: 11px; color: #888; margin-top: 4px;">${damage.description}</div>
            </div>
        `).join('')

        container.querySelectorAll('.damage-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.damage-item').forEach(i => i.classList.remove('selected'))
                item.classList.add('selected')
                const damageId = item.dataset.damageId
                this.selectedDamage = damageId
                this.highlightDamageIn3D(damageId)
                this.highlightRelatedArchives(damageId)
                
                if (this.collaborationManager.isConnected) {
                    this.collaborationManager.sendDamageMark(damageId, 'click')
                }
            })
        })
    }

    getSeverityText(severity) {
        const map = { 'high': '严重', 'medium': '中等', 'low': '轻微' }
        return map[severity] || severity
    }

    highlightDamageIn3D(damageId) {
        if (!this.scene3D || !this.scene3D.damageMarks) {
            this.scene3D.showDamageMarks()
            setTimeout(() => {
                const mark = this.scene3D.damageMarks.find(m => m.userData && m.userData.markId === damageId)
                if (mark) {
                    const originalScale = mark.scale.x
                    let phase = 0
                    const animate = () => {
                        phase += 0.1
                        mark.scale.setScalar(originalScale + Math.sin(phase) * 0.5 + 0.5)
                        if (phase < Math.PI * 4) {
                            requestAnimationFrame(animate)
                        } else {
                            mark.scale.setScalar(originalScale)
                        }
                    }
                    animate()
                }
            }, 100)
        }
    }

    highlightRelatedArchives(damageId) {
        const archiveItems = document.querySelectorAll('#archiveList .archive-item')
        archiveItems.forEach((item, index) => {
            if (index === 0) {
                item.classList.add('highlight')
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        })
    }

    renderArchives(archives) {
        this.currentArchives = archives
        const container = document.getElementById('archiveList')
        container.innerHTML = archives.map(archive => `
            <div class="archive-item" data-archive-id="${archive.id}">
                <div class="archive-title">${archive.title}</div>
                <div class="archive-type">${archive.type}</div>
                <div class="archive-date">${archive.date}</div>
            </div>
        `).join('')

        container.querySelectorAll('.archive-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.archive-item').forEach(i => {
                    i.classList.remove('selected', 'highlight')
                })
                item.classList.add('selected')
                const archiveId = item.dataset.archiveId
                this.showArchiveDetail(archiveId)
                this.highlightRelatedDamage(archiveId)
            })
        })
    }

    highlightRelatedDamage(archiveId) {
        const damageItems = document.querySelectorAll('#damageList .damage-item')
        damageItems.forEach((item, index) => {
            if (index === 0) {
                item.classList.add('highlight')
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
        })
        this.scene3D.showDamageMarks()
        setTimeout(() => {
            const mark = this.scene3D.damageMarks[0]
            if (mark) {
                let phase = 0
                const animate = () => {
                    phase += 0.1
                    mark.scale.setScalar(1 + Math.sin(phase) * 0.5 + 0.5)
                    if (phase < Math.PI * 4) {
                        requestAnimationFrame(animate)
                    } else {
                        mark.scale.setScalar(1)
                    }
                }
                animate()
            }
        }, 100)
    }

    showArchiveDetail(archiveId) {
        const archive = this.currentArchives.find(a => a.id === archiveId)
        if (archive) {
            this.updateViewMode(`查看档案: ${archive.title}`)
        }
    }

    renderRestorationProgress(progress) {
        const container = document.getElementById('restorationProgress')
        container.innerHTML = progress.map(step => `
            <div class="progress-step ${step.status}">
                <div class="step-name">${step.stepName}</div>
                <div class="step-status">${this.getProgressStatusText(step.status)}</div>
            </div>
        `).join('')
    }

    getProgressStatusText(status) {
        const map = { 'completed': '已完成', 'in-progress': '进行中', 'pending': '待开始' }
        return map[status] || status
    }

    compareEquipment(equipmentAId, equipmentBId) {
        const equipmentA = this.equipmentList.find(e => e.id == equipmentAId)
        const equipmentB = this.equipmentList.find(e => e.id == equipmentBId)
        
        if (!equipmentA || !equipmentB) return

        alert(`
设备对比分析:
-----------------------------------
设备A: ${equipmentA.name}
  - 类型: ${equipmentA.equipmentType}
  - 年份: ${equipmentA.manufactureYear}年
  - 厂家: ${equipmentA.factory}

设备B: ${equipmentB.name}
  - 类型: ${equipmentB.equipmentType}
  - 年份: ${equipmentB.manufactureYear}年
  - 厂家: ${equipmentB.factory}

年代差异: ${Math.abs(equipmentA.manufactureYear - equipmentB.manufactureYear)}年
        `)
    }

    updateDamageStats() {
        const stats = this.scene3D.getDamageStatistics()
        const statsText = `破损总数: ${stats.total} | 平均破损分值: ${stats.averageScore}`
        document.getElementById('damageStats').textContent = statsText
        
        const byLevelText = Object.entries(stats.byLevel)
            .map(([level, count]) => `${this.getDamageLevelText(level)}: ${count}`)
            .join(' | ')
        if (byLevelText) {
            document.getElementById('damageStats').textContent += ` | ${byLevelText}`
        }
    }

    getDamageLevelText(level) {
        const levelMap = {
            'critical': '严重破损',
            'severe': '重度破损',
            'moderate': '中度破损',
            'minor': '轻度破损',
            'cosmetic': '外观瑕疵'
        }
        return levelMap[level] || level
    }

    toggleRecording() {
        const btn = document.getElementById('btnRecord')
        const indicator = document.getElementById('recordingIndicator')
        
        if (this.scene3D.isRecording) {
            this.scene3D.stopRecording()
            btn.textContent = '开始录制'
            btn.classList.remove('recording')
            indicator.classList.add('hidden')
            this.updateViewMode('录制完成')
        } else {
            this.scene3D.startRecording()
            btn.textContent = '停止录制'
            btn.classList.add('recording')
            indicator.classList.remove('hidden')
            this.updateViewMode('正在录制复原流程...')
        }
    }

    saveRecording() {
        const data = this.scene3D.saveRecording()
        localStorage.setItem('lastRecording', data)
        localStorage.setItem('lastRecordingTime', new Date().toLocaleString())
        alert('录制已保存到本地存储！')
    }

    showRecommendations() {
        if (!this.currentEquipment) {
            alert('请先选择设备')
            return
        }
        
        const recommendations = this.generateRecommendations()
        this.renderRecommendations(recommendations)
        document.getElementById('recommendationPanel').classList.remove('hidden')
    }

    generateRecommendations() {
        const damageStats = this.scene3D.getDamageStatistics()
        const equipment = this.currentEquipment
        
        const recommendations = [
            {
                id: 1,
                title: '紧急修复方案',
                description: '针对严重破损部位的优先修复，防止进一步损坏',
                priority: 'high',
                score: 95,
                cost: '高',
                duration: '7天',
                focusAreas: ['严重破损', '重度破损']
            },
            {
                id: 2,
                title: '全面复原方案',
                description: '对所有破损部位进行系统性修复，包括外观瑕疵',
                priority: 'medium',
                score: 88,
                cost: '中',
                duration: '14天',
                focusAreas: ['全部破损']
            },
            {
                id: 3,
                title: '渐进式修复方案',
                description: '按优先级分阶段修复，先核心后外观',
                priority: 'low',
                score: 82,
                cost: '低',
                duration: '30天',
                focusAreas: ['核心结构', '外观美化']
            },
            {
                id: 4,
                title: '保护优先方案',
                description: '重点进行防锈防腐处理，延长设备寿命',
                priority: 'medium',
                score: 79,
                cost: '中',
                duration: '5天',
                focusAreas: ['防锈处理', '防腐涂层']
            }
        ]
        
        return recommendations.sort((a, b) => b.score - a.score)
    }

    renderRecommendations(recommendations) {
        const container = document.getElementById('recommendationContent')
        container.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item" data-plan-id="${rec.id}">
                <div class="recommendation-title">
                    <span class="recommendation-priority priority-${rec.priority}">${this.getPriorityText(rec.priority)}</span>
                    ${rec.title}
                </div>
                <div class="recommendation-desc">${rec.description}</div>
                <div class="recommendation-meta">
                    <span class="recommendation-score">匹配度: ${rec.score}%</span>
                    <span class="recommendation-cost">成本: ${rec.cost} | 周期: ${rec.duration}</span>
                </div>
            </div>
        `).join('')
        
        container.querySelectorAll('.recommendation-item').forEach(item => {
            item.addEventListener('click', () => {
                container.querySelectorAll('.recommendation-item').forEach(i => i.classList.remove('selected'))
                item.classList.add('selected')
                const planId = parseInt(item.dataset.planId)
                this.applyRecommendation(planId)
            })
        })
    }

    getPriorityText(priority) {
        const map = { 'high': '高', 'medium': '中', 'low': '低' }
        return map[priority] || priority
    }

    applyRecommendation(planId) {
        const plan = this.recommendedPlans.find(p => p.id === planId) || 
                     this.generateRecommendations().find(p => p.id === planId)
        
        if (plan) {
            this.updateViewMode(`已选择: ${plan.title}`)
            alert(`已选择复原方案: ${plan.title}\n预计周期: ${plan.duration}\n匹配度: ${plan.score}%`)
        }
    }

    setPerformanceMode(mode) {
        if (mode === 'auto') {
            const detectedMode = this.scene3D.detectPerformanceMode()
            this.scene3D.performanceMode = detectedMode
            this.updateViewMode(`自动检测性能模式: ${detectedMode}`)
        } else {
            this.scene3D.performanceMode = mode
            this.updateViewMode(`已切换到${this.getPerformanceModeText(mode)}模式`)
        }
        
        this.scene3D.applyPerformanceSettings()
        this.updatePerformanceInfo()
    }

    getPerformanceModeText(mode) {
        const map = { 'low': '低性能', 'medium': '中等', 'high': '高性能' }
        return map[mode] || mode
    }

    updatePerformanceInfo() {
        const mode = this.scene3D.performanceMode
        document.getElementById('performanceInfo').textContent = 
            `性能模式: ${this.getPerformanceModeText(mode)} | FPS: ~60`
    }

    switchTab(tabName, side = 'left') {
        const tabsContainer = side === 'right' ? 
            document.querySelector('.right-tabs') : 
            document.querySelector('.sidebar-tabs:not(.right-tabs)')
        
        tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active')
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active')
            }
        })
        
        const tabContentSelector = side === 'right' ? '.right-panel .tab-content' : '.sidebar > .tab-content'
        document.querySelectorAll(tabContentSelector).forEach(content => {
            content.classList.remove('active')
        })
        document.getElementById(`tab-${tabName}`).classList.add('active')
    }

    setupCollaborationListeners() {
        this.collaborationManager.on('connected', (data) => {
            document.getElementById('collabStatus').textContent = '已连接'
            document.getElementById('collabStatus').className = 'status-online'
            this.updateViewMode(`已加入协同会话: ${data.sessionId}`)
        })

        this.collaborationManager.on('disconnected', () => {
            document.getElementById('collabStatus').textContent = '离线'
            document.getElementById('collabStatus').className = 'status-offline'
            this.updateViewMode('已离开协同会话')
        })

        this.collaborationManager.on('userJoin', (data) => {
            this.addCollabLog(`${data.userName} 加入了会话`)
            this.updateCollabUserList()
        })

        this.collaborationManager.on('userLeave', (data) => {
            this.addCollabLog(`${data.userName} 离开了会话`)
            this.updateCollabUserList()
        })

        this.collaborationManager.on('userListUpdated', (users) => {
            this.renderCollabUserList(users)
        })

        this.collaborationManager.on('viewChange', (data) => {
            this.addCollabLog(`${data.userName} 调整了视角`)
        })

        this.collaborationManager.on('damageMark', (data) => {
            this.addCollabLog(`${data.userName} 点击了破损点: ${data.damageId}`)
        })

        this.collaborationManager.on('partSelect', (data) => {
            this.addCollabLog(`${data.userName} 选中了部件: ${data.target}`)
        })
    }

    async createCollaborationSession() {
        const userName = document.getElementById('collabUserName').value.trim()
        if (!userName) {
            alert('请输入您的昵称')
            return
        }

        if (!this.currentEquipment) {
            alert('请先选择设备')
            return
        }

        try {
            const result = await this.collabApi.createSession(this.currentEquipment.id, userName)
            if (result.sessionId) {
                document.getElementById('collabSessionId').value = result.sessionId
                await this.collaborationManager.connect(result.sessionId, 'user_' + Date.now(), userName, this.currentEquipment.id)
            }
        } catch (e) {
            alert('创建会话失败: ' + e.message)
        }
    }

    async joinCollaborationSession() {
        const sessionId = document.getElementById('collabSessionId').value.trim()
        const userName = document.getElementById('collabUserName').value.trim()
        
        if (!sessionId || !userName) {
            alert('请输入会话ID和昵称')
            return
        }

        if (!this.currentEquipment) {
            alert('请先选择设备')
            return
        }

        try {
            await this.collaborationManager.connect(sessionId, 'user_' + Date.now(), userName, this.currentEquipment.id)
        } catch (e) {
            alert('加入会话失败: ' + e.message)
        }
    }

    leaveCollaborationSession() {
        this.collaborationManager.disconnect()
    }

    updateCollabUserList() {
        const users = this.collaborationManager.getOnlineUsers()
        this.renderCollabUserList(users)
    }

    renderCollabUserList(users) {
        const container = document.getElementById('collabUserList')
        if (!users || users.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无在线用户</p>'
            return
        }

        container.innerHTML = users.map(user => `
            <div class="user-item">
                <span class="user-avatar">${user[1].charAt(0).toUpperCase()}</span>
                <span class="user-name">${user[1]}</span>
            </div>
        `).join('')
    }

    addCollabLog(message) {
        const container = document.getElementById('collabLog')
        const time = new Date().toLocaleTimeString()
        const logItem = document.createElement('div')
        logItem.className = 'log-item'
        logItem.innerHTML = `<span class="log-time">[${time}]</span> ${message}`
        container.insertBefore(logItem, container.firstChild)
        
        while (container.children.length > 20) {
            container.removeChild(container.lastChild)
        }
    }

    async submitScore() {
        const evaluatorName = document.getElementById('evaluatorName').value.trim()
        const comment = document.getElementById('evaluationComment').value.trim()

        if (!evaluatorName) {
            alert('请输入评分人姓名')
            return
        }

        const scoreData = {
            id: this.currentScoreId++,
            equipmentId: this.currentEquipment?.id || 1,
            planId: this.currentPlanId,
            planName: '复原方案-' + this.currentPlanId,
            technicalAccuracy: parseInt(document.getElementById('scoreTechnical').value),
            historicalAuthenticity: parseInt(document.getElementById('scoreHistorical').value),
            materialCompatibility: parseInt(document.getElementById('scoreMaterial').value),
            processReliability: parseInt(document.getElementById('scoreProcess').value),
            aestheticEffect: parseInt(document.getElementById('scoreAesthetic').value),
            durability: parseInt(document.getElementById('scoreDurability').value),
            costEffectiveness: parseInt(document.getElementById('scoreCost').value),
            evaluatorName,
            evaluationComment: comment,
            evaluationMethod: '人工评估'
        }

        try {
            const result = await this.scoringApi.evaluate(scoreData)
            if (result.code === 200) {
                alert('评分提交成功！')
                this.loadScoreHistory(scoreData.equipmentId)
            } else {
                alert('评分提交失败: ' + result.message)
            }
        } catch (e) {
            alert('评分提交失败: ' + e.message)
        }
    }

    async loadScoreHistory(equipmentId) {
        try {
            const result = await this.scoringApi.getScoresByEquipment(equipmentId)
            if (result.code === 200 && result.data && result.data.length > 0) {
                this.renderScoreHistory(result.data)
            }
        } catch (e) {
            console.error('Load score history failed:', e)
        }
    }

    renderScoreHistory(scores) {
        const container = document.getElementById('scoreHistory')
        if (!scores || scores.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无评分记录</p>'
            return
        }

        container.innerHTML = scores.slice(0, 5).map(score => `
            <div class="score-record">
                <div class="score-header">
                    <span class="score-evaluator">${score.evaluatorName || '匿名'}</span>
                    <span class="score-grade grade-${score.grade?.toLowerCase() || 'd'}">${score.grade || '-'}</span>
                </div>
                <div class="score-detail">
                    综合评分: ${score.totalScore?.toFixed(1) || Math.round(score.totalScore) || 0}分
                </div>
                <div class="score-comment">${score.evaluationComment || '无评语'}</div>
            </div>
        `).join('')
    }

    async submitReview() {
        const expertName = document.getElementById('expertName').value.trim()
        const expertTitle = document.getElementById('expertTitle').value.trim()
        const comment = document.getElementById('reviewComment').value.trim()
        const suggestions = document.getElementById('reviewSuggestions').value.trim()

        if (!expertName || !expertTitle) {
            alert('请填写专家姓名和职称')
            return
        }

        const reviewData = {
            id: this.currentReviewId++,
            planId: this.currentPlanId,
            planName: '复原方案-' + this.currentPlanId,
            equipmentId: this.currentEquipment?.id || 1,
            expertId: 'expert_' + Date.now(),
            expertName,
            expertTitle,
            reviewType: '正式审核',
            technicalAccuracy: parseInt(document.getElementById('reviewTechnical').value) * 10,
            historicalAuthenticity: parseInt(document.getElementById('reviewHistorical').value) * 10,
            materialCompatibility: parseInt(document.getElementById('reviewMaterial').value) * 10,
            processReliability: parseInt(document.getElementById('reviewProcess').value) * 10,
            safetyStandard: parseInt(document.getElementById('reviewSafety').value) * 10,
            documentation: parseInt(document.getElementById('reviewDocumentation').value) * 10,
            reviewComment: comment,
            suggestions
        }

        try {
            const result = await this.scoringApi.submitReview(reviewData)
            if (result.code === 200) {
                alert('审核提交成功！')
                this.loadReviewHistory(this.currentPlanId)
                this.loadWorkflowStatus(this.currentPlanId)
            } else {
                alert('审核提交失败: ' + result.message)
            }
        } catch (e) {
            alert('审核提交失败: ' + e.message)
        }
    }

    async loadReviewHistory(planId) {
        try {
            const result = await this.scoringApi.getReviewsByPlan(planId)
            if (result.code === 200 && result.data && result.data.length > 0) {
                this.renderReviewHistory(result.data)
            }
        } catch (e) {
            console.error('Load review history failed:', e)
        }
    }

    renderReviewHistory(reviews) {
        const container = document.getElementById('reviewHistory')
        if (!reviews || reviews.length === 0) {
            container.innerHTML = '<p class="empty-tip">暂无审核记录</p>'
            return
        }

        container.innerHTML = reviews.slice(0, 3).map(review => `
            <div class="review-record">
                <div class="review-header">
                    <span class="review-expert">${review.expertName || '专家'}</span>
                    <span class="review-result result-${review.reviewResult || 'pending'}">${this.getReviewResultText(review.reviewResult)}</span>
                </div>
                <div class="review-score">
                    综合评分: ${review.overallScore || '未评分'}分
                </div>
                <div class="review-comment">${review.reviewComment || '无审核意见'}</div>
            </div>
        `).join('')
    }

    getReviewResultText(result) {
        const map = {
            'PASS': '通过',
            'CONDITIONAL_PASS': '有条件通过',
            'NEEDS_REVISION': '需修改',
            'REJECT': '驳回',
            'pending': '待审核'
        }
        return map[result] || result
    }

    async startWorkflow() {
        if (!this.currentEquipment) {
            alert('请先选择设备')
            return
        }

        try {
            const result = await this.scoringApi.startWorkflow(this.currentPlanId, 'admin')
            if (result.code === 200) {
                alert('审核流程已启动！')
                this.loadWorkflowStatus(this.currentPlanId)
            } else {
                alert('启动流程失败: ' + result.message)
            }
        } catch (e) {
            alert('启动流程失败: ' + e.message)
        }
    }

    async loadWorkflowStatus(planId) {
        try {
            const result = await this.scoringApi.getWorkflow(planId)
            if (result.code === 200 && result.data) {
                this.renderWorkflowStatus(result.data)
            }
        } catch (e) {
            console.error('Load workflow status failed:', e)
        }
    }

    renderWorkflowStatus(workflow) {
        const container = document.getElementById('workflowStatus')
        if (!workflow) {
            container.innerHTML = '<p class="empty-tip">暂无审核流程</p>'
            return
        }

        container.innerHTML = `
            <div class="workflow-item">
                <div class="workflow-info">
                    <span class="workflow-label">当前阶段:</span>
                    <span class="workflow-value">${workflow.currentStage || '提交审核'}</span>
                </div>
                <div class="workflow-info">
                    <span class="workflow-label">审核级别:</span>
                    <span class="workflow-value">第${workflow.currentLevel || 1}级</span>
                </div>
                <div class="workflow-info">
                    <span class="workflow-label">流程状态:</span>
                    <span class="workflow-value workflow-status-${workflow.status || 'in-progress'}">${this.getWorkflowStatusText(workflow.status)}</span>
                </div>
                <div class="workflow-info">
                    <span class="workflow-label">提交时间:</span>
                    <span class="workflow-value">${workflow.submitTime ? new Date(workflow.submitTime).toLocaleString() : '-'}</span>
                </div>
            </div>
        `
    }

    getWorkflowStatusText(status) {
        const map = {
            'IN_PROGRESS': '进行中',
            'COMPLETED': '已完成',
            'REJECTED': '已驳回',
            'in-progress': '进行中',
            'completed': '已完成',
            'rejected': '已驳回'
        }
        return map[status] || status
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.heritageApp = new HeritageApp()
})