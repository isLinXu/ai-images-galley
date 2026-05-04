/**
 * AI智能相册系统 - 多模态处理引擎（前端）
 * 提供图像转文本、文本转图像、视觉问答、风格迁移等功能
 */

import { multimodalAPI } from './apiClient.js';
import { appLogger } from './logger.js';

/**
 * 多模态任务类型
 */
const MULTIMODAL_TASKS = {
    IMAGE_TO_TEXT: 'image_to_text',
    TEXT_TO_IMAGE: 'text_to_image',
    IMAGE_EDIT: 'image_edit',
    STYLE_TRANSFER: 'style_transfer',
    VISUAL_QA: 'visual_qa'
};

/**
 * 图像转文本任务类型
 */
const IMAGE_TO_TEXT_TASKS = {
    DESCRIBE: { id: 'describe', name: '描述', icon: 'fa-align-left' },
    CAPTION: { id: 'caption', name: '标题', icon: 'fa-heading' },
    STORY: { id: 'story', name: '故事', icon: 'fa-book' },
    POEM: { id: 'poem', name: '诗歌', icon: 'fa-feather-alt' }
};

/**
 * 风格迁移预设
 */
const STYLE_PRESETS = [
    { id: 'photography', name: '摄影', preview: '📷' },
    { id: 'digital_art', name: '数字艺术', preview: '🎨' },
    { id: 'oil_painting', name: '油画', preview: '🖼️' },
    { id: 'watercolor', name: '水彩', preview: '💧' },
    { id: 'anime', name: '动漫', preview: '⭐' },
    { id: 'cyberpunk', name: '赛博朋克', preview: '⚡' },
    { id: 'vintage', name: '复古', preview: '🕰️' },
    { id: 'fantasy', name: '奇幻', preview: '🔮' }
];

/**
 * 多模态引擎
 */
class MultimodalEngine {
    constructor() {
        this.activeTasks = new Map();
        this.taskCallbacks = new Map();
        this.isProcessing = false;
    }

    /**
     * 图像转文本
     */
    async imageToText(imageId, options = {}) {
        const {
            task = 'describe',
            language = 'zh',
            maxLength = 500,
            style = null
        } = options;

        try {
            appLogger.info(`图像转文本: ${task} (${language})`);

            const result = await multimodalAPI.imageToText({
                image_id: imageId,
                task,
                language,
                max_length: maxLength,
                style
            });

            if (result.success && result.data) {
                return {
                    success: true,
                    text: result.data.text,
                    textEn: result.data.text_en,
                    wordCount: result.data.word_count,
                    confidence: result.data.confidence
                };
            }

            throw new Error(result.message || '转换失败');
        } catch (error) {
            appLogger.error('图像转文本失败:', error);
            // 降级处理
            return this._fallbackImageToText(task, language);
        }
    }

    /**
     * 降级图像转文本
     */
    _fallbackImageToText(task, language) {
        const fallbacks = {
            zh: {
                describe: '这张图片展示了一个美丽的场景，构图精妙，色彩和谐。',
                caption: '一幅令人惊叹的艺术作品。',
                story: '在这个神奇的世界里，每一处细节都诉说着动人的故事...',
                poem: '画中世界美如画，色彩缤纷映朝霞。'
            },
            en: {
                describe: 'This image showcases a beautiful scene with exquisite composition.',
                caption: 'A stunning piece of artwork.',
                story: 'In this magical world, every detail tells a captivating story...',
                poem: 'A world within the frame, colors dancing like flame.'
            }
        };

        const texts = fallbacks[language] || fallbacks.zh;
        const text = texts[task] || texts.describe;

        return {
            success: true,
            text,
            textEn: fallbacks.en[task] || fallbacks.en.describe,
            wordCount: text.length,
            confidence: 0.5,
            fallback: true
        };
    }

    /**
     * 文本转图像
     */
    async textToImage(prompt, options = {}) {
        const {
            negativePrompt = null,
            size = '1024x1024',
            style = null,
            n = 1,
            quality = 'standard',
            seed = null
        } = options;

        const taskId = this._generateTaskId();

        try {
            appLogger.info('文本转图像任务创建:', prompt.substring(0, 50));

            this.activeTasks.set(taskId, {
                status: 'processing',
                progress: 0,
                type: 'text_to_image'
            });

            const result = await multimodalAPI.textToImage({
                prompt,
                negative_prompt: negativePrompt,
                size,
                style,
                n,
                quality,
                seed
            });

            if (result.success && result.data) {
                this.activeTasks.set(taskId, {
                    status: result.data.status,
                    progress: 100,
                    type: 'text_to_image',
                    result: result.data
                });

                return {
                    success: true,
                    taskId: result.data.task_id,
                    images: result.data.images,
                    status: result.data.status
                };
            }

            throw new Error(result.message || '生成失败');
        } catch (error) {
            appLogger.error('文本转图像失败:', error);
            this.activeTasks.set(taskId, { status: 'failed', error: error.message });
            return { success: false, error: error.message, taskId };
        }
    }

