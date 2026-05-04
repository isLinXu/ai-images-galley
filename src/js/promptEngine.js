/**
 * AI智能相册系统 - Prompt智能引擎（前端）
 * 提供提示词优化、模板管理、风格推荐等功能
 */

import { promptAPI } from './apiClient.js';
import { appLogger } from './logger.js';

/**
 * Prompt风格定义
 */
const PROMPT_STYLES = {
    PHOTOGRAPHY: { id: 'photography', name: '摄影', icon: 'fa-camera', description: '真实摄影风格' },
    DIGITAL_ART: { id: 'digital_art', name: '数字艺术', icon: 'fa-palette', description: '数字绘画风格' },
    OIL_PAINTING: { id: 'oil_painting', name: '油画', icon: 'fa-brush', description: '传统油画质感' },
    WATERCOLOR: { id: 'watercolor', name: '水彩', icon: 'fa-tint', description: '清新水彩风格' },
    ANIME: { id: 'anime', name: '动漫', icon: 'fa-star', description: '日式动漫风格' },
    REALISTIC: { id: 'realistic', name: '写实', icon: 'fa-image', description: '超写实风格' },
    MINIMALIST: { id: 'minimalist', name: '极简', icon: 'fa-minus', description: '极简主义风格' },
    CYBERPUNK: { id: 'cyberpunk', name: '赛博朋克', icon: 'fa-bolt', description: '未来科技感' },
    VINTAGE: { id: 'vintage', name: '复古', icon: 'fa-clock', description: '怀旧复古风格' },
    FANTASY: { id: 'fantasy', name: '奇幻', icon: 'fa-magic', description: '魔幻奇幻风格' }
};

/**
 * 目标模型配置
 */
const TARGET_MODELS = {
    SDXL: { id: 'sdxl', name: 'Stable Diffusion XL', parameters: { steps: 40, cfg: 7.5 } },
    MIDJOURNEY: { id: 'midjourney', name: 'Midjourney', parameters: { quality: '--q 2', stylize: '--s 750' } },
    DALLE3: { id: 'dalle3', name: 'DALL-E 3', parameters: { quality: 'hd', style: 'vivid' } },
    SD15: { id: 'sd15', name: 'Stable Diffusion 1.5', parameters: { steps: 30, cfg: 7.0 } }
};

/**
 * Prompt智能引擎
 */
class PromptIntelligenceEngine {
    constructor() {
        this.templates = new Map();
        this.history = [];
        this.maxHistorySize = 50;
        this.isLoading = false;

        this._loadTemplates();
    }

    /**
     * 优化Prompt
     */
    async optimize(prompt, options = {}) {
        const {
            style = null,
            targetModel = 'sdxl',
            language = 'zh',
            enhanceDetails = true,
            addNegativePrompt = true,
            aspectRatio = '1:1'
        } = options;

        try {
            this.isLoading = true;
            appLogger.info('Prompt智能优化开始:', prompt);

            const result = await promptAPI.optimize({
                prompt,
                style: style ? style.toUpperCase() : null,
                target_model: targetModel,
                language,
                enhance_details: enhanceDetails,
                add_negative_prompt: addNegativePrompt,
                aspect_ratio: aspectRatio
            });

            if (result.success && result.data) {
                this._addToHistory({
                    original: prompt,
                    optimized: result.data.optimized_prompt,
                    timestamp: Date.now()
                });

                appLogger.info('Prompt优化完成');
                return result.data;
            }

            throw new Error(result.message || '优化失败');
        } catch (error) {
            appLogger.error('Prompt优化失败:', error);
            // 降级为本地优化
            return this._localOptimize(prompt, options);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * 本地优化（降级方案）
     */
    _localOptimize(prompt, options = {}) {
        const { style, targetModel = 'sdxl', enhanceDetails = true, addNegativePrompt = true } = options;

        let optimized = prompt.trim();

        // 基础清理
        optimized = optimized.replace(/\s+/g, ' ');

        // 添加质量描述
        if (enhanceDetails && !/high quality|detailed|masterpiece|高质量|细节/.test(optimized.toLowerCase())) {
            const qualityDesc = targetModel === 'midjourney'
                ? 'highly detailed, cinematic lighting, 8k, masterpiece'
                : 'highly detailed, 8k uhd, professional quality';
            optimized += `, ${qualityDesc}`;
        }

        // 添加风格
        if (style && PROMPT_STYLES[style.toUpperCase()]) {
            const styleInfo = PROMPT_STYLES[style.toUpperCase()];
            if (!optimized.toLowerCase().includes(styleInfo.id.toLowerCase())) {
                optimized += `, ${styleInfo.id} style`;
            }
        }

        // 生成负面Prompt
        let negativePrompt = null;
        if (addNegativePrompt) {
            negativePrompt = this._generateLocalNegativePrompt(prompt);
        }

        return {
            original_prompt: prompt,
            optimized_prompt: optimized,
            optimized_prompt_en: optimized,
            negative_prompt: negativePrompt,
            negative_prompt_en: negativePrompt,
            style_suggestions: Object.values(PROMPT_STYLES).slice(0, 3).map(s => s.id),
            parameter_suggestions: TARGET_MODELS[targetModel.toUpperCase()]?.parameters || {},
            tags: this._extractTags(optimized),
            explanation: '使用本地规则优化（后端服务不可用）'
        };
    }

    /**
     * 生成本地负面Prompt
     */
    _generateLocalNegativePrompt(prompt) {
        const baseNegatives = 'blur, low quality, distorted, deformed, ugly, duplicate, watermark, signature, text';
        const personNegatives = prompt.match(/人|person|people|肖像|portrait/i)
            ? ', bad anatomy, disfigured, poorly drawn face, extra limbs'
            : '';
        return baseNegatives + personNegatives;
    }

    /**
     * 提取标签
     */
    _extractTags(prompt) {
        const words = prompt.toLowerCase().match(/\b\w{3,}\b/g) || [];
        const commonWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'high', 'quality']);
        return [...new Set(words.filter(w => !commonWords.has(w)))].slice(0, 10);
    }

