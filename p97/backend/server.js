const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const userRoutes = require('./routes/userRoutes');
const activityRoutes = require('./routes/activityRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const stepRoutes = require('./routes/stepRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  
  if (imageTypes.includes(file.mimetype) || videoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes(upload));
app.use('/api/interactions', interactionRoutes);
app.use('/api/activities', stepRoutes);
app.use('/api', exportRoutes);

app.get('/', (req, res) => {
  res.json({ message: '民俗活动记录平台 API 服务运行中' });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
