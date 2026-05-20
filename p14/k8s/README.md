# Kubernetes 部署指南

本目录包含数据分析平台的 Kubernetes 部署配置文件。

## 📁 文件结构

```
k8s/
├── namespace.yml      # 命名空间配置
├── configmap.yml      # 应用配置和ConfigMap
├── secrets.yml        # 敏感信息和密钥
├── redis.yml          # Redis部署
├── postgres.yml       # PostgreSQL数据库部署
├── kafka.yml          # Kafka + Zookeeper部署
├── app.yml            # 主应用部署（包含HPA和PDB）
├── ingress.yml        # Ingress入口配置
├── deploy.sh          # 一键部署脚本
├── cleanup.sh         # 清理脚本
└── README.md          # 本文档
```

## 🚀 快速部署

### 方法1：使用一键部署脚本（推荐）

```bash
# 给脚本添加执行权限
chmod +x deploy.sh cleanup.sh

# 执行部署
./deploy.sh
```

### 方法2：手动部署

```bash
# 1. 创建命名空间
kubectl apply -f namespace.yml

# 2. 部署配置和密钥
kubectl apply -f configmap.yml
kubectl apply -f secrets.yml

# 3. 部署基础服务
kubectl apply -f redis.yml
kubectl apply -f postgres.yml
kubectl apply -f kafka.yml

# 4. 等待基础服务就绪
kubectl wait --for=condition=ready pod -l app=redis -n analytics-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=postgres -n analytics-platform --timeout=300s
kubectl wait --for=condition=ready pod -l app=zookeeper -n analytics-platform --timeout=300s

# 5. 部署应用
kubectl apply -f app.yml

# 6. 部署Ingress
kubectl apply -f ingress.yml
```

## ⚙️ 配置说明

### 1. 修改域名（ingress.yml）

将 `analytics.example.com` 替换为你的实际域名：

```yaml
spec:
  tls:
  - hosts:
    - your-domain.com  # 修改这里
```

### 2. 更新密钥（secrets.yml）

⚠️ **重要：部署前必须更新以下密钥配置！**

```bash
# 生成PostgreSQL密码
echo -n "your-strong-password" | base64

# 生成JWT密钥（推荐32位以上随机字符串）
echo -n "your-jwt-secret-key-123456789" | base64

# 生成自签名TLS证书（仅用于测试）
openssl req -x509 -newkey rsa:4096 -keyout tls.key -out tls.crt -days 365 -nodes -subj "/CN=analytics.example.com"
base64 -w 0 tls.crt
base64 -w 0 tls.key
```

### 3. 修改镜像地址（app.yml）

将 `image: analytics-platform:latest` 替换为你的容器镜像仓库地址：

```yaml
image: registry.example.com/analytics-platform:v1.0  # 修改这里
imagePullPolicy: Always  # 如果镜像经常更新，建议改为Always
```

## 📊 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ingress (Nginx)                           │
│                       HTTPS + 限流 + CORS                         │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────┼────────────────────────────────┐
│                       App Service (ClusterIP)                   │
│                        ┌─────────┐ ┌─────────┐                   │
│                        │  Pod 1  │ │  Pod 2  │ ... (HPA扩展)     │
│                        └─────────┘ └─────────┘                   │
└────────────────────────────────┼────────────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
┌─────────▼───────┐    ┌─────────▼───────┐    ┌───────▼─────────┐
│   Redis          │    │   PostgreSQL    │    │   Kafka         │
│   (缓存)         │    │   (数据库)       │    │   (消息队列)    │
│   10GB存储       │    │   50GB存储       │    │   + Zookeeper   │
└──────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔍 验证部署

### 1. 查看Pod状态

```bash
kubectl get pods -n analytics-platform
```

所有Pod状态应该为 `Running`。

### 2. 查看服务

```bash
kubectl get services -n analytics-platform
```

### 3. 查看Ingress

```bash
kubectl get ingress -n analytics-platform
```

### 4. 查看Pod日志

```bash
# 查看应用日志
kubectl logs -f deployment/analytics-app -n analytics-platform

# 查看特定Pod日志
kubectl logs -f <pod-name> -n analytics-platform
```

### 5. 查看HPA状态

```bash
kubectl get hpa -n analytics-platform
```

## 🧪 本地测试

### 使用 Minikube / Kind

```bash
# 启动Minikube
minikube start

# 启用Ingress插件
minikube addons enable ingress

# 部署
./deploy.sh

# 获取访问地址
minikube ip

# 修改/etc/hosts，添加：
# <minikube-ip>  analytics.example.com

# 访问测试
curl https://analytics.example.com --insecure
```

### 使用端口转发测试

```bash
# 转发应用端口
kubectl port-forward service/app-service 8000:8000 -n analytics-platform

# 转发Redis端口（调试用）
kubectl port-forward service/redis-service 6379:6379 -n analytics-platform

# 转发PostgreSQL端口（调试用）
kubectl port-forward service/postgres-service 5432:5432 -n analytics-platform
```

## 📈 扩缩容

### 手动扩缩容

```bash
# 扩展到5个副本
kubectl scale deployment analytics-app -n analytics-platform --replicas=5

# 缩减到2个副本
kubectl scale deployment analytics-app -n analytics-platform --replicas=2
```

### 自动扩缩容（HPA）

已配置基于CPU和内存的自动扩缩容：
- CPU使用率 > 70% 时自动扩容
- 内存使用率 > 80% 时自动扩容
- 最小副本数：2
- 最大副本数：10

查看HPA状态：
```bash
kubectl describe hpa analytics-app-hpa -n analytics-platform
```

## 🔐 安全建议

1. **使用Sealed Secrets管理密钥**
   ```bash
   # 不要直接使用明文的secrets.yml，推荐使用：
   # https://github.com/bitnami-labs/sealed-secrets
   ```

2. **启用网络策略**
   ```yaml
   # 添加网络策略限制Pod间通信
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   ...
   ```

3. **使用私有镜像仓库**
   ```bash
   # 创建镜像拉取密钥
   kubectl create secret docker-registry regcred \
     --docker-server=<your-registry-server> \
     --docker-username=<your-name> \
     --docker-password=<your-pword> \
     --docker-email=<your-email> \
     -n analytics-platform
   ```

4. **启用Pod安全策略**

5. **配置RBAC权限控制**

## 🛠️ 故障排查

### Pod无法启动

```bash
# 查看Pod详情
kubectl describe pod <pod-name> -n analytics-platform

# 查看Pod事件
kubectl get events -n analytics-platform --sort-by='.lastTimestamp' | tail -20
```

### 数据库连接问题

```bash
# 测试数据库连接
kubectl exec -it <postgres-pod-name> -n analytics-platform -- psql -U postgres -d analytics

# 查看数据库配置
kubectl exec <postgres-pod-name> -n analytics-platform -- env | grep -i postgres
```

### Redis连接问题

```bash
# 测试Redis连接
kubectl exec -it <redis-pod-name> -n analytics-platform -- redis-cli ping
```

### Kafka相关问题

```bash
# 查看Kafka日志
kubectl logs -f <kafka-pod-name> -n analytics-platform

# 查看Zookeeper日志
kubectl logs -f <zookeeper-pod-name> -n analytics-platform
```

## 🗑️ 清理部署

```bash
# 方法1：使用清理脚本
./cleanup.sh

# 方法2：手动删除
kubectl delete namespace analytics-platform
```

## 📞 支持

如有问题，请：
1. 查看Pod日志和事件
2. 检查各服务健康检查状态
3. 验证配置映射和密钥是否正确加载
4. 检查网络策略是否允许通信
