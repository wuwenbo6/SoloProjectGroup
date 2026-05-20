const API_BASE = 'http://localhost:8000/api';

const PEST_COLORS = {
    'locust': { color: '#ef4444', name: '蝗虫', rgb: '239, 68, 68' },
    'cotton_bollworm': { color: '#f59e0b', name: '棉铃虫', rgb: '245, 158, 11' },
    'aphid': { color: '#10b981', name: '蚜虫', rgb: '16, 185, 129' },
    'whitefly': { color: '#8b5cf6', name: '粉虱', rgb: '139, 92, 246' },
    'unknown': { color: '#6b7280', name: '未知', rgb: '107, 114, 128' },
    'none': { color: '#9ca3af', name: '无', rgb: '156, 163, 175' }
};

let map;
let markers = [];
let heatLayer = null;
let nodeMarkers = [];
let currentFilter = '';

function initMap() {
    map = L.map('map').setView([35.0, 118.0], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    loadNodes();
    loadStats();
    loadHeatmap();
    refreshData();
    
    setInterval(refreshData, 30000);
}

async function loadNodes() {
    try {
        const response = await fetch(`${API_BASE}/nodes/`);
        const data = await response.json();
        
        nodeMarkers.forEach(m => map.removeLayer(m));
        nodeMarkers = [];
        
        data.forEach(node => {
            const marker = L.circleMarker([node.lat, node.lng], {
                radius: 8,
                fillColor: '#3b82f6',
                color: '#1d4ed8',
                weight: 2,
                fillOpacity: 0.8
            }).addTo(map);
            
            marker.bindPopup(`
                <div class="popup-content">
                    <div class="popup-title">📡 麦克风节点</div>
                    <div class="popup-info"><strong>ID:</strong> ${node.node_id}</div>
                    <div class="popup-info"><strong>位置:</strong> ${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}</div>
                    <div class="popup-info"><strong>状态:</strong> ${node.is_active ? '在线' : '离线'}</div>
                </div>
            `);
            
            nodeMarkers.push(marker);
        });
    } catch (error) {
        console.error('Error loading nodes:', error);
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats/`);
        const data = await response.json();
        
        document.getElementById('totalDetections').textContent = data.total_detections;
        document.getElementById('totalLocations').textContent = data.total_locations;
        document.getElementById('activeNodes').textContent = data.active_nodes;
        document.getElementById('totalPests').textContent = data.pest_stats.length;
        
        updatePestLegend(data.pest_stats);
        updateRecentEvents(data.recent_locations);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updatePestLegend(pestStats) {
    const legend = document.getElementById('pestLegend');
    legend.innerHTML = '';
    
    pestStats.forEach(stat => {
        const pestInfo = PEST_COLORS[stat.detected_pest] || PEST_COLORS['unknown'];
        const item = document.createElement('div');
        item.className = 'pest-item';
        item.innerHTML = `
            <div class="pest-color" style="background: ${pestInfo.color}"></div>
            <span class="pest-name">${pestInfo.name}</span>
            <span class="pest-count">${stat.count}</span>
        `;
        legend.appendChild(item);
    });
    
    if (pestStats.length === 0) {
        legend.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">暂无数据</div>';
    }
}

function updateRecentEvents(locations) {
    const container = document.getElementById('recentEvents');
    container.innerHTML = '';
    
    locations.forEach(loc => {
        const pestType = loc.detections && loc.detections[0] ? 
            loc.detections[0].detected_pest : 'unknown';
        const pestInfo = PEST_COLORS[pestType] || PEST_COLORS['unknown'];
        
        const card = document.createElement('div');
        card.className = 'event-card';
        card.style.borderLeftColor = pestInfo.color;
        
        const time = new Date(loc.localized_at).toLocaleString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        card.innerHTML = `
            <div class="event-type">${pestInfo.name} 检测</div>
            <div class="event-location">📍 ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>
            <div class="event-time">🕐 ${time}</div>
        `;
        
        card.onclick = () => {
            map.setView([loc.lat, loc.lng], 14);
        };
        
        container.appendChild(card);
    });
    
    if (locations.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">暂无事件</div>';
    }
}

async function loadHeatmap() {
    try {
        let url = `${API_BASE}/heatmap/`;
        if (currentFilter) {
            url += `?pest_type=${currentFilter}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        markers.forEach(m => map.removeLayer(m));
        markers = [];
        
        if (data.length > 0) {
            const heatPoints = data.map(p => {
                const intensity = Math.min(p.confidence * 0.8 + 0.2, 1);
                return [p.lat, p.lng, intensity];
            });
            
            if (heatLayer) {
                map.removeLayer(heatLayer);
            }
            
            heatLayer = L.heatLayer(heatPoints, {
                radius: 25,
                blur: 15,
                maxZoom: 14,
                gradient: {
                    0.4: 'blue',
                    0.65: 'lime',
                    1: 'red'
                }
            }).addTo(map);
            
            data.forEach(p => {
                const pestInfo = PEST_COLORS[p.pest_type] || PEST_COLORS['unknown'];
                const marker = L.circleMarker([p.lat, p.lng], {
                    radius: 10 + p.confidence * 10,
                    fillColor: pestInfo.color,
                    color: pestInfo.color,
                    weight: 2,
                    fillOpacity: 0.7
                }).addTo(map);
                
                marker.bindPopup(createPopupContent(p));
                markers.push(marker);
            });
        }
    } catch (error) {
        console.error('Error loading heatmap:', error);
    }
}

function createPopupContent(point) {
    const pestInfo = PEST_COLORS[point.pest_type] || PEST_COLORS['unknown'];
    
    let audioHtml = '';
    if (point.audio_url) {
        audioHtml = `
            <div class="audio-player">
                <audio controls>
                    <source src="${point.audio_url}" type="audio/wav">
                    您的浏览器不支持音频播放。
                </audio>
            </div>
        `;
    }
    
    return `
        <div class="popup-content">
            <div class="popup-title" style="color: ${pestInfo.color}">
                🦗 ${pestInfo.name}
            </div>
            <div class="popup-info"><strong>置信度:</strong> ${(point.confidence * 100).toFixed(1)}%</div>
            <div class="popup-info"><strong>位置:</strong> ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</div>
            ${audioHtml}
        </div>
    `;
}

async function loadLocationsWithAudio() {
    try {
        const response = await fetch(`${API_BASE}/locations/`);
        const data = await response.json();
        
        data.forEach(loc => {
            if (loc.detections && loc.detections.length > 0) {
                const det = loc.detections[0];
                const pestInfo = PEST_COLORS[det.detected_pest] || PEST_COLORS['unknown'];
                
                const marker = L.circleMarker([loc.lat, loc.lng], {
                    radius: 10 + det.confidence * 10,
                    fillColor: pestInfo.color,
                    color: pestInfo.color,
                    weight: 2,
                    fillOpacity: 0.7
                }).addTo(map);
                
                const pestInfoFull = {
                    pest_type: det.detected_pest,
                    confidence: det.confidence,
                    lat: loc.lat,
                    lng: loc.lng,
                    audio_url: det.audio_url
                };
                
                marker.bindPopup(createPopupContent(pestInfoFull));
                markers.push(marker);
            }
        });
    } catch (error) {
        console.error('Error loading locations:', error);
    }
}

function refreshData() {
    loadStats();
    loadHeatmap();
    loadLocationsWithAudio();
}

function filterPests() {
    currentFilter = document.getElementById('pestFilter').value;
    loadHeatmap();
}

document.addEventListener('DOMContentLoaded', initMap);
