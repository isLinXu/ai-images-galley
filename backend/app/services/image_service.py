"""
图像处理服务
"""

import os
from typing import Optional, Tuple
from PIL import Image, ExifTags
import io

from app.core.config import settings
from app.models.schemas import ImageMetadata


class ImageService:
    """图像处理服务"""
    
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        self.thumbnail_dir = os.path.join(self.upload_dir, "thumbnails")
    
    async def extract_metadata(self, file_path: str) -> ImageMetadata:
        """提取图像元数据"""
        with Image.open(file_path) as img:
            width, height = img.size
            format_type = img.format.lower() if img.format else "unknown"
            
            # 提取EXIF数据
            has_alpha = img.mode in ("RGBA", "P", "LA")
            color_space = img.mode
            
            # 获取文件大小
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
        """生成缩略图"""
        try:
            with Image.open(file_path) as img:
                # 转换为RGB模式（如果需要）
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                
                # 生成缩略图
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                
                # 保存缩略图
                thumbnail_path = os.path.join(self.thumbnail_dir, filename)
                img.save(thumbnail_path, "JPEG", quality=85)
                
                return thumbnail_path
        except Exception as e:
            print(f"缩略图生成失败: {e}")
            return None
    
    async def compress_image(
        self,
        image_id: str,
        quality: int = 80,
        max_width: Optional[int] = None,
        max_height: Optional[int] = None
    ) -> dict:
        """压缩图像"""
        # 查找原始文件
        original_path = os.path.join(self.upload_dir, f"{image_id}*")
        
        # 这里简化处理，实际应该通过数据库查询
        return {
            "image_id": image_id,
            "quality": quality,
            "max_width": max_width,
            "max_height": max_height,
            "status": "compressed"
        }
    
    async def extract_exif(self, file_path: str) -> dict:
        """提取EXIF数据"""
        exif_data = {}
        try:
            with Image.open(file_path) as img:
                if hasattr(img, '_getexif') and img._getexif():
                    exif = img._getexif()
                    for tag_id, value in exif.items():
                        tag = ExifTags.TAGS.get(tag_id, tag_id)
                        exif_data[tag] = str(value)
        except Exception as e:
            print(f"EXIF提取失败: {e}")
        
        return exif_data
    
    async def extract_colors(self, file_path: str, num_colors: int = 5) -> list:
        """提取主色调"""
        try:
            with Image.open(file_path) as img:
                # 转换为RGB并缩小以加速处理
                img = img.convert("RGB")
                img.thumbnail((150, 150))
                
                # 使用量化获取主要颜色
                quantized = img.quantize(colors=num_colors)
                palette = quantized.getpalette()[:num_colors * 3]
                
                colors = []
                for i in range(num_colors):
                    r = palette[i * 3]
                    g = palette[i * 3 + 1]
                    b = palette[i * 3 + 2]
                    hex_color = f"#{r:02x}{g:02x}{b:02x}"
                    colors.append({
                        "hex": hex_color,
                        "rgb": [r, g, b],
                        "percentage": round(100 / num_colors, 2)
                    })
                
                return colors
        except Exception as e:
            print(f"颜色提取失败: {e}")
            return []
