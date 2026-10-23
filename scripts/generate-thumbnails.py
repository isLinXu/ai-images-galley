#!/usr/bin/env python3
"""生成 images/manifest.json 与 WebP 缩略图。

用法：
    python3 scripts/generate-thumbnails.py

依赖 Pillow（后端 requirements 已包含）。脚本会：
  - 扫描 images/ 下的图片（排除 thumbnails/ 与 manifest.json）
  - 生成 640px 宽的 WebP 缩略图到 images/thumbnails/
  - 用 Git 最后提交时间作为图片时间
  - 重写 images/manifest.json（包含尺寸、格式、时间、缩略图路径）
"""

from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT / "images"
THUMBNAIL_DIR = IMAGES_DIR / "thumbnails"
MANIFEST_PATH = IMAGES_DIR / "manifest.json"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
THUMBNAIL_WIDTH = 640


def git_timestamp(path: Path) -> int:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%ct", "--", str(path.relative_to(ROOT))],
            capture_output=True,
            text=True,
            check=False,
        )
        value = result.stdout.strip()
        return int(value) * 1000 if value.isdigit() else int(path.stat().st_mtime * 1000)
    except (OSError, ValueError):
        return int(path.stat().st_mtime * 1000)


def make_thumbnail(source: Path) -> tuple[str, int, int]:
    THUMBNAIL_DIR.mkdir(exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            rgba = image.convert("RGBA")
            background.paste(rgba, mask=rgba.split()[-1])
            image = background
        else:
            image = image.convert("RGB")

        if image.width > THUMBNAIL_WIDTH:
            height = round(image.height * THUMBNAIL_WIDTH / image.width)
            image = image.resize((THUMBNAIL_WIDTH, height), Image.Resampling.LANCZOS)

        name = f"{source.stem}.webp"
        destination = THUMBNAIL_DIR / name
        image.save(destination, "WEBP", quality=78, method=6)
        return f"thumbnails/{name}", image.width, image.height


def main() -> None:
    entries = []
    for path in sorted(IMAGES_DIR.iterdir()):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        timestamp = git_timestamp(path)
        with Image.open(path) as image:
            width, height = image.size
            image_format = (image.format or "").lower()

        thumbnail, thumb_width, thumb_height = make_thumbnail(path)
        entries.append(
            {
                "name": path.name,
                "size": path.stat().st_size,
                "width": width,
                "height": height,
                "format": image_format,
                "timestamp": timestamp,
                "date": datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat(),
                "thumbnail": thumbnail,
                "thumbnailWidth": thumb_width,
                "thumbnailHeight": thumb_height,
            }
        )

    manifest = {
        "generatedAt": datetime.now(timezone.utc).date().isoformat(),
        "count": len(entries),
        "thumbnails": {"count": len(entries), "maxWidth": THUMBNAIL_WIDTH, "format": "webp"},
        "images": entries,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total = sum((THUMBNAIL_DIR / Path(item["thumbnail"]).name).stat().st_size for item in entries)
    print(f"生成 {len(entries)} 个缩略图，共 {total / 1024 / 1024:.2f} MB；清单已更新。")


if __name__ == "__main__":
    main()
