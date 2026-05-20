# CHANGELOG

## [2.0.0] - 2024

### ✨ 新功能

#### 1. 多协议支持
- **HTTP**: 完整的HTTP请求和响应检测
- **gRPC**: gRPC协议帧检测
- **MySQL**: MySQL查询和响应包检测

#### 2. 实时Top UI界面
- 类似htop的终端UI界面
- 协议统计面板：显示各协议的请求数、平均/最小/最大延迟
- 进程统计面板：显示TOP进程的详细信息（PID、命令、容器、协议、计数、最后延迟、平均延迟）
- 报警面板：显示最近10条高延迟报警
- 状态栏：显示总请求/响应数、运行时间、报警阈值配置
- 快捷键：`q`退出，`c`清空统计

#### 3. 阈值报警机制
- 支持各协议独立配置报警阈值
- 默认阈值：HTTP=500ms, gRPC=300ms, MySQL=200ms
- 实时显示在UI报警面板中
- 支持自定义回调处理报警事件

#### 4. 数据库增强
- 新增protocol字段记录协议类型
- 新增GetStatsByProtocol()方法支持按协议统计查询

#### 5. 火焰图增强
- 按协议分层展示火焰图
- 折叠格式：protocol;process;latency_bucket count

### 🐛 Bug修复

#### 1. 内核版本兼容性修复
**问题**：在Linux 5.10以下版本，eBPF程序加载失败，因为使用了`bpf_probe_read_user` helper函数，该函数在旧内核中不可用。

**解决方案**：
- 将`bpf_probe_read_user`替换为更通用的`bpf_probe_read`
- 添加`bpf_core_field_exists`检查，确保结构体字段在不同内核版本间兼容
- 支持Linux 5.4及以上版本

**修改文件**：
- `ebpf/http_latency.bpf.c`

---

#### 2. 长连接延迟统计错误修复
**问题**：在HTTP长连接（Keep-Alive）场景下，多个请求复用同一个TCP连接。原逻辑只在`accept`时记录一次时间戳，后续请求的延迟会错误累加。

**根本原因**：
- 原逻辑：accept时间 -> 响应发送时间
- 问题：长连接中多个请求共享同一个accept时间，导致延迟从连接建立开始计算

**解决方案**：
- 新增`last_request_ts`字段，记录每个HTTP请求的接收时间
- 添加`tcp_recvmsg` kprobe，检测HTTP请求接收并更新时间戳
- 延迟计算改为：`last_request_ts` -> 响应发送时间
- 保持socket连接映射，不删除连接信息，支持持续跟踪
- 在`tcp_sendmsg`中也检测HTTP请求，处理客户端发送场景

**修改文件**：
- `ebpf/http_latency.bpf.c`
- `ebpf/http_latency.h`
- `cmd/main.go`

---

### 🔧 改进

1. **事件结构优化**：
   - 重命名`accept_ts` -> `request_ts`
   - 重命名`write_ts` -> `response_ts`
   - 新增`protocol`字段标识协议类型
   - 字段命名更准确反映其用途

2. **新增kprobe挂载**：
   - 添加`tcp_recvmsg` kprobe用于检测请求接收
   - 采用容错模式，挂载失败不影响主功能

3. **代码结构优化**：
   - 提取`init_connection_info`公共函数
   - 分离HTTP/gRPC/MySQL检测逻辑
   - 统一内存初始化使用`__builtin_memset`
   - 事件处理移至独立goroutine，避免阻塞ringbuf读取

4. **命令行参数增强**：
   - `--top`: 启用/禁用实时UI（默认true）
   - `--http-threshold`: HTTP延迟报警阈值（默认500ms）
   - `--grpc-threshold`: gRPC延迟报警阈值（默认300ms）
   - `--mysql-threshold`: MySQL延迟报警阈值（默认200ms）

---

### 📁 新增文件

- `internal/tui/top.go`: 实时Top UI界面实现，包含协议统计、进程统计、报警面板
