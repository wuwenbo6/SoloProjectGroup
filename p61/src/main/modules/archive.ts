import { EventEmitter } from 'events';
import Store from 'electron-store';

export interface ArchiveRecord {
  id: string;
  type: 'transcription' | 'font_style' | 'session';
  data: any;
  createdAt: number;
  updatedAt: number;
}

export interface ArchiveSearchOptions {
  type?: string;
  dateFrom?: number;
  dateTo?: number;
  keyword?: string;
  limit?: number;
  offset?: number;
}

export class ArchiveManager extends EventEmitter {
  private store: Store;
  private records: Map<string, ArchiveRecord> = new Map();
  private readonly MAX_RECORDS = 10000;

  constructor() {
    super();
    
    this.store = new Store({
      name: 'typewriter-archive',
      fileExtension: 'json'
    });

    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = this.store.get('records') as ArchiveRecord[];
      if (Array.isArray(stored)) {
        stored.forEach(record => {
          this.records.set(record.id, record);
        });
      }
    } catch (error) {
      console.error('Failed to load archive from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const recordsArray = Array.from(this.records.values());
      this.store.set('records', recordsArray);
    } catch (error) {
      console.error('Failed to save archive to storage:', error);
    }
  }

  addRecord(type: string, data: any): ArchiveRecord {
    const id = `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const record: ArchiveRecord = {
      id,
      type: type as ArchiveRecord['type'],
      data,
      createdAt: now,
      updatedAt: now
    };

    this.records.set(id, record);
    this.enforceLimit();
    this.saveToStorage();

    this.emit('record-added', record);
    return record;
  }

  private enforceLimit(): void {
    if (this.records.size > this.MAX_RECORDS) {
      const sortedRecords = Array.from(this.records.values())
        .sort((a, b) => a.createdAt - b.createdAt);
      
      const excess = this.records.size - this.MAX_RECORDS;
      for (let i = 0; i < excess; i++) {
        this.records.delete(sortedRecords[i].id);
      }
    }
  }

  getRecord(id: string): ArchiveRecord | undefined {
    return this.records.get(id);
  }

  updateRecord(id: string, data: any): ArchiveRecord | null {
    const record = this.records.get(id);
    if (!record) return null;

    record.data = { ...record.data, ...data };
    record.updatedAt = Date.now();

    this.saveToStorage();
    this.emit('record-updated', record);

    return record;
  }

  deleteRecord(id: string): boolean {
    const deleted = this.records.delete(id);
    if (deleted) {
      this.saveToStorage();
      this.emit('record-deleted', id);
    }
    return deleted;
  }

  search(options: ArchiveSearchOptions = {}): ArchiveRecord[] {
    let results = Array.from(this.records.values());

    if (options.type) {
      results = results.filter(r => r.type === options.type);
    }

    if (options.dateFrom !== undefined) {
      results = results.filter(r => r.createdAt >= options.dateFrom!);
    }

    if (options.dateTo !== undefined) {
      results = results.filter(r => r.createdAt <= options.dateTo!);
    }

    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      results = results.filter(r => {
        const dataStr = JSON.stringify(r.data).toLowerCase();
        return dataStr.includes(keyword);
      });
    }

    results.sort((a, b) => b.createdAt - a.createdAt);

    if (options.offset !== undefined) {
      results = results.slice(options.offset);
    }

    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  getAllRecords(): ArchiveRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getByType(type: string): ArchiveRecord[] {
    return this.search({ type });
  }

  getRecent(count: number = 10): ArchiveRecord[] {
    return this.search({ limit: count });
  }

  getStats(): {
    totalRecords: number;
    byType: Record<string, number>;
    lastUpdated: number;
  } {
    const byType: Record<string, number> = {};

    this.records.forEach(record => {
      byType[record.type] = (byType[record.type] || 0) + 1;
    });

    const records = this.getAllRecords();
    const lastUpdated = records.length > 0 ? records[0].updatedAt : 0;

    return {
      totalRecords: this.records.size,
      byType,
      lastUpdated
    };
  }

  exportAll(): string {
    const records = this.getAllRecords();
    return JSON.stringify(records, null, 2);
  }

  importRecords(recordsJson: string): { success: number; failed: number } {
    try {
      const records = JSON.parse(recordsJson) as ArchiveRecord[];
      
      let success = 0;
      let failed = 0;

      for (const record of records) {
        if (this.validateRecord(record)) {
          this.records.set(record.id, record);
          success++;
        } else {
          failed++;
        }
      }

      this.saveToStorage();
      this.emit('records-imported', { success, failed });

      return { success, failed };
    } catch (error) {
      console.error('Failed to import records:', error);
      return { success: 0, failed: 0 };
    }
  }

  private validateRecord(record: any): record is ArchiveRecord {
    return (
      typeof record === 'object' &&
      record !== null &&
      typeof record.id === 'string' &&
      typeof record.type === 'string' &&
      typeof record.createdAt === 'number' &&
      typeof record.updatedAt === 'number' &&
      typeof record.data === 'object'
    );
  }

  clearAll(): void {
    this.records.clear();
    this.saveToStorage();
    this.emit('archive-cleared');
  }

  cleanupOldRecords(olderThanDays: number): number {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [id, record] of this.records.entries()) {
      if (record.createdAt < cutoffTime) {
        this.records.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.saveToStorage();
      this.emit('old-records-cleaned', { count: deletedCount, olderThanDays });
    }

    return deletedCount;
  }
}
