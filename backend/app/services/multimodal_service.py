"""
多模态处理服务。

真实模式使用 OpenAI-compatible 视觉/图像生成接口；没有 Key 或调用失败时，
回退到原有的演示数据，保证接口可用。
"""

from __future__ import annotations

import base64
import logging
import random
import uuid
from typing import Any, Dict, List, Optional

from PIL import Image

from app.core.config import settings
from app.models.schemas import (
    ImageToTextResponse,
    PromptStyle,
    TextToImageResponse,
    VisualQAResponse,
)
from app.services.image_service import ImageService
from app.services.llm_client import LLMClient, LLMError

logger = logging.getLogger(__name__)

MIME_BY_FORMAT = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
    "GIF": "image/gif",
    "BMP": "image/bmp",
}


class MultimodalService:
    """多模态处理服务（真实模型 + mock 回退）。"""

    def __init__(
        self,
        llm: Optional[LLMClient] = None,
        image_service: Optional[ImageService] = None,
    ) -> None:
        self.llm = llm or LLMClient()
        self.image_service = image_service or ImageService()
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.mock_mode = not self.llm.enabled

    async def image_to_text(
        self,
        image_id: str,
        task: str = "describe",
        language: str = "zh",
        max_length: int = 500,
        style: Optional[str] = None,
    ) -> ImageToTextResponse:
        if self.llm.enabled:
            try:
                data_url = self._image_data_url(image_id)
                prompt = (
                    "Analyze the image and return strict JSON with keys: "
                    "text (string, in the requested language), text_en (string), "
                    "confidence (0-1), reasoning (string).\n"
                    f"Task: {task}. Language: {language}. Style: {style or 'natural'}. "
                    f"Keep the text under {max_length} characters. "
                    + {
                        "describe": "Write a detailed visual description.",
                        "caption": "Write a short caption.",
                        "story": "Write a short story inspired by the image.",
                        "poem": "Write a short poem inspired by the image.",
                    }.get(task, "Describe the image.")
                )
                data = await self.llm.chat_json(
                    [
                        {
                            "role": "system",
                            "content": "You are a careful multimodal image assistant. Return JSON only.",
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": data_url}},
                            ],
                        },
                    ],
                    model=self.llm.vision_model,
                    temperature=0.7,
                    max_tokens=1000,
                )
                text = str(data.get("text") or data.get("caption") or "").strip()
                if text:
                    return ImageToTextResponse(
                        image_id=image_id,
                        text=text,
                        text_en=str(data.get("text_en") or "").strip() or None,
                        task=task,
                        word_count=len(text),
                        confidence=max(0.0, min(1.0, float(data.get("confidence", 0.8)))),
                        provider="openai",
                    )
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实图像转文本失败，回退 mock: %s", error)

        return self._mock_image_to_text(image_id, task, language)

    async def text_to_image(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        size: str = "1024x1024",
        style: Optional[str] = None,
        n: int = 1,
        quality: str = "standard",
        seed: Optional[int] = None,
    ) -> TextToImageResponse:
        task_id = str(uuid.uuid4())

        if self.llm.enabled:
            try:
                generation_prompt = prompt
                if negative_prompt:
                    generation_prompt += f". Avoid: {negative_prompt}"
                items = await self.llm.generate_image(
                    generation_prompt,
                    model=settings.IMAGE_GEN_MODEL,
                    size=size,
                    quality=quality,
                    n=n,
                )
                images: List[Dict[str, Any]] = []
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    url = item.get("url")
                    if not url and item.get("b64_json"):
                        url = f"data:image/png;base64,{item['b64_json']}"
                    if url:
                        images.append(
                            {
                                "url": url,
                                "revised_prompt": item.get("revised_prompt") or prompt,
                                "seed": seed,
                            }
                        )
                if images:
                    result = TextToImageResponse(
                        task_id=task_id,
                        status="completed",
                        images=images,
                        prompt_used=prompt,
                        parameters={
                            "size": size,
                            "style": style,
                            "quality": quality,
                            "seed": seed,
                            "model": settings.IMAGE_GEN_MODEL,
                        },
                        provider="openai",
                    )
                    self.tasks[task_id] = result.model_dump()
                    return result
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实文生图失败，回退 mock: %s", error)

        return self._mock_text_to_image(task_id, prompt, size, style, n, quality, seed)

    async def visual_qa(
        self,
        image_id: str,
        question: str,
        language: str = "zh",
        detail_level: str = "auto",
    ) -> VisualQAResponse:
        if self.llm.enabled:
            try:
                data_url = self._image_data_url(image_id)
                prompt = (
                    "Answer the question about this image. Return strict JSON with keys: "
                    "answer (string, requested language), answer_en (string), "
                    "confidence (0-1), reasoning (string).\n"
                    f"Question: {question}\nLanguage: {language}\nDetail: {detail_level}"
                )
                data = await self.llm.chat_json(
                    [
                        {
                            "role": "system",
                            "content": "You answer questions about images accurately. Return JSON only.",
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {"type": "image_url", "image_url": {"url": data_url}},
                            ],
                        },
                    ],
                    model=self.llm.vision_model,
                    temperature=0.2,
                    max_tokens=700,
                )
                answer = str(data.get("answer") or "").strip()
                if answer:
                    return VisualQAResponse(
                        image_id=image_id,
                        question=question,
                        answer=answer,
                        answer_en=str(data.get("answer_en") or "").strip() or None,
                        confidence=max(0.0, min(1.0, float(data.get("confidence", 0.8)))),
                        reasoning=str(data.get("reasoning") or "").strip() or None,
                        provider="openai",
                    )
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实视觉问答失败，回退 mock: %s", error)

        return self._mock_visual_qa(image_id, question, language)

    async def style_transfer(
        self,
        image_id: str,
        target_style: PromptStyle,
        intensity: float = 0.8,
        preserve_content: bool = True,
    ) -> dict:
        """风格迁移尚未接入真实图像编辑模型，返回明确的 mock 结果。"""
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "status": "completed",
            "style": target_style.value,
            "intensity": intensity,
            "provider": "mock",
        }
        return {
            "task_id": task_id,
            "status": "completed",
            "original_image_id": image_id,
            "styled_image_url": f"/api/v1/multimodal/styled/{task_id}.png",
            "style_applied": target_style.value,
            "intensity": intensity,
            "preserve_content": preserve_content,
            "provider": "mock",
            "note": "风格迁移尚未接入真实图像编辑模型；此 URL 为演示占位。",
        }

    async def edit_image(
        self,
        image_id: str,
        edit_prompt: str,
        mask_area: Optional[str] = None,
    ) -> dict:
        """图像编辑尚未接入真实编辑模型，返回明确的 mock 结果。"""
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "status": "completed",
            "edit_prompt": edit_prompt,
            "provider": "mock",
        }
        return {
            "task_id": task_id,
            "status": "completed",
            "original_image_id": image_id,
            "edited_image_url": f"/api/v1/multimodal/edited/{task_id}.png",
            "edit_prompt": edit_prompt,
            "mask_area": mask_area,
            "provider": "mock",
            "note": "图像编辑尚未接入真实编辑模型；此 URL 为演示占位。",
        }

    async def get_task_status(self, task_id: str) -> dict:
        task = self.tasks.get(task_id)
        if not task:
            return {"task_id": task_id, "status": "not_found"}
        return {"task_id": task_id, **task}

    def _image_data_url(self, image_id: str) -> str:
        path = self.image_service.find_image(image_id)
        if not path:
            raise FileNotFoundError(f"图片不存在: {image_id}")
        with Image.open(path) as image:
            image_format = (image.format or "JPEG").upper()
        with open(path, "rb") as file:
            encoded = base64.b64encode(file.read()).decode("ascii")
        mime = MIME_BY_FORMAT.get(image_format, "image/jpeg")
        return f"data:{mime};base64,{encoded}"

    def _mock_image_to_text(
        self, image_id: str, task: str, language: str
    ) -> ImageToTextResponse:
        texts = {
            "describe": {
                "zh": "这张图片展示了一个美丽的场景。画面构图精妙，色彩搭配和谐，给人以深刻的视觉印象。",
                "en": "This image showcases a beautiful scene with exquisite composition and harmonious color matching.",
            },
            "caption": {
                "zh": "一幅令人惊叹的艺术作品，展现了创作者独特的视角和精湛的技艺。",
                "en": "A stunning piece of artwork showcasing the creator's unique perspective and exquisite skill.",
            },
            "story": {
                "zh": "在这个神奇的世界里，每一处细节都诉说着一个动人的故事。光线穿过云层，照亮了前方的道路...",
                "en": "In this magical world, every detail tells a captivating story. Light breaks through the clouds...",
            },
            "poem": {
                "zh": "画中世界美如画，\n色彩缤纷映朝霞。\n一笔一划皆是情，\n千言万语入梦家。",
                "en": "A world within the frame,\nColors dancing like flame.\nEach stroke a whispered tale,\nBeauty that will never pale.",
            },
        }
        text_data = texts.get(task, texts["describe"])
        text = text_data.get(language, text_data["zh"])
        return ImageToTextResponse(
            image_id=image_id,
            text=text,
            text_en=text_data["en"],
            task=task,
            word_count=len(text),
            confidence=0.92,
            provider="mock",
        )

    def _mock_text_to_image(
        self,
        task_id: str,
        prompt: str,
        size: str,
        style: Optional[str],
        n: int,
        quality: str,
        seed: Optional[int],
    ) -> TextToImageResponse:
        self.tasks[task_id] = {
            "status": "completed",
            "prompt": prompt,
            "progress": 100,
            "provider": "mock",
        }
        images = [
            {
                "url": f"/api/v1/multimodal/generated/{task_id}_{index}.png",
                "revised_prompt": prompt,
                "seed": seed or random.randint(1000, 999999),
            }
            for index in range(n)
        ]
        return TextToImageResponse(
            task_id=task_id,
            status="completed",
            images=images,
            prompt_used=prompt,
            parameters={"size": size, "style": style, "quality": quality, "seed": seed},
            provider="mock",
        )

    def _mock_visual_qa(
        self, image_id: str, question: str, language: str
    ) -> VisualQAResponse:
        qa_pairs = {
            "zh": [
                ("这是什么？", "这是一张展示自然风景的照片。"),
                ("图里有什么？", "图中可以看到山脉、湖泊和天空。"),
                ("这是什么颜色？", "画面以蓝色和绿色为主色调。"),
                ("这是在什么地方？", "这看起来像是一个国家公园或自然保护区。"),
            ],
            "en": [
                ("What is this?", "This is a photo showing a natural landscape."),
                ("What's in the picture?", "The picture shows mountains, a lake, and the sky."),
                ("What color is this?", "The image features blue and green as main colors."),
                ("Where is this place?", "This looks like a national park or nature reserve."),
            ],
        }
        pairs = qa_pairs.get(language, qa_pairs["zh"])
        answer = pairs[0][1]
        answer_en = qa_pairs["en"][0][1]
        for question_text, candidate in pairs:
            if any(keyword in question for keyword in question_text[:5]):
                answer = candidate
                break
        return VisualQAResponse(
            image_id=image_id,
            question=question,
            answer=answer,
            answer_en=answer_en,
            confidence=0.88,
            reasoning="基于演示数据的回答；配置 AI_PROVIDER/OPENAI_API_KEY 后可获得真实视觉问答。",
            provider="mock",
        )
