"""
健康检查路由
"""

from fastapi import APIRouter
from datetime import datetime
import platform
import psutil

from app.models.schemas import HealthStatus, ResponseModel

router = APIRouter()


@router.get("/health", response_model=ResponseModel)
async def health_check():
    """健康检查端点"""
    return ResponseModel(
        data=HealthStatus(
            status="healthy",
            version="2.0.0",
            timestamp=datetime.utcnow(),
            services={
                "api": "running",
                "storage": "available",
                "ai_engine": "ready"
            }
        )
    )


@router.get("/health/detailed", response_model=ResponseModel)
async def detailed_health_check():
    """详细健康检查"""
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    return ResponseModel(
        data=HealthStatus(
            status="healthy",
            version="2.0.0",
            timestamp=datetime.utcnow(),
            services={
                "api": "running",
                "storage": "available",
                "ai_engine": "ready"
            },
            system_info={
                "platform": platform.platform(),
                "python_version": platform.python_version(),
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "memory": {
                    "total": memory.total,
                    "available": memory.available,
                    "percent": memory.percent
                },
                "disk": {
                    "total": disk.total,
                    "free": disk.free,
                    "percent": (disk.used / disk.total) * 100
                }
            }
        )
    )
