/**
 * AI智能相册系统 - 图像处理Web Worker
 * 在后台线程中执行图像压缩、缩略图生成、色彩分析等耗时操作
 */

// Web Worker脚本 - 使用Blob URL内联加载
export const ImageProcessingWorkerScript = `
self.onmessage = function(e) {
    const { type, payload, taskId } = e.data;
    
    switch (type) {
        case 'compress':
            handleCompress(payload, taskId);
            break;
        case 'thumbnail':
            handleThumbnail(payload, taskId);
            break;
        case 'colorAnalysis':
            handleColorAnalysis(payload, taskId);
            break;
        case 'exifExtract':
            handleExifExtract(payload, taskId);
            break;
        case 'batchProcess':
            handleBatchProcess(payload, taskId);
            break;
        default:
            self.postMessage({
                taskId,
                type: 'error',
                error: '未知任务类型: ' + type
            });
    }
};

// 图像压缩
async function handleCompress(payload, taskId) {
    try {
        const { imageData, maxWidth = 1920, maxHeight = 1080, quality = 0.85, format = 'image/jpeg' } = payload;
        
        const bitmap = await createImageBitmap(new Blob([imageData]));
        
        // 计算新尺寸
        let { width, height } = bitmap;
        const aspectRatio = width / height;
        
        if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
        }
        if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
        }
        
        // 创建离屏画布
        const canvas = new OffscreenCanvas(Math.round(width), Math.round(height));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);
        
        // 导出Blob
        const blob = await canvas.convertToBlob({ type: format, quality });
        const arrayBuffer = await blob.arrayBuffer();
        
        self.postMessage({
            taskId,
            type: 'success',
            result: {
                data: arrayBuffer,
                width: Math.round(width),
                height: Math.round(height),
                size: blob.size,
                format
            }
        }, [arrayBuffer]);
        
        bitmap.close();
    } catch (error) {
        self.postMessage({ taskId, type: 'error', error: error.message });
    }
}

// 缩略图生成
async function handleThumbnail(payload, taskId) {
    try {
        const { imageData, size = 240 } = payload;
        
        const bitmap = await createImageBitmap(new Blob([imageData]));
        
        let { width, height } = bitmap;
        const aspectRatio = width / height;
        
        if (width > height) {
            width = size;
            height = width / aspectRatio;
        } else {
            height = size;
            width = height * aspectRatio;
        }
        
        const canvas = new OffscreenCanvas(Math.round(width), Math.round(height));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, width, height);
        
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
        const arrayBuffer = await blob.arrayBuffer();
        
        self.postMessage({
            taskId,
            type: 'success',
            result: {
                data: arrayBuffer,
                width: Math.round(width),
                height: Math.round(height)
            }
        }, [arrayBuffer]);
        
        bitmap.close();
    } catch (error) {
        self.postMessage({ taskId, type: 'error', error: error.message });
    }
}

// 色彩分析
async function handleColorAnalysis(payload, taskId) {
    try {
        const { imageData, numColors = 5 } = payload;
        
        const bitmap = await createImageBitmap(new Blob([imageData]));
        
        // 缩小图像以加速处理
        const sampleSize = 100;
        const aspectRatio = bitmap.width / bitmap.height;
        const width = aspectRatio > 1 ? sampleSize : Math.round(sampleSize * aspectRatio);
        const height = aspectRatio > 1 ? Math.round(sampleSize / aspectRatio) : sampleSize;
        
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0, width, height);
        
        const pixelsData = ctx.getImageData(0, 0, width, height);
        const pixels = pixelsData.data;
        
        // 收集颜色
        const colorMap = new Map();
        for (let i = 0; i < pixels.length; i += 4) {
            const r = Math.round(pixels[i] / 16) * 16;
            const g = Math.round(pixels[i + 1] / 16) * 16;
            const b = Math.round(pixels[i + 2] / 16) * 16;
            const key = \`\${r},\${g},\${b}\`;
            colorMap.set(key, (colorMap.get(key) || 0) + 1);
        }
        
        // 排序并获取主要颜色
        const sortedColors = Array.from(colorMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, numColors);
        
        const totalPixels = width * height;
        const colors = sortedColors.map(([rgb, count]) => {
            const [r, g, b] = rgb.split(',').map(Number);
            return {
                hex: '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''),
                rgb: [r, g, b],
                percentage: Math.round((count / totalPixels) * 1000) / 10
            };
        });
        
        self.postMessage({
            taskId,
            type: 'success',
            result: { colors }
        });
        
        bitmap.close();
    } catch (error) {
        self.postMessage({ taskId, type: 'error', error: error.message });
    }
}

// EXIF提取（简化版）
function handleExifExtract(payload, taskId) {
    try {
        const { imageData } = payload;
        
        // 简化的EXIF解析
        const dataView = new DataView(imageData);
        const exifData = {};
        
        // 检查JPEG标记
        if (dataView.getUint16(0) === 0xFFD8) {
            let offset = 2;
            while (offset < dataView.byteLength) {
                const marker = dataView.getUint16(offset);
                if (marker === 0xFFE1) { // APP1 (EXIF)
                    const length = dataView.getUint16(offset + 2);
                    // 简化的EXIF提取
                    exifData.hasExif = true;
                    exifData.length = length;
                    break;
                }
                if (marker === 0xFFD9) break; // EOI
                
                const length = dataView.getUint16(offset + 2);
                offset += 2 + length;
            }
        }
        
        self.postMessage({
            taskId,
            type: 'success',
            result: exifData
        });
    } catch (error) {
        self.postMessage({ taskId, type: 'error', error: error.message });
    }
}

// 批量处理
async function handleBatchProcess(payload, taskId) {
    try {
        const { items, operation } = payload;
        const results = [];
        const errors = [];
        
        for (let i = 0; i < items.length; i++) {
            try {
                const item = items[i];
                // 根据操作类型处理每个项目
                results.push({
                    index: i,
                    status: 'success',
                    result: item
                });
                
                // 发送进度更新
                self.postMessage({
                    taskId,
                    type: 'progress',
                    progress: Math.round(((i + 1) / items.length) * 100),
                    current: i + 1,
                    total: items.length
                });
            } catch (error) {
                errors.push({ index: i, error: error.message });
            }
        }
        
        self.postMessage({
            taskId,
            type: 'success',
            result: { results, errors, total: items.length }
        });
    } catch (error) {
        self.postMessage({ taskId, type: 'error', error: error.message });
    }
}
`;

