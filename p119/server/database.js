const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/maps.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    width INTEGER,
    height INTEGER,
    status TEXT DEFAULT 'uploaded',
    owner_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS control_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    lon REAL NOT NULL,
    lat REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS layers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'annotation',
    color TEXT DEFAULT '#3498db',
    visible INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    map_id TEXT NOT NULL,
    layer_id INTEGER,
    type TEXT NOT NULL,
    name TEXT,
    modern_name TEXT,
    description TEXT,
    geometry TEXT NOT NULL,
    style TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
    FOREIGN KEY (layer_id) REFERENCES layers(id) ON DELETE SET NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS annotation_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annotation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    name TEXT,
    modern_name TEXT,
    description TEXT,
    geometry TEXT NOT NULL,
    style TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'viewer',
    color TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS map_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission_level TEXT NOT NULL,
    granted_by TEXT,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(map_id, user_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS name_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    annotation_id TEXT NOT NULL,
    ancient_name TEXT NOT NULL,
    modern_name TEXT,
    relation_type TEXT DEFAULT 'same',
    confidence REAL DEFAULT 1.0,
    source TEXT,
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    map_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.all("PRAGMA table_info(annotations)", (err, rows) => {
    const columns = rows.map(r => r.name);
    if (!columns.includes('modern_name')) {
      db.run("ALTER TABLE annotations ADD COLUMN modern_name TEXT");
    }
    if (!columns.includes('description')) {
      db.run("ALTER TABLE annotations ADD COLUMN description TEXT");
    }
    if (!columns.includes('layer_id')) {
      db.run("ALTER TABLE annotations ADD COLUMN layer_id INTEGER");
    }
  });
});

module.exports = db;
