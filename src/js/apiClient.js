/**
 * AI智能相册系统 - API客户端模块
 * 统一封装前后端通信，支持请求/响应拦截、错误重试、JWT认证、缓存
 */

import { appLogger } from './logger.js';

/**
 * API配置
 */
const API_CONFIG = {
    BASE_URL: localStorage.getItem('api_base_url') || 'http://localhost:8000/api/v1',
    TIMEOUT: 30000,
    RETRY_COUNT: 3,
    RETRY_DELAY: 1000,
    CACHE_ENABLED: true,
    CACHE_TTL: 5 * 60 * 1000 // 5分钟
};

/**
 * 请求缓存
 */
class RequestCache {
    constructor() {
        this.cache = new Map();
    }

    generateKey(url, params) {
        const paramsStr = params ? JSON.stringify(params) : '';
        return `${url}:${paramsStr}`;
    }

    get(url, params) {
        const key = this.generateKey(url, params);
        const item = this.cache.get(key);

        if (item && Date.now() - item.timestamp < API_CONFIG.CACHE_TTL) {
            return item.data;
        }

        this.cache.delete(key);
        return null;
    }

    set(url, params, data) {
        const key = this.generateKey(url, params);
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    invalidate(url) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(url)) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }
}

/**
 * API客户端
 */
class APIClient {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.timeout = API_CONFIG.TIMEOUT;
        this.retryCount = API_CONFIG.RETRY_COUNT;
        this.retryDelay = API_CONFIG.RETRY_DELAY;
        this.cache = new RequestCache();
        this.pendingRequests = new Map();

        // 请求拦截器
        this.requestInterceptors = [];
        // 响应拦截器
        this.responseInterceptors = [];

