# AI智能相册系统 - FastAPI后端

基于FastAPI构建的高性能后端服务，提供图像管理、AI分析、Prompt智能优化和多模态处理等能力。

## 功能特性

- **图像管理**: 上传、压缩、缩略图生成、元数据提取
- **AI分析**: 图像分类、物体检测、描述生成、颜色提取
- **Prompt智能**: 提示词优化、翻译、模板管理、负面Prompt生成
- **多模态处理**: 图像转文本、文本转图像、视觉问答、风格迁移
- **RESTful API**: 完整的OpenAPI文档，支持在线调试

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的API密钥
```

### 3. 启动服务

```bash
# 开发模式
python -m app.main

# 或使用uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Docker部署

```bash
# 使用Docker Compose
docker-compose up -d

# 或单独构建
docker build -t ai-gallery-api .
docker run -p 8000:8000 ai-gallery-api
```

## API文档

启动服务后访问：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI: http://localhost:8000/openapi.json

## API端点

### 健康检查
- `GET /api/v1/health` - 基础健康检查
- `GET /api/v1/health/detailed` - 详细健康检查

### 图像管理
- `POST /api/v1/images/upload` - 上传单张图片
- `POST /api/v1/images/upload/batch` - 批量上传
- `GET /api/v1/images/{image_id}` - 获取图片信息
- `DELETE /api/v1/images/{image_id}` - 删除图片
- `POST /api/v1/images/{image_id}/compress` - 压缩图片

### AI分析
- `POST /api/v1/analysis` - 综合AI分析
- `POST /api/v1/analysis/classify` - 图像分类
- `POST /api/v1/analysis/detect` - 物体检测
- `POST /api/v1/analysis/caption` - 生成描述
- `POST /api/v1/analysis/colors` - 提取颜色
- `POST /api/v1/analysis/tags` - 生成标签

### Prompt智能
- `POST /api/v1/prompts/optimize` - 优化Prompt
- `POST /api/v1/prompts/translate` - 翻译Prompt
- `GET /api/v1/prompts/templates` - 获取模板列表
- `POST /api/v1/prompts/generate-negative` - 生成负面Prompt
- `POST /api/v1/prompts/analyze` - 分析Prompt质量

### 多模态处理
- `POST /api/v1/multimodal/image-to-text` - 图像转文本
- `POST /api/v1/multimodal/text-to-image` - 文本转图像
- `POST /api/v1/multimodal/visual-qa` - 视觉问答
- `POST /api/v1/multimodal/style-transfer` - 风格迁移

## 项目结构

```
backend/
├── app/
│   ├── api/           # API路由
│   ├── core/          # 核心配置
│   ├── models/        # 数据模型
│   ├── services/      # 业务逻辑
│   └── main.py        # 应用入口
├── tests/             # 测试文件
├── Dockerfile         # Docker构建文件
├── docker-compose.yml # Docker Compose配置
├── requirements.txt   # Python依赖
└── .env.example       # 环境变量示例
```

## 环境要求

- Python 3.11+
- FastAPI 0.115+
- Pillow (图像处理)
- 可选: Redis (缓存)
