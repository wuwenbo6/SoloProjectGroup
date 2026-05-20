const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

class ServerApp {
  constructor(db, accessControl) {
    this.db = db;
    this.accessControl = accessControl;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
    this.setupAccessControlEvents();
  }

  setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: false
    }));
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupAccessControlEvents() {
    this.accessControl.on('door-opened', (data) => {
      this.io.emit('door-state-changed', { doorId: data.doorId, state: 'OPEN' });
    });
    
    this.accessControl.on('door-locked', (data) => {
      this.io.emit('door-state-changed', { doorId: data.doorId, state: 'LOCKED' });
    });
  }

  setupRoutes() {
    this.app.get('/api/cards', (req, res) => {
      try {
        const cards = this.db.getAllCards();
        res.json({ success: true, data: cards });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/cards', (req, res) => {
      try {
        const { uid, card_type, holder_name, key_a, key_b } = req.body;
        
        if (!uid || !card_type) {
          return res.status(400).json({ 
            success: false, 
            error: 'UID和卡片类型为必填项' 
          });
        }

        const card = this.db.addCard({
          uid: uid.toUpperCase(),
          card_type,
          holder_name: holder_name || '',
          key_a: key_a || '',
          key_b: key_b || ''
        });
        
        this.io.emit('card-added', card);
        res.json({ success: true, data: card });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/cards/:id', async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = await this.accessControl.removeCard(id);
        
        if (deleted) {
          this.io.emit('card-deleted', { id });
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '卡片不存在' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/logs', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 100;
        const logs = this.db.getLogs(limit);
        res.json({ success: true, data: logs });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/logs/export', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 1000;
        const buffer = this.db.exportLogsToExcel(limit);
        
        res.setHeader('Content-Disposition', `attachment; filename=access_logs_${new Date().toISOString().split('T')[0]}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/verify', async (req, res) => {
      try {
        const doorId = req.body.doorId || 1;
        const result = await this.accessControl.verifyCard(req.body, doorId);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/simulate', (req, res) => {
      try {
        const { uid, cardType, keyA, keyB, doorId } = req.body;
        const cardData = {
          uid: uid || 'AABBCCDD',
          cardType: cardType || 'MIFARE_CLASSIC',
          keyA: keyA || 'FFFFFFFFFFFF',
          keyB: keyB || 'FFFFFFFFFFFF'
        };
        
        this.accessControl.verifyCard(cardData, doorId || 1).then(result => {
          if (result.granted) {
            this.io.emit('access-granted', result);
          } else {
            this.io.emit('access-denied', result);
          }
        });

        res.json({ success: true, message: '模拟刷卡已发送' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/stats', (req, res) => {
      try {
        const cards = this.db.getAllCards();
        const logs = this.db.getLogs(1000);
        
        const today = new Date().toISOString().split('T')[0];
        const todayAccesses = logs.filter(log => 
          log.timestamp.startsWith(today) && log.access_result === 'GRANTED'
        ).length;

        const stats = {
          totalCards: cards.length,
          activeCards: cards.filter(c => c.is_active).length,
          todayAccesses,
          totalAccesses: logs.length,
          grantedCount: logs.filter(l => l.access_result === 'GRANTED').length,
          deniedCount: logs.filter(l => l.access_result === 'DENIED').length
        };

        res.json({ success: true, data: stats });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/doors', (req, res) => {
      try {
        const doors = this.accessControl.getAllDoors();
        res.json({ success: true, data: doors });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/doors', (req, res) => {
      try {
        const { name, description } = req.body;
        if (!name) {
          return res.status(400).json({ success: false, error: '门名称为必填项' });
        }
        const door = this.db.addDoor({ name, description });
        this.io.emit('door-added', door);
        res.json({ success: true, data: door });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/doors/:id', (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = this.db.deleteDoor(id);
        if (deleted) {
          this.io.emit('door-deleted', { id });
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '门不存在' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/interlocks', (req, res) => {
      try {
        const interlocks = this.db.getAllInterlocks();
        res.json({ success: true, data: interlocks });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/interlocks', (req, res) => {
      try {
        const { door_id_1, door_id_2 } = req.body;
        if (!door_id_1 || !door_id_2) {
          return res.status(400).json({ success: false, error: '门ID为必填项' });
        }
        const interlock = this.db.addInterlock({ door_id_1, door_id_2 });
        this.io.emit('interlock-added', interlock);
        res.json({ success: true, data: interlock });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/interlocks/:id', (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = this.db.deleteInterlock(id);
        if (deleted) {
          this.io.emit('interlock-deleted', { id });
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '互锁规则不存在' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/schedules', (req, res) => {
      try {
        const schedules = this.db.getAllSchedules();
        res.json({ success: true, data: schedules });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/schedules', (req, res) => {
      try {
        const { name, description, start_time, end_time, days } = req.body;
        if (!name || !start_time || !end_time || !days) {
          return res.status(400).json({ success: false, error: '名称、开始时间、结束时间和星期为必填项' });
        }
        const schedule = this.db.addSchedule({ name, description, start_time, end_time, days });
        this.io.emit('schedule-added', schedule);
        res.json({ success: true, data: schedule });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.put('/api/schedules/:id', (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updated = this.db.updateSchedule(id, req.body);
        if (updated) {
          this.io.emit('schedule-updated', { id, ...req.body });
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '时段不存在' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/schedules/:id', (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = this.db.deleteSchedule(id);
        if (deleted) {
          this.io.emit('schedule-deleted', { id });
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '时段不存在' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/holidays', (req, res) => {
      try {
        const holidays = this.db.getAllHolidays();
        res.json({ success: true, data: holidays });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/holidays', (req, res) => {
      try {
        const { date, name } = req.body;
        if (!date) {
          return res.status(400).json({ success: false, error: '日期为必填项' });
        }
        const holiday = this.db.addHoliday({ date, name });
        this.io.emit('holiday-added', holiday);
        res.json({ success: true, data: holiday });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/holidays/:id', (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const deleted = this.db.deleteHoliday(id);
        if (deleted) {
          this.io.emit('holiday-deleted', { id });
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '节假日不存在' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/can-access-now', (req, res) => {
      try {
        const result = this.db.canAccessNow();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  setupSocketIO() {
    this.io.on('connection', (socket) => {
      console.log('客户端已连接:', socket.id);

      socket.on('disconnect', () => {
        console.log('客户端已断开:', socket.id);
      });

      socket.on('simulate-card', (cardData) => {
        this.accessControl.verifyCard(cardData, cardData.doorId || 1).then(result => {
          if (result.granted) {
            this.io.emit('access-granted', result);
          } else {
            this.io.emit('access-denied', result);
          }
        });
      });
    });
  }

  broadcast(event, data) {
    this.io.emit(event, data);
  }

  start(port = 3000) {
    this.server.listen(port, () => {
      console.log(`服务器运行在 http://localhost:${port}`);
    });
  }

  stop() {
    this.server.close();
  }
}

if (require.main === module) {
  const Database = require('../db/database');
  const AccessControl = require('../access/control');
  
  const db = new Database();
  db.init();
  
  const accessControl = new AccessControl(db);
  const server = new ServerApp(db, accessControl);
  server.start(3000);
}

module.exports = ServerApp;
