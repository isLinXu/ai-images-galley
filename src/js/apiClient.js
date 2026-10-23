/**
 * AI智能相册系统 - API客户端模块
 * 统一封装前后端通信，支持请求/响应拦截、错误重试、JWT认证、缓存
 */

import { appLogger } from './logger.js';

function readApiBaseUrl() {
    try {
        return localStorage.getItem('api_base_url') || 'http://localhost:8000/api/v1';
    } catch {
        return 'http://localhost:8000/api/v1';
    }
}

/**
 * API配置
 */
const API_CONFIG = {
    BASE_URL: readApiBaseUrl(),
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
            let token = '';
            try {
                token = localStorage.getItem('auth_token') || '';
            } catch {
                token = '';
            }
            if (token) {
                config.headers = config.headers || {};
                config.headers['Authorization'] = `Bearer ${token}`;
            }
            return config;
        });

        // 默认响应拦截器 - 处理通用错误（不在这里重新抛出，由 _executeRequest 统一抛出）
        this.addResponseInterceptor(
            (response) => response,
            async (error) => {
                if (error.status === 401) {
                    try {
                        localStorage.removeItem('auth_token');
                    } catch {
                        // ignore
                    }
                    window.dispatchEvent(new CustomEvent('api:unauthorized'));
                }
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
                appLogger.warn('响应拦截器执行失败:', error.message);
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
        const fetchOptions = { ...options };
        delete fetchOptions.timeout;

        try {
            return await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('请求超时');
            }
            throw error;
        } finally {
            clearTimeout(id);
        }
    }

    /**
     * 发送请求（带重试）
     */
    async _request(endpoint, options = {}, retryCount = this.retryCount) {
        const url = this._buildURL(endpoint);
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        const hasBody = options.body !== undefined && options.body !== null;

        const defaultHeaders = { Accept: 'application/json' };
        if (hasBody && !isFormData) {
            defaultHeaders['Content-Type'] = 'application/json';
        }

        let config = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...(options.headers || {})
            }
        };

        // 执行请求拦截器
        config = await this._runRequestInterceptors(config);

        // 检查重复请求；FormData 的内容无法稳定序列化，不做去重
        const requestKey = `${url}:${JSON.stringify({
            method: config.method || 'GET',
            body: isFormData ? null : config.body,
            headers: config.headers
        })}`;

        if (!isFormData && this.pendingRequests.has(requestKey)) {
            return this.pendingRequests.get(requestKey);
        }

        const requestPromise = this._executeRequest(url, config, retryCount);
        if (!isFormData) {
            this.pendingRequests.set(requestKey, requestPromise);
        }

        try {
            return await requestPromise;
        } finally {
            if (!isFormData) {
                this.pendingRequests.delete(requestKey);
            }
        }
    }

    /**
     * 执行请求
     */
    async _executeRequest(url, config, retryCount) {
        let lastError;
        const method = (config.method || 'GET').toUpperCase();
        // POST 通常不是幂等操作（例如上传），不应自动重试。
        const retryableMethod = ['GET', 'HEAD', 'PUT', 'DELETE'].includes(method);

        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                appLogger.info(`API请求: ${method} ${url} (尝试 ${attempt + 1}/${retryCount + 1})`);

                const response = await this._fetchWithTimeout(url, config, config.timeout || this.timeout);

                // 处理响应
                let data;
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                if (!response.ok) {
                    const message =
                        typeof data === 'string'
                            ? data
                            : (data && (data.detail || data.message || data.error)) || `HTTP ${response.status}`;
                    const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
                    error.status = response.status;
                    error.data = data;
                    throw error;
                }

                return await this._runResponseInterceptors(data);
            } catch (error) {
                lastError = error;

                const status = error.status;
                const nonRetryableStatus = [400, 401, 403, 404, 405, 409, 422].includes(status);
                if (!retryableMethod || nonRetryableStatus) {
                    break;
                }

                if (attempt < retryCount) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    appLogger.warn(`请求失败，${delay}ms后重试: ${error.message}`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
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

        // 构建查询字符串，过滤 undefined/null/空字符串，避免发送 "undefined"
        const query = new URLSearchParams();
        Object.entries(params || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                query.set(key, String(value));
            }
        });
        const queryString = query.toString();
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
        const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
        return this._request(endpoint, {
            method: 'POST',
            body: isFormData ? data : JSON.stringify(data),
            ...options
        });
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
            files.forEach((file) => formData.append('files', file));
        } else {
            formData.append('file', files);
        }

        // 添加额外数据
        Object.entries(additionalData || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, typeof value === 'string' ? value : JSON.stringify(value));
            }
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
        try {
            localStorage.setItem('api_base_url', url);
        } catch {
            // ignore
        }
        this.cache.clear();
    }

    /**
     * 设置认证Token
     */
    setToken(token) {
        try {
            if (token) {
                localStorage.setItem('auth_token', token);
            } else {
                localStorage.removeItem('auth_token');
            }
        } catch {
            // ignore
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

function withQuery(endpoint, params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const text = query.toString();
    return text ? `${endpoint}?${text}` : endpoint;
}

/**
 * 图像管理API
 */
export const imageAPI = {
    upload: (file, metadata) => apiClient.upload('/images/upload', file, metadata),
    uploadBatch: (files) => apiClient.upload('/images/upload/batch', files),
    list: (limit = 100, offset = 0) => apiClient.get('/images', { limit, offset }),
    get: (imageId) => apiClient.get(`/images/${encodeURIComponent(imageId)}`),
    delete: (imageId) => apiClient.delete(`/images/${encodeURIComponent(imageId)}`),
    compress: (imageId, options = {}) =>
        apiClient.post(withQuery(`/images/${encodeURIComponent(imageId)}/compress`, options))
};

/**
 * AI分析API
 */
export const analysisAPI = {
    analyze: (request, options = {}) => apiClient.post('/analysis', request, { timeout: 60000, ...options }),
    analyzeUrl: (request, options = {}) => apiClient.post('/analysis/url', request, { timeout: 60000, ...options }),
    classify: (imageId, topK = 5) =>
        apiClient.post(withQuery('/analysis/classify', { image_id: imageId, top_k: topK })),
    detect: (imageId, threshold = 0.3) =>
        apiClient.post(
            withQuery('/analysis/detect', {
                image_id: imageId,
                confidence_threshold: threshold
            })
        ),
    caption: (imageId, language = 'zh', style = 'descriptive') =>
        apiClient.post(
            withQuery('/analysis/caption', {
                image_id: imageId,
                language,
                style
            })
        ),
    colors: (imageId, numColors = 5) =>
        apiClient.post(
            withQuery('/analysis/colors', {
                image_id: imageId,
                num_colors: numColors
            })
        ),
    tags: (imageId, maxTags = 10) =>
        apiClient.post(
            withQuery('/analysis/tags', {
                image_id: imageId,
                max_tags: maxTags
            })
        )
};

/**
 * Prompt智能API
 */
export const promptAPI = {
    optimize: (request) =>
        apiClient.post('/prompts/optimize', {
            ...request,
            // 后端枚举为小写，前端 UI 使用大写 key
            style: request.style ? String(request.style).toLowerCase() : null
        }),
    translate: (prompt, targetLanguage = 'en') =>
        apiClient.post(
            withQuery('/prompts/translate', {
                prompt,
                target_language: targetLanguage
            })
        ),
    getTemplates: (category, style) => apiClient.get('/prompts/templates', { category, style }),
    getTemplate: (templateId) => apiClient.get(`/prompts/templates/${encodeURIComponent(templateId)}`),
    renderTemplate: (templateId, variables) =>
        apiClient.post(`/prompts/templates/${encodeURIComponent(templateId)}/render`, variables),
    generateNegative: (prompt, intensity = 'medium') =>
        apiClient.post(withQuery('/prompts/generate-negative', { prompt, intensity })),
    analyze: (prompt) => apiClient.post(withQuery('/prompts/analyze', { prompt })),
    getStyles: () => apiClient.get('/prompts/styles')
};

/**
 * 多模态API
 */
export const multimodalAPI = {
    imageToText: (request) => apiClient.post('/multimodal/image-to-text', request),
    textToImage: (request) => apiClient.post('/multimodal/text-to-image', request),
    visualQA: (request) => apiClient.post('/multimodal/visual-qa', request),
    styleTransfer: (request) =>
        apiClient.post('/multimodal/style-transfer', {
            ...request,
            target_style: request.target_style ? String(request.target_style).toLowerCase() : request.target_style
        }),
    editImage: (imageId, editPrompt, maskArea) =>
        apiClient.post(
            withQuery('/multimodal/image-edit', {
                image_id: imageId,
                edit_prompt: editPrompt,
                mask_area: maskArea
            })
        ),
    getTaskStatus: (taskId) => apiClient.get(`/multimodal/tasks/${encodeURIComponent(taskId)}`)
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
