const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '../data/history');

if (!fs.existsSync(historyDir)) {
  fs.mkdirSync(historyDir, { recursive: true });
}

const sampleEarthquakes = [
  {
    id: 'sample_2008_wenchuan',
    name: '2008汶川地震模拟',
    magnitude: 8.0,
    epicenter: { latitude: 31.021, longitude: 103.367 },
    timestamp: Date.now() - 86400000 * 365 * 16,
    description: '模拟汶川特大地震',
    detections: generateMockDetections(31.021, 103.367, 8.0, 20)
  },
  {
    id: 'sample_2011_tohoku',
    name: '2011东日本大地震模拟',
    magnitude: 9.0,
    epicenter: { latitude: 38.322, longitude: 142.369 },
    timestamp: Date.now() - 86400000 * 365 * 15,
    description: '模拟东日本大地震',
    detections: generateMockDetections(38.322, 142.369, 9.0, 30)
  },
  {
    id: 'sample_2010_yushu',
    name: '2010玉树地震模拟',
    magnitude: 7.1,
    epicenter: { latitude: 33.007, longitude: 96.909 },
    timestamp: Date.now() - 86400000 * 365 * 14,
    description: '模拟玉树地震',
    detections: generateMockDetections(33.007, 96.909, 7.1, 15)
  },
  {
    id: 'sample_local_1',
    name: '上海附近M4.5地震',
    magnitude: 4.5,
    epicenter: { latitude: 31.230, longitude: 121.474 },
    timestamp: Date.now() - 86400000 * 7,
    description: '模拟上海附近区域地震',
    detections: generateMockDetections(31.230, 121.474, 4.5, 8)
  },
  {
    id: 'sample_local_2',
    name: '苏州附近M3.8地震',
    magnitude: 3.8,
    epicenter: { latitude: 31.299, longitude: 120.585 },
    timestamp: Date.now() - 86400000 * 3,
    description: '模拟苏州附近小地震',
    detections: generateMockDetections(31.299, 120.585, 3.8, 6)
  }
];

function generateMockDetections(lat, lon, magnitude, count) {
  const detections = [];
  const P_WAVE_VELOCITY = 5.0;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const distance = (Math.random() * 0.5 + 0.1) * magnitude;
    
    const deviceLat = lat + Math.cos(angle) * distance * 0.01;
    const deviceLon = lon + Math.sin(angle) * distance * 0.01;
    
    const actualDistance = distance * 10;
    const travelTime = (actualDistance / P_WAVE_VELOCITY) * 1000;
    const clockOffset = (Math.random() - 0.5) * 1000;
    
    const intensity = Math.max(1, magnitude * (1 - distance * 0.08));
    
    detections.push({
      deviceId: `device_${String(i + 1).padStart(3, '0')}`,
      latitude: deviceLat,
      longitude: deviceLon,
      intensity: intensity,
      timestamp: Date.now() + travelTime + clockOffset,
      staLtaRatio: 3 + Math.random() * 3
    });
  }
  
  return detections;
}

function saveQuakeEvent(event) {
  const filePath = path.join(historyDir, `${event.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(event, null, 2));
  return event;
}

function loadQuakeEvent(eventId) {
  const filePath = path.join(historyDir, `${eventId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return null;
}

function listQuakeEvents() {
  const events = [];
  
  sampleEarthquakes.forEach(eq => {
    events.push({
      id: eq.id,
      name: eq.name,
      magnitude: eq.magnitude,
      epicenter: eq.epicenter,
      timestamp: eq.timestamp,
      description: eq.description,
      detectionCount: eq.detections.length,
      isSample: true
    });
  });
  
  if (fs.existsSync(historyDir)) {
    const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
    files.forEach(file => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
        events.push({
          id: data.id,
          name: `M${data.magnitude.toFixed(1)} 地震`,
          magnitude: data.magnitude,
          epicenter: data.epicenter,
          timestamp: data.timestamp,
          detectionCount: data.detections?.length || 0,
          isSample: false
        });
      } catch (e) {
        console.error('Error loading history file:', file, e);
      }
    });
  }
  
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function getQuakeEventDetails(eventId) {
  const sample = sampleEarthquakes.find(e => e.id === eventId);
  if (sample) {
    return sample;
  }
  return loadQuakeEvent(eventId);
}

function createReplayStream(eventId, speed = 1.0) {
  const event = getQuakeEventDetails(eventId);
  if (!event) {
    return null;
  }
  
  const sortedDetections = [...event.detections].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sortedDetections[0].timestamp;
  
  return {
    event,
    detections: sortedDetections,
    startTime,
    speed,
    currentIndex: 0,
    isPlaying: false,
    isPaused: false
  };
}

function getReplayFrame(replayStream, currentRealtime) {
  if (!replayStream || !replayStream.isPlaying) return null;
  
  const elapsed = (currentRealtime - replayStream.playStartTime) * replayStream.speed;
  const targetEventTime = replayStream.startTime + elapsed;
  
  const newDetections = [];
  while (
    replayStream.currentIndex < replayStream.detections.length &&
    replayStream.detections[replayStream.currentIndex].timestamp <= targetEventTime
  ) {
    newDetections.push(replayStream.detections[replayStream.currentIndex]);
    replayStream.currentIndex++;
  }
  
  const isComplete = replayStream.currentIndex >= replayStream.detections.length;
  
  return {
    newDetections,
    progress: replayStream.currentIndex / replayStream.detections.length,
    isComplete,
    elapsed
  };
}

module.exports = {
  sampleEarthquakes,
  saveQuakeEvent,
  loadQuakeEvent,
  listQuakeEvents,
  getQuakeEventDetails,
  createReplayStream,
  getReplayFrame
};
