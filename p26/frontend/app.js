const API_BASE = 'http://localhost:8080/api';

let cy = null;
let currentTraces = [];
let currentTrace = null;
let topologyData = null;
let visibleNodes = new Set();
let foldedNodes = new Set();
const MAX_NODES_INITIAL = 50;
const MAX_NODES_PER_BATCH = 20;
let anomalyPredictions = new Map();

let timelineState = {
    isPlaying: false,
    currentTime: null,
    startTime: null,
    endTime: null,
    windowSize: 5,
    playSpeed: 1,
    playInterval: null,
    stepDuration: 1000,
    isDragging: false
};

const colors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
    '#fa709a', '#fee140', '#a8edea', '#fed6e3'
];

function getServiceColor(serviceName) {
    let hash = 0;
    for (let i = 0; i < serviceName.length; i++) {
        hash = serviceName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function getAnomalyColor(level) {
    switch(level) {
        case 'critical': return '#dc2626';
        case 'alert': return '#ea580c';
        case 'warning': return '#ca8a04';
        case 'normal': return '#16a34a';
        default: return '#6b7280';
    }
}

function getAnomalyLabel(level) {
    switch(level) {
        case 'critical': return '严重异常';
        case 'alert': return '警报';
        case 'warning': return '警告';
        case 'normal': return '正常';
        default: return '未知';
    }
}

function formatDuration(nanoSeconds) {
    const ms = nanoSeconds / 1000000;
    if (ms < 1) return '< 1ms';
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
}

function formatTime(nanoSeconds) {
    const date = new Date(nanoSeconds / 1000000);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function logPerformance(label, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    return result;
}

function extractCriticalPath(nodes, edges, limit = MAX_NODES_INITIAL) {
    const nodeScores = new Map();

    nodes.forEach(node => {
        const incomingEdges = edges.filter(e => e.target === node.id);
        const outgoingEdges = edges.filter(e => e.source === node.id);
        
        const totalCallCount = [...incomingEdges, ...outgoingEdges].reduce((sum, e) => sum + (e.call_count || 0), 0);
        const avgDuration = [...incomingEdges, ...outgoingEdges].reduce((sum, e) => sum + (e.avg_duration || 0), 0);
        const errorCount = [...incomingEdges, ...outgoingEdges].reduce((sum, e) => sum + (e.error_count || 0), 0);
        
        const score = totalCallCount * 2 + avgDuration + errorCount * 10 + (incomingEdges.length + outgoingEdges.length) * 5;
        nodeScores.set(node.id, score);
    });

    const sortedNodes = [...nodes].sort((a, b) => (nodeScores.get(b.id) || 0) - (nodeScores.get(a.id) || 0));
    const criticalNodeIds = new Set(sortedNodes.slice(0, limit).map(n => n.id));

    const connectedNodes = new Set(criticalNodeIds);
    edges.forEach(edge => {
        if (criticalNodeIds.has(edge.source) && criticalNodeIds.has(edge.target)) {
        } else if (criticalNodeIds.has(edge.source)) {
            connectedNodes.add(edge.target);
        } else if (criticalNodeIds.has(edge.target)) {
            connectedNodes.add(edge.source);
        }
    });

    return {
        criticalNodes: nodes.filter(n => connectedNodes.has(n.id)),
        criticalEdges: edges.filter(e => connectedNodes.has(e.source) && connectedNodes.has(e.target)),
        foldedNodes: nodes.filter(n => !connectedNodes.has(n.id)),
        allNodes: nodes,
        allEdges: edges,
        nodeScores: nodeScores
    };
}

function buildNodeHierarchy(nodes, edges) {
    const children = new Map();
    const parents = new Map();

    nodes.forEach(n => {
        children.set(n.id, []);
        parents.set(n.id, []);
    });

    edges.forEach(e => {
        if (children.has(e.source)) {
            children.get(e.source).push(e.target);
        }
        if (parents.has(e.target)) {
            parents.get(e.target).push(e.source);
        }
    });

    return { children, parents };
}

function renderTopology(topology) {
    topologyData = topology;
    visibleNodes.clear();
    foldedNodes.clear();

    const cyContainer = document.getElementById('cy');
    
    if (!topology.nodes || topology.nodes.length === 0) {
        renderDemoTopology();
        return;
    }

    const totalNodes = topology.nodes.length;
    const totalEdges = topology.edges.length;
    console.log(`[Topology] Total nodes: ${totalNodes}, Total edges: ${totalEdges}`);

    if (totalNodes > MAX_NODES_INITIAL) {
        showTopologyWarning(totalNodes, totalEdges);
    }

    const result = logPerformance('extractCriticalPath', () => 
        extractCriticalPath(topology.nodes, topology.edges)
    );

    result.criticalNodes.forEach(n => visibleNodes.add(n.id));
    result.foldedNodes.forEach(n => foldedNodes.add(n.id));

    const elements = buildCytoscapeElements(result.criticalNodes, result.criticalEdges, result.foldedNodes.length);

    if (cy) {
        cy.destroy();
    }

    logPerformance('initializeCytoscape', () => {
        cy = cytoscape({
            container: cyContainer,
            elements: elements,
            style: getCytoscapeStyles(),
            layout: {
                name: 'cose',
                animate: totalNodes <= 100,
                animationDuration: totalNodes <= 100 ? 1000 : 0,
                nodeRepulsion: Math.max(1000, 4000 - totalNodes * 5),
                nodeOverlap: 10,
                idealEdgeLength: Math.max(80, 150 - totalNodes),
                fit: true,
                padding: 30
            },
            motionBlur: false,
            hideEdgesOnViewport: totalNodes > 200,
            textureOnViewport: totalNodes > 300,
            pixelRatio: 1
        });
    });

    setupTopologyInteractions(result);
    updateTopologyStats(result);
}

function buildCytoscapeElements(nodes, edges, foldedCount) {
    const elements = [];

    nodes.forEach(node => {
        elements.push({
            data: {
                id: node.id,
                label: node.label,
                type: 'service'
            }
        });
    });

    edges.forEach(edge => {
        elements.push({
            data: {
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                label: `${edge.call_count}次`,
                callCount: edge.call_count,
                avgDuration: edge.avg_duration,
                errorCount: edge.error_count,
                type: 'edge'
            }
        });
    });

    if (foldedCount > 0) {
        elements.push({
            data: {
                id: 'folded-group',
                label: `+${foldedCount} 个服务\n(点击展开)`,
                type: 'folded'
            }
        });
    }

    return elements;
}

function getCytoscapeStyles() {
    return [
        {
            selector: 'node[type="service"]',
            style: {
                'background-color': (ele) => getServiceColor(ele.data('label')),
                'label': 'data(label)',
                'color': '#fff',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '11px',
                'width': '60px',
                'height': '60px',
                'border-width': '2px',
                'border-color': '#fff',
                'shadow-blur': '5px',
                'shadow-color': '#000',
                'shadow-opacity': '0.1'
            }
        },
        {
            selector: 'node[type="folded"]',
            style: {
                'background-color': '#95a5a6',
                'label': 'data(label)',
                'color': '#fff',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '10px',
                'width': '80px',
                'height': '50px',
                'shape': 'roundrectangle',
                'border-width': '2px',
                'border-color': '#7f8c8d',
                'border-style': 'dashed'
            }
        },
        {
            selector: 'edge',
            style: {
                'width': (ele) => Math.min(4, 1 + Math.log10(ele.data('callCount') || 1)),
                'line-color': (ele) => ele.data('errorCount') > 0 ? '#f5576c' : '#a8a8a8',
                'target-arrow-color': (ele) => ele.data('errorCount') > 0 ? '#f5576c' : '#a8a8a8',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'label': (ele) => ele.data('callCount') > 10 ? `${ele.data('callCount')}次` : '',
                'font-size': '9px',
                'text-background-color': '#fff',
                'text-background-opacity': '0.8',
                'text-background-padding': '1px',
                'opacity': 0.7
            }
        },
        {
            selector: 'edge[errorCount > 0]',
            style: {
                'line-color': '#f5576c',
                'target-arrow-color': '#f5576c',
                'width': 3,
                'opacity': 1
            }
        },
        {
            selector: ':selected',
            style: {
                'border-width': 4,
                'border-color': '#f1c40f',
                'line-color': '#f1c40f',
                'target-arrow-color': '#f1c40f'
            }
        }
    ];
}

function setupTopologyInteractions(result) {
    if (!cy) return;

    cy.on('tap', 'node[type="folded"]', function() {
        expandFoldedNodes(result);
    });

    cy.on('tap', 'node[type="service"]', function(evt) {
        const node = evt.target;
        highlightNeighbors(node);
    });

    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            resetHighlight();
        }
    });
}

