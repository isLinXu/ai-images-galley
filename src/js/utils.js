/**
 * AI智能相册系统 - 工具函数模块
 * 包含各种通用的辅助函数和工具方法
 */

import { CONFIG, PATTERNS, ERROR_MESSAGES } from './config.js';

/**
 * 时间工具函数
 */
export const TimeUtils = {
    /**
     * 获取相对时间描述
     * @param {Date|string} date - 日期
     * @returns {string} 相对时间描述
     */
    getTimeAgo(date) {
        const now = new Date();
        const targetDate = new Date(date);
        const diffMs = now - targetDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffHours < 24) return `${diffHours}小时前`;
        if (diffDays < 30) return `${diffDays}天前`;
        
        return targetDate.toLocaleDateString('zh-CN');
    },
    
    /**
     * 格式化时间戳
     * @param {number|Date} timestamp - 时间戳
     * @returns {string} 格式化的时间字符串
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    },
    
    /**
     * 检查时间是否过期
     * @param {number|Date} timestamp - 时间戳
     * @param {number} expiry - 过期时间（毫秒）
     * @returns {boolean} 是否过期
     */
    isExpired(timestamp, expiry = CONFIG.STORAGE.CACHE_EXPIRY) {
        return Date.now() - new Date(timestamp).getTime() > expiry;
    }
};

/**
 * 验证工具函数
 */
export const ValidationUtils = {
    /**
     * 验证GitHub Token
     * @param {string} token - GitHub Token
     * @returns {Object} 验证结果
     */
    validateGitHubToken(token) {
        if (!token || token.length < CONFIG.SECURITY.TOKEN_MIN_LENGTH) {
            return { valid: false, message: ERROR_MESSAGES.TOKEN_TOO_SHORT };
        }
        
        if (!PATTERNS.GITHUB_TOKEN.test(token) && !PATTERNS.GITHUB_CLASSIC_TOKEN.test(token)) {
            return { valid: false, message: ERROR_MESSAGES.TOKEN_INVALID };
        }
        
        return { valid: true };
    },
    
    /**
     * 验证文件类型
     * @param {File} file - 文件对象
     * @returns {Object} 验证结果
     */
    validateImageFile(file) {
        if (!file) {
            return { valid: false, message: '请选择文件' };
        }
        
        if (file.size > CONFIG.IMAGE.MAX_FILE_SIZE) {
            return { valid: false, message: ERROR_MESSAGES.FILE_TOO_LARGE };
        }
        
        const extension = file.name.split('.').pop().toLowerCase();
        if (!CONFIG.IMAGE.SUPPORTED_FORMATS.includes(extension)) {
            return { valid: false, message: ERROR_MESSAGES.UNSUPPORTED_FORMAT };
        }
        
        return { valid: true };
    },
    
    /**
     * 验证邮箱格式
     * @param {string} email - 邮箱地址
     * @returns {boolean} 是否有效
     */
    validateEmail(email) {
        return PATTERNS.EMAIL.test(email);
    },
    
    /**
     * 验证URL格式
     * @param {string} url - URL地址
     * @returns {boolean} 是否有效
     */
    validateURL(url) {
        return PATTERNS.URL.test(url);
    }
};

/**
 * 字符串工具函数
 */
export const StringUtils = {
    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    /**
     * 截断字符串
     * @param {string} str - 原字符串
     * @param {number} length - 最大长度
     * @param {string} suffix - 后缀
     * @returns {string} 截断后的字符串
     */
    truncate(str, length = 50, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length - suffix.length) + suffix;
    },
    
    /**
     * 转换为驼峰命名
     * @param {string} str - 原字符串
     * @returns {string} 驼峰命名字符串
     */
    toCamelCase(str) {
        return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
    },
    
    /**
     * 转换为短横线命名
     * @param {string} str - 原字符串
     * @returns {string} 短横线命名字符串
     */
    toKebabCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    },
    
    /**
     * 清理HTML标签
     * @param {string} html - HTML字符串
     * @returns {string} 纯文本
     */
    stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    },
    
    /**
     * 转义HTML字符
     * @param {string} str - 原字符串
     * @returns {string} 转义后的字符串
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

/**
 * 数组工具函数
 */
