const db = require('./database');

const puzzleTypes = {
  CODE_LOCK: 'code_lock',
  JIGSAW: 'jigsaw',
  HIDDEN_OBJECT: 'hidden_object'
};

const defaultPuzzles = {
  code_lock_1: {
    id: 'code_lock_1',
    type: puzzleTypes.CODE_LOCK,
    name: '神秘密码箱',
    config: {
      code: '1234',
      hint: '答案藏在时钟的数字中...',
      maxAttempts: 5
    }
  },
  jigsaw_1: {
    id: 'jigsaw_1',
    type: puzzleTypes.JIGSAW,
    name: '古老壁画拼图',
    config: {
      image: 'wall_art.jpg',
      gridSize: { rows: 3, cols: 3 },
      pieces: 9
    }
  },
  hidden_object_1: {
    id: 'hidden_object_1',
    type: puzzleTypes.HIDDEN_OBJECT,
    name: '寻找钥匙',
    config: {
      scene: 'study_room',
      objects: [
        { id: 'key_1', name: '金钥匙', x: 450, y: 320, found: false },
        { id: 'book_1', name: '神秘古书', x: 200, y: 150, found: false },
        { id: 'candle_1', name: '蜡烛', x: 600, y: 280, found: false }
      ],
      requiredCount: 3
    }
  }
};

class PuzzleEngine {
  constructor() {
    this.puzzles = new Map();
    this.loadDefaultPuzzles();
  }

  loadDefaultPuzzles() {
    Object.values(defaultPuzzles).forEach(puzzle => {
      this.puzzles.set(puzzle.id, puzzle);
    });
  }

  registerPuzzle(puzzleConfig) {
    this.puzzles.set(puzzleConfig.id, puzzleConfig);
  }

  getPuzzle(puzzleId) {
    return this.puzzles.get(puzzleId);
  }

  getAllPuzzles() {
    return Array.from(this.puzzles.values());
  }

  async initializeRoomPuzzles(roomId) {
    const existingProgress = await db.getPuzzleProgress(roomId);
    if (existingProgress.length > 0) return;

    for (const puzzle of this.puzzles.values()) {
      const initialState = this.getInitialState(puzzle.type, puzzle.config);
      await db.savePuzzleProgress(roomId, puzzle.id, puzzle.type, false, initialState);
    }
  }

  getInitialState(puzzleType, config) {
    switch (puzzleType) {
      case puzzleTypes.CODE_LOCK:
        return {
          attempts: 0,
          currentInput: '',
          isLocked: true
        };
      case puzzleTypes.JIGSAW:
        return {
          pieces: this.generateJigsawPieces(config),
          isComplete: false
        };
      case puzzleTypes.HIDDEN_OBJECT:
        return {
          foundObjects: [],
          objects: config.objects.map(obj => ({ ...obj, found: false })),
          isComplete: false
        };
      default:
        return {};
    }
  }

  generateJigsawPieces(config) {
    const pieces = [];
    const { rows, cols } = config.gridSize;
    for (let i = 0; i < rows * cols; i++) {
      pieces.push({
        id: i,
        currentRow: Math.floor(i / cols),
        currentCol: i % cols,
        correctRow: Math.floor(i / cols),
        correctCol: i % cols,
        isPlaced: false
      });
    }
    return pieces;
  }

  async handlePuzzleAction(roomId, puzzleId, action, payload) {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) {
      return { success: false, error: 'Puzzle not found' };
    }

    const progressList = await db.getPuzzleProgress(roomId);
    const progress = progressList.find(p => p.puzzle_id === puzzleId);
    if (!progress) {
      return { success: false, error: 'Puzzle progress not found' };
    }

    if (progress.is_solved) {
      return { success: true, puzzleId, isSolved: true, state: progress.state };
    }

    let result;
    switch (puzzle.type) {
      case puzzleTypes.CODE_LOCK:
        result = this.handleCodeLockAction(progress.state, puzzle.config, action, payload);
        break;
      case puzzleTypes.JIGSAW:
        result = this.handleJigsawAction(progress.state, puzzle.config, action, payload);
        break;
      case puzzleTypes.HIDDEN_OBJECT:
        result = this.handleHiddenObjectAction(progress.state, puzzle.config, action, payload);
        break;
      default:
        result = { success: false, error: 'Unknown puzzle type' };
    }

    if (result.success) {
      await db.savePuzzleProgress(roomId, puzzleId, puzzle.type, result.isSolved || false, result.state);
    }

