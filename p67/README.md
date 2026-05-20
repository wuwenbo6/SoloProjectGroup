# 民俗活动报名平台 - 完整跨端应用

## 项目概述

这是一个完整的 Web+Android+iOS 跨端民俗活动报名平台，包含：

- **Web端**：基于 Next.js 搭建活动报名操作台、民俗展示页
- **移动端**：基于 Flutter 开发，支持活动报名、视频观看、订单跟踪
- **后端**：Spring Cloud 微服务架构，包含订单管理、资质审核、支付接口、消息推送模块

## 项目结构

```
p67/
├── web/                 # Next.js Web端
├── mobile/              # Flutter 移动端
├── backend/             # Spring Cloud 微服务后端
│   ├── eureka-server/   # 服务注册中心
│   ├── api-gateway/     # API网关
│   ├── order-service/   # 订单管理服务
│   ├── audit-service/   # 资质审核服务
│   ├── payment-service/ # 支付接口服务
│   └── message-service/ # 消息推送服务
└── README.md
```

## 技术栈

### Web端
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Axios

### 移动端
- Flutter 3.x
- Dart 3.x
- GetX (状态管理)
- Dio (网络请求)
- VideoPlayer (视频播放)

### 后端
- Spring Boot 3.x
- Spring Cloud 2023.x
- Spring Cloud Netflix Eureka
- Spring Cloud Gateway
- MyBatis Plus
- MySQL
- Redis
- RabbitMQ
- Docker

## 快速开始

### Web端
```bash
cd web
npm install
npm run dev
```

### 移动端
```bash
cd mobile
flutter pub get
flutter run
```

### 后端
```bash
cd backend
mvn clean install
docker-compose up -d
```

## 功能模块

### Web端功能
- 📊 活动报名操作台
- 🎭 民俗活动展示页
- 📋 活动管理
- 👥 用户管理
- 📈 数据统计

### 移动端功能
- 🎫 活动报名
- 📺 视频观看
- 📦 订单跟踪
- 💬 即时沟通
- 📱 个人中心

### 后端微服务
- **订单管理服务**：订单创建、查询、更新、取消
- **资质审核服务**：用户资质审核、活动审核
- **支付接口服务**：支付下单、回调、退款
- **消息推送服务**：短信、推送、站内信
