const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDatabases = require('./config/databases');
const processRoutes = require('./routes/processRoutes');
const userRoutes = require('./routes/userRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const qnaRoutes = require('./routes/qnaRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/process', processRoutes);
app.use('/api/users', userRoutes);
app.use('/api/interaction', interactionRoutes);
app.use('/api/qna', qnaRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Brewing API Server is running' });
});

const startServer = async () => {
  try {
    await connectDatabases();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
