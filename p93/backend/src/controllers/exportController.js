const { CraftModel, UserModel, CommentModel } = require('../models/database');

const calculateSimilarity = (craft1, craft2) => {
  let score = 0;
  let maxScore = 0;

  const tempDiff = Math.abs(craft1.temperature - craft2.temperature);
  const tempScore = Math.max(0, 1 - tempDiff / 500);
  score += tempScore * 25;
  maxScore += 25;

  const durationDiff = Math.abs(craft1.duration - craft2.duration);
  const durationScore = Math.max(0, 1 - durationDiff / 10);
  score += durationScore * 25;
  maxScore += 25;

  const materials1 = new Set(craft1.materials || []);
  const materials2 = new Set(craft2.materials || []);
  const intersection = [...materials1].filter(m => materials2.has(m));
  const union = new Set([...materials1, ...materials2]);
  if (union.size > 0) {
    score += (intersection.length / union.size) * 25;
  }
  maxScore += 25;

  const steps1 = craft1.steps || [];
  const steps2 = craft2.steps || [];
  const stepWords1 = new Set(steps1.flatMap(s => s.toLowerCase().split(/\s+/)));
  const stepWords2 = new Set(steps2.flatMap(s => s.toLowerCase().split(/\s+/)));
  const stepIntersection = [...stepWords1].filter(w => stepWords2.has(w));
  const stepUnion = new Set([...stepWords1, ...stepWords2]);
  if (stepUnion.size > 0) {
    score += (stepIntersection.length / stepUnion.size) * 25;
  }
  maxScore += 25;

  return maxScore > 0 ? score / maxScore : 0;
};

exports.getSimilarCrafts = (req, res) => {
  try {
    const { id } = req.params;
    const allCrafts = CraftModel.findAll();
    const targetCraft = allCrafts.find(c => c.id === id);
    
    if (!targetCraft) {
      return res.status(404).json({ error: 'Craft not found' });
    }

    const allUsers = UserModel.findAll();
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const similarCrafts = allCrafts
      .filter(c => c.id !== id && c.isPublic)
      .map(craft => ({
        ...craft,
        similarity: calculateSimilarity(targetCraft, craft),
        author: userMap.get(craft.userId) 
          ? { id: userMap.get(craft.userId).id, username: userMap.get(craft.userId).username, avatar: userMap.get(craft.userId).avatar }
          : null
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 6);

    res.json(similarCrafts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportJSON = (req, res) => {
  try {
    const { userId } = req.params;
    const crafts = CraftModel.findAll().filter(c => c.userId === userId);
    const comments = CommentModel.findAll().filter(c => crafts.some(craft => craft.id === c.craftId));
    
    const user = UserModel.findById(userId);
    
    const exportData = {
      exportTime: new Date().toISOString(),
      user: user ? { id: user.id, username: user.username } : null,
      crafts: crafts.map(craft => ({
        id: craft.id,
        title: craft.title,
        description: craft.description,
        materials: craft.materials,
        steps: craft.steps,
        temperature: craft.temperature,
        duration: craft.duration,
        isPublic: craft.isPublic,
        likes: craft.likes,
        images: craft.images,
        videos: craft.videos,
        createdAt: craft.createdAt,
        updatedAt: craft.updatedAt,
        comments: comments.filter(c => c.craftId === craft.id)
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ceramic-crafts-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.exportCSV = (req, res) => {
  try {
    const { userId } = req.params;
    const crafts = CraftModel.findAll().filter(c => c.userId === userId);
    
    const headers = ['ID', '标题', '描述', '材料数量', '步骤数量', '温度(°C)', '时长(小时)', '是否公开', '点赞数', '创建时间'];
    const rows = crafts.map(craft => [
      craft.id,
      `"${craft.title.replace(/"/g, '""')}"`,
      `"${(craft.description || '').replace(/"/g, '""')}"`,
      (craft.materials || []).length,
      (craft.steps || []).length,
      craft.temperature,
      craft.duration,
      craft.isPublic ? '是' : '否',
      craft.likes || 0,
      craft.createdAt
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ceramic-crafts-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
