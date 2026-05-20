require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { initializeFirebase, listenToDetections, getRecentDetections, saveQuakeEvent } = require('./firebase');
const { groupDetectionsByTime, analyzeQuakeEvent, generateHeatmapData } = require('./quakeAnalyzer');
const { 
  listQuakeEvents, 
  getQuakeEventDetails, 
  createReplayStream, 
  getReplayFrame 
} = require('./historyService');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

initializeFirebase();

const recentDetections = [];
const recentQuakeEvents = [];
const detectionTimeWindow = 120000;
const eventCooldown = 60000;
let lastEventTime = 0;

const replaySessions = new Map();

const addDetection = (detection) => {
  const now = Date.now();
  recentDetections.push({ ...detection, receivedAt: now });
  
  while (recentDetections.length > 0 && 
         now - recentDetections[0].receivedAt > detectionTimeWindow) {
    recentDetections.shift();
  }
  
  checkForQuakeEvent();
};

const checkForQuakeEvent = () => {
  const now = Date.now();
  
  if (now - lastEventTime < eventCooldown) {
    return;
  }
  
  const groups = groupDetectionsByTime(recentDetections, 45000);
  
  for (const group of groups) {
    if (group.length >= 2) {
      const uniqueDevices = new Set(group.map(d => d.deviceId));
      if (uniqueDevices.size >= 2) {
        const event = analyzeQuakeEvent(group);
        if (event && event.magnitude >= 1.0) {
          lastEventTime = now;
          recentQuakeEvents.unshift(event);
          
          if (recentQuakeEvents.length > 20) {
            recentQuakeEvents.pop();
          }
          
          saveQuakeEvent(event);
          io.emit('quakeEvent', event);
          
          console.log(`\n=== EARTHQUAKE DETECTED ===`);
          console.log(`Magnitude: ${event.magnitude}`);
          console.log(`Epicenter: ${event.epicenter.latitude.toFixed(4)}, ${event.epicenter.longitude.toFixed(4)}`);
          console.log(`Devices: ${event.deviceCount}`);
          console.log(`Location Method: ${event.locationMethod}`);
          console.log(`Time Sync Quality: ${event.timeSyncQuality}`);
          console.log(`===========================\n`);
          
          break;
        }
      }
    }
  }
};

listenToDetections((detection) => {
  console.log('New detection:', detection.deviceId, 'intensity:', detection.intensity?.toFixed(2));
  addDetection(detection);
  io.emit('detection', detection);
});

app.get('/api/detections', (req, res) => {
  res.json({
    success: true,
    data: recentDetections.slice(-100)
  });
});

app.get('/api/quake-events', (req, res) => {
  res.json({
    success: true,
    data: recentQuakeEvents
  });
});

app.get('/api/heatmap', (req, res) => {
  const latestEvent = recentQuakeEvents[0];
  const heatmapData = generateHeatmapData(
    recentDetections,
    latestEvent?.epicenter
  );
  
  res.json({
    success: true,
    data: heatmapData,
    epicenter: latestEvent?.epicenter || null,
    magnitude: latestEvent?.magnitude || 0
  });
});

app.post('/api/test-detection', (req, res) => {
  const detection = {
    id: `test_${Date.now()}`,
    deviceId: req.body.deviceId || `device_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    latitude: req.body.latitude || (31.2304 + (Math.random() - 0.5) * 0.1),
    longitude: req.body.longitude || (121.4737 + (Math.random() - 0.5) * 0.1),
    intensity: req.body.intensity || (3 + Math.random() * 5),
    staLtaRatio: req.body.staLtaRatio || (3 + Math.random() * 2)
  };
  
  addDetection(detection);
  io.emit('detection', detection);
  
  res.json({
    success: true,
    data: detection
  });
});

app.get('/api/history/events', (req, res) => {
  const events = listQuakeEvents();
  res.json({
    success: true,
    data: events
  });
});

app.get('/api/history/events/:eventId', (req, res) => {
  const event = getQuakeEventDetails(req.params.eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }
  
  res.json({
    success: true,
    data: event
  });
});

app.post('/api/replay/start', (req, res) => {
  const { eventId, speed = 1.0 } = req.body;
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const replayStream = createReplayStream(eventId, speed);
  if (!replayStream) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }
  
  replayStream.playStartTime = Date.now();
  replayStream.isPlaying = true;
  replayStream.sessionId = sessionId;
  
  replaySessions.set(sessionId, replayStream);
  
  res.json({
    success: true,
    sessionId,
    event: replayStream.event,
    totalDetections: replayStream.detections.length
  });
});

app.post('/api/replay/stop', (req, res) => {
  const { sessionId } = req.body;
  if (replaySessions.has(sessionId)) {
    replaySessions.delete(sessionId);
  }
  res.json({ success: true });
});

app.get('/api/replay/status/:sessionId', (req, res) => {
  const replayStream = replaySessions.get(req.params.sessionId);
  if (!replayStream) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  const frame = getReplayFrame(replayStream, Date.now());
  
  res.json({
    success: true,
    data: frame
  });
});

app.get('/api/export/csv/:eventId', (req, res) => {
  const event = getQuakeEventDetails(req.params.eventId);
  if (!event) {
    return res.status(404).json({
      success: false,
      error: 'Event not found'
    });
  }
  
  let csv = 'device_id,latitude,longitude,intensity,sta_lta_ratio,timestamp\n';
  event.detections.forEach(d => {
    csv += `${d.deviceId},${d.latitude},${d.longitude},${d.intensity},${d.staLtaRatio},${d.timestamp}\n`;
  });
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="quake_${event.id}.csv"`);
  res.send(csv);
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('initialData', {
    detections: recentDetections.slice(-50),
    quakeEvents: recentQuakeEvents
  });
  
  socket.on('replay:start', (data) => {
    const { eventId, speed = 1.0 } = data;
    const replayStream = createReplayStream(eventId, speed);
    
    if (!replayStream) {
      socket.emit('replay:error', { message: 'Event not found' });
      return;
    }
    
    replayStream.playStartTime = Date.now();
    replayStream.isPlaying = true;
    
    socket.emit('replay:started', {
      event: replayStream.event,
      totalDetections: replayStream.detections.length
    });
    
    const interval = setInterval(() => {
      const frame = getReplayFrame(replayStream, Date.now());
      
      if (frame) {
        frame.newDetections.forEach(d => {
          socket.emit('detection', d);
        });
        
        socket.emit('replay:progress', {
          progress: frame.progress,
          elapsed: frame.elapsed
        });
        
        if (frame.isComplete) {
          clearInterval(interval);
          socket.emit('replay:complete');
        }
      }
    }, 100);
    
    socket.on('replay:stop', () => {
      clearInterval(interval);
    });
    
    socket.on('disconnect', () => {
      clearInterval(interval);
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`\n🚀 Quake Detect Backend Server`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 Web interface: http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   - GET  /api/detections`);
  console.log(`   - GET  /api/quake-events`);
  console.log(`   - GET  /api/heatmap`);
  console.log(`   - POST /api/test-detection`);
  console.log(`   - GET  /api/history/events`);
  console.log(`   - GET  /api/history/events/:eventId`);
  console.log(`   - GET  /api/export/csv/:eventId`);
  console.log(`   - POST /api/replay/start`);
  console.log(`\n💡 Tip: Send test detections using POST /api/test-detection\n`);
});
