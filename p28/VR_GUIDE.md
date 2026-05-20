# 🥽 VR模式使用指南

## 系统要求

### 硬件要求
- **VR头盔**: Meta Quest 1/2/3, HTC Vive, Valve Index, Pico 4 等
- **控制器**: 6DoF 控制器（必备）
- **PC配置**: 推荐RTX 3060以上显卡，16GB以上内存

### 软件要求
- **浏览器**: Chrome 110+ 或 Edge 110+
- **VR运行时**: SteamVR, Oculus App 或 Meta Quest Link
- **网络**: 稳定的局域网连接

## 快速入门

### 1. 设备准备
```bash
# Meta Quest 用户
1. 启动 Quest 设备
2. 启用开发者模式
3. 使用 Quest Link 连接电脑（有线或Air Link）
4. 启动 Oculus App 确保连接正常

# SteamVR 用户
1. 启动 SteamVR
2. 确认基站和控制器定位正常
3. 进入"房间设置"配置游玩区域
```

### 2. 浏览器配置
```bash
# 访问 Chrome 实验功能页面
chrome://flags/

# 启用以下选项：
- WebXR experiences (WebXR实验功能)  ✓
- WebXR Gamepads Module  ✓
- WebXR Hit Test  ✓

# 重启浏览器
```

### 3. 进入VR模式
1. 启动数字孪生平台前端
2. 点击底部的「🥽 进入VR模式」按钮
3. 戴上VR头盔，确认看到虚拟场景

## VR操作说明

### 🎮 控制器操作

| 按钮 | 功能 |
|------|------|
| **摇杆按下** | 传送移动（指向地面，出现光标后松开） |
| **摇杆左右** | 平滑转身（22.5°增量） |
| **摇杆前后** | 自由行走 |
| **扳机键** | 射线选择/设备交互 |
| **菜单键** | 显示/隐藏控制面板 |

### 👋 手势交互

1. **设备选择**
   - 用控制器射线指向设备
   - 扣动扳机选中设备
   - 看到设备高亮并弹出通知

2. **设备控制**
   - 选中设备后可发送启停指令
   - 状态变化实时同步到3D模型

3. **自由移动**
   - 传送模式：指向地面出现抛物线，按下摇杆传送
   - 行走模式：推动摇杆在场景中平滑移动

## 功能特性

### 🏭 沉浸式工厂
- 1:1 比例还原真实工厂布局
- 设备实时状态同步（温度、转速、故障码）
- 3D 空间音效，根据距离感知设备位置

### 📊 VR仪表盘
- 悬浮在视野下方的控制面板
- 实时显示设备运行统计
- 故障设备自动报警

### 🎯 设备交互
- 射线精确拾取设备
- 点击触发设备操作
- 设备状态可视化反馈

## 常见问题

### ❓ 点击「进入VR模式」没反应

**可能原因**:
1. VR运行时未启动 → 启动 SteamVR 或 Oculus App
2. 浏览器不支持 → 确保使用 Chrome/Edge
3. 设备未连接 → 检查USB/无线连接

**解决**:
```javascript
// 在浏览器控制台检查支持
console.log(navigator.xr)
// 应该返回 XRSystem 对象，而非 undefined
```

### ❓ 进入VR后黑屏

**可能原因**:
1. 显卡性能不足 → 降低浏览器硬件加速质量
2. WebXR 兼容性问题 → 更新浏览器到最新版
3. 显存不足 → 关闭其他应用

### ❓ 控制器无响应

**解决**:
1. 退出VR模式
2. 在 SteamVR 中重新校准控制器
3. 刷新页面重新进入

### ❓ 移动卡顿

**优化建议**:
- 降低浏览器标签页数量
- 在 FactoryScene.jsx 中减少设备模型面数
- 启用浏览器硬件加速

## 性能优化

### 前端配置
```javascript
// FactoryScene.jsx - 调整渲染质量
const engine = new Engine(canvasRef.current, true);
engine.setHardwareScalingLevel(1.5);  // 降低分辨率提升性能
engine.adaptToDeviceRatio = true;

// 减少阴影质量
scene.shadowGenerator?.setQuality(1024);
```

### VR专用设置
```javascript
// 启用VR性能模式
const xrHelper = await scene.createDefaultXRExperienceAsync({
  disableTeleportation: false,
  useMultiview: true,  // 多视图渲染提升性能
  framebufferScaleFactor: 0.8  // 降低分辨率
});
```

## 开发调试

### VR调试模式
1. 在 Chrome 中安装 **WebXR API Emulator** 扩展
2. 无需真实VR设备即可测试VR功能
3. 扩展提供虚拟控制器和头部追踪

### 调试日志
```javascript
// 查看WebXR状态
xrHelper.baseExperience.onStateChangedObservable.add((state) => {
  console.log('XR状态变化:', state);
});

// 控制器连接事件
xrHelper.input.onControllerAddedObservable.add((controller) => {
  console.log('控制器已连接:', controller.uniqueId);
});
```

## 高级功能

### 📱 移动端VR (Cardboard)
- 支持 Google Cardboard 简易VR
- 性能要求较低，适合演示用途
- 需启用手机VR模式

### 👥 多用户VR协作
- 多用户同时进入同一虚拟空间
- 看到彼此的虚拟Avatar
- 实时同步设备操作状态

### 📹 VR录像/直播
- 内置屏幕录制功能
- 支持直播推流到B站/YouTube
- 第三方虚拟摄像师视角切换

## 安全提示

⚠️ **重要提醒**:
1. 确保周围有足够的物理空间（至少2m x 2m）
2. 移除障碍物，避免碰撞受伤
3. 每使用30分钟休息5分钟，防止眩晕
4. 初次使用建议有人陪同
5. 不要在佩戴头盔时快速移动

## 联系支持

遇到问题请检查:
1. 浏览器控制台错误日志
2. VR运行时状态提示
3. 显卡驱动是否最新版本

---

**祝使用愉快！🎉**