export const ArrayUtils = {
    /**
     * 数组去重
     * @param {Array} arr - 原数组
     * @param {string} key - 去重键名（对象数组）
     * @returns {Array} 去重后的数组
     */
    unique(arr, key = null) {
        if (!key) return [...new Set(arr)];
        const seen = new Set();
        return arr.filter(item => {
            const value = item[key];
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
        });
    },
    
    /**
     * 数组分块
     * @param {Array} arr - 原数组
     * @param {number} size - 块大小
     * @returns {Array} 分块后的数组
     */
    chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    },
    
    /**
     * 数组随机排序
     * @param {Array} arr - 原数组
     * @returns {Array} 随机排序后的数组
     */
    shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },
    
    /**
     * 数组排序（支持多字段）
     * @param {Array} arr - 原数组
     * @param {Array} fields - 排序字段配置
     * @returns {Array} 排序后的数组
     */
    sortBy(arr, fields) {
        return arr.sort((a, b) => {
            for (const field of fields) {
                const { key, order = 'asc' } = typeof field === 'string' ? { key: field } : field;
                const aVal = a[key];
                const bVal = b[key];
                
                if (aVal < bVal) return order === 'asc' ? -1 : 1;
                if (aVal > bVal) return order === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
};

/**
 * 对象工具函数
 */
export const ObjectUtils = {
    /**
     * 深度克隆
     * @param {*} obj - 原对象
     * @returns {*} 克隆后的对象
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        return obj;
    },
    
    /**
     * 深度合并对象
     * @param {Object} target - 目标对象
     * @param {...Object} sources - 源对象
     * @returns {Object} 合并后的对象
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    },
    
    /**
     * 检查是否为对象
     * @param {*} item - 检查项
     * @returns {boolean} 是否为对象
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },
    
    /**
     * 获取嵌套属性值
     * @param {Object} obj - 对象
     * @param {string} path - 属性路径
     * @param {*} defaultValue - 默认值
     * @returns {*} 属性值
     */
    get(obj, path, defaultValue = undefined) {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result == null || typeof result !== 'object') {
                return defaultValue;
            }
            result = result[key];
        }
        
        return result !== undefined ? result : defaultValue;
    },
    
    /**
     * 设置嵌套属性值
     * @param {Object} obj - 对象
     * @param {string} path - 属性路径
     * @param {*} value - 属性值
     */
    set(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
};

/**
 * 文件工具函数
 */
export const FileUtils = {
    /**
     * 读取文件为Base64
     * @param {File} file - 文件对象
     * @returns {Promise<string>} Base64字符串
     */
    readAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * 读取文件为文本
     * @param {File} file - 文件对象
     * @returns {Promise<string>} 文本内容
     */
    readAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    },
    
    /**
     * 下载文件
     * @param {string} url - 文件URL
     * @param {string} filename - 文件名
     */
    download(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },
    
    /**
     * 获取文件扩展名
     * @param {string} filename - 文件名
     * @returns {string} 扩展名
     */
    getExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    },
    
    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化的大小
     */
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

/**
 * DOM工具函数
 */
export const DOMUtils = {
    /**
     * 创建元素
     * @param {string} tag - 标签名
     * @param {Object} attributes - 属性对象
     * @param {string} content - 内容
     * @returns {HTMLElement} DOM元素
     */
    createElement(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (content) {
            element.innerHTML = content;
        }
        
        return element;
    },
    
    /**
     * 查询元素
     * @param {string} selector - 选择器
     * @param {HTMLElement} parent - 父元素
     * @returns {HTMLElement} DOM元素
     */
    query(selector, parent = document) {
        return parent.querySelector(selector);
    },
    
    /**
     * 查询所有元素
     * @param {string} selector - 选择器
     * @param {HTMLElement} parent - 父元素
     * @returns {NodeList} DOM元素列表
     */
    queryAll(selector, parent = document) {
        return parent.querySelectorAll(selector);
    },
    
    /**
     * 添加事件监听器
     * @param {HTMLElement} element - 元素
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     * @param {Object} options - 选项
     */
    on(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
    },
    
    /**
     * 移除事件监听器
     * @param {HTMLElement} element - 元素
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    off(element, event, handler) {
        element.removeEventListener(event, handler);
    },
    
    /**
     * 切换类名
     * @param {HTMLElement} element - 元素
     * @param {string} className - 类名
     * @param {boolean} force - 强制添加/移除
     */
    toggleClass(element, className, force) {
        element.classList.toggle(className, force);
    },
    
    /**
     * 检查元素是否在视口中
     * @param {HTMLElement} element - 元素
     * @returns {boolean} 是否在视口中
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
};

/**
 * 防抖和节流函数
 */
export const ThrottleUtils = {
    /**
     * 防抖函数
     * @param {Function} func - 原函数
     * @param {number} delay - 延迟时间
     * @returns {Function} 防抖后的函数
     */
    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    },
    
    /**
     * 节流函数
     * @param {Function} func - 原函数
     * @param {number} delay - 延迟时间
     * @returns {Function} 节流后的函数
     */
    throttle(func, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }
};

/**
 * 异步工具函数
 */
export const AsyncUtils = {
    /**
     * 延迟执行
     * @param {number} ms - 延迟时间（毫秒）
     * @returns {Promise} Promise对象
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * 重试执行
     * @param {Function} fn - 执行函数
     * @param {number} retries - 重试次数
     * @param {number} delay - 重试间隔
     * @returns {Promise} Promise对象
     */
    async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0) {
                await this.delay(delay);
                return this.retry(fn, retries - 1, delay);
            }
            throw error;
        }
    },
    
    /**
     * 超时执行
     * @param {Promise} promise - Promise对象
     * @param {number} timeout - 超时时间
     * @returns {Promise} Promise对象
     */
    timeout(promise, timeout) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), timeout)
            )
        ]);
    }
};

/**
 * 数学工具函数
 */
export const MathUtils = {
    /**
     * 限制数值范围
     * @param {number} value - 数值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 限制后的数值
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * 线性插值
     * @param {number} start - 起始值
     * @param {number} end - 结束值
     * @param {number} t - 插值参数（0-1）
     * @returns {number} 插值结果
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    },
    
    /**
     * 映射数值范围
     * @param {number} value - 数值
     * @param {number} inMin - 输入最小值
     * @param {number} inMax - 输入最大值
     * @param {number} outMin - 输出最小值
     * @param {number} outMax - 输出最大值
     * @returns {number} 映射后的数值
     */
    map(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },
    
    /**
     * 生成随机数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机数
     */
    random(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    },
    
    /**
     * 生成随机整数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number} 随机整数
     */
    randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    }
};

// 导出所有工具函数
export default {
    TimeUtils,
    ValidationUtils,
    StringUtils,
    ArrayUtils,
    ObjectUtils,
    FileUtils,
    DOMUtils,
    ThrottleUtils,
    AsyncUtils,
    MathUtils
};