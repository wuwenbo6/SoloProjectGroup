export class TeachRecorder {
  constructor() {
    this.isRecording = false;
    this.isPlaying = false;
    this.recordedTrajectory = [];
    this.startTime = 0;
    this.playbackIndex = 0;
    this.playbackCallback = null;
    this.playbackCompleteCallback = null;
  }

  startRecording(initialAngles) {
    this.isRecording = true;
    this.recordedTrajectory = [];
    this.startTime = performance.now();
    this.recordPoint(initialAngles);
  }

  recordPoint(jointAngles) {
    if (!this.isRecording) return;
    
    const timestamp = performance.now() - this.startTime;
    this.recordedTrajectory.push({
      timestamp,
      jointAngles: [...jointAngles]
    });
  }

  stopRecording() {
    this.isRecording = false;
    return this.recordedTrajectory.length;
  }

  getTrajectory() {
    return this.recordedTrajectory;
  }

  setTrajectory(trajectory) {
    this.recordedTrajectory = trajectory;
  }

  clearTrajectory() {
    this.recordedTrajectory = [];
  }

  startPlayback(callback, completeCallback = null) {
    if (this.recordedTrajectory.length < 2) return false;
    
    this.isPlaying = true;
    this.playbackIndex = 0;
    this.playbackCallback = callback;
    this.playbackCompleteCallback = completeCallback;
    this._playNextPoint();
    return true;
  }

  _playNextPoint() {
    if (!this.isPlaying || this.playbackIndex >= this.recordedTrajectory.length) {
      this.isPlaying = false;
      if (this.playbackCompleteCallback) {
        this.playbackCompleteCallback();
      }
      return;
    }

    const currentPoint = this.recordedTrajectory[this.playbackIndex];
    const nextPoint = this.recordedTrajectory[this.playbackIndex + 1];

    if (!nextPoint) {
      this.playbackCallback(currentPoint.jointAngles);
      this.isPlaying = false;
      if (this.playbackCompleteCallback) {
        this.playbackCompleteCallback();
      }
      return;
    }

    const duration = nextPoint.timestamp - currentPoint.timestamp;
    const steps = Math.max(10, Math.floor(duration / 16));
    let step = 0;

    const interpolate = () => {
      if (!this.isPlaying) return;
      
      const t = step / steps;
      const interpolatedAngles = currentPoint.jointAngles.map((start, i) => 
        start + (nextPoint.jointAngles[i] - start) * t
      );

      this.playbackCallback(interpolatedAngles);

      step++;
      if (step <= steps) {
        setTimeout(interpolate, duration / steps);
      } else {
        this.playbackIndex++;
        this._playNextPoint();
      }
    };

    interpolate();
  }

  stopPlayback() {
    this.isPlaying = false;
  }

  getDuration() {
    if (this.recordedTrajectory.length < 2) return 0;
    return this.recordedTrajectory[this.recordedTrajectory.length - 1].timestamp;
  }

  exportToJSON(options = {}) {
    const { prettyPrint = true, includeMetadata = true } = options;
    
    const data = {
      version: "1.0",
      created: new Date().toISOString(),
      duration: this.getDuration(),
      pointCount: this.recordedTrajectory.length,
      trajectory: this.recordedTrajectory.map(point => ({
        time: point.timestamp / 1000,
        joints: point.jointAngles.map(a => a * 180 / Math.PI)
      }))
    };

    if (includeMetadata) {
      data.metadata = {
        robotType: "6-DOF Manipulator",
        jointCount: 6,
        units: "degrees",
        interpolation: "linear"
      };
    }

    return JSON.stringify(data, null, prettyPrint ? 2 : 0);
  }

  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      this.recordedTrajectory = data.trajectory.map(point => ({
        timestamp: point.time * 1000,
        jointAngles: point.joints.map(a => a * Math.PI / 180)
      }));
      return true;
    } catch (e) {
      console.error("Failed to import trajectory:", e);
      return false;
    }
  }
}

export class MultiArmManager {
  constructor(count = 2) {
    this.armCount = count;
    this.arms = [];
    this.collisionMargin = 0.05;
    
    const offsets = [
      [0, 0, 0],
      [0.6, 0, 0],
      [-0.6, 0, 0],
      [0, 0.6, 0],
      [0, -0.6, 0]
    ];
    
    for (let i = 0; i < count; i++) {
      this.arms.push({
        id: i,
        name: `Arm ${i + 1}`,
        baseOffset: offsets[i] || [i * 0.6 - 0.3, 0, 0],
        jointAngles: [0, 0, 0, 0, 0, 0],
        color: this._getArmColor(i),
        active: i === 0
      });
    }
  }

  _getArmColor(index) {
    const colors = [
      [0.0, 0.7, 1.0],
      [1.0, 0.5, 0.0],
      [0.0, 0.8, 0.4],
      [0.8, 0.2, 0.8],
      [1.0, 0.8, 0.0]
    ];
    return colors[index % colors.length];
  }

  setArmJointAngles(armId, jointAngles) {
    if (armId >= 0 && armId < this.arms.length) {
      this.arms[armId].jointAngles = [...jointAngles];
    }
  }

  getArmJointAngles(armId) {
    if (armId >= 0 && armId < this.arms.length) {
      return [...this.arms[armId].jointAngles];
    }
    return null;
  }

  setActiveArm(armId) {
    this.arms.forEach((arm, i) => {
      arm.active = i === armId;
    });
  }

