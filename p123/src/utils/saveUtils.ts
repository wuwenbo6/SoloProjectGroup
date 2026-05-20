import { SaveData, BaseObject, WaterLevel } from '@/types';

const STORAGE_KEY = 'water-wheel-simulator-saves';

export function getSaves(): SaveData[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    return parsed.map((save: any) => ({
      ...save,
      waterLevel: {
        height: save.waterLevel?.height ?? 200,
        targetHeight: save.waterLevel?.targetHeight ?? 200,
        maxHeight: save.waterLevel?.maxHeight ?? 400,
        minHeight: save.waterLevel?.minHeight ?? 50,
      },
    }));
  } catch (e) {
    console.error('Failed to load saves:', e);
    return [];
  }
}

export function saveGame(name: string, objects: BaseObject[], waterLevel: WaterLevel, currentLevelId: number | null, score: number): SaveData {
  try {
    const saves = getSaves();
    
    const newSave: SaveData = {
      id: `save-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      timestamp: Date.now(),
      levelId: currentLevelId || 0,
      objects: JSON.parse(JSON.stringify(objects)),
      waterLevel: {
        height: waterLevel.height,
        targetHeight: waterLevel.targetHeight,
        maxHeight: waterLevel.maxHeight,
        minHeight: waterLevel.minHeight,
      },
      score,
    };
    
    saves.push(newSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    
    return newSave;
  } catch (e) {
    console.error('Failed to save game:', e);
    throw e;
  }
}

export function loadSave(saveId: string): SaveData | null {
  const saves = getSaves();
  return saves.find((s) => s.id === saveId) || null;
}

export function deleteSave(saveId: string): void {
  try {
    const saves = getSaves();
    const filtered = saves.filter((s) => s.id !== saveId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete save:', e);
  }
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