    return {
      ...result,
      puzzleId,
      puzzleType: puzzle.type,
      puzzleName: puzzle.name
    };
  }

  handleCodeLockAction(state, config, action, payload) {
    const newState = { ...state };

    switch (action) {
      case 'input':
        if (newState.attempts >= config.maxAttempts) {
          return { success: false, error: 'Too many attempts', state: newState };
        }
        newState.currentInput = payload.code;
        break;
      case 'submit':
        if (newState.attempts >= config.maxAttempts) {
          return { success: false, error: 'Too many attempts', state: newState };
        }
        newState.attempts++;
        if (payload.code === config.code) {
          newState.isLocked = false;
          return { success: true, isSolved: true, state: newState };
        }
        newState.currentInput = '';
        return { success: true, isSolved: false, state: newState };
      case 'reset':
        newState.currentInput = '';
        return { success: true, isSolved: false, state: newState };
      default:
        return { success: false, error: 'Unknown action' };
    }

    return { success: true, isSolved: false, state: newState };
  }

  handleJigsawAction(state, config, action, payload) {
    const newState = { ...state, pieces: [...state.pieces] };

    switch (action) {
      case 'move_piece':
        const pieceIndex = newState.pieces.findIndex(p => p.id === payload.pieceId);
        if (pieceIndex === -1) {
          return { success: false, error: 'Piece not found' };
        }
        newState.pieces[pieceIndex] = {
          ...newState.pieces[pieceIndex],
          currentRow: payload.row,
          currentCol: payload.col
        };
        const isComplete = this.checkJigsawComplete(newState.pieces);
        if (isComplete) {
          newState.isComplete = true;
          return { success: true, isSolved: true, state: newState };
        }
        return { success: true, isSolved: false, state: newState };
      case 'shuffle':
        newState.pieces = this.shufflePieces(newState.pieces);
        newState.isComplete = false;
        return { success: true, isSolved: false, state: newState };
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  checkJigsawComplete(pieces) {
    return pieces.every(piece => 
      piece.currentRow === piece.correctRow && 
      piece.currentCol === piece.correctCol
    );
  }

  shufflePieces(pieces) {
    const shuffled = pieces.map(p => ({ ...p }));
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i].currentRow, shuffled[j].currentRow] = [shuffled[j].currentRow, shuffled[i].currentRow];
      [shuffled[i].currentCol, shuffled[j].currentCol] = [shuffled[j].currentCol, shuffled[i].currentCol];
    }
    return shuffled;
  }

  handleHiddenObjectAction(state, config, action, payload) {
    const newState = { 
      ...state, 
      foundObjects: [...state.foundObjects],
      objects: state.objects.map(o => ({ ...o }))
    };

    switch (action) {
      case 'find_object':
        const objIndex = newState.objects.findIndex(o => o.id === payload.objectId);
        if (objIndex === -1) {
          return { success: false, error: 'Object not found' };
        }
        if (newState.objects[objIndex].found) {
          return { success: true, isSolved: false, state: newState };
        }
        newState.objects[objIndex].found = true;
        newState.foundObjects.push(payload.objectId);
        
        if (newState.foundObjects.length >= config.requiredCount) {
          newState.isComplete = true;
          return { success: true, isSolved: true, state: newState };
        }
        return { success: true, isSolved: false, state: newState };
      default:
        return { success: false, error: 'Unknown action' };
    }
  }

  async getRoomPuzzleState(roomId, puzzleId) {
    const progressList = await db.getPuzzleProgress(roomId);
    const progress = progressList.find(p => p.puzzle_id === puzzleId);
    if (!progress) return null;

    const puzzle = this.puzzles.get(puzzleId);
    return {
      puzzleId,
      puzzleType: progress.puzzle_type,
      puzzleName: puzzle?.name,
      isSolved: progress.is_solved,
      state: progress.state,
      config: puzzle?.config
    };
  }

  async getAllRoomPuzzles(roomId) {
    const progressList = await db.getPuzzleProgress(roomId);
    return progressList.map(progress => {
      const puzzle = this.puzzles.get(progress.puzzle_id);
      return {
        puzzleId: progress.puzzle_id,
        puzzleType: progress.puzzle_type,
        puzzleName: puzzle?.name,
        isSolved: progress.is_solved
      };
    });
  }

  async getPuzzleEngineState(roomId) {
    const progressList = await db.getPuzzleProgress(roomId);
    return progressList.map(progress => {
      const puzzle = this.puzzles.get(progress.puzzle_id);
      return {
        puzzleId: progress.puzzle_id,
        puzzleType: progress.puzzle_type,
        puzzleName: puzzle?.name,
        isSolved: progress.is_solved,
        state: progress.state,
        config: puzzle?.config
      };
    });
  }
}

module.exports = {
  PuzzleEngine,
  puzzleTypes,
  defaultPuzzles
};
