# 跨平台回合制卡牌对战后端服务

## 项目概述

这是一个基于Java + Netty + Redis + MySQL开发的跨平台回合制卡牌对战后端服务，包含匹配服务、对战服务和数据存储模块，支持卡牌组合效果、天梯赛季系统和对战回放功能。

## 技术栈

- Java 11
- Netty 4.1.100.Final
- Redis + Jedis 4.4.3
- MySQL 8.0
- MyBatis
- Jackson
- SLF4J + Logback
- Maven

## 项目结构

```
card-battle/
├── pom.xml                    # 父POM文件
├── schema.sql                 # 数据库脚本
├── README.md                  # 项目说明
│
├── data-service/              # 数据存储服务 (端口: 8082)
│   ├── pom.xml
│   └── src/main/java/com/cardbattle/data/
│       ├── entity/            # 实体类
│       │   ├── Player.java
│       │   ├── Card.java
│       │   ├── Rank.java
│       │   ├── BattleRecord.java
│       │   ├── PlayerCard.java
│       │   ├── Season.java
│       │   ├── SeasonReward.java
│       │   └── PlayerSeasonRecord.java
│       ├── dao/               # 数据访问层
│       │   ├── PlayerDao.java
│       │   ├── CardDao.java
│       │   ├── BattleDao.java
│       │   ├── RankDao.java
│       │   ├── SeasonDao.java
│       │   ├── SeasonRewardDao.java
│       │   └── PlayerSeasonRecordDao.java
│       ├── redis/             # Redis服务
│       │   └── RedisService.java
│       ├── service/           # 业务服务
│       │   ├── SeasonService.java
│       │   └── ReplayService.java
│       └── server.java        # 服务启动类
│
├── match-service/             # 匹配服务 (端口: 8080)
│   ├── pom.xml
│   └── src/main/java/com/cardbattle/match/
│       ├── queue/             # 匹配队列
│       │   └── matcher.java   # 匹配器
│       └── server.java        # 匹配服务启动类
│
└── battle-service/            # 对战服务 (端口: 8081)
    ├── pom.xml
    └── src/main/java/com/cardbattle/battle/
        ├── handler/           # 处理器
        │   ├── CardHandler.java
        │   └── TurnHandler.java
        ├── logic/             # 业务逻辑
        │   ├── Effect.java
        │   ├── DamageCalc.java
        │   └── CardCombo.java
        ├── model/             # 对战模型
        │   ├── BattleRoom.java
        │   ├── PlayerBattleState.java
        │   ├── CardInstance.java
        │   └── BattleAction.java
        └── server.java        # 对战服务启动类
```

## 功能特性

### 数据存储模块
- MySQL存储玩家信息、卡牌库、段位数据、赛季数据
- Redis存储玩家在线状态、当前对战房间信息
- 对战结束后自动更新玩家段位和收集进度

### 匹配服务
- 基于Redis实现玩家匹配队列
- 按段位匹配玩家
- 好友邀请匹配功能
- 匹配成功后创建对战房间，分配对战服务节点
- 支持断线重连，玩家断开后1分钟内重连可回到对战房间
- 心跳机制维持房间存活，过期自动清理

### 对战服务
- 基于Java + Netty实现高性能服务
- 处理玩家出牌、攻击、使用技能等对战请求
- 卡牌效果逻辑：伤害计算、护盾、buff/debuff、状态控制
- **卡牌组合效果系统**：特定卡牌组合触发额外效果（烈焰风暴、神圣守护、力量爆发等）
- 回合制流程控制，每回合超时自动结束（60秒）
- 断线状态追踪，玩家断开后游戏继续，超时后判定胜负
- 对战过程详细记录，支持回放

### 天梯赛季系统
- 赛季管理：赛季开始、结束状态切换
- 玩家赛季战绩记录：胜场、负场、最高段位、连胜记录
- 赛季结算：赛季结束后重置玩家段位，发放奖励
- 段位奖励：每个段位对应独特称号奖励
- 赛季数据统计：胜率、总场次、最高排名

### 对战回放系统
- 完整对战过程记录，包括每回合操作、状态变化
- 详细战斗日志，记录卡牌效果触发过程
- 玩家历史对战查询，支持分页
- 回放数据包含完整战斗日志和最终状态
- 支持查看组合效果触发过程

## 快速开始

### 1. 环境准备
- JDK 11+
- Maven 3.6+
- MySQL 8.0+
- Redis 5.0+

### 2. 初始化数据库
```bash
mysql -u root -p < schema.sql
```

