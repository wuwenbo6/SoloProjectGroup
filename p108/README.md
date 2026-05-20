# 榫卯 Mortise & Tenon - 传统榫卯结构游戏

## 项目简介

这是一款基于 Unity 引擎开发的 2D/3D 混合榫卯结构搭建游戏，旨在通过游戏化的方式传承和推广中国传统榫卯工艺。

## 核心功能模块

### 1. 核心物理模拟模块 (Physics)
- [PhysicsPiece.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Physics/PhysicsPiece.cs) - 物理部件基类
- [MortiseTenonJoint.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Physics/MortiseTenonJoint.cs) - 榫卯关节
- [PhysicsManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Physics/PhysicsManager.cs) - 物理管理器

**特性：**
- 基于 Unity 物理引擎的真实碰撞检测
- 榫卯连接力模拟
- 自动吸附和对齐
- 稳定性计算

### 2. 榫卯模型模块 (MortiseTenon)
- [MortiseTenonPiece.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/MortiseTenon/MortiseTenonPiece.cs) - 榫卯部件
- [PieceManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/MortiseTenon/PieceManager.cs) - 部件管理器

**支持的榫卯类型：**
- 直榫 (StraightTenon)
- L型榫 (LShapedTenon)
- T型榫 (TShapedTenon)
- 十字榫 (CrossTenon)
- 燕尾榫 (DovetailTenon)
- 斗拱 (BracketArch/DougongTier)

### 3. 游戏关卡模块 (Levels)
- [LevelData.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Levels/LevelData.cs) - 关卡数据
- [LevelManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Levels/LevelManager.cs) - 关卡管理器

**包含5个关卡：**
1. 初识榫卯 - 直榫 (Beginner)
2. L型接合 (Easy)
3. T型结构 (Medium)
4. 燕尾榫 (Hard)
5. 斗拱初探 (Expert)

### 4. UI 交互模块 (UI)
- [PieceDragHandler.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/UI/PieceDragHandler.cs) - 拖拽处理
- [PieceRotationHandler.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/UI/PieceRotationHandler.cs) - 旋转处理
- [UIManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/UI/UIManager.cs) - UI管理器

**交互方式：**
- 鼠标左键：选择/拖拽
- 鼠标右键：旋转
- 鼠标中键：视角旋转
- R + X/Y/Z：轴旋转
- Shift：精细操作模式

### 5. 存档模块 (SaveSystem)
- [SaveManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/SaveSystem/SaveManager.cs) - 存档管理器

**功能：**
- 关卡进度保存
- 最佳成绩记录
- 星数收集系统
- 设置保存

### 6. 教育知识模块 (Education)
- [KnowledgeManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Education/KnowledgeManager.cs) - 知识管理器

**包含知识内容：**
- 各类榫卯的历史和特点
- 榫卯发展简史
- 榫卯的哲学智慧
- 斗拱文化介绍

## 核心架构 (Core)
- [Singleton.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Core/Singleton.cs) - 单例基类
- [GameManager.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Core/GameManager.cs) - 游戏管理器
- [GameBootstrapper.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Core/GameBootstrapper.cs) - 游戏启动器

## 工具类 (Utils)
- [GameUtils.cs](file:///Users/wuwenbo/Documents/trae_projects/SoloProjectGroup/p108/Assets/Scripts/Utils/GameUtils.cs) - 通用工具

## 项目目录结构
```
Assets/
├── Scripts/
│   ├── Core/           # 核心架构
│   ├── Physics/        # 物理模拟
│   ├── MortiseTenon/   # 榫卯模型
│   ├── Levels/         # 关卡系统
│   ├── UI/             # 用户界面
│   ├── SaveSystem/     # 存档系统
│   ├── Education/      # 教育知识
│   ├── Utils/          # 工具类
│   └── Editor/         # 编辑器工具
├── Prefabs/            # 预制体
├── Scenes/             # 场景
├── Resources/          # 资源
│   ├── Data/
│   ├── Textures/
│   └── Models/
└── Settings/           # 设置
```

## 操作说明

1. 打开 Unity Hub，添加此项目
2. 打开主场景 MainScene
3. 创建一个空物体，添加 GameBootstrapper 组件
4. 设置 Layer：添加 "Piece" 层
5. 运行游戏

## 开发环境

- Unity 2022.3 LTS 或更高版本
- C# 9.0 或更高版本

## 待实现功能

- [ ] 完整的 3D 模型和美术资源
- [ ] 音效和背景音乐
- [ ] 更多关卡内容
- [ ] AR/VR 支持
- [ ] 多人协作模式
- [ ] 自定义榫卯编辑器

## 许可证

本项目仅供学习和研究使用。