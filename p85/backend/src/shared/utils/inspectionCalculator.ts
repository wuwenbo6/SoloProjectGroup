import logger from '../middleware/logger';

export interface InspectionItem {
  name: string;
  value: string;
  standard?: string;
  unit?: string;
}

export interface InspectionResult {
  isValid: boolean;
  passed: boolean;
  score: number;
  details: {
    name: string;
    value: number;
    standard?: number;
    unit?: string;
    passed: boolean;
    deviation?: number;
    deviationPercent?: number;
  }[];
  errors: string[];
}

function parseNumericValue(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseStandard(standard: string): { min?: number; max?: number; target?: number } | null {
  if (!standard) return null;

  if (standard.includes('~') || standard.includes('-')) {
    const parts = standard.split(/[~-]/);
    const min = parseNumericValue(parts[0]);
    const max = parseNumericValue(parts[1]);
    return { min: min ?? undefined, max: max ?? undefined };
  }

  if (standard.startsWith('≥') || standard.startsWith('>=')) {
    const min = parseNumericValue(standard.slice(2));
    return { min: min ?? undefined };
  }

  if (standard.startsWith('≤') || standard.startsWith('<=')) {
    const max = parseNumericValue(standard.slice(2));
    return { max: max ?? undefined };
  }

  if (standard.startsWith('>')) {
    const min = parseNumericValue(standard.slice(1));
    return { min: min !== null ? min + 0.001 : undefined };
  }

  if (standard.startsWith('<')) {
    const max = parseNumericValue(standard.slice(1));
    return { max: max !== null ? max - 0.001 : undefined };
  }

  const target = parseNumericValue(standard);
  return target !== null ? { target } : null;
}

function checkItemPassed(value: number, standard?: string): { passed: boolean; deviation?: number; deviationPercent?: number } {
  if (!standard) {
    return { passed: true };
  }

  const parsed = parseStandard(standard);
  if (!parsed) {
    return { passed: true };
  }

  if (parsed.target !== undefined) {
    const deviation = Math.abs(value - parsed.target);
    const deviationPercent = (deviation / parsed.target) * 100;
    return {
      passed: deviationPercent <= 5,
      deviation,
      deviationPercent,
    };
  }

  let passed = true;
  let deviation: number | undefined;

  if (parsed.min !== undefined && value < parsed.min) {
    passed = false;
    deviation = parsed.min - value;
  }

  if (parsed.max !== undefined && value > parsed.max) {
    passed = false;
    deviation = value - parsed.max;
  }

  return { passed, deviation };
}

export function calculateInspectionResult(items: InspectionItem[]): InspectionResult {
  const details: InspectionResult['details'] = [];
  const errors: string[] = [];
  let passedCount = 0;
  let validCount = 0;

  for (const item of items) {
    const numericValue = parseNumericValue(item.value);

    if (numericValue === null) {
      errors.push(`检测项 "${item.name}" 的值 "${item.value}" 不是有效的数值`);
      details.push({
        name: item.name,
        value: NaN,
        unit: item.unit,
        passed: false,
      });
      continue;
    }

    validCount++;
    const checkResult = checkItemPassed(numericValue, item.standard);

    if (checkResult.passed) {
      passedCount++;
    }

    details.push({
      name: item.name,
      value: numericValue,
      standard: item.standard ? parseNumericValue(item.standard) ?? undefined : undefined,
      unit: item.unit,
      passed: checkResult.passed,
      deviation: checkResult.deviation,
      deviationPercent: checkResult.deviationPercent,
    });
  }

  const score = validCount > 0 ? Math.round((passedCount / validCount) * 100) : 0;
  const passed = score >= 80;

  logger.info(`Inspection calculation: score=${score}, passed=${passed}, items=${validCount}, errors=${errors.length}`);

  return {
    isValid: errors.length === 0,
    passed,
    score,
    details,
    errors,
  };
}

export function validateInspectionData(items: InspectionItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const item of items) {
    if (!item.name || item.name.trim().length === 0) {
      errors.push('检测项名称不能为空');
    }

    if (!item.value || item.value.trim().length === 0) {
      errors.push(`检测项 "${item.name}" 的值不能为空`);
    }

    const numericValue = parseNumericValue(item.value);
    if (numericValue === null) {
      errors.push(`检测项 "${item.name}" 的值 "${item.value}" 格式不正确，必须包含数值`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
