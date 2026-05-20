// FBD 功能块定义

// 功能块类型
export enum FBDBlockType {
  // 逻辑运算
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  XOR = 'XOR',
  
  // 定时器
  TON = 'TON',
  TOF = 'TOF',
  TP = 'TP',
  
  // 计数器
  CTU = 'CTU',
  CTD = 'CTD',
  CTUD = 'CTUD',
  
  // 算术运算
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  
  // 比较运算
  GT = 'GT',
  GE = 'GE',
  EQ = 'EQ',
  NE = 'NE',
  LE = 'LE',
  LT = 'LT',
  
  // 数据处理
  MOVE = 'MOVE',
  
  // 输入输出
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
  COIL = 'COIL',
  CONTACT = 'CONTACT',
  
  // 跳转与调用
  JMP = 'JMP',
  CALL = 'CALL',
}

// 功能块接口定义
export interface FBDBlock {
  id: string;
  type: FBDBlockType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  inputs: FBDPort[];
  outputs: FBDPort[];
  parameters: FBDParameter[];
  description?: string;
}

// 端口定义
export interface FBDPort {
  id: string;
  name: string;
  type: 'boolean' | 'integer' | 'real';
  value?: any;
  connected: boolean;
}

// 参数定义
export interface FBDParameter {
  name: string;
  type: 'integer' | 'real' | 'string' | 'boolean';
  value: any;
}

// 连接线定义
export interface FBDConnection {
  id: string;
  fromBlockId: string;
  fromPortId: string;
  toBlockId: string;
  toPortId: string;
}

// FBD 程序
export interface FBDProgram {
  blocks: FBDBlock[];
  connections: FBDConnection[];
  name: string;
  description?: string;
}

