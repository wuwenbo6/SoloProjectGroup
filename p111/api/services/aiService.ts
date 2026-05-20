import { SensorData } from '../../shared/types';

// 制茶品质等级
export type QualityLevel = 'excellent' | 'good' | 'normal' | 'poor';

export interface QualityPrediction {
  level: QualityLevel;
  score: number;
  confidence: number;
  factors: {
    temperature: number;
    humidity: number;
    oxygen: number;
    fermentationTime: number;
  };
  recommendations: string[];
}

export interface ParameterRecommendation {
  targetTemperature: number;
  targetHumidity: number;
  targetOxygen: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RootCauseAnalysis {
  anomalyType: string;
  primaryCause: string;
  contributingFactors: string[];
  suggestedActions: string[];
  severity: 'critical' | 'high' | 'medium';
}

export interface DeviceData {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'warning' | 'error';
  currentData: SensorData;
  qualityScore: number;
  elapsedTime: number;
}

class AIService {
  // 最佳工艺参数基准
  private optimalParams = {
    temperature: 32,
    humidity: 65,
    oxygen: 18,
    fermentationStage: [
      { stage: 'initial', duration: 2, tempRange: [30, 34], humidityRange: [60, 70] },
      { stage: 'mid', duration: 4, tempRange: [32, 36], humidityRange: [65, 75] },
      { stage: 'final', duration: 2, tempRange: [28, 32], humidityRange: [55, 65] },
    ],
  };

  // 根因分析知识库
  private rootCauseKnowledge = {
    temperature_high: {
      causes: [
        '环境冷却系统效率下降',
        '微生物代谢活动过于旺盛',
        '通风量不足导致热量积聚',
        '温度传感器校准偏差',
      ],
      actions: [
        '检查冷却水循环系统',
        '增加通风量',
        '降低环境温度',
        '校准温度传感器',
      ],
    },
    humidity_high: {
      causes: [
        '加湿器开度异常',
        '冷凝水排放不及时',
        '环境湿度超标',
        '湿度传感器故障',
      ],
      actions: [
        '降低加湿器功率',
        '清理排水系统',
        '检查环境除湿设备',
        '更换湿度传感器',
      ],
    },
    oxygen_low: {
      causes: [
        '通风系统堵塞',
        '氧传感器灵敏度下降',
        '罐体密封性过好',
        '微生物耗氧量突增',
      ],
      actions: [
        '清理通风管道',
        '校准氧传感器',
        '增加进气量',
        '检查罐体密封状态',
      ],
    },
  };

  // 预测制茶品质
  public predictQuality(data: SensorData): QualityPrediction {
    const fermentationHours = data.fermentationTime;

    // 计算各参数得分（0-100分）
    const tempScore = this.calculateParameterScore(
      data.temperature,
      this.optimalParams.temperature,
      4
    );
    const humidityScore = this.calculateParameterScore(
      data.humidity,
      this.optimalParams.humidity,
      10
    );
    const oxygenScore = this.calculateParameterScore(
      data.oxygen,
      this.optimalParams.oxygen,
      3
    );

    // 发酵时间权重
    let timeFactor = 1;
    if (fermentationHours < 2) {
      timeFactor = 0.85; // 初期
    } else if (fermentationHours < 6) {
      timeFactor = 1; // 中期最佳
    } else if (fermentationHours < 8) {
      timeFactor = 0.95; // 后期
    } else {
      timeFactor = 0.85; // 超时
    }

    // 综合评分
    const totalScore = Math.round(
      (tempScore * 0.35 + humidityScore * 0.3 + oxygenScore * 0.25) * timeFactor
    );

    // 确定品质等级
    let level: QualityLevel;
    if (totalScore >= 90) level = 'excellent';
    else if (totalScore >= 75) level = 'good';
    else if (totalScore >= 60) level = 'normal';
    else level = 'poor';

    // 生成推荐建议
    const recommendations = this.generateQualityRecommendations(
      tempScore,
      humidityScore,
      oxygenScore,
      fermentationHours
    );

    return {
      level,
      score: totalScore,
      confidence: 85 + Math.random() * 10,
      factors: {
        temperature: tempScore,
        humidity: humidityScore,
        oxygen: oxygenScore,
        fermentationTime: timeFactor * 100,
      },
      recommendations,
    };
  }

  // 计算参数得分
  private calculateParameterScore(value: number, optimal: number, tolerance: number): number {
    const deviation = Math.abs(value - optimal);
    if (deviation <= tolerance * 0.5) {
      return 95 + Math.random() * 5;
    } else if (deviation <= tolerance) {
      return 80 + Math.random() * 10;
    } else if (deviation <= tolerance * 1.5) {
      return 65 + Math.random() * 10;
    } else {
      return 50 + Math.random() * 10;
    }
  }

  // 生成品质改进建议
  private generateQualityRecommendations(
    tempScore: number,
    humidityScore: number,
    oxygenScore: number,
    hours: number
  ): string[] {
    const recommendations: string[] = [];

    if (tempScore < 80) {
      recommendations.push('建议调整温度至30-34℃范围，提升茶多酚转化效率');
    }
    if (humidityScore < 80) {
      recommendations.push('湿度偏离最佳范围，可能影响茶叶色泽和香气');
    }
    if (oxygenScore < 80) {
      recommendations.push('氧浓度异常，建议检查通风系统，保证充足供氧');
    }
    if (hours > 8) {
      recommendations.push('发酵时间偏长，建议提前准备出料准备');
    }
    if (tempScore >= 90 && humidityScore >= 90 && oxygenScore >= 90) {
      recommendations.push('各项参数处于最佳范围，继续保持当前工艺条件');
    }

    return recommendations;
  }

