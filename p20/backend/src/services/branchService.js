const { pool } = require('../database');

class BranchService {
  async createBranch(sceneId, name, description, userId, fromBranchId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let parentCommitId = null;
      let initialSnapshot = [];

      if (fromBranchId) {
        const headResult = await client.query(
          'SELECT commit_id FROM scene_branch_head WHERE scene_id = $1 AND branch_id = $2',
          [sceneId, fromBranchId]
        );
        
        if (headResult.rows.length > 0) {
          parentCommitId = headResult.rows[0].commit_id;
          
          const commitResult = await client.query(
            'SELECT snapshot_data FROM scene_commits WHERE id = $1',
            [parentCommitId]
          );
          
          if (commitResult.rows.length > 0) {
            initialSnapshot = commitResult.rows[0].snapshot_data;
          }
        }
      }

      const branchResult = await client.query(
        `INSERT INTO scene_branches 
         (scene_id, name, description, created_by, parent_commit_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, created_at`,
        [sceneId, name, description, userId, parentCommitId]
      );
      
      const branchId = branchResult.rows[0].id;

      const commitResult = await client.query(
        `INSERT INTO scene_commits 
         (scene_id, branch_id, parent_ids, message, snapshot_data, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          sceneId, 
          branchId, 
          parentCommitId ? [parentCommitId] : [], 
          fromBranchId ? `Branch created from ${fromBranchId}` : 'Initial commit',
          initialSnapshot,
          userId
        ]
      );

      const commitId = commitResult.rows[0].id;

      await client.query(
        `INSERT INTO scene_branch_head (scene_id, branch_id, commit_id)
         VALUES ($1, $2, $3)`,
        [sceneId, branchId, commitId]
      );

      await client.query('COMMIT');
      
      return {
        branch: branchResult.rows[0],
        commitId
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getBranches(sceneId) {
    const result = await pool.query(
      `SELECT b.id, b.name, b.description, b.created_at, b.created_by,
              u.username as creator_name,
              h.commit_id as head_commit_id,
              c.created_at as head_commit_time,
              c.message as head_commit_message
       FROM scene_branches b
       LEFT JOIN scene_branch_head h ON b.id = h.branch_id
       LEFT JOIN scene_commits c ON h.commit_id = c.id
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.scene_id = $1
       ORDER BY b.created_at DESC`,
      [sceneId]
    );
    return result.rows;
  }

  async getBranch(sceneId, branchId) {
    const result = await pool.query(
      `SELECT b.*, u.username as creator_name,
              h.commit_id as head_commit_id,
              c.snapshot_data as head_snapshot
       FROM scene_branches b
       LEFT JOIN scene_branch_head h ON b.id = h.branch_id
       LEFT JOIN scene_commits c ON h.commit_id = c.id
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.scene_id = $1 AND b.id = $2`,
      [sceneId, branchId]
    );
    return result.rows[0];
  }

  async deleteBranch(sceneId, branchId, userId) {
    const result = await pool.query(
      'DELETE FROM scene_branches WHERE scene_id = $1 AND id = $2 RETURNING id',
      [sceneId, branchId]
    );
    return result.rows.length > 0;
  }

  async commit(sceneId, branchId, message, snapshotData, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const headResult = await client.query(
        'SELECT commit_id FROM scene_branch_head WHERE scene_id = $1 AND branch_id = $2',
        [sceneId, branchId]
      );

      const parentIds = headResult.rows.length > 0 ? [headResult.rows[0].commit_id] : [];

      const commitResult = await client.query(
        `INSERT INTO scene_commits 
         (scene_id, branch_id, parent_ids, message, snapshot_data, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [sceneId, branchId, parentIds, message, snapshotData, userId]
      );

      const commitId = commitResult.rows[0].id;

      if (headResult.rows.length > 0) {
        await client.query(
          `UPDATE scene_branch_head SET commit_id = $1 
           WHERE scene_id = $2 AND branch_id = $3`,
          [commitId, sceneId, branchId]
        );
      } else {
        await client.query(
          `INSERT INTO scene_branch_head (scene_id, branch_id, commit_id)
           VALUES ($1, $2, $3)`,
          [sceneId, branchId, commitId]
        );
      }

      await client.query('COMMIT');
      
      return {
        id: commitId,
        created_at: commitResult.rows[0].created_at
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getCommitHistory(sceneId, branchId, limit = 50) {
    const result = await pool.query(
      `SELECT c.id, c.parent_ids, c.message, c.created_at, 
              c.created_by, u.username as creator_name,
              jsonb_array_length(c.snapshot_data) as object_count
       FROM scene_commits c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.scene_id = $1 AND c.branch_id = $2
       ORDER BY c.created_at DESC
       LIMIT $3`,
      [sceneId, branchId, limit]
    );
    return result.rows;
  }

  async getCommit(sceneId, commitId) {
    const result = await pool.query(
      `SELECT c.*, u.username as creator_name
       FROM scene_commits c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.scene_id = $1 AND c.id = $2`,
      [sceneId, commitId]
    );
    return result.rows[0];
  }

  async compareCommits(sceneId, commitAId, commitBId) {
    const commitA = await this.getCommit(sceneId, commitAId);
    const commitB = await this.getCommit(sceneId, commitBId);

    if (!commitA || !commitB) {
      throw new Error('Commit not found');
    }

    const objectsA = new Map(commitA.snapshot_data.map(obj => [obj.id, obj]));
    const objectsB = new Map(commitB.snapshot_data.map(obj => [obj.id, obj]));

    const allIds = new Set([...objectsA.keys(), ...objectsB.keys()]);
    const changes = [];

    allIds.forEach(id => {
      const objA = objectsA.get(id);
      const objB = objectsB.get(id);

      if (objA && objB) {
        const diff = this.compareObjects(objA, objB);
        if (diff.changes.length > 0) {
          changes.push({
            type: 'modified',
            objectId: id,
            objectName: objB.name || objA.name,
            changes: diff.changes
          });
        }
      } else if (objB && !objA) {
        changes.push({
          type: 'added',
          objectId: id,
          objectName: objB.name,
          object: objB
        });
      } else if (objA && !objB) {
        changes.push({
          type: 'removed',
          objectId: id,
          objectName: objA.name,
          object: objA
        });
      }
    });

    return {
      commitA: {
        id: commitA.id,
        message: commitA.message,
        created_at: commitA.created_at
      },
      commitB: {
        id: commitB.id,
        message: commitB.message,
        created_at: commitB.created_at
      },
      changes,
      summary: {
        added: changes.filter(c => c.type === 'added').length,
        removed: changes.filter(c => c.type === 'removed').length,
        modified: changes.filter(c => c.type === 'modified').length
      }
    };
  }

  compareObjects(objA, objB) {
    const changes = [];
    const fields = ['position', 'rotation', 'scale', 'color', 'name'];

    fields.forEach(field => {
      const valA = objA[field];
      const valB = objB[field];

      if (typeof valA === 'object' && valA !== null) {
        const subChanges = [];
        Object.keys(valA).forEach(key => {
          if (valA[key] !== valB?.[key]) {
            subChanges.push({
              field: `${field}.${key}`,
              oldValue: valA[key],
              newValue: valB?.[key]
            });
          }
        });
        if (subChanges.length > 0) {
          changes.push(...subChanges);
        }
      } else if (valA !== valB) {
        changes.push({
          field,
          oldValue: valA,
          newValue: valB
        });
      }
    });

    return { changes };
  }

  async findCommonAncestor(sceneId, commitAId, commitBId) {
    const getAncestors = async (commitId) => {
      const ancestors = new Set();
      const queue = [commitId];

      while (queue.length > 0) {
        const current = queue.shift();
        if (ancestors.has(current)) continue;
        ancestors.add(current);

        const result = await pool.query(
          'SELECT parent_ids FROM scene_commits WHERE scene_id = $1 AND id = $2',
          [sceneId, current]
        );

        if (result.rows.length > 0) {
          result.rows[0].parent_ids.forEach(pid => {
            if (!ancestors.has(pid)) {
              queue.push(pid);
            }
          });
        }
      }

      return ancestors;
    };

    const ancestorsA = await getAncestors(commitAId);
    const ancestorsB = await getAncestors(commitBId);

    const common = [...ancestorsA].filter(id => ancestorsB.has(id));
    
    if (common.length === 0) return null;

    const result = await pool.query(
      `SELECT id, created_at FROM scene_commits 
       WHERE scene_id = $1 AND id = ANY($2::UUID[])
       ORDER BY created_at DESC
       LIMIT 1`,
      [sceneId, common]
    );

    return result.rows[0]?.id || null;
  }

  async mergeBranches(sceneId, sourceBranchId, targetBranchId, userId, strategy = 'ours') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sourceHead = await client.query(
        'SELECT commit_id FROM scene_branch_head WHERE scene_id = $1 AND branch_id = $2',
        [sceneId, sourceBranchId]
      );

      const targetHead = await client.query(
        'SELECT commit_id FROM scene_branch_head WHERE scene_id = $1 AND branch_id = $2',
        [sceneId, targetBranchId]
      );

      if (sourceHead.rows.length === 0 || targetHead.rows.length === 0) {
        throw new Error('Branch head not found');
      }

      const sourceCommitId = sourceHead.rows[0].commit_id;
      const targetCommitId = targetHead.rows[0].commit_id;

      if (sourceCommitId === targetCommitId) {
        throw new Error('Branches are already in sync');
      }

      const commonAncestorId = await this.findCommonAncestor(sceneId, sourceCommitId, targetCommitId);

      const [sourceData, targetData, ancestorData] = await Promise.all([
        this.getCommit(sceneId, sourceCommitId),
        this.getCommit(sceneId, targetCommitId),
        commonAncestorId ? this.getCommit(sceneId, commonAncestorId) : null
      ]);

      const mergedSnapshot = this.performThreeWayMerge(
        ancestorData?.snapshot_data || [],
        sourceData.snapshot_data,
        targetData.snapshot_data,
        strategy
      );

      const commitResult = await client.query(
        `INSERT INTO scene_commits 
         (scene_id, branch_id, parent_ids, message, snapshot_data, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, created_at`,
        [
          sceneId, 
          targetBranchId, 
          [targetCommitId, sourceCommitId],
          `Merge branch ${sourceBranchId} into ${targetBranchId}`,
          mergedSnapshot,
          userId
        ]
      );

      const mergeCommitId = commitResult.rows[0].id;

      await client.query(
        `UPDATE scene_branch_head SET commit_id = $1 
         WHERE scene_id = $2 AND branch_id = $3`,
        [mergeCommitId, sceneId, targetBranchId]
      );

      await client.query('COMMIT');

      return {
        mergeCommitId,
        snapshot: mergedSnapshot
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  performThreeWayMerge(ancestor, source, target, strategy) {
    const ancestorMap = new Map(ancestor.map(obj => [obj.id, obj]));
    const sourceMap = new Map(source.map(obj => [obj.id, obj]));
    const targetMap = new Map(target.map(obj => [obj.id, obj]));

    const allIds = new Set([...sourceMap.keys(), ...targetMap.keys()]);
    const result = [];

    allIds.forEach(id => {
      const ancestorObj = ancestorMap.get(id);
      const sourceObj = sourceMap.get(id);
      const targetObj = targetMap.get(id);

      if (sourceObj && targetObj) {
        if (!ancestorObj) {
          if (strategy === 'ours') {
            result.push(sourceObj);
          } else if (strategy === 'theirs') {
            result.push(targetObj);
          } else {
            result.push(sourceObj);
          }
        } else {
          const merged = this.mergeObject(ancestorObj, sourceObj, targetObj, strategy);
          result.push(merged);
        }
      } else if (sourceObj) {
        result.push(sourceObj);
      } else if (targetObj) {
        result.push(targetObj);
      }
    });

    return result;
  }

  mergeObject(ancestor, source, target, strategy) {
    const merged = { ...ancestor };
    const fields = ['position', 'rotation', 'scale', 'color', 'name'];

    fields.forEach(field => {
      const sourceChanged = this.hasChanged(ancestor[field], source[field]);
      const targetChanged = this.hasChanged(ancestor[field], target[field]);

      if (sourceChanged && !targetChanged) {
        merged[field] = source[field];
      } else if (!sourceChanged && targetChanged) {
        merged[field] = target[field];
      } else if (sourceChanged && targetChanged) {
        if (strategy === 'ours') {
          merged[field] = source[field];
        } else if (strategy === 'theirs') {
          merged[field] = target[field];
        } else if (strategy === 'union') {
          if (typeof source[field] === 'object') {
            merged[field] = { ...source[field], ...target[field] };
          } else {
            merged[field] = source[field];
          }
        } else {
          merged[field] = source[field];
        }
      }
    });

    return merged;
  }

  hasChanged(oldVal, newVal) {
    if (typeof oldVal === 'object' && oldVal !== null) {
      return JSON.stringify(oldVal) !== JSON.stringify(newVal);
    }
    return oldVal !== newVal;
  }

  async getBranchStats(sceneId, branchId) {
    const commits = await this.getCommitHistory(sceneId, branchId, 1000);
    
    const totalObjects = new Set();
    commits.forEach(commit => {
      if (commit.object_count) {
        totalObjects.add(commit.object_count);
      }
    });

    return {
      totalCommits: commits.length,
      firstCommit: commits[commits.length - 1]?.created_at,
      lastCommit: commits[0]?.created_at,
      contributors: new Set(commits.map(c => c.created_by)).size
    };
  }
}

module.exports = new BranchService();
