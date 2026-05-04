"""
多模态处理服务
"""

import os
import uuid
from typing import Optional, List
import random

from app.core.config import settings
from app.models.schemas import (
    ImageToTextResponse, TextToImageResponse,
    VisualQAResponse, PromptStyle
)


class MultimodalService:
    """多模态处理服务"""
    
    def __init__(self):
        self.tasks = {}
        self.mock_mode = not settings.OPENAI_API_KEY
    
    async def image_to_text(
        self,
        image_id: str,
        task: str = "describe",
        language: str = "zh",
        max_length: int = 500,
        style: Optional[str] = None
    ) -> ImageToTextResponse:
        """图像转文本"""
        
        # 根据任务类型生成不同内容
        texts = {
            "describe": {
                "zh": "这张图片展示了一个美丽的场景。画面构图精妙，色彩搭配和谐，给人以深刻的视觉印象。",
                "en": "This image showcases a beautiful scene with exquisite composition and harmonious color matching."
            },
            "caption": {
                "zh": "一幅令人惊叹的艺术作品，展现了创作者独特的视角和精湛的技艺。",
                "en": "A stunning piece of artwork showcasing the creator's unique perspective and exquisite skill."
            },
            "story": {
                "zh": "在这个神奇的世界里，每一处细节都诉说着一个动人的故事。光线穿过云层，照亮了前方的道路...",
                "en": "In this magical world, every detail tells a captivating story. Light breaks through the clouds..."
            },
            "poem": {
                "zh": "画中世界美如画，\n色彩缤纷映朝霞。\n一笔一划皆是情，\n千言万语入梦家。",
                "en": "A world within the frame,\nColors dancing like flame.\nEach stroke a whispered tale,\nBeauty that will never pale."
            }
        }
        
        text_data = texts.get(task, texts["describe"])
        text = text_data.get(language, text_data["zh"])
        text_en = text_data["en"]
        
        return ImageToTextResponse(
            image_id=image_id,
            text=text,
            text_en=text_en,
            task=task,
            word_count=len(text),
            confidence=0.92
        )
    
    async def text_to_image(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        size: str = "1024x1024",
        style: Optional[str] = None,
        n: int = 1,
        quality: str = "standard",
        seed: Optional[int] = None
    ) -> TextToImageResponse:
        """文本转图像"""
        task_id = str(uuid.uuid4())
        
        # 创建模拟任务
        self.tasks[task_id] = {
            "status": "completed",
            "prompt": prompt,
            "progress": 100
        }
        
        # 生成模拟图像URL
        images = []
        for i in range(n):
            images.append({
                "url": f"/api/v1/multimodal/generated/{task_id}_{i}.png",
                "revised_prompt": prompt,
                "seed": seed or random.randint(1000, 999999)
            })
        
        return TextToImageResponse(
            task_id=task_id,
            status="completed",
            images=images,
            prompt_used=prompt,
            parameters={
                "size": size,
                "style": style,
                "quality": quality,
                "seed": seed
            }
        )
    
    async def visual_qa(
        self,
        image_id: str,
        question: str,
        language: str = "zh",
        detail_level: str = "auto"
    ) -> VisualQAResponse:
        """视觉问答"""
        
        # 模拟问答
        qa_pairs = {
            "zh": [
                ("这是什么？", "这是一张展示自然风景的照片。"),
                ("图里有什么？", "图中可以看到山脉、湖泊和天空。"),
                ("这是什么颜色？", "画面以蓝色和绿色为主色调。"),
                ("这是在什么地方？", "这看起来像是一个国家公园或自然保护区。")
            ],
            "en": [
                ("What is this?", "This is a photo showing a natural landscape."),
                ("What's in the picture?", "The picture shows mountains, a lake, and the sky."),
                ("What color is this?", "The image features blue and green as main colors."),
                ("Where is this place?", "This looks like a national park or nature reserve.")
            ]
        }
        
        # 找到最接近的问题或使用默认回答
        pairs = qa_pairs.get(language, qa_pairs["zh"])
        answer = pairs[0][1]  # 默认使用第一个回答
        answer_en = qa_pairs["en"][0][1]
        
        # 简单匹配
        for q, a in pairs:
            if any(keyword in question for keyword in q[:5]):
                answer = a
                break
        
        return VisualQAResponse(
            image_id=image_id,
            question=question,
            answer=answer,
            answer_en=answer_en,
            confidence=0.88,
            reasoning="基于图像内容分析得出的结论"
        )
    
    async def style_transfer(
        self,
        image_id: str,
        target_style: PromptStyle,
        intensity: float = 0.8,
        preserve_content: bool = True
    ) -> dict:
        """风格迁移"""
        task_id = str(uuid.uuid4())
        
        self.tasks[task_id] = {
            "status": "completed",
            "style": target_style.value,
            "intensity": intensity
        }
        
        return {
            "task_id": task_id,
            "status": "completed",
            "original_image_id": image_id,
            "styled_image_url": f"/api/v1/multimodal/styled/{task_id}.png",
            "style_applied": target_style.value,
            "intensity": intensity,
            "preserve_content": preserve_content
        }
    
    async def edit_image(
        self,
        image_id: str,
        edit_prompt: str,
        mask_area: Optional[str] = None
    ) -> dict:
        """图像编辑"""
        task_id = str(uuid.uuid4())
        
        self.tasks[task_id] = {
            "status": "completed",
            "edit_prompt": edit_prompt
        }
        
        return {
            "task_id": task_id,
            "status": "completed",
            "original_image_id": image_id,
            "edited_image_url": f"/api/v1/multimodal/edited/{task_id}.png",
            "edit_prompt": edit_prompt,
            "mask_area": mask_area
        }
    
    async def get_task_status(self, task_id: str) -> dict:
        """获取任务状态"""
        task = self.tasks.get(task_id)
        if not task:
            return {"task_id": task_id, "status": "not_found"}
        
        return {
            "task_id": task_id,
            **task
        }
