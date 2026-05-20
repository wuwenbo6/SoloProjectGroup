import { median } from '../../utils/math';

export function detectClicksAdaptive(
  samples: Float32Array,
  threshold: number = 50,
  sensitivity: number = 70
): number[] {
  const clickPositions: number[] = [];
  const thresholdValue = threshold / 100 * 0.3;
  
  const windowSizes = [7, 11, 15];
  const clickScores = new Map<number, number>();
  
  for (const windowSize of windowSizes) {
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = halfWindow; i < samples.length - halfWindow; i++) {
      const window: number[] = [];
      for (let j = -halfWindow; j <= halfWindow; j++) {
        window.push(samples[i + j]);
      }
      
      const medianValue = median(window);
      const meanValue = window.reduce((a, b) => a + b, 0) / window.length;
      const stdDev = Math.sqrt(window.reduce((a, b) => a + (b - meanValue) ** 2, 0) / window.length);
      
      const diffMedian = Math.abs(samples[i] - medianValue);
      const zScore = stdDev > 0 ? diffMedian / stdDev : 0;
      
      const localThreshold = thresholdValue + (100 - sensitivity) / 100 * 0.2;
      
      if (diffMedian > localThreshold || zScore > 3) {
        clickScores.set(i, (clickScores.get(i) || 0) + 1);
      }
    }
  }
  
  const consensusThreshold = Math.ceil(windowSizes.length * 0.6);
  for (const [pos, score] of clickScores) {
    if (score >= consensusThreshold) {
      clickPositions.push(pos);
    }
  }
  
  clickPositions.sort((a, b) => a - b);
  
  const merged: number[] = [];
  for (const pos of clickPositions) {
    if (merged.length === 0 || pos - merged[merged.length - 1] > 3) {
      merged.push(pos);
    }
  }
  
  return merged;
}

function cubicInterpolate(
  y0: number,
  y1: number,
  y2: number,
  y3: number,
  t: number
): number {
  const a0 = y3 - y2 - y0 + y1;
  const a1 = y0 - y1 - a0;
  const a2 = y2 - y0;
  const a3 = y1;
  return a0 * t * t * t + a1 * t * t + a2 * t + a3;
}

export function removeClicks(
  samples: Float32Array,
  threshold: number = 50,
  sensitivity: number = 70
): Float32Array {
  const result = new Float32Array(samples.length);
  result.set(samples);
  
  const clickPositions = detectClicksAdaptive(samples, threshold, sensitivity);
  
  if (clickPositions.length === 0) {
    return result;
  }
  
  const repaired = new Set<number>();
  
  for (const clickPos of clickPositions) {
    if (repaired.has(clickPos)) continue;
    
    const baseWindow = Math.max(4, Math.ceil((100 - sensitivity) / 15));
    const leftSearch = Math.min(clickPos - 1, Math.max(0, clickPos - baseWindow * 2));
    const rightSearch = Math.max(clickPos + 1, Math.min(samples.length - 1, clickPos + baseWindow * 2));
    
    let actualStart = clickPos;
    let actualEnd = clickPos;
    
    while (actualStart > leftSearch && Math.abs(samples[actualStart] - samples[actualStart - 1]) > 0.05) {
      actualStart--;
    }
    while (actualEnd < rightSearch && Math.abs(samples[actualEnd] - samples[actualEnd + 1]) > 0.05) {
      actualEnd++;
    }
    
    const repairStart = Math.max(0, actualStart - 2);
    const repairEnd = Math.min(samples.length - 1, actualEnd + 2);
    
    for (let i = repairStart; i <= repairEnd; i++) {
      repaired.add(i);
    }
    
    const y0 = repairStart >= 2 ? samples[repairStart - 2] : samples[repairStart];
    const y1 = repairStart >= 1 ? samples[repairStart - 1] : samples[repairStart];
    const y2 = repairEnd < samples.length - 1 ? samples[repairEnd + 1] : samples[repairEnd];
    const y3 = repairEnd < samples.length - 2 ? samples[repairEnd + 2] : samples[repairEnd];
    
    const span = repairEnd - repairStart + 1;
    for (let i = repairStart; i <= repairEnd; i++) {
      const t = (i - repairStart + 1) / (span + 2);
      result[i] = cubicInterpolate(y0, y1, y2, y3, t);
    }
  }
  
  return result;
}

export function removeClicksMultiPass(
  samples: Float32Array,
  passes: number = 4,
  threshold: number = 50,
  sensitivity: number = 70
): Float32Array {
  let result = new Float32Array(samples.length);
  result.set(samples);
  
  for (let i = 0; i < passes; i++) {
    const passThreshold = Math.max(20, threshold - i * 8);
    const passSensitivity = Math.max(40, sensitivity - i * 8);
    const nextResult = new Float32Array(result.length);
    nextResult.set(removeClicks(result, passThreshold, passSensitivity));
    result = nextResult;
  }
  
  return result;
}
