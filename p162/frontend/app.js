const socket = io();
let map;
let heatLayer;
let markers = [];
let detectionCount = 0;
let uniqueDevices = new Set();
let maxIntensity = 0;
let currentQuakeEvents = [];
let isReplaying = false;
let currentEventId = null;

function initMap() {
    map = L.map('map').setView([31.2304, 121.4737], 11);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
    }).addTo(map);
    
    heatLayer = L.heatLayer([], {
        radius: 40,
        blur: 30,
        maxZoom: 10,
        max: 1.0,
        gradient: {
            0.2: '#10b981',
            0.5: '#f59e0b',
            0.8: '#ef4444',
            1.0: '#dc2626'
        }
    }).addTo(map);
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    const text = document.getElementById('connectionText');
    
    indicator.className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');
    text.textContent = connected ? '已连接' : '已断开';
}

function updateStats() {
    document.getElementById('deviceCount').textContent = uniqueDevices.size;
    document.getElementById('detectionCount').textContent = detectionCount;
    document.getElementById('maxIntensity').textContent = maxIntensity.toFixed(1);
}

function addMarker(latitude, longitude, intensity, deviceId) {
    const color = intensity < 3 ? '#10b981' : intensity < 6 ? '#f59e0b' : '#ef4444';
    
    const marker = L.circleMarker([latitude, longitude], {
        radius: 8 + intensity,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.4
    }).addTo(map);
    
    marker.bindPopup(`
        <div style="color: #fff;">
            <strong>设备: ${deviceId.substring(0, 8)}...</strong><br>
            烈度: ${intensity.toFixed(1)}<br>
            坐标: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
        </div>
    `);
    
    markers.push({ marker, time: Date.now() });
    
    heatLayer.addLatLng([latitude, longitude, intensity / 10]);
}

function addEpicenterMarker(latitude, longitude, magnitude) {
    const epicenterIcon = L.divIcon({
        className: 'epicenter-marker',
        html: `<div style="
            width: 40px;
            height: 40px;
            background: radial-gradient(circle, #dc2626 0%, transparent 70%);
            border-radius: 50%;
            animation: pulse-epicenter 1s infinite;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            text-shadow: 0 0 4px rgba(0,0,0,0.5);
        ">${magnitude.toFixed(1)}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    const marker = L.marker([latitude, longitude], { icon: epicenterIcon }).addTo(map);
    marker.bindPopup(`
        <div style="color: #fff;">
            <strong>🌋 震中</strong><br>
            震级: ${magnitude.toFixed(1)}<br>
            坐标: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}
        </div>
    `);
    
    markers.push({ marker, time: Date.now(), isEpicenter: true });
}

function updateEventsList(events) {
    const list = document.getElementById('eventsList');
    currentQuakeEvents = events;
    
    if (events.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无地震事件</div>';
        document.getElementById('exportBtn').style.display = 'none';
        return;
    }
    
    document.getElementById('exportBtn').style.display = 'inline-block';
    
    list.innerHTML = events.map((event, index) => `
        <div class="event-item" data-event-id="${event.id}">
            <div class="event-header">
                <span class="event-magnitude">M${event.magnitude.toFixed(1)}</span>
                <span class="event-time">${formatTime(event.timestamp)}</span>
            </div>
            <div class="event-details">
                <span>📍 ${event.epicenter.latitude.toFixed(4)}, ${event.epicenter.longitude.toFixed(4)}</span>
                <span>📱 ${event.deviceCount} 台设备</span>
            </div>
            <div class="event-actions">
                <button class="btn-small" onclick="replayEvent('${event.id}')">▶️ 回放</button>
                <button class="btn-small" onclick="exportEventCsv('${event.id}')">📥 CSV</button>
            </div>
        </div>
    `).join('');
}

function showAlert(event) {
    const banner = document.getElementById('alertBanner');
    const text = document.getElementById('alertText');
    
    text.textContent = `地震预警！检测到 M${event.magnitude.toFixed(1)} 级地震，请注意安全！`;
    banner.style.display = 'flex';
    
    if (event.epicenter) {
        map.panTo([event.epicenter.latitude, event.epicenter.longitude]);
    }
    
    setTimeout(() => {
        banner.style.display = 'none';
    }, 10000);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function cleanupOldMarkers() {
    const now = Date.now();
    const cutoff = now - 120000;
    
    markers = markers.filter(item => {
        if (item.time < cutoff && !item.isEpicenter) {
            map.removeLayer(item.marker);
            return false;
        }
        return true;
    });
}

function clearAllMarkers() {
    markers.forEach(item => {
        map.removeLayer(item.marker);
    });
    markers = [];
    heatLayer.setLatLngs([]);
}

async function loadHistoryEvents() {
    try {
        const response = await fetch('/api/history/events');
        const data = await response.json();
        
        const list = document.getElementById('historyList');
        
        if (!data.success || data.data.length === 0) {
            list.innerHTML = '<div class="empty-state">暂无历史震例</div>';
            return;
        }
        
        list.innerHTML = data.data.map(event => `
            <div class="history-item ${event.isSample ? 'sample' : ''}">
                <div class="history-item-header">
                    <div>
                        <span class="history-magnitude">M${event.magnitude.toFixed(1)}</span>
                        <span class="history-name">
                            ${event.name}
                            ${event.isSample ? '<span class="badge badge-sample">示例</span>' : ''}
                        </span>
                    </div>
                </div>
                <div class="history-details">
                    <span>📅 ${formatDate(event.timestamp)}</span>
                    <span>📍 ${event.epicenter.latitude.toFixed(2)}, ${event.epicenter.longitude.toFixed(2)}</span>
                    <span>📱 ${event.detectionCount} 检测点</span>
                </div>
                <div class="history-actions">
                    <button class="btn-small" onclick="startHistoryReplay('${event.id}')">▶️ 开始回放</button>
                    <button class="btn-small" onclick="locateToEvent(${event.epicenter.latitude}, ${event.epicenter.longitude})">🔍 定位</button>
                    <button class="btn-small" onclick="exportEventCsv('${event.id}')">📥 CSV</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Failed to load history:', error);
        document.getElementById('historyList').innerHTML = 
            '<div class="empty-state">加载失败</div>';
    }
}

