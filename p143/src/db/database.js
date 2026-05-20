const Database = require('better-sqlite3');
const path = require('path');
const XLSX = require('xlsx');

class AccessDatabase {
  constructor(dbPath = null) {
    const dbFile = dbPath || path.join(process.cwd(), 'access-control.db');
    this.db = new Database(dbFile);
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        card_type TEXT NOT NULL,
        holder_name TEXT,
        key_a TEXT,
        key_b TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_uid TEXT NOT NULL,
        card_type TEXT,
        holder_name TEXT,
        access_result TEXT NOT NULL,
        door_id INTEGER,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS doors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'LOCKED',
        last_access_at DATETIME,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS door_interlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        door_id_1 INTEGER NOT NULL,
        door_id_2 INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(door_id_1, door_id_2)
      );

      CREATE TABLE IF NOT EXISTS time_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        days TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON access_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_cards_uid ON cards(uid);
      CREATE INDEX IF NOT EXISTS idx_door_interlocks ON door_interlocks(door_id_1, door_id_2);
      CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
    `);

    const cardCount = this.db.prepare('SELECT COUNT(*) as count FROM cards').get();
    if (cardCount.count === 0) {
      const defaultCards = [
        { uid: 'AABBCCDD', card_type: 'MIFARE_CLASSIC', holder_name: '管理员', key_a: 'FFFFFFFFFFFF', key_b: 'FFFFFFFFFFFF' },
        { uid: '11223344', card_type: 'DESFIRE', holder_name: '测试用户', key_a: '000000000000', key_b: '000000000000' }
      ];

      const insert = this.db.prepare(`
        INSERT INTO cards (uid, card_type, holder_name, key_a, key_b)
        VALUES (?, ?, ?, ?, ?)
      `);

      defaultCards.forEach(card => {
        insert.run(card.uid, card.card_type, card.holder_name, card.key_a, card.key_b);
      });
    }

    const doorCount = this.db.prepare('SELECT COUNT(*) as count FROM doors').get();
    if (doorCount.count === 0) {
      const defaultDoors = [
        { name: '大门', description: '主入口' },
        { name: '后门', description: '次入口' },
        { name: '机房门', description: '服务器机房' }
      ];

      const insert = this.db.prepare(`
        INSERT INTO doors (name, description)
        VALUES (?, ?)
      `);

      defaultDoors.forEach(door => {
        insert.run(door.name, door.description);
      });
    }

    const scheduleCount = this.db.prepare('SELECT COUNT(*) as count FROM time_schedules').get();
    if (scheduleCount.count === 0) {
      const defaultSchedules = [
        { name: '工作时段', description: '工作日9:00-18:00', start_time: '09:00', end_time: '18:00', days: '1,2,3,4,5' }
      ];

      const insert = this.db.prepare(`
        INSERT INTO time_schedules (name, description, start_time, end_time, days)
        VALUES (?, ?, ?, ?, ?)
      `);

      defaultSchedules.forEach(schedule => {
        insert.run(schedule.name, schedule.description, schedule.start_time, schedule.end_time, schedule.days);
      });
    }
  }

  getAllCards() {
    return this.db.prepare('SELECT * FROM cards ORDER BY created_at DESC').all();
  }

  getCardByUid(uid) {
    return this.db.prepare('SELECT * FROM cards WHERE uid = ? AND is_active = 1').get(uid);
  }

  addCard(card) {
    const stmt = this.db.prepare(`
      INSERT INTO cards (uid, card_type, holder_name, key_a, key_b)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(card.uid, card.card_type, card.holder_name || '', card.key_a || '', card.key_b || '');
    return { id: result.lastInsertRowid, ...card };
  }

  deleteCard(id) {
    const stmt = this.db.prepare('DELETE FROM cards WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  updateCard(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.holder_name !== undefined) {
      fields.push('holder_name = ?');
      values.push(updates.holder_name);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    const stmt = this.db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  addLog(log) {
    const stmt = this.db.prepare(`
      INSERT INTO access_logs (card_uid, card_type, holder_name, access_result, door_id, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(log.card_uid, log.card_type || '', log.holder_name || '', log.access_result, log.door_id || 1, log.reason || '');
    return { id: result.lastInsertRowid, ...log };
  }

  getLogs(limit = 100) {
    return this.db.prepare('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
  }

  getAllDoors() {
    return this.db.prepare('SELECT * FROM doors ORDER BY id').all();
  }

  getDoorById(id) {
    return this.db.prepare('SELECT * FROM doors WHERE id = ?').get(id);
  }

  updateDoorStatus(id, status) {
    const stmt = this.db.prepare('UPDATE doors SET status = ?, last_access_at = CURRENT_TIMESTAMP WHERE id = ?');
    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  addDoor(door) {
    const stmt = this.db.prepare('INSERT INTO doors (name, description) VALUES (?, ?)');
    const result = stmt.run(door.name, door.description || '');
    return { id: result.lastInsertRowid, ...door };
  }

  deleteDoor(id) {
    const stmt = this.db.prepare('DELETE FROM doors WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getAllInterlocks() {
    return this.db.prepare(`
      SELECT di.*, d1.name as door_name_1, d2.name as door_name_2 
      FROM door_interlocks di
      JOIN doors d1 ON di.door_id_1 = d1.id
      JOIN doors d2 ON di.door_id_2 = d2.id
      WHERE di.is_active = 1
    `).all();
  }

  addInterlock(interlock) {
    const stmt = this.db.prepare(`
      INSERT INTO door_interlocks (door_id_1, door_id_2)
      VALUES (?, ?)
    `);
    try {
      const result = stmt.run(interlock.door_id_1, interlock.door_id_2);
      return { id: result.lastInsertRowid, ...interlock };
    } catch (e) {
      throw new Error('该互锁规则已存在');
    }
  }

  deleteInterlock(id) {
    const stmt = this.db.prepare('DELETE FROM door_interlocks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getInterlockedDoors(doorId) {
    return this.db.prepare(`
      SELECT door_id_2 as door_id FROM door_interlocks WHERE door_id_1 = ? AND is_active = 1
      UNION
      SELECT door_id_1 as door_id FROM door_interlocks WHERE door_id_2 = ? AND is_active = 1
    `).all(doorId, doorId);
  }

  getAllSchedules() {
    return this.db.prepare('SELECT * FROM time_schedules ORDER BY id').all();
  }

  addSchedule(schedule) {
    const stmt = this.db.prepare(`
      INSERT INTO time_schedules (name, description, start_time, end_time, days)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(schedule.name, schedule.description || '', schedule.start_time, schedule.end_time, schedule.days);
    return { id: result.lastInsertRowid, ...schedule };
  }

  updateSchedule(id, schedule) {
    const stmt = this.db.prepare(`
      UPDATE time_schedules 
      SET name = ?, description = ?, start_time = ?, end_time = ?, days = ?, is_active = ?
      WHERE id = ?
    `);
    const result = stmt.run(schedule.name, schedule.description || '', schedule.start_time, schedule.end_time, schedule.days, schedule.is_active ?? 1, id);
    return result.changes > 0;
  }

  deleteSchedule(id) {
    const stmt = this.db.prepare('DELETE FROM time_schedules WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  isWithinSchedule() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);

    const schedules = this.db.prepare('SELECT * FROM time_schedules WHERE is_active = 1').all();

    if (schedules.length === 0) return true;

    return schedules.some(schedule => {
      const days = schedule.days.split(',').map(Number);
      if (!days.includes(dayOfWeek)) return false;
      return currentTime >= schedule.start_time && currentTime <= schedule.end_time;
    });
  }

  getAllHolidays() {
    return this.db.prepare('SELECT * FROM holidays ORDER BY date').all();
  }

  addHoliday(holiday) {
    const stmt = this.db.prepare('INSERT INTO holidays (date, name) VALUES (?, ?)');
    try {
      const result = stmt.run(holiday.date, holiday.name || '');
      return { id: result.lastInsertRowid, ...holiday };
    } catch (e) {
      throw new Error('该日期已设置为节假日');
    }
  }

  deleteHoliday(id) {
    const stmt = this.db.prepare('DELETE FROM holidays WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  isTodayHoliday() {
    const today = new Date().toISOString().split('T')[0];
    const holiday = this.db.prepare('SELECT * FROM holidays WHERE date = ?').get(today);
    return !!holiday;
  }

  canAccessNow() {
    if (this.isTodayHoliday()) {
      return { allowed: false, reason: '今日为节假日' };
    }
    if (!this.isWithinSchedule()) {
      return { allowed: false, reason: '非工作时段' };
    }
    return { allowed: true };
  }

  exportLogsToExcel(limit = 1000) {
    const logs = this.db.prepare('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT ?').all(limit);
    
    const formattedLogs = logs.map(log => ({
      'ID': log.id,
      '卡号': log.card_uid,
      '卡类型': log.card_type,
      '持卡人': log.holder_name,
      '门ID': log.door_id,
      '访问结果': log.access_result === 'GRANTED' ? '允许' : '拒绝',
      '原因': log.reason,
      '时间': log.timestamp
    }));

    const ws = XLSX.utils.json_to_sheet(formattedLogs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '门禁记录');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  close() {
    this.db.close();
  }
}

module.exports = AccessDatabase;
