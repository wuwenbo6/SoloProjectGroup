import type { SaveData, Skeleton, LevelProgress } from '../../types';
import * as fs from 'fs';
import * as path from 'path';

export class SaveManager {
  private saves: Map<string, SaveData> = new Map();
  private saveDirectory: string;
  private backupDirectory: string;
  private autoSaveId: string | null = null;
  private lastSaveTime: Map<string, Date> = new Map();
  private pendingSaves: Set<string> = new Set();

  constructor(saveDirectory?: string) {
    this.saveDirectory = saveDirectory || path.join(process.cwd(), 'saves');
    this.backupDirectory = path.join(this.saveDirectory, 'backups');
    this.ensureSaveDirectoryExists();
    this.loadAllSaves();
  }

  private ensureSaveDirectoryExists(): void {
    if (!fs.existsSync(this.saveDirectory)) {
      fs.mkdirSync(this.saveDirectory, { recursive: true });
    }
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
    }
  }

  private generateId(): string {
    return `save_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  private getSavePath(saveId: string): string {
    return path.join(this.saveDirectory, `${saveId}.json`);
  }

  createSave(name: string, skeleton: Skeleton, currentLevelId?: string): SaveData {
    const saveData: SaveData = {
      id: this.generateId(),
      name,
      skeleton: JSON.parse(JSON.stringify(skeleton)),
      currentLevelId,
      progress: {
        completedLevels: [],
        levelStars: new Map(),
        totalScore: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.saves.set(saveData.id, saveData);
    this.saveToFile(saveData.id);
    this.lastSaveTime.set(saveData.id, new Date());

    return saveData;
  }

  private saveToFile(saveId: string): boolean {
    const saveData = this.saves.get(saveId);
    if (!saveData) return false;

    const savePath = this.getSavePath(saveId);
    const tempPath = `${savePath}.tmp`;
    const backupPath = path.join(this.backupDirectory, `${saveId}.bak`);

    try {
      const dataToSave = {
        ...saveData,
        progress: {
          ...saveData.progress,
          levelStars: Array.from(saveData.progress.levelStars.entries()),
        },
      };

      const jsonData = JSON.stringify(dataToSave, null, 2);
      JSON.parse(jsonData);

      fs.writeFileSync(tempPath, jsonData, { encoding: 'utf-8' });

      if (fs.existsSync(savePath)) {
        try {
          fs.copyFileSync(savePath, backupPath);
        } catch (backupError) {
          console.warn('创建备份失败:', backupError);
        }
      }

      fs.renameSync(tempPath, savePath);

      return true;
    } catch (error) {
      console.error('保存失败:', error);
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        console.error('清理临时文件失败:', cleanupError);
      }
      return false;
    }
  }

  private loadFromFile(saveId: string): SaveData | null {
    const filePath = this.getSavePath(saveId);
    const backupPath = path.join(this.backupDirectory, `${saveId}.bak`);

    try {
      if (!fs.existsSync(filePath)) {
        if (fs.existsSync(backupPath)) {
          console.log(`主存档不存在，尝试从备份恢复: ${saveId}`);
          fs.copyFileSync(backupPath, filePath);
        } else {
          return null;
        }
      }

      const rawData = fs.readFileSync(filePath, 'utf-8');
      if (!rawData.trim()) {
        throw new Error('存档文件为空');
      }

      const parsedData = JSON.parse(rawData);

      if (!parsedData.id || !parsedData.skeleton) {
        throw new Error('存档数据格式无效');
      }

      parsedData.progress.levelStars = new Map(parsedData.progress.levelStars || []);
      parsedData.createdAt = new Date(parsedData.createdAt || Date.now());
      parsedData.updatedAt = new Date(parsedData.updatedAt || Date.now());

      return parsedData;
    } catch (error) {
      console.error(`加载存档 ${saveId} 失败:`, error);

      try {
        if (fs.existsSync(backupPath)) {
          console.log(`尝试从备份恢复: ${saveId}`);
          fs.copyFileSync(backupPath, filePath);
          return this.loadFromFile(saveId);
        }
      } catch (backupError) {
        console.error('从备份恢复也失败:', backupError);
      }

      return null;
    }
  }

  loadAllSaves(): void {
    this.saves.clear();

    try {
      const files = fs.readdirSync(this.saveDirectory);
      const saveFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('.tmp.json'));

      for (const file of saveFiles) {
        const saveId = file.replace('.json', '');
        const saveData = this.loadFromFile(saveId);
        if (saveData && this.validateSaveData(saveData)) {
          this.saves.set(saveId, saveData);
        }
      }
    } catch (error) {
      console.error('加载所有存档失败:', error);
    }
  }

  private validateSaveData(saveData: SaveData): boolean {
    try {
      if (!saveData.id || !saveData.name) return false;
      if (!saveData.skeleton) return false;
      if (!Array.isArray(saveData.skeleton.nodes)) return false;
      if (!Array.isArray(saveData.skeleton.edges)) return false;
      return true;
    } catch {
      return false;
    }
  }

  getSave(saveId: string): SaveData | undefined {
    return this.saves.get(saveId);
  }

  getAllSaves(): SaveData[] {
    return Array.from(this.saves.values()).sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  updateSave(saveId: string, updates: Partial<SaveData>): boolean {
    const saveData = this.saves.get(saveId);
    if (!saveData) return false;

    Object.assign(saveData, updates);
    saveData.updatedAt = new Date();

    const success = this.saveToFile(saveId);
    if (success) {
      this.lastSaveTime.set(saveId, new Date());
    }

    return success;
  }

  updateSkeleton(saveId: string, skeleton: Skeleton): boolean {
    return this.updateSave(saveId, {
      skeleton: JSON.parse(JSON.stringify(skeleton)),
    });
  }

  updateProgress(saveId: string, progress: Partial<LevelProgress>): boolean {
    const saveData = this.saves.get(saveId);
    if (!saveData) return false;

    saveData.progress = {
      ...saveData.progress,
      ...progress,
    };

    return this.updateSave(saveId, {});
  }

  deleteSave(saveId: string): boolean {
    if (!this.saves.has(saveId)) return false;

    try {
      const filePath = this.getSavePath(saveId);
      const backupPath = path.join(this.backupDirectory, `${saveId}.bak`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }

      this.saves.delete(saveId);
      this.lastSaveTime.delete(saveId);
      return true;
    } catch (error) {
      console.error('删除存档失败:', error);
      return false;
    }
  }

  restoreFromBackup(saveId: string): boolean {
    const backupPath = path.join(this.backupDirectory, `${saveId}.bak`);
    const savePath = this.getSavePath(saveId);

    try {
      if (!fs.existsSync(backupPath)) {
        console.error('备份文件不存在:', saveId);
        return false;
      }

      fs.copyFileSync(backupPath, savePath);
      const saveData = this.loadFromFile(saveId);
      if (saveData) {
        this.saves.set(saveId, saveData);
        return true;
      }
      return false;
    } catch (error) {
      console.error('从备份恢复失败:', error);
      return false;
    }
  }

  hasBackup(saveId: string): boolean {
    const backupPath = path.join(this.backupDirectory, `${saveId}.bak`);
    return fs.existsSync(backupPath);
  }

  renameSave(saveId: string, newName: string): boolean {
    return this.updateSave(saveId, { name: newName });
  }

  duplicateSave(saveId: string, newName?: string): SaveData | null {
    const original = this.saves.get(saveId);
    if (!original) return null;

    const duplicated = this.createSave(
      newName || `${original.name} (副本)`,
      original.skeleton,
      original.currentLevelId
    );

    duplicated.progress = JSON.parse(JSON.stringify(original.progress));
    this.saveToFile(duplicated.id);

    return duplicated;
  }

  exportSave(saveId: string, exportPath: string): boolean {
    const saveData = this.saves.get(saveId);
    if (!saveData) return false;

    try {
      const dataToExport = {
        ...saveData,
        progress: {
          ...saveData.progress,
          levelStars: Array.from(saveData.progress.levelStars.entries()),
        },
      };
      fs.writeFileSync(exportPath, JSON.stringify(dataToExport, null, 2));
      return true;
    } catch (error) {
      console.error('导出失败:', error);
      return false;
    }
  }

  importSave(importPath: string): SaveData | null {
    try {
      if (!fs.existsSync(importPath)) return null;

      const rawData = fs.readFileSync(importPath, 'utf-8');
      const parsedData = JSON.parse(rawData);

      parsedData.id = this.generateId();
      parsedData.progress.levelStars = new Map(parsedData.progress.levelStars);
      parsedData.createdAt = new Date(parsedData.createdAt);
      parsedData.updatedAt = new Date();

      this.saves.set(parsedData.id, parsedData);
      this.saveToFile(parsedData.id);
      this.lastSaveTime.set(parsedData.id, new Date());

      return parsedData;
    } catch (error) {
      console.error('导入失败:', error);
      return null;
    }
  }

  enableAutoSave(saveId: string): boolean {
    if (!this.saves.has(saveId)) return false;
    this.autoSaveId = saveId;
    return true;
  }

  disableAutoSave(): void {
    this.autoSaveId = null;
  }

  autoSave(skeleton: Skeleton): boolean {
    if (!this.autoSaveId) return false;
    return this.updateSkeleton(this.autoSaveId, skeleton);
  }

  getAutoSaveId(): string | null {
    return this.autoSaveId;
  }

  getSaveCount(): number {
    return this.saves.size;
  }

  getLastSaveTime(saveId: string): Date | undefined {
    return this.lastSaveTime.get(saveId);
  }

  clearAllSaves(): void {
    for (const saveId of this.saves.keys()) {
      try {
        const filePath = this.getSavePath(saveId);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.error('删除存档文件失败:', error);
      }
    }
    this.saves.clear();
    this.lastSaveTime.clear();
  }

  findSavesByName(searchTerm: string): SaveData[] {
    return this.getAllSaves().filter(save =>
      save.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  getSavePreview(saveId: string): {
    name: string;
    nodeCount: number;
    edgeCount: number;
    updatedAt: Date;
    currentLevelId?: string;
  } | null {
    const save = this.saves.get(saveId);
    if (!save) return null;

    return {
      name: save.name,
      nodeCount: save.skeleton.nodes.length,
      edgeCount: save.skeleton.edges.length,
      updatedAt: save.updatedAt,
      currentLevelId: save.currentLevelId,
    };
  }

  createQuickSave(skeleton: Skeleton): SaveData {
    return this.createSave('快速存档', skeleton);
  }

  getMostRecentSave(): SaveData | null {
    const saves = this.getAllSaves();
    return saves.length > 0 ? saves[0] : null;
  }

  validateSave(saveId: string): boolean {
    const saveData = this.saves.get(saveId);
    if (!saveData) return false;

    if (!saveData.id || !saveData.name || !saveData.skeleton) return false;
    if (!Array.isArray(saveData.skeleton.nodes) || !Array.isArray(saveData.skeleton.edges)) return false;

    return true;
  }

  getStorageUsed(): number {
    let totalSize = 0;
    for (const saveId of this.saves.keys()) {
      try {
        const filePath = this.getSavePath(saveId);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        }
      } catch (error) {
        console.error('获取文件大小失败:', error);
      }
    }
    return totalSize;
  }
}
