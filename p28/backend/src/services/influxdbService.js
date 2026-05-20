const { InfluxDB, Point } = require('@influxdata/influxdb-client');

class InfluxDBService {
  constructor() {
    this.client = null;
    this.writeApi = null;
    this.queryApi = null;
    this.simulated = true;
    this.memoryStore = new Map();
  }

  connect() {
    if (this.simulated) {
      console.log('Using simulated InfluxDB (memory storage)');
      return;
    }

    const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
    const token = process.env.INFLUXDB_TOKEN || 'my-token';
    const org = process.env.INFLUXDB_ORG || 'factory';
    const bucket = process.env.INFLUXDB_BUCKET || 'digital-twin';

    this.client = new InfluxDB({ url, token });
    this.writeApi = this.client.getWriteApi(org, bucket);
    this.queryApi = this.client.getQueryApi(org);
  }

  async writePoint(status) {
    if (this.simulated) {
      if (!this.memoryStore.has(status.deviceId)) {
        this.memoryStore.set(status.deviceId, []);
      }
      const history = this.memoryStore.get(status.deviceId);
      history.push(status);
      if (history.length > 100) {
        history.shift();
      }
      return;
    }

    const point = new Point('device_status')
      .tag('deviceId', status.deviceId)
      .tag('type', status.type)
      .floatField('temperature', status.temperature)
      .intField('faultCode', status.faultCode)
      .booleanField('running', status.running)
      .timestamp(new Date(status.timestamp));

    if (status.speed !== undefined) {
      point.floatField('speed', status.speed);
    }
    if (status.rotationSpeed !== undefined) {
      point.floatField('rotationSpeed', status.rotationSpeed);
    }
    if (status.battery !== undefined) {
      point.floatField('battery', status.battery);
    }

    this.writeApi.writePoint(point);
    await this.writeApi.flush();
  }

  async queryHistory(deviceId, range = '1h') {
    if (this.simulated) {
      return this.memoryStore.get(deviceId) || [];
    }

    const fluxQuery = `
      from(bucket: "digital-twin")
        |> range(start: -${range})
        |> filter(fn: (r) => r._measurement == "device_status" and r.deviceId == "${deviceId}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        |> sort(columns: ["_time"], desc: true)
    `;

    const results = [];
    return new Promise((resolve, reject) => {
      this.queryApi.queryRows(fluxQuery, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          results.push({
            timestamp: obj._time,
            temperature: obj.temperature,
            speed: obj.speed,
            rotationSpeed: obj.rotationSpeed,
            battery: obj.battery,
            faultCode: obj.faultCode,
            running: obj.running
          });
        },
        error(error) {
          reject(error);
        },
        complete() {
          resolve(results);
        }
      });
    });
  }
}

module.exports = InfluxDBService;
