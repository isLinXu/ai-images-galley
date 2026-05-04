"""
AI分析路由
"""

from fastapi import APIRouter, HTTPException
from typing import List

from app.models.schemas import (
    ResponseModel, AnalysisRequest, AnalysisResult,
    ClassificationResult, DetectionResult, CaptionResult, ColorInfo
)
from app.services.ai_service import AIService

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.post("/analysis/classify", response_model=ResponseModel)
async def classify_image(image_id: str, top_k: int = 5):
    """图像分类"""
    try:
        classifications = await ai_service.classify_image(image_id, top_k)
        return ResponseModel(
            data={"image_id": image_id, "classifications": classifications},
            message="图像分类完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分类失败: {str(e)}")


@router.post("/analysis/detect", response_model=ResponseModel)
async def detect_objects(image_id: str, confidence_threshold: float = 0.3):
    """物体检测"""
    try:
        detections = await ai_service.detect_objects(image_id, confidence_threshold)
        return ResponseModel(
            data={"image_id": image_id, "detections": detections},
            message="物体检测完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"检测失败: {str(e)}")


@router.post("/analysis/caption", response_model=ResponseModel)
async def generate_caption(image_id: str, language: str = "zh", style: str = "descriptive"):
    """生成图像描述"""
    try:
        caption = await ai_service.generate_caption(image_id, language, style)
        return ResponseModel(
            data={"image_id": image_id, "caption": caption},
            message="图像描述生成完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"描述生成失败: {str(e)}")


@router.post("/analysis/colors", response_model=ResponseModel)
async def extract_colors(image_id: str, num_colors: int = 5):
    """提取主色调"""
    try:
        colors = await ai_service.extract_colors(image_id, num_colors)
        return ResponseModel(
            data={"image_id": image_id, "colors": colors},
            message="颜色提取完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"颜色提取失败: {str(e)}")


@router.post("/analysis/tags", response_model=ResponseModel)
async def generate_tags(image_id: str, max_tags: int = 10):
    """生成智能标签"""
    try:
        tags = await ai_service.generate_tags(image_id, max_tags)
        return ResponseModel(
            data={"image_id": image_id, "tags": tags},
            message="标签生成完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"标签生成失败: {str(e)}")