  // 智能参数推荐
  public recommendParameters(data: SensorData): ParameterRecommendation[] {
    const recommendations: ParameterRecommendation[] = [];
    const hours = data.fermentationTime;

    // 根据发酵阶段推荐最佳温度
    let targetTemp: number;
    if (hours < 2) {
      targetTemp = 32;
      if (Math.abs(data.temperature - targetTemp) > 1) {
        recommendations.push({
          targetTemperature: targetTemp,
          targetHumidity: 65,
          targetOxygen: 18,
          rationale: '发酵初期：建议温度32℃，促进酶活性启动',
          priority: Math.abs(data.temperature - targetTemp) > 2 ? 'high' : 'medium',
        });
      }
    } else if (hours < 6) {
      targetTemp = 34;
      if (Math.abs(data.temperature - targetTemp) > 1) {
        recommendations.push({
          targetTemperature: targetTemp,
          targetHumidity: 70,
          targetOxygen: 20,
          rationale: '发酵中期：建议温度34℃，湿度70%，加速物质转化',
          priority: Math.abs(data.temperature - targetTemp) > 2 ? 'high' : 'medium',
        });
      }
    } else {
      targetTemp = 30;
      if (Math.abs(data.temperature - targetTemp) > 1) {
        recommendations.push({
          targetTemperature: targetTemp,
          targetHumidity: 60,
          targetOxygen: 16,
          rationale: '发酵后期：建议降温至30℃，减缓发酵速率，固定品质',
          priority: Math.abs(data.temperature - targetTemp) > 2 ? 'high' : 'medium',
        });
      }
    }

    // 湿度优化建议
    if (Math.abs(data.humidity - 65) > 5) {
      const targetHumidity = hours < 4 ? 68 : 62;
      recommendations.push({
        targetTemperature: data.temperature,
        targetHumidity,
        targetOxygen: data.oxygen,
        rationale: data.humidity > 70
          ? '湿度偏高，建议降低至62-68%，防止茶叶霉变'
          : '湿度偏低，建议增加至62-68%，保持茶叶柔软度',
        priority: Math.abs(data.humidity - 65) > 10 ? 'high' : 'medium',
      });
    }

    // 氧浓度优化建议
    if (data.oxygen < 15) {
      recommendations.push({
        targetTemperature: data.temperature,
        targetHumidity: data.humidity,
        targetOxygen: 18,
        rationale: '氧浓度偏低，建议增加通风，保证有氧发酵正常进行',
        priority: 'high',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        targetTemperature: data.temperature,
        targetHumidity: data.humidity,
        targetOxygen: data.oxygen,
        rationale: '当前参数设置合理，各项指标处于最佳工艺范围',
        priority: 'low',
      });
    }

    return recommendations;
  }

  // 异常根因分析
  public analyzeRootCause(data: SensorData, anomalyType: string): RootCauseAnalysis {
    const knowledgeKey = anomalyType.toLowerCase();
    const knowledge = this.rootCauseKnowledge[knowledgeKey as keyof typeof this.rootCauseKnowledge];

    if (!knowledge) {
      return {
        anomalyType,
        primaryCause: '未知异常类型',
        contributingFactors: ['数据不足，无法进行深入分析'],
        suggestedActions: ['建议检查传感器工作状态', '联系技术支持人员'],
        severity: 'medium',
      };
    }

    const causeIndex = Math.floor(Math.random() * knowledge.causes.length);
    const severity = anomalyType.includes('critical') ? 'critical' : anomalyType.includes('high') ? 'high' : 'medium';

    return {
      anomalyType,
      primaryCause: knowledge.causes[causeIndex],
      contributingFactors: knowledge.causes.filter((_, i) => i !== causeIndex).slice(0, 2),
      suggestedActions: knowledge.actions,
      severity,
    };
  }

  // 生成多设备模拟数据
  public generateDeviceData(deviceId: string, deviceName: string): DeviceData {
    const baseTemp = 30 + Math.random() * 6;
    const baseHumidity = 60 + Math.random() * 15;
    const baseOxygen = 15 + Math.random() * 10;
    const elapsedTime = 2 + Math.random() * 6;

    const statusRoll = Math.random();
    let status: DeviceData['status'];
    if (statusRoll < 0.7) status = 'running';
    else if (statusRoll < 0.85) status = 'idle';
    else if (statusRoll < 0.95) status = 'warning';
    else status = 'error';

    const sensorData: SensorData = {
      id: `sensor-${deviceId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      temperature: Math.round(baseTemp * 100) / 100,
      humidity: Math.round(baseHumidity * 100) / 100,
      oxygen: Math.round(baseOxygen * 100) / 100,
      fermentationTime: Math.round(elapsedTime * 100) / 100,
    };

    const qualityScore = this.predictQuality(sensorData).score;

    return {
      id: deviceId,
      name: deviceName,
      status,
      currentData: sensorData,
      qualityScore,
      elapsedTime,
    };
  }
}

export const aiService = new AIService();