function startHistoryReplay(eventId) {
    closeHistoryModal();
    startReplay(eventId);
}

function replayEvent(eventId) {
    startReplay(eventId);
}

function startReplay(eventId) {
    if (isReplaying) {
        stopReplay();
    }
    
    isReplaying = true;
    currentEventId = eventId;
    clearAllMarkers();
    uniqueDevices.clear();
    detectionCount = 0;
    maxIntensity = 0;
    updateStats();
    
    document.getElementById('replayControls').style.display = 'flex';
    document.getElementById('replayInfo').textContent = '回放准备中...';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    
    socket.emit('replay:start', { eventId, speed: 1.0 });
}

function stopReplay() {
    socket.emit('replay:stop');
    isReplaying = false;
    currentEventId = null;
    document.getElementById('replayControls').style.display = 'none';
}

function locateToEvent(lat, lon) {
    closeHistoryModal();
    map.setView([lat, lon], 12);
}

async function exportEventCsv(eventId) {
    try {
        const link = document.createElement('a');
        link.href = `/api/export/csv/${eventId}`;
        link.download = `quake_${eventId}.csv`;
        link.click();
    } catch (error) {
        console.error('Export failed:', error);
    }
}

function openHistoryModal() {
    document.getElementById('historyModal').style.display = 'flex';
    loadHistoryEvents();
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
});

socket.on('initialData', (data) => {
    console.log('Initial data:', data);
    
    data.detections.forEach(detection => {
        uniqueDevices.add(detection.deviceId);
        detectionCount++;
        if (detection.intensity > maxIntensity) {
            maxIntensity = detection.intensity;
        }
        addMarker(detection.latitude, detection.longitude, detection.intensity, detection.deviceId);
    });
    
    updateStats();
    updateEventsList(data.quakeEvents);
    
    if (data.quakeEvents.length > 0) {
        const latest = data.quakeEvents[0];
        document.getElementById('lastMagnitude').textContent = 'M' + latest.magnitude.toFixed(1);
        document.getElementById('lastTime').textContent = formatTime(latest.timestamp);
        
        if (latest.epicenter) {
            addEpicenterMarker(latest.epicenter.latitude, latest.epicenter.longitude, latest.magnitude);
        }
    }
});

socket.on('detection', (detection) => {
    console.log('New detection:', detection);
    
    uniqueDevices.add(detection.deviceId);
    detectionCount++;
    if (detection.intensity > maxIntensity) {
        maxIntensity = detection.intensity;
    }
    
    addMarker(detection.latitude, detection.longitude, detection.intensity, detection.deviceId);
    updateStats();
});

socket.on('quakeEvent', (event) => {
    console.log('Quake event detected:', event);
    
    if (!isReplaying) {
        document.getElementById('lastMagnitude').textContent = 'M' + event.magnitude.toFixed(1);
        document.getElementById('lastTime').textContent = formatTime(event.timestamp);
        
        if (event.epicenter) {
            addEpicenterMarker(event.epicenter.latitude, event.epicenter.longitude, event.magnitude);
        }
        
        showAlert(event);
    }
    
    fetch('/api/quake-events')
        .then(res => res.json())
        .then(data => {
            updateEventsList(data.data);
        });
});

socket.on('replay:started', (data) => {
    console.log('Replay started:', data);
    document.getElementById('replayInfo').textContent = 
        `回放: ${data.event.name} - M${data.event.magnitude.toFixed(1)}`;
    
    if (data.event.epicenter) {
        map.setView([data.event.epicenter.latitude, data.event.epicenter.longitude], 11);
    }
});

socket.on('replay:progress', (data) => {
    const percent = Math.round(data.progress * 100);
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = percent + '%';
});

socket.on('replay:complete', () => {
    console.log('Replay complete');
    isReplaying = false;
    document.getElementById('replayInfo').textContent = '回放完成';
    setTimeout(() => {
        document.getElementById('replayControls').style.display = 'none';
    }, 2000);
});

socket.on('replay:error', (error) => {
    console.error('Replay error:', error);
    alert('回放失败: ' + error.message);
    stopReplay();
});

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    setInterval(cleanupOldMarkers, 10000);
    
    document.getElementById('historyBtn').addEventListener('click', openHistoryModal);
    document.getElementById('closeModal').addEventListener('click', closeHistoryModal);
    document.getElementById('stopReplayBtn').addEventListener('click', stopReplay);
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (currentQuakeEvents.length > 0) {
            exportEventCsv(currentQuakeEvents[0].id);
        }
    });
    
    document.getElementById('historyModal').addEventListener('click', (e) => {
        if (e.target.id === 'historyModal') {
            closeHistoryModal();
        }
    });
});
