"""
多模态处理路由
"""

from fastapi import APIRouter, HTTPException
from typing import Optional

from app.models.schemas import (
    ResponseModel, ImageToTextRequest, ImageToTextResponse,
    TextToImageRequest, TextToImageResponse,
    VisualQARequest, VisualQAResponse,
    StyleTransferRequest
)
from app.services.multimodal_service import MultimodalService

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
