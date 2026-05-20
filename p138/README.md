# eBPF Latency Monitor

基于eBPF的多协议延迟监控工具，支持HTTP、gRPC、MySQL协议，提供实时Top UI和阈值报警功能。

## 功能特性

- **多协议支持**：HTTP、gRPC、MySQL延迟监控
- **内核态+用户态全链路延迟统计**：从请求接收至响应发送的完整耗时
- **长连接支持**：正确统计长连接中每个请求的延迟
- **跨内核版本兼容**：支持Linux 5.4+，使用兼容的eBPF helper函数
- **实时Top UI**：类似htop的终端界面，实时展示统计信息
- **阈值报警**：可配置各协议延迟阈值，超时自动报警
- **火焰图数据生成**：生成folded格式数据，可直接用于生成火焰图
- **容器环境支持**：自动识别进程所属的容器ID
- **SQLite历史数据存储**：持久化存储监控数据，支持按协议统计查询

## 系统要求

- Linux kernel >= 5.4 (支持BTF)
- clang >= 14
- Go >= 1.21
- root权限

## 构建

```bash
# 安装依赖
go mod download

# 构建
make build
```

## 使用方法

### 基本使用（实时Top UI，默认启用）

```bash
sudo ./http-latency
```

### 命令行选项

```bash
# 指定火焰图输出文件
sudo ./http-latency -o my_latency.folded

# 指定数据库路径
sudo ./http-latency -d my_data.db

# 禁用数据库存储
sudo ./http-latency --enable-db=false

# 禁用实时UI
sudo ./http-latency --top=false

# 禁用容器检测
sudo ./http-latency --container=false

# 自定义报警阈值
sudo ./http-latency --http-threshold=1000 --grpc-threshold=500 --mysql-threshold=300
```

### UI操作

- `q` - 退出程序
- `c` - 清空统计数据

### UI界面说明

```
┌──────────────────────────────────────────────────────────────────┐
│🐝 eBPF Latency Monitor - Press 'q' to quit, 'c' to clear stats  │
├──────────────────────────────────────────────────────────────────┤
│📊 Total: 1234 req / 567 resp | ⏱ Uptime: 5m32s | 🚨 Thresholds│
├─────────────────────────────────────────────┬────────────────────┤
│ Protocol Statistics                         │ Top Processes      │
├────────┬───────┬────────┬────────┬────────┼────────┬───────────┤
│ Protocol│ Count │ Avg(ms)│ Min(ms)│ Max(ms)│ PID    │ Command   │
├────────┼───────┼────────┼────────┼────────┼────────┼───────────┤
│ HTTP   │ 345   │ 45.2   │ 1.2    │ 890.1  │ 12345  │ nginx     │
│ gRPC   │ 123   │ 28.5   │ 0.8    │ 450.3  │ 23456  │ python3   │
│ MySQL  │ 99    │ 15.3   │ 0.5    │ 120.7  │ 34567  │ mysqld    │
└────────┴───────┴────────┴────────┴────────┴────────┴───────────┘
┌──────────────────────────────────────────────────────────────────┐
│ Alerts (Recent 10)                                               │
├──────────────────────────────────────────────────────────────────┤
│ [14:32:15] HTTP - High latency detected: 890.12ms                │
│ [14:31:45] gRPC - High latency detected: 520.34ms                │
└──────────────────────────────────────────────────────────────────┘
```

### 默认阈值

- HTTP: 500ms
- gRPC: 300ms
- MySQL: 200ms

## 生成火焰图

使用Brendan Gregg的FlameGraph工具生成可视化火焰图：

```bash
# 下载FlameGraph工具
git clone https://github.com/brendangregg/FlameGraph.git

# 生成火焰图
./FlameGraph/flamegraph.pl latency.folded > latency.svg
```

火焰图按协议、进程、延迟分桶分层展示。

## 数据库查询

程序将所有响应记录存储在SQLite数据库中：

```sql
-- 查询最近100条记录
SELECT * FROM latency_records ORDER BY timestamp DESC LIMIT 100;

-- 按容器ID统计平均延迟
SELECT container_id, AVG(latency_ms) as avg_latency
FROM latency_records
GROUP BY container_id;

-- 按协议统计
SELECT protocol, COUNT(*) as count, AVG(latency_ms) as avg_latency
FROM latency_records
GROUP BY protocol;
```

## 工作原理

1. **连接建立跟踪**：通过kprobe挂载到`inet_csk_accept`，初始化连接信息
2. **请求接收跟踪**：通过kprobe挂载到`tcp_recvmsg`，检测请求接收，更新时间戳
3. **响应发送跟踪**：通过kprobe挂载到`tcp_sendmsg`，检测响应发送
4. **协议检测**：通过payload特征识别HTTP、gRPC、MySQL协议
5. **延迟计算**：计算从请求接收至响应发送的时间差
6. **长连接支持**：保持socket连接映射，每个新请求更新请求时间戳
7. **内核兼容性**：使用`bpf_probe_read`和`bpf_core_field_exists`确保跨内核版本兼容
8. **数据输出**：控制台实时输出 / TUI界面 / 火焰图数据文件 / SQLite数据库

## 支持的协议检测

### HTTP
- HTTP请求方法检测（GET, POST, PUT, DELETE, HEAD, OPTIONS, PATCH, TRACE, CONNECT）
- HTTP响应检测（"HTTP/"开头）

### gRPC
- gRPC帧头检测（5字节帧头格式）

### MySQL
- MySQL COM_QUERY包检测（0x03命令码 + SQL关键字）
- MySQL响应包检测（OK包/ERR包格式）

## 注意事项

- 工具需要root权限运行
- 协议检测基于payload内容，对TLS加密流量无效
- 内核版本支持Linux 5.4及以上
- 建议在测试环境先验证兼容性
- 连接映射保存在BPF哈希表中，最大支持10240个并发连接
- gRPC和MySQL检测基于协议特征，可能存在一定误检率
