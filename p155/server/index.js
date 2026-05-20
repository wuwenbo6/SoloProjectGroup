const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const GameServer = require('./gameServer');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/achievements', async (req, res) => {
  try {
    const achievements = await db.getAllAchievements();
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/achievements/player/:playerId', async (req, res) => {
  try {
    const achievements = await db.getPlayerAchievements(req.params.playerId);
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/achievements/unlock', async (req, res) => {
  try {
    const { playerId, achievementId } = req.body;
    const unlocked = await db.unlockAchievement(playerId, achievementId);
    res.json({ success: true, newlyUnlocked: unlocked });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const leaderboard = await db.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/puzzles', async (req, res) => {
  try {
    const { creatorId, isPublic } = req.query;
    const puzzles = await db.getCustomPuzzles(
      creatorId || null,
      isPublic !== undefined ? isPublic === 'true' : null
    );
    res.json(puzzles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/puzzles/:id', async (req, res) => {
  try {
    const puzzle = await db.getCustomPuzzle(req.params.id);
    if (!puzzle) {
      return res.status(404).json({ error: 'Puzzle not found' });
    }
    res.json(puzzle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/puzzles', async (req, res) => {
  try {
    const { creatorId, creatorName, name, puzzleType, config, isPublic } = req.body;
    const puzzleId = uuidv4();
    await db.saveCustomPuzzle(puzzleId, creatorId, creatorName, name, puzzleType, config, isPublic);
    res.json({ success: true, puzzleId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/puzzles/:id', async (req, res) => {
  try {
    const { creatorId, creatorName, name, puzzleType, config, isPublic } = req.body;
    await db.saveCustomPuzzle(req.params.id, creatorId, creatorName, name, puzzleType, config, isPublic);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/puzzles/:id', async (req, res) => {
  try {
    const { creatorId } = req.body;
    const deleted = await db.deleteCustomPuzzle(req.params.id, creatorId);
    if (!deleted) {
      return res.status(404).json({ error: 'Puzzle not found or not authorized' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/puzzles/:id/rate', async (req, res) => {
  try {
    const { playerId, rating } = req.body;
    await db.ratePuzzle(req.params.id, playerId, rating);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/puzzle-editor', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'puzzle-editor.html'));
});

app.get('/leaderboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'leaderboard.html'));
});

async function startServer() {
  try {
    await db.initDatabase();
    console.log('Database initialized');
    
    await db.initAchievements();
    console.log('Achievements initialized');
    
    const gameServer = new GameServer(server);
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server ready`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
