# RISC-V RV32I Web仿真器

基于Node.js和WebSocket的Web端RISC-V RV32I指令集仿真器，支持汇编编辑、单步调试、断点、内存查看等功能。

## 项目结构

```
p146/
├── package.json          # 项目依赖配置
├── server/               # 后端服务
│   ├── index.js          # 主服务入口 (Express + WebSocket)
│   ├── database.js       # SQLite数据库管理
│   ├── simulator.js      # RISC-V RV32I 仿真核心
│   ├── assembler.js      # RISC-V 汇编器
│   └── elf-parser.js     # ELF文件解析器
├── public/
│   └── index.html        # 前端界面 (Ace Editor)
├── data/                 # 数据库文件目录
└── uploads/              # ELF文件上传目录
```

## 功能特性

### 后端 (Node.js)
- **Express Web服务**: 提供静态文件和REST API
- **WebSocket实时通信**: 实时同步仿真状态
- **SQLite数据库**: 存储历史调试会话
- **ELF文件加载**: 支持加载RISC-V ELF可执行文件
- **RV32I指令集仿真**: 完整支持RV32I基础指令集

### 前端 (Ace Editor)
- **汇编编辑器**: 语法高亮的RISC-V汇编编辑环境
- **单步执行**: 逐条执行指令，观察状态变化
- **连续运行/暂停**: 自动执行和暂停控制
- **寄存器查看**: 实时显示32个通用寄存器和PC值
- **内存查看**: 查看指定地址范围的内存内容
- **断点支持**: 在指定地址设置/删除断点
- **监视点支持**: 监视指定内存地址的访问
- **历史会话**: 保存和加载调试会话

## 安装依赖

```bash
# 修复npm权限（如果需要）
sudo chown -R $(whoami) ~/.npm

# 安装依赖
npm install
```

## 启动服务

```bash
npm start
# 或开发模式（自动重启）
npm run dev
```

服务启动后访问: `http://localhost:3000`

## API接口

### WebSocket消息类型

| 类型 | 说明 | 参数 |
|------|------|------|
| `init` | 初始化仿真会话 | `sessionId` |
| `load-elf` | 加载ELF文件 | `elfData` (base64) |
| `step` | 单步执行 | - |
| `run` | 连续运行 | - |
| `pause` | 暂停执行 | - |
| `reset` | 复位仿真器 | - |
| `set-breakpoint` | 设置断点 | `address` |
| `remove-breakpoint` | 删除断点 | `address` |
| `set-watchpoint` | 设置监视点 | `address`, `type` |
| `remove-watchpoint` | 删除监视点 | `address` |
| `get-memory` | 读取内存 | `address`, `length` |
| `get-registers` | 获取寄存器值 | - |
| `assemble` | 汇编代码 | `code` |
| `save-session` | 保存会话 | `code`, `breakpoints`, `watchpoints` |

### REST API

- `GET /api/sessions` - 获取所有历史会话
- `GET /api/sessions/:id` - 获取指定会话详情
- `DELETE /api/sessions/:id` - 删除指定会话
- `POST /api/upload-elf` - 上传ELF文件

## 支持的指令

### 寄存器-立即数指令
- `addi`, `slti`, `sltiu`, `xori`, `ori`, `andi`
- `slli`, `srli`, `srai`

### 寄存器-寄存器指令
- `add`, `sub`, `sll`, `slt`, `sltu`, `xor`, `srl`, `sra`, `or`, `and`

### 加载/存储指令
- `lb`, `lh`, `lw`, `lbu`, `lhu`
- `sb`, `sh`, `sw`

### 分支指令
- `beq`, `bne`, `blt`, `bge`, `bltu`, `bgeu`

### 跳转指令
- `jal`, `jalr`

### 其他指令
- `lui`, `auipc`, `fence`, `ecall`

## 使用示例

### 1. 简单的加法程序

```assembly
    addi x1, x0, 10    # x1 = 10
    addi x2, x0, 20    # x2 = 20
    add x3, x1, x2     # x3 = x1 + x2 = 30
```

### 2. 循环程序

```assembly
    addi x1, x0, 5     # 计数器初始值
loop:
    addi x1, x1, -1    # 计数器减1
    bne x1, x0, loop   # 不为0则继续循环
    ecall              # 程序结束
```

## 调试会话存储

会话数据自动保存到SQLite数据库 (`data/sessions.db`)，包括：
- 汇编代码内容
- 断点列表
- 监视点列表
- 创建和更新时间

## 技术栈

- **后端**: Node.js, Express, ws (WebSocket), SQLite3
- **前端**: Ace Editor, 原生JavaScript
- **仿真**: 纯JavaScript实现的RISC-V RV32I指令集模拟器

## 注意事项

1. 当前版本为纯JavaScript仿真器，Verilator集成需额外C++编译
2. 支持RV32I基本指令集，不支持扩展指令集
3. ELF文件需为RISC-V 32位小端格式
4. 内存默认大小为1MB，起始地址为0x10000

## 扩展开发

### 添加Verilator集成

如需添加真实的Verilator仿真支持，需：

1. 编写RISC-V核的Verilog实现
2. 使用Verilator编译为C++
3. 编写Node.js原生扩展调用仿真
4. 通过FFI或子进程方式集成

### 添加新指令支持

编辑 `server/simulator.js` 中的 `step()` 函数，添加新的指令解码和执行逻辑。
