"""
核心配置模块
"""

import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    # 基础配置
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # CORS配置
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:8000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
        "http://127.0.0.1:8000",
        "https://islinxu.github.io",
        "https://ai-images-galley.vercel.app",
    ]
    
    # 安全配置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时
    # 可选的写操作保护：设置后，上传/删除/压缩需要 Authorization: Bearer <ADMIN_TOKEN>
    ADMIN_TOKEN: str = os.getenv("ADMIN_TOKEN", "")
    
    # 文件上传配置
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    MAX_IMAGE_DIMENSION: int = 12000  # 防止超大图片导致内存耗尽
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]
    
    # AI配置
    # auto: 有 OPENAI_API_KEY 时调用真实模型，否则 mock；mock: 强制演示数据；openai: 强制真实调用
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "auto")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    AI_TIMEOUT_SECONDS: float = float(os.getenv("AI_TIMEOUT_SECONDS", "30"))
    AI_CACHE_TTL_SECONDS: int = int(os.getenv("AI_CACHE_TTL_SECONDS", "300"))
    AI_IMAGE_MAX_BYTES: int = 15 * 1024 * 1024
    # URL 分析允许的图片主机（防止把后端当 SSRF 代理）
    ALLOWED_IMAGE_HOSTS: List[str] = [
        "islinxu.github.io",
        "raw.githubusercontent.com",
        "ai-images-galley.vercel.app",
        "localhost",
        "127.0.0.1",
    ]
    
    # 多模态配置
    VISION_MODEL: str = os.getenv("VISION_MODEL", "gpt-4o")
    IMAGE_GEN_MODEL: str = os.getenv("IMAGE_GEN_MODEL", "dall-e-3")
    
    # 缓存配置
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    CACHE_TTL: int = 3600  # 1小时
    
    # 限流配置
    RATE_LIMIT_PER_MINUTE: int = 60


settings = Settings()
