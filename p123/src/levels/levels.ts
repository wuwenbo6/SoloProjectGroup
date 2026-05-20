import { Level, BaseObject } from '@/types';

const createWaterWheel = (x: number, y: number, radius: number = 80): BaseObject => ({
  id: `wheel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  x,
  y,
  rotation: 0,
  type: 'waterwheel',
  radius,
  bladeCount: 8,
  angularVelocity: 0,
  angularAcceleration: 0,
} as BaseObject);

const createGear = (x: number, y: number, radius: number = 50, teeth: number = 20): BaseObject => ({
  id: `gear-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  x,
  y,
  rotation: 0,
  type: 'gear',
  radius,
  teeth,
  angularVelocity: 0,
  connectedTo: [],
} as BaseObject);

export const levels: Level[] = [
  {
    id: 1,
    name: '入门 - 第一个水车',
    description: '创建一个水车并调整水位使其转动',
    targetRPM: 20,
    timeLimit: 120,
    initialObjects: [],
    stars: [
      { rpm: 20, time: 120 },
      { rpm: 30, time: 90 },
      { rpm: 40, time: 60 },
    ],
  },
  {
    id: 2,
    name: '齿轮传动',
    description: '连接水车和齿轮，观察传动效果',
    targetRPM: 15,
    timeLimit: 180,
    initialObjects: [
      createWaterWheel(400, 350, 90),
    ],
    stars: [
      { rpm: 15, time: 180 },
      { rpm: 25, time: 120 },
      { rpm: 35, time: 90 },
    ],
  },
  {
    id: 3,
    name: '多级齿轮系统',
    description: '构建多级齿轮传动系统以获得更高转速',
    targetRPM: 50,
    timeLimit: 240,
    initialObjects: [
      createWaterWheel(300, 350, 100),
      createGear(500, 350, 60, 24),
    ],
    stars: [
      { rpm: 50, time: 240 },
      { rpm: 70, time: 180 },
      { rpm: 90, time: 120 },
    ],
  },
  {
    id: 4,
    name: '复杂机械系统',
    description: '设计一个复杂的水车与齿轮组合系统',
    targetRPM: 100,
    timeLimit: 300,
    initialObjects: [
      createWaterWheel(250, 350, 90),
      createWaterWheel(550, 350, 90),
    ],
    stars: [
      { rpm: 100, time: 300 },
      { rpm: 130, time: 240 },
      { rpm: 160, time: 180 },
    ],
  },
  {
    id: 5,
    name: '自由模式',
    description: '无限制地创建和实验',
    targetRPM: 0,
    timeLimit: 0,
    initialObjects: [],
    stars: [],
  },
];

export function getLevelById(id: number): Level | undefined {
  return levels.find((l) => l.id === id);
}

export function getLevelStars(level: Level, achievedRPM: number, elapsedTime: number): number {
  if (level.stars.length === 0) return 0;
  
  let stars = 0;
  for (let i = 0; i < level.stars.length; i++) {
    if (achievedRPM >= level.stars[i].rpm && elapsedTime <= level.stars[i].time) {
      stars = i + 1;
    }
  }
  return stars;
}
