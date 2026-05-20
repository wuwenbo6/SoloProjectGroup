const { ipcRenderer } = require('electron');
const Tesseract = require('tesseract.js');

let ocrWorker = null;
let currentStream = null;
let currentMode = 'normal';
let lastEquationResult = null;

document.addEventListener('DOMContentLoaded', () => {
  initModeTabs();
  initTabs();
  initCamera();
  initUpload();
  initOCR();
  initBalanceButton();
  loadHistory();
});

function initModeTabs() {
  const modeBtns = document.querySelectorAll('.mode-btn');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentMode = mode;
      
      const input = document.getElementById('equation-input');
      if (mode === 'normal') {
        input.placeholder = '输入化学方程式，例如：H2 + O2 -> H2O';
      } else if (mode === 'ionic') {
        input.placeholder = '输入离子方程式，例如：Fe(2+) + Cl2 -> Fe(3+) + Cl(-)';
      } else if (mode === 'combustion') {
        input.placeholder = '输入有机物分子式，例如：CH4 或 C2H5OH';
      }
    });
  });
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${targetTab}-tab`).classList.add('active');
    });
  });
}

function initCamera() {
  const startBtn = document.getElementById('start-camera-btn');
  const captureBtn = document.getElementById('capture-btn');
  const video = document.getElementById('camera-preview');

  startBtn.addEventListener('click', async () => {
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      video.srcObject = currentStream;
      startBtn.textContent = '关闭摄像头';
      captureBtn.disabled = false;
    } catch (err) {
      alert('无法访问摄像头: ' + err.message);
    }
  });

  captureBtn.addEventListener('click', () => {
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob(blob => {
      recognizeImage(blob);
    }, 'image/png');
  });
}

function initUpload() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const previewImage = document.getElementById('preview-image');
  const recognizeBtn = document.getElementById('recognize-btn');

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
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageFile(file);
    }
  });

  function handleImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      previewImage.style.display = 'block';
      recognizeBtn.style.display = 'block';
      recognizeBtn.onclick = () => recognizeImage(file);
    };
    reader.readAsDataURL(file);
  }
}

async function initOCR() {
  const statusText = document.getElementById('ocr-status-text');
  const progressBar = document.querySelector('.progress-bar');
  const progressFill = document.querySelector('.progress-fill');

  statusText.textContent = '正在初始化OCR引擎...';
  progressBar.style.display = 'block';

  try {
    ocrWorker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          progressFill.style.width = `${m.progress * 100}%`;
          statusText.textContent = `识别中... ${Math.round(m.progress * 100)}%`;
        }
      }
    });
    
    await ocrWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+->=() ',
      preserve_interword_spaces: '1'
    });

    statusText.textContent = 'OCR引擎就绪';
    progressBar.style.display = 'none';
  } catch (err) {
    statusText.textContent = 'OCR初始化失败: ' + err.message;
    progressBar.style.display = 'none';
  }
}

async function recognizeImage(image) {
  if (!ocrWorker) {
    alert('OCR引擎未初始化');
    return;
  }

  const statusText = document.getElementById('ocr-status-text');
  const progressBar = document.querySelector('.progress-bar');
  progressBar.style.display = 'block';
  statusText.textContent = '正在识别...';

  try {
    const { data: { text } } = await ocrWorker.recognize(image);
    
    const cleanedText = cleanEquation(text);
    document.getElementById('equation-input').value = cleanedText;
    
    statusText.textContent = '识别完成';
    progressBar.style.display = 'none';
    
    document.querySelector('[data-tab="manual"]').click();
  } catch (err) {
    statusText.textContent = '识别失败: ' + err.message;
    progressBar.style.display = 'none';
  }
}

function cleanEquation(text) {
  let cleaned = text.replace(/\n/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  cleaned = cleaned.replace(/→|→|–>|—>|→|=>|⇒/g, '->');
  
  cleaned = cleaned.replace(/[＝=]/g, '->');
  
  cleaned = cleaned.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, function(match) {
    const subscriptMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    return subscriptMap[match] || match;
  });
  
  cleaned = cleaned.replace(/([A-Za-z])\s+(\d)/g, '$1$2');
  
  cleaned = cleaned.replace(/(\d)\s+([A-Za-z])/g, '$1$2');
  
  cleaned = cleaned.replace(/\s*\+\s*/g, ' + ');
  cleaned = cleaned.replace(/\s*->\s*/g, ' -> ');
  
  function correctElements(formula) {
    const elementMap = {
      'na':'Na','nA':'Na','NA':'Na','Na':'Na',
      'mg':'Mg','MG':'Mg','Mg':'Mg',
      'al':'Al','AL':'Al','Al':'Al',
      'cl':'Cl','CL':'Cl','Cl':'Cl',
      'fe':'Fe','FE':'Fe','Fe':'Fe',
      'hcl':'HCl','HCL':'HCl','HCl':'HCl',
      'naoh':'NaOH','NAOH':'NaOH','NaOH':'NaOH',
      'nacl':'NaCl','NACL':'NaCl','NaCl':'NaCl',
      'h2o':'H2O','H2O':'H2O',
      'co2':'CO2','CO2':'CO2',
      'o2':'O2','O2':'O2',
      'h2':'H2','H2':'H2',
    };
    
    const lower = formula.toLowerCase();
    if (elementMap[lower]) {
      return elementMap[lower];
    }
    
    return formula.replace(/([A-Z])([a-z]*)/g, function(match, first, rest) {
      return first.toUpperCase() + rest.toLowerCase();
    });
  }
  
  const parts = cleaned.split(/(\s*\+\s*|\s*->\s*)/);
  const correctedParts = parts.map(function(part) {
    if (part.trim() === '+' || part.trim() === '->') {
      return part;
    }
    return correctElements(part.trim());
  });
  
  cleaned = correctedParts.join('');
  
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned.trim();
}

function initBalanceButton() {
  const balanceBtn = document.getElementById('balance-btn');
  
  balanceBtn.addEventListener('click', async () => {
    const input = document.getElementById('equation-input').value.trim();
    
    if (!input) {
      alert('请输入化学方程式');
      return;
    }

    balanceBtn.disabled = true;
    balanceBtn.textContent = '配平中...';

    try {
      let result;
      
      if (currentMode === 'normal') {
        result = await ipcRenderer.invoke('balance-equation', {
          action: 'balance',
          equation: input
        });
      } else if (currentMode === 'ionic') {
        result = await ipcRenderer.invoke('balance-equation', {
          action: 'balance_ionic',
          equation: input
        });
      } else if (currentMode === 'combustion') {
        result = await ipcRenderer.invoke('balance-equation', {
          action: 'balance_combustion',
          formula: input
        });
      }
      
      if (result.success) {
        lastEquationResult = result;
        displayResult(result);
        await ipcRenderer.invoke('save-history', input, result.balanced_equation);
        loadHistory();
      } else {
        displayError(result.error);
      }
    } catch (err) {
      displayError('配平失败: ' + err.message);
    }

    balanceBtn.disabled = false;
    balanceBtn.textContent = '配平方程式';
  });
}

function displayResult(result) {
  const container = document.getElementById('result-container');
  
  let stepsHtml = '';
  
  if (result.is_combustion) {
    stepsHtml = `
      <div class="step-item">
        <div class="step-title">燃烧反应通式配平</div>
        <div class="step-content">
          分子式: ${result.formula}<br>
          C: ${result.C}, H: ${result.H}, O: ${result.O}<br>
          通用公式: CxHyOz + (x + y/4 - z/2)O2 → xCO2 + (y/2)H2O
        </div>
      </div>
    `;
  } else if (result.is_ionic) {
    stepsHtml = `
      <div class="step-item">
        <div class="step-title">离子方程式配平</div>
        <div class="step-content">
          电荷平衡: ${result.charge_balance}<br>
          系数: [${result.coefficients.join(', ')}]
        </div>
      </div>
    `;
  } else if (result.reactants && result.products) {
    stepsHtml = `
      <div class="step-item">
        <div class="step-title">步骤1: 解析方程式</div>
        <div class="step-content">反应物: ${result.reactants.join(', ')}<br>生成物: ${result.products.join(', ')}</div>
      </div>
      
      <div class="step-item">
        <div class="step-title">步骤2: 构建元素矩阵</div>
        <div class="matrix-display">${formatMatrix(result.matrix)}</div>
      </div>
      
      <div class="step-item">
        <div class="step-title">步骤3: 求解线性方程组</div>
        <div class="step-content">系数: [${result.coefficients.join(', ')}]</div>
      </div>
      
      <div class="step-item">
        <div class="step-title">步骤4: 应用系数</div>
        <div class="step-content">得到配平方程式</div>
      </div>
    `;
  }
  
  let html = `
    <div class="equation-result">
      <div class="balanced-equation">${result.balanced_equation}</div>
      
      <div class="steps-container">
        ${stepsHtml}
      </div>
      
      <div class="export-section">
        <button onclick="exportLatex()" class="secondary-btn" style="margin-top: 15px;">📝 导出 LaTeX</button>
        <div id="latex-result" style="display: none; margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-family: monospace; font-size: 0.85rem;"></div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

