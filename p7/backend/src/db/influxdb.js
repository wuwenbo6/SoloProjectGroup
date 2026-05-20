import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { config } from '../config.js';

const influxDB = new InfluxDB({
  url: config.influxdb.url,
  token: config.influxdb.token,
});

const writeApi = influxDB.getWriteApi(config.influxdb.org, config.influxdb.bucket, 'ms');
const queryApi = influxDB.getQueryApi(config.influxdb.org);

writeApi.useDefaultTags({ service: 'latex-collab' });

const pointBuffer = [];
const BUFFER_SIZE = 1000;
const FLUSH_INTERVAL = 5000;

let flushTimer = null;

const flushPoints = async () => {
  if (pointBuffer.length === 0) return;
  
  const points = [...pointBuffer];
  pointBuffer.length = 0;
  
  try {
    writeApi.writePoints(points);
    await writeApi.flush();
    console.log(`Flushed ${points.length} points to InfluxDB`);
  } catch (err) {
    console.error('Failed to flush points:', err);
    pointBuffer.push(...points);
  }
};

export const initInfluxDB = () => {
  if (flushTimer) {
    clearInterval(flushTimer);
  }
  flushTimer = setInterval(flushPoints, FLUSH_INTERVAL);
  console.log('InfluxDB initialized');
};

export const writePoint = (measurement, fields, tags = {}) => {
  const point = new Point(measurement);
  
  Object.entries(tags).forEach(([key, value]) => {
    point.tag(key, String(value));
  });
  
  Object.entries(fields).forEach(([key, value]) => {
    if (typeof value === 'number') {
      point.floatField(key, value);
    } else {
      point.stringField(key, String(value));
    }
  });
  
  pointBuffer.push(point);
  
  if (pointBuffer.length >= BUFFER_SIZE) {
    setImmediate(flushPoints);
  }
};

export const writePointsBatch = (points) => {
  pointBuffer.push(...points);
  
  if (pointBuffer.length >= BUFFER_SIZE) {
    setImmediate(flushPoints);
  }
};

export const queryData = async (fluxQuery) => {
  try {
    const result = await queryApi.collectRows(fluxQuery);
    return result;
  } catch (err) {
    console.error('Query error:', err);
    throw err;
  }
};

export const forceFlush = async () => {
  await flushPoints();
  await writeApi.close();
};

export { writeApi, queryApi, influxDB };
