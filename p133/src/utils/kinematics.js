export class DHParameter {
  constructor(theta, d, a, alpha) {
    this.theta = theta;
    this.d = d;
    this.a = a;
    this.alpha = alpha;
  }
}

export class Kinematics {
  constructor() {
    this.dhParams = [
      new DHParameter(0, 0.15, 0, Math.PI / 2),
      new DHParameter(0, 0, 0.2, 0),
      new DHParameter(0, 0, 0.15, 0),
      new DHParameter(0, 0, 0, Math.PI / 2),
      new DHParameter(0, 0.1, 0, -Math.PI / 2),
      new DHParameter(0, 0.08, 0, 0)
    ];
    
    this.jointLimits = [
      { min: -Math.PI, max: Math.PI },
      { min: -Math.PI / 2, max: Math.PI / 2 },
      { min: -Math.PI / 2, max: Math.PI / 2 },
      { min: -Math.PI, max: Math.PI },
      { min: -Math.PI / 2, max: Math.PI / 2 },
      { min: -Math.PI, max: Math.PI }
    ];

    this.maxJointVelocity = 0.2;
    this.singularityThreshold = .001;
  }

  dhTransform(dh) {
    const ct = Math.cos(dh.theta);
    const st = Math.sin(dh.theta);
    const ca = Math.cos(dh.alpha);
    const sa = Math.sin(dh.alpha);
    
    return [
      [ct, -st * ca, st * sa, dh.a * ct],
      [st, ct * ca, -ct * sa, dh.a * st],
      [0, sa, ca, dh.d],
      [0, 0, 0, 1]
    ];
  }

  multiplyMatrices(a, b) {
    const result = Array(4).fill().map(() => Array(4).fill(0));
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        for (let k = 0; k < 4; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    return result;
  }

  forwardKinematics(jointAngles) {
    let transform = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];

    const jointPositions = [];
    
    for (let i = 0; i < 6; i++) {
      const dh = new DHParameter(
        jointAngles[i],
        this.dhParams[i].d,
        this.dhParams[i].a,
        this.dhParams[i].alpha
      );
      transform = this.multiplyMatrices(transform, this.dhTransform(dh));
      jointPositions.push([transform[0][3], transform[1][3], transform[2][3]]);
    }

    return {
      position: [transform[0][3], transform[1][3], transform[2][3]],
      rotation: [
        [transform[0][0], transform[0][1], transform[0][2]],
        [transform[1][0], transform[1][1], transform[1][2]],
        [transform[2][0], transform[2][1], transform[2][2]]
      ],
      jointPositions
    };
  }

  inverseKinematics(targetPos, targetRot = null, initialGuess = null) {
    const maxIterations = 150;
    const tolerance = 0.002;
    const learningRate = 0.3;
    
    let jointAngles = initialGuess ? [...initialGuess] : [0, 0, 0, 0, 0, 0];
    
    let lastErrorNorm = Infinity;
    let stagnationCount = 0;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      const fk = this.forwardKinematics(jointAngles);
      const currentPos = fk.position;
      
      const error = [
        targetPos[0] - currentPos[0],
        targetPos[1] - currentPos[1],
        targetPos[2] - currentPos[2]
      ];
      
      const errorNorm = Math.sqrt(error[0]**2 + error[1]**2 + error[2]**2);
      
      if (errorNorm < tolerance) {
        return { success: true, jointAngles, iterations: iter };
      }
      
      if (Math.abs(errorNorm - lastErrorNorm) < 1e-6) {
        stagnationCount++;
        if (stagnationCount > 10) break;
      } else {
        stagnationCount = 0;
      }
      lastErrorNorm = errorNorm;
      
      const jacobian = this.computeJacobian(jointAngles);
      const delta = this.solveJacobianDamped(jacobian, error);
      
      const maxDelta = Math.max(...delta.map(Math.abs));
      const scale = maxDelta > this.maxJointVelocity ? this.maxJointVelocity / maxDelta : 1;
      
      for (let i = 0; i < 6; i++) {
        jointAngles[i] += learningRate * scale * delta[i];
        jointAngles[i] = Math.max(
          this.jointLimits[i].min,
          Math.min(this.jointLimits[i].max, jointAngles[i])
        );
        
        if (isNaN(jointAngles[i])) {
          jointAngles[i] = initialGuess ? initialGuess[i] : 0;
        }
      }
    }
    
    return { success: false, jointAngles, iterations: maxIterations };
  }

  computeJacobian(jointAngles) {
    const jacobian = Array(3).fill().map(() => Array(6).fill(0));
    const epsilon = 0.0001;
    
    for (let i = 0; i < 6; i++) {
      const angles1 = [...jointAngles];
      const angles2 = [...jointAngles];
      angles1[i] -= epsilon;
      angles2[i] += epsilon;
      
      const fk1 = this.forwardKinematics(angles1);
      const fk2 = this.forwardKinematics(angles2);
      
      for (let j = 0; j < 3; j++) {
        jacobian[j][i] = (fk2.position[j] - fk1.position[j]) / (2 * epsilon);
      }
    }
    
    return jacobian;
  }

  solveJacobianDamped(jacobian, error) {
    const delta = Array(6).fill(0);
    const damping = 0.05;
    
    const jt = Array(6).fill().map(() => Array(3).fill(0));
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        jt[j][i] = jacobian[i][j];
      }
    }
    
    const jtj = Array(6).fill().map(() => Array(6).fill(0));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        for (let k = 0; k < 3; k++) {
          jtj[i][j] += jt[i][k] * jacobian[k][j];
        }
      }
      jtj[i][i] += damping * damping;
    }
    
    const jte = Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 3; k++) {
        jte[i] += jt[i][k] * error[k];
      }
    }
    
    for (let iter = 0; iter < 100; iter++) {
      let maxChange = 0;
      for (let i = 0; i < 6; i++) {
        let sum = 0;
        for (let j = 0; j < 6; j++) {
          if (i !== j) sum += jtj[i][j] * delta[j];
        }
        const newVal = (jte[i] - sum) / jtj[i][i];
        maxChange = Math.max(maxChange, Math.abs(newVal - delta[i]));
        delta[i] = newVal;
        
        if (isNaN(delta[i])) delta[i] = 0;
      }
      if (maxChange < 0.0001) break;
    }
    
    for (let i = 0; i < 6; i++) {
      if (isNaN(delta[i]) || Math.abs(delta[i]) > 10) {
        delta[i] = 0;
      }
    }
    
    return delta;
  }

  solveJacobian(jacobian, error) {
    return this.solveJacobianDamped(jacobian, error);
  }

  getLinkSegments(jointPositions) {
    const segments = [];
    const basePos = [0, 0, 0];
    
    for (let i = 0; i < jointPositions.length; i++) {
      const start = i === 0 ? basePos : jointPositions[i - 1];
      const end = jointPositions[i];
      segments.push({
        start: [...start],
        end: [...end],
        radius: i < 3 ? 0.03 : 0.02
      });
    }
    
    return segments;
  }
}
