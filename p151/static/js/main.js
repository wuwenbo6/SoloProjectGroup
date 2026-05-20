const API_BASE = 'http://localhost:8000';

let trendChart, sentimentChart, platformChart;
let monitoredKeywords = [];

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadDashboardData();
    setupEventListeners();
    loadMonitoredKeywords();
});

function initCharts() {
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '帖子数量',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }, {
                label: '平均情感',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#9ca3af' } } },
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                y1: { position: 'right', ticks: { color: '#9ca3af' }, grid: { display: false } }
            }
        }
    });

    const sentimentCtx = document.getElementById('sentimentChart').getContext('2d');
    sentimentChart = new Chart(sentimentCtx, {
        type: 'doughnut',
        data: {
            labels: ['正面', '中性', '负面'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#9ca3af' } } }
        }
    });

    const platformCtx = document.getElementById('platformChart').getContext('2d');
    platformChart = new Chart(platformCtx, {
        type: 'bar',
        data: {
            labels: ['Twitter', 'Reddit', 'Telegram'],
            datasets: [{
                label: '帖子数量',
                data: [0, 0, 0],
                backgroundColor: ['#1da1f2', '#ff4500', '#0088cc']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }
            }
        }
    });
}

async function loadDashboardData() {
    try {
        const trendsResponse = await fetch(`${API_BASE}/api/analytics/trends?days=7`);
        const trendsData = await trendsResponse.json();
        updateTrendChart(trendsData);
        updateSentimentChart(trendsData.sentiment_distribution);
        updatePlatformChart(trendsData.platform_distribution);
        updateStats(trendsData);

        const wordCloudResponse = await fetch(`${API_BASE}/api/analytics/wordcloud?days=7`);
        const wordCloudData = await wordCloudResponse.json();
        updateWordCloud(wordCloudData.wordcloud);

        const geoResponse = await fetch(`${API_BASE}/api/analytics/geography?days=30`);
        const geoData = await geoResponse.json();
        updateGeography(geoData.locations);

        const postsResponse = await fetch(`${API_BASE}/api/posts/?size=10`);
        const postsData = await postsResponse.json();
        updatePostsList(postsData.posts);
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

function updateTrendChart(data) {
    trendChart.data.labels = data.time_series.map(item => {
        const date = new Date(item.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    trendChart.data.datasets[0].data = data.time_series.map(item => item.count);
    trendChart.data.datasets[1].data = data.time_series.map(item => item.avg_sentiment);
    trendChart.update();
}

function updateSentimentChart(distribution) {
    const sentimentMap = { 'positive': 0, 'neutral': 1, 'negative': 2 };
    distribution.forEach(item => {
        const index = sentimentMap[item.sentiment];
        if (index !== undefined) {
            sentimentChart.data.datasets[0].data[index] = item.count;
        }
    });
    sentimentChart.update();

    const total = sentimentChart.data.datasets[0].data.reduce((a, b) => a + b, 0);
    if (total > 0) {
        document.getElementById('positiveSentiment').textContent =
            Math.round((sentimentChart.data.datasets[0].data[0] / total) * 100) + '%';
        document.getElementById('negativeSentiment').textContent =
            Math.round((sentimentChart.data.datasets[0].data[2] / total) * 100) + '%';
    }
}

function updatePlatformChart(distribution) {
    const platformMap = { 'twitter': 0, 'reddit': 1, 'telegram': 2 };
    distribution.forEach(item => {
        const index = platformMap[item.platform];
        if (index !== undefined) {
            platformChart.data.datasets[0].data[index] = item.count;
        }
    });
    platformChart.update();
}

function updateStats(data) {
    const total = data.time_series.reduce((sum, item) => sum + item.count, 0);
    document.getElementById('totalPosts').textContent = total;
}

function updateWordCloud(wordcloud) {
    const container = document.getElementById('wordCloud');
    container.innerHTML = '';

    if (wordcloud.length === 0) {
        container.innerHTML = '<div class="text-gray-400">暂无数据</div>';
        return;
    }

    const maxCount = Math.max(...wordcloud.map(item => item.count));
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

    wordcloud.forEach(item => {
        const span = document.createElement('span');
        const fontSize = 12 + (item.count / maxCount) * 24;
        const color = colors[Math.floor(Math.random() * colors.length)];
        span.textContent = item.word;
        span.style.fontSize = `${fontSize}px`;
        span.style.color = color;
        span.style.opacity = 0.6 + (item.count / maxCount) * 0.4;
        span.className = 'px-2 py-1';
        container.appendChild(span);
    });
}

function updateGeography(locations) {
    const stats = document.getElementById('locationStats');
    if (locations.length === 0) {
        stats.textContent = '暂无地理位置数据';
    } else {
        const uniqueLocations = new Set(locations.map(loc => `${loc.lat.toFixed(2)},${loc.lon.toFixed(2)}`));
        stats.textContent = `已收集 ${locations.length} 条带地理位置的帖子，覆盖 ${uniqueLocations.size} 个区域`;
    }
}

function updatePostsList(posts) {
    const container = document.getElementById('postsList');
    container.innerHTML = '';

    if (posts.length === 0) {
        container.innerHTML = '<div class="text-gray-400 text-center py-8">暂无帖子</div>';
        return;
    }

    posts.forEach(post => {
        const div = document.createElement('div');
        div.className = 'post-item bg-gray-700 rounded-lg p-4 border border-gray-600';

        const sentimentClass = `sentiment-${post.sentiment_label}`;
        const sentimentIcon = post.sentiment_label === 'positive' ? '😊' :
                               post.sentiment_label === 'negative' ? '😠' : '😐';

        div.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                    <span class="platform-badge platform-${post.platform}">${post.platform.toUpperCase()}</span>
                    <span class="text-sm text-gray-400">@${post.author || 'anonymous'}</span>
                </div>
                <span class="${sentimentClass}">${sentimentIcon} ${(post.sentiment_score * 100).toFixed(0)}%</span>
            </div>
            <p class="text-gray-200 mb-2">${post.content}</p>
            <div class="flex flex-wrap gap-1 mb-2">
                ${post.entities.slice(0, 5).map(e => `<span class="text-xs bg-gray-600 px-2 py-1 rounded">${e}</span>`).join('')}
            </div>
            <div class="text-xs text-gray-500">${new Date(post.created_at).toLocaleString('zh-CN')}</div>
        `;
        container.appendChild(div);
    });
}

function setupEventListeners() {
    document.getElementById('crawlBtn').addEventListener('click', async () => {
        const platform = document.getElementById('platform').value;
        const keyword = document.getElementById('keyword').value;
        const limit = parseInt(document.getElementById('limit').value);

        if (!keyword) {
            alert('请输入关键词');
            return;
        }

        const btn = document.getElementById('crawlBtn');
        btn.disabled = true;
        btn.textContent = '采集中...';
        btn.classList.add('loading');

        try {
            const response = await fetch(`${API_BASE}/api/crawlers/crawl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, keyword, limit })
            });
            const data = await response.json();
            alert(`成功采集 ${data.crawled_count} 条数据！`);
            loadDashboardData();
        } catch (error) {
            alert('采集失败: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '开始采集';
            btn.classList.remove('loading');
        }
    });

    document.getElementById('addMonitorBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('monitorKeyword').value;
        if (!keyword) {
            alert('请输入关键词');
            return;
        }

        try {
            await fetch(`${API_BASE}/api/alerts/keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword, user_id: 'default_user', alert_threshold: 0.7, is_active: true })
            });
            document.getElementById('monitorKeyword').value = '';
            loadMonitoredKeywords();
            showAlert(`已添加监控关键词: ${keyword}`);
        } catch (error) {
            alert('添加失败: ' + error.message);
        }
    });

    document.getElementById('closeAlert').addEventListener('click', () => {
        document.getElementById('alertModal').classList.add('hidden');
        document.getElementById('alertModal').classList.remove('flex');
    });

    document.getElementById('rumorDetectBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('rumorKeyword').value;
        const days = document.getElementById('rumorDays').value;

        if (!keyword) {
            alert('请输入关键词');
            return;
        }

        const btn = document.getElementById('rumorDetectBtn');
        btn.disabled = true;
        btn.textContent = '检测中...';

        try {
            const response = await fetch(`${API_BASE}/api/advanced/rumor/detect?keyword=${encodeURIComponent(keyword)}&days=${days}`);
            const data = await response.json();
            displayRumorResult(data);
        } catch (error) {
            alert('检测失败: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '开始检测';
        }
    });

    document.getElementById('influenceAnalyzeBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('influenceKeyword').value;
        const days = document.getElementById('influenceDays').value;

        if (!keyword) {
            alert('请输入关键词');
            return;
        }

        const btn = document.getElementById('influenceAnalyzeBtn');
        btn.disabled = true;
        btn.textContent = '分析中...';

        try {
            const response = await fetch(`${API_BASE}/api/advanced/influence/analyze?keyword=${encodeURIComponent(keyword)}&days=${days}`);
            const data = await response.json();
            displayInfluenceResult(data);
        } catch (error) {
            alert('分析失败: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '分析影响力';
        }
    });

    document.getElementById('generateReportBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('reportKeyword').value;
        const days = document.getElementById('reportDays').value;

        if (!keyword) {
            alert('请输入关键词');
            return;
        }

        const btn = document.getElementById('generateReportBtn');
        btn.disabled = true;
        btn.textContent = '生成中...';
        document.getElementById('reportStatus').innerHTML = '<div class="text-gray-400">正在生成报告，请稍候...</div>';

        try {
            const response = await fetch(`${API_BASE}/api/advanced/report/generate?keyword=${encodeURIComponent(keyword)}&days=${days}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `舆情分析报告_${keyword}_${new Date().toISOString().slice(0,10)}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                document.getElementById('reportStatus').innerHTML = '<div class="text-green-400">✓ 报告生成成功并下载</div>';
            } else {
                const error = await response.json();
                throw new Error(error.detail || '生成失败');
            }
        } catch (error) {
            document.getElementById('reportStatus').innerHTML = `<div class="text-red-400">✗ ${error.message}</div>`;
        } finally {
            btn.disabled = false;
            btn.textContent = '生成PDF报告';
        }
    });
}

function displayRumorResult(data) {
    const container = document.getElementById('rumorResult');

    if (data.status === 'insufficient_data') {
        container.innerHTML = `
            <div class="text-yellow-400 text-sm">
                ⚠️ ${data.message}<br>
                已收集: ${data.posts_collected} 条<br>
                需要至少: ${data.minimum_required} 条
            </div>
        `;
        return;
    }

    const rumor = data.rumor_detection;
    const riskColor = rumor.risk_level === 'high' ? 'text-red-400' :
                     rumor.risk_level === 'medium' ? 'text-orange-400' : 'text-green-400';
    const riskIcon = rumor.risk_level === 'high' ? '🔴' :
                    rumor.risk_level === 'medium' ? '🟡' : '🟢';

    container.innerHTML = `
        <div class="space-y-2 text-sm">
            <div class="${riskColor} font-semibold">
                ${riskIcon} 风险等级: ${rumor.risk_level.toUpperCase()}
            </div>
            <div class="text-gray-300">
                📊 谣言指数: ${(rumor.rumor_score * 100).toFixed(1)}%
            </div>
            <div class="text-gray-300">
                📝 分析帖子: ${data.posts_analyzed} 条
            </div>
            <div class="text-gray-400">
                置信度: ${rumor.confidence}
            </div>
            ${rumor.suspicious_patterns.length > 0 ? `
                <div class="mt-2 pt-2 border-t border-gray-700">
                    <div class="text-orange-400 mb-1">⚠️ 可疑模式:</div>
                    ${rumor.suspicious_patterns.map(p => `<span class="inline-block bg-orange-900 text-orange-200 px-2 py-1 rounded text-xs mr-1 mb-1">${p}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function displayInfluenceResult(data) {
    const container = document.getElementById('influenceResult');

    if (data.status === 'no_data') {
        container.innerHTML = `<div class="text-yellow-400 text-sm">⚠️ ${data.message}</div>`;
        return;
    }

    const influence = data.influence_summary;
    const levelColors = {
        'global': 'text-purple-400',
        'national': 'text-blue-400',
        'regional': 'text-green-400',
        'local': 'text-yellow-400',
        'negligible': 'text-gray-400'
    };

    container.innerHTML = `
        <div class="space-y-2 text-sm">
            <div class="${levelColors[influence.influence_level] || 'text-gray-400'} font-semibold">
                影响力等级: ${influence.influence_level.toUpperCase()}
            </div>
            <div class="text-gray-300">
                👥 总覆盖人数: ${influence.total_reach.toLocaleString()}
            </div>
            <div class="text-gray-300">
                👁️ 预估曝光: ${influence.estimated_impressions.toLocaleString()}
            </div>
            <div class="text-gray-300">
                💬 互动率: ${influence.engagement_rate.toFixed(2)}%
            </div>
            <div class="text-gray-300">
                🦠 病毒传播指数: ${(influence.virality_score * 100).toFixed(1)}%
            </div>
            <div class="text-gray-400 text-xs mt-2">
                分析样本: ${data.posts_analyzed} 条帖子
            </div>
        </div>
    `;
}

async function loadMonitoredKeywords() {
    try {
        const response = await fetch(`${API_BASE}/api/alerts/keywords/default_user`);
        const data = await response.json();
        monitoredKeywords = data.keywords;
        renderMonitoredKeywords();
    } catch (error) {
        console.error('加载监控关键词失败:', error);
    }
}

function renderMonitoredKeywords() {
    const container = document.getElementById('monitoredKeywords');
    container.innerHTML = '';

    monitoredKeywords.forEach(item => {
        const div = document.createElement('div');
        div.className = 'keyword-tag bg-purple-600 text-white px-3 py-1 rounded-full flex items-center gap-2';
        div.innerHTML = `
            <span>${item.keyword}</span>
            <button class="text-purple-200 hover:text-white" onclick="removeKeyword('${item.id}')">×</button>
        `;
        container.appendChild(div);
    });
}

async function removeKeyword(id) {
    try {
        await fetch(`${API_BASE}/api/alerts/keywords/${id}`, { method: 'DELETE' });
        loadMonitoredKeywords();
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

function showAlert(message) {
    document.getElementById('alertContent').textContent = message;
    document.getElementById('alertModal').classList.remove('hidden');
    document.getElementById('alertModal').classList.add('flex');
}