/**
 * 图像处理Worker管理器
 */
class ImageProcessingWorkerManager {
    constructor() {
        this.worker = null;
        this.pendingTasks = new Map();
        this.taskId = 0;
        this.isSupported = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

        if (this.isSupported) {
            this._initWorker();
        }
    }

    /**
     * 初始化Worker
     */
    _initWorker() {
        try {
            const blob = new Blob([ImageProcessingWorkerScript], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            this.worker = new Worker(workerUrl);

            this.worker.onmessage = (e) => this._handleMessage(e.data);
            this.worker.onerror = (error) => this._handleError(error);

            URL.revokeObjectURL(workerUrl);
        } catch (error) {
            console.warn('Web Worker初始化失败，将使用主线程处理:', error);
            this.isSupported = false;
        }
    }

    /**
     * 处理Worker消息
     */
    _handleMessage(data) {
        const { taskId, type, result, error, progress } = data;
        const task = this.pendingTasks.get(taskId);

        if (!task) return;

        if (type === 'progress' && task.onProgress) {
            task.onProgress(progress);
        } else if (type === 'success') {
            task.resolve(result);
            this.pendingTasks.delete(taskId);
        } else if (type === 'error') {
            task.reject(new Error(error));
            this.pendingTasks.delete(taskId);
        }
    }

    /**
     * 处理Worker错误
     */
    _handleError(error) {
        console.error('Worker错误:', error);
        // 拒绝所有待处理任务
        this.pendingTasks.forEach((task) => {
            task.reject(error);
        });
        this.pendingTasks.clear();
    }

    /**
     * 发送任务到Worker
     */
    _postTask(type, payload, onProgress = null) {
        return new Promise((resolve, reject) => {
            if (!this.isSupported || !this.worker) {
                reject(new Error('Web Worker不支持'));
                return;
            }

            const taskId = ++this.taskId;
            this.pendingTasks.set(taskId, { resolve, reject, onProgress });

            this.worker.postMessage({ type, payload, taskId });
        });
    }

    /**
     * 压缩图像
     */
    async compressImage(file, options = {}) {
        const arrayBuffer = await file.arrayBuffer();

        if (!this.isSupported) {
            // 降级到主线程处理
            return this._compressInMainThread(file, options);
        }

        return this._postTask(
            'compress',
            {
                imageData: arrayBuffer,
                maxWidth: options.maxWidth || 1920,
                maxHeight: options.maxHeight || 1080,
                quality: options.quality || 0.85,
                format: options.format || file.type || 'image/jpeg'
            },
            options.onProgress
        );
    }

    /**
     * 生成缩略图
     */
    async generateThumbnail(file, size = 240) {
        const arrayBuffer = await file.arrayBuffer();

        if (!this.isSupported) {
            return this._thumbnailInMainThread(file, size);
        }

        return this._postTask('thumbnail', {
            imageData: arrayBuffer,
            size
        });
    }

    /**
     * 分析颜色
     */
    async analyzeColors(file, numColors = 5) {
        const arrayBuffer = await file.arrayBuffer();

        if (!this.isSupported) {
            return this._colorAnalysisInMainThread(file, numColors);
        }

        return this._postTask('colorAnalysis', {
            imageData: arrayBuffer,
            numColors
        });
    }

    /**
     * 提取EXIF
     */
    async extractExif(file) {
        const arrayBuffer = await file.arrayBuffer();

        return this._postTask('exifExtract', {
            imageData: arrayBuffer
        });
    }

    /**
     * 批量处理
     */
    async batchProcess(items, operation, onProgress = null) {
        return this._postTask(
            'batchProcess',
            {
                items,
                operation
            },
            onProgress
        );
    }

    /**
     * 终止Worker
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingTasks.clear();
    }

    /**
     * 主线程压缩降级
     */
    async _compressInMainThread(file, options) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let { width, height } = img;
                const aspectRatio = width / height;
                const maxWidth = options.maxWidth || 1920;
                const maxHeight = options.maxHeight || 1080;

                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / aspectRatio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * aspectRatio;
                }

                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        URL.revokeObjectURL(url);
                        if (blob) {
                            resolve({
                                data: blob,
                                width: Math.round(width),
                                height: Math.round(height),
                                size: blob.size,
                                format: options.format || file.type
                            });
                        } else {
                            reject(new Error('压缩失败'));
                        }
                    },
                    options.format || file.type,
                    options.quality || 0.85
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图像加载失败'));
            };

            img.src = url;
        });
    }

    /**
     * 主线程缩略图降级
     */
    async _thumbnailInMainThread(file, size) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let { width, height } = img;
                const aspectRatio = width / height;

                if (width > height) {
                    width = size;
                    height = width / aspectRatio;
                } else {
                    height = size;
                    width = height * aspectRatio;
                }

                canvas.width = Math.round(width);
                canvas.height = Math.round(height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        URL.revokeObjectURL(url);
                        if (blob) {
                            resolve({
                                data: blob,
                                width: Math.round(width),
                                height: Math.round(height)
                            });
                        } else {
                            reject(new Error('缩略图生成失败'));
                        }
                    },
                    'image/jpeg',
                    0.8
                );
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图像加载失败'));
            };

            img.src = url;
        });
    }

    /**
     * 主线程颜色分析降级
     */
    async _colorAnalysisInMainThread(file, numColors) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = 100;
                canvas.height = Math.round(100 * (img.height / img.width));
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;

                const colorMap = new Map();
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = Math.round(pixels[i] / 16) * 16;
                    const g = Math.round(pixels[i + 1] / 16) * 16;
                    const b = Math.round(pixels[i + 2] / 16) * 16;
                    const key = `${r},${g},${b}`;
                    colorMap.set(key, (colorMap.get(key) || 0) + 1);
                }

                const sortedColors = Array.from(colorMap.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, numColors);

                const totalPixels = canvas.width * canvas.height;
                const colors = sortedColors.map(([rgb, count]) => {
                    const [r, g, b] = rgb.split(',').map(Number);
                    return {
                        hex: `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`,
                        rgb: [r, g, b],
                        percentage: Math.round((count / totalPixels) * 1000) / 10
                    };
                });

                URL.revokeObjectURL(url);
                resolve({ colors });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('图像加载失败'));
            };

            img.src = url;
        });
    }
}

const imageWorkerManager = new ImageProcessingWorkerManager();

export { imageWorkerManager, ImageProcessingWorkerManager };
export default imageWorkerManager;
