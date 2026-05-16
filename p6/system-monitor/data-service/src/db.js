const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'monitor.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    cpu_usage REAL,
    memory_usage REAL,
    memory_total INTEGER,
    memory_used INTEGER,
    disk_usage REAL,
    disk_read_rate REAL,
    disk_write_rate REAL,
    network_rx_rate REAL,
    network_tx_rate REAL
  );

  CREATE TABLE IF NOT EXISTS process_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    process_name TEXT,
    pid INTEGER,
    cpu_usage REAL,
    memory_usage REAL
  );

  CREATE INDEX IF NOT EXISTS idx_system_timestamp ON system_metrics(timestamp);
  CREATE INDEX IF NOT EXISTS idx_process_timestamp ON process_metrics(timestamp);
`);

function insertSystemMetrics(metrics) {
  const stmt = db.prepare(`
    INSERT INTO system_metrics (
      timestamp, cpu_usage, memory_usage, memory_total, memory_used,
      disk_usage, disk_read_rate, disk_write_rate, network_rx_rate, network_tx_rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    metrics.timestamp,
    metrics.cpuUsage,
    metrics.memoryUsage,
    metrics.memoryTotal,
    metrics.memoryUsed,
    metrics.diskUsage,
    metrics.diskReadRate,
    metrics.diskWriteRate,
    metrics.networkRxRate,
    metrics.networkTxRate
  );
}

function insertProcessMetrics(processList) {
  const stmt = db.prepare(`
    INSERT INTO process_metrics (timestamp, process_name, pid, cpu_usage, memory_usage)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((processes) => {
    for (const p of processes) {
      stmt.run(p.timestamp, p.name, p.pid, p.cpuUsage, p.memoryUsage);
    }
  });
  insertMany(processList);
}

function querySystemMetrics(startTime, endTime) {
  const stmt = db.prepare(`
    SELECT * FROM system_metrics
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
  `);
  return stmt.all(startTime, endTime);
}

function queryProcessMetrics(startTime, endTime, processName = null) {
  let sql = `SELECT * FROM process_metrics WHERE timestamp >= ? AND timestamp <= ?`;
  const params = [startTime, endTime];
  if (processName) {
    sql += ` AND process_name LIKE ?`;
    params.push(`%${processName}%`);
  }
  sql += ` ORDER BY timestamp ASC`;
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function cleanupOldData(retentionDays) {
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const stmt1 = db.prepare(`DELETE FROM system_metrics WHERE timestamp < ?`);
  const stmt2 = db.prepare(`DELETE FROM process_metrics WHERE timestamp < ?`);
  const result1 = stmt1.run(cutoffTime);
  const result2 = stmt2.run(cutoffTime);
  return {
    systemDeleted: result1.changes,
    processDeleted: result2.changes
  };
}

module.exports = {
  insertSystemMetrics,
  insertProcessMetrics,
  querySystemMetrics,
  queryProcessMetrics,
  cleanupOldData
};
