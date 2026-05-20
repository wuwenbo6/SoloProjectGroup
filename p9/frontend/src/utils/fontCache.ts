import type { FontMetadata, TypographyConfig } from '../types';

const FONT_CACHE_KEY = 'font_editor_fonts';
const CONFIG_CACHE_KEY = 'font_editor_configs';
const FONT_DATA_KEY = 'font_editor_data_';

interface CachedFont {
  metadata: FontMetadata;
  fontData: string;
  timestamp: number;
}

export class FontCache {
  private static db: IDBDatabase | null = null;
  private static dbName = 'FontEditorDB';
  private static dbVersion = 1;

  static async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('fonts')) {
          const fontStore = db.createObjectStore('fonts', { keyPath: 'id' });
          fontStore.createIndex('name', 'name', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('fontData')) {
          db.createObjectStore('fontData', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('configs')) {
          db.createObjectStore('configs', { keyPath: 'id' });
        }
      };
    });
  }

  static async saveFont(font: FontMetadata, fileData: ArrayBuffer): Promise<void> {
    const db = await this.initDB();
    
    const tx = db.transaction(['fonts', 'fontData'], 'readwrite');
    const fontStore = tx.objectStore('fonts');
    const dataStore = tx.objectStore('fontData');

    await new Promise<void>((resolve, reject) => {
      const fontRequest = fontStore.put({
        ...font,
        timestamp: Date.now(),
      });
      fontRequest.onsuccess = () => resolve();
      fontRequest.onerror = () => reject(fontRequest.error);
    });

    await new Promise<void>((resolve, reject) => {
      const dataRequest = dataStore.put({
        id: font.id,
        data: fileData,
      });
      dataRequest.onsuccess = () => resolve();
      dataRequest.onerror = () => reject(dataRequest.error);
    });

    localStorage.setItem(`${FONT_DATA_KEY}${font.id}`, JSON.stringify({
      fileName: font.fileName,
      name: font.name,
      timestamp: Date.now(),
    }));
  }

  static async getFont(id: string): Promise<{ metadata: FontMetadata; data: ArrayBuffer } | null> {
    try {
      const db = await this.initDB();
      
      const tx = db.transaction(['fonts', 'fontData'], 'readonly');
      const fontStore = tx.objectStore('fonts');
      const dataStore = tx.objectStore('fontData');

      const font = await new Promise<FontMetadata | null>((resolve) => {
        const request = fontStore.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });

      if (!font) return null;

      const fontData = await new Promise<{ data: ArrayBuffer } | null>((resolve) => {
        const request = dataStore.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });

      if (!fontData) return null;

      return { metadata: font, data: fontData.data };
    } catch {
      return null;
    }
  }

  static async getAllFonts(): Promise<FontMetadata[]> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('fonts', 'readonly');
      const store = tx.objectStore('fonts');

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  static async deleteFont(id: string): Promise<void> {
    try {
      const db = await this.initDB();
      
      const tx = db.transaction(['fonts', 'fontData'], 'readwrite');
      tx.objectStore('fonts').delete(id);
      tx.objectStore('fontData').delete(id);
      
      localStorage.removeItem(`${FONT_DATA_KEY}${id}`);
    } catch {
    }
  }

  static async saveConfig(config: TypographyConfig): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('configs', 'readwrite');
      const store = tx.objectStore('configs');
      
      await new Promise<void>((resolve) => {
        const request = store.put({
          ...config,
          timestamp: Date.now(),
        });
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
    }
  }

  static async getAllConfigs(): Promise<TypographyConfig[]> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('configs', 'readonly');
      const store = tx.objectStore('configs');

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  static async deleteConfig(id: string): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('configs', 'readwrite');
      tx.objectStore('configs').delete(id);
    } catch {
    }
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  static onNetworkChange(callback: (isOnline: boolean) => void): () => void {
    const onlineHandler = () => callback(true);
    const offlineHandler = () => callback(false);
    
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }
}
