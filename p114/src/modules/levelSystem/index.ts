import type { Level, LevelConstraints, Objective, Skeleton } from '../../types';
import { SkeletonEditor } from '../skeletonEditor';
import { StressCalculator } from '../stressCalculation';
import { WindSimulator } from '../windSimulation';
import { HangingSimulator } from '../hangingSimulation';

export class LevelSystem {
  private levels: Map<string, Level> = new Map();
  private currentLevelId: string | null = null;
  private stressCalculator: StressCalculator;
  private windSimulator: WindSimulator;
  private hangingSimulator: HangingSimulator;
  private unlockedLevels: Set<string> = new Set();

  constructor() {
    this.stressCalculator = new StressCalculator();
    this.windSimulator = new WindSimulator();
    this.hangingSimulator = new HangingSimulator();
    this.initializeDefaultLevels();
  }

  private initializeDefaultLevels(): void {
    const level1: Level = {
      id: 'level_1',
      name: '入门花灯',
      description: '创建一个简单的八边形花灯骨架，确保结构稳定',
      difficulty: 1,
      constraints: {
        maxNodes: 20,
        maxEdges: 30,
        maxWeight: 10,
        minStressThreshold: 50,
      },
      objectives: [
        {
          id: 'obj_1',
          description: '创建至少 10 个节点',
          type: 'stress',
          targetValue: 10,
          completed: false,
        },
        {
          id: 'obj_2',
          description: '最大应力小于 80%',
          type: 'stability',
          targetValue: 80,
          completed: false,
        },
      ],
      unlocked: true,
      completed: false,
      stars: 0,
    };

    const level2: Level = {
      id: 'level_2',
      name: '悬挂挑战',
      description: '设计一个能安全悬挂的花灯骨架，承受自身重量不变形',
      difficulty: 2,
      constraints: {
        maxNodes: 30,
        maxEdges: 50,
        maxWeight: 15,
        minStressThreshold: 40,
      },
      objectives: [
        {
          id: 'obj_1',
          description: '设置至少 2 个锚点',
          type: 'stress',
          targetValue: 2,
          completed: false,
        },
        {
          id: 'obj_2',
          description: '悬挂后最大位移小于 0.1',
          type: 'stability',
          targetValue: 0.1,
          completed: false,
        },
      ],
      unlocked: false,
      completed: false,
      stars: 0,
    };

    const level3: Level = {
      id: 'level_3',
      name: '抗风测试',
      description: '设计一个能抵御强风的花灯骨架，风速达到 15 m/s',
      difficulty: 3,
      constraints: {
        maxNodes: 40,
        maxEdges: 60,
        maxWeight: 20,
        minStressThreshold: 30,
        windResistance: { speed: 15, direction: { x: 1, y: 0, z: 0 }, turbulence: 0.4, frequency: 2 },
      },
      objectives: [
        {
          id: 'obj_1',
          description: '风速 10 m/s 时无临界节点',
          type: 'wind',
          targetValue: 10,
          completed: false,
        },
        {
          id: 'obj_2',
          description: '风速 15 m/s 时结构稳定',
          type: 'wind',
          targetValue: 15,
          completed: false,
        },
      ],
      unlocked: false,
      completed: false,
      stars: 0,
    };

    const level4: Level = {
      id: 'level_4',
      name: '轻量设计',
      description: '用最少的材料创建稳定的花灯骨架，挑战极致轻量',
      difficulty: 4,
      constraints: {
        maxNodes: 15,
        maxEdges: 25,
        maxWeight: 5,
        minStressThreshold: 60,
      },
      objectives: [
        {
          id: 'obj_1',
          description: '总重量小于 3',
          type: 'stress',
          targetValue: 3,
          completed: false,
        },
        {
          id: 'obj_2',
          description: '应力利用率大于 50%',
          type: 'stability',
          targetValue: 50,
          completed: false,
        },
      ],
      unlocked: false,
      completed: false,
      stars: 0,
    };

    const level5: Level = {
      id: 'level_5',
      name: '大师挑战',
      description: '综合挑战：轻量、抗风、悬挂稳定的完美花灯',
      difficulty: 5,
      constraints: {
        maxNodes: 50,
        maxEdges: 80,
        maxWeight: 12,
        minStressThreshold: 25,
        windResistance: { speed: 20, direction: { x: 1, y: 0.5, z: 0 }, turbulence: 0.5, frequency: 3 },
      },
      objectives: [
        {
          id: 'obj_1',
          description: '悬挂稳定',
          type: 'stability',
          targetValue: 0.05,
          completed: false,
        },
        {
          id: 'obj_2',
          description: '抗风 20 m/s',
          type: 'wind',
          targetValue: 20,
          completed: false,
        },
        {
          id: 'obj_3',
          description: '重量小于 8',
          type: 'stress',
          targetValue: 8,
          completed: false,
        },
      ],
      unlocked: false,
      completed: false,
      stars: 0,
    };

    this.levels.set(level1.id, level1);
    this.levels.set(level2.id, level2);
    this.levels.set(level3.id, level3);
    this.levels.set(level4.id, level4);
    this.levels.set(level5.id, level5);

    this.unlockedLevels.add(level1.id);
  }