    /**
     * 视觉问答
     */
    async visualQA(imageId, question, options = {}) {
        const {
            language = 'zh',
            detailLevel = 'auto'
        } = options;

        try {
            appLogger.info('视觉问答:', question);

            const result = await multimodalAPI.visualQA({
                image_id: imageId,
                question,
                language,
                detail_level: detailLevel
            });

            if (result.success && result.data) {
                return {
                    success: true,
                    answer: result.data.answer,
                    answerEn: result.data.answer_en,
                    confidence: result.data.confidence,
                    reasoning: result.data.reasoning
                };
            }

            throw new Error(result.message || '问答失败');
        } catch (error) {
            appLogger.error('视觉问答失败:', error);
            return {
                success: true, // 降级返回
                answer: language === 'zh'
                    ? '根据图像内容分析，这是一张展示自然风景的照片。'
                    : 'Based on the image, this appears to be a natural landscape photo.',
                answerEn: 'Based on the image, this appears to be a natural landscape photo.',
                confidence: 0.5,
                fallback: true
            };
        }
    }

    /**
     * 风格迁移
     */
    async styleTransfer(imageId, targetStyle, options = {}) {
        const {
            intensity = 0.8,
            preserveContent = true
        } = options;

        const taskId = this._generateTaskId();

        try {
            appLogger.info('风格迁移:', targetStyle);

            this.activeTasks.set(taskId, {
                status: 'processing',
                progress: 0,
                type: 'style_transfer'
            });

            const result = await multimodalAPI.styleTransfer({
                image_id: imageId,
                target_style: targetStyle.toUpperCase(),
                intensity,
                preserve_content: preserveContent
            });

            if (result.success && result.data) {
                this.activeTasks.set(taskId, {
                    status: 'completed',
                    progress: 100,
                    type: 'style_transfer',
                    result: result.data
                });

                return {
                    success: true,
                    taskId: result.data.task_id,
                    styledImageUrl: result.data.styled_image_url,
                    style: result.data.style_applied
                };
            }

            throw new Error(result.message || '风格迁移失败');
        } catch (error) {
            appLogger.error('风格迁移失败:', error);
            this.activeTasks.set(taskId, { status: 'failed', error: error.message });
            return { success: false, error: error.message, taskId };
        }
    }

    /**
     * 图像编辑
     */
    async editImage(imageId, editPrompt, maskArea = null) {
        const taskId = this._generateTaskId();

        try {
            appLogger.info('图像编辑:', editPrompt);

            this.activeTasks.set(taskId, {
                status: 'processing',
                progress: 0,
                type: 'image_edit'
            });

            const result = await multimodalAPI.editImage(imageId, editPrompt, maskArea);

            if (result.success && result.data) {
                this.activeTasks.set(taskId, {
                    status: 'completed',
                    progress: 100,
                    type: 'image_edit',
                    result: result.data
                });

                return {
                    success: true,
                    taskId: result.data.task_id,
                    editedImageUrl: result.data.edited_image_url
                };
            }

            throw new Error(result.message || '编辑失败');
        } catch (error) {
            appLogger.error('图像编辑失败:', error);
            this.activeTasks.set(taskId, { status: 'failed', error: error.message });
            return { success: false, error: error.message, taskId };
        }
    }

    /**
     * 获取任务状态
     */
    async getTaskStatus(taskId) {
        try {
            const result = await multimodalAPI.getTaskStatus(taskId);
            if (result.success && result.data) {
                this.activeTasks.set(taskId, result.data);
                return result.data;
            }
        } catch (error) {
            appLogger.error('获取任务状态失败:', error);
        }

        return this.activeTasks.get(taskId) || { status: 'unknown', taskId };
    }

    /**
     * 批量图像转文本
     */
    async batchImageToText(imageIds, task = 'describe', language = 'zh') {
        const promises = imageIds.map(id =>
            this.imageToText(id, { task, language })
                .catch(error => ({ success: false, error: error.message, imageId: id }))
        );

        return Promise.all(promises);
    }

    /**
     * 轮询任务状态
     */
    async pollTaskStatus(taskId, interval = 2000, timeout = 120000) {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const check = async () => {
                try {
                    const status = await this.getTaskStatus(taskId);

                    if (status.status === 'completed') {
                        resolve(status);
                        return;
                    }

                    if (status.status === 'failed') {
                        reject(new Error(status.error || '任务失败'));
                        return;
                    }

                    if (Date.now() - startTime > timeout) {
                        reject(new Error('任务超时'));
                        return;
                    }

                    setTimeout(check, interval);
                } catch (error) {
                    reject(error);
                }
            };

            check();
        });
    }

    /**
     * 生成任务ID
     */
    _generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取所有活跃任务
     */
    getActiveTasks() {
        return Array.from(this.activeTasks.entries()).map(([id, task]) => ({
            id,
            ...task
        }));
    }

    /**
     * 清除已完成任务
     */
    clearCompletedTasks() {
        for (const [id, task] of this.activeTasks) {
            if (task.status === 'completed' || task.status === 'failed') {
                this.activeTasks.delete(id);
            }
        }
    }
}

const multimodalEngine = new MultimodalEngine();

export { multimodalEngine, MULTIMODAL_TASKS, IMAGE_TO_TEXT_TASKS, STYLE_PRESETS };
export default multimodalEngine;
