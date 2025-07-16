/**
 * AI智能相册系统 - 图像管理器
 * 负责图像的加载、处理、缓存、元数据管理等功能
 */

import { CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from './config.js';
import { FileUtils, StringUtils, AsyncUtils, ValidationUtils, DOMUtils } from './utils.js';
import eventManager from './eventManager.js';
import storageManager from './storageManager.js';

/**
 * 图像元数据管理器
 */
class ImageMetadataManager {
    constructor() {
        this.metadataCache = new Map();
        this.exifReader = null;
    }

    /**
     * 提取图像元数据
     * @param {File} file - 图像文件
     * @returns {Promise<Object>} 元数据对象
     */
    async extractMetadata(file) {
        try {
            const metadata = {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                lastModified: new Date(file.lastModified),
                extractedAt: new Date(),
                basic: await this._extractBasicMetadata(file),
                exif: await this._extractExifData(file),
                computed: {}
            };

            // 计算派生属性
            metadata.computed = this._computeDerivedProperties(metadata);

            return metadata;
        } catch (error) {
            console.error('元数据提取失败:', error);
            return this._createFallbackMetadata(file);
        }
    }

    /**
     * 提取基础元数据
     * @param {File} file - 图像文件
     * @returns {Promise<Object>} 基础元数据
     * @private
     */
    async _extractBasicMetadata(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const metadata = {
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    aspectRatio: img.naturalWidth / img.naturalHeight,
                    megapixels: (img.naturalWidth * img.naturalHeight) / 1000000
                };
                URL.revokeObjectURL(url);
                resolve(metadata);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                console.error(`Failed to load image: ${file.name}`);
                resolve({
                    width: 0,
                    height: 0,
                    aspectRatio: 1,
                    megapixels: 0,
                    error: 'Image load failed'
                });
            };

            img.src = url;
        });
    }

    /**
     * 提取EXIF数据
     * @param {File} file - 图像文件
     * @returns {Promise<Object>} EXIF数据
     * @private
     */
    async _extractExifData(file) {
        try {
            // 这里可以集成EXIF.js库来提取详细的EXIF信息
            // 目前返回基础信息
            return {
                camera: null,
                lens: null,
                settings: {
                    iso: null,
                    aperture: null,
                    shutterSpeed: null,
                    focalLength: null
                },
                location: {
                    latitude: null,
                    longitude: null,
                    altitude: null
                },
                datetime: {
                    taken: null,
                    digitized: null,
                    modified: null
                },
                orientation: 1
            };
        } catch (error) {
            console.warn('EXIF数据提取失败:', error);
            return {};
        }
    }

    /**
     * 计算派生属性
     * @param {Object} metadata - 原始元数据
     * @returns {Object} 派生属性
     * @private
     */
    _computeDerivedProperties(metadata) {
        const { basic } = metadata;
        
        return {
            orientation: this._determineOrientation(basic.aspectRatio),
            quality: this._assessImageQuality(basic, metadata.fileSize),
            category: this._categorizeByDimensions(basic),
            sizeCategory: this._categorizeBySizeCategory(metadata.fileSize),
            displayName: this._generateDisplayName(metadata.fileName)
        };
    }

    /**
     * 确定图像方向
     * @param {number} aspectRatio - 宽高比
     * @returns {string} 方向类型
     * @private
     */
    _determineOrientation(aspectRatio) {
        if (aspectRatio > 1.2) return 'landscape';
        if (aspectRatio < 0.8) return 'portrait';
        return 'square';
    }

    /**
     * 评估图像质量
     * @param {Object} basic - 基础元数据
     * @param {number} fileSize - 文件大小
     * @returns {string} 质量等级
     * @private
     */
    _assessImageQuality(basic, fileSize) {
        const { width, height, megapixels } = basic;
        const compressionRatio = fileSize / (width * height * 3); // 假设24位色深
        
        if (megapixels >= 12 && compressionRatio > 0.1) return 'high';
        if (megapixels >= 6 && compressionRatio > 0.05) return 'medium';
        return 'low';
    }

    /**
     * 按尺寸分类
     * @param {Object} basic - 基础元数据
     * @returns {string} 尺寸类别
     * @private
     */
    _categorizeByDimensions(basic) {
        const { width, height } = basic;
        const maxDimension = Math.max(width, height);
        
        if (maxDimension >= 4000) return 'ultra-high';
        if (maxDimension >= 2000) return 'high';
        if (maxDimension >= 1000) return 'medium';
        return 'low';
    }

    /**
     * 按文件大小分类
     * @param {number} fileSize - 文件大小
     * @returns {string} 大小类别
     * @private
     */
    _categorizeBySizeCategory(fileSize) {
        const sizeMB = fileSize / (1024 * 1024);
        
        if (sizeMB >= 10) return 'large';
        if (sizeMB >= 5) return 'medium';
        if (sizeMB >= 1) return 'small';
        return 'tiny';
    }

    /**
     * 生成显示名称
     * @param {string} fileName - 文件名
     * @returns {string} 显示名称
     * @private
     */
    _generateDisplayName(fileName) {
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
        return StringUtils.truncate(nameWithoutExt, 30);
    }

    /**
     * 创建备用元数据
     * @param {File} file - 图像文件
     * @returns {Object} 备用元数据
     * @private
     */
    _createFallbackMetadata(file) {
        return {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            lastModified: new Date(file.lastModified),
            extractedAt: new Date(),
            basic: {
                width: 0,
                height: 0,
                aspectRatio: 1,
                megapixels: 0
            },
            exif: {},
            computed: {
                orientation: 'unknown',
                quality: 'unknown',
                category: 'unknown',
                sizeCategory: 'unknown',
                displayName: file.name
            },
            error: true
        };
    }
}

