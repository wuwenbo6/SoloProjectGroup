class RegistrationReportGenerator {
    constructor() {
        this.chartInstances = [];
    }

    generateQualityReport(stats, result, sourceInfo, targetInfo) {
        const dateStr = new Date().toLocaleString();
        
        const histogramData = this.prepareHistogramData(stats);
        const qualityGrade = this.getQualityGrade(stats);
        
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>点云配准质量评估报告</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #eee;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .header h1 {
            color: #e94560;
            font-size: 28px;
            margin-bottom: 10px;
        }
        .header .date {
            color: #888;
            font-size: 14px;
        }
        .grade-badge {
            display: inline-block;
            padding: 10px 30px;
            border-radius: 50px;
            font-size: 24px;
            font-weight: bold;
            margin: 15px 0;
        }
        .grade-excellent { background: linear-gradient(45deg, #2ecc71, #27ae60); }
        .grade-good { background: linear-gradient(45deg, #3498db, #2980b9); }
        .grade-fair { background: linear-gradient(45deg, #f39c12, #e67e22); }
        .grade-poor { background: linear-gradient(45deg, #e74c3c, #c0392b); }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .card h2 {
            color: #e94560;
            font-size: 18px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .stat-row:last-child { border-bottom: none; }
        .stat-label { color: #888; }
        .stat-value { font-weight: 600; font-family: 'Monaco', monospace; }
        .stat-value.highlight { color: #e94560; }
        .chart-container {
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        .chart-wrapper {
            position: relative;
            height: 300px;
        }
        .full-width { grid-column: 1 / -1; }
        .info-box {
            background: rgba(233, 69, 96, 0.1);
            border-left: 4px solid #e94560;
            padding: 15px;
            border-radius: 0 8px 8px 0;
            margin: 10px 0;
        }
        .info-box h3 {
            color: #e94560;
            font-size: 14px;
            margin-bottom: 8px;
        }
        .info-box p {
            color: #aaa;
            font-size: 13px;
            line-height: 1.6;
        }
        .percentile-bar {
            height: 20px;
            background: rgba(255,255,255,0.1);
            border-radius: 10px;
            margin: 10px 0;
            position: relative;
            overflow: hidden;
        }
        .percentile-marker {
            position: absolute;
            height: 100%;
            width: 2px;
            background: #e94560;
            top: 0;
        }
        .percentile-label {
            position: absolute;
            top: -20px;
            transform: translateX(-50%);
            font-size: 10px;
            color: #888;
        }
        .error-scale {
            display: flex;
            height: 20px;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .error-segment { flex: 1; }
        .error-low { background: #2ecc71; }
        .error-medium { background: #f1c40f; }
        .error-high { background: #e74c3c; }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>点云配准质量评估报告</h1>
            <div class="date">生成时间: ${dateStr}</div>
            <div class="grade-badge grade-${qualityGrade.class}">
                ${qualityGrade.label}
            </div>
            <p style="color: #888; margin-top: 10px;">${qualityGrade.description}</p>
        </div>

        <div class="grid">
            <div class="card">
                <h2>📊 基本信息</h2>
                <div class="stat-row">
                    <span class="stat-label">源点云点数</span>
                    <span class="stat-value">${sourceInfo.count.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">目标点云点数</span>
                    <span class="stat-value">${targetInfo.count.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">有效对应点</span>
                    <span class="stat-value highlight">${stats.validCorrespondences.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">重叠率</span>
                    <span class="stat-value">${(stats.overlapRatio * 100).toFixed(2)}%</span>
                </div>
            </div>

            <div class="card">
                <h2>📈 核心指标</h2>
                <div class="stat-row">
                    <span class="stat-label">平均误差 (Mean)</span>
                    <span class="stat-value highlight">${stats.meanError.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">中位误差 (Median)</span>
                    <span class="stat-value">${stats.medianError.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">均方根误差 (RMSE)</span>
                    <span class="stat-value highlight">${stats.rmse.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">标准差 (Std Dev)</span>
                    <span class="stat-value">${stats.stdDev.toFixed(6)}</span>
                </div>
            </div>

            <div class="card">
                <h2>🎯 误差范围</h2>
                <div class="stat-row">
                    <span class="stat-label">最小误差</span>
                    <span class="stat-value">${stats.minError.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">最大误差</span>
                    <span class="stat-value highlight">${stats.maxError.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">25%分位数</span>
                    <span class="stat-value">${stats.q25.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">75%分位数</span>
                    <span class="stat-value">${stats.q75.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">95%分位数</span>
                    <span class="stat-value">${stats.q95.toFixed(6)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">99%分位数</span>
                    <span class="stat-value">${stats.q99.toFixed(6)}</span>
                </div>
            </div>

            <div class="card">
                <h2>⚠️ 异常点分析</h2>
                <div class="stat-row">
                    <span class="stat-label">异常点数量</span>
                    <span class="stat-value highlight">${stats.outlierCount.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">异常点比例</span>
                    <span class="stat-value">${(stats.outlierRatio * 100).toFixed(2)}%</span>
                </div>
                <div class="info-box">
                    <h3>检测方法</h3>
                    <p>使用3σ原则（均值+3倍标准差）作为异常点检测阈值。超出该阈值的点被判定为配准失败区域。</p>
                </div>
            </div>
        </div>

        <div class="card full-width">
            <h2>📉 误差分布直方图</h2>
            <div class="chart-container">
                <div class="chart-wrapper">
                    <canvas id="histogramChart"></canvas>
                </div>
            </div>
            <div class="error-scale">
                <div class="error-segment error-low" title="低误差"></div>
                <div class="error-segment error-medium" title="中误差"></div>
                <div class="error-segment error-high" title="高误差"></div>
            </div>
        </div>

        <div class="grid">
            <div class="card full-width">
                <h2>📐 误差分位分布</h2>
                <div class="percentile-bar">
                    <div class="percentile-marker" style="left: 25%;"><div class="percentile-label">Q25</div></div>
                    <div class="percentile-marker" style="left: 50%;"><div class="percentile-label">Median</div></div>
                    <div class="percentile-marker" style="left: 75%;"><div class="percentile-label">Q75</div></div>
                    <div class="percentile-marker" style="left: 95%;"><div class="percentile-label">Q95</div></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 25px; font-size: 12px; color: #888;">
                    <span>0 (最小误差)</span>
                    <span>${stats.maxError.toFixed(4)} (最大误差)</span>
                </div>
            </div>
        </div>

        <div class="card full-width">
            <h2>💡 评估结论</h2>
            <div class="info-box">
                <h3>质量评价</h3>
                <p>${this.generateConclusion(stats)}</p>
            </div>
            <div class="info-box" style="background: rgba(46, 204, 113, 0.1); border-left-color: #2ecc71;">
                <h3>优化建议</h3>
                <ul style="color: #aaa; font-size: 13px; line-height: 1.8; margin-left: 20px;">
                    ${this.generateRecommendations(stats).join('')}
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>点云配准质量评估系统 | 本报告由系统自动生成</p>
        </div>
    </div>

    <script>
        const histogramData = ${JSON.stringify(histogramData)};
        
        document.addEventListener('DOMContentLoaded', function() {
            const ctx = document.getElementById('histogramChart').getContext('2d');
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: histogramData.labels,
                    datasets: [{
                        label: '点数',
                        data: histogramData.counts,
                        backgroundColor: histogramData.colors,
                        borderColor: histogramData.colors.map(c => c.replace('0.7', '1')),
                        borderWidth: 1,
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return '点数: ' + context.raw;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            title: { display: true, text: '误差范围', color: '#888' },
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#888', maxRotation: 45 }
                        },
                        y: {
                            title: { display: true, text: '点数', color: '#888' },
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#888' }
                        }
                    }
                }
            });
        });
    </script>
</body>
</html>`;

        return html;
    }

    prepareHistogramData(stats) {
        const labels = stats.histogramBins.map(b => b.toFixed(5));
        const counts = stats.histogramCounts;
        const colors = [];

        const maxCount = Math.max(...counts);
        const threshold95 = stats.q95;

        for (let i = 0; i < stats.histogramBins.length; i++) {
            const binValue = stats.histogramBins[i];
            if (binValue <= stats.q75) {
                colors.push('rgba(46, 204, 113, 0.7)');
            } else if (binValue <= threshold95) {
                colors.push('rgba(241, 196, 15, 0.7)');
            } else {
                colors.push('rgba(231, 76, 60, 0.7)');
            }
        }

        return { labels, counts, colors };
    }

    getQualityGrade(stats) {
        if (stats.rmse < 0.005 && stats.outlierRatio < 0.02) {
            return { class: 'excellent', label: '优秀', description: '配准精度极高，结果可靠' };
        } else if (stats.rmse < 0.015 && stats.outlierRatio < 0.05) {
            return { class: 'good', label: '良好', description: '配准精度较高，符合预期' };
        } else if (stats.rmse < 0.03 && stats.outlierRatio < 0.1) {
            return { class: 'fair', label: '一般', description: '配准精度一般，需要进一步优化' };
        } else {
            return { class: 'poor', label: '较差', description: '配准精度较低，建议重新配准' };
        }
    }

    generateConclusion(stats) {
        let conclusion = '';
        
        conclusion += `本次配准共处理 ${stats.totalPoints.toLocaleString()} 个点，`;
        conclusion += `有效匹配 ${stats.validCorrespondences.toLocaleString()} 个点，`;
        conclusion += `点云重叠率为 ${(stats.overlapRatio * 100).toFixed(2)}%。`;
        
        conclusion += `配准平均误差为 ${stats.meanError.toFixed(6)}，`;
        conclusion += `RMSE为 ${stats.rmse.toFixed(6)}，`;
        conclusion += `95%的点误差小于 ${stats.q95.toFixed(6)}。`;
        
        conclusion += `检测到 ${stats.outlierCount.toLocaleString()} 个异常点，`;
        conclusion += `占比 ${(stats.outlierRatio * 100).toFixed(2)}%。`;
        
        return conclusion;
    }

    generateRecommendations(stats) {
        const recs = [];
        
        if (stats.outlierRatio > 0.05) {
            recs.push('<li>异常点比例较高，建议检查初始位姿或使用ICP精配准</li>');
        }
        
        if (stats.overlapRatio < 0.5) {
            recs.push('<li>点云重叠度较低，建议调整扫描位置或使用更多视角</li>');
        }
        
        if (stats.rmse > 0.02) {
            recs.push('<li>整体误差较大，建议增加更多的变形节点数进行优化</li>');
        }
        
        if (stats.maxError > stats.rmse * 5) {
            recs.push('<li>存在较大的误差峰值，建议进行异常点剔除后重新配准</li>');
        }
        
        if (recs.length === 0) {
            recs.push('<li>配准质量良好，无特别优化建议</li>');
        }
        
        return recs;
    }
}

module.exports = RegistrationReportGenerator;
