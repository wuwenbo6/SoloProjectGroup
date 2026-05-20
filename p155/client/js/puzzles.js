let currentPuzzleId = null;
let currentPuzzleState = null;
let currentPuzzleConfig = null;
let cachedPuzzleStates = new Map();

function onFullPuzzleStateSync(fullState) {
  cachedPuzzleStates.clear();
  fullState.forEach(puzzle => {
    cachedPuzzleStates.set(puzzle.puzzleId, {
      state: puzzle.state,
      config: puzzle.config,
      isSolved: puzzle.isSolved,
      puzzleName: puzzle.puzzleName,
      puzzleType: puzzle.puzzleType
    });
  });
  console.log('Synced full puzzle state:', cachedPuzzleStates.size, 'puzzles');
}

function displayPuzzle(puzzleData) {
  currentPuzzleId = puzzleData.puzzleId;
  currentPuzzleState = puzzleData.state;
  currentPuzzleConfig = puzzleData.config;
  
  document.getElementById('puzzleTitle').textContent = puzzleData.puzzleName;
  document.getElementById('puzzlePanel').style.display = 'block';
  
  const content = document.getElementById('puzzleContent');
  
  switch (puzzleData.puzzleType) {
    case 'code_lock':
      renderCodeLock(content, puzzleData);
      break;
    case 'jigsaw':
      renderJigsaw(content, puzzleData);
      break;
    case 'hidden_object':
      renderHiddenObject(content, puzzleData);
      break;
    default:
      content.innerHTML = '<div style="text-align: center;">未知谜题类型</div>';
  }
}

function renderCodeLock(container, puzzleData) {
  const state = puzzleData.state;
  const config = puzzleData.config;
  const isSolved = puzzleData.isSolved;
  
  container.innerHTML = `
    <div class="hint-text">${config.hint}</div>
    <div class="code-lock-input">
      ${[0,1,2,3].map(i => `
        <input type="text" class="code-digit" maxlength="1" 
               id="digit-${i}" 
               ${isSolved ? 'disabled' : ''}
               value="${state.currentInput[i] || ''}"
               oninput="handleCodeInput(${i}, this.value)">
      `).join('')}
    </div>
    <div style="text-align: center; color: #888; margin-bottom: 10px;">
      尝试次数: ${state.attempts || 0}/${config.maxAttempts}
    </div>
    <div class="keypad">
      ${[1,2,3,4,5,6,7,8,9,'C',0,'←'].map(key => `
        <button class="key" onclick="handleKeyPress('${key}')" ${isSolved ? 'disabled' : ''}>
          ${key}
        </button>
      `).join('')}
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <button class="btn btn-primary" onclick="submitCode()" ${isSolved ? 'disabled' : ''}>
        ${isSolved ? '✅ 已解锁' : '确认'}
      </button>
    </div>
  `;
}

let codeInput = ['', '', '', ''];

function handleCodeInput(index, value) {
  if (value) {
    codeInput[index] = value.slice(-1);
    if (index < 3) {
      document.getElementById(`digit-${index + 1}`)?.focus();
    }
  }
  updateCodeDisplay();
}

function handleKeyPress(key) {
  if (key === 'C') {
    codeInput = ['', '', '', ''];
  } else if (key === '←') {
    for (let i = 3; i >= 0; i--) {
      if (codeInput[i]) {
        codeInput[i] = '';
        break;
      }
    }
  } else {
    for (let i = 0; i < 4; i++) {
      if (!codeInput[i]) {
        codeInput[i] = key;
        break;
      }
    }
  }
  updateCodeDisplay();
}

function updateCodeDisplay() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`digit-${i}`);
    if (el) el.value = codeInput[i];
  }
}

function submitCode() {
  const code = codeInput.join('');
  if (code.length !== 4) {
    alert('请输入4位密码');
    return;
  }
  
  network.sendPuzzleAction(currentPuzzleId, 'submit', { code });
  
  network.sendPuzzleAction(currentPuzzleId, 'input', { code });
}

