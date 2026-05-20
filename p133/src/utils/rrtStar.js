import { Kinematics } from './kinematics';

export class Node {
  constructor(jointAngles, parent = null) {
    this.jointAngles = jointAngles;
    this.parent = parent;
    this.cost = parent ? parent.cost + this.distance(parent) : 0;
  }

  distance(other) {
    let dist = 0;
    for (let i = 0; i < 6; i++) {
      const diff = this.jointAngles[i] - other.jointAngles[i];
      dist += diff * diff;
    }
    return Math.sqrt(dist);
  }
}

export class RRTStar {
  constructor(obstacles = [], workspaceBounds = null) {
    this.kinematics = new Kinematics();
    this.obstacles = obstacles;
    this.workspaceBounds = workspaceBounds || {
      x: [-1, 1],
      y: [-1, 1],
      z: [0, 1.2]
    };
    this.maxIterations = 300;
    this.goalBias = 0.15;
    this.stepSize = 0.5;
    this.connectionRadius = 0.8;
    this.collisionCheckSteps = 8;
  }

  randomConfig() {
    const angles = [];
    for (let i = 0; i < 6; i++) {
      const limits = this.kinematics.jointLimits[i];
      angles.push(Math.random() * (limits.max - limits.min) + limits.min);
    }
    return angles;
  }

  sampleGoal(goalAngles) {
    if (Math.random() < this.goalBias) {
      return goalAngles;
    }
    return this.randomConfig();
  }

  nearestNode(nodes, sampleAngles) {
    const sampleNode = new Node(sampleAngles);
    let nearest = null;
    let minDist = Infinity;
    
    for (const node of nodes) {
      const dist = node.distance(sampleNode);
      if (dist < minDist) {
        minDist = dist;
        nearest = node;
      }
    }
    
    return nearest;
  }

  steer(fromNode, toAngles) {
    const fromAngles = fromNode.jointAngles;
    const direction = [];
    let norm = 0;
    
    for (let i = 0; i < 6; i++) {
      direction.push(toAngles[i] - fromAngles[i]);
      norm += direction[i] * direction[i];
    }
    norm = Math.sqrt(norm);
    
    if (norm <= this.stepSize) {
      return new Node(toAngles, fromNode);
    }
    
    const newAngles = [];
    for (let i = 0; i < 6; i++) {
      newAngles.push(fromAngles[i] + (direction[i] / norm) * this.stepSize);
    }
    
    return new Node(newAngles, fromNode);
  }

  pointToSegmentDistance(point, segStart, segEnd) {
    const ab = [
      segEnd[0] - segStart[0],
      segEnd[1] - segStart[1],
      segEnd[2] - segStart[2]
    ];
    const ap = [
      point[0] - segStart[0],
      point[1] - segStart[1],
      point[2] - segStart[2]
    ];
    
    const abSq = ab[0]*ab[0] + ab[1]*ab[1] + ab[2]*ab[2];
    if (abSq < 1e-10) {
      return Math.sqrt(ap[0]*ap[0] + ap[1]*ap[1] + ap[2]*ap[2]);
    }
    
    let t = (ap[0]*ab[0] + ap[1]*ab[1] + ap[2]*ab[2]) / abSq;
    t = Math.max(0, Math.min(1, t));
    
    const closest = [
      segStart[0] + t * ab[0],
      segStart[1] + t * ab[1],
      segStart[2] + t * ab[2]
    ];
    
    const dist = Math.sqrt(
      (point[0] - closest[0])**2 +
      (point[1] - closest[1])**2 +
      (point[2] - closest[2])**2
    );
    
    return { distance: dist, closest, t };
  }

  capsuleBoxCollision(segStart, segEnd, radius, box) {
    const halfW = box.size[0] / 2;
    const halfH = box.size[1] / 2;
    const halfD = box.size[2] / 2;
    
    const boxMin = [
      box.position[0] - halfW,
      box.position[1] - halfH,
      box.position[2] - halfD
    ];
    const boxMax = [
      box.position[0] + halfW,
      box.position[1] + halfH,
      box.position[2] + halfD
    ];
    
    const checkPoints = [segStart, segEnd];
    const steps = 5;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      checkPoints.push([
        segStart[0] + (segEnd[0] - segStart[0]) * t,
        segStart[1] + (segEnd[1] - segStart[1]) * t,
        segStart[2] + (segEnd[2] - segStart[2]) * t
      ]);
    }
    
    for (const point of checkPoints) {
      const clamped = [
        Math.max(boxMin[0], Math.min(boxMax[0], point[0])),
        Math.max(boxMin[1], Math.min(boxMax[1], point[1])),
        Math.max(boxMin[2], Math.min(boxMax[2], point[2]))
      ];
      
      const dist = Math.sqrt(
        (point[0] - clamped[0])**2 +
        (point[1] - clamped[1])**2 +
        (point[2] - clamped[2])**2
      );
      
      if (dist < radius - 0.005) {
        return true;
      }
    }
    
