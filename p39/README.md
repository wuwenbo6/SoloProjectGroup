# CraftHub - 传统手工艺品定制平台

## 项目简介

CraftHub 是一个专注于小众传统手工艺品定制的全栈跨端平台，连接用户与手工艺匠人，实现从需求发布到作品交付的完整定制流程。

## 技术架构

### 前端
- **Web 端**: Next.js + React + TypeScript + Tailwind CSS
- **移动端**: Flutter (Android/iOS 跨端)

### 后端
- **微服务架构**: Spring Cloud + Spring Boot
- **服务注册**: Nacos
- **配置中心**: Nacos Config
- **API 网关**: Spring Cloud Gateway
- **服务间通信**: OpenFeign

### 数据库
- **用户数据库**: MySQL (用户信息、认证)
- **匠人数据库**: MySQL (匠人信息、资质审核)
- **订单数据库**: MySQL (定制订单、支付记录)
- **作品数据库**: MySQL (作品案例、展示)

## 模块划分

```
p39/
├── web-frontend/          # Next.js Web 前端
│   ├── pages/
│   │   ├── dashboard/     # 用户定制操作台
│   │   ├── artisans/      # 匠人展示页
│   │   └── orders/        # 订单管理页
│   ├── components/        # 公共组件
│   └── services/          # API 服务层
│
├── mobile-app/            # Flutter 移动端
│   ├── lib/
│   │   ├── pages/
│   │   │   ├── order/     # 订单定制
│   │   │   ├── chat/      # 匠人沟通
│   │   │   └── portfolio/ # 作品预览
│   │   └── models/        # 数据模型
│
├── backend/               # Spring Cloud 微服务
│   ├── gateway/           # API 网关服务
│   ├── user-service/      # 用户服务
│   ├── artisan-service/   # 匠人资质审核服务
│   ├── order-service/     # 订单管理服务
│   ├── requirement-service/ # 定制需求对接服务
│   ├── payment-service/   # 支付接口服务
│   └── notification-service/ # 消息推送服务
│
└── database/              # 数据库脚本
    ├── user_db/           # 用户库脚本
    ├── artisan_db/        # 匠人库脚本
    ├── order_db/          # 订单库脚本
    └── portfolio_db/      # 作品库脚本
```

## 核心功能

### 用户端
- 发布手工艺品定制需求
- 筛选匠人（按工艺类型、地域、评分）
- 在线沟通与方案确认
- 支付订单
- 查看定制进度

### 匠人端
- 接收定制需求通知
- 提交定制方案与报价
- 更新订单制作进度
- 展示作品案例与工艺介绍

## 快速开始

### Web 前端启动
```bash
cd web-frontend
npm install
npm run dev
```

### 移动端启动
```bash
cd mobile-app
flutter pub get
flutter run
```

### 后端启动
```bash
cd backend
mvn clean install
# 依次启动各微服务
```
