const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'game.db');
const db = new sqlite3.Database(dbPath);

const DEFAULT_ACHIEVEMENTS = [
  { id: 'first_puzzle', name: '初出茅庐', description: '完成第一个谜题', icon: '🎯', points: 100, category: 'puzzles' },
  { id: 'puzzle_master', name: '谜题大师', description: '完成10个谜题', icon: '🏆', points: 500, category: 'puzzles' },
  { id: 'speed_demon', name: '速度恶魔', description: '在30秒内完成一个谜题', icon: '⚡', points: 300, category: 'speed' },
  { id: 'team_player', name: '团队合作', description: '与4名玩家一起完成游戏', icon: '👥', points: 200, category: 'social' },
  { id: 'explorer', name: '探索者', description: '发现所有隐藏物体', icon: '🔍', points: 400, category: 'puzzles' },
  { id: 'codebreaker', name: '密码破译者', description: '解开所有密码锁谜题', icon: '🔐', points: 350, category: 'puzzles' },
  { id: 'puzzle_creator', name: '创造者', description: '创建第一个自定义谜题', icon: '✨', points: 250, category: 'creator' },
  { id: 'popular_creator', name: '人气创作者', description: '谜题被游玩100次', icon: '⭐', points: 600, category: 'creator' },
  { id: 'vr_explorer', name: 'VR探索者', description: '在VR模式下完成游戏', icon: '🥽', points: 500, category: 'vr' },
  { id: 'collector', name: '收藏家', description: '解锁5个成就', icon: '🎖️', points: 150, category: 'general' }
];

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          max_players INTEGER DEFAULT 4,
          current_players INTEGER DEFAULT 0,
          status TEXT DEFAULT 'waiting',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          host_id TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS players (
          id TEXT PRIMARY KEY,
          room_id TEXT,
          name TEXT NOT NULL,
          x REAL DEFAULT 0,
          y REAL DEFAULT 0,
          color TEXT,
          is_online INTEGER DEFAULT 1,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS puzzle_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT,
          puzzle_id TEXT,
          puzzle_type TEXT,
          is_solved INTEGER DEFAULT 0,
          state TEXT,
          solved_at DATETIME,
          FOREIGN KEY (room_id) REFERENCES rooms(id),
          UNIQUE(room_id, puzzle_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS game_state (
          room_id TEXT PRIMARY KEY,
          current_scene TEXT,
          shared_camera_x REAL DEFAULT 0,
          shared_camera_y REAL DEFAULT 0,
          state TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS leaderboard (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id TEXT,
          player_name TEXT,
          puzzle_count INTEGER DEFAULT 0,
          total_time INTEGER DEFAULT 0,
          score INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES players(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS achievements (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          points INTEGER DEFAULT 0,
          category TEXT DEFAULT 'general'
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS player_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player_id TEXT,
          achievement_id TEXT,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (player_id) REFERENCES players(id),
          FOREIGN KEY (achievement_id) REFERENCES achievements(id),
          UNIQUE(player_id, achievement_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS custom_puzzles (
          id TEXT PRIMARY KEY,
          creator_id TEXT,
          creator_name TEXT,
          name TEXT NOT NULL,
          puzzle_type TEXT NOT NULL,
          config TEXT NOT NULL,
          is_public INTEGER DEFAULT 0,
          play_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES players(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS puzzle_ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          puzzle_id TEXT,
          player_id TEXT,
          rating INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (puzzle_id) REFERENCES custom_puzzles(id),
          FOREIGN KEY (player_id) REFERENCES players(id),
          UNIQUE(puzzle_id, player_id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function createRoom(roomId, roomName, maxPlayers = 4) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        INSERT INTO rooms (id, name, max_players)
        VALUES (?, ?, ?)
      `, [roomId, roomName, maxPlayers], (err) => {
        if (err) return reject(err);
        
        db.run(`
          INSERT INTO game_state (room_id, current_scene, state)
          VALUES (?, 'lobby', '{}')
        `, [roomId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });
}

function getRoom(roomId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM rooms WHERE id = ?', [roomId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function listRooms() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM rooms ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updateRoomStatus(roomId, status) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function updateRoomPlayerCount(roomId, count) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE rooms SET current_players = ? WHERE id = ?', [count, roomId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function deleteRoom(roomId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM players WHERE room_id = ?', [roomId]);
      db.run('DELETE FROM puzzle_progress WHERE room_id = ?', [roomId]);
      db.run('DELETE FROM game_state WHERE room_id = ?', [roomId]);
      db.run('DELETE FROM rooms WHERE id = ?', [roomId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function addPlayer(playerId, roomId, playerName, color) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO players (id, room_id, name, color)
      VALUES (?, ?, ?, ?)
    `, [playerId, roomId, playerName, color], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getPlayers(roomId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM players WHERE room_id = ? AND is_online = 1', [roomId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getPlayer(playerId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function updatePlayerPosition(playerId, x, y) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE players SET x = ?, y = ? WHERE id = ?', [x, y, playerId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function removePlayer(playerId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE players SET is_online = 0 WHERE id = ?', [playerId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function savePuzzleProgress(roomId, puzzleId, puzzleType, isSolved, state) {
  return new Promise((resolve, reject) => {
    const solvedAt = isSolved ? new Date().toISOString() : null;
    db.run(`
      INSERT OR REPLACE INTO puzzle_progress 
      (room_id, puzzle_id, puzzle_type, is_solved, state, solved_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [roomId, puzzleId, puzzleType, isSolved ? 1 : 0, JSON.stringify(state), solvedAt], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getPuzzleProgress(roomId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM puzzle_progress WHERE room_id = ?', [roomId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => ({
        ...row,
        state: JSON.parse(row.state || '{}'),
        is_solved: !!row.is_solved
      })));
    });
  });
}

function getGameState(roomId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM game_state WHERE room_id = ?', [roomId], (err, row) => {
      if (err) reject(err);
      else resolve(row ? {
        ...row,
        state: JSON.parse(row.state || '{}')
      } : null);
    });
  });
}

function updateGameState(roomId, updates) {
  return new Promise((resolve, reject) => {
    getGameState(roomId).then(current => {
      if (!current) return resolve();

      const newState = { ...current.state, ...updates.state };
      db.run(`
        UPDATE game_state 
        SET current_scene = COALESCE(?, current_scene),
            shared_camera_x = COALESCE(?, shared_camera_x),
            shared_camera_y = COALESCE(?, shared_camera_y),
            state = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE room_id = ?
      `, [
        updates.current_scene || null,
        updates.shared_camera_x !== undefined ? updates.shared_camera_x : null,
        updates.shared_camera_y !== undefined ? updates.shared_camera_y : null,
        JSON.stringify(newState),
        roomId
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    }).catch(reject);
  });
}

function initAchievements() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO achievements (id, name, description, icon, points, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      DEFAULT_ACHIEVEMENTS.forEach(achievement => {
        stmt.run(achievement.id, achievement.name, achievement.description, achievement.icon, achievement.points, achievement.category);
      });
      
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function getAllAchievements() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM achievements ORDER BY points ASC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getPlayerAchievements(playerId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT a.*, pa.unlocked_at 
      FROM achievements a
      LEFT JOIN player_achievements pa ON a.id = pa.achievement_id AND pa.player_id = ?
      ORDER BY a.points ASC
    `, [playerId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => ({
        ...row,
        unlocked: !!row.unlocked_at
      })));
    });
  });
}

function unlockAchievement(playerId, achievementId) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT OR IGNORE INTO player_achievements (player_id, achievement_id)
      VALUES (?, ?)
    `, [playerId, achievementId], function(err) {
      if (err) reject(err);
      else resolve(this.changes > 0);
    });
  });
}

function getLeaderboard(limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT player_id, player_name, puzzle_count, total_time, score
      FROM leaderboard
      ORDER BY score DESC
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updateLeaderboard(playerId, playerName, score, puzzleCount = 1, time = 0) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM leaderboard WHERE player_id = ?', [playerId], (err, row) => {
      if (err) return reject(err);
      
      if (row) {
        db.run(`
          UPDATE leaderboard 
          SET score = score + ?, 
              puzzle_count = puzzle_count + ?,
              total_time = total_time + ?
          WHERE player_id = ?
        `, [score, puzzleCount, time, playerId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        db.run(`
          INSERT INTO leaderboard (player_id, player_name, puzzle_count, total_time, score)
          VALUES (?, ?, ?, ?, ?)
        `, [playerId, playerName, puzzleCount, time, score], (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  });
}

function saveCustomPuzzle(puzzleId, creatorId, creatorName, name, puzzleType, config, isPublic = false) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT OR REPLACE INTO custom_puzzles 
      (id, creator_id, creator_name, name, puzzle_type, config, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [puzzleId, creatorId, creatorName, name, puzzleType, JSON.stringify(config), isPublic ? 1 : 0], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getCustomPuzzles(creatorId = null, isPublic = null) {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM custom_puzzles WHERE 1=1';
    let params = [];
    
    if (creatorId) {
      query += ' AND creator_id = ?';
      params.push(creatorId);
    }
    
    if (isPublic !== null) {
      query += ' AND is_public = ?';
      params.push(isPublic ? 1 : 0);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => ({
        ...row,
        config: JSON.parse(row.config || '{}'),
        is_public: !!row.is_public
      })));
    });
  });
}

function getCustomPuzzle(puzzleId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM custom_puzzles WHERE id = ?', [puzzleId], (err, row) => {
      if (err) reject(err);
      else if (!row) resolve(null);
      else resolve({
        ...row,
        config: JSON.parse(row.config || '{}'),
        is_public: !!row.is_public
      });
    });
  });
}

function incrementPuzzlePlayCount(puzzleId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE custom_puzzles SET play_count = play_count + 1 WHERE id = ?', [puzzleId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function ratePuzzle(puzzleId, playerId, rating) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT OR REPLACE INTO puzzle_ratings (puzzle_id, player_id, rating)
      VALUES (?, ?, ?)
    `, [puzzleId, playerId, rating], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function deleteCustomPuzzle(puzzleId, creatorId) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM custom_puzzles WHERE id = ? AND creator_id = ?', [puzzleId, creatorId], function(err) {
      if (err) reject(err);
      else resolve(this.changes > 0);
    });
  });
}

module.exports = {
  initDatabase,
  initAchievements,
  createRoom,
  getRoom,
  listRooms,
  updateRoomStatus,
  updateRoomPlayerCount,
  deleteRoom,
  addPlayer,
  getPlayers,
  getPlayer,
  updatePlayerPosition,
  removePlayer,
  savePuzzleProgress,
  getPuzzleProgress,
  getGameState,
  updateGameState,
  getAllAchievements,
  getPlayerAchievements,
  unlockAchievement,
  getLeaderboard,
  updateLeaderboard,
  saveCustomPuzzle,
  getCustomPuzzles,
  getCustomPuzzle,
  incrementPuzzlePlayCount,
  ratePuzzle,
  deleteCustomPuzzle
};
