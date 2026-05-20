const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');

const fileLocks = new Map();

const ensureDataDir = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
};

const readData = (filename) => {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const writeData = async (filename, data) => {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  
  while (fileLocks.get(filename)) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  fileLocks.set(filename, true);
  
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
    fs.renameSync(tempPath, filePath);
  } finally {
    fileLocks.set(filename, false);
  }
};

class UserModel {
  static FILENAME = 'users.json';

  static findAll() {
    return readData(this.FILENAME);
  }

  static findById(id) {
    const users = this.findAll();
    return users.find(user => user.id === id);
  }

  static findByUsername(username) {
    const users = this.findAll();
    return users.find(user => user.username === username);
  }

  static async create(data) {
    const users = this.findAll();
    const user = {
      id: uuidv4(),
      username: data.username,
      avatar: data.avatar || '',
      bio: data.bio || '',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeData(this.FILENAME, users);
    return user;
  }

  static async update(id, data) {
    const users = this.findAll();
    const index = users.findIndex(user => user.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...data, updatedAt: new Date().toISOString() };
    await writeData(this.FILENAME, users);
    return users[index];
  }
}

class CraftModel {
  static FILENAME = 'crafts.json';

  static findAll() {
    return readData(this.FILENAME);
  }

  static findById(id) {
    const crafts = this.findAll();
    return crafts.find(craft => craft.id === id);
  }

  static findByUserId(userId) {
    const crafts = this.findAll();
    return crafts.filter(craft => craft.userId === userId);
  }

  static async create(data) {
    const crafts = this.findAll();
    const craft = {
      id: uuidv4(),
      userId: data.userId,
      title: data.title,
      description: data.description,
      materials: data.materials || [],
      steps: data.steps || [],
      images: data.images || [],
      videos: data.videos || [],
      temperature: data.temperature,
      duration: data.duration,
      isPublic: data.isPublic !== undefined ? data.isPublic : true,
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    crafts.push(craft);
    await writeData(this.FILENAME, crafts);
    return craft;
  }

  static async update(id, data) {
    const crafts = this.findAll();
    const index = crafts.findIndex(craft => craft.id === id);
    if (index === -1) return null;
    crafts[index] = { ...crafts[index], ...data, updatedAt: new Date().toISOString() };
    await writeData(this.FILENAME, crafts);
    return crafts[index];
  }

  static async delete(id) {
    const crafts = this.findAll();
    const filtered = crafts.filter(craft => craft.id !== id);
    await writeData(this.FILENAME, filtered);
    return filtered.length !== crafts.length;
  }

  static async incrementLikes(id) {
    const crafts = this.findAll();
    const index = crafts.findIndex(craft => craft.id === id);
    if (index === -1) return null;
    crafts[index].likes = (crafts[index].likes || 0) + 1;
    await writeData(this.FILENAME, crafts);
    return crafts[index];
  }
}

class CommentModel {
  static FILENAME = 'comments.json';

  static findAll() {
    return readData(this.FILENAME);
  }

  static findByCraftId(craftId) {
    const comments = this.findAll();
    return comments.filter(comment => comment.craftId === craftId);
  }

  static async create(data) {
    const comments = this.findAll();
    const comment = {
      id: uuidv4(),
      craftId: data.craftId,
      userId: data.userId,
      username: data.username,
      content: data.content,
      createdAt: new Date().toISOString(),
    };
    comments.push(comment);
    await writeData(this.FILENAME, comments);
    return comment;
  }

  static async delete(id) {
    const comments = this.findAll();
    const filtered = comments.filter(comment => comment.id !== id);
    await writeData(this.FILENAME, filtered);
    return filtered.length !== comments.length;
  }
}

class FavoriteModel {
  static FILENAME = 'favorites.json';

  static findAll() {
    return readData(this.FILENAME);
  }

  static findByUserId(userId) {
    const favorites = this.findAll();
    return favorites;
  }

  static findOne(userId, craftId) {
    const favorites = this.findAll();
    return favorites.find(fav => fav.userId === userId && fav.craftId === craftId);
  }

  static async create(data) {
    const favorites = this.findAll();
    const existing = favorites.find(fav => fav.userId === data.userId && fav.craftId === data.craftId);
    if (existing) return existing;
    
    const favorite = {
      id: uuidv4(),
      userId: data.userId,
      craftId: data.craftId,
      createdAt: new Date().toISOString(),
    };
    favorites.push(favorite);
    await writeData(this.FILENAME, favorites);
    return favorite;
  }

  static async delete(userId, craftId) {
    const favorites = this.findAll();
    const filtered = favorites.filter(fav => !(fav.userId === userId && fav.craftId === craftId));
    await writeData(this.FILENAME, filtered);
    return filtered.length !== favorites.length;
  }
}

class QAModel {
  static FILENAME = 'qa.json';

  static findAll() {
    return readData(this.FILENAME);
  }

  static findByCraftId(craftId) {
    const qas = this.findAll();
    return qas.filter(qa => qa.craftId === craftId);
  }

  static findByStep(craftId, stepIndex) {
    const qas = this.findAll();
    return qas.filter(qa => qa.craftId === craftId && qa.stepIndex === stepIndex);
  }

  static async create(data) {
    const qas = this.findAll();
    const qa = {
      id: uuidv4(),
      craftId: data.craftId,
      stepIndex: data.stepIndex,
      userId: data.userId,
      username: data.username,
      question: data.question,
      answers: [],
      createdAt: new Date().toISOString(),
    };
    qas.push(qa);
    await writeData(this.FILENAME, qas);
    return qa;
  }

  static async addAnswer(qaId, answerData) {
    const qas = this.findAll();
    const index = qas.findIndex(qa => qa.id === qaId);
    if (index === -1) return null;
    const answer = {
      id: uuidv4(),
      userId: answerData.userId,
      username: answerData.username,
      content: answerData.content,
      createdAt: new Date().toISOString(),
    };
    qas[index].answers.push(answer);
    await writeData(this.FILENAME, qas);
    return qas[index];
  }

  static async delete(qaId) {
    const qas = this.findAll();
    const filtered = qas.filter(qa => qa.id !== qaId);
    await writeData(this.FILENAME, filtered);
    return filtered.length !== qas.length;
  }
}

module.exports = {
  UserModel,
  CraftModel,
  CommentModel,
  FavoriteModel,
  QAModel,
};