function highlightNeighbors(node) {
    if (!cy) return;
    
    const neighborhood = node.closedNeighborhood();
    
    cy.elements().forEach(ele => {
        if (neighborhood.has(ele)) {
            ele.style('opacity', 1);
            ele.style('z-index', 10);
        } else {
            ele.style('opacity', 0.2);
            ele.style('z-index', 1);
        }
    });
}

function resetHighlight() {
    if (!cy) return;
    
    cy.elements().forEach(ele => {
        ele.style('opacity', null);
        ele.style('z-index', null);
    });
}

function expandFoldedNodes(result) {
    if (!cy || !topologyData) return;

    const foldedNode = cy.$('#folded-group');
    if (foldedNode.length === 0) return;

    const currentVisibleCount = visibleNodes.size;
    const nextBatch = result.allNodes
        .filter(n => !visibleNodes.has(n.id))
        .sort((a, b) => (result.nodeScores.get(b.id) || 0) - (result.nodeScores.get(a.id) || 0))
        .slice(0, MAX_NODES_PER_BATCH);

    if (nextBatch.length === 0) {
        foldedNode.remove();
        return;
    }

    const newElements = [];
    nextBatch.forEach(node => {
        visibleNodes.add(node.id);
        foldedNodes.delete(node.id);
        newElements.push({
            data: {
                id: node.id,
                label: node.label,
                type: 'service'
            }
        });
    });

    const newEdges = result.allEdges.filter(e => 
        visibleNodes.has(e.source) && visibleNodes.has(e.target)
    );

    const existingEdgeIds = new Set(cy.edges().map(e => e.id()));
    newEdges.forEach(edge => {
        const edgeId = `${edge.source}-${edge.target}`;
        if (!existingEdgeIds.has(edgeId)) {
            newElements.push({
                data: {
                    id: edgeId,
                    source: edge.source,
                    target: edge.target,
                    label: `${edge.call_count}次`,
                    callCount: edge.call_count,
                    avgDuration: edge.avg_duration,
                    errorCount: edge.error_count,
                    type: 'edge'
                }
            });
        }
    });

    cy.add(newElements);

    const remainingFolded = result.allNodes.length - visibleNodes.size;
    if (remainingFolded > 0) {
        foldedNode.data('label', `+${remainingFolded} 个服务\n(点击展开)`);
    } else {
        foldedNode.remove();
    }

    cy.makeLayout({
        name: 'cose',
        animate: false,
        nodeRepulsion: Math.max(800, 2000 - visibleNodes.size * 3),
        nodeOverlap: 10,
        idealEdgeLength: Math.max(60, 100 - visibleNodes.size / 2)
    }).run();

    cy.fit();
    updateTopologyStats({
        criticalNodes: result.allNodes.filter(n => visibleNodes.has(n.id)),
        criticalEdges: newEdges,
        foldedNodes: result.allNodes.filter(n => !visibleNodes.has(n.id))
    });
}