  getAllLevels(): Level[] {
    return Array.from(this.levels.values()).map(level => ({
      ...level,
      unlocked: this.unlockedLevels.has(level.id),
    }));
  }

  getLevel(levelId: string): Level | undefined {
    const level = this.levels.get(levelId);
    if (level) {
      return { ...level, unlocked: this.unlockedLevels.has(level.id) };
    }
    return undefined;
  }

  getCurrentLevel(): Level | undefined {
    return this.currentLevelId ? this.getLevel(this.currentLevelId) : undefined;
  }

  setCurrentLevel(levelId: string): boolean {
    if (!this.levels.has(levelId)) return false;
    if (!this.unlockedLevels.has(levelId)) return false;
    this.currentLevelId = levelId;
    return true;
  }

  unlockLevel(levelId: string): boolean {
    if (!this.levels.has(levelId)) return false;
    this.unlockedLevels.add(levelId);
    return true;
  }

  isLevelUnlocked(levelId: string): boolean {
    return this.unlockedLevels.has(levelId);
  }

  checkConstraints(skeleton: Skeleton, level: Level): {
    valid: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    const { constraints } = level;

    if (skeleton.nodes.length > constraints.maxNodes) {
      violations.push(`节点数量超过限制: ${skeleton.nodes.length}/${constraints.maxNodes}`);
    }

    if (skeleton.edges.length > constraints.maxEdges) {
      violations.push(`边数量超过限制: ${skeleton.edges.length}/${constraints.maxEdges}`);
    }

    const totalMass = this.stressCalculator.calculateTotalMass(skeleton);
    if (totalMass > constraints.maxWeight) {
      violations.push(`总重量超过限制: ${totalMass.toFixed(2)}/${constraints.maxWeight}`);
    }

    const stressResult = this.stressCalculator.calculateStress(skeleton);
    for (const [nodeId, stress] of stressResult.nodeStresses) {
      const node = skeleton.nodes.find(n => n.id === nodeId);
      if (node && stress < constraints.minStressThreshold) {
        violations.push(`节点应力低于阈值: ${stress.toFixed(2)}/${constraints.minStressThreshold}`);
        break;
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  evaluateObjectives(skeleton: Skeleton, level: Level): Objective[] {
    const updatedObjectives: Objective[] = [];

    for (const objective of level.objectives) {
      let currentValue = 0;
      let completed = false;

      switch (objective.type) {
        case 'stress':
          if (objective.description.includes('节点')) {
            currentValue = skeleton.nodes.length;
            completed = currentValue >= objective.targetValue;
          } else if (objective.description.includes('重量')) {
            currentValue = this.stressCalculator.calculateTotalMass(skeleton);
            completed = currentValue <= objective.targetValue;
          } else if (objective.description.includes('锚点')) {
            currentValue = skeleton.nodes.filter(n => n.isFixed).length;
            completed = currentValue >= objective.targetValue;
          }
          break;

        case 'stability':
          if (objective.description.includes('位移')) {
            const stability = this.hangingSimulator.checkStability(skeleton);
            currentValue = stability.maxDisplacement;
            completed = currentValue <= objective.targetValue;
          } else if (objective.description.includes('应力')) {
            const stressResult = this.stressCalculator.calculateStress(skeleton);
            const maxStressRatio = Math.max(
              ...Array.from(stressResult.nodeStresses.entries()).map(([nodeId, stress]) => {
                const node = skeleton.nodes.find(n => n.id === nodeId);
                return node ? (stress / node.maxStress) * 100 : 0;
              })
            );
            currentValue = maxStressRatio;
            completed = currentValue <= objective.targetValue;
          } else if (objective.description.includes('利用率')) {
            const stressResult = this.stressCalculator.calculateStress(skeleton);
            const avgStressRatio = Array.from(stressResult.nodeStresses.entries()).reduce((sum, [nodeId, stress]) => {
              const node = skeleton.nodes.find(n => n.id === nodeId);
              return sum + (node ? (stress / node.maxStress) * 100 : 0);
            }, 0) / stressResult.nodeStresses.size;
            currentValue = avgStressRatio;
            completed = currentValue >= objective.targetValue;
          }
          break;

        case 'wind':
          if (level.constraints.windResistance) {
            this.windSimulator.updateConfig(level.constraints.windResistance);
          }
          const windResult = this.windSimulator.testWindResistance(skeleton, objective.targetValue);
          currentValue = windResult.breakingSpeed;
          completed = windResult.isStable;
          break;
      }

      updatedObjectives.push({
        ...objective,
        currentValue,
        completed,
      });
    }

    return updatedObjectives;
  }

  calculateStars(completedObjectives: number, totalObjectives: number): number {
    const ratio = completedObjectives / totalObjectives;
    if (ratio >= 1) return 3;
    if (ratio >= 0.66) return 2;
    if (ratio >= 0.33) return 1;
    return 0;
  }

  completeLevel(levelId: string, skeleton: Skeleton): {
    success: boolean;
    stars: number;
    completedObjectives: number;
    message: string;
  } {
    const level = this.levels.get(levelId);
    if (!level) {
      return { success: false, stars: 0, completedObjectives: 0, message: '关卡不存在' };
    }

    const constraintsCheck = this.checkConstraints(skeleton, level);
    if (!constraintsCheck.valid) {
      return {
        success: false,
        stars: 0,
        completedObjectives: 0,
        message: `约束不满足: ${constraintsCheck.violations.join(', ')}`,
      };
    }

    const objectives = this.evaluateObjectives(skeleton, level);
    const completedCount = objectives.filter(o => o.completed).length;
    const stars = this.calculateStars(completedCount, objectives.length);

    level.completed = true;
    level.stars = Math.max(level.stars, stars);

    const levelIndex = Array.from(this.levels.keys()).indexOf(levelId);
    if (levelIndex >= 0 && levelIndex < this.levels.size - 1) {
      const nextLevelId = Array.from(this.levels.keys())[levelIndex + 1];
      this.unlockLevel(nextLevelId);
    }

    return {
      success: true,
      stars,
      completedObjectives: completedCount,
      message: stars === 3 ? '完美通关！' : `完成 ${completedCount}/${objectives.length} 个目标`,
    };
  }

  getProgress(): {
    totalLevels: number;
    completedLevels: number;
    totalStars: number;
    maxStars: number;
  } {
    const levels = this.getAllLevels();
    const completedLevels = levels.filter(l => l.completed).length;
    const totalStars = levels.reduce((sum, l) => sum + l.stars, 0);
    const maxStars = levels.length * 3;

    return {
      totalLevels: levels.length,
      completedLevels,
      totalStars,
      maxStars,
    };
  }

  addCustomLevel(level: Level): boolean {
    if (this.levels.has(level.id)) return false;
    this.levels.set(level.id, level);
    return true;
  }

  removeLevel(levelId: string): boolean {
    return this.levels.delete(levelId);
  }

  resetProgress(): void {
    for (const level of this.levels.values()) {
      level.completed = false;
      level.stars = 0;
    }
    this.unlockedLevels.clear();
    const firstLevel = Array.from(this.levels.keys())[0];
    if (firstLevel) {
      this.unlockedLevels.add(firstLevel);
    }
  }

  getHint(levelId: string): string[] {
    const hints: string[] = [];
    const level = this.levels.get(levelId);
    if (!level) return hints;

    hints.push('提示：确保所有节点都有足够的连接边');
    hints.push('提示：三角形是最稳定的结构');

    if (level.constraints.windResistance) {
      hints.push('提示：抗风设计需要对称的结构');
    }

    if (level.difficulty >= 3) {
      hints.push('提示：考虑使用对角支撑来增加刚度');
    }

    return hints;
  }

  generateTargetSkeleton(levelId: string): Skeleton | null {
    const level = this.levels.get(levelId);
    if (!level) return null;

    const editor = new SkeletonEditor();
    const baseHeight = 2 + level.difficulty * 0.5;
    const baseRadius = 1 + level.difficulty * 0.2;

    return editor.createLanternFrame({ x: 0, y: 0, z: baseHeight / 2 }, baseRadius, baseHeight);
  }
}
