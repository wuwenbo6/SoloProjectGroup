const { UserModel } = require('../models/database');

exports.getUsers = (req, res) => {
  try {
    const users = UserModel.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserById = (req, res) => {
  try {
    const user = UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, avatar, bio } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const existing = UserModel.findByUsername(username);
    if (existing) {
      return res.json(existing);
    }
    const user = await UserModel.create({ username, avatar, bio });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await UserModel.update(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
