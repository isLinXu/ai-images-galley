/**
 * AI智能相册系统 - AI分析引擎
 * 集成TensorFlow.js模型，提供图像分类、物体检测等AI功能
 */

import { CONFIG, ERROR_MESSAGES } from './config.js';
import { AsyncUtils, MathUtils, StringUtils } from './utils.js';
import eventManager from './eventManager.js';
import storageManager from './storageManager.js';
import { aiLogger } from './logger.js';

/**
 * TensorFlow.js 模型管理器
 */
class TensorFlowModelManager {
    constructor() {
        this.models = {};
        this.loadingProgress = 0;
        this.isLoaded = false;
        this.loadingPromise = null;
        this.retryCount = 0;
        this.maxRetries = CONFIG.GITHUB.RETRY_COUNT;
    }



    /**
     * 加载所有模型
     * @returns {Promise<boolean>} 是否成功加载
     */
    async loadModels() {
        try {
            this.isLoading = true;
            this.loadingProgress = 0;

            aiLogger.info('开始加载AI模型...');

            // 并行加载模型
            const [mobileNetSuccess, cocoSsdSuccess] = await Promise.all([
                this._loadMobileNet().then(success => {
                    this.loadingProgress += 50;
                    eventManager.emit('ai:model-progress', { progress: this.loadingProgress });
                    return success;
                }),
                this._loadCocoSsd().then(success => {
                    this.loadingProgress += 50;
                    eventManager.emit('ai:model-progress', { progress: this.loadingProgress });
                    return success;
                })
            ]);

            this.isLoading = false;
            this.loadingProgress = 100;

            const overallSuccess = mobileNetSuccess || cocoSsdSuccess; // 至少一个模型加载成功就算成功

            if (overallSuccess) {
                aiLogger.info('AI模型加载完成 (MobileNet:', mobileNetSuccess, ', COCO-SSD:', cocoSsdSuccess, ')');
                eventManager.emit('ai:models-loaded');
            } else {
                console.warn('所有AI模型加载失败');
                eventManager.emit('ai:models-error', { error: '所有模型加载失败' });
            }

            return overallSuccess;
        } catch (error) {
            this.isLoading = false;
            this.loadingProgress = 0;

            console.warn('AI模型加载异常:', error.message);
            eventManager.emit('ai:models-error', { error: error.message });

            // 重试机制
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                aiLogger.info(`正在重试加载模型 (${this.retryCount}/${this.maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
                return this.loadModels();
            }

            return false;
        }
    }

    /**
     * 内部模型加载方法
     * @returns {Promise<boolean>} 是否加载成功
     * @private
     */
    async _loadModelsInternal() {
        try {
            this.updateProgress(0, '开始加载AI模型...');

            // 检查TensorFlow.js是否可用
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js未加载');
            }

            // 加载MobileNet模型
            this.updateProgress(20, '正在加载MobileNet分类模型...');
            await this._loadMobileNet();

            // 加载COCO-SSD模型
            this.updateProgress(60, '正在加载COCO-SSD检测模型...');
            await this._loadCocoSsd();

            this.updateProgress(100, '所有模型加载完成！');
            this.isLoaded = true;

            // 触发模型加载完成事件
            eventManager.emit('ai:models-loaded', {
                models: Object.keys(this.models),
                loadTime: Date.now()
            });

            return true;

        } catch (error) {
            console.error('AI模型加载失败:', error);

            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                this.updateProgress(0, `加载失败，正在重试 (${this.retryCount}/${this.maxRetries})...`);
                await AsyncUtils.delay(2000);
                return this._loadModelsInternal();
            }

            this.updateProgress(0, ERROR_MESSAGES.MODEL_LOAD_FAILED);

            // 触发模型加载失败事件
            eventManager.emit('ai:models-load-failed', {
                error: error.message,
                retryCount: this.retryCount
            });

            return false;
        }
    }

    /**
     * 加载MobileNet模型
     * @private
     */
    async _loadMobileNet() {
        try {
            if (typeof mobilenet === 'undefined') {
                console.warn('MobileNet库未加载，跳过模型加载');
                return false;
            }

            this.models.mobilenet = await mobilenet.load({
                version: 2,
                alpha: 1.0
            });

            aiLogger.info('MobileNet模型加载成功');
            return true;
        } catch (error) {
            console.warn('MobileNet模型加载失败:', error.message);
            return false;
        }
    }

    /**
     * 加载COCO-SSD模型
     * @private
     */
    async _loadCocoSsd() {
        try {
            if (typeof cocoSsd === 'undefined') {
                console.warn('COCO-SSD库未加载，跳过模型加载');
                return false;
            }

            this.models.cocoSsd = await cocoSsd.load({
                base: 'mobilenet_v2'
            });

            aiLogger.info('COCO-SSD模型加载成功');
            return true;
        } catch (error) {
            console.warn('COCO-SSD模型加载失败:', error.message);
            return false;
        }
    }

    /**
     * 更新加载进度
     * @param {number} percentage - 进度百分比
     * @param {string} message - 进度消息
     */
    updateProgress(percentage, message) {
        this.loadingProgress = percentage;

        // 更新UI进度条
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.querySelector('#model-loading-progress p');

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        if (progressText) {
            progressText.textContent = message;
        }

        // 触发进度更新事件
        eventManager.emit('ai:loading-progress', {
            percentage,
            message
        });
    }

    /**
     * 使用MobileNet进行图像分类
     * @param {HTMLImageElement} imageElement - 图像元素
     * @returns {Promise<Array>} 分类结果
     */
    async classifyImage(imageElement) {
        if (!this.models.mobilenet) {
            throw new Error('MobileNet模型未加载');
        }

        try {
            const predictions = await this.models.mobilenet.classify(imageElement, 5);
            return predictions.map(pred => ({
                label: pred.className,
                confidence: pred.probability,
                category: 'classification',
                source: 'mobilenet'
            }));
        } catch (error) {
            console.error('图像分类失败:', error);
            throw error;
        }
    }

    /**
     * 使用COCO-SSD进行物体检测
     * @param {HTMLImageElement} imageElement - 图像元素
     * @returns {Promise<Array>} 检测结果
     */
    async detectObjects(imageElement) {
        if (!this.models.cocoSsd) {
            throw new Error('COCO-SSD模型未加载');
        }

        try {
            const predictions = await this.models.cocoSsd.detect(imageElement, 10);
            return predictions.map(pred => ({
                label: pred.class,
                confidence: pred.score,
                category: 'detection',
                bbox: pred.bbox,
                source: 'coco-ssd'
            }));
        } catch (error) {
            console.error('物体检测失败:', error);
            throw error;
        }
    }

    /**
     * 获取模型信息
     * @returns {Object} 模型信息
     */
    getModelInfo() {
        return {
            isLoaded: this.isLoaded,
            loadingProgress: this.loadingProgress,
            availableModels: Object.keys(this.models),
            retryCount: this.retryCount,
            maxRetries: this.maxRetries
        };
    }

    /**
     * 释放模型资源
     */
    dispose() {
        for (const [name, model] of Object.entries(this.models)) {
            if (model && typeof model.dispose === 'function') {
                model.dispose();
                aiLogger.info(`已释放模型: ${name}`);
            }
        }
        this.models = {};
        this.isLoaded = false;
        this.loadingPromise = null;
    }
}

/**
 * 增强的AI分析引擎
 */
class EnhancedAIEngine {
    constructor() {
        this.analysisCache = new Map();
        this.analysisQueue = [];
        this.isProcessing = false;
        this.workers = CONFIG.AI.WORKER_COUNT;
        this.tensorflowManager = new TensorFlowModelManager();
        this.confidenceThreshold = CONFIG.AI.CONFIDENCE_THRESHOLD;
        this.maxCacheSize = CONFIG.AI.MAX_CACHE_SIZE;

        // 绑定事件监听器
        this._bindEvents();
    }

    /**
     * 初始化AI引擎
     * @returns {Promise<boolean>} 是否初始化成功
     */
    async initialize() {
        try {
            aiLogger.info('🤖 开始初始化AI引擎...');

            // 设置10秒超时
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('AI引擎初始化超时（10秒）'));
                }, 10000);
            });

            // 检查TensorFlow.js是否已加载
            if (typeof tf === 'undefined') {
                console.warn('TensorFlow.js库未加载，跳过AI功能初始化');
                eventManager.emit('ai:engine-fallback', {
                    error: 'TensorFlow.js库未加载',
                    timestamp: Date.now()
                });
                return false;
            }

            const success = await Promise.race([
                this.tensorflowManager.loadModels(),
                timeoutPromise
            ]);

            if (success) {
                aiLogger.info('✅ AI引擎初始化成功');
                eventManager.emit('ai:engine-ready');
            } else {
                console.warn('⚠️ AI引擎初始化失败，将使用基础模式');
                eventManager.emit('ai:engine-fallback');
            }
            return success;
        } catch (error) {
            console.warn('⚠️ AI引擎初始化失败:', error.message);
            aiLogger.info('🔄 应用将继续运行，但AI功能将不可用');

            // 触发降级模式事件
            eventManager.emit('ai:engine-fallback', {
                error: error.message,
                timestamp: Date.now()
            });

            return false;
        }
    }

    /**
     * 分析图像
     * @param {Object} imageFile - 图像文件对象
     * @param {HTMLImageElement} imageElement - 图像DOM元素
     * @param {string} priority - 优先级 ('high', 'normal', 'low')
     * @returns {Promise<Object>} 分析结果
     */
    async analyzeImage(imageFile, imageElement, priority = 'normal') {
        const cacheKey = this._generateCacheKey(imageFile, imageElement);

        // 检查缓存
        if (this.analysisCache.has(cacheKey)) {
            const cached = this.analysisCache.get(cacheKey);
            aiLogger.info('使用缓存的分析结果:', cacheKey);
            return cached;
        }

        return new Promise((resolve, reject) => {
            const task = {
                imageFile,
                imageElement,
                cacheKey,
                priority,
                resolve,
                reject,
                timestamp: Date.now()
            };

            // 根据优先级插入队列
            this._insertTaskByPriority(task);
            this._processQueue();
        });
    }

    /**
     * 处理分析队列
     * @private
     */
    async _processQueue() {
        if (this.isProcessing || this.analysisQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            // 并行处理多个任务
            const tasks = this.analysisQueue.splice(0, this.workers);
            const promises = tasks.map(task => this._processTask(task));

            await Promise.allSettled(promises);

            // 继续处理剩余任务
            if (this.analysisQueue.length > 0) {
                setTimeout(() => {
                    this.isProcessing = false;
                    this._processQueue();
                }, 100);
            } else {
                this.isProcessing = false;
            }
        } catch (error) {
            console.error('队列处理错误:', error);
            this.isProcessing = false;
        }
    }

    /**
     * 处理单个分析任务
     * @param {Object} task - 分析任务
     * @private
     */
    async _processTask(task) {
        const { imageFile, imageElement, cacheKey, resolve, reject } = task; // eslint-disable-line no-unused-vars

        try {
            const startTime = Date.now();

            // 执行AI分析
            const result = await this._performAnalysis(imageElement);

            // 后处理分析结果
            const processedResult = this._postProcessResult(result, imageFile);

            // 缓存结果
            this._cacheResult(cacheKey, processedResult);

            // 记录分析时间
            const analysisTime = Date.now() - startTime;
            processedResult.analysisTime = analysisTime;

            aiLogger.info(`图像分析完成: ${cacheKey}, 耗时: ${analysisTime}ms`);

            // 触发分析完成事件
            eventManager.emitImageAnalyzed({
                cacheKey,
                result: processedResult,
                analysisTime
            });

            resolve(processedResult);

        } catch (error) {
            console.error('图像分析失败:', error);

            // 创建基础分析结果
            const fallbackResult = this._createFallbackResult(imageFile, error);
            resolve(fallbackResult);
        }
    }

    /**
     * 执行AI分析
     * @param {HTMLImageElement} imageElement - 图像元素
     * @returns {Promise<Object>} 原始分析结果
     * @private
     */
    async _performAnalysis(imageElement) {
        const results = {
            classifications: [],
            detections: [],
            metadata: {
                timestamp: Date.now(),
                imageSize: {
                    width: imageElement.naturalWidth,
                    height: imageElement.naturalHeight
                }
            }
        };

        // 并行执行分类和检测
        const tasks = [];

        if (this.tensorflowManager.models.mobilenet) {
            tasks.push(
                this.tensorflowManager.classifyImage(imageElement)
                    .then(classifications => {
                        results.classifications = classifications;
                    })
                    .catch(error => {
                        console.warn('图像分类失败:', error);
                    })
            );
        }

        if (this.tensorflowManager.models.cocoSsd) {
            tasks.push(
                this.tensorflowManager.detectObjects(imageElement)
                    .then(detections => {
                        results.detections = detections;
                    })
                    .catch(error => {
                        console.warn('物体检测失败:', error);
                    })
            );
        }

        await Promise.allSettled(tasks);
        return results;
    }

    /**
     * 后处理分析结果
     * @param {Object} rawResult - 原始分析结果
     * @param {Object} imageFile - 图像文件
     * @returns {Object} 处理后的结果
     * @private
     */
    _postProcessResult(rawResult, imageFile) {
        const { classifications, detections, metadata } = rawResult;

        // 过滤低置信度结果
        const filteredClassifications = classifications.filter(
            item => item.confidence >= this.confidenceThreshold
        );
        const filteredDetections = detections.filter(
            item => item.confidence >= this.confidenceThreshold
        );

        // 生成智能标签
        const smartTags = this._generateSmartTags(filteredClassifications, filteredDetections);

        // 计算总体置信度
        const overallConfidence = this._calculateOverallConfidence(
            filteredClassifications,
            filteredDetections
        );

        // 生成描述
        const description = this._generateDescription(filteredClassifications, filteredDetections);

        // 分析图像特征
        const features = this._analyzeImageFeatures(metadata.imageSize, smartTags);

        return {
            confidence: overallConfidence,
            smartTags,
            description,
            features,
            classifications: filteredClassifications,
            detections: filteredDetections,
            metadata: {
                ...metadata,
                fileName: imageFile?.name,
                fileSize: imageFile?.size,
                processingVersion: '1.0.0'
            }
        };
    }

    /**
     * 生成智能标签
     * @param {Array} classifications - 分类结果
     * @param {Array} detections - 检测结果
     * @returns {Array} 智能标签
     * @private
     */
    _generateSmartTags(classifications, detections) {
        const tags = new Set();

        // 从分类结果提取标签
        classifications.forEach(item => {
            const cleanLabel = this._cleanLabel(item.label);
            if (cleanLabel) tags.add(cleanLabel);
        });

        // 从检测结果提取标签
        detections.forEach(item => {
            const cleanLabel = this._cleanLabel(item.label);
            if (cleanLabel) tags.add(cleanLabel);
        });

        // 添加组合标签
        const combinedTags = this._generateCombinedTags(Array.from(tags));
        combinedTags.forEach(tag => tags.add(tag));

        return Array.from(tags).slice(0, 10); // 限制标签数量
    }

    /**
     * 清理标签文本
     * @param {string} label - 原始标签
     * @returns {string} 清理后的标签
     * @private
     */
    _cleanLabel(label) {
        if (!label) return '';

        // 移除特殊字符和数字
        const cleaned = label.replace(/[^a-zA-Z\u4e00-\u9fa5\s]/g, '');

        // 转换为中文（简单映射）
        const translations = {
            'person': '人物',
            'car': '汽车',
            'dog': '狗',
            'cat': '猫',
            'bird': '鸟',
            'flower': '花朵',
            'tree': '树木',
            'building': '建筑',
            'food': '食物',
            'animal': '动物',
            'nature': '自然',
            'landscape': '风景',
            'portrait': '肖像',
            'indoor': '室内',
            'outdoor': '户外'
        };

        const lowerLabel = cleaned.toLowerCase();
        for (const [en, zh] of Object.entries(translations)) {
            if (lowerLabel.includes(en)) {
                return zh;
            }
        }

        return cleaned.trim();
    }

    /**
     * 生成组合标签
     * @param {Array} tags - 基础标签
     * @returns {Array} 组合标签
     * @private
     */
    _generateCombinedTags(tags) {
        const combined = [];

        // 基于标签组合生成新标签
        if (tags.includes('人物') && tags.includes('户外')) {
            combined.push('户外人像');
        }
        if (tags.includes('动物') && tags.includes('自然')) {
            combined.push('野生动物');
        }
        if (tags.includes('建筑') && tags.includes('风景')) {
            combined.push('城市风光');
        }

        return combined;
    }

    /**
     * 计算总体置信度
     * @param {Array} classifications - 分类结果
     * @param {Array} detections - 检测结果
     * @returns {number} 总体置信度
     * @private
     */
    _calculateOverallConfidence(classifications, detections) {
        const allResults = [...classifications, ...detections];

        if (allResults.length === 0) return 0;

        // 加权平均置信度
        const weightedSum = allResults.reduce((sum, item, index) => {
            const weight = Math.exp(-index * 0.1); // 排名越高权重越大
            return sum + item.confidence * weight;
        }, 0);

        const totalWeight = allResults.reduce((sum, _, index) => {
            return sum + Math.exp(-index * 0.1);
        }, 0);

        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    /**
     * 生成图像描述
     * @param {Array} classifications - 分类结果
     * @param {Array} detections - 检测结果
     * @returns {string} 图像描述
     * @private
     */
    _generateDescription(classifications, detections) {
        const descriptions = [];

        if (classifications.length > 0) {
            const topClass = classifications[0];
            descriptions.push(`这是一张关于${this._cleanLabel(topClass.label)}的图片`);
        }

        if (detections.length > 0) {
            const objectCounts = {};
            detections.forEach(detection => {
                const label = this._cleanLabel(detection.label);
                objectCounts[label] = (objectCounts[label] || 0) + 1;
            });

            const objectList = Object.entries(objectCounts)
                .map(([label, count]) => count > 1 ? `${count}个${label}` : label)
                .slice(0, 3)
                .join('、');

            if (objectList) {
                descriptions.push(`图中包含${objectList}`);
            }
        }

        return descriptions.join('，') || '这是一张图片';
    }

    /**
     * 分析图像特征
     * @param {Object} imageSize - 图像尺寸
     * @param {Array} tags - 标签
     * @returns {Object} 图像特征
     * @private
     */
    _analyzeImageFeatures(imageSize, tags) {
        const { width, height } = imageSize;
        const aspectRatio = width / height;

        return {
            aspectRatio,
            orientation: aspectRatio > 1.2 ? 'landscape' : aspectRatio < 0.8 ? 'portrait' : 'square',
            resolution: width * height,
            category: this._categorizeImage(tags),
            complexity: this._calculateComplexity(tags)
        };
    }

    /**
     * 图像分类
     * @param {Array} tags - 标签
     * @returns {string} 图像类别
     * @private
     */
    _categorizeImage(tags) {
        const categories = {
            '人物': ['人物', '肖像', '户外人像'],
            '动物': ['动物', '狗', '猫', '鸟', '野生动物'],
            '风景': ['风景', '自然', '树木', '户外', '城市风光'],
            '建筑': ['建筑', '城市风光'],
            '食物': ['食物'],
            '其他': []
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => tags.includes(keyword))) {
                return category;
            }
        }

        return '其他';
    }

    /**
     * 计算图像复杂度
     * @param {Array} tags - 标签
     * @returns {number} 复杂度分数 (0-1)
     * @private
     */
    _calculateComplexity(tags) {
        // 基于标签数量和多样性计算复杂度
        const tagCount = tags.length;
        const uniqueCategories = new Set(tags.map(tag => this._categorizeImage([tag]))).size;

        const countScore = Math.min(tagCount / 10, 1);
        const diversityScore = Math.min(uniqueCategories / 5, 1);

        return (countScore + diversityScore) / 2;
    }

    /**
     * 创建备用分析结果
     * @param {Object} imageFile - 图像文件
     * @param {Error} error - 错误对象
     * @returns {Object} 备用结果
     * @private
     */
    _createFallbackResult(imageFile, error) {
        return {
            confidence: 0,
            smartTags: ['图片'],
            description: '无法分析此图片',
            features: {
                aspectRatio: 1,
                orientation: 'unknown',
                resolution: 0,
                category: '其他',
                complexity: 0
            },
            classifications: [],
            detections: [],
            metadata: {
                timestamp: Date.now(),
                fileName: imageFile?.name,
                fileSize: imageFile?.size,
                error: error.message,
                fallback: true
            }
        };
    }

    /**
     * 生成缓存键
     * @param {Object} imageFile - 图像文件
     * @param {HTMLImageElement} imageElement - 图像元素
     * @returns {string} 缓存键
     * @private
     */
    _generateCacheKey(imageFile, _imageElement) {
        if (imageFile?.name) {
            return `file:${imageFile.name}:${imageFile.size}`;
        }
        return `url:${StringUtils.generateId()}`;
    }

    /**
     * 缓存分析结果
     * @param {string} key - 缓存键
     * @param {Object} result - 分析结果
     * @private
     */
    _cacheResult(key, result) {
        // 检查缓存大小限制
        if (this.analysisCache.size >= this.maxCacheSize) {
            // 删除最旧的缓存项
            const oldestKey = this.analysisCache.keys().next().value;
            this.analysisCache.delete(oldestKey);
        }

        this.analysisCache.set(key, result);

        // 同时保存到持久化存储
        storageManager.specializedStorage.aiCache.set(key, result);
    }

    /**
     * 按优先级插入任务
     * @param {Object} task - 分析任务
     * @private
     */
    _insertTaskByPriority(task) {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const taskPriority = priorityOrder[task.priority] || 2;

        let insertIndex = this.analysisQueue.length;
        for (let i = 0; i < this.analysisQueue.length; i++) {
            const queuePriority = priorityOrder[this.analysisQueue[i].priority] || 2;
            if (taskPriority > queuePriority) {
                insertIndex = i;
                break;
            }
        }

        this.analysisQueue.splice(insertIndex, 0, task);
    }

    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        // 监听页面卸载事件，清理资源
        window.addEventListener('beforeunload', () => {
            this.dispose();
        });
    }

    /**
     * 获取分析统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            cacheSize: this.analysisCache.size,
            queueLength: this.analysisQueue.length,
            isProcessing: this.isProcessing,
            modelInfo: this.tensorflowManager.getModelInfo(),
            confidenceThreshold: this.confidenceThreshold
        };
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.analysisCache.clear();
        storageManager.specializedStorage.aiCache.clear();
        aiLogger.info('AI分析缓存已清理');
    }

    /**
     * 设置置信度阈值
     * @param {number} threshold - 置信度阈值 (0-1)
     */
    setConfidenceThreshold(threshold) {
        this.confidenceThreshold = MathUtils.clamp(threshold, 0, 1);
        aiLogger.info(`置信度阈值已设置为: ${this.confidenceThreshold}`);
    }

    /**
     * 释放资源
     */
    dispose() {
        this.tensorflowManager.dispose();
        this.analysisCache.clear();
        this.analysisQueue.length = 0;
        this.isProcessing = false;
        aiLogger.info('AI引擎资源已释放');
    }
}

// 创建全局AI引擎实例
const aiEngine = new EnhancedAIEngine();

export {
    TensorFlowModelManager,
    EnhancedAIEngine
};

export default aiEngine;