function formatMatrix(matrix) {
  if (!matrix || !matrix.length) return '';
  return matrix.map(row => '[' + row.map(n => n.toString().padStart(2)).join(' ') + ']').join('\n');
}

function displayError(error) {
  const container = document.getElementById('result-container');
  container.innerHTML = `<div class="error-message">❌ ${error}</div>`;
}

async function loadHistory() {
  try {
    const history = await ipcRenderer.invoke('get-history');
    const container = document.getElementById('history-list');
    
    if (history.length === 0) {
      container.innerHTML = '<p class="placeholder">暂无历史记录</p>';
      return;
    }

    let html = '';
    history.forEach(item => {
      const date = new Date(item.created_at).toLocaleString('zh-CN');
      html += `
        <div class="history-item" data-id="${item.id}">
          <div class="history-equation">
            <div class="history-original">${item.original_equation}</div>
            <div class="history-balanced">${item.balanced_equation}</div>
          </div>
          <span class="history-time">${date}</span>
          <button class="delete-btn" onclick="deleteHistory(${item.id})">×</button>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (err) {
    console.error('加载历史失败:', err);
  }
}

window.deleteHistory = async (id) => {
  try {
    await ipcRenderer.invoke('delete-history', id);
    loadHistory();
  } catch (err) {
    console.error('删除失败:', err);
  }
};

window.exportLatex = async function() {
  if (!lastEquationResult) {
    alert('请先配平一个方程式');
    return;
  }

  const latexMode = lastEquationResult.is_ionic ? 'ion' : 'normal';
  
  try {
    const result = await ipcRenderer.invoke('balance-equation', {
      action: 'export_latex',
      equation_data: lastEquationResult,
      mode: latexMode
    });

    if (result.success) {
      const latexDiv = document.getElementById('latex-result');
      latexDiv.style.display = 'block';
      latexDiv.innerHTML = `
        <div style="margin-bottom: 8px;">
          <strong>LaTeX 显示公式：</strong><br>
          <code style="background: #fff; padding: 4px; border-radius: 4px;">${escapeHtml(result.display_latex)}</code>
        </div>
        <div style="margin-bottom: 8px;">
          <strong>ChemFormula 格式：</strong><br>
          <code style="background: #fff; padding: 4px; border-radius: 4px;">${escapeHtml(result.chemformula_latex)}</code>
        </div>
        <button onclick="copyLatex()" class="secondary-btn" style="margin-top: 10px; padding: 6px 12px; font-size: 0.85rem;">复制到剪贴板</button>
      `;
    } else {
      alert('导出失败: ' + result.error);
    }
  } catch (err) {
    alert('导出失败: ' + err.message);
  }
};

window.copyLatex = function() {
  const latexDiv = document.getElementById('latex-result');
  const codeElements = latexDiv.querySelectorAll('code');
  let allLatex = '';
  codeElements.forEach((code, index) => {
    allLatex += code.textContent + '\n\n';
  });
  
  navigator.clipboard.writeText(allLatex.trim()).then(() => {
    alert('已复制到剪贴板！');
  }).catch(err => {
    alert('复制失败: ' + err.message);
  });
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
