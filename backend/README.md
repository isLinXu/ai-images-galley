# AI 智能相册系统 - FastAPI 后端

基于 FastAPI 的**实验性后端**。图像管理已使用真实文件系统实现；AI 分析、Prompt 优化、
多模态理解/生成支持 OpenAI-compatible 模型，并在无 Key/调用失败时自动回退 mock 演示数据。

> **能力状态（重要）**
>
> - 图像管理：✅ 文件系统实现，支持上传、列表、查询、删除、压缩、缩略图、静态访问
> - 鉴权：⚠️ 默认关闭；设置 `ADMIN_TOKEN` 后，写操作需要 Bearer Token
> - AI 图像分析 / Prompt / 多模态：✅ 真实模型（需配置 `OPENAI_API_KEY`），失败时 mock 回退
> - 风格迁移 / 图像编辑：⚠️ 仍为 mock 占位，尚未接入真实图像编辑模型
> - URL 图像分析：✅ 支持，带主机白名单与大小/尺寸校验
> - 数据库 / 多用户 / 任务队列：❌ 尚未实现
> - 自动化测试：✅ 11 个 pytest 测试

## 快速开始

```bash
cd backend
# 后端依赖当前固定在 Python 3.11/3.12（Docker 使用 3.11）；3.14 暂无可用的 pydantic-core wheel
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m app.main
# 或
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后：

- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/v1/health
- 上传文件静态访问：`/uploads/<stored_name>`

## API

### 健康检查

- `GET /api/v1/health`
- `GET /api/v1/health/detailed`

### 图像管理

- `POST /api/v1/images/upload` — 单图上传（multipart 字段名 `file`）
- `POST /api/v1/images/upload/batch` — 批量上传（字段名 `files`）
- `GET /api/v1/images?limit=100&offset=0` — 图片列表
- `GET /api/v1/images/{image_id}` — 图片信息
- `DELETE /api/v1/images/{image_id}` — 删除图片及缩略图/元数据
- `POST /api/v1/images/{image_id}/compress?quality=80` — 压缩图片

### AI 分析

- `POST /api/v1/analysis` — 按 image_id 综合分析
- `POST /api/v1/analysis/url` — 按公开图片 URL 分析（主机白名单）
- `POST /api/v1/analysis/classify|detect|caption|colors|tags`
- `POST /api/v1/prompts/optimize|translate|generate-negative|analyze`
- `POST /api/v1/multimodal/image-to-text|text-to-image|visual-qa|style-transfer|image-edit`

配置 `AI_PROVIDER=auto`（默认）与 `OPENAI_API_KEY` 后，图像分析、Prompt 优化/翻译、
图像转文本、视觉问答、文生图使用真实模型。没有 Key 或模型调用失败时自动回退 mock；
风格迁移与图像编辑目前仍返回带 `provider: "mock"` 的占位结果。

模型调用使用 OpenAI-compatible `/chat/completions` 与 `/images/generations`，
因此也可接入兼容网关、Groq、Ollama 等。

## 存储结构

```
uploads/
├── {image_id}.jpg|png|webp|gif|bmp   原图
├── thumbnails/{image_id}.jpg          缩略图
├── .metadata/{image_id}.json          原始文件名、创建时间等
└── {image_id}_compressed.jpg          压缩结果
```

`image_id` 为文件内容 SHA-256 的前 16 位，因此同一文件重复上传会覆盖同一 ID。

## 配置

参考 `.env.example`。关键项：

| 变量                  | 说明                                 |
| --------------------- | ------------------------------------ |
| `UPLOAD_DIR`          | 上传目录，默认 `./uploads`           |
| `MAX_FILE_SIZE`       | 单文件大小上限，默认 50MB            |
| `MAX_IMAGE_DIMENSION` | 图片最大边长，默认 12000，防解压炸弹 |
| `ADMIN_TOKEN`         | 可选写操作 Token；留空表示不校验     |
| `SECRET_KEY`          | JWT 签名密钥，生产必须修改           |
| `AI_PROVIDER`         | `auto` / `mock` / `openai`           |
| `OPENAI_API_KEY`      | 真实 AI Key；留空则使用 mock         |
| `OPENAI_BASE_URL`     | OpenAI-compatible API 根地址         |
| `VISION_MODEL`        | 视觉模型，默认 `gpt-4o`              |
| `IMAGE_GEN_MODEL`     | 文生图模型，默认 `dall-e-3`          |
| `AI_TIMEOUT_SECONDS`  | 模型请求超时，默认 30 秒             |
| `ALLOWED_IMAGE_HOSTS` | URL 分析允许的图片主机（JSON 数组）  |

## 已知限制

- 文件系统存储不适合多实例部署，生产应使用对象存储 + 数据库。
- 上传、Pillow 解码和缩略图生成在异步路由中同步执行，高并发下会阻塞事件循环。
- 没有限流、审计、用户隔离和图片生命周期清理。
- 模型调用失败会回退 mock，响应中的 `provider` 字段可区分真实/演示结果。
- URL 分析通过主机白名单降低 SSRF 风险，但生产环境仍应配合网络层出站限制。
- `docs` 默认开放，生产环境建议按环境关闭。
- 依赖版本固定但未提供 lockfile/哈希校验；上线前应做依赖审计。

## 项目结构

```
backend/
├── app/
│   ├── api/           # 路由
│   ├── core/          # 配置与安全
│   ├── models/        # Pydantic 模型
│   ├── services/      # 业务逻辑（图像服务为真实实现，AI 服务为 mock）
│   └── main.py        # 应用入口
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```
