"""真实 AI 抽象层测试：使用 Fake LLM，不产生任何外部网络请求。"""

import asyncio
import io
import json

from fastapi.testclient import TestClient
from PIL import Image

from app.api import analysis as analysis_api
from app.main import app
from app.models.schemas import AnalysisType, PromptOptimizeRequest
from app.services.ai_service import AIService
from app.services.multimodal_service import MultimodalService
from app.services.prompt_service import PromptService


def png_bytes(color=(30, 120, 220), size=(320, 240)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, "PNG")
    return buffer.getvalue()


class FakeLLM:
    enabled = True
    mode = "openai"
    vision_model = "fake-vision"
    model = "fake-model"

    def __init__(self):
        self.calls = []

    async def chat_json(self, messages, **kwargs):
        self.calls.append(("chat_json", kwargs))
        return {
            "caption": "一位站在花田中的女性。",
            "caption_confidence": 0.91,
            "tags": ["人物", "花田", "户外"],
            "classifications": [
                {"label": "person", "label_zh": "人物", "confidence": 0.93, "category": "people"}
            ],
            "detections": [
                {"label": "person", "label_zh": "人物", "confidence": 0.93, "bbox": [10, 20, 100, 200]}
            ],
            "scene_type": "portrait",
            "optimized_prompt": "a woman standing in a flower field, cinematic lighting, high detail",
            "optimized_prompt_en": "a woman standing in a flower field, cinematic lighting, high detail",
            "negative_prompt": "blur, low quality",
            "style_suggestions": ["photography", "realistic", "minimalist"],
            "explanation": "补充了光线和细节描述",
            "text": "一位站在花田中的女性。",
            "text_en": "A woman standing in a flower field.",
            "confidence": 0.9,
            "answer": "画面中有一位人物。",
            "answer_en": "There is a person in the image.",
            "reasoning": "检测到人物主体",
        }

    async def chat_text(self, messages, **kwargs):
        self.calls.append(("chat_text", kwargs))
        return "A woman standing in a flower field."

    async def generate_image(self, prompt, **kwargs):
        self.calls.append(("generate_image", kwargs))
        return [{"url": "https://example.com/generated.png", "revised_prompt": prompt}]


def make_service(tmp_path):
    path = tmp_path / "sample.png"
    path.write_bytes(png_bytes())
    service = AIService(llm=FakeLLM())
    service.image_service.find_image = lambda image_id: str(path)
    return service, path


def test_analyze_image_uses_real_provider(tmp_path):
    service, _ = make_service(tmp_path)
    result = asyncio.run(
        service.analyze_image("img-1", [AnalysisType.ALL], language="zh", confidence_threshold=0.3)
    )
    assert result.provider == "openai"
    assert result.caption.caption == "一位站在花田中的女性。"
    assert "人物" in result.tags
    assert result.classifications[0].label == "person"
    assert result.detections[0].label_zh == "人物"
    assert result.scene_type == "portrait"
    assert result.model_version == "fake-vision"


def test_ai_service_falls_back_to_mock_without_key(tmp_path):
    path = tmp_path / "sample.png"
    path.write_bytes(png_bytes())

    class DisabledLLM(FakeLLM):
        enabled = False
        mode = "mock"

        async def chat_json(self, messages, **kwargs):  # pragma: no cover - should not run
            raise AssertionError("不应调用模型")

    service = AIService(llm=DisabledLLM())
    service.image_service.find_image = lambda image_id: str(path)
    result = asyncio.run(service.analyze_image("img-2", [AnalysisType.ALL]))
    assert result.provider == "mock"
    assert result.classifications
    assert result.tags


def test_prompt_service_uses_model():
    service = PromptService(llm=FakeLLM())
    request = PromptOptimizeRequest(prompt="花田里的女孩", target_model="sdxl", language="zh")
    result = asyncio.run(service.optimize_prompt(request))
    assert result.provider == "openai"
    assert "flower field" in result.optimized_prompt
    assert result.negative_prompt
    assert asyncio.run(service.translate_prompt("花田", "en"))