function showTopologyWarning(nodeCount, edgeCount) {
    const container = document.querySelector('.topology-container');
    let warning = container.querySelector('.topology-warning');
    
    if (!warning) {
        warning = document.createElement('div');
        warning.className = 'topology-warning';
        warning.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            background: rgba(255, 193, 7, 0.95);
            color: #856404;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 13px;
            z-index: 1000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        container.style.position = 'relative';
        container.appendChild(warning);
    }

    warning.innerHTML = `
        <span>⚠️ 检测到 ${nodeCount} 个节点和 ${edgeCount} 条边，已启用智能分层渲染。关键路径已显示，其余节点已折叠。</span>
        <button onclick="this.parentElement.style.display='none'" style="background:none;border:none;font-size:16px;cursor:pointer;color:#856404;">×</button>
    `;

    setTimeout(() => {
        if (warning && warning.parentElement) {
            warning.style.opacity = '0';
            warning.style.transition = 'opacity 0.3s';
            setTimeout(() => warning.remove(), 300);
        }
    }, 8000);
}

function updateTopologyStats(result) {
    const container = document.querySelector('.topology-container');
    let stats = container.querySelector('.topology-stats');
    
    if (!stats) {
        stats = document.createElement('div');
        stats.className = 'topology-stats';
        stats.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.95);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            color: #666;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        container.appendChild(stats);
    }

    stats.innerHTML = `
        <span>显示: <strong>${result.criticalNodes.length}</strong> 个服务, 
        <strong>${result.criticalEdges.length}</strong> 条调用</span>
        ${result.foldedNodes.length > 0 ? `<span style="margin-left:10px;color:#f39c12;">折叠: ${result.foldedNodes.length} 个</span>` : ''}
    `;
}

function renderDemoTopology() {
    const demoNodes = [
        { id: 'demo1', label: 'API-Gateway' },
        { id: 'demo2', label: 'User-Service' },
        { id: 'demo3', label: 'Order-Service' },
        { id: 'demo4', label: 'Payment-Service' },
        { id: 'demo5', label: 'Database' }
    ];

    const demoEdges = [
        { source: 'demo1', target: 'demo2', call_count: 156, avg_duration: 23, error_count: 0 },
        { source: 'demo1', target: 'demo3', call_count: 89, avg_duration: 45, error_count: 2 },
        { source: 'demo2', target: 'demo5', call_count: 234, avg_duration: 12, error_count: 0 },
        { source: 'demo3', target: 'demo4', call_count: 67, avg_duration: 89, error_count: 1 },
        { source: 'demo3', target: 'demo5', call_count: 112, avg_duration: 34, error_count: 0 }
    ];

    const elements = buildCytoscapeElements(demoNodes, demoEdges, 0);

    if (cy) {
        cy.destroy();
    }

    const cyContainer = document.getElementById('cy');
    cy = cytoscape({
        container: cyContainer,
        elements: elements,
        style: getCytoscapeStyles(),
        layout: {
            name: 'cose',
            animate: true,
            animationDuration: 800,
            nodeRepulsion: 4000,
            nodeOverlap: 20,
            idealEdgeLength: 150
        }
    });

    setupTopologyInteractions({ allNodes: demoNodes, allEdges: demoEdges, nodeScores: new Map() });
}

async function fetchServices() {
    try {
        const response = await fetch(`${API_BASE}/services`);
        const data = await response.json();
        const select = document.getElementById('serviceFilter');
        select.innerHTML = '<option value="">全部服务</option>';
        data.data.forEach(service => {
            const option = document.createElement('option');
            option.value = service;
            option.textContent = service;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to fetch services:', error);
    }
}

async function fetchTraces() {
    const service = document.getElementById('serviceFilter').value;
    const timeRange = document.getElementById('timeRange').value;

    const endTime = new Date();
    let startTime = new Date();

    switch (timeRange) {
        case '1h':
            startTime.setHours(endTime.getHours() - 1);
            break;
        case '6h':
            startTime.setHours(endTime.getHours() - 6);
            break;
        case '24h':
            startTime.setHours(endTime.getHours() - 24);
            break;
        case '7d':
            startTime.setDate(endTime.getDate() - 7);
            break;
    }

    const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        service: service,
        limit: '100'
    });

    try {
        const response = await fetch(`${API_BASE}/traces?${params}`);
        const data = await response.json();
        currentTraces = data.data;
        renderTracesTable();
        updateFlameSelect();
    } catch (error) {
        console.error('Failed to fetch traces:', error);
        document.getElementById('traceBody').innerHTML =
            '<tr><td colspan="7" class="loading">加载失败，请确保API服务已启动</td></tr>';
    }
}

