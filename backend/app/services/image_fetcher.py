"""受限的公开图片下载与校验工具。

供 URL 分析/多模态接口复用，避免把后端变成任意 URL 的 SSRF 代理。
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urlparse

import httpx
from PIL import Image, UnidentifiedImageError

EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "GIF": ".gif",
    "BMP": ".bmp",
}


class ImageFetchError(RuntimeError):
    """图片 URL 不可用、被拒绝或内容非法。"""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass
class FetchedImage:
    content: bytes
    extension: str
    width: int
    height: int


async def fetch_public_image(
    image_url: str,
    *,
    allowed_hosts: Iterable[str],
    max_bytes: int,
    max_dimension: int,
    timeout: float = 15.0,
) -> FetchedImage:
    parsed = urlparse(image_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ImageFetchError("仅支持 http/https 图片 URL")
    host = parsed.hostname.lower()
    if host not in {item.lower() for item in allowed_hosts}:
        raise ImageFetchError(f"不允许的图片主机: {host}")

    chunks = []
    total = 0
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            async with client.stream("GET", image_url) as response:
                if response.status_code >= 400:
                    raise ImageFetchError(
                        f"下载图片失败: HTTP {response.status_code}",
                        status_code=400,
                    )
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        raise ImageFetchError("图片超过允许的大小", status_code=413)
                    chunks.append(chunk)
    except ImageFetchError:
        raise
    except httpx.HTTPError as error:
        raise ImageFetchError(f"下载图片失败: {error}") from error

    content = b"".join(chunks)
    if not content:
        raise ImageFetchError("图片内容为空")

    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            width, height = image.size
            extension = EXTENSIONS.get((image.format or "").upper(), ".jpg")
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise ImageFetchError(f"无法解析图片: {error}") from error

    if max(width, height) > max_dimension:
        raise ImageFetchError(f"图片尺寸过大: {width}x{height}")

    return FetchedImage(
        content=content,
        extension=extension,
        width=width,
        height=height,
    )
