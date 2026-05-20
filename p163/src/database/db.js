const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class ScoreDatabase {
  constructor() {
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = path.join(dbDir, 'scores.db');
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.db.serialize(() => {
          this.db.run(`
            CREATE TABLE IF NOT EXISTS scores (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              notes TEXT NOT NULL,
              midi_events TEXT,
              image_paths TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);
          
          this.db.run(`
            CREATE TABLE IF NOT EXISTS play_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              score_id INTEGER NOT NULL,
              played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              duration REAL,
              FOREIGN KEY (score_id) REFERENCES scores (id) ON DELETE CASCADE
            )
          `);
          
          resolve();
        });
      });
    });
  }

  saveScore(scoreData) {
    return new Promise((resolve, reject) => {
      const { name, notes, midiEvents, imagePaths } = scoreData;
      
      if (scoreData.id) {
        const stmt = this.db.prepare(`
          UPDATE scores 
          SET name = ?, notes = ?, midi_events = ?, image_paths = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        stmt.run(name, JSON.stringify(notes), JSON.stringify(midiEvents), JSON.stringify(imagePaths), scoreData.id, function(err) {
          if (err) reject(err);
          else resolve({ id: scoreData.id, changes: this.changes });
        });
        stmt.finalize();
      } else {
        const stmt = this.db.prepare(`
          INSERT INTO scores (name, notes, midi_events, image_paths)
          VALUES (?, ?, ?, ?)
        `);
        
        stmt.run(name, JSON.stringify(notes), JSON.stringify(midiEvents), JSON.stringify(imagePaths), function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        });
        stmt.finalize();
      }
    });
  }

  getScores() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id, name, created_at, updated_at FROM scores ORDER BY updated_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  getScore(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM scores WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            notes: JSON.parse(row.notes),
            midiEvents: row.midi_events ? JSON.parse(row.midi_events) : null,
            imagePaths: row.image_paths ? JSON.parse(row.image_paths) : null
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  deleteScore(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM scores WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  savePlayRecord(record) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO play_records (score_id, duration)
        VALUES (?, ?)
      `);
      
      stmt.run(record.scoreId, record.duration, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
      stmt.finalize();
    });
  }

  getPlayRecords(scoreId) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM play_records 
        WHERE score_id = ? 
        ORDER BY played_at DESC
        LIMIT 50
      `, [scoreId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = ScoreDatabase;
