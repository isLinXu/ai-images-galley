"""
安全工具模块
"""

import hashlib
import secrets
import hmac
from datetime import datetime, timedelta
from typing import Optional
import jwt
from app.core.config import settings


def generate_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """生成JWT令牌"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """验证JWT令牌"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.JWTError:
        return None


def generate_file_hash(file_content: bytes) -> str:
    """生成文件内容哈希"""
    return hashlib.sha256(file_content).hexdigest()


def generate_secure_filename(original_name: str) -> str:
    """生成安全的文件名"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    random_suffix = secrets.token_hex(4)
    ext = original_name.rsplit(".", 1)[-1] if "." in original_name else "jpg"
    return f"{timestamp}_{random_suffix}.{ext}"


def sanitize_prompt(prompt: str) -> str:
    """清理Prompt文本，防止注入攻击"""
    # 移除控制字符
    sanitized = "".join(char for char in prompt if ord(char) >= 32 or char in "\n\r\t")
    # 限制长度
    max_length = 4000
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    return sanitized.strip()
