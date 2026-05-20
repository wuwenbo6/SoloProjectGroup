# 车载诊断模拟系统

一个完整的全栈车载诊断（UDS）模拟系统，包含虚拟ECU节点、CAN总线模拟、WebSocket后端和Vue前端界面。

## 项目结构

```
p41/
├── can_stack/              # CAN协议栈
│   ├── __init__.py
│   ├── uds.py             # UDS协议实现
│   ├── can_bus.py         # 虚拟CAN总线
│   └── tp_layer.py        # ISO-TP传输层
├── ecu_sim/               # ECU模拟
│   ├── __init__.py
│   ├── base_ecu.py        # ECU基类
│   ├── engine_ecu.py      # 发动机ECU
│   ├── transmission_ecu.py # 变速箱ECU
│   └── abs_ecu.py         # ABS ECU
├── backend_websocket/     # WebSocket后端
│   ├── __init__.py
│   └── server.py          # 主服务器
├── frontend/              # 前端界面
│   └── index.html         # Vue应用
├── requirements.txt       # Python依赖
└── README.md
```

## 功能特性

### 后端
- ✅ 虚拟CAN总线，支持报文收发和历史记录
- ✅ **公平队列机制 (Fair Queuing)**：解决多个ECU同时响应时的总线抢占问题
  - 按发送者（仲裁ID）分组维护独立队列
  - Round-Robin轮询调度，确保每个ECU公平发送
  - 突发限制（max_burst=3），防止单个ECU长时间占用总线
  - 支持队列状态统计，方便调试
- ✅ ISO-TP传输层实现（单帧、多帧传输）
- ✅ UDS协议支持：
  - 0x10: 诊断会话控制
  - 0x11: ECU复位
  - 0x19: 读取DTC信息
  - 0x22: 按标识符读取数据
- ✅ 三个ECU节点模拟：
  - 发动机ECU（ID: 0x7E8/0x7E0）
  - 变速箱ECU（ID: 0x7E9/0x7E1）
  - ABS ECU（ID: 0x7EA/0x7E2）
- ✅ WebSocket服务器，实时推送CAN报文

### 前端
- ✅ Vue 3响应式界面
- ✅ ECU选择（发动机、变速箱、ABS）
- ✅ 预设诊断服务按钮
- ✅ 自定义UDS请求
- ✅ 实时CAN总线报文显示
- ✅ UDS响应解析和展示
- ✅ 报文保存和回放功能

## 安装和运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动后端服务器

```bash
cd backend_websocket
python server.py
```

服务器将在 `ws://localhost:8765` 启动。

### 3. 打开前端界面

直接在浏览器中打开 `frontend/index.html` 文件。

或者使用简单的HTTP服务器：

```bash
cd frontend
python -m http.server 8080
```

然后访问 `http://localhost:8080`

## 使用说明

### 基本操作

1. **选择ECU**: 点击"发动机"、"变速箱"或"ABS"按钮选择目标ECU
2. **发送预设请求**: 点击服务按钮发送常用诊断请求
3. **自定义请求**: 输入服务ID和数据，发送自定义UDS请求
4. **查看报文**: 中间面板实时显示CAN总线报文
5. **查看响应**: 右侧面板显示解析后的诊断响应
6. **保存/回放**: 点击"保存报文"或"回放报文"按钮

### 数据标识符 (DID)

- 0x1001: 发动机转速
- 0x1002: 车辆速度
- 0x1003: 冷却液温度
- 0x1004: 节气门位置
- 0x1005: 燃油液位
- 0x2001: 档位
- 0x2002: 变速箱油温度
- 0x3001: 左前轮速度
- 0x3002: 右前轮速度
- 0x3003: 左后轮速度
- 0x3004: 右后轮速度
- 0xF186: 当前诊断会话
- 0xF187: 软件版本
- 0xF190: VIN码

### UDS服务示例

| 服务ID | 服务名称 | 示例数据 | 说明 |
|--------|----------|----------|------|
| 0x10 | 诊断会话控制 | 01 | 默认会话 |
| 0x11 | ECU复位 | 01 | 硬复位 |
| 0x19 | 读取DTC | 02FF | 读取所有故障码 |
| 0x22 | 读取数据 | 1001 | 读取发动机转速 |

## 技术栈

- **后端**: Python 3.8+, asyncio, websockets
- **前端**: Vue 3 (CDN版本)
- **协议**: UDS (ISO 14229), ISO-TP (ISO 15765-2)

## 扩展开发

### 添加新的ECU

继承 `BaseECU` 类并实现特定功能：

```python
from ecu_sim.base_ecu import BaseECU

class BCMECU(BaseECU):
    def __init__(self, can_bus):
        super().__init__("BCM", can_bus, tx_id=0x7EB, rx_id=0x7E3)
        # 初始化DIDs和DTCs
```

### 添加新的UDS服务

在 `BaseECU._handle_uds_request` 中添加处理器映射：

```python
handler_map = {
    UDSService.NEW_SERVICE: self._handle_new_service,
    # ...
}
```

## License

MIT
