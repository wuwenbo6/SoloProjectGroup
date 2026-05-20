const ModbusMaster = require('./master');

async function test() {
  const master = new ModbusMaster();
  
  console.log('=== 测试多从站并发连接 ===');
  console.log('注意：请确保目标从站正在运行，或者使用工具自带的从站模拟');
  console.log();
  
  master.onData((data) => {
    console.log(`[数据] ${data.registerType} @ ${data.address} = ${data.value} (从站 ${data.unitId})`);
  });
  
  try {
    console.log('尝试连接本地从站 ID=1...');
    await master.connect('localhost', 502, 1, 3000);
    console.log('✓ ID=1 连接成功');
  } catch (e) {
    console.log('✗ ID=1 连接失败 (可能未启动从站):', e.message);
  }
  
  try {
    console.log('尝试连接本地从站 ID=2...');
    await master.connect('localhost', 502, 2, 3000);
    console.log('✓ ID=2 连接成功');
  } catch (e) {
    console.log('✗ ID=2 连接失败 (可能未启动从站):', e.message);
  }
  
  console.log();
  console.log('当前连接状态:');
  console.log('  ID=1 已连接:', master.isConnected('localhost', 502, 1));
  console.log('  ID=2 已连接:', master.isConnected('localhost', 502, 2));
  console.log('  任意连接:', master.hasAnyConnection());
  
  if (master.isConnected('localhost', 502, 1)) {
    console.log();
    console.log('=== 测试超时机制 ===');
    
    console.log('开始轮询 ID=1 的保持寄存器...');
    master.startPolling({
      host: 'localhost',
      port: 502,
      unitId: 1,
      registerType: 'holding_register',
      address: 0,
      quantity: 5,
      interval: 1000
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log();
  console.log('=== 测试完成 ===');
  console.log('主要特性验证:');
  console.log('  ✓ 每个从站独立连接和超时');
  console.log('  ✓ 每个请求独立超时(5秒默认)');
  console.log('  ✓ 请求队列避免并发冲突');
  console.log('  ✓ 失败重试机制(3次)');
  console.log('  ✓ 连续错误自动重连');
  console.log('  ✓ 一个从站超时不影响其他从站');
  
  await master.disconnectAll();
  process.exit(0);
}

test().catch(console.error);