        this._setupDefaultInterceptors();
    }

    /**
     * 设置默认拦截器
     */
    _setupDefaultInterceptors() {
        // 默认请求拦截器 - 添加认证头
        this.addRequestInterceptor((config) => {
            const token = localStorage.getItem('auth_token');
            if (token) {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${token}`;
            }
            return config;
        });

        // 默认响应拦截器 - 处理通用错误
        this.addResponseInterceptor(
            (response) => response,
            async (error) => {
                if (error.status === 401) {
                    // Token过期，清除认证状态
                    localStorage.removeItem('auth_token');
                    window.dispatchEvent(new CustomEvent('api:unauthorized'));
                }
                throw error;
            }
        );
    }

    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }

    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(onFulfilled, onRejected) {
        this.responseInterceptors.push({ onFulfilled, onRejected });
    }

    /**
     * 执行请求拦截器
     */
    async _runRequestInterceptors(config) {
        let result = config;
        for (const interceptor of this.requestInterceptors) {
            result = await interceptor(result);
        }
        return result;
    }

    /**
     * 执行响应拦截器
     */
    async _runResponseInterceptors(response, isError = false) {
        for (const interceptor of this.responseInterceptors) {
            try {
                if (isError && interceptor.onRejected) {
                    await interceptor.onRejected(response);
                } else if (!isError && interceptor.onFulfilled) {
                    response = await interceptor.onFulfilled(response);
                }
            } catch (error) {
                if (interceptor.onRejected) {
                    await interceptor.onRejected(error);
                }
            }
        }
        return response;
    }

    /**
     * 构建完整URL
     */
    _buildURL(endpoint) {
        if (endpoint.startsWith('http')) {
            return endpoint;
        }
        const base = this.baseURL.replace(/\/$/, '');
        const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${base}${path}`;
    }

    /**
     * 带超时的fetch
     */
    async _fetchWithTimeout(url, options, timeout) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        }
    }

    /**
     * 发送请求（带重试）
     */
    async _request(endpoint, options = {}, retryCount = this.retryCount) {
        const url = this._buildURL(endpoint);

        // 准备请求配置
        let config = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            ...options
        };

        // 执行请求拦截器
        config = await this._runRequestInterceptors(config);

        // 检查重复请求
        const requestKey = `${url}:${JSON.stringify(config)}`;
        if (this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }

        const requestPromise = this._executeRequest(url, config, retryCount);
        this.pendingRequests.set(requestKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            this.pendingRequests.delete(requestKey);
        }
    }

    /**
     * 执行请求
     */
    async _executeRequest(url, config, retryCount) {
        let lastError;

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                appLogger.info(`API请求: ${config.method || 'GET'} ${url} (尝试 ${attempt + 1}/${retryCount + 1})`);

                const response = await this._fetchWithTimeout(url, config, this.timeout);

                // 处理响应
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                if (!response.ok) {
                    const error = new Error(data.message || data.error || `HTTP ${response.status}`);
                    error.status = response.status;
                    error.data = data;
                    throw error;
                }

                // 执行响应拦截器
                return await this._runResponseInterceptors(data);

            } catch (error) {
                lastError = error;

                // 不重试的情况
                if (error.status === 401 || error.status === 403 || error.status === 404) {
                    break;
                }

                // 等待后重试
                if (attempt < retryCount) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    appLogger.warn(`请求失败，${delay}ms后重试: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        await this._runResponseInterceptors(lastError, true);
        throw lastError;
    }

    /**
     * GET请求
     */
    async get(endpoint, params = {}, options = {}) {
        // 检查缓存
        if (API_CONFIG.CACHE_ENABLED && options.cache !== false) {
            const cached = this.cache.get(endpoint, params);
            if (cached) {
                appLogger.info(`使用缓存数据: ${endpoint}`);
                return cached;
            }
        }

        // 构建查询字符串
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        const response = await this._request(url, {
            method: 'GET',
            ...options
        });

        // 缓存响应
        if (API_CONFIG.CACHE_ENABLED && options.cache !== false) {
            this.cache.set(endpoint, params, response);
        }

        return response;
    }

    /**
     * POST请求
     */
    async post(endpoint, data = {}, options = {}) {
        const config = {
            method: 'POST',
            body: data instanceof FormData ? data : JSON.stringify(data),
            ...options
        };

        if (data instanceof FormData) {
            delete config.headers['Content-Type'];
        }

        return this._request(endpoint, config);
    }

    /**
     * PUT请求
     */
    async put(endpoint, data = {}, options = {}) {
        return this._request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options
        });
    }

    /**
     * DELETE请求
     */
    async delete(endpoint, options = {}) {
        return this._request(endpoint, {
            method: 'DELETE',
            ...options
        });
    }

    /**
     * 上传文件
     */
    async upload(endpoint, files, additionalData = {}, options = {}) {
        const formData = new FormData();

        // 添加文件
        if (Array.isArray(files)) {
            files.forEach(file => formData.append('files', file));
        } else {
            formData.append('file', files);
        }

        // 添加额外数据
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
        });

        return this._request(endpoint, {
            method: 'POST',
            body: formData,
            ...options
        });
    }

    /**
     * 设置基础URL
     */
    setBaseURL(url) {
        this.baseURL = url;
        API_CONFIG.BASE_URL = url;
        localStorage.setItem('api_base_url', url);
    }

    /**
     * 设置认证Token
     */
    setToken(token) {
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    /**
     * 清除缓存
     */
    clearCache() {
        this.cache.clear();
    }
}

/**
 * 创建API客户端实例
 */
const apiClient = new APIClient();

/**
 * 图像管理API
 */
export const imageAPI = {
    upload: (file, metadata) => apiClient.upload('/images/upload', file, metadata),
    uploadBatch: (files) => apiClient.upload('/images/upload/batch', files),
    get: (imageId) => apiClient.get(`/images/${imageId}`),
    delete: (imageId) => apiClient.delete(`/images/${imageId}`),
    compress: (imageId, options) => apiClient.post(`/images/${imageId}/compress`, options)
};

/**
 * AI分析API
 */
export const analysisAPI = {
    analyze: (request) => apiClient.post('/analysis', request),
    classify: (imageId, topK = 5) => apiClient.post(`/analysis/classify?image_id=${imageId}&top_k=${topK}`),
    detect: (imageId, threshold = 0.3) => apiClient.post(`/analysis/detect?image_id=${imageId}&confidence_threshold=${threshold}`),
    caption: (imageId, language = 'zh', style = 'descriptive') =>
        apiClient.post(`/analysis/caption?image_id=${imageId}&language=${language}&style=${style}`),
    colors: (imageId, numColors = 5) => apiClient.post(`/analysis/colors?image_id=${imageId}&num_colors=${numColors}`),
    tags: (imageId, maxTags = 10) => apiClient.post(`/analysis/tags?image_id=${imageId}&max_tags=${maxTags}`)
};

/**
 * Prompt智能API
 */
export const promptAPI = {
    optimize: (request) => apiClient.post('/prompts/optimize', request),
    translate: (prompt, targetLanguage = 'en') => apiClient.post('/prompts/translate', { prompt, target_language: targetLanguage }),
    getTemplates: (category, style) => apiClient.get('/prompts/templates', { category, style }),
    getTemplate: (templateId) => apiClient.get(`/prompts/templates/${templateId}`),
    renderTemplate: (templateId, variables) => apiClient.post(`/prompts/templates/${templateId}/render`, variables),
    generateNegative: (prompt, intensity = 'medium') => apiClient.post('/prompts/generate-negative', { prompt, intensity }),
    analyze: (prompt) => apiClient.post('/prompts/analyze', { prompt }),
    getStyles: () => apiClient.get('/prompts/styles')
};

/**
 * 多模态API
 */
export const multimodalAPI = {
    imageToText: (request) => apiClient.post('/multimodal/image-to-text', request),
    textToImage: (request) => apiClient.post('/multimodal/text-to-image', request),
    visualQA: (request) => apiClient.post('/multimodal/visual-qa', request),
    styleTransfer: (request) => apiClient.post('/multimodal/style-transfer', request),
    editImage: (imageId, editPrompt, maskArea) => apiClient.post('/multimodal/image-edit', { image_id: imageId, edit_prompt: editPrompt, mask_area: maskArea }),
    getTaskStatus: (taskId) => apiClient.get(`/multimodal/tasks/${taskId}`)
};

/**
 * 健康检查API
 */
export const healthAPI = {
    check: () => apiClient.get('/health', {}, { cache: false }),
    detailed: () => apiClient.get('/health/detailed', {}, { cache: false })
};

export { apiClient };
export default apiClient;
