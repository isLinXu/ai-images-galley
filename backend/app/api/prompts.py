"""
Prompt智能路由
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional

from app.models.schemas import (
    ResponseModel, PromptOptimizeRequest, PromptOptimizeResponse,
    PromptTemplate, PromptStyle
)
from app.services.prompt_service import PromptService

router = APIRouter()
prompt_service = PromptService()


@router.post("/prompts/optimize", response_model=ResponseModel)
async def optimize_prompt(request: PromptOptimizeRequest):
    """优化Prompt"""
    try:
        result = await prompt_service.optimize_prompt(request)
        return ResponseModel(data=result, message="Prompt优化完成")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"优化失败: {str(e)}")


@router.post("/prompts/translate", response_model=ResponseModel)
async def translate_prompt(prompt: str, target_language: str = "en"):
    """翻译Prompt"""
    try:
        translated = await prompt_service.translate_prompt(prompt, target_language)
        return ResponseModel(
            data={"original": prompt, "translated": translated, "target_language": target_language},
            message="Prompt翻译完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"翻译失败: {str(e)}")


@router.get("/prompts/templates", response_model=ResponseModel)
async def get_templates(category: Optional[str] = None, style: Optional[PromptStyle] = None):
    """获取Prompt模板列表"""
    templates = prompt_service.get_templates(category, style)
    return ResponseModel(data=templates, message="获取模板列表成功")


@router.get("/prompts/templates/{template_id}", response_model=ResponseModel)
async def get_template(template_id: str):
    """获取单个Prompt模板"""
    template = prompt_service.get_template_by_id(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return ResponseModel(data=template, message="获取模板成功")


@router.post("/prompts/templates/{template_id}/render", response_model=ResponseModel)
async def render_template(template_id: str, variables: dict):
    """渲染Prompt模板"""
    try:
        rendered = prompt_service.render_template(template_id, variables)
        return ResponseModel(data={"rendered": rendered}, message="模板渲染成功")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"渲染失败: {str(e)}")


@router.post("/prompts/generate-negative", response_model=ResponseModel)
async def generate_negative_prompt(prompt: str, intensity: str = "medium"):
    """生成负面Prompt"""
    try:
        negative_prompt = await prompt_service.generate_negative_prompt(prompt, intensity)
        return ResponseModel(
            data={"prompt": prompt, "negative_prompt": negative_prompt},
            message="负面Prompt生成完成"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成失败: {str(e)}")


@router.post("/prompts/analyze", response_model=ResponseModel)
async def analyze_prompt(prompt: str):
    """分析Prompt质量"""
    try:
        analysis = await prompt_service.analyze_prompt_quality(prompt)
        return ResponseModel(data=analysis, message="Prompt分析完成")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")


@router.get("/prompts/styles", response_model=ResponseModel)
async def get_styles():
    """获取所有可用风格"""
    styles = [
        {"id": style.value, "name": style.name, "description": prompt_service.get_style_description(style)}
        for style in PromptStyle
    ]
    return ResponseModel(data=styles, message="获取风格列表成功")
