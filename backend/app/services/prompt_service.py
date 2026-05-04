"""
Prompt智能服务
"""

import re
from typing import List, Optional, Dict, Any

from app.models.schemas import PromptOptimizeRequest, PromptOptimizeResponse, PromptTemplate, PromptStyle


class PromptService:
    """Prompt智能服务"""
    
    def __init__(self):
        self.templates = self._load_default_templates()
        self.style_keywords = self._load_style_keywords()
    
    async def optimize_prompt(self, request: PromptOptimizeRequest) -> PromptOptimizeResponse:
        """优化Prompt"""
        original = request.prompt.strip()
        
        # 基础优化
        optimized = self._basic_optimize(original)
        
        # 添加风格关键词
        if request.style:
            optimized = self._apply_style(optimized, request.style)
        
        # 增强细节
        if request.enhance_details:
            optimized = self._enhance_details(optimized, request.target_model)
        
        # 生成负面Prompt
        negative_prompt = None
        if request.add_negative_prompt:
            negative_prompt = await self.generate_negative_prompt(original, "medium")
        
        # 翻译为英文（如果需要）
        optimized_en = None
        if request.language == "zh":
            optimized_en = self._translate_to_english(optimized)
        
        # 生成参数建议
        params = self._generate_parameters(request.target_model, request.style, request.aspect_ratio)
        
        return PromptOptimizeResponse(
            original_prompt=original,
            optimized_prompt=optimized,
            optimized_prompt_en=optimized_en,
            negative_prompt=negative_prompt,
            negative_prompt_en=self._translate_to_english(negative_prompt) if negative_prompt else None,
            style_suggestions=self._generate_style_suggestions(request.style),
            parameter_suggestions=params,
            tags=self._extract_tags(optimized),
            explanation=self._generate_explanation(original, optimized)
        )
    
    async def translate_prompt(self, prompt: str, target_language: str = "en") -> str:
        """翻译Prompt"""
        # 简化实现，实际应该调用翻译API
        if target_language == "en":
            return self._translate_to_english(prompt)
        elif target_language == "zh":
            return prompt  # 假设输入是英文
        return prompt
    
    async def generate_negative_prompt(self, prompt: str, intensity: str = "medium") -> str:
        """生成负面Prompt"""
        base_negatives = {
            "low": "blur, low quality",
            "medium": "blur, low quality, distorted, deformed, ugly, duplicate, watermark, signature, text",
            "high": "blur, low quality, distorted, deformed, ugly, duplicate, watermark, signature, text, bad anatomy, disfigured, poorly drawn face, mutation, mutated, extra limbs, extra fingers, mutated hands, poorly drawn hands, missing limb, floating limbs, disconnected limbs, malformed hands, out of frame, bad art, bad proportions, gross proportions"
        }
        
        # 根据输入Prompt分析添加特定负面词
        specific_negatives = []
        if any(word in prompt.lower() for word in ["person", "people", "人物", "人"]):
            specific_negatives.extend(["bad face", "extra face", "two heads"])
        
        if any(word in prompt.lower() for word in ["landscape", "风景", "自然"]):
            specific_negatives.extend(["unnatural colors", "oversaturated"])
        
        negative = base_negatives.get(intensity, base_negatives["medium"])
        if specific_negatives:
            negative += ", " + ", ".join(specific_negatives)
        
        return negative
    
    async def analyze_prompt_quality(self, prompt: str) -> dict:
        """分析Prompt质量"""
        analysis = {
            "length_score": min(len(prompt) / 100, 1.0),
            "has_subject": bool(re.search(r'[\u4e00-\u9fa5a-zA-Z]{3,}', prompt)),
            "has_style": any(keyword in prompt.lower() for keyword in [
                "style", "art", "painting", "photo", "风格", "艺术", "摄影"
            ]),
            "has_quality": any(keyword in prompt.lower() for keyword in [
                "high quality", "detailed", "8k", " masterpiece", "高质量", "细节"
            ]),
            "has_lighting": any(keyword in prompt.lower() for keyword in [
                "light", "shadow", "sunlight", "光线", "阴影", "光照"
            ]),
            "suggestions": []
        }
        
        # 生成建议
        if not analysis["has_style"]:
            analysis["suggestions"].append("建议添加风格描述，如'数字艺术'、'油画风格'等")
        if not analysis["has_quality"]:
            analysis["suggestions"].append("建议添加质量描述，如'高质量'、'超细节'等")
        if not analysis["has_lighting"]:
            analysis["suggestions"].append("建议添加光照描述以增强画面效果")
        if len(prompt) < 50:
            analysis["suggestions"].append("Prompt较短，建议添加更多细节描述")
        
        # 计算总体评分
        score = sum([
            analysis["length_score"] * 0.2,
            0.2 if analysis["has_subject"] else 0,
            0.2 if analysis["has_style"] else 0,
            0.2 if analysis["has_quality"] else 0,
            0.2 if analysis["has_lighting"] else 0
        ])
        analysis["overall_score"] = round(score, 2)
        
        return analysis
    
    def get_templates(self, category: Optional[str] = None, style: Optional[PromptStyle] = None) -> List[PromptTemplate]:
        """获取Prompt模板"""
        templates = list(self.templates.values())
        
        if category:
            templates = [t for t in templates if t.category == category]
        if style:
            templates = [t for t in templates if t.style == style]
        
        return templates
    
    def get_template_by_id(self, template_id: str) -> Optional[PromptTemplate]:
        """通过ID获取模板"""
        return self.templates.get(template_id)
    
    def render_template(self, template_id: str, variables: dict) -> str:
        """渲染模板"""
        template = self.templates.get(template_id)
        if not template:
            raise ValueError(f"模板不存在: {template_id}")
        
        result = template.template
        for key, value in variables.items():
            result = result.replace(f"{{{key}}}", str(value))
        
        return result
    
    def get_style_description(self, style: PromptStyle) -> str:
        """获取风格描述"""
        descriptions = {
            PromptStyle.PHOTOGRAPHY: "摄影风格，真实感强",
            PromptStyle.DIGITAL_ART: "数字艺术，色彩丰富",
            PromptStyle.OIL_PAINTING: "油画风格，质感厚重",
            PromptStyle.WATERCOLOR: "水彩风格，清新淡雅",
            PromptStyle.ANIME: "动漫风格，线条清晰",
            PromptStyle.REALISTIC: "写实风格，细节丰富",
            PromptStyle.MINIMALIST: "极简风格，简洁干净",
            PromptStyle.CYBERPUNK: "赛博朋克，未来科技感",
            PromptStyle.VINTAGE: "复古风格，怀旧感",
            PromptStyle.FANTASY: "奇幻风格，想象力丰富"
        }
        return descriptions.get(style, "未知风格")
    
    def _basic_optimize(self, prompt: str) -> str:
        """基础优化"""
        # 清理多余空格
        optimized = " ".join(prompt.split())
        # 确保结尾有标点
        if optimized and not optimized[-1] in ".,!?。，！？":
            optimized += ", "
        return optimized
    
    def _apply_style(self, prompt: str, style: PromptStyle) -> str:
        """应用风格"""
        style_keywords = self.style_keywords.get(style, [])
        if style_keywords and not any(kw in prompt.lower() for kw in style_keywords):
            prompt += f", {style_keywords[0]} style"
        return prompt
    
    def _enhance_details(self, prompt: str, target_model: str) -> str:
        """增强细节"""
        enhancements = {
            "sdxl": "highly detailed, 8k uhd, professional quality",
            "midjourney": "highly detailed, cinematic lighting, 8k, masterpiece",
            "dalle3": "highly detailed, professional quality, sharp focus"
        }
        
        enhancement = enhancements.get(target_model, "highly detailed, high quality")
        if enhancement.lower() not in prompt.lower():
            prompt += f", {enhancement}"
        
        return prompt
    
    def _translate_to_english(self, text: str) -> str:
        """简化的中文到英文翻译（实际应调用翻译API）"""
        # 这是一个简化实现
        common_translations = {
            "风景": "landscape",
            "人物": "person",
            "建筑": "architecture",
            "自然": "nature",
            "动物": "animal",
            "高质量": "high quality",
            "细节": "detailed",
            "风格": "style",
            "艺术": "art"
        }
        
        result = text
        for zh, en in common_translations.items():
            result = result.replace(zh, en)
        
        return result
    
    def _generate_parameters(self, target_model: str, style: Optional[PromptStyle], aspect_ratio: str) -> dict:
        """生成参数建议"""
        params = {
            "aspect_ratio": aspect_ratio,
            "cfg_scale": 7.0,
            "steps": 30
        }
        
        if target_model == "sdxl":
            params.update({
                "sampler": "DPM++ 2M Karras",
                "cfg_scale": 7.5,
                "steps": 40
            })
        elif target_model == "midjourney":
            params.update({
                "quality": "--q 2",
                "stylize": "--s 750"
            })
        elif target_model == "dalle3":
            params.update({
                "quality": "hd",
                "style": "vivid"
            })
        
        return params
    
    def _generate_style_suggestions(self, current_style: Optional[PromptStyle]) -> List[str]:
        """生成风格建议"""
        all_styles = list(PromptStyle)
        if current_style and current_style in all_styles:
            all_styles.remove(current_style)
        
        import random
        suggestions = random.sample([s.value for s in all_styles], min(3, len(all_styles)))
        return suggestions
    
    def _extract_tags(self, prompt: str) -> List[str]:
        """从Prompt提取标签"""
        # 简单的标签提取逻辑
        words = re.findall(r'\b\w+\b', prompt.lower())
        common_words = {"the", "a", "an", "in", "on", "at", "to", "of", "and", "or", "is", "are"}
        tags = [w for w in words if w not in common_words and len(w) > 2]
        return list(set(tags))[:10]
    
    def _generate_explanation(self, original: str, optimized: str) -> str:
        """生成优化说明"""
        if original == optimized:
            return "原始Prompt已较为完善，无需大幅调整"
        
        changes = []
        if len(optimized) > len(original):
            changes.append("添加了质量和细节描述")
        if any(kw in optimized.lower() for kw in ["style", "art"]):
            changes.append("明确了艺术风格")
        
        return "优化内容：" + "；".join(changes) if changes else "进行了细节优化"
    
    def _load_default_templates(self) -> dict:
        """加载默认模板"""
        return {
            "portrait": PromptTemplate(
                id="portrait",
                name="人像摄影",
                description="专业人像摄影风格",
                template="professional portrait of {subject}, {expression}, {lighting} lighting, {background} background, high quality, detailed, sharp focus",
                category="photography",
                variables=["subject", "expression", "lighting", "background"],
                example="professional portrait of a young woman, smiling, soft natural lighting, blurred garden background, high quality, detailed, sharp focus",
                style=PromptStyle.PHOTOGRAPHY
            ),
            "landscape": PromptTemplate(
                id="landscape",
                name="风景摄影",
                description="壮丽风景摄影",
                template="breathtaking landscape of {location}, {time_of_day}, {weather}, {mood} atmosphere, ultra detailed, 8k uhd, professional photography",
                category="photography",
                variables=["location", "time_of_day", "weather", "mood"],
                example="breathtaking landscape of mountain lake, golden hour, clear sky, serene atmosphere, ultra detailed, 8k uhd, professional photography",
                style=PromptStyle.PHOTOGRAPHY
            ),
            "digital_art": PromptTemplate(
                id="digital_art",
                name="数字艺术",
                description="创意数字艺术作品",
                template="digital art of {subject}, {style}, vibrant colors, intricate details, concept art, trending on artstation, 8k",
                category="art",
                variables=["subject", "style"],
                example="digital art of futuristic city, cyberpunk style, vibrant colors, intricate details, concept art, trending on artstation, 8k",
                style=PromptStyle.DIGITAL_ART
            ),
            "anime": PromptTemplate(
                id="anime",
                name="动漫风格",
                description="日式动漫风格插画",
                template="anime style {subject}, {expression}, {setting}, detailed background, studio ghibli inspired, high quality, 4k",
                category="art",
                variables=["subject", "expression", "setting"],
                example="anime style young girl, happy expression, cherry blossom garden, detailed background, studio ghibli inspired, high quality, 4k",
                style=PromptStyle.ANIME
            )
        }
    
    def _load_style_keywords(self) -> dict:
        """加载风格关键词"""
        return {
            PromptStyle.PHOTOGRAPHY: ["photography", "photo", "photorealistic"],
            PromptStyle.DIGITAL_ART: ["digital art", "concept art", "illustration"],
            PromptStyle.OIL_PAINTING: ["oil painting", "oil on canvas"],
            PromptStyle.WATERCOLOR: ["watercolor", "watercolour"],
            PromptStyle.ANIME: ["anime", "manga", "chibi"],
            PromptStyle.REALISTIC: ["realistic", "hyperrealistic", "photorealistic"],
            PromptStyle.MINIMALIST: ["minimalist", "minimalism", "simple"],
            PromptStyle.CYBERPUNK: ["cyberpunk", "neon", "futuristic"],
            PromptStyle.VINTAGE: ["vintage", "retro", "old fashioned"],
            PromptStyle.FANTASY: ["fantasy", "magical", "mythical"]
        }
