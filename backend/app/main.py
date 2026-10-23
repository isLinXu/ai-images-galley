"""
AI智能相册系统 - FastAPI后端服务
提供图像上传、AI分析、Prompt优化、多模态处理等API
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import time
import logging

from app.core.config import settings
from app.api import images, analysis, prompts, multimodal, health

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """应用生命周期：替代已弃用的 on_event。"""
    logger.info("🚀 AI智能相册系统后端服务启动")
    logger.info("📍 环境: %s", settings.ENV)
    logger.info("🐛 调试模式: %s", settings.DEBUG)
    ai_mode = (
        "openai"
        if (settings.AI_PROVIDER or "auto").lower() != "mock" and settings.OPENAI_API_KEY
        else "mock"
    )
    logger.info("🧠 AI 模式: %s", ai_mode)
    yield
    logger.info("🛑 AI智能相册系统后端服务关闭")


# 创建FastAPI应用
app = FastAPI(
    title="AI智能相册系统 API",
    description="基于AI的智能图片管理和分析系统后端服务",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# 添加中间件
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """请求处理时间中间件"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    logger.error(f"全局异常: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "服务器内部错误",
                "detail": str(exc) if settings.DEBUG else None
            }
        }
    )


# 注册路由
app.include_router(health.router, prefix="/api/v1", tags=["健康检查"])
app.include_router(images.router, prefix="/api/v1", tags=["图像管理"])
app.include_router(analysis.router, prefix="/api/v1", tags=["AI分析"])
app.include_router(prompts.router, prefix="/api/v1", tags=["Prompt智能"])
app.include_router(multimodal.router, prefix="/api/v1", tags=["多模态处理"])

# 上传目录必须以静态文件形式暴露，否则接口返回的 /uploads/... 无法访问。
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "thumbnails"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/")
async def root():
    """根路径 - API信息"""
    return {
        "name": "AI智能相册系统 API",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running",
        "ai_mode": "openai"
        if (settings.AI_PROVIDER or "auto").lower() != "mock" and settings.OPENAI_API_KEY
        else "mock",
        "note": "配置 AI_PROVIDER=auto 且提供 OPENAI_API_KEY 后启用真实模型；否则返回 mock 数据"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        # 必须以 app.main:app 运行；直接写 "main:app" 在 `python -m app.main` 下找不到模块
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
