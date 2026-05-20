# eBPF L7 Network Policy for Kubernetes

基于eBPF的Kubernetes七层网络策略实现，支持HTTP路径和gRPC方法级别的访问控制。

## 架构概览

本项目包含以下组件：

1. **eBPF程序** - 挂载到TC（Traffic Control）钩子，在内核层解析数据包
2. **用户态守护进程** - 监听K8s API变化，管理eBPF maps
3. **CLI工具** - 用于调试、监控和手动管理规则

## 特性

- ✅ HTTP七层过滤（路径、方法）
- ✅ gRPC服务过滤
- ✅ K8s CRD自定义资源定义
- ✅ 实时事件监控
- ✅ 基于TC hook的高性能实现
- ✅ DaemonSet方式部署

## 目录结构

```
.
├── bpf/                    # eBPF C代码
│   ├── netpol.c           # 主eBPF程序
│   └── netpol.h           # 头文件定义
├── cmd/
│   ├── daemon/            # 守护进程
│   └── cli/               # CLI工具
├── pkg/
│   ├── ebpf/              # eBPF Go绑定和管理器
│   ├── k8s/               # K8s API监听
│   └── policy/            # 策略转换逻辑
├── manifests/              # K8s部署清单
│   ├── crd.yaml           # CRD定义
│   ├── rbac.yaml          # RBAC配置
│   ├── daemonset.yaml     # DaemonSet
│   └── example-policy.yaml # 示例策略
├── Makefile
├── Dockerfile
└── go.mod
```

## 快速开始

### 前置要求

- Linux Kernel >= 5.15 (支持BTF)
- clang >= 14.0
- golang >= 1.21
- Kubernetes >= 1.24

### 本地编译

```bash
# 生成eBPF Go绑定
make generate

# 编译所有二进制文件
make build
```

### 部署到Kubernetes

```bash
# 1. 安装CRD
kubectl apply -f manifests/crd.yaml

# 2. 安装RBAC
kubectl apply -f manifests/rbac.yaml

# 3. 构建并推送镜像
make docker-build
docker tag netpol-ebpf:latest your-registry/netpol-ebpf:latest
docker push your-registry/netpol-ebpf:latest

# 4. 部署DaemonSet
kubectl apply -f manifests/daemonset.yaml
```

### 创建L7网络策略

```bash
# 应用示例策略
kubectl apply -f manifests/example-policy.yaml

# 查看策略
kubectl get l7networkpolicies
```

## CLI工具使用

```bash
# 列出所有规则
sudo ./bin/netpol-cli rules --iface eth0

# 添加新规则
sudo ./bin/netpol-cli add-rule \
  --src-ip 10.0.0.1 \
  --dst-port 80 \
  --type http \
  --action deny \
  --path "/admin/*" \
  --method POST

# 删除规则
sudo ./bin/netpol-cli delete-rule \
  --src-ip 10.0.0.1 \
  --dst-port 80

# 监控事件
sudo ./bin/netpol-cli monitor
```

## 运行守护进程

```bash
sudo ./bin/daemon --iface eth0
```

## CRD示例

```yaml
apiVersion: netpol.ebpf.cni/v1
kind: L7NetworkPolicy
metadata:
  name: api-restrict
spec:
  podSelector:
    matchLabels:
      app: api-server
  policyTypes:
  - Ingress
  ingress:
  - from:
    - ipBlock:
        cidr: 10.0.0.0/8
    ports:
    - protocol: TCP
      port: 80
    http:
      paths:
      - "/admin/*"
      - "/private/*"
      methods:
      - "POST"
      - "PUT"
```

## 技术实现

### eBPF程序

- 挂载点: TC ingress/egress
- Maps:
  - `l7_rules`: 存储L7策略规则
  - `conn_states`: 连接状态跟踪
  - `events`: perf event buffer用于发送事件到用户态

### 数据包处理流程

1. TC钩子捕获数据包
2. 解析以太网帧 -> IP头 -> TCP头
3. 提取TCP payload
4. 解析HTTP请求行或gRPC头
5. 匹配eBPF map中的规则
6. 执行放行或丢弃操作
7. 通过perf buffer发送事件到用户态

## 故障排查

### 查看DaemonSet日志

```bash
kubectl logs -n kube-system -l k8s-app=netpol-ebpf
```

### 验证eBPF程序加载

```bash
# 查看TC过滤器
tc qdisc show dev eth0

# 查看eBPF程序
bpftool prog list
```

## 开发指南

### 添加新的协议支持

1. 在`bpf/netpol.h`中添加新类型
2. 在`bpf/netpol.c`中实现解析逻辑
3. 更新Go端类型定义
4. 更新CRD schema

## 许可证

GPL v2 (由于eBPF程序使用GPL兼容的license)
