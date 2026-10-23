"""
AI分析路由
"""

import hashlib
import io
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.models.schemas import (
    ResponseModel, AnalysisRequest, AnalyzeUrlRequest
)
from app.services.ai_service import AIService

EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "GIF": ".gif",
    "BMP": ".bmp",
}

router = APIRouter()
ai_service = AIService()


@router.post("/analysis", response_model=ResponseModel)
async def analyze_image(request: AnalysisRequest):
    """分析图片 - 综合AI分析"""
    try:
        result = await ai_service.analyze_image(
            image_id=request.image_id,
            analysis_types=request.analysis_types,
            language=request.language,
            confidence_threshold=request.confidence_threshold
        )
        return ResponseModel(data=result, message="AI分析完成")
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}") from e


@router.post("/analysis/url", response_model=ResponseModel)
async def analyze_image_url(request: AnalyzeUrlRequest):
    """分析公开图片 URL。

    仅允许 `ALLOWED_IMAGE_HOSTS` 中的主机，防止后端被当作 SSRF 代理。
    图片会临时写入 uploads/，分析完成后立即删除。
    """
    parsed = urlparse(request.image_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="仅支持 http/https 图片 URL")
    host = parsed.hostname.lower()
    if host not in [item.lower() for item in settings.ALLOWED_IMAGE_HOSTS]:
        raise HTTPException(status_code=400, detail=f"不允许的图片主机: {host}")

    content = await _download_image(request.image_url)
    extension, width, height = _validate_image(content)
    if max(width, height) > settings.MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=400, detail=f"图片尺寸过大: {width}x{height}")

    image_id = f"ai-{hashlib.sha256(content).hexdigest()[:12]}-{uuid.uuid4().hex[:6]}"
    path = Path(settings.UPLOAD_DIR) / f"{image_id}{extension}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)

    try:
        result = await ai_service.analyze_image(
            image_id=image_id,
            analysis_types=request.analysis_types,
            language=request.language,
            confidence_threshold=request.confidence_threshold,
        )
        result.image_id = request.image_url
        return ResponseModel(data=result, message="AI分析完成")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}") from e
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


async def _download_image(url: str) -> bytes:
    max_bytes = settings.AI_IMAGE_MAX_BYTES
    chunks = []
    total = 0
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            async with client.stream("GET", url) as response:
                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=400,
                        detail=f"下载图片失败: HTTP {response.status_code}",
                    )
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        raise HTTPException(status_code=413, detail="图片超过允许的大小")
                    chunks.append(chunk)
    except HTTPException:
        raise
    except httpx.HTTPError as error:
        raise HTTPException(status_code=400, detail=f"下载图片失败: {error}") from error

    if not chunks:
        raise HTTPException(status_code=400, detail="图片内容为空")
    return b"".join(chunks)


def _validate_image(content: bytes) -> tuple[str, int, int]:
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            width, height = image.size
            extension = EXTENSIONS.get((image.format or "").upper(), ".jpg")
            return extension, width, height
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=400, detail=f"无法解析图片: {error}") from error


@router.post("/analysis/classify", response_model=ResponseModel)
async def classify_image(image_id: str, top_k: int = 5):
    """图像分类"""
    try:
        classifications = await ai_service.classify_image(image_id, top_k)
        return ResponseModel(
            data={"image_id": image_id, "classifications": classifications},
            message="图像分类完成"
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分类失败: {str(e)}") from e


@router.post("/analysis/detect", response_model=ResponseModel)
async def detect_objects(image_id: str, confidence_threshold: float = 0.3):
    """物体检测"""
    try:
        detections = await ai_service.detect_objects(image_id, confidence_threshold)
        return ResponseModel(
            data={"image_id": image_id, "detections": detections},
            message="物体检测完成"
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}") from e


@router.post("/analysis/caption", response_model=ResponseModel)
async def generate_caption(image_id: str, language: str = "zh", style: str = "descriptive"):
    """生成图像描述"""
    try:
        caption = await ai_service.generate_caption(image_id, language, style)
        return ResponseModel(
            data={"image_id": image_id, "caption": caption},
            message="图像描述生成完成"
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"描述生成失败: {str(e)}") from e


@router.post("/analysis/colors", response_model=ResponseModel)
async def extract_colors(image_id: str, num_colors: int = 5):
    """提取主色调"""
    try:
        colors = await ai_service.extract_colors(image_id, num_colors)
        return ResponseModel(
            data={"image_id": image_id, "colors": colors},
            message="颜色提取完成"
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"颜色提取失败: {str(e)}") from e


@router.post("/analysis/tags", response_model=ResponseModel)
async def generate_tags(image_id: str, max_tags: int = 10):
    """生成智能标签"""
    try:
        tags = await ai_service.generate_tags(image_id, max_tags)
        return ResponseModel(
            data={"image_id": image_id, "tags": tags},
            message="标签生成完成"
        )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"标签生成失败: {str(e)}") from e
