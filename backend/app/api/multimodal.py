"""
多模态处理路由
"""

import hashlib
import uuid
from pathlib import Path
from typing import Awaitable, Callable, Optional, TypeVar

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models.schemas import (
    ImageToTextRequest,
    ImageToTextUrlRequest,
    ResponseModel,
    StyleTransferRequest,
    TextToImageRequest,
    VisualQARequest,
    VisualQAUrlRequest,
)
from app.services.image_fetcher import ImageFetchError, fetch_public_image
from app.services.multimodal_service import MultimodalService

T = TypeVar("T")

router = APIRouter()
multimodal_service = MultimodalService()


@router.post("/multimodal/image-to-text", response_model=ResponseModel)
async def image_to_text(request: ImageToTextRequest):
    """图像转文本 - 生成描述、故事、诗歌等"""
    try:
        result = await multimodal_service.image_to_text(
            image_id=request.image_id,
            task=request.task,
            language=request.language,
            max_length=request.max_length,
            style=request.style
        )
        return ResponseModel(data=result, message="图像转文本完成")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/multimodal/text-to-image", response_model=ResponseModel)
async def text_to_image(request: TextToImageRequest):
    """文本转图像 - AI生成图像"""
    try:
        result = await multimodal_service.text_to_image(
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            size=request.size,
            style=request.style,
            n=request.n,
            quality=request.quality,
            seed=request.seed
        )
        return ResponseModel(data=result, message="图像生成任务已创建")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.post("/multimodal/visual-qa", response_model=ResponseModel)
async def visual_question_answering(request: VisualQARequest):
    """视觉问答 - 根据图像回答问题"""
    try:
        result = await multimodal_service.visual_qa(
            image_id=request.image_id,
            question=request.question,
            language=request.language,
            detail_level=request.detail_level
        )
        return ResponseModel(data=result, message="视觉问答完成")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"问答失败: {str(e)}")


@router.post("/multimodal/image-to-text-url", response_model=ResponseModel)
async def image_to_text_url(request: ImageToTextUrlRequest):
    """通过公开图片 URL 生成描述、故事、诗歌等"""
    try:
        result = await _run_with_url_image(
            request.image_url,
            lambda image_id: multimodal_service.image_to_text(
                image_id=image_id,
                task=request.task,
                language=request.language,
                max_length=request.max_length,
                style=request.style,
            ),
        )
        return ResponseModel(data=result, message="图像转文本完成")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}") from e


@router.post("/multimodal/visual-qa-url", response_model=ResponseModel)
async def visual_qa_url(request: VisualQAUrlRequest):
    """通过公开图片 URL 进行视觉问答"""
    try:
        result = await _run_with_url_image(
            request.image_url,
            lambda image_id: multimodal_service.visual_qa(
                image_id=image_id,
                question=request.question,
                language=request.language,
                detail_level=request.detail_level,
            ),
        )
        return ResponseModel(data=result, message="视觉问答完成")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"问答失败: {str(e)}") from e


async def _run_with_url_image(
    image_url: str,
    operation: Callable[[str], Awaitable[T]],
) -> T:
    try:
        fetched = await fetch_public_image(
            image_url,
            allowed_hosts=settings.ALLOWED_IMAGE_HOSTS,
            max_bytes=settings.AI_IMAGE_MAX_BYTES,
            max_dimension=settings.MAX_IMAGE_DIMENSION,
        )
    except ImageFetchError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    image_id = f"mm-{hashlib.sha256(fetched.content).hexdigest()[:12]}-{uuid.uuid4().hex[:6]}"
    path = Path(settings.UPLOAD_DIR) / f"{image_id}{fetched.extension}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(fetched.content)

    try:
        result = await operation(image_id)
    finally:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    result.image_id = image_url
    return result


@router.post("/multimodal/style-transfer", response_model=ResponseModel)
async def style_transfer(request: StyleTransferRequest):
    """风格迁移 - 将图像转换为指定风格"""
    try:
        result = await multimodal_service.style_transfer(
            image_id=request.image_id,
            target_style=request.target_style,
            intensity=request.intensity,
            preserve_content=request.preserve_content
        )
        return ResponseModel(data=result, message="风格迁移任务已创建")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"风格迁移失败: {str(e)}")


@router.get("/multimodal/tasks/{task_id}", response_model=ResponseModel)
async def get_task_status(task_id: str):
    """获取异步任务状态"""
    try:
        status = await multimodal_service.get_task_status(task_id)
        return ResponseModel(data=status, message="获取任务状态成功")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.post("/multimodal/image-edit", response_model=ResponseModel)
async def edit_image(image_id: str, edit_prompt: str, mask_area: Optional[str] = None):
    """图像编辑 - 根据描述编辑图像"""
    try:
        result = await multimodal_service.edit_image(image_id, edit_prompt, mask_area)
        return ResponseModel(data=result, message="图像编辑任务已创建")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"编辑失败: {str(e)}")
