"""
图像管理路由

存储约定：
    uploads/{image_id}{ext}          原图
    uploads/thumbnails/{image_id}.jpg 缩略图
    uploads/.metadata/{image_id}.json 原始文件名等元数据
    uploads/{image_id}_compressed.jpg 压缩结果

该实现使用文件系统而非数据库，适合单机/演示部署；生产环境应替换为
对象存储 + 数据库，并补充鉴权、限流和后台任务队列。
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends, Header, Query
from fastapi.concurrency import run_in_threadpool
from typing import List, Optional
from datetime import datetime
from pathlib import Path
import io
import json
import os

from PIL import Image, UnidentifiedImageError

from app.core.config import settings
from app.core.security import generate_file_hash
from app.models.schemas import ResponseModel, ImageResponse
from app.services.image_service import ImageService

router = APIRouter()
image_service = ImageService()

UPLOAD_DIR = Path(settings.UPLOAD_DIR)
THUMBNAIL_DIR = UPLOAD_DIR / "thumbnails"
METADATA_DIR = UPLOAD_DIR / ".metadata"
for directory in (UPLOAD_DIR, THUMBNAIL_DIR, METADATA_DIR):
    directory.mkdir(parents=True, exist_ok=True)

FORMAT_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "GIF": ".gif",
    "BMP": ".bmp",
}
ALLOWED_EXTENSIONS = tuple(FORMAT_EXTENSIONS.values())


async def require_admin(authorization: Optional[str] = Header(default=None)) -> None:
    """可选的写操作保护：配置 ADMIN_TOKEN 后启用 Bearer 校验。"""
    if not settings.ADMIN_TOKEN:
        return
    expected = f"Bearer {settings.ADMIN_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="需要有效的管理员 Token")


def _validate_image_bytes(content: bytes) -> str:
    """校验真实图片内容并返回安全扩展名，防止仅依赖客户端 Content-Type。"""
    try:
        with Image.open(io.BytesIO(content)) as image:
            image.verify()
        with Image.open(io.BytesIO(content)) as image:
            width, height = image.size
            if max(width, height) > settings.MAX_IMAGE_DIMENSION:
                raise HTTPException(
                    status_code=400,
                    detail=f"图片尺寸过大: {width}x{height}",
                )
            return FORMAT_EXTENSIONS.get((image.format or "").upper(), ".jpg")
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=400, detail=f"无法解析图片: {error}") from error


def _metadata_path(image_id: str) -> Path:
    return METADATA_DIR / f"{image_id}.json"


def _write_metadata(image_id: str, payload: dict) -> None:
    _metadata_path(image_id).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _read_metadata(image_id: str) -> dict:
    path = _metadata_path(image_id)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _parse_datetime(value: Optional[str]) -> datetime:
    if not value:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return datetime.utcnow()


async def _build_response(image_id: str, file_path: Path) -> ImageResponse:
    metadata = await image_service.extract_metadata(str(file_path))
    sidecar = _read_metadata(image_id)
    thumbnail_path = THUMBNAIL_DIR / f"{image_id}.jpg"
    created_at = _parse_datetime(sidecar.get("created_at"))
    return ImageResponse(
        id=image_id,
        filename=sidecar.get("filename") or file_path.name,
        url=f"/uploads/{file_path.name}",
        thumbnail_url=f"/uploads/thumbnails/{image_id}.jpg" if thumbnail_path.is_file() else None,
        metadata=metadata,
        created_at=created_at,
        updated_at=datetime.utcnow(),
    )


async def _store_upload(file: UploadFile) -> ImageResponse:
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {file.content_type}")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件过大: {len(content)} bytes > {settings.MAX_FILE_SIZE} bytes",
        )
    if not content:
        raise HTTPException(status_code=400, detail="文件为空")

    extension = await run_in_threadpool(_validate_image_bytes, content)
    image_id = generate_file_hash(content)[:16]
    stored_name = f"{image_id}{extension}"
    file_path = UPLOAD_DIR / stored_name

    await run_in_threadpool(file_path.write_bytes, content)
    _write_metadata(image_id, {
        "id": image_id,
        "filename": file.filename or stored_name,
        "stored_name": stored_name,
        "created_at": datetime.utcnow().isoformat(),
        "size": len(content),
    })

    await image_service.generate_thumbnail(str(file_path), f"{image_id}.jpg")
    return await _build_response(image_id, file_path)


@router.post("/images/upload", response_model=ResponseModel)
async def upload_image(
    file: UploadFile = File(...),
    metadata: Optional[str] = Form(None),  # 预留字段，当前写入 sidecar 的是核心元数据
    _: None = Depends(require_admin),
):
    """上传单张图片"""
    image_data = await _store_upload(file)
    return ResponseModel(data=image_data, message="图片上传成功")


@router.post("/images/upload/batch", response_model=ResponseModel)
async def upload_images_batch(
    files: List[UploadFile] = File(...),
    _: None = Depends(require_admin),
):
    """批量上传图片"""
    results = []
    errors = []

    for file in files:
        try:
            results.append(await _store_upload(file))
        except HTTPException as error:
            errors.append({"filename": file.filename, "error": error.detail})
        except Exception as error:  # noqa: BLE001 - 批量接口需要逐项返回错误
            errors.append({"filename": file.filename, "error": str(error)})

    return ResponseModel(
        data={
            "successful": results,
            "failed": errors,
            "total": len(files),
            "success_count": len(results),
            "fail_count": len(errors),
        },
        message=f"批量上传完成: {len(results)} 成功, {len(errors)} 失败",
    )


@router.get("/images", response_model=ResponseModel)
async def list_images(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """列出已上传图片（按修改时间倒序）"""
    files = [
        path for path in UPLOAD_DIR.iterdir()
        if path.is_file()
        and path.suffix.lower() in ALLOWED_EXTENSIONS
        and not path.stem.endswith("_compressed")
    ]
    files.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    total = len(files)
    page = files[offset: offset + limit]
    items = [await _build_response(path.stem, path) for path in page]

    return ResponseModel(
        data={"items": items, "total": total, "limit": limit, "offset": offset},
        message="获取图片列表成功",
    )


@router.get("/images/{image_id}", response_model=ResponseModel)
async def get_image(image_id: str):
    """获取图片信息"""
    file_path = image_service.find_image(image_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="图片不存在")
    return ResponseModel(
        data=await _build_response(image_id, Path(file_path)),
        message="获取图片信息成功",
    )


@router.delete("/images/{image_id}", response_model=ResponseModel)
async def delete_image(image_id: str, _: None = Depends(require_admin)):
    """删除图片及其缩略图/元数据"""
    file_path = image_service.find_image(image_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="图片不存在")

    removed = []
    candidates = [
        Path(file_path),
        THUMBNAIL_DIR / f"{image_id}.jpg",
        UPLOAD_DIR / f"{image_id}_compressed.jpg",
        _metadata_path(image_id),
    ]
    for path in candidates:
        if path.is_file():
            path.unlink()
            removed.append(path.name)

    return ResponseModel(
        data={"image_id": image_id, "deleted": True, "files": removed},
        message="图片删除成功",
    )


@router.post("/images/{image_id}/compress", response_model=ResponseModel)
async def compress_image(
    image_id: str,
    quality: int = Query(default=80, ge=1, le=100),
    max_width: Optional[int] = Query(default=None, ge=1),
    max_height: Optional[int] = Query(default=None, ge=1),
    _: None = Depends(require_admin),
):
    """压缩图片"""
    try:
        result = await image_service.compress_image(image_id, quality, max_width, max_height)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return ResponseModel(data=result, message="图片压缩成功")
