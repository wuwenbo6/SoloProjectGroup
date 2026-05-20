import sqlite3 from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const dbPath = path.join(__dirname, '../../data/simulator.db')

const db = sqlite3(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data TEXT NOT NULL
  )
`)

export function saveSnapshot(name, timestamp, data) {
  const stmt = db.prepare('INSERT INTO snapshots (name, timestamp, data) VALUES (?, ?, ?)')
  const result = stmt.run(name, timestamp, JSON.stringify(data))
  return result.lastInsertRowid
}

export function getSnapshots() {
  const stmt = db.prepare('SELECT id, name, timestamp FROM snapshots ORDER BY timestamp DESC')
  return stmt.all()
}

export function getSnapshotById(id) {
  const stmt = db.prepare('SELECT * FROM snapshots WHERE id = ?')
  const row = stmt.get(id)
  if (row) {
    row.data = JSON.parse(row.data)
  }
  return row
}

export function deleteSnapshot(id) {
  const stmt = db.prepare('DELETE FROM snapshots WHERE id = ?')
  stmt.run(id)
}

export default db
