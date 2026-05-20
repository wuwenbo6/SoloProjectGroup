
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'sensor.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

const initTables = () => {
    const hasConfig = db.prepare('SELECT COUNT(*) as count FROM alert_config').get() as { count: number };
    if (hasConfig.count === 0) {
        db.exec(`
            INSERT INTO alert_config (sensor_type, min_threshold, max_threshold, enabled) VALUES
                ('temperature', 22, 28, 1),
                ('humidity', 45, 75, 1),
                ('salinity', 25, 35, 1),
                ('ph', 6.5, 7.5, 1);
        `);
    }

    db.exec(`
        CREATE TABLE IF NOT EXISTS sensor_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            temperature REAL NOT NULL,
            humidity REAL NOT NULL,
            salinity REAL NOT NULL,
            ph REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS alert_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_type TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            current_value REAL NOT NULL,
            threshold_value REAL NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS alert_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_type TEXT UNIQUE NOT NULL,
            min_threshold REAL NOT NULL,
            max_threshold REAL NOT NULL,
            enabled BOOLEAN DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sensor_data_created_at ON sensor_data(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_alert_records_created_at ON alert_records(created_at DESC);
    `);
};

initTables();

export default db;

