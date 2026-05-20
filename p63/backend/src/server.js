require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const rubbingRoutes = require('./routes/rubbingRoutes');
const userRoutes = require('./routes/userRoutes');
const User = require('./models/User');
const collaborationSocket = require('./sockets/collaborationSocket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/rubbings', rubbingRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '拓片释读平台服务运行正常' });
});

io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);
  collaborationSocket(io, socket);
});

const PORT = process.env.PORT || 3000;

const createAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      const admin = new User({
        username: 'admin',
        email: 'admin@rubbing.com',
        password: 'Admin123!',
        role: 'admin'
      });
      await admin.save();
      console.log('管理员账户已创建: admin / Admin123!');
    }
  } catch (error) {
    console.log('创建管理员账户失败:', error.message);
  }
};

const startServer = async () => {
  try {
    await connectDB();
    console.log('数据库连接成功');
    
    await createAdminUser();
    
    server.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`WebSocket 服务已启动`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

startServer();
