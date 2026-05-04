"""
图像管理路由
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from typing import List, Optional
import os
import shutil
from datetime import datetime

from app.core.config import settings
from app.core.security import generate_secure_filename, generate_file_hash
from app.models.schemas import ResponseModel, ImageResponse, ImageMetadata
from app.services.image_service import ImageService

router = APIRouter()
image_service = ImageService()

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(f"{settings.UPLOAD_DIR}/thumbnails", exist_ok=True)


@router.post("/images/upload", response_model=ResponseModel)
async def upload_image(
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None)
):
    """上传单张图片"""
    # 验证文件类型
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {file.content_type}"
        )
    
    # 读取文件内容
    content = await file.read()
    
    # 验证文件大小
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件过大: {len(content)} bytes > {settings.MAX_FILE_SIZE} bytes"
        )
    
    # 生成安全文件名
    safe_filename = generate_secure_filename(file.filename)
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    
    # 保存文件
    with open(file_path, "wb") as f:
        f.write(content)
    
    # 提取图像元数据
    img_metadata = await image_service.extract_metadata(file_path)
    
    # 生成缩略图
    thumbnail_path = await image_service.generate_thumbnail(file_path, safe_filename)
    
    # 构建响应
    image_data = ImageResponse(
        id=generate_file_hash(content)[:16],
        filename=file.filename,
        url=f"/uploads/{safe_filename}",
        thumbnail_url=f"/uploads/thumbnails/{safe_filename}" if thumbnail_path else None,
        metadata=img_metadata,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    return ResponseModel(
        data=image_data,
        message="图片上传成功"
    )


@router.post("/images/upload/batch", response_model=ResponseModel)
async def upload_images_batch(files: List[UploadFile] = File(...)):
    """批量上传图片"""
    results = []
    errors = []
    
    for file in files:
        try:
            if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
                errors.append({"filename": file.filename, "error": "不支持的文件类型"})
                continue
            
            content = await file.read()
            if len(content) > settings.MAX_FILE_SIZE:
                errors.append({"filename": file.filename, "error": "文件过大"})
                continue
            
            safe_filename = generate_secure_filename(file.filename)
            file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            img_metadata = await image_service.extract_metadata(file_path)
            thumbnail_path = await image_service.generate_thumbnail(file_path, safe_filename)
            
            results.append(ImageResponse(
                id=generate_file_hash(content)[:16],
                filename=file.filename,
                url=f"/uploads/{safe_filename}",
                thumbnail_url=f"/uploads/thumbnails/{safe_filename}" if thumbnail_path else None,
                metadata=img_metadata,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            ))
            
        except Exception as e:
            errors.append({"filename": file.filename, "error": str(e)})
    
    return ResponseModel(
        data={
            "successful": results,
            "failed": errors,
            "total": len(files),
            "success_count": len(results),
            "fail_count": len(errors)
        },
        message=f"批量上传完成: {len(results)} 成功, {len(errors)} 失败"
    )


@router.get("/images/{image_id}", response_model=ResponseModel)
async def get_image(image_id: str):
    """获取图片信息"""
    # 这里应该查询数据库，现在使用文件系统模拟
    # 实际实现中应该使用数据库
    return ResponseModel(
        data={"image_id": image_id, "status": "found"},
        message="获取图片信息成功"
    )


@router.delete("/images/{image_id}", response_model=ResponseModel)
async def delete_image(image_id: str):
    """删除图片"""
    # 实际实现中应该从数据库和文件系统删除
    return ResponseModel(
        data={"image_id": image_id, "deleted": True},
        message="图片删除成功"
    )


@router.post("/images/{image_id}/compress", response_model=ResponseModel)
async def compress_image(
    image_id: str,
    quality: int = 80,
    max_width: Optional[int] = None,
    max_height: Optional[int] = None
):
    """压缩图片"""
    result = await image_service.compress_image(image_id, quality, max_width, max_height)
    return ResponseModel(
        data=result,
        message="图片压缩成功"
    )
