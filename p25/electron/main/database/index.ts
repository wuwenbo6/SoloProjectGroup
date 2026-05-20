import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import type { Preset, ChainPreset, PluginParameter, PluginChain } from './types'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = path.join(app.getPath('userData'), 'p25-daw.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  createIndexes()

  return db
}

function createTables() {
  if (!db) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plugin_id TEXT NOT NULL,
      category TEXT,
      author TEXT,
      parameters_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS chain_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      author TEXT,
      plugins_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_chains (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      track_id TEXT NOT NULL,
      plugins_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS plugin_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS recent_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_id TEXT NOT NULL,
      preset_type TEXT NOT NULL CHECK (preset_type IN ('single', 'chain')),
      used_at INTEGER NOT NULL,
      FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE CASCADE
    )
  `)
}

function createIndexes() {
  if (!db) return

  db.exec(`CREATE INDEX IF NOT EXISTS idx_presets_plugin_id ON presets(plugin_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_presets_category ON presets(category)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_presets_name ON presets(name)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_plugin_chains_track_id ON plugin_chains(track_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_recent_presets_used_at ON recent_presets(used_at DESC)`)
}

export function getDb(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export const presetDB = {
  async create(preset: Omit<Preset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Preset> {
    const db = getDb()
    const now = Date.now()
    const id = `preset_${now}_${Math.random().toString(36).substr(2, 9)}`

    const stmt = db.prepare(`
      INSERT INTO presets (id, name, plugin_id, category, author, parameters_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      preset.name,
      preset.pluginId,
      preset.category || null,
      preset.author || null,
      JSON.stringify(preset.parameters),
      now,
      now
    )

    return { ...preset, id, createdAt: now, updatedAt: now }
  },

  async getById(id: string): Promise<Preset | null> {
    const db = getDb()
    const row = db.prepare('SELECT * FROM presets WHERE id = ?').get(id) as any

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      pluginId: row.plugin_id,
      category: row.category || undefined,
      author: row.author || undefined,
      parameters: JSON.parse(row.parameters_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  },

  async getByPluginId(pluginId: string): Promise<Preset[]> {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM presets WHERE plugin_id = ? ORDER BY name').all(pluginId) as any[]

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      pluginId: row.plugin_id,
      category: row.category || undefined,
      author: row.author || undefined,
      parameters: JSON.parse(row.parameters_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  async getAll(): Promise<Preset[]> {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM presets ORDER BY name').all() as any[]

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      pluginId: row.plugin_id,
      category: row.category || undefined,
      author: row.author || undefined,
      parameters: JSON.parse(row.parameters_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  async update(id: string, updates: Partial<Pick<Preset, 'name' | 'category' | 'author' | 'parameters'>>): Promise<void> {
    const db = getDb()
    const now = Date.now()

    const fields: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.category !== undefined) {
      fields.push('category = ?')
      values.push(updates.category || null)
    }
    if (updates.author !== undefined) {
      fields.push('author = ?')
      values.push(updates.author || null)
    }
    if (updates.parameters !== undefined) {
      fields.push('parameters_json = ?')
      values.push(JSON.stringify(updates.parameters))
    }

    values.push(id)

    db.prepare(`UPDATE presets SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    db.prepare('DELETE FROM presets WHERE id = ?').run(id)
  },

  async getCategories(): Promise<string[]> {
    const db = getDb()
    const rows = db.prepare('SELECT DISTINCT category FROM presets WHERE category IS NOT NULL ORDER BY category').all() as any[]
    return rows.map((r) => r.category)
  },
}

export const chainPresetDB = {
  async create(preset: Omit<ChainPreset, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChainPreset> {
    const db = getDb()
    const now = Date.now()
    const id = `chain_${now}_${Math.random().toString(36).substr(2, 9)}`

    const stmt = db.prepare(`
      INSERT INTO chain_presets (id, name, category, author, plugins_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      preset.name,
      preset.category || null,
      preset.author || null,
      JSON.stringify(preset.plugins),
      now,
      now
    )

    return { ...preset, id, createdAt: now, updatedAt: now }
  },

  async getById(id: string): Promise<ChainPreset | null> {
    const db = getDb()
    const row = db.prepare('SELECT * FROM chain_presets WHERE id = ?').get(id) as any

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      category: row.category || undefined,
      author: row.author || undefined,
      plugins: JSON.parse(row.plugins_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  },

  async getAll(): Promise<ChainPreset[]> {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM chain_presets ORDER BY name').all() as any[]

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category || undefined,
      author: row.author || undefined,
      plugins: JSON.parse(row.plugins_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  },

  async update(id: string, updates: Partial<Pick<ChainPreset, 'name' | 'category' | 'author' | 'plugins'>>): Promise<void> {
    const db = getDb()
    const now = Date.now()

    const fields: string[] = ['updated_at = ?']
    const values: any[] = [now]

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.category !== undefined) {
      fields.push('category = ?')
      values.push(updates.category || null)
    }
    if (updates.author !== undefined) {
      fields.push('author = ?')
      values.push(updates.author || null)
    }
    if (updates.plugins !== undefined) {
      fields.push('plugins_json = ?')
      values.push(JSON.stringify(updates.plugins))
    }

    values.push(id)

    db.prepare(`UPDATE chain_presets SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    db.prepare('DELETE FROM chain_presets WHERE id = ?').run(id)
  },

  async getCategories(): Promise<string[]> {
    const db = getDb()
    const rows = db.prepare('SELECT DISTINCT category FROM chain_presets WHERE category IS NOT NULL ORDER BY category').all() as any[]
    return rows.map((r) => r.category)
  },
}

export const pluginChainDB = {
  async save(chain: Omit<PluginChain, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<PluginChain> {
    const db = getDb()
    const now = Date.now()

    if (chain.id) {
      const existing = db.prepare('SELECT id FROM plugin_chains WHERE id = ?').get(chain.id)
      if (existing) {
        db.prepare(`
          UPDATE plugin_chains 
          SET name = ?, track_id = ?, plugins_json = ?, updated_at = ?
          WHERE id = ?
        `).run(chain.name, chain.trackId, JSON.stringify(chain.plugins), now, chain.id)

        return { ...chain, id: chain.id, createdAt: now, updatedAt: now }
      }
    }

    const id = chain.id || `chain_${now}_${Math.random().toString(36).substr(2, 9)}`

    db.prepare(`
      INSERT INTO plugin_chains (id, name, track_id, plugins_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, chain.name, chain.trackId, JSON.stringify(chain.plugins), now, now)

    return { ...chain, id, createdAt: now, updatedAt: now }
  },

  async getByTrackId(trackId: string): Promise<PluginChain | null> {
    const db = getDb()
    const row = db.prepare('SELECT * FROM plugin_chains WHERE track_id = ?').get(trackId) as any

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      trackId: row.track_id,
      plugins: JSON.parse(row.plugins_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    db.prepare('DELETE FROM plugin_chains WHERE id = ?').run(id)
  },
}
