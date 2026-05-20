const API_BASE = 'http://localhost:8000';

let currentFileId = null;
let batchFiles = [];

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initUpload();
    initButtons();
    addHealthGradient();
});

function addHealthGradient() {
    const svg = document.querySelector('.health-circle');
    if (svg) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        gradient.setAttribute('id', 'healthGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '0%');
        
        const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', '#10b981');
        
        const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', '#667eea');
        
        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.insertBefore(defs, svg.firstChild);
    }
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tab).classList.add('active');
        });
    });
}

function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileUpload(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    const batchUploadArea = document.getElementById('batchUploadArea');
    const batchFileInput = document.getElementById('batchFileInput');
    
    batchUploadArea.addEventListener('click', () => batchFileInput.click());
    
    batchUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        batchUploadArea.classList.add('dragover');
    });
    
    batchUploadArea.addEventListener('dragleave', () => {
        batchUploadArea.classList.remove('dragover');
    });
    
    batchUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        batchUploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        addBatchFiles(files);
    });
    
    batchFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
        addBatchFiles(files);
    });
}

async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }
    
    showLoading('上传中...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE}/api/upload/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        currentFileId = result.file_id;
        
        showPreview(file, result.file_id);
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('上传失败，请检查后端服务是否启动！');
    } finally {
        hideLoading();
    }
}

function showPreview(file, fileId) {
    const previewSection = document.getElementById('previewSection');
    const previewImage = document.getElementById('previewImage');
    const fileName = document.getElementById('fileName');
    const resultsSection = document.getElementById('resultsSection');
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    fileName.textContent = file.name;
    previewSection.style.display = 'block';
    resultsSection.style.display = 'none';
    
    ['detection', 'classification', 'prediction'].forEach(id => {
        document.getElementById(id + 'Result').style.display = 'none';
    });
}

function initButtons() {
    document.getElementById('detectBtn').addEventListener('click', () => runDetection(currentFileId));
    document.getElementById('classifyBtn').addEventListener('click', () => runClassification(currentFileId));
    document.getElementById('predictBtn').addEventListener('click', () => runPrediction(currentFileId));
    document.getElementById('analyzeAllBtn').addEventListener('click', () => runCompleteAnalysis(currentFileId));
    document.getElementById('startBatchBtn').addEventListener('click', runBatchAnalysis);
}

async function runDetection(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    showLoading('污渍检测中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/detection/${fileId}`);
        const result = await response.json();
        
        showDetectionResult(result);
    } catch (error) {
        console.error('Detection error:', error);
        alert('检测失败！');
    } finally {
        hideLoading();
    }
}

function showDetectionResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const detectionResult = document.getElementById('detectionResult');
    const stainsList = document.getElementById('stainsList');
    
    document.getElementById('stainCount').textContent = result.total_stains;
    document.getElementById('detectionTime').textContent = result.processing_time;
    
    if (result.stains.length === 0) {
        stainsList.innerHTML = '<p style="text-align: center; color: #10b981; padding: 20px;">✓ 未检测到污渍，纸张很干净！</p>';
    } else {
        stainsList.innerHTML = result.stains.map(stain => `
            <div class="stain-item">
                <div class="stain-info">
                    <span class="stain-type ${stain.type}">${stain.type}</span>
                    <div class="stain-meta">
                        <span>置信度: ${(stain.confidence * 100).toFixed(1)}%</span>
                        <span>面积: ${stain.area.toFixed(2)}</span>
                    </div>
                </div>
                <span class="stain-severity ${stain.severity}">${stain.severity}</span>
            </div>
        `).join('');
    }
    
    resultsSection.style.display = 'block';
    detectionResult.style.display = 'block';
}

async function runClassification(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    showLoading('纸张分类中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/classification/${fileId}`);
        const result = await response.json();
        
        showClassificationResult(result);
    } catch (error) {
        console.error('Classification error:', error);
        alert('分类失败！');
    } finally {
        hideLoading();
    }
}

function showClassificationResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const classificationResult = document.getElementById('classificationResult');
    
    document.getElementById('paperType').textContent = result.paper_type;
    document.getElementById('confidenceValue').textContent = (result.confidence * 100).toFixed(1) + '%';
    document.getElementById('confidenceBar').style.width = (result.confidence * 100) + '%';
    document.getElementById('subType').textContent = result.sub_type || '-';
    
    const propertiesList = document.getElementById('propertiesList');
    const properties = result.properties;
    propertiesList.innerHTML = `
        <div class="property-item">
            <span class="property-label">亮度</span>
            <span class="property-value">${(properties.brightness * 100).toFixed(1)}%</span>
        </div>
        <div class="property-item">
            <span class="property-label">纹理粗糙度</span>
            <span class="property-value">${properties.texture_roughness}</span>
        </div>
        <div class="property-item">
            <span class="property-label">纤维可见度</span>
            <span class="property-value">${properties.fiber_visibility}</span>
        </div>
        <div class="property-item">
            <span class="property-label">色调</span>
            <span class="property-value">${properties.color_tone}</span>
        </div>
        <div class="property-item">
            <span class="property-label">估计厚度</span>
            <span class="property-value">${properties.estimated_thickness || '中等'}</span>
        </div>
    `;
    
    resultsSection.style.display = 'block';
    classificationResult.style.display = 'block';
}

async function runPrediction(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    showLoading('破损预测中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/prediction/${fileId}`);
        const result = await response.json();
        
        showPredictionResult(result);
    } catch (error) {
        console.error('Prediction error:', error);
        alert('预测失败！');
    } finally {
        hideLoading();
    }
}

function showPredictionResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const predictionResult = document.getElementById('predictionResult');
    
    document.getElementById('healthScore').textContent = Math.round(result.overall_health * 100);
    
    const healthRing = document.getElementById('healthRing');
    const circumference = 2 * Math.PI * 45;
    const offset = circumference * (1 - result.overall_health);
    healthRing.style.strokeDasharray = circumference;
    healthRing.style.strokeDashoffset = offset;
    
    const riskBadge = document.getElementById('riskLevel');
    riskBadge.textContent = '风险等级: ' + result.risk_level;
    
    if (result.risk_level === '高风险') {
        riskBadge.style.background = '#fee2e2';
        riskBadge.style.color = '#dc2626';
    } else if (result.risk_level === '中风险') {
        riskBadge.style.background = '#fef3c7';
        riskBadge.style.color = '#d97706';
    } else {
        riskBadge.style.background = '#dcfce7';
        riskBadge.style.color = '#16a34a';
    }
    
    const predictionsList = document.getElementById('predictionsList');
    predictionsList.innerHTML = result.predictions.map(pred => {
        let probClass = 'low';
        if (pred.probability > 0.6) probClass = 'high';
        else if (pred.probability > 0.3) probClass = 'medium';
        
        return `
            <div class="prediction-item">
                <div class="prediction-info">
                    <div class="prediction-type">${pred.damage_type}</div>
                    <div class="prediction-time">预计出现时间: ${pred.expected_time}</div>
                </div>
                <div class="prediction-meta">
                    <div class="probability-bar">
                        <div class="probability-fill ${probClass}" style="width: ${pred.probability * 100}%"></div>
                    </div>
                    <span class="prediction-severity ${pred.severity}">${pred.severity}</span>
                </div>
            </div>
        `;
    }).join('');
    
    resultsSection.style.display = 'block';
    predictionResult.style.display = 'block';
}

async function runCompleteAnalysis(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    showLoading('完整分析中...');
    
    try {
        await Promise.all([
            runDetectionSilent(fileId),
            runClassificationSilent(fileId),
            runPredictionSilent(fileId)
        ]);
    } catch (error) {
        console.error('Analysis error:', error);
        alert('分析失败！');
    } finally {
        hideLoading();
    }
}

async function runDetectionSilent(fileId) {
    const response = await fetch(`${API_BASE}/api/detection/${fileId}`);
    const result = await response.json();
    showDetectionResult(result);
}

async function runClassificationSilent(fileId) {
    const response = await fetch(`${API_BASE}/api/classification/${fileId}`);
    const result = await response.json();
    showClassificationResult(result);
}

async function runPredictionSilent(fileId) {
    const response = await fetch(`${API_BASE}/api/prediction/${fileId}`);
    const result = await response.json();
    showPredictionResult(result);
}

function addBatchFiles(files) {
    batchFiles = [...batchFiles, ...files];
    updateBatchFilesList();
}

