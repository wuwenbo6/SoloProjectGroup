class FileManager {
    constructor() {
        this.storageKey = 'woodProcessingProjects';
        this.backupKey = 'woodProcessingProjects_backup';
        this.maxProjects = 50;
        this.projects = this.loadProjects();
    }

    sanitizeProject(project) {
        if (!project || typeof project !== 'object') {
            return null;
        }

        const sanitized = {
            id: String(project.id || Date.now()),
            name: String(project.name || '未命名项目').substring(0, 100),
            createdAt: project.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (project.woodData && Array.isArray(project.woodData.depthMap)) {
            sanitized.woodData = {
                type: String(project.woodData.type || 'oak'),
                ringDensity: Number(project.woodData.ringDensity) || 15,
                roughness: Number(project.woodData.roughness) || 50,
                seed: Number(project.woodData.seed) || Date.now()
            };
        }

        if (project.toolpathData) {
            sanitized.toolpathData = {
                toolpath: Array.isArray(project.toolpathData.toolpath) ? 
                    project.toolpathData.toolpath.slice(0, 10000) : [],
                currentPathIndex: Math.min(Number(project.toolpathData.currentPathIndex) || 0, 10000)
            };
        }

        if (project.stressData && project.stressData.result) {
            sanitized.stressData = {
                result: {
                    maxStress: Number(project.stressData.result.maxStress) || 0,
                    minStress: Number(project.stressData.result.minStress) || 0,
                    avgStress: Number(project.stressData.result.avgStress) || 0,
                    criticalAreas: Number(project.stressData.result.criticalAreas) || 0,
                    safetyFactor: Number(project.stressData.result.safetyFactor) || 0
                }
            };
        }

        if (project.settings) {
            sanitized.settings = {};
            const validSettings = [
                'woodType', 'ringDensity', 'textureRoughness',
                'toolType', 'toolDiameter', 'feedRate', 'cutDepth',
                'materialStrength', 'cuttingForce',
                'lightIntensity', 'lightAngle', 'ambientLight'
            ];
            validSettings.forEach(key => {
                if (project.settings[key] !== undefined) {
                    sanitized.settings[key] = project.settings[key];
                }
            });
        }

        return sanitized;
    }

    isValidProject(project) {
        return project && 
               typeof project === 'object' &&
               project.id &&
               project.name;
    }

    loadProjects() {
        try {
            let data = localStorage.getItem(this.storageKey);
            
            if (!data) {
                data = localStorage.getItem(this.backupKey);
            }
            
            if (!data) {
                return [];
            }

            const parsed = JSON.parse(data);
            
            if (!Array.isArray(parsed)) {
                throw new Error('数据格式无效');
            }

            const validProjects = parsed
                .map(p => this.sanitizeProject(p))
                .filter(p => this.isValidProject(p));

            return validProjects;
        } catch (e) {
            console.error('加载项目失败，使用空列表:', e);
            return [];
        }
    }

    saveProjects() {
        try {
            const dataToSave = this.projects
                .slice(0, this.maxProjects)
                .map(p => this.sanitizeProject(p))
                .filter(p => this.isValidProject(p));

            const jsonString = JSON.stringify(dataToSave);
            
            if (jsonString.length > 4 * 1024 * 1024) {
                console.warn('数据量过大，尝试精简...');
                const simplified = dataToSave.map(p => ({
                    id: p.id,
                    name: p.name,
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                    settings: p.settings
                }));
                return this.saveToStorage(JSON.stringify(simplified));
            }

            return this.saveToStorage(jsonString);
        } catch (e) {
            console.error('保存项目失败:', e);
            return false;
        }
    }

    saveToStorage(jsonString) {
        try {
            localStorage.setItem(this.backupKey, localStorage.getItem(this.storageKey));
            localStorage.setItem(this.storageKey, jsonString);
            return true;
        } catch (e) {
            console.error('存储失败:', e);
            if (e.name === 'QuotaExceededError') {
                localStorage.removeItem(this.backupKey);
            }
            return false;
        }
    }

    createProject(name, data) {
        try {
            const project = this.sanitizeProject({
                id: Date.now().toString(),
                name: name || '未命名项目',
                createdAt: new Date().toISOString(),
                ...data
            });

            if (!this.isValidProject(project)) {
                throw new Error('项目数据无效');
            }

            this.projects.unshift(project);
            
            if (this.projects.length > this.maxProjects) {
                this.projects = this.projects.slice(0, this.maxProjects);
            }
            
            this.saveProjects();
            return project;
        } catch (e) {
            console.error('创建项目失败:', e);
            return null;
        }
    }

    updateProject(id, data) {
        try {
            const index = this.projects.findIndex(p => p.id === id);
            if (index !== -1) {
                const updated = this.sanitizeProject({
                    ...this.projects[index],
                    ...data,
                    id: id,
                    updatedAt: new Date().toISOString()
                });

                if (this.isValidProject(updated)) {
                    this.projects[index] = updated;
                    this.saveProjects();
                    return updated;
                }
            }
            return null;
        } catch (e) {
            console.error('更新项目失败:', e);
            return null;
        }
    }

    deleteProject(id) {
        try {
            const index = this.projects.findIndex(p => p.id === id);
            if (index !== -1) {
                this.projects.splice(index, 1);
                this.saveProjects();
                return true;
            }
            return false;
        } catch (e) {
            console.error('删除项目失败:', e);
            return false;
        }
    }

    getProject(id) {
        const project = this.projects.find(p => p.id === id);
        return project ? this.sanitizeProject(project) : null;
    }

    getAllProjects() {
        return this.projects.map(p => this.sanitizeProject(p)).filter(p => p);
    }

    exportToJSON(project) {
        try {
            const safeProject = this.sanitizeProject(project);
            if (!safeProject) {
                console.error('项目数据无效，无法导出');
                return;
            }

            const dataStr = JSON.stringify(safeProject, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = (safeProject.name || 'project').replace(/[<>:"/\\|?*]/g, '_') + '.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (e) {
            console.error('导出失败:', e);
        }
    }

    importFromJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file || !(file instanceof File)) {
                reject(new Error('无效的文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let project = JSON.parse(e.target.result);
                    
                    if (Array.isArray(project)) {
                        project = {
                            name: '导入的项目',
                            projects: project
                        };
                    }

                    const sanitized = this.sanitizeProject({
                        ...project,
                        id: Date.now().toString(),
                        importedAt: new Date().toISOString()
                    });

                    if (!this.isValidProject(sanitized)) {
                        throw new Error('项目数据格式无效');
                    }

                    this.projects.unshift(sanitized);
                    
                    if (this.projects.length > this.maxProjects) {
                        this.projects = this.projects.slice(0, this.maxProjects);
                    }
                    
                    this.saveProjects();
                    resolve(sanitized);
                } catch (err) {
                    reject(new Error('文件解析失败: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }

    exportImage(canvas, filename = 'image.png') {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        link.click();
    }

    exportCSV(data, filename = 'data.csv') {
        let csvContent = 'data:text/csv;charset=utf-8,';
        
        if (Array.isArray(data)) {
            data.forEach(row => {
                csvContent += row.join(',') + '\r\n';
            });
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    getStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        return {
            used: totalSize,
            usedMB: (totalSize / 1024 / 1024).toFixed(2),
            limitMB: '约5MB'
        };
    }

    clearAllProjects() {
        this.projects = [];
        this.saveProjects();
    }

    getProjectCount() {
        return this.projects.length;
    }
}