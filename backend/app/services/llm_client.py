"""
OpenAI-compatible 模型客户端。

支持任意兼容 OpenAI Chat Completions / Images API 的服务（OpenAI、Azure
OpenAI 网关、Groq、Ollama 的 /v1 接口等）。未配置 API Key 时 `enabled`
为 False，上层服务会自动回退到 mock 演示数据。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """模型调用或响应解析失败。"""


class LLMClient:
    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        vision_model: Optional[str] = None,
        timeout: Optional[float] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.OPENAI_API_KEY
        self.base_url = (base_url or settings.OPENAI_BASE_URL).rstrip("/")
        self.model = model or settings.OPENAI_MODEL
        self.vision_model = vision_model or settings.VISION_MODEL
        self.timeout = timeout or settings.AI_TIMEOUT_SECONDS
        self.transport = transport

    @property
    def enabled(self) -> bool:
        provider = (settings.AI_PROVIDER or "auto").lower()
        if provider == "mock":
            return False
        return bool(self.api_key)

    @property
    def mode(self) -> str:
        return "openai" if self.enabled else "mock"

    async def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not self.enabled:
            raise LLMError("未配置 AI API Key")

        url = f"{self.base_url}/{path.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout),
                transport=self.transport,
                follow_redirects=False,
            ) as client:
                response = await client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as error:
            raise LLMError(f"模型请求失败: {error}") from error

        if response.status_code >= 400:
            detail = response.text[:500]
            raise LLMError(f"模型返回 HTTP {response.status_code}: {detail}")

        try:
            return response.json()
        except ValueError as error:
            raise LLMError("模型返回不是合法 JSON") from error

    async def chat_json(
        self,
        messages: List[Dict[str, Any]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> Dict[str, Any]:
        """请求 JSON 响应，兼容不支持 response_format 的提供方。"""
        payload: Dict[str, Any] = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }

        try:
            data = await self._post("chat/completions", payload)
        except LLMError as error:
            # 部分兼容服务不支持 response_format，去掉后重试一次
            if "HTTP 400" not in str(error) and "HTTP 404" not in str(error):
                raise
            payload.pop("response_format", None)
            data = await self._post("chat/completions", payload)

        content = self._extract_content(data)
        return self.parse_json(content)

    async def chat_text(
        self,
        messages: List[Dict[str, Any]],
        *,
        model: Optional[str] = None,
        temperature: float = 0.4,
        max_tokens: int = 1000,
    ) -> str:
        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        data = await self._post("chat/completions", payload)
        return self._extract_content(data)

    async def generate_image(
        self,
        prompt: str,
        *,
        model: Optional[str] = None,
        size: str = "1024x1024",
        quality: str = "standard",
        n: int = 1,
    ) -> List[Dict[str, Any]]:
        payload = {
            "model": model or settings.IMAGE_GEN_MODEL,
            "prompt": prompt,
            "size": size,
            "quality": quality,
            "n": n,
        }
        data = await self._post("images/generations", payload)
        items = data.get("data")
        if not isinstance(items, list):
            raise LLMError("图像生成响应格式异常")
        return items

    @staticmethod
    def _extract_content(data: Dict[str, Any]) -> str:
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LLMError("模型响应缺少 choices[0].message.content") from error

        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = [item.get("text", "") for item in content if isinstance(item, dict)]
            return "\n".join(part for part in parts if part)
        raise LLMError("模型响应 content 类型不受支持")

    @staticmethod
    def parse_json(content: str) -> Dict[str, Any]:
        text = (content or "").strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end <= start:
                raise LLMError("模型响应中未找到 JSON 对象") from None
            try:
                parsed = json.loads(text[start : end + 1])
            except json.JSONDecodeError as error:
                raise LLMError(f"模型 JSON 解析失败: {error}") from error

        if not isinstance(parsed, dict):
            raise LLMError("模型 JSON 顶层必须是对象")
        return parsed