/**
 * 图像缓存管理器
 */
class ImageCacheManager {
    constructor() {
        this.cache = new Map();
        this.thumbnailCache = new Map();
        this.maxCacheSize = CONFIG.IMAGE.MAX_CACHE_SIZE;
        this.maxThumbnailCacheSize = CONFIG.IMAGE.MAX_THUMBNAIL_CACHE_SIZE;
        this.compressionQuality = CONFIG.IMAGE.COMPRESSION_QUALITY;
    }

    /**
     * 获取缓存的图像
     * @param {string} key - 缓存键
     * @returns {string|null} 图像URL或null
     */
    get(key) {
        if (this.cache.has(key)) {
            const item = this.cache.get(key);
            item.lastAccessed = Date.now();
            return item.url;
        }
        return null;
    }

    /**
     * 缓存图像
     * @param {string} key - 缓存键
     * @param {string} url - 图像URL
     * @param {Object} metadata - 元数据
     */
    set(key, url, metadata = {}) {
        // 检查缓存大小限制
        if (this.cache.size >= this.maxCacheSize) {
            this._evictLeastRecentlyUsed();
        }

        this.cache.set(key, {
            url,
            metadata,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            size: this._estimateSize(url)
        });
    }

    /**
     * 获取缓存的缩略图
     * @param {string} key - 缓存键
     * @returns {string|null} 缩略图URL或null
     */
    getThumbnail(key) {
        if (this.thumbnailCache.has(key)) {
            const item = this.thumbnailCache.get(key);
            item.lastAccessed = Date.now();
            return item.url;
        }
        return null;
    }

    /**
     * 缓存缩略图
     * @param {string} key - 缓存键
     * @param {string} url - 缩略图URL
     */
    setThumbnail(key, url) {
        if (this.thumbnailCache.size >= this.maxThumbnailCacheSize) {
            this._evictLeastRecentlyUsedThumbnail();
        }

        this.thumbnailCache.set(key, {
            url,
            createdAt: Date.now(),
            lastAccessed: Date.now()
        });
    }

