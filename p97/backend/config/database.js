const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const userDbPath = path.join(dbDir, 'users.db');
const activityDbPath = path.join(dbDir, 'activities.db');
const interactionDbPath = path.join(dbDir, 'interactions.db');

const userDb = new sqlite3.Database(userDbPath, (err) => {
  if (err) console.error('用户数据库连接失败:', err);
  else console.log('用户数据库已连接');
});

const activityDb = new sqlite3.Database(activityDbPath, (err) => {
  if (err) console.error('活动数据库连接失败:', err);
  else console.log('活动数据库已连接');
});

const interactionDb = new sqlite3.Database(interactionDbPath, (err) => {
  if (err) console.error('互动数据库连接失败:', err);
  else console.log('互动数据库已连接');
});

function initDatabases() {
  userDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT,
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  activityDb.run(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT,
      date TEXT,
      images TEXT,
      videos TEXT,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      view_count INTEGER DEFAULT 0
    )
  `);
  
  activityDb.run(`PRAGMA table_info(activities)`, [], (err, rows) => {
    if (err) return;
    const hasVideos = rows.some(r => r.name === 'videos');
    if (!hasVideos) {
      activityDb.run(`ALTER TABLE activities ADD COLUMN videos TEXT`);
    }
  });

  interactionDb.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  interactionDb.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(activity_id, user_id)
    )
  `);

  interactionDb.run(`CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)`);
  activityDb.run(`CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id)`);
  activityDb.run(`CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category)`);
  interactionDb.run(`CREATE INDEX IF NOT EXISTS idx_comments_activity_id ON comments(activity_id)`);
  interactionDb.run(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)`);
  
  activityDb.run(`
    CREATE TABLE IF NOT EXISTS activity_steps (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      step_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  interactionDb.run(`
    CREATE TABLE IF NOT EXISTS step_qa (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      answer_user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      answered_at DATETIME
    )
  `);
  
  activityDb.run(`CREATE INDEX IF NOT EXISTS idx_activity_steps_activity_id ON activity_steps(activity_id)`);
  interactionDb.run(`CREATE INDEX IF NOT EXISTS idx_step_qa_step_id ON step_qa(step_id)`);
  interactionDb.run(`CREATE INDEX IF NOT EXISTS idx_step_qa_activity_id ON step_qa(activity_id)`);
}

initDatabases();

module.exports = { userDb, activityDb, interactionDb };
