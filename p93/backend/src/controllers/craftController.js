const { CraftModel, UserModel } = require('../models/database');

exports.getCrafts = (req, res) => {
  try {
    let crafts = CraftModel.findAll();
    const { userId, isPublic } = req.query;
    
    if (userId) {
      crafts = crafts.filter(c => c.userId === userId);
    }
    if (isPublic !== undefined) {
      crafts = crafts.filter(c => c.isPublic === (isPublic === 'true'));
    }
    
    const allUsers = UserModel.findAll();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    crafts = crafts.map(craft => {
      const user = userMap.get(craft.userId);
      return { ...craft, author: user ? { id: user.id, username: user.username, avatar: user.avatar } : null };
    });
    
    res.json(crafts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCraftById = (req, res) => {
  try {
    const craft = CraftModel.findById(req.params.id);
    if (!craft) {
      return res.status(404).json({ error: 'Craft not found' });
    }
    const user = UserModel.findById(craft.userId);
    res.json({ ...craft, author: user ? { id: user.id, username: user.username, avatar: user.avatar } : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createCraft = async (req, res) => {
  try {
    const craft = await CraftModel.create(req.body);
    res.status(201).json(craft);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateCraft = async (req, res) => {
  try {
    const craft = await CraftModel.update(req.params.id, req.body);
    if (!craft) {
      return res.status(404).json({ error: 'Craft not found' });
    }
    res.json(craft);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteCraft = async (req, res) => {
  try {
    const success = await CraftModel.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Craft not found' });
    }
    res.json({ message: 'Craft deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.likeCraft = async (req, res) => {
  try {
    const craft = await CraftModel.incrementLikes(req.params.id);
    if (!craft) {
      return res.status(404).json({ error: 'Craft not found' });
    }
    res.json(craft);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