function updateBatchFilesList() {
    const filesList = document.getElementById('batchFilesList');
    const filesContainer = document.getElementById('filesContainer');
    const selectedCount = document.getElementById('selectedCount');
    
    if (batchFiles.length === 0) {
        filesList.style.display = 'none';
        return;
    }
    
    selectedCount.textContent = batchFiles.length;
    
    filesContainer.innerHTML = batchFiles.map((file, index) => `
        <div class="batch-file-item">
            <span class="batch-file-name">${file.name}</span>
            <button class="remove-file-btn" onclick="removeBatchFile(${index})">×</button>
        </div>
    `).join('');
    
    filesList.style.display = 'block';
}

function removeBatchFile(index) {
    batchFiles.splice(index, 1);
    updateBatchFilesList();
}

async function runBatchAnalysis() {
    if (batchFiles.length === 0) {
        alert('请先选择要分析的图片！');
        return;
    }
    
    showLoading(`批量分析中... (0/${batchFiles.length})`);
    
    try {
        const formData = new FormData();
        batchFiles.forEach((file, index) => {
            formData.append('files', file);
        });
        
        const response = await fetch(`${API_BASE}/api/batch/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        showBatchResults(result);
        
    } catch (error) {
        console.error('Batch analysis error:', error);
        alert('批量分析失败！');
    } finally {
        hideLoading();
    }
}

function showBatchResults(result) {
    const batchResultsSection = document.getElementById('batchResultsSection');
    const batchResultsList = document.getElementById('batchResultsList');
    
    document.getElementById('totalFiles').textContent = result.total;
    document.getElementById('successCount').textContent = result.completed;
    document.getElementById('failCount').textContent = result.failed;
    document.getElementById('batchTime').textContent = result.processing_time + 's';
    
    batchResultsList.innerHTML = result.results.map(item => {
        if (item.status === 'completed') {
            return `
                <div class="batch-result-item success">
                    <div class="batch-result-header">
                        <span class="batch-result-filename">${item.filename}</span>
                        <span class="batch-result-status completed">完成</span>
                    </div>
                    <div class="batch-result-preview">
                        <div>
                            <h5>污渍检测</h5>
                            <div class="batch-mini-result">
                                检测到 <span class="value">${item.detection.total_stains}</span> 处污渍
                            </div>
                        </div>
                        <div>
                            <h5>纸张分类</h5>
                            <div class="batch-mini-result">
                                类型: <span class="value">${item.classification.paper_type}</span>
                                <br>置信度: ${(item.classification.confidence * 100).toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <h5>破损预测</h5>
                            <div class="batch-mini-result">
                                健康度: <span class="value">${(item.prediction.overall_health * 100).toFixed(0)}%</span>
                                <br>风险: ${item.prediction.risk_level}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="batch-result-item failed">
                    <div class="batch-result-header">
                        <span class="batch-result-filename">${item.filename}</span>
                        <span class="batch-result-status failed">失败</span>
                    </div>
                    <p style="color: #dc2626; margin-top: 10px;">错误: ${item.error}</p>
                </div>
            `;
        }
    }).join('');
    
    batchResultsSection.style.display = 'block';
}

function showLoading(text = '处理中...') {
    const overlay = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    initNewFeatureButtons();
    initWeatheringTab();
    initCompareTab();
    initRepairTab();
    initSliceTab();
});

function initNewFeatureButtons() {
    const weatheringBtn = document.getElementById('weatheringBtn');
    const repairBtn = document.getElementById('repairBtn');
    const sliceBtn = document.getElementById('sliceBtn');
    
    if (weatheringBtn) {
        weatheringBtn.addEventListener('click', () => runWeatheringPrediction(currentFileId));
    }
    if (repairBtn) {
        repairBtn.addEventListener('click', () => runRepairEstimation(currentFileId));
    }
    if (sliceBtn) {
        sliceBtn.addEventListener('click', () => runSliceAnalysis(currentFileId));
    }
}

function initWeatheringTab() {
    const uploadArea = document.getElementById('weatheringUploadArea');
    const fileInput = document.getElementById('weatheringFileInput');
    const startBtn = document.getElementById('startWeatheringBtn');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleWeatheringUpload(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleWeatheringUpload(e.target.files[0]);
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', () => runWeatheringPrediction(window.weatheringFileId));
    }
}

let weatheringFileId = null;

async function handleWeatheringUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }
    
    showLoading('上传中...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE}/api/upload/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        weatheringFileId = result.file_id;
        
        document.getElementById('weatheringOptions').style.display = 'block';
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('上传失败！');
    } finally {
        hideLoading();
    }
}

async function runWeatheringPrediction(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    const months = parseInt(document.getElementById('weatheringMonths')?.value || 24);
    
    showLoading('风化趋势预测中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/weathering-trend/${fileId}?prediction_months=${months}`);
        const result = await response.json();
        
        showWeatheringResult(result);
    } catch (error) {
        console.error('Weathering prediction error:', error);
        alert('风化趋势预测失败！');
    } finally {
        hideLoading();
    }
}

function showWeatheringResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const weatheringResult = document.getElementById('weatheringResult');
    
    document.getElementById('currentHealth').textContent = Math.round(result.current_health * 100);
    document.getElementById('predictionMonths').textContent = result.prediction_months;
    
    const trendChart = document.getElementById('trendChart');
    trendChart.innerHTML = `
        <div class="trend-points">
            ${result.trend_points.map(point => {
                const height = Math.max(10, point.health_score * 100);
                let colorClass = 'low';
                if (point.health_score < 0.5) colorClass = 'high';
                else if (point.health_score < 0.7) colorClass = 'medium';
                
                return `
                    <div class="trend-point">
                        <span class="trend-value">${Math.round(point.health_score * 100)}%</span>
                        <div class="trend-bar ${colorClass}" style="height: ${height}px;"></div>
                        <span class="trend-month">${point.month}月</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    const criticalPoints = document.getElementById('criticalPoints');
    if (result.critical_points.length === 0) {
        criticalPoints.innerHTML = '<p style="text-align: center; color: #10b981;">✓ 暂无关键风险点，状态良好</p>';
    } else {
        criticalPoints.innerHTML = result.critical_points.map(point => `
            <div class="critical-item">
                <h5>${point.type} - 第${point.month}个月</h5>
                <p>${point.description}</p>
            </div>
        `).join('');
    }
    
    const recommendations = document.getElementById('recommendations');
    recommendations.innerHTML = result.recommendations.map(rec => `
        <div class="recommendation-item">${rec}</div>
    `).join('');
    
    if (resultsSection) {
        resultsSection.style.display = 'block';
    }
    if (weatheringResult) {
        weatheringResult.style.display = 'block';
    }
    
    const tabResults = document.getElementById('weatheringTabResults');
    if (tabResults) {
        tabResults.innerHTML = `
            <div class="result-card">
                <h3>🌦 风化趋势预测结果</h3>
                <div class="result-summary">
                    <span class="badge info">当前健康度: ${Math.round(result.current_health * 100)}%</span>
                    <span class="badge time">预测周期: ${result.prediction_months}个月</span>
                </div>
                <div class="trend-chart">
                    <div class="trend-points">
                        ${result.trend_points.map(point => {
                            const height = Math.max(10, point.health_score * 100);
                            let colorClass = 'low';
                            if (point.health_score < 0.5) colorClass = 'high';
                            else if (point.health_score < 0.7) colorClass = 'medium';
                            
                            return `
                                <div class="trend-point">
                                    <span class="trend-value">${Math.round(point.health_score * 100)}%</span>
                                    <div class="trend-bar ${colorClass}" style="height: ${height}px;"></div>
                                    <span class="trend-month">${point.month}月</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <h4 style="margin-top: 20px;">养护建议</h4>
                <div class="recommendations-list">
                    ${result.recommendations.map(rec => `<div class="recommendation-item">${rec}</div>`).join('')}
                </div>
            </div>
        `;
        tabResults.style.display = 'block';
    }
}

function initCompareTab() {
    setupCompareUpload('compareUploadArea1', 'compareFileInput1', 'comparePreview1', 1);
    setupCompareUpload('compareUploadArea2', 'compareFileInput2', 'comparePreview2', 2);
    
    const startBtn = document.getElementById('startCompareBtn');
    if (startBtn) {
        startBtn.addEventListener('click', runComparison);
    }
}

let compareFile1 = null;
let compareFile2 = null;

function setupCompareUpload(areaId, inputId, previewId, index) {
    const uploadArea = document.getElementById(areaId);
    const fileInput = document.getElementById(inputId);
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleCompareUpload(files[0], index, previewId);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleCompareUpload(e.target.files[0], index, previewId);
            }
        });
    }
}

async function handleCompareUpload(file, index, previewId) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }
    
    showLoading('上传中...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE}/api/upload/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (index === 1) {
            compareFile1 = result.file_id;
        } else {
            compareFile2 = result.file_id;
        }
        
        const preview = document.getElementById(previewId);
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="预览"><p>${file.name}</p>`;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        
        if (compareFile1 && compareFile2) {
            document.getElementById('compareOptions').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('上传失败！');
    } finally {
        hideLoading();
    }
}

async function runComparison() {
    if (!compareFile1 || !compareFile2) {
        alert('请先上传两张图片！');
        return;
    }
    
    const timeDiff = document.getElementById('timeDiffDays')?.value || null;
    
    showLoading('图片对比分析中...');
    
    try {
        const formData = new FormData();
        formData.append('file1_id', compareFile1);
        formData.append('file2_id', compareFile2);
        if (timeDiff) {
            formData.append('time_diff_days', timeDiff);
        }
        
        const response = await fetch(`${API_BASE}/api/compare/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        showCompareResult(result);
    } catch (error) {
        console.error('Comparison error:', error);
        alert('对比分析失败！');
    } finally {
        hideLoading();
    }
}

function showCompareResult(result) {
    const resultsSection = document.getElementById('compareTabResults');
    
    resultsSection.innerHTML = `
        <div class="result-card">
            <h3>📊 多期对比分析结果</h3>
            <div class="result-summary">
                <span class="badge info">总体评估: ${result.overall_assessment}</span>
                <span class="badge time">处理耗时: ${result.processing_time}s</span>
            </div>
            <h4 style="margin-top: 20px;">关键指标变化</h4>
            <div class="properties-grid">
                <div class="property-item">
                    <span class="property-label">污渍数量变化</span>
                    <span class="property-value">${result.metrics.stain_count_change > 0 ? '+' : ''}${result.metrics.stain_count_change} 处</span>
                </div>
                <div class="property-item">
                    <span class="property-label">污渍面积变化</span>
                    <span class="property-value">${result.metrics.stain_area_change > 0 ? '+' : ''}${result.metrics.stain_area_change.toFixed(2)}</span>
                </div>
                <div class="property-item">
                    <span class="property-label">健康度变化</span>
                    <span class="property-value">${(result.metrics.health_score_change * 100).toFixed(1)}%</span>
                </div>
                <div class="property-item">
                    <span class="property-label">亮度变化</span>
                    <span class="property-value">${(result.metrics.brightness_change * 100).toFixed(1)}%</span>
                </div>
                <div class="property-item">
                    <span class="property-label">纹理变化</span>
                    <span class="property-value">${result.metrics.texture_change.toFixed(2)}</span>
                </div>
            </div>
            ${result.metrics.new_stains.length > 0 ? `
                <h4 style="margin-top: 20px;">新增污渍</h4>
                <div class="stains-list">
                    ${result.metrics.new_stains.map(stain => `
                        <div class="stain-item">
                            <div class="stain-info">
                                <span class="stain-type ${stain.type}">${stain.type}</span>
                                <span>面积: ${stain.area.toFixed(2)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${result.metrics.resolved_stains.length > 0 ? `
                <h4 style="margin-top: 20px;">已消除污渍</h4>
                <div class="stains-list">
                    ${result.metrics.resolved_stains.map(stain => `
                        <div class="stain-item">
                            <div class="stain-info">
                                <span class="stain-type ${stain.type}">${stain.type}</span>
                                <span>面积: ${stain.area.toFixed(2)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    resultsSection.style.display = 'block';
}

function initRepairTab() {
    const uploadArea = document.getElementById('repairUploadArea');
    const fileInput = document.getElementById('repairFileInput');
    const startBtn = document.getElementById('startRepairBtn');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleRepairUpload(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleRepairUpload(e.target.files[0]);
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', () => runRepairEstimation(window.repairFileId));
    }
}

let repairFileId = null;

async function handleRepairUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }
    
    showLoading('上传中...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE}/api/upload/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        repairFileId = result.file_id;
        
        document.getElementById('startRepairBtn').style.display = 'inline-block';
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('上传失败！');
    } finally {
        hideLoading();
    }
}

async function runRepairEstimation(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    showLoading('维修量估算中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/repair-estimate/${fileId}`);
        const result = await response.json();
        
        showRepairResult(result);
    } catch (error) {
        console.error('Repair estimation error:', error);
        alert('维修量估算失败！');
    } finally {
        hideLoading();
    }
}

function showRepairResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const repairResult = document.getElementById('repairResult');
    
    document.getElementById('totalCost').textContent = '¥' + result.total_estimated_cost.toFixed(2);
    document.getElementById('totalTime').textContent = result.total_estimated_time;
    
    const prioritySummary = document.getElementById('prioritySummary');
    prioritySummary.innerHTML = `
        <div class="priority-item high">高优先级: ${result.priority_summary['高'] || 0} 项</div>
        <div class="priority-item medium">中优先级: ${result.priority_summary['中'] || 0} 项</div>
        <div class="priority-item low">低优先级: ${result.priority_summary['低'] || 0} 项</div>
    `;
    
    const repairItemsList = document.getElementById('repairItemsList');
    repairItemsList.innerHTML = result.repair_items.map(item => `
        <div class="repair-item-card">
            <div class="repair-item-header">
                <span class="repair-item-type">${item.repair_type}</span>
                <span class="repair-item-priority ${item.priority}">${item.priority}优先级</span>
            </div>
            <div class="repair-item-details">
                <span>数量: ${item.quantity} ${item.unit}</span>
                <span>预估费用: ¥${item.estimated_cost.toFixed(2)}</span>
                <span>预估工时: ${item.estimated_time}</span>
            </div>
        </div>
    `).join('');
    
    const materialsList = document.getElementById('materialsList');
    materialsList.innerHTML = result.material_list.map(mat => `
        <div class="material-item">${mat.material} (${mat.required_for})</div>
    `).join('');
    
    if (resultsSection) {
        resultsSection.style.display = 'block';
    }
    if (repairResult) {
        repairResult.style.display = 'block';
    }
    
    const tabResults = document.getElementById('repairTabResults');
    if (tabResults) {
        tabResults.innerHTML = `
            <div class="result-card">
                <h3>🔧 维修量估算结果</h3>
                <div class="repair-summary">
                    <div class="repair-stat">
                        <span class="repair-label">预估费用</span>
                        <span class="repair-value">¥${result.total_estimated_cost.toFixed(2)}</span>
                    </div>
                    <div class="repair-stat">
                        <span class="repair-label">预估工时</span>
                        <span class="repair-value">${result.total_estimated_time}</span>
                    </div>
                </div>
                <h4>维修项目</h4>
                <div class="repair-items-list">
                    ${result.repair_items.map(item => `
                        <div class="repair-item-card">
                            <div class="repair-item-header">
                                <span class="repair-item-type">${item.repair_type}</span>
                                <span class="repair-item-priority ${item.priority}">${item.priority}优先级</span>
                            </div>
                            <div class="repair-item-details">
                                <span>数量: ${item.quantity} ${item.unit}</span>
                                <span>预估费用: ¥${item.estimated_cost.toFixed(2)}</span>
                                <span>预估工时: ${item.estimated_time}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        tabResults.style.display = 'block';
    }
}

function initSliceTab() {
    const uploadArea = document.getElementById('sliceUploadArea');
    const fileInput = document.getElementById('sliceFileInput');
    const startBtn = document.getElementById('startSliceBtn');
    
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', () => fileInput.click());
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleSliceUpload(files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleSliceUpload(e.target.files[0]);
            }
        });
    }
    
    if (startBtn) {
        startBtn.addEventListener('click', () => runSliceAnalysis(window.sliceFileId));
    }
}

let sliceFileId = null;

async function handleSliceUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件！');
        return;
    }
    
    showLoading('上传中...');
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE}/api/upload/`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        sliceFileId = result.file_id;
        
        document.getElementById('sliceOptions').style.display = 'block';
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('上传失败！');
    } finally {
        hideLoading();
    }
}

async function runSliceAnalysis(fileId) {
    if (!fileId) {
        alert('请先上传图片！');
        return;
    }
    
    const rows = parseInt(document.getElementById('sliceRows')?.value || 4);
    const cols = parseInt(document.getElementById('sliceCols')?.value || 4);
    
    showLoading('模型切片分析中...');
    
    try {
        const response = await fetch(`${API_BASE}/api/model-slice/${fileId}?grid_rows=${rows}&grid_cols=${cols}`);
        const result = await response.json();
        
        showSliceResult(result);
    } catch (error) {
        console.error('Slice analysis error:', error);
        alert('模型切片分析失败！');
    } finally {
        hideLoading();
    }
}

function showSliceResult(result) {
    const resultsSection = document.getElementById('resultsSection');
    const sliceResult = document.getElementById('sliceResult');
    
    document.getElementById('gridSize').textContent = `${result.grid_size.rows}×${result.grid_size.cols}`;
    
    const heatmapContainer = document.getElementById('heatmapContainer');
    let heatmapHTML = '<div class="heatmap-grid" style="grid-template-columns: repeat(' + result.grid_size.cols + ', 1fr);">';
    
    result.slices.forEach(slice => {
        const health = slice.local_health;
        let bgColor = 'rgb(16, 185, 129)'; 
        if (health < 0.5) {
            bgColor = 'rgb(220, 38, 38)';
        } else if (health < 0.7) {
            bgColor = 'rgb(245, 158, 11)';
        }
        
        heatmapHTML += `
            <div class="heatmap-cell" style="background-color: ${bgColor};" title="区域${slice.slice_id} - 健康度: ${(health * 100).toFixed(0)}%">
                ${(health * 100).toFixed(0)}%
            </div>
        `;
    });
    
    heatmapHTML += '</div>';
    heatmapContainer.innerHTML = heatmapHTML;
    
    const highRiskAreas = document.getElementById('highRiskAreas');
    if (result.high_risk_areas.length === 0) {
        highRiskAreas.innerHTML = '<p style="text-align: center; color: #10b981;">✓ 无高风险区域，整体状态良好</p>';
    } else {
        highRiskAreas.innerHTML = result.high_risk_areas.map(area => `
            <div class="high-risk-item">
                <h5>${area.slice_id}</h5>
                <p>${area.reason}</p>
            </div>
        `).join('');
    }
    
    const sliceStats = document.getElementById('sliceStats');
    sliceStats.innerHTML = `
        <div class="slice-stat-item">
            <span class="slice-stat-label">总切片数</span>
            <span class="slice-stat-value">${result.overall_summary.total_slices}</span>
        </div>
        <div class="slice-stat-item">
            <span class="slice-stat-label">高风险区域</span>
            <span class="slice-stat-value">${result.overall_summary.high_risk_count}</span>
        </div>
        <div class="slice-stat-item">
            <span class="slice-stat-label">平均健康度</span>
            <span class="slice-stat-value">${(result.overall_summary.average_health_score * 100).toFixed(0)}%</span>
        </div>
        <div class="slice-stat-item">
            <span class="slice-stat-label">总污渍数</span>
            <span class="slice-stat-value">${result.overall_summary.total_stains_detected}</span>
        </div>
    `;
    
    if (resultsSection) {
        resultsSection.style.display = 'block';
    }
    if (sliceResult) {
        sliceResult.style.display = 'block';
    }
    
    const tabResults = document.getElementById('sliceTabResults');
    if (tabResults) {
        tabResults.innerHTML = `
            <div class="result-card">
                <h3>🧩 模型切片分析结果</h3>
                <div class="slice-summary">
                    <span class="badge info">网格: ${result.grid_size.rows}×${result.grid_size.cols}</span>
                    <span class="badge ${result.overall_summary.overall_risk_level === '高风险' ? 'error' : 'success'}">
                        整体风险: ${result.overall_summary.overall_risk_level}
                    </span>
                </div>
                <div class="heatmap-container">
                    ${heatmapHTML}
                </div>
                <div class="slice-stats">
                    <div class="slice-stat-item">
                        <span class="slice-stat-label">总切片数</span>
                        <span class="slice-stat-value">${result.overall_summary.total_slices}</span>
                    </div>
                    <div class="slice-stat-item">
                        <span class="slice-stat-label">高风险区域</span>
                        <span class="slice-stat-value">${result.overall_summary.high_risk_count}</span>
                    </div>
                    <div class="slice-stat-item">
                        <span class="slice-stat-label">平均健康度</span>
                        <span class="slice-stat-value">${(result.overall_summary.average_health_score * 100).toFixed(0)}%</span>
                    </div>
                    <div class="slice-stat-item">
                        <span class="slice-stat-label">总污渍数</span>
                        <span class="slice-stat-value">${result.overall_summary.total_stains_detected}</span>
                    </div>
                </div>
            </div>
        `;
        tabResults.style.display = 'block';
    }
}