### 3. 配置修改
修改各服务中的数据库和Redis连接配置：
- data-service/src/main/java/com/cardbattle/data/server.java
- match-service/src/main/java/com/cardbattle/match/queue/matcher.java

### 4. 编译项目
```bash
cd card-battle
mvn clean install
```

### 5. 启动服务

启动数据服务：
```bash
cd data-service
mvn exec:java -Dexec.mainClass="com.cardbattle.data.server"
```

启动匹配服务：
```bash
cd match-service
mvn exec:java -Dexec.mainClass="com.cardbattle.match.server"
```

启动对战服务：
```bash
cd battle-service
mvn exec:java -Dexec.mainClass="com.cardbattle.battle.server"
```

## API接口

### 匹配服务 (端口: 8080)

- `POST /match/join` - 加入匹配队列
- `POST /match/leave` - 离开匹配队列
- `POST /match/invite` - 发送好友邀请
- `POST /match/accept` - 接受好友邀请
- `POST /match/reconnect` - 断线重连
- `POST /match/room` - 获取房间信息
- `POST /match/heartbeat` - 心跳
- `POST /match/disconnect` - 通知断线

### 对战服务 (端口: 8081)

- `POST /battle/create` - 创建对战房间
- `POST /battle/play` - 出牌
- `POST /battle/attack` - 攻击
- `POST /battle/endturn` - 结束回合
- `POST /battle/state` - 获取对战状态
- `POST /battle/replay` - 获取对战回放
- `POST /battle/disconnect` - 玩家断线通知
- `POST /battle/reconnect` - 玩家重连
- `POST /battle/heartbeat` - 心跳

### 数据服务 (端口: 8082)

#### 赛季相关
- `POST /season/current` - 获取当前赛季信息
- `POST /season/settle` - 结算赛季（管理员）
- `POST /season/stats` - 获取玩家赛季统计数据
- `POST /season/rewards` - 获取赛季奖励列表
- `POST /season/claim` - 领取赛季奖励

#### 回放相关
- `POST /replay/get` - 获取对战回放详情
- `POST /replay/history` - 获取玩家历史对战列表

#### 玩家相关
- `POST /player/info` - 获取玩家信息

## 核心数据结构

### 玩家 (Player)
- 基本信息：用户名、昵称、等级、经验
- 段位信息：段位ID、段位积分、段位称号
- 对战统计：胜场、败场、平局

### 卡牌 (Card)
- 卡牌类型：攻击、防御、治疗、特殊
- 费用、攻击力、生命值
- 效果类型和描述

### 对战记录 (BattleRecord)
- 对战ID、双方玩家ID、胜者ID
- 对战时长、回合数、开始/结束时间
- 回放数据JSON

### 赛季 (Season)
- 赛季ID、名称、描述
- 开始时间、结束时间、状态
- 赛季奖励配置

### 玩家赛季记录 (PlayerSeasonRecord)
- 玩家ID、赛季ID
- 最高段位、最终段位
- 胜场、负场、平局、最高连胜
- 奖励领取状态

## 卡牌组合效果

| 组合名称 | 触发条件 | 效果 |
|---------|---------|------|
| 烈焰风暴 | 一回合内使用2张火焰卡牌 | 对敌方造成额外8点伤害 |
| 神圣守护 | 一回合内使用护盾+治疗卡牌 | 获得15点护盾 |
| 力量爆发 | 一回合内使用攻击buff+攻击卡牌 | 攻击力额外提升 |
| 连锁抽卡 | 一回合内使用3张卡牌 | 额外抽取1张卡牌 |
| 终极防御 | 一回合内使用2张防御卡牌 | 获得25点护盾 |

## 开发说明

### 添加新卡牌效果
1. 在Effect类中添加新的效果类型
2. 在DamageCalc中添加对应的计算逻辑
3. 在CardHandler中实现效果应用
4. 在数据库中添加新卡牌记录

### 添加新卡牌组合
1. 在CardCombo类中定义新的组合规则
2. 添加组合触发条件和效果逻辑
3. 在CardHandler.playCard中确保组合检测被调用

### 添加新的匹配规则
1. 在matcher.java中扩展匹配逻辑
2. 修改匹配队列的匹配算法
3. 添加对应的API接口

### 赛季管理
1. 赛季结束后调用/season/settle接口进行结算
2. 结算后玩家可以领取赛季奖励
3. 新赛季开始前需要在数据库中创建新赛季记录

## 许可证

MIT License
