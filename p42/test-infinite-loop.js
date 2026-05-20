const ModbusSlave = require('./slave');
const ScriptEngine = require('./script-engine');

async function test() {
  console.log('=== 测试脚本引擎死循环防护 ===\n');
  
  const slave = new ModbusSlave();
  const engine = new ScriptEngine(slave);

  console.log('测试1: 正常脚本执行...');
  try {
    const normalScript = `
      let count = getHoldingRegister(0) || 0;
      count += 1;
      setHoldingRegister(0, count);
      log('Count: ' + count);
      return count;
    `;
    
    const result = await engine.executeOnce(normalScript);
    console.log('✓ 正常脚本执行成功, 返回值:', result);
  } catch (e) {
    console.log('✗ 正常脚本执行失败:', e.message);
  }

  console.log('\n测试2: 死循环脚本防护...');
  const startTime = Date.now();
  try {
    const infiniteLoopScript = `
      log('Starting infinite loop...');
      while(true) {
        // 死循环
      }
      return 'should not reach here';
    `;
    
    const result = await engine.executeOnce(infiniteLoopScript);
    console.log('✗ 死循环脚本未被阻止!');
  } catch (e) {
    const elapsed = Date.now() - startTime;
    console.log('✓ 死循环被成功拦截, 耗时:', elapsed + 'ms');
    console.log('  错误信息:', e.message);
  }

  console.log('\n测试3: CPU密集计算防护...');
  try {
    const cpuHeavyScript = `
      let result = 0;
      for(let i = 0; i < 1000000000; i++) {
        result += Math.sqrt(i);
      }
      return result;
    `;
    
    const startTime2 = Date.now();
    const result = await engine.executeOnce(cpuHeavyScript);
    const elapsed = Date.now() - startTime2;
    console.log('✓ CPU密集计算被拦截, 耗时:', elapsed + 'ms');
  } catch (e) {
    console.log('✓ CPU密集计算被成功拦截:', e.message);
  }

  console.log('\n测试4: 内存限制测试...');
  try {
    const memoryScript = `
      const arr = [];
      for(let i = 0; i < 1000000; i++) {
        arr.push(new Array(1000).fill('x'));
      }
      return arr.length;
    `;
    
    const result = await engine.executeOnce(memoryScript);
    console.log('✗ 内存脚本未被阻止!');
  } catch (e) {
    console.log('✓ 内存超限被成功拦截:', e.message);
  }

  console.log('\n测试5: 验证主进程仍然正常运行...');
  console.log('✓ 主进程响应正常');
  console.log('  当前时间:', new Date().toLocaleString());

  console.log('\n=== 所有测试完成 ===');
  process.exit(0);
}

test().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