function renderJigsaw(container, puzzleData) {
  const state = puzzleData.state;
  const config = puzzleData.config;
  const isSolved = puzzleData.isSolved;
  
  const { rows, cols } = config.gridSize;
  const pieceSize = 300 / Math.max(rows, cols);
  
  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 10px;">
      ${isSolved ? '✅ 拼图完成！' : '拖动方块到正确位置'}
    </div>
    <div class="jigsaw-grid" style="grid-template-columns: repeat(${cols}, ${pieceSize}px); 
                                     grid-template-rows: repeat(${rows}, ${pieceSize}px);">
      ${state.pieces.map((piece, index) => `
        <div class="jigsaw-piece" 
             data-piece-id="${piece.id}"
             draggable="${!isSolved}"
             style="background: hsl(${(piece.id * 40) % 360}, 70%, 60%);
                    grid-row: ${piece.currentRow + 1};
                    grid-column: ${piece.currentCol + 1};"
             ondragstart="handleJigsawDragStart(event, ${piece.id})"
             ondragover="handleJigsawDragOver(event)"
             ondrop="handleJigsawDrop(event, ${piece.currentRow}, ${piece.currentCol})">
          ${piece.id + 1}
        </div>
      `).join('')}
    </div>
    <div style="text-align: center; margin-top: 20px;">
      <button class="btn btn-secondary" onclick="shuffleJigsaw()" ${isSolved ? 'disabled' : ''}>
        重新打乱
      </button>
    </div>
  `;
}

let draggedPieceId = null;

function handleJigsawDragStart(event, pieceId) {
  draggedPieceId = pieceId;
}

function handleJigsawDragOver(event) {
  event.preventDefault();
}

function handleJigsawDrop(event, targetRow, targetCol) {
  event.preventDefault();
  if (draggedPieceId === null) return;
  
  network.sendPuzzleAction(currentPuzzleId, 'move_piece', {
    pieceId: draggedPieceId,
    row: targetRow,
    col: targetCol
  });
  
  draggedPieceId = null;
}

function shuffleJigsaw() {
  network.sendPuzzleAction(currentPuzzleId, 'shuffle', {});
}

function renderHiddenObject(container, puzzleData) {
  const state = puzzleData.state;
  const config = puzzleData.config;
  const isSolved = puzzleData.isSolved;
  
  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 10px;">
      ${isSolved ? '✅ 全部找到！' : `找到所有隐藏物品 (${state.foundObjects.length}/${config.requiredCount})`}
    </div>
    <div class="hidden-object-scene">
      ${state.objects.map(obj => `
        <div class="hidden-item ${obj.found ? 'found' : ''}"
             style="left: ${obj.x}px; top: ${obj.y}px;
                    background: ${obj.found ? '#4ECDC4' : 'rgba(255,255,255,0.3)'};
                    border-radius: 50%;
                    border: 2px solid ${obj.found ? '#4ECDC4' : '#fff'};"
             onclick="findObject('${obj.id}')"
             title="${obj.name}">
          ${obj.found ? '✓' : '?'}
        </div>
      `).join('')}
    </div>
    <div class="found-list">
      ${state.objects.filter(o => o.found).map(obj => `
        <div class="found-item">${obj.name}</div>
      `).join('')}
    </div>
  `;
}

function findObject(objectId) {
  network.sendPuzzleAction(currentPuzzleId, 'find_object', { objectId });
}

function onPuzzleResult(result) {
  if (result.success) {
    currentPuzzleState = result.state;
    if (result.isSolved) {
      alert(`🎉 ${result.puzzleName} 已解决！`);
      network.getPuzzles();
    }
    displayPuzzle({
      puzzleId: result.puzzleId,
      puzzleName: result.puzzleName,
      puzzleType: result.puzzleType,
      state: result.state,
      config: currentPuzzleConfig,
      isSolved: result.isSolved
    });
  } else {
    alert(result.error || '操作失败');
  }
}

function onPuzzleUpdated(update) {
  if (update.puzzleId === currentPuzzleId) {
    currentPuzzleState = update.state;
    displayPuzzle({
      puzzleId: update.puzzleId,
      puzzleName: currentPuzzleConfig?.name || '谜题',
      puzzleType: currentPuzzleConfig?.type,
      state: update.state,
      config: currentPuzzleConfig,
      isSolved: update.isSolved
    });
  }
  network.getPuzzles();
}
