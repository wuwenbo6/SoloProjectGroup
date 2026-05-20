const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    const dbPath = path.join(__dirname, '../data/sessions.db');
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initTables();
      }
    });
  }

  initTables() {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  saveSession(id, data) {
    return new Promise((resolve, reject) => {
      const jsonData = JSON.stringify(data);
      this.db.get('SELECT id FROM sessions WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          this.db.run(
            'UPDATE sessions SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [jsonData, id],
            (err) => err ? reject(err) : resolve()
          );
        } else {
          this.db.run(
            'INSERT INTO sessions (id, data) VALUES (?, ?)',
            [id, jsonData],
            (err) => err ? reject(err) : resolve()
          );
        }
      });
    });
  }

  getSession(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM sessions WHERE id = ?', [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            id: row.id,
            ...JSON.parse(row.data),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  getAllSessions() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM sessions ORDER BY updated_at DESC', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            id: row.id,
            ...JSON.parse(row.data),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          })));
        }
      });
    });
  }

  deleteSession(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM sessions WHERE id = ?', [id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports = Database;
