# 纱线图像检测系统

基于 FastAPI 和 OpenCV 的纱线图像检测系统，支持毛羽检测、断纱识别、粗细异常判定、批量分析和历史记录查询。

## 功能特性

1. **图像上传** - 支持 JPG、PNG、BMP 格式
2. **毛羽检测** - 基于边缘密度分析毛羽情况
3. **断纱识别** - 通过行投影分析检测断纱
4. **粗细异常判定** - 通过列投影标准差分析纱线粗细均匀度
5. **批量分析** - 按批次统计分析结果
6. **历史记录** - 分页查询、条件筛选检测历史

## 安装部署

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

或使用 uvicorn:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 访问接口文档

启动后访问: http://localhost:8000/docs

## API 接口说明

### 基础路径

所有接口前缀: `/api/v1/yarn`

### 1. 图像上传

```
POST /api/v1/yarn/upload
```

参数:
- `file`: 图像文件
- `batch_id` (可选): 批次ID

### 2. 上传并自动检测

```
POST /api/v1/yarn/upload-and-detect
```

上传图像后自动执行所有检测项目。

### 3. 毛羽检测

```
POST /api/v1/yarn/detect/hairiness/{detection_id}
```

### 4. 断纱识别

```
POST /api/v1/yarn/detect/breakage/{detection_id}
```

### 5. 粗细异常判定

```
POST /api/v1/yarn/detect/thickness/{detection_id}
```

### 6. 执行全部检测

```
POST /api/v1/yarn/detect/all/{detection_id}
```

### 7. 批量分析

```
POST /api/v1/yarn/batch-analyze/{batch_id}
```

返回指定批次的统计分析结果。

### 8. 历史记录查询

```
GET /api/v1/yarn/history
```

查询参数:
- `page`: 页码 (默认1)
- `page_size`: 每页数量 (默认20, 最大100)
- `batch_id`: 批次ID筛选
- `status`: 状态筛选 (normal/abnormal)
- `start_time`: 开始时间
- `end_time`: 结束时间

### 9. 获取单条检测记录

```
GET /api/v1/yarn/detection/{detection_id}
```

### 10. 删除检测记录

```
DELETE /api/v1/yarn/detection/{detection_id}
```

## 检测算法说明

### 毛羽检测
- 通过 Canny 边缘检测算法提取边缘
- 计算边缘像素占比作为毛羽分数
- 超过阈值 (默认0.15) 判定为有毛羽

### 断纱识别
- 计算图像行方向投影
- 检测纱线像素的连续性
- 最大间隙比例超过阈值 (默认0.3) 判定为断纱

### 粗细异常判定
- 计算图像列方向投影
- 分析纱线宽度的变异系数 (CV)
- CV 超过阈值 (默认0.2) 判定为粗细异常

## 配置说明

可在 `app/core/config.py` 中调整:

- `HAIRINESS_THRESHOLD`: 毛羽检测阈值 (默认0.15)
- `BREAKAGE_THRESHOLD`: 断纱检测阈值 (默认0.3)
- `THICKNESS_STD_THRESHOLD`: 粗细异常CV阈值 (默认0.2)
- `UPLOAD_DIR`: 上传文件目录
- `MAX_FILE_SIZE`: 最大文件大小

## 项目结构

```
p112/
├── app/
│   ├── api/
│   │   └── yarn.py          # API路由
│   ├── core/
│   │   ├── config.py        # 配置文件
│   │   └── database.py      # 数据库连接
│   ├── models/
│   │   └── yarn.py          # 数据模型
│   ├── schemas/
│   │   └── yarn.py          # Pydantic模式
│   └── utils/
│       └── image_processor.py  # 图像处理算法
├── uploads/                  # 上传文件目录
├── main.py                   # 主程序
├── requirements.txt          # 依赖列表
└── README.md                # 说明文档
```