    /**
     * 翻译Prompt
     */
    async translate(prompt, targetLanguage = 'en') {
        try {
            const result = await promptAPI.translate(prompt, targetLanguage);
            return result.success ? result.data.translated : prompt;
        } catch (error) {
            appLogger.error('Prompt翻译失败:', error);
            return prompt;
        }
    }

    /**
     * 分析Prompt质量
     */
    async analyzeQuality(prompt) {
        try {
            const result = await promptAPI.analyze(prompt);
            return result.success ? result.data : this._localAnalyzeQuality(prompt);
        } catch {
            return this._localAnalyzeQuality(prompt);
        }
    }

    /**
     * 本地质量分析
     */
    _localAnalyzeQuality(prompt) {
        const analysis = {
            length_score: Math.min(prompt.length / 100, 1.0),
            has_subject: /[\u4e00-\u9fa5a-zA-Z]{3,}/.test(prompt),
            has_style: /style|art|风格|艺术/.test(prompt.toLowerCase()),
            has_quality: /quality|detailed|8k|高质量|细节/.test(prompt.toLowerCase()),
            has_lighting: /light|shadow|光线|阴影/.test(prompt.toLowerCase()),
            suggestions: [],
            overall_score: 0
        };

        if (!analysis.has_style) analysis.suggestions.push('建议添加风格描述');
        if (!analysis.has_quality) analysis.suggestions.push('建议添加质量描述');
        if (prompt.length < 50) analysis.suggestions.push('Prompt较短，建议添加更多细节');

        analysis.overall_score = Math.round(
            analysis.length_score * 0.2 +
            (analysis.has_subject ? 0.2 : 0) +
            (analysis.has_style ? 0.2 : 0) +
            (analysis.has_quality ? 0.2 : 0) +
            (analysis.has_lighting ? 0.2 : 0),
            2
        );

        return analysis;
    }

    /**
     * 获取模板列表
     */
    async getTemplates(category, style) {
        try {
            const result = await promptAPI.getTemplates(category, style);
            if (result.success && result.data) {
                result.data.forEach(template => this.templates.set(template.id, template));
                return result.data;
            }
        } catch (error) {
            appLogger.warn('获取模板失败，使用本地模板:', error);
        }

        return this._getLocalTemplates(category, style);
    }

    /**
     * 获取本地模板
     */
    _getLocalTemplates(category, style) {
        const templates = [
            {
                id: 'portrait',
                name: '人像摄影',
                description: '专业人像摄影风格',
                template: 'professional portrait of {subject}, {expression}, {lighting} lighting, {background} background, high quality, detailed',
                category: 'photography',
                variables: ['subject', 'expression', 'lighting', 'background']
            },
            {
                id: 'landscape',
                name: '风景摄影',
                description: '壮丽风景摄影',
                template: 'breathtaking landscape of {location}, {time_of_day}, {weather}, {mood} atmosphere, ultra detailed, 8k uhd',
                category: 'photography',
                variables: ['location', 'time_of_day', 'weather', 'mood']
            },
            {
                id: 'digital_art',
                name: '数字艺术',
                description: '创意数字艺术作品',
                template: 'digital art of {subject}, {style}, vibrant colors, intricate details, concept art, trending on artstation',
                category: 'art',
                variables: ['subject', 'style']
            }
        ];

        let filtered = templates;
        if (category) filtered = filtered.filter(t => t.category === category);
        if (style) filtered = filtered.filter(t => t.style === style);

        return filtered;
    }

    /**
     * 渲染模板
     */
    renderTemplate(templateId, variables) {
        const template = this.templates.get(templateId) || this._getLocalTemplates().find(t => t.id === templateId);
        if (!template) throw new Error(`模板不存在: ${templateId}`);

        let result = template.template;
        Object.entries(variables).forEach(([key, value]) => {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        });

        return result;
    }

    /**
     * 获取历史记录
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * 清空历史
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * 添加到历史
     */
    _addToHistory(entry) {
        this.history.unshift(entry);
        if (this.history.length > this.maxHistorySize) {
            this.history.pop();
        }
    }

    /**
     * 加载模板
     */
    async _loadTemplates() {
        try {
            const templates = await this.getTemplates();
            appLogger.info(`加载了 ${templates.length} 个Prompt模板`);
        } catch (error) {
            appLogger.warn('加载模板失败:', error);
        }
    }
}

const promptEngine = new PromptIntelligenceEngine();

export { promptEngine, PROMPT_STYLES, TARGET_MODELS };
export default promptEngine;
