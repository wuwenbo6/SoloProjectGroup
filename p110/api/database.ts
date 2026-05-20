import initSqlJs, { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'app.db');

let db: Database | null = null;

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  let dbData: Uint8Array | null = null;
  if (fs.existsSync(dbPath)) {
    dbData = new Uint8Array(fs.readFileSync(dbPath));
  }
  
  db = new SQL.Database(dbData);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'guest',
      avatar TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'annotator',
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      original_name TEXT,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      uploaded_by TEXT REFERENCES users(id),
      status TEXT DEFAULT 'uploaded',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS text_blocks (
      id TEXT PRIMARY KEY,
      image_id TEXT REFERENCES images(id) ON DELETE CASCADE,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      recognized_text TEXT,
      corrected_text TEXT,
      confidence REAL,
      status TEXT DEFAULT 'pending',
      annotated_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS versions (
      id TEXT PRIMARY KEY,
      image_id TEXT REFERENCES images(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      author_id TEXT REFERENCES users(id),
      author_name TEXT,
      comment TEXT,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(image_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS variant_characters (
      id TEXT PRIMARY KEY,
      standard_char TEXT NOT NULL,
      variant_char TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      source TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(standard_char, variant_char)
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      block_id TEXT REFERENCES text_blocks(id) ON DELETE CASCADE,
      image_id TEXT REFERENCES images(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'comment',
      content TEXT NOT NULL,
      author_id TEXT REFERENCES users(id),
      author_name TEXT,
      position_x REAL,
      position_y REAL,
      is_public INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS punctuation_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      replacement TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      priority INTEGER DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS offline_sync_queue (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced_at TEXT
    );
  `);
  
  const adminCheck = db.exec('SELECT id FROM users WHERE username = ?', ['admin']);
  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const adminId = uuidv4();
    
    db.run(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [adminId, 'admin', hashedPassword, 'admin']
    );

    const annotatorId = uuidv4();
    db.run(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [annotatorId, 'annotator', hashedPassword, 'annotator']
    );

    const projectId = uuidv4();
    db.run(
      'INSERT INTO projects (id, name, description, created_by) VALUES (?, ?, ?, ?)',
      [projectId, '古籍碑文数字化项目', '用于古代碑文和文献的OCR识别与校对', adminId]
    );

    db.run(
      'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), projectId, adminId, 'admin']
    );
    db.run(
      'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), projectId, annotatorId, 'annotator']
    );

    const variantChars = [
      ['后', '後'], ['里', '裡'], ['才', '纔'], ['几', '幾'], ['后', '後'],
      ['云', '雲'], ['冬', '鼕'], ['出', '齣'], ['冲', '衝'], ['朴', '樸'],
      ['朱', '硃'], ['谷', '穀'], ['系', '係'], ['咸', '鹹'], ['舍', '捨'],
      ['准', '準'], ['折', '摺'], ['征', '徵'], ['别', '別'], ['于', '於'],
      ['吁', '籲'], ['丰', '豐'], ['表', '錶'], ['丑', '醜'], ['范', '範'],
      ['淀', '澱'], ['松', '鬆'], ['机', '機'], ['党', '黨'], ['坛', '壇']
    ];
    
    variantChars.forEach(([standard, variant]) => {
      try {
        db.run(
          'INSERT OR IGNORE INTO variant_characters (id, standard_char, variant_char, category, source) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), standard, variant, 'common', '通用规范汉字表']
        );
      } catch (e) {}
    });

    const punctuationRules = [
      { pattern: '。{2,}', replacement: '。', desc: '多个句号合并' },
      { pattern: '，{2,}', replacement: '，', desc: '多个逗号合并' },
      { pattern: '([。！？])([^"』])', replacement: '$1 $2', desc: '句末标点后加空格' },
      { pattern: '([，；])(.)', replacement: '$1 $2', desc: '句中停顿后加空格' },
      { pattern: '([「『])(.)', replacement: '$1$2', desc: '引号后不加空格' },
      { pattern: '(.)([」』])', replacement: '$1$2', desc: '引号前不加空格' }
    ];

    punctuationRules.forEach((rule, idx) => {
      db.run(
        'INSERT INTO punctuation_rules (id, pattern, replacement, priority, description) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), rule.pattern, rule.replacement, idx, rule.desc]
      );
    });
    
    saveDatabase();
  }
  
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function getDB(): Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function runQuery(sql: string, params: any[] = []): any {
  const database = getDB();
  const stmt = database.prepare(sql);
  stmt.run(params);
  saveDatabase();
}

export function getQuery(sql: string, params: any[] = []): any[] {
  const database = getDB();
  const stmt = database.prepare(sql);
  const result = stmt.getAsObject(params);
  return result as any[];
}

export function allQuery(sql: string, params: any[] = []): any[][] {
  const database = getDB();
  const result = database.exec(sql, params);
  if (result.length === 0) return [];
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  return values.map(row => {
    const obj: any = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  }) as any;
}
