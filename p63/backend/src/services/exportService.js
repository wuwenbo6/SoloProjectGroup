const fs = require('fs');
const path = require('path');

const generateTextExport = (rubbing, options = {}) => {
  const { 
    includeConfidence = true, 
    includeStatus = true,
    includeHistory = false
  } = options;
  
  let content = '';
  
  content += '='.repeat(60) + '\n';
  content += '金石拓片释读报告\n';
  content += '='.repeat(60) + '\n\n';
  
  content += `【拓片名称】${rubbing.title}\n`;
  content += `【上传时间】${new Date(rubbing.createdAt).toLocaleString('zh-CN')}\n`;
  content += `【拓片状态】${rubbing.status}\n`;
  if (rubbing.dynasty) content += `【所属朝代】${rubbing.dynasty}\n`;
  if (rubbing.location) content += `【出土地点】${rubbing.location}\n`;
  if (rubbing.material) content += `【材质类型】${rubbing.material}\n`;
  content += '\n';
  
  const totalChars = rubbing.characters?.length || 0;
  const confirmedChars = rubbing.characters?.filter(c => c.status === 'confirmed').length || 0;
  const pendingChars = rubbing.characters?.filter(c => c.status === 'pending').length || 0;
  const disputedChars = rubbing.characters?.filter(c => c.status === 'disputed').length || 0;
  const avgConfidence = totalChars > 0 
    ? (rubbing.characters.reduce((sum, c) => sum + (c.confidence || 0), 0) / totalChars).toFixed(1)
    : 0;
  
  content += '【释读统计】\n';
  content += `  总文字数: ${totalChars} 字\n`;
  content += `  已确认: ${confirmedChars} 字\n`;
  content += `  待释读: ${pendingChars} 字\n`;
  content += `  有争议: ${disputedChars} 字\n`;
  content += `  释读进度: ${rubbing.progress || 0}%\n`;
  content += `  平均置信度: ${avgConfidence}%\n`;
  content += '\n';
  
  content += '-'.repeat(60) + '\n';
  content += '【释读内容】\n\n';
  
  if (rubbing.characters && rubbing.characters.length > 0) {
    const sortedChars = [...rubbing.characters].sort((a, b) => {
      if (a.boundingBox && b.boundingBox) {
        if (a.boundingBox.y !== b.boundingBox.y) {
          return a.boundingBox.y - b.boundingBox.y;
        }
        return a.boundingBox.x - b.boundingBox.x;
      }
      return 0;
    });
    
    let line = '';
    let lastY = null;
    
    for (let i = 0; i < sortedChars.length; i++) {
      const char = sortedChars[i];
      const text = char.interpretText || char.recognizedText || '□';
      const y = char.boundingBox?.y || 0;
      
      if (lastY !== null && Math.abs(y - lastY) > 30) {
        content += line + '\n';
        line = '';
      }
      
      line += text;
      
      if (includeStatus) {
        const statusMark = {
          confirmed: '',
          pending: '?',
          disputed: '*'
        }[char.status] || '?';
        line += statusMark;
      }
      
      if (includeConfidence && char.confidence) {
        line += `[${Math.round(char.confidence)}%]`;
      }
      
      line += ' ';
      lastY = y;
    }
    
    if (line) content += line + '\n';
    content += '\n';
    
    content += '【逐字说明】\n\n';
    for (let i = 0; i < sortedChars.length; i++) {
      const char = sortedChars[i];
      const seq = String(i + 1).padStart(3, '0');
      const text = char.interpretText || char.recognizedText || '未识别';
      const status = {
        confirmed: '已确认',
        pending: '待释读',
        disputed: '有争议'
      }[char.status] || '未知';
      
      content += `${seq}. ${text}`;
      if (includeConfidence && char.confidence) {
        content += ` (置信度: ${char.confidence.toFixed(1)}%)`;
      }
      content += ` [${status}]\n`;
      
      if (char.interpretText && char.recognizedText && char.interpretText !== char.recognizedText) {
        content += `     识别结果: ${char.recognizedText}\n`;
      }
      
      if (char.alternatives && char.alternatives.length > 0) {
        content += `     候选字: ${char.alternatives.join(', ')}\n`;
      }
    }
  } else {
    content += '暂无释读内容\n';
  }
  
  content += '\n' + '='.repeat(60) + '\n';
  content += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
  content += '本报告由金石拓片释读平台自动生成\n';
  
  return content;
};

