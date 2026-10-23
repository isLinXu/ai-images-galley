"""图像 API 的端到端测试（使用临时生成的小图片，不依赖示例图片）。"""

import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def make_png(color=(30, 120, 220), size=(320, 240)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, "PNG")
    return buffer.getvalue()


def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["status"] == "healthy"
    assert data["services"]["ai_engine"] == "mock"


def test_image_upload_list_get_compress_delete():
    image_bytes = make_png((uuid.uuid4().int % 255, 120, 220))
    upload = client.post(
        "/api/v1/images/upload",
        files={"file": ("test-image.png", image_bytes, "image/png")},
    )
    assert upload.status_code == 200, upload.text
    image = upload.json()["data"]
    image_id = image["id"]

    assert client.get(image["url"]).status_code == 200
    assert image["thumbnail_url"]
    assert client.get(image["thumbnail_url"]).status_code == 200

    listing = client.get("/api/v1/images")
    assert listing.status_code == 200
    assert listing.json()["data"]["total"] >= 1

    detail = client.get(f"/api/v1/images/{image_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["id"] == image_id

    compressed = client.post(
        f"/api/v1/images/{image_id}/compress",
        params={"quality": 60, "max_width": 160},
    )
    assert compressed.status_code == 200
    assert compressed.json()["data"]["status"] == "compressed"
    assert client.get(compressed.json()["data"]["url"]).status_code == 200

    deleted = client.delete(f"/api/v1/images/{image_id}")
    assert deleted.status_code == 200
    assert client.get(f"/api/v1/images/{image_id}").status_code == 404


def test_rejects_non_image_content():
    response = client.post(
        "/api/v1/images/upload",
        files={"file": ("not-an-image.png", b"<script>alert(1)</script>", "image/png")},
    )
    assert response.status_code == 400


def test_admin_token_protects_write_endpoints(monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "ADMIN_TOKEN", "test-token")
    image_bytes = make_png((uuid.uuid4().int % 255, 80, 160))

    unauthorized = client.post(
        "/api/v1/images/upload",
        files={"file": ("guarded.png", image_bytes, "image/png")},
    )
    assert unauthorized.status_code == 401

    authorized = client.post(
        "/api/v1/images/upload",
        files={"file": ("guarded.png", image_bytes, "image/png")},
        headers={"Authorization": "Bearer test-token"},
    )
    assert authorized.status_code == 200
    image_id = authorized.json()["data"]["id"]

    deleted = client.delete(
        f"/api/v1/images/{image_id}",
        headers={"Authorization": "Bearer test-token"},
    )
    assert deleted.status_code == 200