// 默认功能块配置
export const FBDBlockConfigs: Record<FBDBlockType, {
  inputs: { name: string; type: 'boolean' | 'integer' | 'real' }[];
  outputs: { name: string; type: 'boolean' | 'integer' | 'real' }[];
  parameters: { name: string; type: 'integer' | 'real' | 'string' | 'boolean'; defaultValue: any }[];
  width: number;
  height: number;
  color: string;
}> = {
  [FBDBlockType.AND]: {
    inputs: [
      { name: 'IN1', type: 'boolean' },
      { name: 'IN2', type: 'boolean' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#4CAF50',
  },
  [FBDBlockType.OR]: {
    inputs: [
      { name: 'IN1', type: 'boolean' },
      { name: 'IN2', type: 'boolean' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#2196F3',
  },
  [FBDBlockType.NOT]: {
    inputs: [{ name: 'IN', type: 'boolean' }],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 60,
    height: 50,
    color: '#FF9800',
  },
  [FBDBlockType.XOR]: {
    inputs: [
      { name: 'IN1', type: 'boolean' },
      { name: 'IN2', type: 'boolean' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#9C27B0',
  },
  [FBDBlockType.TON]: {
    inputs: [
      { name: 'IN', type: 'boolean' },
      { name: 'R', type: 'boolean' },
    ],
    outputs: [
      { name: 'Q', type: 'boolean' },
      { name: 'ET', type: 'integer' },
    ],
    parameters: [
      { name: 'PT', type: 'integer', defaultValue: 1000 },
    ],
    width: 100,
    height: 80,
    color: '#673AB7',
  },
  [FBDBlockType.TOF]: {
    inputs: [
      { name: 'IN', type: 'boolean' },
      { name: 'R', type: 'boolean' },
    ],
    outputs: [
      { name: 'Q', type: 'boolean' },
      { name: 'ET', type: 'integer' },
    ],
    parameters: [
      { name: 'PT', type: 'integer', defaultValue: 1000 },
    ],
    width: 100,
    height: 80,
    color: '#3F51B5',
  },
  [FBDBlockType.TP]: {
    inputs: [{ name: 'IN', type: 'boolean' }],
    outputs: [
      { name: 'Q', type: 'boolean' },
      { name: 'ET', type: 'integer' },
    ],
    parameters: [
      { name: 'PT', type: 'integer', defaultValue: 1000 },
    ],
    width: 100,
    height: 80,
    color: '#009688',
  },
  [FBDBlockType.CTU]: {
    inputs: [
      { name: 'CU', type: 'boolean' },
      { name: 'R', type: 'boolean' },
    ],
    outputs: [
      { name: 'Q', type: 'boolean' },
      { name: 'CV', type: 'integer' },
    ],
    parameters: [
      { name: 'PV', type: 'integer', defaultValue: 100 },
    ],
    width: 100,
    height: 80,
    color: '#FF5722',
  },
  [FBDBlockType.CTD]: {
    inputs: [
      { name: 'CD', type: 'boolean' },
      { name: 'LD', type: 'boolean' },
    ],
    outputs: [
      { name: 'Q', type: 'boolean' },
      { name: 'CV', type: 'integer' },
    ],
    parameters: [
      { name: 'PV', type: 'integer', defaultValue: 100 },
    ],
    width: 100,
    height: 80,
    color: '#795548',
  },
  [FBDBlockType.ADD]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'integer' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#00BCD4',
  },
  [FBDBlockType.SUB]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'integer' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#00BCD4',
  },
  [FBDBlockType.MUL]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'integer' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#00BCD4',
  },
  [FBDBlockType.DIV]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'integer' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#00BCD4',
  },
  [FBDBlockType.GT]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#E91E63',
  },
  [FBDBlockType.GE]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#E91E63',
  },
  [FBDBlockType.EQ]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#E91E63',
  },
  [FBDBlockType.NE]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#E91E63',
  },
  [FBDBlockType.LE]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#E91E63',
  },
  [FBDBlockType.LT]: {
    inputs: [
      { name: 'IN1', type: 'integer' },
      { name: 'IN2', type: 'integer' },
    ],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [],
    width: 80,
    height: 60,
    color: '#E91E63',
  },
  [FBDBlockType.MOVE]: {
    inputs: [{ name: 'IN', type: 'integer' }],
    outputs: [{ name: 'OUT', type: 'integer' }],
    parameters: [],
    width: 80,
    height: 50,
    color: '#607D8B',
  },
  [FBDBlockType.INPUT]: {
    inputs: [],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [
      { name: 'ADDR', type: 'string', defaultValue: 'I0.0' },
    ],
    width: 60,
    height: 50,
    color: '#8BC34A',
  },
  [FBDBlockType.OUTPUT]: {
    inputs: [{ name: 'IN', type: 'boolean' }],
    outputs: [],
    parameters: [
      { name: 'ADDR', type: 'string', defaultValue: 'Q0.0' },
    ],
    width: 60,
    height: 50,
    color: '#FFC107',
  },
  [FBDBlockType.COIL]: {
    inputs: [{ name: 'IN', type: 'boolean' }],
    outputs: [],
    parameters: [
      { name: 'ADDR', type: 'string', defaultValue: 'M0.0' },
    ],
    width: 60,
    height: 50,
    color: '#FFC107',
  },
  [FBDBlockType.CONTACT]: {
    inputs: [],
    outputs: [{ name: 'OUT', type: 'boolean' }],
    parameters: [
      { name: 'ADDR', type: 'string', defaultValue: 'M0.0' },
    ],
    width: 60,
    height: 50,
    color: '#8BC34A',
  },
  [FBDBlockType.CTUD]: {
    inputs: [
      { name: 'CU', type: 'boolean' },
      { name: 'CD', type: 'boolean' },
      { name: 'R', type: 'boolean' },
      { name: 'LD', type: 'boolean' },
    ],
    outputs: [
      { name: 'QU', type: 'boolean' },
      { name: 'QD', type: 'boolean' },
      { name: 'CV', type: 'integer' },
    ],
    parameters: [
      { name: 'PV', type: 'integer', defaultValue: 100 },
    ],
    width: 120,
    height: 100,
    color: '#FF5722',
  },
  [FBDBlockType.JMP]: {
    inputs: [{ name: 'IN', type: 'boolean' }],
    outputs: [],
    parameters: [
      { name: 'LABEL', type: 'string', defaultValue: 'LBL0' },
    ],
    width: 70,
    height: 50,
    color: '#9E9E9E',
  },
  [FBDBlockType.CALL]: {
    inputs: [{ name: 'EN', type: 'boolean' }],
    outputs: [{ name: 'ENO', type: 'boolean' }],
    parameters: [
      { name: 'FB_NAME', type: 'string', defaultValue: 'FB0' },
    ],
    width: 100,
    height: 60,
    color: '#9E9E9E',
  },
};

// 生成唯一ID
export function generateId(): string {
  return 'fbd_' + Math.random().toString(36).substr(2, 9);
}

// 创建功能块实例
export function createFBDBlock(type: FBDBlockType, x: number, y: number): FBDBlock {
  const config = FBDBlockConfigs[type];
  const id = generateId();
  
  return {
    id,
    type,
    name: type,
    x,
    y,
    width: config.width,
    height: config.height,
    inputs: config.inputs.map(input => ({
      id: generateId(),
      name: input.name,
      type: input.type,
      connected: false,
    })),
    outputs: config.outputs.map(output => ({
      id: generateId(),
      name: output.name,
      type: output.type,
      connected: false,
    })),
    parameters: config.parameters.map(param => ({
      name: param.name,
      type: param.type,
      value: param.defaultValue,
    })),
  };
}

// 创建连接线
export function createConnection(
  fromBlockId: string,
  fromPortId: string,
  toBlockId: string,
  toPortId: string
): FBDConnection {
  return {
    id: generateId(),
    fromBlockId,
    fromPortId,
    toBlockId,
    toPortId,
  };
}

// 默认FBD程序
export function createDefaultFBDProgram(): FBDProgram {
  return {
    blocks: [],
    connections: [],
    name: 'New FBD Program',
  };
}
