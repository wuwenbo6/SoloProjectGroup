export type WaxType = 'soy' | 'paraffin' | 'beeswax' | 'palm' | 'gel' | 'coconut';

export interface WaxMaterial {
  id: string;
  name: string;
  weight: number;
  percentage: number;
  meltPoint: number;
  type: WaxType;
}

export interface Wick {
  id: string;
  type: string;
  size: string;
  burnRate: number;
}

export interface Container {
  id: string;
  name: string;
  diameter: number;
  height: number;
  volume: number;
}

export interface Formula {
  id: string;
  name: string;
  waxes: WaxMaterial[];
  wick: Wick;
  container: Container;
  totalWeight: number;
  burnTime: number;
  smokeEmission: number;
  createdAt: string;
}

export interface CalculationResult {
  burnTime: number;
  smokeEmission: number;
  ecoScore: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface BatchFormula {
  id: string;
  name: string;
  waxes: WaxMaterial[];
  wick: Wick;
  container: Container;
  result?: CalculationResult;
}

export const WAX_TYPE_INFO: Record<WaxType, { name: string; burnCoefficient: number; smokeFactor: number }> = {
  soy: { name: '大豆蜡', burnCoefficient: 0.9, smokeFactor: 0.3 },
  paraffin: { name: '石蜡', burnCoefficient: 1.1, smokeFactor: 0.8 },
  beeswax: { name: '蜂蜡', burnCoefficient: 0.85, smokeFactor: 0.2 },
  palm: { name: '棕榈蜡', burnCoefficient: 0.95, smokeFactor: 0.5 },
  gel: { name: '凝胶蜡', burnCoefficient: 1.0, smokeFactor: 0.6 },
  coconut: { name: '椰子蜡', burnCoefficient: 0.8, smokeFactor: 0.25 },
};

export const WICK_TYPES = [
  { type: 'CD', size: 'CD-6', burnRate: 0.8 },
  { type: 'CD', size: 'CD-8', burnRate: 1.0 },
  { type: 'CD', size: 'CD-10', burnRate: 1.2 },
  { type: 'CD', size: 'CD-12', burnRate: 1.4 },
  { type: 'ECO', size: 'ECO-6', burnRate: 0.7 },
  { type: 'ECO', size: 'ECO-8', burnRate: 0.9 },
  { type: 'ECO', size: 'ECO-10', burnRate: 1.1 },
  { type: 'ECO', size: 'ECO-12', burnRate: 1.3 },
  { type: 'LX', size: 'LX-10', burnRate: 0.85 },
  { type: 'LX', size: 'LX-14', burnRate: 1.05 },
  { type: 'LX', size: 'LX-18', burnRate: 1.25 },
  { type: 'LX', size: 'LX-24', burnRate: 1.45 },
  { type: 'HTP', size: 'HTP-31', burnRate: 0.75 },
  { type: 'HTP', size: 'HTP-52', burnRate: 0.95 },
  { type: 'HTP', size: 'HTP-73', burnRate: 1.15 },
  { type: 'HTP', size: 'HTP-93', burnRate: 1.35 },
];

export const CONTAINER_TYPES = [
  { name: '小玻璃杯', diameter: 6, height: 8, volume: 150 },
  { name: '中玻璃杯', diameter: 8, height: 10, volume: 300 },
  { name: '大玻璃杯', diameter: 10, height: 12, volume: 500 },
  { name: '锡罐', diameter: 7, height: 6, volume: 200 },
  { name: '陶瓷杯', diameter: 9, height: 11, volume: 400 },
  { name: '方形罐', diameter: 8, height: 8, volume: 350 },
];