  getActiveArmId() {
    return this.arms.findIndex(arm => arm.active);
  }

  checkArmToArmCollision(arm1Id, arm2Id, jointPositions1, jointPositions2, kinematics) {
    const arm1 = this.arms[arm1Id];
    const arm2 = this.arms[arm2Id];
    
    if (!arm1 || !arm2) return false;
    
    const offset1 = arm1.baseOffset;
    const offset2 = arm2.baseOffset;
    
    const segments1 = kinematics.getLinkSegments(jointPositions1);
    const segments2 = kinematics.getLinkSegments(jointPositions2);
    
    for (const seg1 of segments1) {
      const s1Start = [
        seg1.start[0] + offset1[0],
        seg1.start[1] + offset1[1],
        seg1.start[2] + offset1[2]
      ];
      const s1End = [
        seg1.end[0] + offset1[0],
        seg1.end[1] + offset1[1],
        seg1.end[2] + offset1[2]
      ];
      
      for (const seg2 of segments2) {
        const s2Start = [
          seg2.start[0] + offset2[0],
          seg2.start[1] + offset2[1],
          seg2.start[2] + offset2[2]
        ];
        const s2End = [
          seg2.end[0] + offset2[0],
          seg2.end[1] + offset2[1],
          seg2.end[2] + offset2[2]
        ];
        
        const minDist = this._segmentMinDistance(s1Start, s1End, s2Start, s2End);
        const combinedRadius = seg1.radius + seg2.radius + this.collisionMargin;
        
        if (minDist < combinedRadius) {
          return true;
        }
      }
    }
    
    return false;
  }

  _segmentMinDistance(p1, p2, p3, p4) {
    const u = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
    const v = [p4[0] - p3[0], p4[1] - p3[1], p4[2] - p3[2]];
    const w = [p1[0] - p3[0], p1[1] - p3[1], p1[2] - p3[2]];
    
    const a = u[0]*u[0] + u[1]*u[1] + u[2]*u[2];
    const b = u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
    const c = v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
    const d = u[0]*w[0] + u[1]*w[1] + u[2]*w[2];
    const e = v[0]*w[0] + v[1]*w[1] + v[2]*w[2];
    const denom = a * c - b * b;
    
    let sN, sD = denom;
    let tN, tD = denom;
    
    if (denom < 1e-7) {
      sN = 0;
      sD = 1;
      tN = e;
      tD = c;
    } else {
      sN = b * e - c * d;
      tN = a * e - b * d;
      
      if (sN < 0) {
        sN = 0;
        tN = e;
        tD = c;
      } else if (sN > sD) {
        sN = sD;
        tN = e + b;
        tD = c;
      }
    }
    
    if (tN < 0) {
      tN = 0;
      if (-d < 0) {
        sN = 0;
      } else if (-d > a) {
        sN = sD;
      } else {
        sN = -d;
        sD = a;
      }
    } else if (tN > tD) {
      tN = tD;
      if ((-d + b) < 0) {
        sN = 0;
      } else if ((-d + b) > a) {
        sN = sD;
      } else {
        sN = (-d + b);
        sD = a;
      }
    }
    
    const sc = Math.abs(sN) < 1e-7 ? 0 : sN / sD;
    const tc = Math.abs(tN) < 1e-7 ? 0 : tN / tD;
    
    const dP = [
      w[0] + sc * u[0] - tc * v[0],
      w[1] + sc * u[1] - tc * v[1],
      w[2] + sc * u[2] - tc * v[2]
    ];
    
    return Math.sqrt(dP[0]*dP[0] + dP[1]*dP[1] + dP[2]*dP[2]);
  }

  checkAllCollisions(jointPositionsArray, kinematics) {
    const collisions = [];
    
    for (let i = 0; i < this.arms.length; i++) {
      for (let j = i + 1; j < this.arms.length; j++) {
        if (this.checkArmToArmCollision(
          i, j, 
          jointPositionsArray[i], 
          jointPositionsArray[j], 
          kinematics
        )) {
          collisions.push({ arm1: i, arm2: j });
        }
      }
    }
    
    return collisions;
  }

  getArmWorldPositions(jointPositions, armId) {
    const arm = this.arms[armId];
    if (!arm) return jointPositions;
    
    const offset = arm.baseOffset;
    return jointPositions.map(pos => [
      pos[0] + offset[0],
      pos[1] + offset[1],
      pos[2] + offset[2]
    ]);
  }
}

export function exportPathToJSON(pathData, options = {}) {
  const {
    prettyPrint = true,
    includeWorkspace = true,
    includeJoint = true,
    metadata = {}
  } = options;

  const data = {
    version: "1.0",
    created: new Date().toISOString(),
    metadata: {
      robotType: "6-DOF Manipulator",
      planner: "RRT*",
      pointCount: pathData.length,
      ...metadata
    }
  };

  if (includeJoint && pathData[0] && pathData[0].jointAngles) {
    data.jointPath = pathData.map((point, i) => ({
      index: i,
      angles: point.jointAngles.map(a => a * 180 / Math.PI)
    }));
  }

  if (includeWorkspace && pathData[0] && pathData[0].position) {
    data.workspacePath = pathData.map((point, i) => ({
      index: i,
      position: point.position
    }));
  }

  return JSON.stringify(data, null, prettyPrint ? 2 : 0);
}
