declare global {
  interface Window {
    electronAPI: {
      listPorts: () => Promise<any[]>;
      connectPort: (port: string, baudRate: number) => Promise<any>;
      disconnectPort: () => Promise<any>;
      onCharacterData: (callback: (data: any) => void) => void;
      removeCharacterDataListener: () => void;
      recognizeImage: (imageData: string) => Promise<any>;
      exportToTxt: (content: string, path: string) => Promise<any>;
      exportToPdf: (content: string, path: string) => Promise<any>;
      saveRecord: (record: any) => Promise<any>;
      getRecords: () => Promise<any>;
      saveFontStyle: (style: any) => Promise<any>;
      getFontStyles: () => Promise<any>;
    };
  }
}

let collectedText = '';
let isCollecting = false;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initConnectionPage();
  initCollectionPage();
  initRecognitionPage();
  initTranscriptionPage();
  initArchivePage();
});

function initNavigation(): void {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetPage = item.getAttribute('data-page');

      navItems.forEach(nav => nav.classList.remove('active'));
      pages.forEach(page => page.classList.remove('active'));

      item.classList.add('active');
      document.getElementById(targetPage!)?.classList.add('active');
    });
  });
}

function initConnectionPage(): void {
  const portSelect = document.getElementById('port-select') as HTMLSelectElement;
  const refreshBtn = document.getElementById('refresh-ports-btn');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const statusIndicator = document.getElementById('connection-status')!;
  const baudrateSelect = document.getElementById('baudrate-select') as HTMLSelectElement;

  async function refreshPorts(): Promise<void> {
    try {
      const ports = await window.electronAPI.listPorts();
      portSelect.innerHTML = '';

      if (ports.length === 0) {
        portSelect.innerHTML = '<option value="">未检测到可用串口</option>';
        return;
      }

      ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} (${port.manufacturer || '未知制造商'})`;
        portSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Failed to list ports:', error);
      portSelect.innerHTML = '<option value="">检测失败</option>';
    }
  }

  refreshBtn?.addEventListener('click', refreshPorts);

  connectBtn?.addEventListener('click', async () => {
    const port = portSelect.value;
    const baudRate = parseInt(baudrateSelect.value);

    if (!port) {
      alert('请选择一个串口');
      return;
    }

    try {
      const result = await window.electronAPI.connectPort(port, baudRate);
      if (result.success) {
        statusIndicator.classList.remove('disconnected');
        statusIndicator.classList.add('connected');
        statusIndicator.querySelector('span:last-child')!.textContent = '已连接';
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
      } else {
        alert('连接失败: ' + result.error);
      }
    } catch (error) {
      alert('连接失败: ' + error);
    }
  });

  disconnectBtn?.addEventListener('click', async () => {
    try {
      const result = await window.electronAPI.disconnectPort();
      if (result.success) {
        statusIndicator.classList.remove('connected');
        statusIndicator.classList.add('disconnected');
        statusIndicator.querySelector('span:last-child')!.textContent = '未连接';
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
      }
    } catch (error) {
      alert('断开连接失败: ' + error);
    }
  });

  refreshPorts();
}

function initCollectionPage(): void {
  const startBtn = document.getElementById('start-session-btn');
  const endBtn = document.getElementById('end-session-btn');
  const characterStream = document.getElementById('character-stream')!;
  const charCount = document.getElementById('char-count')!;

  window.electronAPI.onCharacterData((data) => {
    if (isCollecting) {
      collectedText += data.char;
      characterStream.textContent = collectedText;
      charCount.textContent = collectedText.length.toString();
    }
  });

  startBtn?.addEventListener('click', () => {
    isCollecting = true;
    collectedText = '';
    characterStream.textContent = '';
    charCount.textContent = '0';
    startBtn.disabled = true;
    endBtn.disabled = false;
  });

  endBtn?.addEventListener('click', () => {
    isCollecting = false;
    startBtn.disabled = false;
    endBtn.disabled = true;

    const transcriptionText = document.getElementById('transcription-text') as HTMLTextAreaElement;
    if (transcriptionText) {
      transcriptionText.value = collectedText;
      updateTranscriptionStats();
    }
  });
}

function initRecognitionPage(): void {
  const dropZone = document.getElementById('drop-zone')!;
  const imageInput = document.getElementById('image-input') as HTMLInputElement;
  const resultCard = document.getElementById('recognition-result')!;
  const recognizedText = document.getElementById('recognized-text')!;
  const confidenceEl = document.getElementById('confidence')!;
  const detectedFontEl = document.getElementById('detected-font')!;

  dropZone.addEventListener('click', () => imageInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  });

  imageInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      processImage(file);
    }
  });

  async function processImage(file: File): Promise<void> {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;

      dropZone.textContent = '正在识别...';

      try {
        const result = await window.electronAPI.recognizeImage(imageData);

        if (result.success) {
          recognizedText.textContent = result.data.text;
          confidenceEl.textContent = `${Math.round(result.data.confidence)}%`;
          detectedFontEl.textContent = result.data.fontType || '-';
          resultCard.classList.remove('hidden');

          const transcriptionText = document.getElementById('transcription-text') as HTMLTextAreaElement;
          if (transcriptionText) {
            transcriptionText.value = result.data.text;
            updateTranscriptionStats();
          }
        } else {
          alert('识别失败: ' + result.error);
        }
      } catch (error) {
        alert('识别失败: ' + error);
      }

      dropZone.innerHTML = `
        <p>📸 拖放图片到此处或点击上传</p>
        <p style="font-size: 0.75rem; color: #999; margin-top: 8px;">支持 JPG、PNG 格式</p>
      `;
    };
    reader.readAsDataURL(file);
  }
}

function initTranscriptionPage(): void {
  const textarea = document.getElementById('transcription-text') as HTMLTextAreaElement;
  const exportTxtBtn = document.getElementById('export-txt-btn');
  const exportPdfBtn = document.getElementById('export-pdf-btn');
  const saveTranscriptionBtn = document.getElementById('save-transcription-btn');

  textarea?.addEventListener('input', updateTranscriptionStats);

  exportTxtBtn?.addEventListener('click', async () => {
    const content = textarea.value;
    if (!content.trim()) {
      alert('请输入要导出的内容');
      return;
    }

    const filePath = prompt('请输入保存路径（包括文件名）:', 'transcription.txt');
    if (filePath) {
      try {
        const result = await window.electronAPI.exportToTxt(content, filePath);
        if (result.success) {
          alert('导出成功');
        } else {
          alert('导出失败: ' + result.error);
        }
      } catch (error) {
        alert('导出失败: ' + error);
      }
    }
  });

  exportPdfBtn?.addEventListener('click', async () => {
    const content = textarea.value;
    if (!content.trim()) {
      alert('请输入要导出的内容');
      return;
    }

    const filePath = prompt('请输入保存路径（包括文件名）:', 'transcription.pdf');
    if (filePath) {
      try {
        const result = await window.electronAPI.exportToPdf(content, filePath);
        if (result.success) {
          alert('导出成功');
        } else {
          alert('导出失败: ' + result.error);
        }
      } catch (error) {
        alert('导出失败: ' + error);
      }
    }
  });

  saveTranscriptionBtn?.addEventListener('click', async () => {
    const content = textarea.value;
    if (!content.trim()) {
      alert('请输入要保存的内容');
      return;
    }

    try {
      const result = await window.electronAPI.saveRecord({
        type: 'transcription',
        content,
        createdAt: Date.now()
      });

      if (result.success) {
        alert('保存成功');
        loadArchiveData();
      } else {
        alert('保存失败: ' + result.error);
      }
    } catch (error) {
      alert('保存失败: ' + error);
    }
  });
}

function updateTranscriptionStats(): void {
  const textarea = document.getElementById('transcription-text') as HTMLTextAreaElement;
  const content = textarea.value;

  const charsEl = document.getElementById('stat-chars');
  const wordsEl = document.getElementById('stat-words');
  const linesEl = document.getElementById('stat-lines');

  if (charsEl) charsEl.textContent = content.length.toString();
  if (wordsEl) wordsEl.textContent = content.split(/\s+/).filter(w => w.length > 0).length.toString();
  if (linesEl) linesEl.textContent = content.split('\n').length.toString();
}

function initArchivePage(): void {
  loadArchiveData();
}

async function loadArchiveData(): Promise<void> {
  try {
    const result = await window.electronAPI.getRecords();

    if (result.success) {
      const records = result.data;

      const totalRecordsEl = document.getElementById('total-records');
      const transcriptionRecordsEl = document.getElementById('transcription-records');
      const fontRecordsEl = document.getElementById('font-records');
      const recordListEl = document.getElementById('record-list')!;

      if (totalRecordsEl) totalRecordsEl.textContent = records.length.toString();

      const transcriptionCount = records.filter((r: any) => r.type === 'transcription').length;
      if (transcriptionRecordsEl) transcriptionRecordsEl.textContent = transcriptionCount.toString();

      const fontCount = records.filter((r: any) => r.type === 'font_style').length;
      if (fontRecordsEl) fontRecordsEl.textContent = fontCount.toString();

      recordListEl.innerHTML = '';

      if (records.length === 0) {
        recordListEl.innerHTML = '<li class="record-item">暂无记录</li>';
        return;
      }

      records.slice(0, 10).forEach((record: any) => {
        const li = document.createElement('li');
        li.className = 'record-item';

        const date = new Date(record.createdAt).toLocaleString('zh-CN');
        const preview = record.data?.content?.substring(0, 30) || record.data?.name || '无预览';

        li.innerHTML = `
          <div class="record-info">
            <span class="record-type">${record.type}</span>
            <span>${preview}...</span>
            <br>
            <span class="record-date">${date}</span>
          </div>
        `;

        recordListEl.appendChild(li);
      });
    }
  } catch (error) {
    console.error('Failed to load archive:', error);
  }
}

export {};
