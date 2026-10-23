"""
AI 分析服务

优先调用 OpenAI-compatible 视觉模型；没有 API Key、调用失败或返回不可解析时，
自动回退到原有的 mock 演示数据，保证接口结构稳定。
"""

from __future__ import annotations

import base64
import logging
import random
import time
from typing import Any, Dict, List, Optional

from PIL import Image

from app.core.config import settings
from app.models.schemas import (
    AnalysisResult,
    CaptionResult,
    ClassificationResult,
    ColorInfo,
    DetectionResult,
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


class AIService:
    """图像分析服务（真实模型 + mock 回退）。"""

    def __init__(
        self,
        llm: Optional[LLMClient] = None,
        image_service: Optional[ImageService] = None,
    ) -> None:
        self.llm = llm or LLMClient()
        self.image_service = image_service or ImageService()
        self.model_version = "2.0.0"
        self.mock_mode = not self.llm.enabled
        self._cache: Dict[str, tuple[float, Dict[str, Any]]] = {}

    @property
    def mode(self) -> str:
        return self.llm.mode

    async def analyze_image(
        self,
        image_id: str,
        analysis_types: List,
        language: str = "zh",
        confidence_threshold: float = 0.3,
    ) -> AnalysisResult:
        """综合图像分析"""
        start_time = time.time()

        if self.llm.enabled:
            try:
                data = await self._vision_analysis(image_id, language)
                result = await self._build_result(
                    image_id,
                    data,
                    language,
                    confidence_threshold,
                    provider="openai",
                    model_version=self.llm.vision_model,
                )
                result.processing_time = (time.time() - start_time) * 1000
                return result
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, KeyError, TypeError) as error:
                logger.warning("真实 AI 分析失败，回退 mock: %s", error)

        result = await self._mock_analyze(image_id, analysis_types, language, confidence_threshold)
        result.processing_time = (time.time() - start_time) * 1000
        return result

    async def classify_image(self, image_id: str, top_k: int = 5) -> List[ClassificationResult]:
        if self.llm.enabled:
            try:
                data = await self._vision_analysis(image_id, "zh")
                return self._to_classifications(data.get("classifications"), top_k)
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实图像分类失败，回退 mock: %s", error)
        return self._mock_classifications(top_k)

    async def detect_objects(
        self, image_id: str, confidence_threshold: float = 0.3
    ) -> List[DetectionResult]:
        if self.llm.enabled:
            try:
                data = await self._vision_analysis(image_id, "zh")
                return self._to_detections(data.get("detections"), confidence_threshold)
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实物体检测失败，回退 mock: %s", error)
        return self._mock_detections(confidence_threshold)

    async def generate_caption(
        self, image_id: str, language: str = "zh", style: str = "descriptive"
    ) -> CaptionResult:
        if self.llm.enabled:
            try:
                data = await self._vision_analysis(image_id, language)
                caption = str(data.get("caption") or "").strip()
                if caption:
                    return CaptionResult(
                        caption=caption,
                        caption_zh=caption if language == "zh" else None,
                        confidence=self._clamp(data.get("caption_confidence", 0.8)),
                        style=style,
                    )
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实图像描述失败，回退 mock: %s", error)
        return self._mock_caption(language, style)

    async def extract_colors(self, image_id: str, num_colors: int = 5) -> List[ColorInfo]:
        path = self.image_service.find_image(image_id)
        if path:
            try:
                raw_colors = await self.image_service.extract_colors(path, num_colors)
                colors = [
                    ColorInfo(
                        hex=color.get("hex", "#9ca3af"),
                        rgb=color.get("rgb", [156, 163, 175]),
                        percentage=float(color.get("percentage", 0)),
                        name=color.get("name"),
                    )
                    for color in raw_colors
                ]
                if colors:
                    return colors
            except Exception as error:  # noqa: BLE001 - 颜色提取失败不应阻断接口
                logger.warning("颜色提取失败，回退 mock: %s", error)
        return self._mock_colors(num_colors)

    async def generate_tags(self, image_id: str, max_tags: int = 10) -> List[str]:
        if self.llm.enabled:
            try:
                data = await self._vision_analysis(image_id, "zh")
                tags = self._to_tags(data.get("tags"), max_tags)
                if tags:
                    return tags
            except FileNotFoundError:
                raise
            except (LLMError, ValueError, TypeError) as error:
                logger.warning("真实标签生成失败，回退 mock: %s", error)
        return random.sample(
            [
                "风景",
                "自然",
                "山脉",
                "湖泊",
                "天空",
                "云彩",
                "建筑",
                "城市",
                "街道",
                "人物",
                "动物",
                "植物",
                "日落",
                "日出",
                "夜景",
                "白天",
                "室内",
                "户外",
            ],
            min(max_tags, 18),
        )

    async def _build_result(
        self,
        image_id: str,
        data: Dict[str, Any],
        language: str,
        confidence_threshold: float,
        *,
        provider: str,
        model_version: str,
    ) -> AnalysisResult:
        classifications = self._to_classifications(data.get("classifications"), 5)
        detections = self._to_detections(data.get("detections"), confidence_threshold)
        tags = self._to_tags(data.get("tags"), 10)

        if not tags:
            tags = [item.label_zh or item.label for item in classifications[:5]]
        if not tags:
            tags = [item.label_zh or item.label for item in detections[:5]]

        caption_text = str(data.get("caption") or "").strip()
        caption = None
        if caption_text:
            caption = CaptionResult(
                caption=caption_text,
                caption_zh=caption_text if language == "zh" else None,
                confidence=self._clamp(data.get("caption_confidence", 0.8)),
                style="descriptive",
            )

        colors = await self.extract_colors(image_id, 5)
        scene_type = str(data.get("scene_type") or "").strip() or self._detect_scene_type(
            classifications, tags
        )

        return AnalysisResult(
            image_id=image_id,
            classifications=classifications,
            detections=detections,
            caption=caption,
            tags=tags,
            colors=colors,
            scene_type=scene_type,
            processing_time=0,
            model_version=model_version,
            provider=provider,
        )

    async def _vision_analysis(self, image_id: str, language: str) -> Dict[str, Any]:
        """调用视觉模型并缓存结果。"""
        path = self.image_service.find_image(image_id)
        if not path:
            raise FileNotFoundError(f"图片不存在: {image_id}")

        cache_key = f"{image_id}:{language}:{path}"
        cached = self._cache.get(cache_key)
        if cached and time.time() - cached[0] < settings.AI_CACHE_TTL_SECONDS:
            return cached[1]

        with Image.open(path) as image:
            image_format = (image.format or "JPEG").upper()
            width, height = image.size
        mime = MIME_BY_FORMAT.get(image_format, "image/jpeg")
        with open(path, "rb") as file:
            encoded = base64.b64encode(file.read()).decode("ascii")

        prompt = (
            "Analyze this image for a smart photo gallery. "
            f"Reply in language: {language}. Return ONLY a JSON object, no markdown, with:\n"
            '{"caption": "one concise sentence", "caption_confidence": 0.0-1.0, '
            '"tags": ["up to 10 short tags"], '
            '"classifications": [{"label":"english label","label_zh":"中文标签","confidence":0.0-1.0,"category":"general"}], '
            '"detections": [{"label":"english object","label_zh":"中文对象","confidence":0.0-1.0,"bbox":[x,y,width,height]}], '
            '"scene_type": "landscape|urban|portrait|nature|indoor|general"}.\n'
            f"Image dimensions: {width}x{height}. "
            "Use confidence 0.5-0.95, do not invent objects that are not visible. "
            "For bbox, use approximate pixel coordinates; use [0,0,0,0] if unknown."
        )
        messages = [
            {
                "role": "system",
                "content": "You are a precise image analysis engine. Return strict JSON only.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}},
                ],
            },
        ]

        data = await self.llm.chat_json(
            messages,
            model=self.llm.vision_model,
            temperature=0.1,
            max_tokens=900,
        )
        if not isinstance(data, dict):
            raise LLMError("视觉模型返回的数据不是对象")

        self._cache[cache_key] = (time.time(), data)
        if len(self._cache) > 500:
            self._cache.clear()
        return data

    def _to_classifications(self, items: Any, top_k: int) -> List[ClassificationResult]:
        if not isinstance(items, list):
            return []
        results: List[ClassificationResult] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or item.get("name") or "").strip()
            if not label:
                continue
            results.append(
                ClassificationResult(
                    label=label,
                    label_zh=str(item.get("label_zh") or "").strip() or None,
                    confidence=self._clamp(item.get("confidence", 0.5)),
                    category=str(item.get("category") or "general"),
                )
            )
        results.sort(key=lambda item: item.confidence, reverse=True)
        return results[: max(1, top_k)]

    def _to_detections(self, items: Any, threshold: float) -> List[DetectionResult]:
        if not isinstance(items, list):
            return []
        results: List[DetectionResult] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or item.get("name") or "").strip()
            if not label:
                continue
            confidence = self._clamp(item.get("confidence", 0.5))
            if confidence < threshold:
                continue
            bbox = item.get("bbox")
            if not isinstance(bbox, list) or len(bbox) != 4:
                bbox = [0, 0, 0, 0]
            bbox = [float(value) for value in bbox]
            results.append(
                DetectionResult(
                    label=label,
                    label_zh=str(item.get("label_zh") or "").strip() or None,
                    confidence=confidence,
                    bbox=bbox,
                )
            )
        results.sort(key=lambda item: item.confidence, reverse=True)
        return results

    def _to_tags(self, items: Any, max_tags: int) -> List[str]:
        if not isinstance(items, list):
            return []
        tags: List[str] = []
        for item in items:
            text = str(item).strip() if not isinstance(item, dict) else str(
                item.get("label_zh") or item.get("label") or ""
            ).strip()
            if text and text not in tags:
                tags.append(text)
        return tags[:max_tags]

    async def _mock_analyze(
        self,
        image_id: str,
        analysis_types: List,
        language: str,
        confidence_threshold: float,
    ) -> AnalysisResult:
        type_values = [
            item.value if hasattr(item, "value") else str(item) for item in analysis_types
        ]
        all_types = "all" in type_values
        classifications = self._mock_classifications(5) if all_types else []
        detections = self._mock_detections(confidence_threshold) if all_types else []
        caption = self._mock_caption(language) if all_types else None
        colors = await self.extract_colors(image_id, 5) if all_types else []
        tags = (
            random.sample(
                [
                    "风景",
                    "自然",
                    "山脉",
                    "湖泊",
                    "天空",
                    "建筑",
                    "城市",
                    "人物",
                    "动物",
                    "植物",
                ],
                6,
            )
            if all_types
            else []
        )
        return AnalysisResult(
            image_id=image_id,
            classifications=classifications,
            detections=detections,
            caption=caption,
            tags=tags,
            colors=colors,
            scene_type=self._detect_scene_type(classifications, tags),
            processing_time=0,
            model_version=f"{self.model_version}-mock",
            provider="mock",
        )

    def _mock_classifications(self, top_k: int) -> List[ClassificationResult]:
        categories = [
            ("风景", "landscape", 0.95),
            ("自然", "nature", 0.88),
            ("建筑", "architecture", 0.72),
            ("人物", "person", 0.65),
            ("动物", "animal", 0.45),
        ]
        return [
            ClassificationResult(
                label=label,
                label_zh=label_zh,
                confidence=confidence,
                category="general",
            )
            for label_zh, label, confidence in categories[:top_k]
        ]

    def _mock_detections(self, confidence_threshold: float) -> List[DetectionResult]:
        objects = [
            ("person", "人物", 0.92, [100, 200, 150, 300]),
            ("car", "汽车", 0.78, [400, 350, 200, 150]),
            ("tree", "树木", 0.85, [50, 100, 80, 200]),
        ]
        return [
            DetectionResult(label=label, label_zh=label_zh, confidence=confidence, bbox=bbox)
            for label, label_zh, confidence, bbox in objects
            if confidence >= confidence_threshold
        ]

    def _mock_caption(self, language: str, style: str = "descriptive") -> CaptionResult:
        captions_zh = [
            "一幅美丽的自然风景照片，展示了山脉和湖泊的壮丽景色",
            "一张充满活力的城市街景，展示了现代建筑与人群的互动",
            "一张温馨的室内照片，展示了精心布置的居家环境",
        ]
        captions_en = [
            "A beautiful landscape photo showing majestic mountains and a serene lake",
            "A vibrant city street scene showing modern architecture and crowd interaction",
            "A cozy indoor photo showing a carefully arranged home environment",
        ]
        index = random.randrange(len(captions_zh))
        return CaptionResult(
            caption=captions_en[index] if language == "en" else captions_zh[index],
            caption_zh=captions_zh[index],
            confidence=0.89,
            style=style,
        )

    def _mock_colors(self, num_colors: int) -> List[ColorInfo]:
        colors = [
            ("#3B82F6", [59, 130, 246], 35.2, "蓝色"),
            ("#10B981", [16, 185, 129], 28.5, "绿色"),
            ("#F59E0B", [245, 158, 11], 18.3, "橙色"),
            ("#EF4444", [239, 68, 68], 12.1, "红色"),
            ("#8B5CF6", [139, 92, 246], 5.9, "紫色"),
        ]
        return [
            ColorInfo(hex=hex_value, rgb=rgb, percentage=percentage, name=name)
            for hex_value, rgb, percentage, name in colors[:num_colors]
        ]

    def _detect_scene_type(
        self, classifications: List[ClassificationResult], tags: List[str]
    ) -> str:
        scene_keywords = {
            "landscape": ["风景", "自然", "山脉", "湖泊", "landscape", "nature"],
            "urban": ["建筑", "城市", "街道", "architecture", "city"],
            "portrait": ["人物", "肖像", "person", "portrait"],
            "nature": ["动物", "植物", "自然", "animal", "plant"],
        }
        for scene_type, keywords in scene_keywords.items():
            if any(tag in keywords for tag in tags):
                return scene_type
        return "general"

    @staticmethod
    def _clamp(value: Any, minimum: float = 0.0, maximum: float = 1.0) -> float:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = 0.5
        return max(minimum, min(maximum, numeric))
