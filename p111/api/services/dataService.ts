import { SensorData, Alert, ThresholdConfig } from '../../shared/types';

class DataService {
  private sensorDataHistory: SensorData[] = [];
  private alerts: Alert[] = [];
  private currentData: SensorData | null = null;
  private fermentationStartTime: Date = new Date();
  private dataInterval: NodeJS.Timeout | null = null;
  private wsConnections: any[] = [];
  private lastValues: { temperature: number; humidity: number; oxygen: number } = {
    temperature: 32,
    humidity: 65,
    oxygen: 18,
  };
  private anomalyOverride: { temperature?: number; humidity?: number; oxygen?: number } = {};
  private lastAlertTime: { [key: string]: number } = {};
  private alertCooldown = 3000; // 告警冷却时间3秒

  private thresholds: ThresholdConfig = {
    temperature: { min: 20, max: 45, warning: 38, critical: 42 },
    humidity: { min: 40, max: 90, warning: 80, critical: 85 },
    oxygen: { min: 5, max: 25, warning: 8, critical: 6 },
  };

  private baseValues = {
    temperature: 32,
    humidity: 65,
    oxygen: 18,
  };

  constructor() {
    this.initializeHistory();
    this.startDataGeneration();
  }

  private initializeHistory() {
    const now = new Date();
    for (let i = 60; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 1000);
      this.sensorDataHistory.push(this.generateSensorData(timestamp));
    }
  }

  private generateSensorData(timestamp: Date): SensorData {
    const fermentationTime = (timestamp.getTime() - this.fermentationStartTime.getTime()) / (1000 * 60 * 60);

    // 平滑数据生成 - 使用小的随机波动 + 趋势
    const smoothVariation = (last: number, base: number, maxChange: number) => {
      const target = base + (Math.random() - 0.5) * maxChange * 2;
      return last + (target - last) * 0.3; // 平滑系数
    };

    // 温度：±0.3度波动
    this.lastValues.temperature = smoothVariation(this.lastValues.temperature, this.baseValues.temperature, 0.3);
    // 湿度：±2%波动
    this.lastValues.humidity = smoothVariation(this.lastValues.humidity, this.baseValues.humidity, 2);
    // 氧浓度：±0.5%波动
    this.lastValues.oxygen = smoothVariation(this.lastValues.oxygen, this.baseValues.oxygen, 0.5);

    // 异常覆盖
    if (this.anomalyOverride.temperature !== undefined) {
      this.lastValues.temperature = this.anomalyOverride.temperature;
    }
    if (this.anomalyOverride.humidity !== undefined) {
      this.lastValues.humidity = this.anomalyOverride.humidity;
    }
    if (this.anomalyOverride.oxygen !== undefined) {
      this.lastValues.oxygen = this.anomalyOverride.oxygen;
    }

    return {
      id: `data-${timestamp.getTime()}`,
      timestamp: timestamp.toISOString(),
      temperature: Math.round(this.lastValues.temperature * 100) / 100,
      humidity: Math.round(this.lastValues.humidity * 100) / 100,
      oxygen: Math.round(this.lastValues.oxygen * 100) / 100,
      fermentationTime: Math.round(fermentationTime * 100) / 100,
    };
  }

  private checkThresholds(data: SensorData): Alert[] {
    const newAlerts: Alert[] = [];
    let alertIndex = 0;
    const now = Date.now();

    const shouldTriggerAlert = (type: string, level: string): boolean => {
      const key = `${type}-${level}`;
      if (!this.lastAlertTime[key] || now - this.lastAlertTime[key] >= this.alertCooldown) {
        this.lastAlertTime[key] = now;
        return true;
      }
      return false;
    };

    const checkType = (
      type: 'temperature' | 'humidity' | 'oxygen',
      value: number,
      thresholds: { warning: number; critical: number },
      isLessThan: boolean = false
    ) => {
      const condition = isLessThan
        ? (v: number, t: number) => v <= t
        : (v: number, t: number) => v >= t;

      if (condition(value, thresholds.critical) && shouldTriggerAlert(type, 'critical')) {
        newAlerts.push({
          id: `alert-${now}-${alertIndex++}-${type}`,
          timestamp: new Date().toISOString(),
          type,
          level: 'critical',
          message: `${type === 'temperature' ? '温度' : type === 'humidity' ? '湿度' : '氧浓度'}严重异常`,
          value,
          threshold: thresholds.critical,
          acknowledged: false,
        });
      } else if (condition(value, thresholds.warning) && shouldTriggerAlert(type, 'warning')) {
        newAlerts.push({
          id: `alert-${now}-${alertIndex++}-${type}`,
          timestamp: new Date().toISOString(),
          type,
          level: 'warning',
          message: `${type === 'temperature' ? '温度' : type === 'humidity' ? '湿度' : '氧浓度'}警告`,
          value,
          threshold: thresholds.warning,
          acknowledged: false,
        });
      }
    };

    checkType('temperature', data.temperature, this.thresholds.temperature);
    checkType('humidity', data.humidity, this.thresholds.humidity);
    checkType('oxygen', data.oxygen, this.thresholds.oxygen, true);

    return newAlerts;
  }

  private startDataGeneration() {
    this.dataInterval = setInterval(() => {
      const newData = this.generateSensorData(new Date());
      this.currentData = newData;
      this.sensorDataHistory.push(newData);

      if (this.sensorDataHistory.length > 3600) {
        this.sensorDataHistory.shift();
      }

      const newAlerts = this.checkThresholds(newData);
      if (newAlerts.length > 0) {
        this.alerts.unshift(...newAlerts);
        if (this.alerts.length > 1000) {
          this.alerts = this.alerts.slice(0, 1000);
        }
      }

      this.broadcast({ type: 'sensorData', data: newData });
      if (newAlerts.length > 0) {
        this.broadcast({ type: 'newAlerts', data: newAlerts });
      }
    }, 1000);
  }

  private broadcast(message: any) {
    this.wsConnections.forEach((ws) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  public addWebSocketConnection(ws: any) {
    this.wsConnections.push(ws);
    if (this.currentData) {
      ws.send(JSON.stringify({ type: 'sensorData', data: this.currentData }));
    }
    ws.send(JSON.stringify({ type: 'historyData', data: this.sensorDataHistory.slice(-60) }));
    ws.send(JSON.stringify({ type: 'alerts', data: this.alerts.slice(0, 50) }));
  }

  public removeWebSocketConnection(ws: any) {
    this.wsConnections = this.wsConnections.filter((conn) => conn !== ws);
  }

  public getCurrentData(): SensorData | null {
    return this.currentData;
  }

  public getHistoryData(startTime?: Date, endTime?: Date): SensorData[] {
    if (!startTime && !endTime) {
      return this.sensorDataHistory.slice(-300);
    }

    return this.sensorDataHistory.filter((data) => {
      const timestamp = new Date(data.timestamp);
      if (startTime && timestamp < startTime) return false;
      if (endTime && timestamp > endTime) return false;
      return true;
    });
  }

  public getAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(0, limit);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.broadcast({ type: 'alertUpdated', data: alert });
      return true;
    }
    return false;
  }

  public getThresholds(): ThresholdConfig {
    return this.thresholds;
  }

  public updateThresholds(config: Partial<ThresholdConfig>): ThresholdConfig {
    this.thresholds = { ...this.thresholds, ...config };
    return this.thresholds;
  }

  public simulateAnomaly(type: 'temperature' | 'humidity' | 'oxygen') {
    if (type === 'temperature') {
      this.anomalyOverride.temperature = 43;
    } else if (type === 'humidity') {
      this.anomalyOverride.humidity = 87;
    } else if (type === 'oxygen') {
      this.anomalyOverride.oxygen = 5;
    }

    setTimeout(() => {
      delete this.anomalyOverride[type];
    }, 10000);
  }
}

export const dataService = new DataService();
