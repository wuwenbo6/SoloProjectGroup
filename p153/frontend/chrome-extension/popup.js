const API_BASE_URL = 'http://localhost:8000';
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupToggle();
  setupTranslation();
  setupVoiceInput();
  setupTerms();
  setupReports();
  checkApiStatus();
});

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tabId).classList.add('active');
      
      if (tabId === 'terms') loadTerms();
      if (tabId === 'report') loadReportStats();
    });
  });
}

function setupToggle() {
  const enableToggle = document.getElementById('enableToggle');
  
  chrome.storage.sync.get(['enabled'], (result) => {
    enableToggle.checked = result.enabled !== false;
  });

  enableToggle.addEventListener('change', () => {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ enabled });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleExtension',
          enabled: enabled
        }).catch(() => {});
      }
    });
  });
}

function setupTranslation() {
  const translateBtn = document.getElementById('translateBtn');
  const translateInput = document.getElementById('translateInput');
  
  translateBtn.addEventListener('click', async () => {
    const text = translateInput.value.trim();
    if (!text) return;
    
    translateBtn.disabled = true;
    translateBtn.textContent = '翻译中...';
    
    try {
      const response = await fetch(`${API_BASE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source_lang: 'ug', target_lang: 'zh', use_terms: true })
      });
      
      if (response.ok) {
        const data = await response.json();
        document.getElementById('resultText').textContent = data.translated_text;
        document.getElementById('resultContainer').classList.add('show');
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
    
    translateBtn.disabled = false;
    translateBtn.textContent = '翻译';
  });
}

function setupVoiceInput() {
  const micBtn = document.getElementById('micBtn');
  const translateInput = document.getElementById('translateInput');
  
  micBtn.addEventListener('click', async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (e) => {
          audioChunks.push(e.data);
        };
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());
          
          micBtn.disabled = true;
          micBtn.innerHTML = '<span>⏳</span> 处理中...';
          
          try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');
            
            const response = await fetch(`${API_BASE_URL}/asr/transcribe?source_lang=ug`, {
              method: 'POST',
              body: formData
            });
            
            if (response.ok) {
              const data = await response.json();
              translateInput.value = data.text;
            }
          } catch (error) {
            console.error('ASR error:', error);
          }
          
          micBtn.disabled = false;
          micBtn.innerHTML = '<span>🎤</span> 语音输入';
        };
        
        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('recording');
        micBtn.innerHTML = '<span>⏹</span> 停止录音';
        
      } catch (error) {
        console.error('Microphone error:', error);
        alert('无法访问麦克风，请检查权限设置');
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      micBtn.classList.remove('recording');
    }
  });
}

function setupTerms() {
  const addTermBtn = document.getElementById('addTermBtn');
  
  addTermBtn.addEventListener('click', async () => {
    const ugTerm = document.getElementById('termUg').value.trim();
    const zhTerm = document.getElementById('termZh').value.trim();
    const category = document.getElementById('termCategory').value.trim();
    
    if (!ugTerm || !zhTerm) {
      alert('请输入维吾尔语和汉语术语');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/terms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_term: ugTerm,
          target_term: zhTerm,
          source_lang: 'ug',
          target_lang: 'zh',
          category: category || null
        })
      });
      
      if (response.ok) {
        document.getElementById('termUg').value = '';
        document.getElementById('termZh').value = '';
        document.getElementById('termCategory').value = '';
        loadTerms();
      }
    } catch (error) {
      console.error('Add term error:', error);
    }
  });
}

async function loadTerms() {
  const termsList = document.getElementById('termsList');
  
  try {
    const response = await fetch(`${API_BASE_URL}/terms?limit=50`);
    if (response.ok) {
      const terms = await response.json();
      
      if (terms.length === 0) {
        termsList.innerHTML = '<div class="empty-state">暂无术语</div>';
        return;
      }
      
      termsList.innerHTML = terms.map(term => `
        <div class="term-item">
          <div class="term-pair">
            <div class="term-ug">${term.source_term}</div>
            <div class="term-zh">${term.target_term}</div>
          </div>
          <div class="term-meta">
            <span>${term.category || '未分类'} · 使用${term.usage_count}次</span>
            <div class="term-actions">
              <button class="term-action-btn delete" onclick="deleteTerm(${term.id})">删除</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Load terms error:', error);
  }
}

async function deleteTerm(termId) {
  if (!confirm('确定删除此术语？')) return;
  
  try {
    const response = await fetch(`${API_BASE_URL}/terms/${termId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadTerms();
    }
  } catch (error) {
    console.error('Delete term error:', error);
  }
}

function setupReports() {
  const viewReportBtn = document.getElementById('viewReportBtn');
  const downloadReportBtn = document.getElementById('downloadReportBtn');
  
  viewReportBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE_URL}/reports/html` });
  });
  
  downloadReportBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: `${API_BASE_URL}/reports/download?format=html` });
  });
}

async function loadReportStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const report = await response.json();
      
      document.getElementById('totalTranslations').textContent = report.summary.total_translations;
      document.getElementById('totalTerms').textContent = report.terms_report?.length || 0;
      document.getElementById('avgTime').textContent = report.summary.average_time_seconds || '-';
      document.getElementById('avgRating').textContent = report.summary.average_rating || '-';
    }
  } catch (error) {
    console.error('Load report error:', error);
  }
}

async function checkApiStatus() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      mode: 'cors'
    });

    if (response.ok) {
      statusDot.classList.add('connected');
      statusText.textContent = '服务已连接';
    } else {
      statusDot.classList.remove('connected');
      statusText.textContent = '服务异常';
    }
  } catch (error) {
    statusDot.classList.remove('connected');
    statusText.textContent = '服务未启动';
  }
}

window.deleteTerm = deleteTerm;