async function fetchAnomalies() {
    const service = document.getElementById('serviceFilter').value;
    const timeRange = document.getElementById('timeRange').value;

    const endTime = new Date();
    let startTime = new Date();

    switch (timeRange) {
        case '1h':
            startTime.setHours(endTime.getHours() - 1);
            break;
        case '6h':
            startTime.setHours(endTime.getHours() - 6);
            break;
        case '24h':
            startTime.setHours(endTime.getHours() - 24);
            break;
        case '7d':
            startTime.setDate(endTime.getDate() - 7);
            break;
    }

    const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        service: service,
        limit: '100'
    });

    try {
        const response = await fetch(`${API_BASE}/anomalies?${params}`);
        const data = await response.json();
        
        if (data.data && data.data.results) {
            anomalyPredictions.clear();
            data.data.results.forEach(pred => {
                anomalyPredictions.set(pred.trace_id, pred);
            });
            renderTracesTable();
            showAnomalySummary(data.data);
        }
    } catch (error) {
        console.error('Failed to fetch anomalies:', error);
    }
}

function showAnomalySummary(data) {
    const container = document.querySelector('.traces-container');
    let summary = container.querySelector('.anomaly-summary');
    
    if (!summary) {
        summary = document.createElement('div');
        summary.className = 'anomaly-summary';
        summary.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            display: flex;
            gap: 30px;
            align-items: center;
        `;
        const header = container.querySelector('.table-header');
        if (header) {
            header.after(summary);
        } else {
            container.prepend(summary);
        }
    }

    const anomalyRate = (data.anomaly_rate * 100).toFixed(1);
    summary.innerHTML = `
        <div>
            <div style="font-size:12px;opacity:0.8;">总分析</div>
            <div style="font-size:20px;font-weight:600;">${data.total} 条</div>
        </div>
        <div>
            <div style="font-size:12px;opacity:0.8;">异常数</div>
            <div style="font-size:20px;font-weight:600;color:#fecaca;">${data.anomalies_count}</div>
        </div>
        <div>
            <div style="font-size:12px;opacity:0.8;">异常率</div>
            <div style="font-size:20px;font-weight:600;color:#fecaca;">${anomalyRate}%</div>
        </div>
        <button onclick="fetchAnomalies()" style="background:white;color:#667eea;border:none;padding:8px 16px;border-radius:6px;font-weight:500;cursor:pointer;margin-left:auto;">
            🔄 刷新检测
        </button>
    `;
}

async function fetchTopology() {
    const timeRange = document.getElementById('timeRange').value;
    const endTime = new Date();
    let startTime = new Date();

    switch (timeRange) {
        case '1h':
            startTime.setHours(endTime.getHours() - 1);
            break;
        case '6h':
            startTime.setHours(endTime.getHours() - 6);
            break;
        case '24h':
            startTime.setHours(endTime.getHours() - 24);
            break;
        case '7d':
            startTime.setDate(endTime.getDate() - 7);
            break;
    }

    const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
    });

    try {
        const response = await fetch(`${API_BASE}/topology?${params}`);
        const data = await response.json();
        renderTopology(data.data);
    } catch (error) {
        console.error('Failed to fetch topology:', error);
        renderDemoTopology();
    }
}

async function fetchTraceDetail(traceId) {
    try {
        const response = await fetch(`${API_BASE}/traces/${traceId}`);
        const data = await response.json();
        currentTrace = data.data;
        return data.data;
    } catch (error) {
        console.error('Failed to fetch trace detail:', error);
        return null;
    }
}

async function fetchTraceAnomaly(traceId) {
    try {
        const response = await fetch(`${API_BASE}/traces/${traceId}/anomaly`);
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Failed to fetch trace anomaly:', error);
        return null;
    }
}

function renderTracesTable() {
    const tbody = document.getElementById('traceBody');
    document.getElementById('traceCount').textContent = `${currentTraces.length} 条记录`;

    if (currentTraces.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = currentTraces.map(trace => {
        const traceId = trace.trace_id;
        const anomaly = anomalyPredictions.get(traceId);
        const anomalyBadge = anomaly ? `
            <span class="anomaly-badge" style="
                background: ${getAnomalyColor(anomaly.anomaly_level)};
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
            ">
                ${getAnomalyLabel(anomaly.anomaly_level)} (${(anomaly.anomaly_score * 100).toFixed(0)}%)
            </span>
        ` : '';

        return `
        <tr style="${anomaly && anomaly.is_anomaly ? 'background: #fef2f2;' : ''}">
            <td>
                <span class="trace-id">${traceId.substring(0, 16)}...</span>
                ${anomalyBadge}
            </td>
            <td>
                <div class="service-tags">
                    ${(trace.service_names || []).slice(0, 3).map(s => `<span class="service-tag">${s}</span>`).join('')}
                    ${(trace.service_names || []).length > 3 ? `<span class="service-tag">+${(trace.service_names || []).length - 3}</span>` : ''}
                </div>
            </td>
            <td>${trace.span_count}</td>
            <td>${trace.error_count > 0 ? `<span class="error-badge">${trace.error_count}</span>` : '-'}</td>
            <td><span class="duration">${formatDuration(trace.duration)}</span></td>
            <td>${formatTime(trace.start_time)}</td>
            <td>
                <button class="btn-small" onclick="showTraceDetail('${traceId}')">详情</button>
                <button class="btn-small" onclick="showFlameGraph('${traceId}')" style="margin-left: 4px; background: #43e97b;">火焰图</button>
                <button class="btn-small" onclick="detectAnomalyForTrace('${traceId}')" style="margin-left: 4px; background: #f5576c;">检测异常</button>
            </td>
        </tr>
    `}).join('');
}

async function detectAnomalyForTrace(traceId) {
    const anomaly = await fetchTraceAnomaly(traceId);
    if (anomaly) {
        anomalyPredictions.set(traceId, anomaly);
        renderTracesTable();
        
        alert(`异常检测结果:\n等级: ${getAnomalyLabel(anomaly.anomaly_level)}\n分数: ${(anomaly.anomaly_score * 100).toFixed(1)}%\n因素: ${anomaly.contributing_factors?.join(', ') || '无'}`);
    }
}

function updateFlameSelect() {
    const select = document.getElementById('flameTraceSelect');
    select.innerHTML = '<option value="">选择一个Trace</option>';
    currentTraces.forEach(trace => {
        const option = document.createElement('option');
        option.value = trace.trace_id;
        option.textContent = `${trace.trace_id.substring(0, 16)}... - ${formatDuration(trace.duration)} - ${(trace.service_names || []).join(', ')}`;
        select.appendChild(option);
    });
}

async function showTraceDetail(traceId) {
    const trace = await fetchTraceDetail(traceId);
    if (!trace) return;

    const anomaly = await fetchTraceAnomaly(traceId);
    const modal = document.getElementById('traceModal');
    const detail = document.getElementById('traceDetail');

    const spanCount = trace.spans.length;
    const hasManySpans = spanCount > 100;

    detail.innerHTML = `
        <div class="trace-detail-header">
            <h3>Trace ID: ${traceId}</h3>
            ${anomaly ? `
                <div style="margin-top: 10px; padding: 12px 15px; background: ${getAnomalyColor(anomaly.anomaly_level)}15; border: 1px solid ${getAnomalyColor(anomaly.anomaly_level)}30; border-radius: 6px;">
                    <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                        <div>
                            <span style="font-weight: 600; color: ${getAnomalyColor(anomaly.anomaly_level)}">异常等级: ${getAnomalyLabel(anomaly.anomaly_level)}</span>
                        </div>
                        <div>异常分数: <strong>${(anomaly.anomaly_score * 100).toFixed(1)}%</strong></div>
                        <div>是否异常: <strong>${anomaly.is_anomaly ? '是' : '否'}</strong></div>
                    </div>
                    ${anomaly.contributing_factors?.length > 0 ? `
                        <div style="margin-top: 8px; font-size: 12px; color: #666;">
                            异常因素: ${anomaly.contributing_factors.join(', ')}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            <div class="trace-stats">
                <div class="trace-stat">
                    <span class="trace-stat-label">服务数量</span>
                    <span class="trace-stat-value">${trace.service_names?.length || 0}</span>
                </div>
                <div class="trace-stat">
                    <span class="trace-stat-label">Span数量</span>
                    <span class="trace-stat-value">${trace.span_count}</span>
                </div>
                <div class="trace-stat">
                    <span class="trace-stat-label">错误数</span>
                    <span class="trace-stat-value">${trace.error_count}</span>
                </div>
                <div class="trace-stat">
                    <span class="trace-stat-label">总耗时</span>
                    <span class="trace-stat-value">${formatDuration(trace.duration)}</span>
                </div>
            </div>
            ${hasManySpans ? `
                <div style="margin-top: 12px; padding: 8px 12px; background: #fff3cd; border-radius: 4px; font-size: 12px; color: #856404;">
                    ⚠️ 此Trace包含 ${spanCount} 个Span，已启用虚拟滚动优化渲染性能
                </div>
            ` : ''}
        </div>
        <div id="spanListContainer" style="max-height: 500px; overflow-y: auto;">
            ${hasManySpans ? renderSpansVirtualScroll(trace) : renderSpansAll(trace)}
        </div>
    `;

    modal.classList.add('show');

    if (hasManySpans) {
        setupSpanVirtualScroll(trace);
    }
}

function renderSpansAll(trace) {
    return `
        <div class="span-list" id="spanListAll">
            ${trace.spans.map(span => renderSpanItem(span, getSpanDepth(trace.spans, span))).join('')}
        </div>
    `;
}

function renderSpansVirtualScroll(trace) {
    const visibleSpans = trace.spans.slice(0, 50);
    return `
        <div id="spanListVirtual" class="span-list">
            ${visibleSpans.map(span => renderSpanItem(span, getSpanDepth(trace.spans, span))).join('')}
        </div>
        <div id="spanSentinel" style="height: 20px; text-align: center; color: #999; font-size: 12px; padding: 10px;">
            滚动加载更多... (${trace.spans.length - 50} 个剩余)
        </div>
    `;
}

function setupSpanVirtualScroll(trace) {
    const container = document.getElementById('spanListContainer');
    const sentinel = document.getElementById('spanSentinel');
    const list = document.getElementById('spanListVirtual');
    
    if (!container || !sentinel || !list) return;

    let loadedCount = 50;
    const batchSize = 30;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && loadedCount < trace.spans.length) {
                const nextBatch = trace.spans.slice(loadedCount, loadedCount + batchSize);
                nextBatch.forEach(span => {
                    const div = document.createElement('div');
                    div.innerHTML = renderSpanItem(span, getSpanDepth(trace.spans, span));
                    list.appendChild(div.firstElementChild);
                });
                
                loadedCount += nextBatch.length;
                const remaining = trace.spans.length - loadedCount;
                
                if (remaining <= 0) {
                    sentinel.innerHTML = '已加载全部';
                    observer.disconnect();
                } else {
                    sentinel.innerHTML = `滚动加载更多... (${remaining} 个剩余)`;
                }
            }
        });
    }, { root: container, threshold: 0.1 });

    observer.observe(sentinel);
}

function renderSpanItem(span, depth) {
    return `
        <div class="span-item" style="margin-left: ${depth * 15}px;">
            <div class="span-header">
                <span class="span-name">${span.name}</span>
                <span class="span-service" style="background: ${getServiceColor(span.service_name)}">${span.service_name}</span>
            </div>
            <div class="span-meta">
                <div class="span-meta-item">
                    <span>⏱️</span>
                    <span>${formatDuration(span.duration)}</span>
                </div>
                <div class="span-meta-item">
                    <span>📅</span>
                    <span>${formatTime(span.start_time_unix_nano)}</span>
                </div>
                <div class="span-meta-item">
                    <span>🔗</span>
                    <span>${span.kind || 'N/A'}</span>
                </div>
                ${span.status_code != 0 ? `<div class="span-meta-item"><span>⚠️</span><span style="color: #c33;">${span.status_message || 'Error'}</span></div>` : ''}
            </div>
            ${Object.keys(span.attributes || {}).length > 0 ? `
                <div class="span-attrs">
                    <div class="attr-title">Attributes (${Object.keys(span.attributes || {}).length})</div>
                    <div class="attr-list">
                        ${Object.entries(span.attributes || {}).slice(0, 10).map(([key, value]) => `
                            <span class="attr-item">
                                <span class="attr-key">${key}</span>
                                <span class="attr-value">${value}</span>
                            </span>
                        `).join('')}
                        ${Object.keys(span.attributes || {}).length > 10 ? `
                            <span class="attr-item" style="background: #f0f0f0;">+${Object.keys(span.attributes || {}).length - 10} 更多</span>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function getSpanDepth(spans, span) {
    let depth = 0;
    let current = span;
    const visited = new Set();
    
    while (current && current.parent_span_id && !visited.has(current.span_id)) {
        visited.add(current.span_id);
        current = spans.find(s => s.span_id === current.parent_span_id);
        if (current) depth++;
        if (depth > 50) break;
    }
    return Math.min(depth, 20);
}

function buildSpanTree(spans) {
    const spanMap = new Map();
    const roots = [];

    spans.forEach(span => {
        spanMap.set(span.span_id, { ...span, children: [] });
    });

    spans.forEach(span => {
        const node = spanMap.get(span.span_id);
        if (span.parent_span_id && spanMap.has(span.parent_span_id)) {
            spanMap.get(span.parent_span_id).children.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

async function showFlameGraph(traceId) {
    const trace = await fetchTraceDetail(traceId);
    if (!trace) return;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelector('[data-tab="flame"]').classList.add('active');
    document.getElementById('flame-tab').classList.add('active');

    renderFlameGraph(trace);
}

function renderFlameGraph(trace) {
    const container = document.getElementById('flameGraph');
    const totalDuration = trace.duration;

    if (trace.spans.length > 500) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    ⚠️ 此Trace包含 ${trace.spans.length} 个Span，火焰图已启用智能简化模式
                </div>
                <div id="flameGraphContent"></div>
            </div>
        `;
        setTimeout(() => {
            renderOptimizedFlameGraph(trace, document.getElementById('flameGraphContent'));
        }, 50);
    } else {
        renderOptimizedFlameGraph(trace, container);
    }
}

function renderOptimizedFlameGraph(trace, container) {
    const totalDuration = trace.duration;
    const roots = buildSpanTree(trace.spans);

    function simplifyTree(node, maxDepth, currentDepth = 0) {
        if (currentDepth >= maxDepth) {
            return { ...node, children: [] };
        }
        
        const sortedChildren = (node.children || [])
            .sort((a, b) => b.duration - a.duration)
            .slice(0, Math.max(5, 15 - currentDepth));

        return {
            ...node,
            children: sortedChildren.map(child => simplifyTree(child, maxDepth, currentDepth + 1))
        };
    }

    const maxDepth = trace.spans.length > 1000 ? 8 : trace.spans.length > 500 ? 10 : 20;
    const simplifiedRoots = roots.map(root => simplifyTree(root, maxDepth));

    let html = '';
    
    function renderLevel(node, level, leftPercent, widthPercent, isSimplified = false) {
        const color = isSimplified ? '#95a5a6' : getServiceColor(node.service_name);
        const percent = ((node.duration / totalDuration) * 100).toFixed(2);

        html += `
            <div class="flame-row" style="padding-left: ${leftPercent}%; height: ${Math.max(20, 28 - level)}px;">
                <div class="flame-bar" 
                     style="width: ${widthPercent}%; background: ${color}; height: 100%;"
                     title="${node.name} - ${formatDuration(node.duration)} (${percent}%) - ${node.service_name}${isSimplified ? ' (已简化)' : ''}">
                    ${widthPercent > 3 ? `<span class="bar-label" style="font-size: ${Math.max(9, 12 - level)}px;">${node.name}</span>` : ''}
                </div>
            </div>
        `;

        if (node.children && node.children.length > 0) {
            let childLeft = 0;
            node.children.forEach(child => {
                const childWidth = (child.duration / totalDuration) * 100;
                renderLevel(child, level + 1, leftPercent + childLeft, childWidth, level + 1 >= maxDepth - 2);
                childLeft += childWidth;
            });
        }
    }

    simplifiedRoots.sort((a, b) => b.duration - a.duration);
    simplifiedRoots.slice(0, 5).forEach(root => {
        const rootWidth = (root.duration / totalDuration) * 100;
        renderLevel(root, 0, 0, rootWidth);
    });

    if (trace.spans.length > 500) {
        html += `
            <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 12px; color: #666;">
                💡 火焰图已简化显示：最深 ${maxDepth} 层，每层按耗时显示Top N节点。完整数据请查看"Trace详情"。
            </div>
        `;
    }

    container.innerHTML = html;
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');

            if (tabId === 'topology') {
                setTimeout(() => fetchTopology(), 100);
            }
        });
    });
}

function initModal() {
    const modal = document.getElementById('traceModal');
    const closeBtn = modal.querySelector('.close');

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

function initFlameSelect() {
    document.getElementById('flameTraceSelect').addEventListener('change', (e) => {
        if (e.target.value) {
            showFlameGraph(e.target.value);
        }
    });
}

async function fetchTimelineTopology(startTime, endTime) {
    const params = new URLSearchParams({
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
    });

    try {
        const response = await fetch(`${API_BASE}/topology?${params}`);
        const data = await response.json();
        renderTopology(data.data);
        updateTopologyStats(data.data);
    } catch (error) {
        console.error('Failed to fetch timeline topology:', error);
    }
}

function formatTimelineTime(date) {
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function updateTimelineUI() {
    const slider = document.getElementById('timelineSlider');
    const currentTimeLabel = document.getElementById('currentTimeLabel');
    const startTimeLabel = document.getElementById('startTimeLabel');
    const endTimeLabel = document.getElementById('endTimeLabel');
    const windowLabel = document.getElementById('windowLabel');

    if (!slider || !currentTimeLabel) return;

    const percentage = parseInt(slider.value);
    const totalDuration = timelineState.endTime.getTime() - timelineState.startTime.getTime();
    const currentTimestamp = timelineState.startTime.getTime() + (totalDuration * percentage / 100);
    timelineState.currentTime = new Date(currentTimestamp);

    currentTimeLabel.textContent = formatTimelineTime(timelineState.currentTime);
    startTimeLabel.textContent = formatTimelineTime(timelineState.startTime);
    endTimeLabel.textContent = formatTimelineTime(timelineState.endTime);
    windowLabel.textContent = `时间窗口: ${timelineState.windowSize}分钟`;

    const windowStart = new Date(timelineState.currentTime.getTime() - timelineState.windowSize * 60 * 1000);
    const windowEnd = timelineState.currentTime;

    if (!timelineState.isPlaying) {
        fetchTimelineTopology(windowStart, windowEnd);
    }
}

function startPlayback() {
    if (timelineState.isPlaying) {
        stopPlayback();
        return;
    }

    timelineState.isPlaying = true;
    document.getElementById('playIcon').textContent = '⏸';

    const stepMs = 1000 * timelineState.playSpeed;
    const totalDuration = timelineState.endTime.getTime() - timelineState.startTime.getTime();

    timelineState.playInterval = setInterval(() => {
        const slider = document.getElementById('timelineSlider');
        let currentValue = parseInt(slider.value);

        if (currentValue >= 100) {
            stopPlayback();
            return;
        }

        const stepPercent = (stepMs / totalDuration) * 100 * 10;
        slider.value = Math.min(100, currentValue + stepPercent);
        updateTimelineUI();

        const windowStart = new Date(timelineState.currentTime.getTime() - timelineState.windowSize * 60 * 1000);
        const windowEnd = timelineState.currentTime;
        fetchTimelineTopology(windowStart, windowEnd);
    }, 100);
}

function stopPlayback() {
    timelineState.isPlaying = false;
    document.getElementById('playIcon').textContent = '▶';

    if (timelineState.playInterval) {
        clearInterval(timelineState.playInterval);
        timelineState.playInterval = null;
    }
}

function stepBackward() {
    const slider = document.getElementById('timelineSlider');
    const step = Math.max(1, 100 / ((timelineState.endTime - timelineState.startTime) / 60000) * 5);
    slider.value = Math.max(0, parseInt(slider.value) - step);
    updateTimelineUI();
}

function stepForward() {
    const slider = document.getElementById('timelineSlider');
    const step = Math.max(1, 100 / ((timelineState.endTime - timelineState.startTime) / 60000) * 5);
    slider.value = Math.min(100, parseInt(slider.value) + step);
    updateTimelineUI();
}

function resetTimeline() {
    stopPlayback();
    document.getElementById('timelineSlider').value = 100;
    initTimelineRange();
    updateTimelineUI();
    fetchTopology();
}

function initTimelineRange() {
    const timeRange = document.getElementById('timeRange').value;
    timelineState.endTime = new Date();
    timelineState.startTime = new Date(timelineState.endTime);

    switch (timeRange) {
        case '1h':
            timelineState.startTime.setHours(timelineState.endTime.getHours() - 1);
            break;
        case '6h':
            timelineState.startTime.setHours(timelineState.endTime.getHours() - 6);
            break;
        case '24h':
            timelineState.startTime.setHours(timelineState.endTime.getHours() - 24);
            break;
        case '7d':
            timelineState.startTime.setDate(timelineState.endTime.getDate() - 7);
            break;
    }

    timelineState.currentTime = new Date(timelineState.endTime);
}

function updateTopologyStats(data) {
    const nodeCount = data?.nodes?.length || 0;
    const edgeCount = data?.edges?.length || 0;
    const totalCalls = data?.edges?.reduce((sum, e) => sum + (e.call_count || 0), 0) || 0;

    document.getElementById('statNodeCount').textContent = nodeCount;
    document.getElementById('statEdgeCount').textContent = edgeCount;
    document.getElementById('statCallCount').textContent = totalCalls.toLocaleString();
}

function renderTopologyWithAnimation(newData) {
    if (!cy) {
        renderTopology(newData);
        return;
    }

    const oldNodes = new Set(cy.nodes().map(n => n.id()));
    const newNodes = new Set(newData.nodes.map(n => n.id));

    const nodesToRemove = [...oldNodes].filter(id => !newNodes.has(id));
    const nodesToAdd = newData.nodes.filter(n => !oldNodes.has(n.id));

    if (nodesToRemove.length > 0 || nodesToAdd.length > 0) {
        cy.batch(() => {
            nodesToRemove.forEach(id => cy.getElementById(id).remove());

            nodesToAdd.forEach(node => {
                cy.add({
                    group: 'nodes',
                    data: {
                        id: node.id,
                        label: node.label,
                        type: 'service'
                    },
                    position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 50 }
                });
            });

            cy.edges().remove();
            newData.edges.forEach(edge => {
                cy.add({
                    group: 'edges',
                    data: {
                        id: `${edge.source}-${edge.target}`,
                        source: edge.source,
                        target: edge.target,
                        call_count: edge.call_count,
                        avg_duration: edge.avg_duration,
                        error_count: edge.error_count
                    }
                });
            });
        });

        cy.layout({
            name: 'cose',
            animate: true,
            animationDuration: 500,
            nodeRepulsion: 4000,
            nodeOverlap: 20,
            idealEdgeLength: 150
        }).run();
    } else {
        renderTopology(newData);
    }

    updateTopologyStats(newData);
}

function initTimeline() {
    initTimelineRange();

    const slider = document.getElementById('timelineSlider');
    if (slider) {
        slider.addEventListener('input', () => {
            timelineState.isDragging = true;
            updateTimelineUI();
        });

        slider.addEventListener('change', () => {
            timelineState.isDragging = false;
            const windowStart = new Date(timelineState.currentTime.getTime() - timelineState.windowSize * 60 * 1000);
            const windowEnd = timelineState.currentTime;
            fetchTimelineTopology(windowStart, windowEnd);
        });
    }

    document.getElementById('playBtn').addEventListener('click', startPlayback);
    document.getElementById('stepBackBtn').addEventListener('click', stepBackward);
    document.getElementById('stepForwardBtn').addEventListener('click', stepForward);
    document.getElementById('resetBtn').addEventListener('click', resetTimeline);

    document.getElementById('windowSizeSelect').addEventListener('change', (e) => {
        timelineState.windowSize = parseInt(e.target.value);
        updateTimelineUI();
    });

    document.getElementById('playSpeedSelect').addEventListener('change', (e) => {
        timelineState.playSpeed = parseFloat(e.target.value);
        if (timelineState.isPlaying) {
            stopPlayback();
            startPlayback();
        }
    });

    const slider2 = document.getElementById('timelineSlider');
    if (slider2) {
        slider2.value = 100;
        updateTimelineUI();
    }
}

async function init() {
    initTabs();
    initModal();
    initFlameSelect();
    initTimeline();

    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchServices();
        fetchTraces();
        fetchTopology();
    });

    document.getElementById('serviceFilter').addEventListener('change', fetchTraces);
    document.getElementById('timeRange').addEventListener('change', () => {
        initTimelineRange();
        const slider = document.getElementById('timelineSlider');
        if (slider) slider.value = 100;
        updateTimelineUI();
        fetchTraces();
        fetchTopology();
    });

    await fetchServices();
    await fetchTraces();
}

document.addEventListener('DOMContentLoaded', init);
