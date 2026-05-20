const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database('./cloud-summary.db', (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to cloud SQLite database');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS hourly_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour INTEGER NOT NULL,
      sensor_id TEXT NOT NULL,
      temp_avg REAL NOT NULL,
      temp_min REAL NOT NULL,
      temp_max REAL NOT NULL,
      humidity_avg REAL NOT NULL,
      humidity_min REAL NOT NULL,
      humidity_max REAL NOT NULL,
      data_points INTEGER NOT NULL,
      alert_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Failed to create table:', err.message);
    }
  });
}

app.post('/api/summary', (req, res) => {
  const summary = req.body;
  
  console.log('Received summary from gateway:', {
    sensor_id: summary.sensor_id,
    hour: new Date(summary.hour).toISOString(),
    data_points: summary.data_points,
    alert_count: summary.alert_count
  });

  const stmt = db.prepare(`
    INSERT INTO hourly_summaries 
    (hour, sensor_id, temp_avg, temp_min, temp_max, 
     humidity_avg, humidity_min, humidity_max, data_points, alert_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    new Date(summary.hour).getTime(),
    summary.sensor_id,
    summary.temp_avg,
    summary.temp_min,
    summary.temp_max,
    summary.humidity_avg,
    summary.humidity_min,
    summary.humidity_max,
    summary.data_points,
    summary.alert_count,
    function(err) {
      if (err) {
        console.error('Failed to save summary:', err.message);
        return res.status(500).json({ error: 'Failed to save summary' });
      }
      res.json({ status: 'success', id: this.lastID });
    }
  );
  stmt.finalize();
});

app.get('/api/summaries', (req, res) => {
  const sensorId = req.query.sensor_id;
  const limit = parseInt(req.query.limit) || 100;
  
  let query = `SELECT * FROM hourly_summaries`;
  let params = [];
  
  if (sensorId) {
    query += ` WHERE sensor_id = ?`;
    params.push(sensorId);
  }
  
  query += ` ORDER BY hour DESC LIMIT ?`;
  params.push(limit);

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Failed to fetch summaries:', err.message);
      return res.status(500).json({ error: 'Failed to fetch summaries' });
    }
    
    const summaries = rows.map(row => ({
      ...row,
      hour: new Date(row.hour).toISOString()
    }));
    
    res.json({ summaries, count: summaries.length });
  });
});

app.get('/api/sensors', (req, res) => {
  db.all(`SELECT DISTINCT sensor_id FROM hourly_summaries ORDER BY sensor_id`, (err, rows) => {
    if (err) {
      console.error('Failed to fetch sensors:', err.message);
      return res.status(500).json({ error: 'Failed to fetch sensors' });
    }
    
    const sensors = rows.map(row => row.sensor_id);
    res.json({ sensors, count: sensors.length });
  });
});

app.get('/api/summary-stats', (req, res) => {
  db.get(`SELECT COUNT(*) as total_summaries, SUM(data_points) as total_data_points, SUM(alert_count) as total_alerts FROM hourly_summaries`, (err, row) => {
    if (err) {
      console.error('Failed to fetch stats:', err.message);
      return res.status(500).json({ error: 'Failed to fetch stats' });
    }
    res.json(row);
  });
});

app.listen(PORT, () => {
  console.log(`Cloud service running on port ${PORT}`);
  console.log(`API Endpoints:`);
  console.log(`  POST /api/summary - Receive summary from gateway`);
  console.log(`  GET /api/summaries - List all summaries`);
  console.log(`  GET /api/sensors - List all sensors`);
  console.log(`  GET /api/summary-stats - Summary statistics`);
});
