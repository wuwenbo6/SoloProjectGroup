# Bug 修复说明

## 修复1：粒子在边界处状态切换时WebGPU计算缓冲区更新失败

### 问题描述
- 粒子在立方体边界处状态切换时，WebGPU计算缓冲区更新失败
- 导致部分粒子"卡死"并重复相同移动轨迹
- 问题根源：边界处理逻辑不清晰，状态切换使用了有问题的select函数

### 修复方案

#### 1.1 改进着色器边界处理 ([particle.wgsl](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p129/frontend/src/shaders/particle.wgsl#L100-L157))

**修改前的问题：**
```wgsl
// 使用了复合条件和select函数，可能导致状态异常
if (abs(p.position.x) > halfBoundary || ...) {
  let rand = noise3D(p.position + vec3<f32>(f32(index) * 0.01));
  if (rand > 0.7) {
    p.state = select(p.state, 1u, p.state == 0u);
    p.state = select(p.state, 0u, p.state == 1u);
  }
}
```

**修改后的方案：**
```wgsl
// 每个轴单独处理边界碰撞
if (p.position.x > halfBoundary) {
  p.position.x = halfBoundary;
  p.velocity.x = -abs(p.velocity.x);  // 确保速度方向正确
  outOfBounds = true;
} else if (p.position.x < -halfBoundary) {
  p.position.x = -halfBoundary;
  p.velocity.x = abs(p.velocity.x);
  outOfBounds = true;
}

// 使用明确的条件判断进行状态切换
if (outOfBounds) {
  let rand = noise3D(p.position + vec3<f32>(f32(index) * 0.01) + vec3<f32>(uniforms.time * 0.001));
  if (rand > 0.7 && p.state != 3u) {
    if (p.state == 0u) {
      p.state = 1u;
    } else if (p.state == 1u) {
      p.state = 0u;
    }
  }
}
```

#### 1.2 改进ParticleSystem缓冲区同步 ([ParticleSystem.ts](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p129/frontend/src/gpu/ParticleSystem.ts))

**修改前的问题：**
- 每次更新都创建新的读缓冲区
- 没有防止并发读取的机制
- 读取操作与计算操作在不同的command queue中

**修改后的方案：**
```typescript
// 在构造时创建单一读缓冲区
this.readBuffer = this.device.createBuffer({
  size: particleData.byteLength,
  usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
});

// 在同一个command encoder中执行计算和拷贝
const commandEncoder = this.device.createCommandEncoder();
const passEncoder = commandEncoder.beginComputePass();
// ... 计算 pass
passEncoder.end();

// 立即执行缓冲区拷贝
commandEncoder.copyBufferToBuffer(
  this.particleBuffer, 0,
  this.readBuffer, 0,
  this.particleBuffer.size
);

this.device.queue.submit([commandEncoder.finish()]);

// 使用pendingRead标志防止并发读取
if (!this.pendingRead) {
  this.updateParticleData();
}
```

**状态值安全检查：**
```typescript
const stateValue = data[offset + 6];
const stateIndex = Math.max(0, Math.min(3, Math.round(stateValue)));
p.state = stateMap[stateIndex] || 'foraging';

p.energy = Math.max(0, Math.min(100, data[offset + 7]));
p.age = Math.max(0, data[offset + 8]);
```

---

## 修复2：WebSocket广播时某些客户端收不到粒子死亡事件

### 问题描述
- 后端广播粒子死亡事件时，某些客户端收不到
- 没有错误处理和重试机制
- 客户端状态检查不完善

### 修复方案

#### 2.1 增加safeSend函数 ([websocket.ts](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p129/backend/src/services/websocket.ts#L94-L111))

```typescript
function safeSend(ws: WebSocket, message: ServerMessage): boolean {
  if (ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  try {
    const messageStr = JSON.stringify(message);
    ws.send(messageStr, (error) => {
      if (error) {
        console.error('WebSocket send error:', error);
      }
    });
    return true;
  } catch (error) {
    console.error('Error serializing or sending message:', error);
    return false;
  }
}
```

#### 2.2 改进广播逻辑 ([websocket.ts](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p129/backend/src/services/websocket.ts#L113-L157))

**分离粒子更新和死亡处理：**
```typescript
const deadParticleIds: string[] = [];
const aliveParticles: ParticleData[] = [];

for (const particle of message.particles) {
  if (particle.isDead) {
    particleState.delete(particle.id);
    deadParticleIds.push(particle.id);
  } else {
    particleState.set(particle.id, particle);
    aliveParticles.push(particle);
  }
}

if (aliveParticles.length > 0) {
  broadcastParticles(aliveParticles);
}

for (const deadId of deadParticleIds) {
  broadcastDeath(deadId);
}
```

**增加广播统计和日志：**
```typescript
function broadcastDeath(particleId: string) {
  const message: ServerMessage = {
    type: 'particle_death',
    particleId,
    timestamp: Date.now(),
  };
  
  console.log(`Broadcasting death for particle: ${particleId} to ${clients.size} clients`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const client of clients) {
    if (safeSend(client, message)) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log(`Death broadcast: ${successCount} success, ${failCount} failed`);
}
```

#### 2.3 前端死亡事件处理 ([main.ts](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p129/frontend/src/main.ts#L72-L74))

```typescript
this.webSocketService.onParticleDeath((particleId) => {
  console.log('Received particle death:', particleId);
  // 这里可以添加客户端的粒子死亡处理逻辑
  // 例如：从本地粒子系统中移除、播放死亡动画等
});
```

---

## 额外改进

### 数值稳定性改进
- 限制deltaTime最大值为0.1秒，防止大时间步导致的数值不稳定
- 增加能量、年龄等数值的范围检查
- 使用Math.round确保状态索引是整数

### 性能优化
- 复用读缓冲区，避免频繁创建和销毁GPU资源
- 使用pendingRead标志防止并发读取操作
- 将计算和拷贝操作合并到同一个command queue

### 调试和日志
- 增加详细的WebSocket广播日志
- 增加GPU读取错误处理
- 增加客户端连接状态日志

---

## 验证方法

### 边界处理验证
1. 观察粒子在边界处的行为，确保不会卡住
2. 检查粒子速度方向在边界处是否正确反转
3. 验证状态切换是否正常工作（觅食<->攻击）

### WebSocket验证
1. 打开多个客户端连接
2. 检查服务器日志，确认死亡事件广播成功计数
3. 在多个客户端验证是否都能收到死亡事件
4. 断开某个客户端，验证错误处理是否正常

### 性能验证
1. 观察帧率，确认不会因为边界处理导致性能下降
2. 检查GPU内存使用，确认没有泄漏
3. 验证512个粒子时的性能表现
