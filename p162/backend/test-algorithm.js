const {
  haversineDistance,
  synchronizeDetections,
  tdoaLocate,
  analyzeQuakeEvent,
  P_WAVE_VELOCITY
} = require('./src/quakeAnalyzer');

console.log('=== 地震检测算法测试 ===\n');

const trueEpicenter = { latitude: 31.2304, longitude: 121.4737 };
console.log(`真实震中: ${trueEpicenter.latitude}, ${trueEpicenter.longitude}`);
console.log(`P波波速: ${P_WAVE_VELOCITY} km/s\n`);

const devices = [
  { deviceId: 'device_001', latitude: 31.2104, longitude: 121.4537, clockOffset: 0 },
  { deviceId: 'device_002', latitude: 31.2504, longitude: 121.4937, clockOffset: 500 },
  { deviceId: 'device_003', latitude: 31.2204, longitude: 121.5037, clockOffset: -300 },
  { deviceId: 'device_004', latitude: 31.2404, longitude: 121.4437, clockOffset: 800 },
];

const originTime = Date.now();

const detections = devices.map(d => {
  const distance = haversineDistance(
    trueEpicenter.latitude, trueEpicenter.longitude,
    d.latitude, d.longitude
  );
  const travelTime = (distance / P_WAVE_VELOCITY) * 1000;
  const actualArrival = originTime + travelTime;
  const measuredArrival = actualArrival + d.clockOffset;
  
  return {
    deviceId: d.deviceId,
    latitude: d.latitude,
    longitude: d.longitude,
    timestamp: measuredArrival,
    intensity: Math.max(1, 8 - distance * 0.1)
  };
});

console.log('--- 模拟检测数据 ---');
detections.forEach((d, i) => {
  const dist = haversineDistance(trueEpicenter.latitude, trueEpicenter.longitude, d.latitude, d.longitude);
  console.log(`${d.deviceId}: 距离=${dist.toFixed(2)}km, 烈度=${d.intensity.toFixed(1)}, 时钟偏移=${devices[i].clockOffset}ms`);
});

console.log('\n--- 1. 时间同步测试 ---');
const synchronized = synchronizeDetections(detections);
synchronized.forEach((s, i) => {
  const original = detections[i];
  const offset = original.timestamp - s.synchronizedTime;
  const trueOffset = devices[i].clockOffset;
  console.log(`${s.deviceId}: 估计偏移=${offset.toFixed(0)}ms, 真实偏移=${trueOffset}ms, 误差=${Math.abs(offset - trueOffset).toFixed(0)}ms`);
});

console.log('\n--- 2. TDoA定位测试 ---');
const tdoaResult = tdoaLocate(synchronized);
const tdoaError = haversineDistance(
  trueEpicenter.latitude, trueEpicenter.longitude,
  tdoaResult.latitude, tdoaResult.longitude
) * 1000;
console.log(`TDoA定位结果: ${tdoaResult.latitude.toFixed(4)}, ${tdoaResult.longitude.toFixed(4)}`);
console.log(`定位误差: ${tdoaError.toFixed(1)} 米`);

console.log('\n--- 3. 完整事件分析 ---');
const event = analyzeQuakeEvent(detections);
console.log(`震中: ${event.epicenter.latitude}, ${event.epicenter.longitude}`);
console.log(`震级: M${event.magnitude}`);
console.log(`定位方法: ${event.locationMethod}`);
console.log(`时间同步质量: ${event.timeSyncQuality}`);
console.log(`设备数量: ${event.deviceCount}`);

const finalError = haversineDistance(
  trueEpicenter.latitude, trueEpicenter.longitude,
  event.epicenter.latitude, event.epicenter.longitude
) * 1000;
console.log(`最终定位误差: ${finalError.toFixed(1)} 米`);

console.log('\n=== 测试完成 ===');
console.log('\n关键改进:');
console.log('✓ 时钟偏移校正: 通过多轮迭代估计设备时钟偏差');
console.log('✓ TDoA定位: 利用波达时间差计算震中');
console.log('✓ 混合定位: 70% TDoA + 30% 加权中心');
console.log('✓ 异常值过滤: IQR方法去除离群点');
console.log('✓ 质量评估: 时间同步质量指标');