    return false;
  }

  pointInBox(point, box) {
    const halfW = box.size[0] / 2;
    const halfH = box.size[1] / 2;
    const halfD = box.size[2] / 2;
    
    return (
      point[0] >= box.position[0] - halfW &&
      point[0] <= box.position[0] + halfW &&
      point[1] >= box.position[1] - halfH &&
      point[1] <= box.position[1] + halfH &&
      point[2] >= box.position[2] - halfD &&
      point[2] <= box.position[2] + halfD
    );
  }

  checkCollision(jointAngles) {
    const fk = this.kinematics.forwardKinematics(jointAngles);
    const segments = this.kinematics.getLinkSegments(fk.jointPositions);
    
    for (const segment of segments) {
      for (const obs of this.obstacles) {
        if (this.capsuleBoxCollision(
          segment.start, 
          segment.end, 
          segment.radius, 
          obs
        )) {
          return true;
        }
      }
    }
    
    return false;
  }

  lineCollisionCheck(fromAngles, toAngles, steps = null) {
    const checkSteps = steps || this.collisionCheckSteps;
    
    for (let i = 0; i <= checkSteps; i++) {
      const t = i / checkSteps;
      const interpolated = [];
      for (let j = 0; j < 6; j++) {
        interpolated.push(fromAngles[j] + (toAngles[j] - fromAngles[j]) * t);
      }
      if (this.checkCollision(interpolated)) {
        return true;
      }
    }
    return false;
  }

  nearNodes(nodes, newNode, radius) {
    const near = [];
    for (const node of nodes) {
      if (newNode.distance(node) <= radius) {
        near.push(node);
      }
    }
    return near;
  }

  chooseParent(nodes, newNode, nearNodes) {
    let bestParent = newNode.parent;
    let bestCost = newNode.cost;
    
    for (const node of nearNodes) {
      if (!this.lineCollisionCheck(node.jointAngles, newNode.jointAngles, 6)) {
        const potentialCost = node.cost + node.distance(newNode);
        if (potentialCost < bestCost) {
          bestCost = potentialCost;
          bestParent = node;
        }
      }
    }
    
    newNode.parent = bestParent;
    newNode.cost = bestCost;
  }

  rewire(nodes, newNode, nearNodes) {
    for (const node of nearNodes) {
      if (!this.lineCollisionCheck(newNode.jointAngles, node.jointAngles, 6)) {
        const potentialCost = newNode.cost + newNode.distance(node);
        if (potentialCost < node.cost) {
          node.parent = newNode;
          node.cost = potentialCost;
        }
      }
    }
  }

  plan(startAngles, goalPos) {
    const ikResult = this.kinematics.inverseKinematics(goalPos, null, startAngles);
    if (!ikResult.success) {
      return { success: false, path: [], message: '目标位置不可达' };
    }
    
    const goalAngles = ikResult.jointAngles;
    
    if (this.checkCollision(goalAngles)) {
      return { success: false, path: [], message: '目标位置在障碍物内' };
    }
    
    const nodes = [new Node(startAngles)];
    let bestGoalNode = null;
    let bestGoalCost = Infinity;
    
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const sample = this.sampleGoal(goalAngles);
      const nearest = this.nearestNode(nodes, sample);
      const newNode = this.steer(nearest, sample);
      
      if (this.checkCollision(newNode.jointAngles)) {
        continue;
      }
      
      const near = this.nearNodes(nodes, newNode, this.connectionRadius);
      this.chooseParent(nodes, newNode, near);
      nodes.push(newNode);
      this.rewire(nodes, newNode, near);
      
      const goalNode = new Node(goalAngles);
      if (newNode.distance(goalNode) < 0.15) {
        if (!this.lineCollisionCheck(newNode.jointAngles, goalAngles, 10)) {
          const totalCost = newNode.cost + newNode.distance(goalNode);
          if (totalCost < bestGoalCost) {
            bestGoalCost = totalCost;
            bestGoalNode = new Node(goalAngles, newNode);
          }
        }
      }
    }
    
    if (!bestGoalNode) {
      return { success: false, path: [], message: '未找到可行路径' };
    }
    
    const path = [];
    let current = bestGoalNode;
    while (current) {
      path.unshift(current.jointAngles);
      current = current.parent;
    }
    
    return {
      success: true,
      path: this.smoothPath(path),
      cost: bestGoalCost,
      iterations: this.maxIterations
    };
  }

  smoothPath(path, iterations = 100) {
    if (path.length < 3) return path;
    
    let smoothed = [...path];
    
    for (let iter = 0; iter < iterations; iter++) {
      let i = Math.floor(Math.random() * (smoothed.length - 1));
      let j = Math.floor(Math.random() * (smoothed.length - i)) + i;
      
      if (j - i < 2) continue;
      
      if (!this.lineCollisionCheck(smoothed[i], smoothed[j], 15)) {
        smoothed = [...smoothed.slice(0, i + 1), ...smoothed.slice(j)];
      }
    }
    
    return smoothed;
  }

  getWorkspacePath(jointPath) {
    return jointPath.map(angles => {
      const fk = this.kinematics.forwardKinematics(angles);
      return fk.position;
    });
  }
}
