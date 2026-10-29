"""
AI分析路由
"""

import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models.schemas import AnalysisRequest, AnalyzeUrlRequest, ResponseModel
from app.services.ai_service import AIService
from app.services.image_fetcher import ImageFetchError, fetch_public_image

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
    try:
        fetched = await fetch_public_image(
            request.image_url,
            allowed_hosts=settings.ALLOWED_IMAGE_HOSTS,
            max_bytes=settings.AI_IMAGE_MAX_BYTES,
            max_dimension=settings.MAX_IMAGE_DIMENSION,
        )
    except ImageFetchError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    content = fetched.content
    extension = fetched.extension
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
