import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { Script, Preset, MidiMapping, LogEntry } from '../src/types/electron'

let db: Database.Database | null = null

export function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'midi-script-studio.db')
  db = new Database(dbPath)
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      scriptId TEXT NOT NULL,
      inputDeviceId TEXT,
      outputDeviceId TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (scriptId) REFERENCES scripts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS midi_mappings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sourceType TEXT NOT NULL,
      sourceChannel INTEGER,
      sourceValue INTEGER,
      targetType TEXT NOT NULL,
      targetChannel INTEGER,
      targetValue INTEGER,
      transform TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS midi_logs (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON midi_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_logs_type ON midi_logs(type);
  `)
  
  console.log('Database initialized at:', dbPath)
}

export function getScripts(): Script[] {
  if (!db) return []
  const rows = db.prepare('SELECT * FROM scripts ORDER BY updatedAt DESC').all() as any[]
  return rows.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : undefined
  }))
}

export function saveScript(script: Omit<Script, 'createdAt' | 'updatedAt'>): Script {
  if (!db) throw new Error('Database not initialized')
  
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM scripts WHERE id = ?').get(script.id)
  
  if (existing) {
    db.prepare(`
      UPDATE scripts 
      SET name = ?, code = ?, description = ?, tags = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      script.name, 
      script.code, 
      script.description || null,
      script.tags ? JSON.stringify(script.tags) : null,
      now, 
      script.id
    )
  } else {
    db.prepare(`
      INSERT INTO scripts (id, name, code, description, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      script.id, 
      script.name, 
      script.code, 
      script.description || null,
      script.tags ? JSON.stringify(script.tags) : null,
      now, 
      now
    )
  }
  
  return getScriptById(script.id)!
}

export function getScriptById(id: string): Script | null {
  if (!db) return null
  const row = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id) as any
  if (!row) return null
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : undefined
  }
}

export function deleteScript(id: string): void {
  if (!db) return
  db.prepare('DELETE FROM scripts WHERE id = ?').run(id)
}

export function getPresets(): Preset[] {
  if (!db) return []
  return db.prepare('SELECT * FROM presets ORDER BY createdAt DESC').all() as Preset[]
}

export function savePreset(preset: Omit<Preset, 'createdAt'>): Preset {
  if (!db) throw new Error('Database not initialized')
  
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM presets WHERE id = ?').get(preset.id)
  
  if (existing) {
    db.prepare(`
      UPDATE presets 
      SET name = ?, scriptId = ?, inputDeviceId = ?, outputDeviceId = ?
      WHERE id = ?
    `).run(preset.name, preset.scriptId, preset.inputDeviceId, preset.outputDeviceId, preset.id)
  } else {
    db.prepare(`
      INSERT INTO presets (id, name, scriptId, inputDeviceId, outputDeviceId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(preset.id, preset.name, preset.scriptId, preset.inputDeviceId, preset.outputDeviceId, now)
  }
  
  return db.prepare('SELECT * FROM presets WHERE id = ?').get(preset.id) as Preset
}

export function deletePreset(id: string): void {
  if (!db) return
  db.prepare('DELETE FROM presets WHERE id = ?').run(id)
}

export function getMappings(): MidiMapping[] {
  if (!db) return []
  return db.prepare('SELECT * FROM midi_mappings ORDER BY createdAt DESC').all() as MidiMapping[]
}

export function saveMapping(mapping: Omit<MidiMapping, 'createdAt'>): MidiMapping {
  if (!db) throw new Error('Database not initialized')
  
  const now = Date.now()
  const existing = db.prepare('SELECT id FROM midi_mappings WHERE id = ?').get(mapping.id)
  
  if (existing) {
    db.prepare(`
      UPDATE midi_mappings 
      SET name = ?, enabled = ?, sourceType = ?, sourceChannel = ?, sourceValue = ?,
          targetType = ?, targetChannel = ?, targetValue = ?, transform = ?
      WHERE id = ?
    `).run(
      mapping.name,
      mapping.enabled ? 1 : 0,
      mapping.sourceType,
      mapping.sourceChannel || null,
      mapping.sourceValue || null,
      mapping.targetType,
      mapping.targetChannel || null,
      mapping.targetValue || null,
      mapping.transform || null,
      mapping.id
    )
  } else {
    db.prepare(`
      INSERT INTO midi_mappings (id, name, enabled, sourceType, sourceChannel, sourceValue,
        targetType, targetChannel, targetValue, transform, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mapping.id,
      mapping.name,
      mapping.enabled ? 1 : 0,
      mapping.sourceType,
      mapping.sourceChannel || null,
      mapping.sourceValue || null,
      mapping.targetType,
      mapping.targetChannel || null,
      mapping.targetValue || null,
      mapping.transform || null,
      now
    )
  }
  
  return db.prepare('SELECT * FROM midi_mappings WHERE id = ?').get(mapping.id) as MidiMapping
}

export function deleteMapping(id: string): void {
  if (!db) return
  db.prepare('DELETE FROM midi_mappings WHERE id = ?').run(id)
}

export function toggleMapping(id: string, enabled: boolean): void {
  if (!db) return
  db.prepare('UPDATE midi_mappings SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id)
}

export function addMidiLog(log: Omit<LogEntry, 'id' | 'timestamp'>): void {
  if (!db) return
  const stmt = db.prepare(`
    INSERT INTO midi_logs (id, timestamp, type, message, data)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(
    require('uuid').v4(),
    Date.now(),
    log.type,
    log.message,
    log.data ? JSON.stringify(log.data) : null
  )
}

export function getMidiLogs(filters?: { type?: string; channel?: number; start?: number; end?: number }): LogEntry[] {
  if (!db) return []
  
  let query = 'SELECT * FROM midi_logs WHERE 1=1'
  const params: any[] = []
  
  if (filters?.type) {
    query += ' AND type = ?'
    params.push(filters.type)
  }
  if (filters?.start) {
    query += ' AND timestamp >= ?'
    params.push(filters.start)
  }
  if (filters?.end) {
    query += ' AND timestamp <= ?'
    params.push(filters.end)
  }
  
  query += ' ORDER BY timestamp DESC LIMIT 1000'
  
  const rows = db.prepare(query).all(...params) as any[]
  return rows.map(row => ({
    ...row,
    data: row.data ? JSON.parse(row.data) : undefined
  }))
}

export function clearMidiLogs(): void {
  if (!db) return
  db.prepare('DELETE FROM midi_logs').run()
}

export function exportLogs(format: 'json' | 'csv', filters?: any): string {
  const logs = getMidiLogs(filters)
  
  if (format === 'json') {
    return JSON.stringify(logs, null, 2)
  } else {
    const headers = ['timestamp', 'type', 'message', 'data']
    const rows = logs.map(log => [
      log.timestamp,
      log.type,
      `"${log.message.replace(/"/g, '""')}"`,
      log.data ? `"${JSON.stringify(log.data).replace(/"/g, '""')}"` : ''
    ])
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }
}
