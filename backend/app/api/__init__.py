"""
API路由包
"""

from .health import router as health_router
from .images import router as images_router
from .analysis import router as analysis_router
from .prompts import router as prompts_router
from .multimodal import router as multimodal_router
