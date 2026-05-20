import Redis from 'ioredis';
import { config } from '../config.js';

const redis = new Redis(config.redis);

redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

export default redis;
