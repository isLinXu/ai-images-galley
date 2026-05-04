"""
AI智能相册系统 - FastAPI后端服务
提供图像上传、AI分析、Prompt优化、多模态处理等API
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
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

# 创建FastAPI应用
app = FastAPI(
    title="AI智能相册系统 API",
    description="基于AI的智能图片管理和分析系统后端服务",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
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


@app.get("/")
async def root():
    """根路径 - API信息"""
    return {
        "name": "AI智能相册系统 API",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    logger.info("🚀 AI智能相册系统后端服务启动")
    logger.info(f"📍 环境: {settings.ENV}")
    logger.info(f"🐛 调试模式: {settings.DEBUG}")


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    logger.info("🛑 AI智能相册系统后端服务关闭")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
