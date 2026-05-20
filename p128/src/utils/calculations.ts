import { WaxMaterial, WAX_TYPE_INFO, CalculationResult, Wick, Container } from '../types';

export function calculateTotalWeight(waxes: WaxMaterial[]): number {
  return waxes.reduce((total, wax) => total + wax.weight, 0);
}

export function calculatePercentages(waxes: WaxMaterial[]): WaxMaterial[] {
  const totalWeight = calculateTotalWeight(waxes);
  if (totalWeight === 0) return waxes;
  
  return waxes.map(wax => ({
    ...wax,
    percentage: (wax.weight / totalWeight) * 100,
  }));
}

export function calculateBurnTime(
  waxes: WaxMaterial[],
  wick: Wick,
  container: Container
): number {
  const totalWeight = calculateTotalWeight(waxes);
  if (totalWeight === 0) return 0;

  const weightedBurnCoefficient = waxes.reduce((acc, wax) => {
    const waxInfo = WAX_TYPE_INFO[wax.type];
    const percentage = wax.weight / totalWeight;
    return acc + (waxInfo.burnCoefficient * percentage);
  }, 0);

  const containerFactor = Math.sqrt(container.diameter) / 3;
  const burnTimeHours = (totalWeight * weightedBurnCoefficient) / (wick.burnRate * containerFactor * 10);

  return Math.round(burnTimeHours * 10) / 10;
}

export function calculateSmokeEmission(waxes: WaxMaterial[]): number {
  const totalWeight = calculateTotalWeight(waxes);
  if (totalWeight === 0) return 0;

  const weightedSmokeFactor = waxes.reduce((acc, wax) => {
    const waxInfo = WAX_TYPE_INFO[wax.type];
    const percentage = wax.weight / totalWeight;
    return acc + (waxInfo.smokeFactor * percentage);
  }, 0);

  return Math.round(weightedSmokeFactor * 100) / 100;
}

export function calculateEcoScore(smokeEmission: number): CalculationResult['ecoScore'] {
  if (smokeEmission <= 0.25) return 'A';
  if (smokeEmission <= 0.35) return 'B';
  if (smokeEmission <= 0.5) return 'C';
  if (smokeEmission <= 0.65) return 'D';
  return 'E';
}

export function calculateAll(
  waxes: WaxMaterial[],
  wick: Wick,
  container: Container
): CalculationResult {
  const burnTime = calculateBurnTime(waxes, wick, container);
  const smokeEmission = calculateSmokeEmission(waxes);
  const ecoScore = calculateEcoScore(smokeEmission);

  return { burnTime, smokeEmission, ecoScore };
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
