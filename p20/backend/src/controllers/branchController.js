const branchService = require('../services/branchService');

exports.getBranches = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const branches = await branchService.getBranches(sceneId);
    res.json(branches);
  } catch (err) {
    console.error('Get branches error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getBranch = async (req, res) => {
  try {
    const { sceneId, branchId } = req.params;
    const branch = await branchService.getBranch(sceneId, branchId);
    
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json(branch);
  } catch (err) {
    console.error('Get branch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { name, description, fromBranchId } = req.body;
    const userId = req.user?.id || req.headers['x-user-id'];

    const result = await branchService.createBranch(
      sceneId, 
      name, 
      description, 
      userId,
      fromBranchId
    );
    
    res.status(201).json(result);
  } catch (err) {
    console.error('Create branch error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Branch name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { sceneId, branchId } = req.params;
    const userId = req.user?.id || req.headers['x-user-id'];

    const success = await branchService.deleteBranch(sceneId, branchId, userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Branch not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete branch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createCommit = async (req, res) => {
  try {
    const { sceneId, branchId } = req.params;
    const { message, snapshotData } = req.body;
    const userId = req.user?.id || req.headers['x-user-id'];

    const result = await branchService.commit(
      sceneId, 
      branchId, 
      message, 
      snapshotData, 
      userId
    );
    
    res.status(201).json(result);
  } catch (err) {
    console.error('Create commit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getCommitHistory = async (req, res) => {
  try {
    const { sceneId, branchId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const commits = await branchService.getCommitHistory(sceneId, branchId, limit);
    res.json(commits);
  } catch (err) {
    console.error('Get commit history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getCommit = async (req, res) => {
  try {
    const { sceneId, commitId } = req.params;
    const commit = await branchService.getCommit(sceneId, commitId);
    
    if (!commit) {
      return res.status(404).json({ error: 'Commit not found' });
    }
    
    res.json(commit);
  } catch (err) {
    console.error('Get commit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.compareCommits = async (req, res) => {
  try {
    const { sceneId, commitAId, commitBId } = req.params;
    
    const result = await branchService.compareCommits(sceneId, commitAId, commitBId);
    res.json(result);
  } catch (err) {
    console.error('Compare commits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.mergeBranches = async (req, res) => {
  try {
    const { sceneId } = req.params;
    const { sourceBranchId, targetBranchId, strategy = 'ours' } = req.body;
    const userId = req.user?.id || req.headers['x-user-id'];

    const result = await branchService.mergeBranches(
      sceneId, 
      sourceBranchId, 
      targetBranchId, 
      userId,
      strategy
    );
    
    res.json(result);
  } catch (err) {
    console.error('Merge branches error:', err);
    if (err.message === 'Branches are already in sync') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getBranchStats = async (req, res) => {
  try {
    const { sceneId, branchId } = req.params;
    const stats = await branchService.getBranchStats(sceneId, branchId);
    res.json(stats);
  } catch (err) {
    console.error('Get branch stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
