class PrecisionUtils {
  constructor(defaultPrecision = 6) {
    this.defaultPrecision = defaultPrecision;
  }

  round(value, precision = this.defaultPrecision) {
    if (value === null || value === undefined || isNaN(value)) {
      return value;
    }
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }

  roundToDecimalPlaces(value, decimalPlaces = 2) {
    if (value === null || value === undefined || isNaN(value)) {
      return value;
    }
    return Number(Math.round(value + 'e' + decimalPlaces) + 'e-' + decimalPlaces);
  }

  add(a, b, precision = this.defaultPrecision) {
    const factor = Math.pow(10, precision);
    return (a * factor + b * factor) / factor;
  }

  subtract(a, b, precision = this.defaultPrecision) {
    const factor = Math.pow(10, precision);
    return (a * factor - b * factor) / factor;
  }

  multiply(a, b, precision = this.defaultPrecision) {
    const factor = Math.pow(10, precision);
    return Math.round(a * factor * b * factor) / (factor * factor);
  }

  divide(a, b, precision = this.defaultPrecision) {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    const factor = Math.pow(10, precision);
    return Math.round((a * factor) / (b * factor) * factor) / factor;
  }

  sum(numbers, precision = this.defaultPrecision) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return 0;
    }
    const factor = Math.pow(10, precision);
    const total = numbers.reduce((acc, num) => acc + (num || 0) * factor, 0);
    return total / factor;
  }

  average(numbers, precision = this.defaultPrecision) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return 0;
    }
    return this.round(this.sum(numbers, precision) / numbers.length, precision);
  }

  standardize(value, min, max, precision = 2) {
    if (max === min) {
      return 0;
    }
    return this.round((value - min) / (max - min), precision);
  }

  normalizeScore(score, maxScore = 100, precision = 2) {
    const normalized = (score / maxScore) * 100;
    return this.round(Math.min(Math.max(normalized, 0), 100), precision);
  }

  toFixed(value, decimalPlaces = 2) {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return this.roundToDecimalPlaces(value, decimalPlaces).toFixed(decimalPlaces);
  }

  isEqual(a, b, epsilon = 0.0001) {
    return Math.abs(a - b) < epsilon;
  }

  isGreaterThan(a, b, epsilon = 0.0001) {
    return a - b > epsilon;
  }

  isLessThan(a, b, epsilon = 0.0001) {
    return b - a > epsilon;
  }

  processTestItem(item) {
    if (!item) return item;

    const processed = { ...item };
    
    if (processed.measuredValue !== undefined && processed.measuredValue !== null) {
      if (typeof processed.measuredValue === 'number') {
        processed.measuredValue = this.roundToDecimalPlaces(processed.measuredValue, 4);
      } else if (!isNaN(parseFloat(processed.measuredValue))) {
        processed.measuredValue = this.roundToDecimalPlaces(parseFloat(processed.measuredValue), 4);
      }
    }

    if (processed.minValue !== undefined) {
      processed.minValue = this.roundToDecimalPlaces(processed.minValue, 4);
    }

    if (processed.maxValue !== undefined) {
      processed.maxValue = this.roundToDecimalPlaces(processed.maxValue, 4);
    }

    if (processed.tolerance !== undefined) {
      processed.tolerance = this.roundToDecimalPlaces(processed.tolerance, 4);
    }

    return processed;
  }

  processTestItems(testItems) {
    if (!Array.isArray(testItems)) {
      return [];
    }
    return testItems.map(item => this.processTestItem(item));
  }

  calculateQualityScore(testItems, weights = {}, precision = 2) {
    if (!Array.isArray(testItems) || testItems.length === 0) {
      return 0;
    }

    let totalWeight = 0;
    let weightedScore = 0;

    testItems.forEach(item => {
      const itemWeight = weights[item.itemName] || 1;
      totalWeight += itemWeight;

      let itemScore = 0;
      if (item.result === 'pass') {
        itemScore = 100;
      } else if (item.result === 'fail') {
        itemScore = 0;
      } else if (item.measuredValue !== undefined && item.minValue !== undefined && item.maxValue !== undefined) {
        const range = item.maxValue - item.minValue;
        if (range > 0) {
          const normalized = (item.measuredValue - item.minValue) / range;
          itemScore = this.normalizeScore(normalized * 100, 100, 0);
        }
      }

      weightedScore += itemScore * itemWeight;
    });

    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    return this.roundToDecimalPlaces(finalScore, precision);
  }
}

module.exports = new PrecisionUtils(6);
