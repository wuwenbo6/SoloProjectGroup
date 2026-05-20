const { FavoriteModel, CraftModel, UserModel } = require('../models/database');

exports.getFavoritesByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    const allFavorites = FavoriteModel.findByUserId(userId);
    const userFavorites = allFavorites.filter(fav => fav.userId === userId);
    
    const allCrafts = CraftModel.findAll();
    const allUsers = UserModel.findAll();
    
    const craftMap = new Map(allCrafts.map(c => [c.id, c]));
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    const craftsWithDetails = userFavorites.map(fav => {
      const craft = craftMap.get(fav.craftId);
      if (!craft) return null;
      const author = userMap.get(craft.userId);
      return { 
        ...fav, 
        craft: { 
          ...craft, 
          author: author ? { id: author.id, username: author.username, avatar: author.avatar } : null 
        } 
      };
    }).filter(Boolean);
    
    res.json(craftsWithDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkFavorite = (req, res) => {
  try {
    const { userId, craftId } = req.params;
    const favorite = FavoriteModel.findOne(userId, craftId);
    res.json({ isFavorite: !!favorite });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleFavorite = async (req, res) => {
  try {
    const { userId, craftId } = req.body;
    const existing = FavoriteModel.findOne(userId, craftId);
    if (existing) {
      await FavoriteModel.delete(userId, craftId);
      res.json({ isFavorite: false });
    } else {
      await FavoriteModel.create({ userId, craftId });
      res.json({ isFavorite: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
