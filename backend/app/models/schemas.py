"""
Pydantic数据模型
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum


class ResponseModel(BaseModel):
    """通用响应模型"""
    success: bool = True
    data: Optional[Any] = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ErrorResponse(BaseModel):
    """错误响应模型"""
    success: bool = False
    error: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ==================== 图像相关模型 ====================

class ImageUploadRequest(BaseModel):
    """图像上传请求"""
    filename: str
    content_type: str
    size: int
    metadata: Optional[Dict[str, Any]] = None


class ImageMetadata(BaseModel):
    """图像元数据"""
    width: int
    height: int
    aspect_ratio: float
    format: str
    color_space: Optional[str] = None
    has_alpha: bool = False
    file_size: int


class ImageResponse(BaseModel):
    """图像响应"""
    id: str
    filename: str
    url: str
    thumbnail_url: Optional[str] = None
    metadata: ImageMetadata
    tags: List[str] = []
    ai_tags: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime


# ==================== AI分析相关模型 ====================

class AnalysisType(str, Enum):
    """分析类型"""
    CLASSIFICATION = "classification"
    DETECTION = "detection"
    CAPTION = "caption"
    TAGS = "tags"
    SCENE = "scene"
    COLOR = "color"
    ALL = "all"


class AnalysisRequest(BaseModel):
    """AI分析请求"""
    image_id: str
    analysis_types: List[AnalysisType] = [AnalysisType.ALL]
    language: str = "zh"
    confidence_threshold: float = Field(default=0.3, ge=0, le=1)

class AnalyzeUrlRequest(BaseModel):
    """通过公开图片 URL 进行 AI 分析"""
    image_url: str = Field(..., min_length=8, max_length=2000)
    analysis_types: List[AnalysisType] = [AnalysisType.ALL]
    language: str = "zh"
    confidence_threshold: float = Field(default=0.3, ge=0, le=1)



class ClassificationResult(BaseModel):
    """分类结果"""
    label: str
    label_zh: Optional[str] = None
    confidence: float
    category: str


class DetectionResult(BaseModel):
    """检测结果"""
    label: str
    label_zh: Optional[str] = None
    confidence: float
    bbox: List[float]  # [x, y, width, height]


class CaptionResult(BaseModel):
    """图像描述结果"""
    caption: str
    caption_zh: Optional[str] = None
    confidence: float
    style: Optional[str] = None


class ColorInfo(BaseModel):
    """颜色信息"""
    hex: str
    rgb: List[int]
    percentage: float
    name: Optional[str] = None


class AnalysisResult(BaseModel):
    """完整分析结果"""
    model_config = ConfigDict(protected_namespaces=())

    image_id: str
    classifications: List[ClassificationResult] = []
    detections: List[DetectionResult] = []
    caption: Optional[CaptionResult] = None
    tags: List[str] = []
    colors: List[ColorInfo] = []
    scene_type: Optional[str] = None
    processing_time: float
    model_version: str
    provider: str = "mock"


# ==================== Prompt相关模型 ====================

class PromptStyle(str, Enum):
    """Prompt风格"""
    PHOTOGRAPHY = "photography"
    DIGITAL_ART = "digital_art"
    OIL_PAINTING = "oil_painting"
    WATERCOLOR = "watercolor"
    ANIME = "anime"
    REALISTIC = "realistic"
    MINIMALIST = "minimalist"
    CYBERPUNK = "cyberpunk"
    VINTAGE = "vintage"
    FANTASY = "fantasy"


class PromptOptimizeRequest(BaseModel):
    """Prompt优化请求"""
    prompt: str = Field(..., min_length=1, max_length=4000)
    style: Optional[PromptStyle] = None
    target_model: str = "sdxl"  # sdxl, midjourney, dalle3
    language: str = "zh"
    enhance_details: bool = True
    add_negative_prompt: bool = True
    aspect_ratio: Optional[str] = "1:1"


class PromptOptimizeResponse(BaseModel):
    """Prompt优化响应"""
    original_prompt: str
    optimized_prompt: str
    optimized_prompt_en: Optional[str] = None
    negative_prompt: Optional[str] = None
    negative_prompt_en: Optional[str] = None
    style_suggestions: List[str] = []
    parameter_suggestions: Dict[str, Any] = {}
    tags: List[str] = []
    explanation: Optional[str] = None
    provider: str = "rules"


class PromptTemplate(BaseModel):
    """Prompt模板"""
    id: str
    name: str
    description: str
    template: str
    category: str
    variables: List[str] = []
    example: Optional[str] = None
    style: Optional[PromptStyle] = None


# ==================== 多模态相关模型 ====================

class MultimodalTaskType(str, Enum):
    """多模态任务类型"""
    IMAGE_TO_TEXT = "image_to_text"
    TEXT_TO_IMAGE = "text_to_image"
    IMAGE_EDIT = "image_edit"
    IMAGE_VARIATION = "image_variation"
    STYLE_TRANSFER = "style_transfer"
    VISUAL_QA = "visual_qa"


class ImageToTextRequest(BaseModel):
    """图像转文本请求"""
    image_id: str
    task: str = "describe"  # describe, caption, story, poem
    language: str = "zh"
    max_length: int = Field(default=500, ge=50, le=2000)
    style: Optional[str] = None


class ImageToTextUrlRequest(BaseModel):
    """通过公开图片 URL 做图像转文本"""
    image_url: str = Field(..., min_length=8, max_length=2000)
    task: str = "describe"
    language: str = "zh"
    max_length: int = Field(default=500, ge=50, le=2000)
    style: Optional[str] = None


class ImageToTextResponse(BaseModel):
    """图像转文本响应"""
    image_id: str
    text: str
    text_en: Optional[str] = None
    task: str
    word_count: int
    confidence: float
    provider: str = "mock"


class TextToImageRequest(BaseModel):
    """文本转图像请求"""
    prompt: str = Field(..., min_length=1, max_length=4000)
    negative_prompt: Optional[str] = None
    size: str = "1024x1024"
    style: Optional[str] = None
    n: int = Field(default=1, ge=1, le=4)
    quality: str = "standard"
    seed: Optional[int] = None


class TextToImageResponse(BaseModel):
    """文本转图像响应"""
    task_id: str
    status: str
    images: List[Dict[str, Any]] = []
    prompt_used: str
    parameters: Dict[str, Any] = {}
    provider: str = "mock"


class VisualQARequest(BaseModel):
    """视觉问答请求"""
    image_id: str
    question: str = Field(..., min_length=1, max_length=500)
    language: str = "zh"
    detail_level: str = "auto"  # low, high, auto


class VisualQAUrlRequest(BaseModel):
    """通过公开图片 URL 做视觉问答"""
    image_url: str = Field(..., min_length=8, max_length=2000)
    question: str = Field(..., min_length=1, max_length=500)
    language: str = "zh"
    detail_level: str = "auto"


class VisualQAResponse(BaseModel):
    """视觉问答响应"""
    image_id: str
    question: str
    answer: str
    answer_en: Optional[str] = None
    confidence: float
    reasoning: Optional[str] = None
    provider: str = "mock"


class StyleTransferRequest(BaseModel):
    """风格迁移请求"""
    image_id: str
    target_style: PromptStyle
    intensity: float = Field(default=0.8, ge=0.1, le=1.0)
    preserve_content: bool = True


# ==================== 健康检查模型 ====================

class HealthStatus(BaseModel):
    """健康状态"""
    status: str
    version: str
    timestamp: datetime
    services: Dict[str, str] = {}
    system_info: Optional[Dict[str, Any]] = None
