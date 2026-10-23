"""
图像处理服务
"""

import glob
import logging
import os
from typing import Optional, Tuple

from PIL import Image, ExifTags

from app.core.config import settings
from app.models.schemas import ImageMetadata

logger = logging.getLogger(__name__)

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp")


class ImageService:
    """图像处理服务"""

    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self.thumbnail_dir = os.path.join(self.upload_dir, "thumbnails")
        os.makedirs(self.thumbnail_dir, exist_ok=True)

    def find_image(self, image_id: str) -> Optional[str]:
        """按 image_id 查找原始图片（文件名为 {image_id}.{ext}）"""
        for extension in IMAGE_EXTENSIONS:
            candidate = os.path.join(self.upload_dir, f"{image_id}{extension}")
            if os.path.isfile(candidate):
                return candidate
        return None

    async def extract_metadata(self, file_path: str) -> ImageMetadata:
        """提取图像元数据"""
        with Image.open(file_path) as img:
            width, height = img.size
            format_type = img.format.lower() if img.format else "unknown"
            has_alpha = img.mode in ("RGBA", "P", "LA")
            color_space = img.mode
            file_size = os.path.getsize(file_path)

            return ImageMetadata(
                width=width,
                height=height,
                aspect_ratio=width / height if height > 0 else 1.0,
                format=format_type,
                color_space=color_space,
                has_alpha=has_alpha,
                file_size=file_size
            )

    async def generate_thumbnail(
        self,
        file_path: str,
        filename: str,
        max_size: Tuple[int, int] = (240, 240)
    ) -> Optional[str]:
        """生成缩略图（始终保存为 JPEG）"""
        try:
            with Image.open(file_path) as img:
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                thumbnail_path = os.path.join(self.thumbnail_dir, filename)
                img.save(thumbnail_path, "JPEG", quality=85, optimize=True)
                return thumbnail_path
        except Exception as error:
            logger.warning("缩略图生成失败: %s", error)
            return None

    async def compress_image(
        self,
        image_id: str,
        quality: int = 80,
        max_width: Optional[int] = None,
        max_height: Optional[int] = None
    ) -> dict:
        """压缩图像并输出 JPEG 文件"""
        original_path = self.find_image(image_id)
        if not original_path:
            raise FileNotFoundError(f"图片不存在: {image_id}")

        quality = max(1, min(int(quality), 100))
        output_name = f"{image_id}_compressed.jpg"
        output_path = os.path.join(self.upload_dir, output_name)

        with Image.open(original_path) as img:
            img = img.convert("RGB")
            width, height = img.size
            limit = (
                max_width if max_width and max_width > 0 else width,
                max_height if max_height and max_height > 0 else height
            )
            if (width, height) != limit:
                img.thumbnail(limit, Image.Resampling.LANCZOS)

            img.save(output_path, "JPEG", quality=quality, optimize=True)

        return {
            "image_id": image_id,
            "quality": quality,
            "max_width": max_width,
            "max_height": max_height,
            "status": "compressed",
            "url": f"/uploads/{output_name}",
            "size": os.path.getsize(output_path)
        }

    async def extract_exif(self, file_path: str) -> dict:
        """提取EXIF数据"""
        exif_data = {}
        try:
            with Image.open(file_path) as img:
                if hasattr(img, "_getexif") and img._getexif():
                    exif = img._getexif()
                    for tag_id, value in exif.items():
                        tag = ExifTags.TAGS.get(tag_id, tag_id)
                        exif_data[str(tag)] = str(value)
        except Exception as error:
            logger.warning("EXIF提取失败: %s", error)

        return exif_data

    async def extract_colors(self, file_path: str, num_colors: int = 5) -> list:
        """提取主色调"""
        try:
            with Image.open(file_path) as img:
                img = img.convert("RGB")
                img.thumbnail((150, 150))

                quantized = img.quantize(colors=num_colors)
                palette = quantized.getpalette() or []
                available = min(num_colors, len(palette) // 3)

                colors = []
                for index in range(available):
                    red = palette[index * 3]
                    green = palette[index * 3 + 1]
                    blue = palette[index * 3 + 2]
                    colors.append({
                        "hex": f"#{red:02x}{green:02x}{blue:02x}",
                        "rgb": [red, green, blue],
                        "percentage": round(100 / max(available, 1), 2)
                    })

                return colors
        except Exception as error:
            logger.warning("颜色提取失败: %s", error)
            return []
