const state = {
  selectedImages: [],
  notes: [],
  midiEvents: [],
  currentScoreId: null,
  duration: 0,
  tempo: 120,
  isPlaying: false,
  isPaused: false,
  currentTime: 0,
  midiOutput: null,
  scheduledEvents: [],
  playbackStartTime: 0,
  pausedTime: 0,
  activeNoteIndex: -1
};

const elements = {
  selectImagesBtn: document.getElementById('selectImagesBtn'),
  processBtn: document.getElementById('processBtn'),
  selectedFiles: document.getElementById('selectedFiles'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  tempoSlider: document.getElementById('tempoSlider'),
  tempoValue: document.getElementById('tempoValue'),
  progressFill: document.getElementById('progressFill'),
  currentTime: document.getElementById('currentTime'),
  totalTime: document.getElementById('totalTime'),
  scoreDisplay: document.getElementById('scoreDisplay'),
  notesList: document.getElementById('notesList'),
  midiEventsList: document.getElementById('midiEvents'),
  midiOutputs: document.getElementById('midiOutputs'),
  scoreName: document.getElementById('scoreName'),
  saveBtn: document.getElementById('saveBtn'),
  libraryBtn: document.getElementById('libraryBtn'),
  libraryModal: document.getElementById('libraryModal'),
  closeLibrary: document.getElementById('closeLibrary'),
  libraryList: document.getElementById('libraryList')
};

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateTimeDisplay() {
  elements.currentTime.textContent = formatTime(state.currentTime);
  elements.totalTime.textContent = formatTime(state.duration);
  
  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  elements.progressFill.style.width = `${progress}%`;
}

async function initMIDI() {
  try {
    if (navigator.requestMIDIAccess) {
      const midiAccess = await navigator.requestMIDIAccess();
      
      const outputs = midiAccess.outputs;
      elements.midiOutputs.innerHTML = '<option value="">选择MIDI输出...</option>';
      
      outputs.forEach((output, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = output.name;
        elements.midiOutputs.appendChild(option);
      });
      
      if (outputs.size > 0) {
        const firstOutput = outputs.values().next().value;
        state.midiOutput = firstOutput;
        elements.midiOutputs.value = firstOutput.id;
      }
      
      elements.midiOutputs.addEventListener('change', (e) => {
        state.midiOutput = midiAccess.outputs.get(e.target.value);
      });
      
      midiAccess.addEventListener('statechange', () => {
        initMIDI();
      });
    } else {
      console.warn('Web MIDI API not supported');
    }
  } catch (error) {
    console.warn('MIDI initialization failed:', error);
  }
}

function scheduleMIDIEventsImmediate() {
  if (!state.midiOutput || state.midiEvents.length === 0) return;
  
  const tempoFactor = state.tempo / 120;
  const startTime = state.midiOutput.currentTime + 0.05;
  
  state.midiEvents.forEach((event, eventIndex) => {
    const adjustedTime = event.time / tempoFactor;
    
    if (adjustedTime >= state.currentTime - 0.01) {
      const scheduleTime = startTime + (adjustedTime - state.currentTime);
      
      if (event.type === 'noteOn') {
        state.midiOutput.send([0x90, event.noteNumber, event.velocity], scheduleTime * 1000);
        setTimeout(() => {
          if (state.isPlaying) {
            highlightActiveNote(Math.floor(eventIndex / 2));
          }
        }, Math.max(0, (adjustedTime - state.currentTime) * 1000));
      } else if (event.type === 'noteOff') {
        state.midiOutput.send([0x80, event.noteNumber, 0], scheduleTime * 1000);
      }
    }
  });
  
  const totalDuration = state.duration / tempoFactor;
  state.playbackEndTime = startTime + (totalDuration - state.currentTime);
}

function playbackLoop() {
  if (!state.isPlaying || state.isPaused) return;
  
  const midiNow = state.midiOutput ? state.midiOutput.currentTime : 0;
  const totalDuration = state.duration / (state.tempo / 120);
  
  if (state.playbackEndTime && midiNow > 0) {
    const elapsed = (midiNow - (state.playbackEndTime - totalDuration + state.currentTime));
    state.currentTime = Math.max(0, Math.min(totalDuration, elapsed));
  } else {
    const now = performance.now();
    const elapsed = (now - state.playbackStartTime) / 1000 + state.pausedTime;
    state.currentTime = Math.min(elapsed, totalDuration);
  }
  
  updateTimeDisplay();
  
  if (state.midiOutput && state.midiOutput.currentTime >= state.playbackEndTime) {
    setTimeout(() => stopPlayback(), 100);
    return;
  }
  
  if (state.currentTime >= totalDuration) {
    stopPlayback();
    return;
  }
  
  state.playbackRAF = requestAnimationFrame(playbackLoop);
}

function highlightActiveNote(index) {
  document.querySelectorAll('.note-display').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
  state.activeNoteIndex = index;
}

function startPlayback() {
  if (state.midiEvents.length === 0) return;
  
  if (state.isPaused) {
    state.isPaused = false;
  } else {
    state.currentTime = 0;
    state.pausedTime = 0;
  }
  
  state.playbackStartTime = performance.now();
  scheduleMIDIEventsImmediate();
  
  state.isPlaying = true;
  elements.playBtn.disabled = true;
  elements.pauseBtn.disabled = false;
  elements.stopBtn.disabled = false;
  
  playbackLoop();
}

function pausePlayback() {
  if (!state.isPlaying) return;
  
  state.isPaused = true;
  state.pausedTime = state.currentTime;
  
  if (state.midiOutput) {
    for (let note = 0; note < 128; note++) {
      state.midiOutput.send([0x80, note, 0], state.midiOutput.currentTime * 1000);
    }
  }
  
  if (state.playbackRAF) {
    cancelAnimationFrame(state.playbackRAF);
  }
  
  state.isPlaying = false;
  elements.playBtn.disabled = false;
  elements.pauseBtn.disabled = true;
  elements.playBtn.textContent = '▶️ 继续';
}

function stopPlayback() {
  if (state.playbackRAF) {
    cancelAnimationFrame(state.playbackRAF);
  }
  
  state.isPlaying = false;
  state.isPaused = false;
  state.currentTime = 0;
  state.activeNoteIndex = -1;
  state.playbackEndTime = null;
  
  if (state.midiOutput) {
    const now = state.midiOutput.currentTime * 1000;
    for (let note = 0; note < 128; note++) {
      state.midiOutput.send([0x80, note, 0], now);
    }
  }
  
  document.querySelectorAll('.note-display').forEach(el => {
    el.classList.remove('active');
  });
  
  elements.playBtn.disabled = false;
  elements.pauseBtn.disabled = true;
  elements.stopBtn.disabled = true;
  elements.playBtn.textContent = '▶️ 播放';
  
  updateTimeDisplay();
}

function renderScore() {
  if (state.notes.length === 0) {
    elements.scoreDisplay.innerHTML = `
      <div class="empty-state">
        <p>选择简谱图片开始识别</p>
        <p class="hint">支持多页谱面拼接</p>
      </div>
    `;
    return;
  }
  
  const notesPerLine = 16;
  const lines = [];
  
  for (let i = 0; i < state.notes.length; i += notesPerLine) {
    lines.push(state.notes.slice(i, i + notesPerLine));
  }
  
  let html = '';
  let noteIndex = 0;
  
  lines.forEach(line => {
    html += '<div class="staff-line">';
    
    line.forEach(note => {
      const hasUnderscore = note.has_underscore || false;
      const hasHighDot = note.has_high_dot || false;
      const hasDurationDot = note.has_duration_dot || false;
      
      let valueClass = '';
      if (hasUnderscore) valueClass += ' underscore';
      if (hasDurationDot) valueClass += ' dot';
      
      let octaveMark = '';
      if (hasHighDot) {
        octaveMark = '<span class="high-dot">·</span>';
      } else if (hasUnderscore) {
        octaveMark = '<span class="low-mark">_</span>';
      }
      
      html += `
        <div class="note-display" data-index="${noteIndex}">
          ${octaveMark}
          <span class="note-value${valueClass}">${note.value}</span>
          <span class="note-duration">${note.duration.toFixed(2)}</span>
          <span class="octave-info">${note.octave > 0 ? '+' + note.octave : note.octave}</span>
        </div>
      `;
      noteIndex++;
    });
    
    html += '</div>';
  });
  
  elements.scoreDisplay.innerHTML = html;
}

function renderNotesList() {
  if (state.notes.length === 0) {
    elements.notesList.innerHTML = '<div class="empty-state">暂无音符数据</div>';
    return;
  }
  
  let html = '';
  state.notes.forEach((note, index) => {
    const marks = [];
    if (note.has_high_dot) marks.push('高音点');
    if (note.has_duration_dot) marks.push('附点');
    if (note.has_underscore) marks.push('下划线');
    const marksStr = marks.length > 0 ? marks.join(', ') : '-';
    
    html += `
      <div class="note-item">
        <span class="index">${index + 1}</span>
        <span class="value">音符: ${note.value}</span>
        <span class="duration">时长: ${note.duration.toFixed(2)}</span>
        <span class="octave">八度: ${note.octave || 0}</span>
        <span class="marks">标记: ${marksStr}</span>
      </div>
    `;
  });
  
  elements.notesList.innerHTML = html;
}

function renderMidiEvents() {
  if (state.midiEvents.length === 0) {
    elements.midiEventsList.innerHTML = '<div class="empty-state">暂无MIDI事件</div>';
    return;
  }
  
  let html = '';
  state.midiEvents.slice(0, 100).forEach((event, index) => {
    const typeClass = event.type === 'noteOn' ? 'note-on' : 'note-off';
    html += `
      <div class="midi-event">
        <span>${index + 1}</span>
        <span class="${typeClass}">${event.type}</span>
        <span>音符: ${event.noteNumber}</span>
        <span>时间: ${event.time.toFixed(2)}s</span>
      </div>
    `;
  });
  
  if (state.midiEvents.length > 100) {
    html += `<div class="midi-event">... 还有 ${state.midiEvents.length - 100} 个事件</div>`;
  }
  
  elements.midiEventsList.innerHTML = html;
}

function updateUIAfterProcessing() {
  const hasData = state.notes.length > 0;
  
  elements.playBtn.disabled = !hasData;
  elements.pauseBtn.disabled = true;
  elements.stopBtn.disabled = true;
  elements.saveBtn.disabled = !hasData;
  elements.processBtn.disabled = state.selectedImages.length === 0;
  
  renderScore();
  renderNotesList();
  renderMidiEvents();
  updateTimeDisplay();
}

elements.selectImagesBtn.addEventListener('click', async () => {
  const files = await window.electronAPI.selectImageFiles();
  if (files && files.length > 0) {
    state.selectedImages = files;
    
    elements.selectedFiles.innerHTML = files.map((path, i) => {
      const name = path.split('/').pop();
      return `<div class="file-item"><span>${name}</span></div>`;
    }).join('');
    
    elements.processBtn.disabled = false;
  }
});

elements.processBtn.addEventListener('click', async () => {
  if (state.selectedImages.length === 0) return;
  
  elements.processBtn.disabled = true;
  elements.processBtn.textContent = '⏳ 处理中...';
  
  try {
    const result = await window.electronAPI.processImages(state.selectedImages);
    
    if (result.success) {
      state.notes = result.notes || [];
      state.midiEvents = result.midiEvents || [];
      state.duration = result.duration || 0;
      state.tempo = result.tempo || 120;
      
      elements.scoreName.value = `乐谱_${new Date().toLocaleString()}`;
      
      updateUIAfterProcessing();
    } else {
      alert('处理失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    alert('处理出错: ' + error.message);
  } finally {
    elements.processBtn.disabled = false;
    elements.processBtn.textContent = '🔍 识别音符';
  }
});

elements.playBtn.addEventListener('click', startPlayback);
elements.pauseBtn.addEventListener('click', pausePlayback);
elements.stopBtn.addEventListener('click', stopPlayback);

elements.tempoSlider.addEventListener('input', (e) => {
  state.tempo = parseInt(e.target.value);
  elements.tempoValue.textContent = state.tempo;
  
  if (state.isPlaying) {
    stopPlayback();
    startPlayback();
  }
});

elements.saveBtn.addEventListener('click', async () => {
  const name = elements.scoreName.value.trim();
  if (!name) {
    alert('请输入乐谱名称');
    return;
  }
  
  try {
    const result = await window.electronAPI.saveScore({
      id: state.currentScoreId,
      name,
      notes: state.notes,
      midiEvents: state.midiEvents,
      imagePaths: state.selectedImages
    });
    
    state.currentScoreId = result.id;
    alert('保存成功！');
  } catch (error) {
    alert('保存失败: ' + error.message);
  }
});

elements.libraryBtn.addEventListener('click', async () => {
  await loadLibrary();
  elements.libraryModal.classList.add('active');
});

elements.closeLibrary.addEventListener('click', () => {
  elements.libraryModal.classList.remove('active');
});

elements.libraryModal.addEventListener('click', (e) => {
  if (e.target === elements.libraryModal) {
    elements.libraryModal.classList.remove('active');
  }
});

async function loadLibrary() {
  try {
    const scores = await window.electronAPI.getScores();
    
    if (scores.length === 0) {
      elements.libraryList.innerHTML = '<div class="empty-state">暂无保存的乐谱</div>';
      return;
    }
    
    elements.libraryList.innerHTML = scores.map(score => `
      <div class="library-item" data-id="${score.id}">
        <div class="score-info">
          <div class="score-name">${score.name}</div>
          <div class="score-meta">创建于: ${new Date(score.created_at).toLocaleString()}</div>
        </div>
        <div class="score-actions">
          <button class="delete-btn" data-id="${score.id}">删除</button>
        </div>
      </div>
    `).join('');
    
    elements.libraryList.querySelectorAll('.library-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        
        const id = parseInt(item.dataset.id);
        await loadScore(id);
        elements.libraryModal.classList.remove('active');
      });
    });
    
    elements.libraryList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.id);
        if (confirm('确定要删除这个乐谱吗？')) {
          await window.electronAPI.deleteScore(id);
          await loadLibrary();
        }
      });
    });
  } catch (error) {
    elements.libraryList.innerHTML = '<div class="empty-state">加载失败</div>';
  }
}

async function loadScore(id) {
  try {
    const score = await window.electronAPI.getScore(id);
    
    if (score) {
      state.currentScoreId = score.id;
      state.notes = score.notes || [];
      state.midiEvents = score.midiEvents || [];
      state.selectedImages = score.imagePaths || [];
      
      if (state.midiEvents.length > 0) {
        const lastEvent = state.midiEvents[state.midiEvents.length - 1];
        state.duration = lastEvent.time || 0;
      }
      
      elements.scoreName.value = score.name;
      
      if (state.selectedImages.length > 0) {
        elements.selectedFiles.innerHTML = state.selectedImages.map((path, i) => {
          const name = path.split('/').pop();
          return `<div class="file-item"><span>${name}</span></div>`;
        }).join('');
      }
      
      updateUIAfterProcessing();
    }
  } catch (error) {
    alert('加载失败: ' + error.message);
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}Tab`).classList.add('active');
  });
});

async function init() {
  await initMIDI();
  updateUIAfterProcessing();
}

init();