    /**
     * 生成缩略图
     * @param {File|string} source - 图像文件或URL
     * @param {number} maxSize - 最大尺寸
     * @returns {Promise<string>} 缩略图URL
     */
    async generateThumbnail(source, maxSize = CONFIG.IMAGE.THUMBNAIL_SIZE) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            return new Promise((resolve, reject) => {
                img.onload = () => {
                    // 计算缩略图尺寸
                    const { width, height } = this._calculateThumbnailSize(
                        img.naturalWidth,
                        img.naturalHeight,
                        maxSize
                    );

                    canvas.width = width;
                    canvas.height = height;

                    // 绘制缩略图
                    ctx.drawImage(img, 0, 0, width, height);

                    // 转换为Blob URL
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const url = URL.createObjectURL(blob);
                            resolve(url);
                        } else {
                            reject(new Error('缩略图生成失败'));
                        }
                    }, 'image/jpeg', this.compressionQuality);
                };

                img.onerror = () => reject(new Error('图像加载失败'));

                if (source instanceof File) {
                    img.src = URL.createObjectURL(source);
                } else {
                    img.src = source;
                }
            });
        } catch (error) {
            console.error('缩略图生成失败:', error);
            throw error;
        }
    }

    /**
     * 计算缩略图尺寸
     * @param {number} originalWidth - 原始宽度
     * @param {number} originalHeight - 原始高度
     * @param {number} maxSize - 最大尺寸
     * @returns {Object} 缩略图尺寸
     * @private
     */
    _calculateThumbnailSize(originalWidth, originalHeight, maxSize) {
        const aspectRatio = originalWidth / originalHeight;
        
        let width, height;
        
        if (originalWidth > originalHeight) {
            width = Math.min(originalWidth, maxSize);
            height = width / aspectRatio;
        } else {
            height = Math.min(originalHeight, maxSize);
            width = height * aspectRatio;
        }
        
        return {
            width: Math.round(width),
            height: Math.round(height)
        };
    }

    /**
     * 估算图像大小
     * @param {string} url - 图像URL
     * @returns {number} 估算大小（字节）
     * @private
     */
    _estimateSize(url) {
        // 简单估算，实际应用中可以更精确
        return url.length * 0.75; // Base64编码大约增加33%
    }

    /**
     * 清除最近最少使用的缓存项
     * @private
     */
    _evictLeastRecentlyUsed() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, item] of this.cache.entries()) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            const item = this.cache.get(oldestKey);
            URL.revokeObjectURL(item.url);
            this.cache.delete(oldestKey);
        }
    }

    /**
     * 清除最近最少使用的缩略图缓存项
     * @private
     */
    _evictLeastRecentlyUsedThumbnail() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, item] of this.thumbnailCache.entries()) {
            if (item.lastAccessed < oldestTime) {
                oldestTime = item.lastAccessed;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            const item = this.thumbnailCache.get(oldestKey);
            URL.revokeObjectURL(item.url);
            this.thumbnailCache.delete(oldestKey);
        }
    }

    /**
     * 清理所有缓存
     */
    clear() {
        // 释放所有URL对象
        for (const item of this.cache.values()) {
            URL.revokeObjectURL(item.url);
        }
        for (const item of this.thumbnailCache.values()) {
            URL.revokeObjectURL(item.url);
        }
        
        this.cache.clear();
        this.thumbnailCache.clear();
    }

    /**
     * 获取缓存统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            thumbnailCacheSize: this.thumbnailCache.size,
            maxCacheSize: this.maxCacheSize,
            maxThumbnailCacheSize: this.maxThumbnailCacheSize,
            totalMemoryUsage: this._calculateTotalMemoryUsage()
        };
    }

    /**
     * 计算总内存使用量
     * @returns {number} 内存使用量（字节）
     * @private
     */
    _calculateTotalMemoryUsage() {
        let total = 0;
        
        for (const item of this.cache.values()) {
            total += item.size || 0;
        }
        
        // 缩略图通常较小，简单估算
        total += this.thumbnailCache.size * 10000; // 假设每个缩略图10KB
        
        return total;
    }
}

/**
 * 图像处理器
 */
class ImageProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * 压缩图像
     * @param {File} file - 原始图像文件
     * @param {Object} options - 压缩选项
     * @returns {Promise<Blob>} 压缩后的图像Blob
     */
    async compressImage(file, options = {}) {
        const {
            maxWidth = CONFIG.IMAGE.MAX_WIDTH,
            maxHeight = CONFIG.IMAGE.MAX_HEIGHT,
            quality = CONFIG.IMAGE.COMPRESSION_QUALITY,
            format = 'image/jpeg'
        } = options;

        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                try {
                    // 计算新尺寸
                    const { width, height } = this._calculateCompressedSize(
                        img.naturalWidth,
                        img.naturalHeight,
                        maxWidth,
                        maxHeight
                    );

                    // 设置画布尺寸
                    this.canvas.width = width;
                    this.canvas.height = height;

                    // 绘制压缩后的图像
                    this.ctx.drawImage(img, 0, 0, width, height);

                    // 转换为Blob
                    this.canvas.toBlob((blob) => {
                        URL.revokeObjectURL(url);
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('图像压缩失败'));
                        }
                    }, format, quality);
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图像加载失败'));
            };

            img.src = url;
        });
    }

    /**
     * 计算压缩后的尺寸
     * @param {number} originalWidth - 原始宽度
     * @param {number} originalHeight - 原始高度
     * @param {number} maxWidth - 最大宽度
     * @param {number} maxHeight - 最大高度
     * @returns {Object} 压缩后的尺寸
     * @private
     */
    _calculateCompressedSize(originalWidth, originalHeight, maxWidth, maxHeight) {
        let { width, height } = { width: originalWidth, height: originalHeight };
        
        // 按比例缩放
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        
        return {
            width: Math.round(width),
            height: Math.round(height)
        };
    }

    /**
     * 旋转图像
     * @param {HTMLImageElement} img - 图像元素
     * @param {number} degrees - 旋转角度
     * @returns {Promise<string>} 旋转后的图像URL
     */
    async rotateImage(img, degrees) {
        return new Promise((resolve, reject) => {
            try {
                const radians = (degrees * Math.PI) / 180;
                const cos = Math.abs(Math.cos(radians));
                const sin = Math.abs(Math.sin(radians));
                
                const newWidth = img.naturalWidth * cos + img.naturalHeight * sin;
                const newHeight = img.naturalWidth * sin + img.naturalHeight * cos;
                
                this.canvas.width = newWidth;
                this.canvas.height = newHeight;
                
                this.ctx.translate(newWidth / 2, newHeight / 2);
                this.ctx.rotate(radians);
                this.ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
                
                this.canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    } else {
                        reject(new Error('图像旋转失败'));
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 应用滤镜
     * @param {HTMLImageElement} img - 图像元素
     * @param {string} filter - 滤镜类型
     * @returns {Promise<string>} 处理后的图像URL
     */
    async applyFilter(img, filter) {
        return new Promise((resolve, reject) => {
            try {
                this.canvas.width = img.naturalWidth;
                this.canvas.height = img.naturalHeight;
                
                // 应用CSS滤镜
                this.ctx.filter = this._getFilterCSS(filter);
                this.ctx.drawImage(img, 0, 0);
                
                this.canvas.toBlob((blob) => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    } else {
                        reject(new Error('滤镜应用失败'));
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 获取滤镜CSS
     * @param {string} filter - 滤镜类型
     * @returns {string} CSS滤镜字符串
     * @private
     */
    _getFilterCSS(filter) {
        const filters = {
            'grayscale': 'grayscale(100%)',
            'sepia': 'sepia(100%)',
            'blur': 'blur(2px)',
            'brightness': 'brightness(120%)',
            'contrast': 'contrast(120%)',
            'saturate': 'saturate(150%)',
            'vintage': 'sepia(50%) contrast(120%) brightness(110%)'
        };
        
        return filters[filter] || 'none';
    }
}

/**
 * 主图像管理器
 */
class ImageManager {
    constructor() {
        this.metadataManager = new ImageMetadataManager();
        this.cacheManager = new ImageCacheManager();
        this.processor = new ImageProcessor();
        this.loadedImages = new Map();
        this.loadingPromises = new Map();
        this.supportedFormats = CONFIG.IMAGE.SUPPORTED_FORMATS;
        this.isInitialized = false;
        
        // 绑定事件监听器
        this._bindEvents();
    }

    /**
     * 初始化图片管理器
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            console.log('ImageManager: 正在初始化图片管理器...');
            
            // 这里可以添加任何需要的初始化逻辑
            // 比如预加载某些资源、验证配置等
            
            this.isInitialized = true;
            console.log('ImageManager: 图片管理器初始化完成');
            
        } catch (error) {
            console.error('ImageManager: 初始化失败:', error);
            throw error;
        }
    }

    /**
     * 加载图像
     * @param {File|string} source - 图像文件或URL
     * @param {Object} options - 加载选项
     * @returns {Promise<Object>} 图像对象
     */
    async loadImage(source, options = {}) {
        const {
            generateThumbnail = true,
            extractMetadata = true,
            useCache = true,
            priority = 'normal'
        } = options;

        try {
            // 生成缓存键
            const cacheKey = this._generateCacheKey(source);
            
            // 检查缓存
            if (useCache && this.loadedImages.has(cacheKey)) {
                return this.loadedImages.get(cacheKey);
            }
            
            // 检查是否正在加载
            if (this.loadingPromises.has(cacheKey)) {
                return this.loadingPromises.get(cacheKey);
            }
            
            // 开始加载
            const loadingPromise = this._loadImageInternal(source, {
                generateThumbnail,
                extractMetadata,
                cacheKey,
                priority
            });
            
            this.loadingPromises.set(cacheKey, loadingPromise);
            
            const result = await loadingPromise;
            
            // 缓存结果
            if (useCache) {
                this.loadedImages.set(cacheKey, result);
            }
            
            this.loadingPromises.delete(cacheKey);
            
            return result;
            
        } catch (error) {
            console.error('图像加载失败:', error);
            throw error;
        }
    }

    /**
     * 内部图像加载方法
     * @param {File|string} source - 图像源
     * @param {Object} options - 选项
     * @returns {Promise<Object>} 图像对象
     * @private
     */
    async _loadImageInternal(source, options) {
        const { generateThumbnail, extractMetadata, cacheKey, priority } = options;
        
        // 触发加载开始事件
        eventManager.emitImageLoading({
            cacheKey,
            source: source instanceof File ? source.name : source,
            priority
        });
        
        const imageObj = {
            id: StringUtils.generateId(),
            cacheKey,
            source,
            url: null,
            thumbnailUrl: null,
            metadata: null,
            element: null,
            loadedAt: new Date(),
            error: null
        };
        
        try {
            // 创建图像URL
            if (source instanceof File) {
                imageObj.url = URL.createObjectURL(source);
            } else {
                imageObj.url = source;
            }
            
            // 创建图像元素
            imageObj.element = await this._createImageElement(imageObj.url);
            
            // 并行执行元数据提取和缩略图生成
            const tasks = [];
            
            if (extractMetadata && source instanceof File) {
                tasks.push(
                    this.metadataManager.extractMetadata(source)
                        .then(metadata => {
                            imageObj.metadata = metadata;
                        })
                        .catch(error => {
                            console.warn('元数据提取失败:', error);
                            imageObj.metadata = this.metadataManager._createFallbackMetadata(source);
                        })
                );
            }
            
            if (generateThumbnail) {
                tasks.push(
                    this.cacheManager.generateThumbnail(source)
                        .then(thumbnailUrl => {
                            imageObj.thumbnailUrl = thumbnailUrl;
                            this.cacheManager.setThumbnail(cacheKey, thumbnailUrl);
                        })
                        .catch(error => {
                            console.warn('缩略图生成失败:', error);
                        })
                );
            }
            
            await Promise.allSettled(tasks);
            
            // 缓存图像
            this.cacheManager.set(cacheKey, imageObj.url, imageObj.metadata);
            
            // 触发加载完成事件
            eventManager.emitImageLoaded({
                imageObj,
                loadTime: Date.now() - imageObj.loadedAt.getTime()
            });
            
            return imageObj;
            
        } catch (error) {
            imageObj.error = error;
            
            // 触发加载失败事件
            eventManager.emit('image:load-failed', {
                cacheKey,
                error: error.message
            });
            
            throw error;
        }
    }

    /**
     * 创建图像元素
     * @param {string} url - 图像URL
     * @returns {Promise<HTMLImageElement>} 图像元素
     * @private
     */
    _createImageElement(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('图像加载失败'));
            
            img.src = url;
        });
    }

    /**
     * 生成缓存键
     * @param {File|string} source - 图像源
     * @returns {string} 缓存键
     * @private
     */
    _generateCacheKey(source) {
        if (source instanceof File) {
            return `file:${source.name}:${source.size}:${source.lastModified}`;
        }
        return `url:${StringUtils.hash(source)}`;
    }

    /**
     * 批量加载图像
     * @param {Array} sources - 图像源数组
     * @param {Object} options - 加载选项
     * @returns {Promise<Array>} 图像对象数组
     */
    async loadImages(sources, options = {}) {
        const {
            concurrency = CONFIG.IMAGE.CONCURRENT_LOADS,
            onProgress = null
        } = options;
        
        const results = [];
        let completed = 0;
        
        // 分批处理
        for (let i = 0; i < sources.length; i += concurrency) {
            const batch = sources.slice(i, i + concurrency);
            const batchPromises = batch.map(async (source) => {
                try {
                    const result = await this.loadImage(source, options);
                    completed++;
                    
                    if (onProgress) {
                        onProgress({
                            completed,
                            total: sources.length,
                            percentage: (completed / sources.length) * 100
                        });
                    }
                    
                    return result;
                } catch (error) {
                    completed++;
                    console.error('批量加载中的图像失败:', error);
                    return null;
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : null));
        }
        
        return results.filter(Boolean);
    }

    /**
     * 验证图像文件
     * @param {File} file - 图像文件
     * @returns {Object} 验证结果
     */
    validateImageFile(file) {
        const errors = [];
        
        // 检查文件类型
        if (!this.supportedFormats.includes(file.type)) {
            errors.push(`不支持的文件格式: ${file.type}`);
        }
        
        // 检查文件大小
        if (file.size > CONFIG.IMAGE.MAX_FILE_SIZE) {
            errors.push(`文件过大: ${FileUtils.formatSize(file.size)} > ${FileUtils.formatSize(CONFIG.IMAGE.MAX_FILE_SIZE)}`);
        }
        
        if (file.size === 0) {
            errors.push('文件为空');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 获取图像信息
     * @param {string} cacheKey - 缓存键
     * @returns {Object|null} 图像信息
     */
    getImageInfo(cacheKey) {
        return this.loadedImages.get(cacheKey) || null;
    }

    /**
     * 移除图像
     * @param {string} cacheKey - 缓存键
     */
    removeImage(cacheKey) {
        const imageObj = this.loadedImages.get(cacheKey);
        if (imageObj) {
            // 释放URL对象
            if (imageObj.url && imageObj.source instanceof File) {
                URL.revokeObjectURL(imageObj.url);
            }
            if (imageObj.thumbnailUrl) {
                URL.revokeObjectURL(imageObj.thumbnailUrl);
            }
            
            this.loadedImages.delete(cacheKey);
        }
    }

    /**
     * 清理所有图像
     */
    clear() {
        // 释放所有URL对象
        for (const imageObj of this.loadedImages.values()) {
            if (imageObj.url && imageObj.source instanceof File) {
                URL.revokeObjectURL(imageObj.url);
            }
            if (imageObj.thumbnailUrl) {
                URL.revokeObjectURL(imageObj.thumbnailUrl);
            }
        }
        
        this.loadedImages.clear();
        this.loadingPromises.clear();
        this.cacheManager.clear();
    }

    /**
     * 获取所有已加载的图片
     * @returns {Promise<Array>} 图片对象数组
     */
    async getAllImages() {
        // 返回所有已加载的图片对象
        const images = Array.from(this.loadedImages.values());
        
        // 如果没有图片，返回空数组
        if (images.length === 0) {
            console.log('ImageManager: 当前没有已加载的图片');
            return [];
        }
        
        return images;
    }

    /**
     * 获取管理器统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            loadedImages: this.loadedImages.size,
            loadingImages: this.loadingPromises.size,
            cacheStats: this.cacheManager.getStats(),
            supportedFormats: this.supportedFormats
        };
    }

    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        // 监听页面卸载事件，清理资源
        window.addEventListener('beforeunload', () => {
            this.clear();
        });
        
        // 监听内存压力事件
        if ('memory' in performance) {
            setInterval(() => {
                const memInfo = performance.memory;
                const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
                
                if (usageRatio > 0.8) {
                    console.warn('内存使用率过高，清理图像缓存');
                    this._cleanupMemory();
                }
            }, 30000); // 每30秒检查一次
        }
    }

    /**
     * 清理内存
     * @private
     */
    _cleanupMemory() {
        // 清理最旧的50%图像
        const images = Array.from(this.loadedImages.entries())
            .sort((a, b) => a[1].loadedAt - b[1].loadedAt);
        
        const toRemove = images.slice(0, Math.floor(images.length * 0.5));
        
        for (const [cacheKey] of toRemove) {
            this.removeImage(cacheKey);
        }
        
        // 清理缓存管理器
        this.cacheManager.clear();
        
        console.log(`已清理 ${toRemove.length} 个图像以释放内存`);
    }
}

// 创建全局图像管理器实例
const imageManager = new ImageManager();

export {
    ImageMetadataManager,
    ImageCacheManager,
    ImageProcessor,
    ImageManager
};

export default imageManager;