def test_multimodal_service_uses_model(tmp_path):
    service = MultimodalService(llm=FakeLLM())
    path = tmp_path / "sample.png"
    path.write_bytes(png_bytes())
    service.image_service.find_image = lambda image_id: str(path)

    text_result = asyncio.run(service.image_to_text("img-3"))
    assert text_result.provider == "openai"
    assert text_result.text

    qa_result = asyncio.run(service.visual_qa("img-3", "图中有什么？"))
    assert qa_result.provider == "openai"
    assert qa_result.answer

    image_result = asyncio.run(service.text_to_image("一座未来城市"))
    assert image_result.provider == "openai"
    assert image_result.images[0]["url"] == "https://example.com/generated.png"


def test_analysis_url_endpoint(monkeypatch):
    from types import SimpleNamespace

    async def fake_fetch(url, **kwargs):
        return SimpleNamespace(content=png_bytes(), extension=".png", width=320, height=240)

    fake_llm = FakeLLM()
    monkeypatch.setattr(analysis_api, "fetch_public_image", fake_fetch)
    monkeypatch.setattr(analysis_api.ai_service, "llm", fake_llm)

    client = TestClient(app)
    response = client.post(
        "/api/v1/analysis/url",
        json={
            "image_url": "https://islinxu.github.io/ai-images-galley/images/sample.png",
            "analysis_types": ["all"],
            "language": "zh",
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["provider"] == "openai"
    assert data["caption"]["caption"] == "一位站在花田中的女性。"
    assert data["tags"] == ["人物", "花田", "户外"]


def test_analysis_url_rejects_untrusted_host():
    client = TestClient(app)
    response = client.post(
        "/api/v1/analysis/url",
        json={"image_url": "https://evil.example.com/image.png"},
    )
    assert response.status_code == 400


def test_analysis_endpoint_mock_when_no_key(tmp_path):
    """没有 API Key 时，/analysis 仍返回结构完整的 mock 数据。"""
    client = TestClient(app)
    upload = client.post(
        "/api/v1/images/upload",
        files={"file": ("mock-ai.png", png_bytes((120, 40, 200)), "image/png")},
    )
    assert upload.status_code == 200, upload.text
    image_id = upload.json()["data"]["id"]

    response = client.post(
        "/api/v1/analysis",
        json={"image_id": image_id, "analysis_types": ["all"], "language": "zh"},
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["provider"] == "mock"
    assert data["classifications"]
    assert data["caption"]
    assert data["tags"]

    client.delete(f"/api/v1/images/{image_id}")


def test_multimodal_url_endpoints(monkeypatch):
    from types import SimpleNamespace
    from app.api import multimodal as multimodal_api

    async def fake_fetch(url, **kwargs):
        return SimpleNamespace(content=png_bytes(), extension=".png", width=320, height=240)

    monkeypatch.setattr(multimodal_api, "fetch_public_image", fake_fetch)
    monkeypatch.setattr(multimodal_api.multimodal_service, "llm", FakeLLM())

    client = TestClient(app)
    text_response = client.post(
        "/api/v1/multimodal/image-to-text-url",
        json={
            "image_url": "https://islinxu.github.io/ai-images-galley/images/sample.png",
            "task": "describe",
            "language": "zh",
        },
    )
    assert text_response.status_code == 200, text_response.text
    text_data = text_response.json()["data"]
    assert text_data["provider"] == "openai"
    assert text_data["text"] == "一位站在花田中的女性。"

    qa_response = client.post(
        "/api/v1/multimodal/visual-qa-url",
        json={
            "image_url": "https://islinxu.github.io/ai-images-galley/images/sample.png",
            "question": "图中有什么？",
            "language": "zh",
        },
    )
    assert qa_response.status_code == 200, qa_response.text
    qa_data = qa_response.json()["data"]
    assert qa_data["provider"] == "openai"
    assert qa_data["answer"] == "画面中有一位人物。"


def test_multimodal_url_rejects_untrusted_host():
    client = TestClient(app)
    response = client.post(
        "/api/v1/multimodal/image-to-text-url",
        json={"image_url": "https://evil.example.com/image.png", "task": "describe"},
    )
    assert response.status_code == 400