const generateHTMLExport = (rubbing, options = {}) => {
  const { includeImage = true } = options;
  
  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${rubbing.title} - 拓片释读报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'SimSun', 'Songti SC', serif; 
      max-width: 1000px; 
      margin: 0 auto; 
      padding: 40px 20px;
      background: #faf8f5;
    }
    .header { 
      text-align: center; 
      margin-bottom: 40px;
      border-bottom: 3px double #8b4513;
      padding-bottom: 20px;
    }
    .title { 
      font-size: 32px; 
      font-weight: bold; 
      color: #333;
      margin-bottom: 10px;
    }
    .subtitle { 
      font-size: 14px; 
      color: #666; 
    }
    .meta-section {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .meta-item {
      display: flex;
      align-items: center;
    }
    .meta-label {
      font-weight: bold;
      color: #8b4513;
      margin-right: 10px;
      min-width: 80px;
    }
    .meta-value {
      color: #333;
    }
    .stats-section {
      background: linear-gradient(135deg, #f5f0e6 0%, #e8dfd0 100%);
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .stats-title {
      font-size: 18px;
      font-weight: bold;
      color: #8b4513;
      margin-bottom: 15px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      text-align: center;
    }
    .stat-item {
      background: #fff;
      padding: 15px;
      border-radius: 6px;
    }
    .stat-number {
      font-size: 28px;
      font-weight: bold;
      color: #8b4513;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
    }
    .progress-bar {
      height: 8px;
      background: #ddd;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #8b4513, #d4a574);
      width: ${rubbing.progress || 0}%;
    }
    .content-section {
      background: #fff;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .section-title {
      font-size: 20px;
      font-weight: bold;
      color: #8b4513;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #d4a574;
    }
    .characters-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
    }
    .char-card {
      width: 80px;
      text-align: center;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid #ddd;
    }
    .char-card.confirmed {
      background: #f0fff4;
      border-color: #48bb78;
    }
    .char-card.pending {
      background: #f7fafc;
      border-color: #a0aec0;
    }
    .char-card.disputed {
      background: #fff5f5;
      border-color: #fc8181;
    }
    .char-text {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .char-conf {
      font-size: 11px;
      color: #666;
    }
    .char-status {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
      margin-top: 5px;
    }
    .char-status.confirmed {
      background: #c6f6d5;
      color: #22543d;
    }
    .char-status.pending {
      background: #e2e8f0;
      color: #2d3748;
    }
    .char-status.disputed {
      background: #fed7d7;
      color: #742a2a;
    }
    .detail-section {
      background: #fff;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
    }
    .detail-table th, .detail-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    .detail-table th {
      background: #f5f0e6;
      font-weight: bold;
      color: #8b4513;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      color: #666;
      font-size: 12px;
    }
    .rubbing-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .image-container {
      text-align: center;
      margin-bottom: 30px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${rubbing.title}</div>
    <div class="subtitle">金石拓片释读报告</div>
  </div>
  
  ${includeImage && rubbing.processedImage ? `
  <div class="image-container">
    <img src="${rubbing.processedImage}" alt="拓片图像" class="rubbing-image" />
  </div>
  ` : ''}
  
  <div class="meta-section">
    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">上传时间:</span>
        <span class="meta-value">${new Date(rubbing.createdAt).toLocaleString('zh-CN')}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">当前状态:</span>
        <span class="meta-value">${rubbing.status}</span>
      </div>
      ${rubbing.dynasty ? `<div class="meta-item">
        <span class="meta-label">所属朝代:</span>
        <span class="meta-value">${rubbing.dynasty}</span>
      </div>` : ''}
      ${rubbing.location ? `<div class="meta-item">
        <span class="meta-label">出土地点:</span>
        <span class="meta-value">${rubbing.location}</span>
      </div>` : ''}
    </div>
  </div>
  
  <div class="stats-section">
    <div class="stats-title">释读统计</div>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-number">${rubbing.characters?.length || 0}</div>
        <div class="stat-label">总文字数</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${rubbing.characters?.filter(c => c.status === 'confirmed').length || 0}</div>
        <div class="stat-label">已确认</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${rubbing.characters?.filter(c => c.status === 'pending').length || 0}</div>
        <div class="stat-label">待释读</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">${rubbing.progress || 0}%</div>
        <div class="stat-label">完成进度</div>
      </div>
    </div>
    <div class="progress-bar">
      <div class="progress-fill"></div>
    </div>
  </div>
  
  <div class="content-section">
    <div class="section-title">释读文字</div>
    <div class="characters-grid">
      ${(rubbing.characters || []).map(char => `
        <div class="char-card ${char.status || 'pending'}">
          <div class="char-text">${char.interpretText || char.recognizedText || '□'}</div>
          ${char.confidence ? `<div class="char-conf">${Math.round(char.confidence)}%</div>` : ''}
          <span class="char-status ${char.status || 'pending'}">${
            { confirmed: '已确认', pending: '待释读', disputed: '有争议' }[char.status] || '未知'
          }</span>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="detail-section">
    <div class="section-title">逐字详情</div>
    <table class="detail-table">
      <thead>
        <tr>
          <th>序号</th>
          <th>文字</th>
          <th>识别结果</th>
          <th>释读结果</th>
          <th>置信度</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${(rubbing.characters || []).map((char, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${char.interpretText || char.recognizedText || '□'}</strong></td>
            <td>${char.recognizedText || '-'}</td>
            <td>${char.interpretText || '-'}</td>
            <td>${char.confidence ? char.confidence.toFixed(1) + '%' : '-'}</td>
            <td>${{ confirmed: '已确认', pending: '待释读', disputed: '有争议' }[char.status] || '未知'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
  
  <div class="footer">
    <p>本报告由金石拓片释读平台自动生成</p>
    <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
  </div>
</body>
</html>`;
  
  return html;
};

const exportAsText = async (rubbing, outputPath, options = {}) => {
  const content = generateTextExport(rubbing, options);
  await fs.promises.writeFile(outputPath, content, 'utf8');
  return { success: true, path: outputPath, size: content.length };
};

const exportAsHTML = async (rubbing, outputPath, options = {}) => {
  const content = generateHTMLExport(rubbing, options);
  await fs.promises.writeFile(outputPath, content, 'utf8');
  return { success: true, path: outputPath, size: content.length };
};

const exportAsCSV = async (rubbing, outputPath, options = {}) => {
  let csv = '\ufeff序号,识别文字,释读文字,置信度,状态,位置X,位置Y,宽度,高度\n';
  
  (rubbing.characters || []).forEach((char, idx) => {
    const row = [
      idx + 1,
      `"${char.recognizedText || ''}"`,
      `"${char.interpretText || ''}"`,
      char.confidence?.toFixed(1) || '',
      `"${{ confirmed: '已确认', pending: '待释读', disputed: '有争议' }[char.status] || '未知'}"`,
      char.boundingBox?.x || '',
      char.boundingBox?.y || '',
      char.boundingBox?.width || '',
      char.boundingBox?.height || ''
    ];
    csv += row.join(',') + '\n';
  });
  
  await fs.promises.writeFile(outputPath, csv, 'utf8');
  return { success: true, path: outputPath, size: csv.length };
};

const exportAsJSON = async (rubbing, outputPath, options = {}) => {
  const exportData = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    rubbing: {
      id: rubbing._id,
      title: rubbing.title,
      description: rubbing.description,
      dynasty: rubbing.dynasty,
      location: rubbing.location,
      material: rubbing.material,
      status: rubbing.status,
      progress: rubbing.progress,
      createdAt: rubbing.createdAt,
      originalImage: rubbing.originalImage,
      processedImage: rubbing.processedImage
    },
    characters: (rubbing.characters || []).map(char => ({
      charId: char.charId,
      recognizedText: char.recognizedText,
      interpretText: char.interpretText,
      confidence: char.confidence,
      status: char.status,
      alternatives: char.alternatives,
      boundingBox: char.boundingBox
    })),
    statistics: {
      total: rubbing.characters?.length || 0,
      confirmed: rubbing.characters?.filter(c => c.status === 'confirmed').length || 0,
      pending: rubbing.characters?.filter(c => c.status === 'pending').length || 0,
      disputed: rubbing.characters?.filter(c => c.status === 'disputed').length || 0
    }
  };
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  await fs.promises.writeFile(outputPath, jsonStr, 'utf8');
  return { success: true, path: outputPath, size: jsonStr.length };
};

const getExportFormats = () => [
  { id: 'txt', name: '文本文件', description: '纯文本格式，适合快速查看', extension: '.txt' },
  { id: 'html', name: '网页格式', description: '丰富的格式展示，可直接打印', extension: '.html' },
  { id: 'csv', name: '表格格式', description: 'CSV格式，可导入Excel处理', extension: '.csv' },
  { id: 'json', name: '数据格式', description: 'JSON格式，适合程序处理', extension: '.json' }
];

module.exports = {
  generateTextExport,
  generateHTMLExport,
  exportAsText,
  exportAsHTML,
  exportAsCSV,
  exportAsJSON,
  getExportFormats
};
