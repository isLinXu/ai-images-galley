/**
 * AI智能相册系统 - 事件管理器
 * 提供发布-订阅模式的事件系统，用于组件间通信
 */

import { EVENT_TYPES } from './config.js';

/**
 * 事件管理器类
 * 实现发布-订阅模式，支持事件的注册、触发、移除等操作
 */
class EventManager {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
        this.maxListeners = 10;
        this.debug = false;
    }

    /**
     * 注册事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     * @returns {Function} 取消监听的函数
     */
    on(eventName, listener, options = {}) {
        if (typeof listener !== 'function') {
            throw new Error('监听器必须是一个函数');
        }

        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }

        const listeners = this.events.get(eventName);
        
        // 检查监听器数量限制
        if (listeners.length >= this.maxListeners) {
            console.warn(`事件 "${eventName}" 的监听器数量已达到最大限制 ${this.maxListeners}`);
        }

        const listenerWrapper = {
            listener,
            once: options.once || false,
            priority: options.priority || 0,
            context: options.context || null,
            id: this._generateId()
        };

        // 按优先级插入
        const insertIndex = listeners.findIndex(l => l.priority < listenerWrapper.priority);
        if (insertIndex === -1) {
            listeners.push(listenerWrapper);
        } else {
            listeners.splice(insertIndex, 0, listenerWrapper);
        }

        if (this.debug) {
            console.log(`[EventManager] 注册监听器: ${eventName}`, listenerWrapper);
        }

        // 返回取消监听的函数
        return () => this.off(eventName, listenerWrapper.id);
    }

    /**
     * 注册一次性事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     * @returns {Function} 取消监听的函数
     */
    once(eventName, listener, options = {}) {
        return this.on(eventName, listener, { ...options, once: true });
    }

    /**
     * 移除事件监听器
     * @param {string} eventName - 事件名称
     * @param {string|Function} listenerOrId - 监听器函数或ID
     */
    off(eventName, listenerOrId) {
        if (!this.events.has(eventName)) {
            return;
        }

        const listeners = this.events.get(eventName);
        let index = -1;

        if (typeof listenerOrId === 'string') {
            // 通过ID查找
            index = listeners.findIndex(l => l.id === listenerOrId);
        } else if (typeof listenerOrId === 'function') {
            // 通过函数引用查找
            index = listeners.findIndex(l => l.listener === listenerOrId);
        }

        if (index !== -1) {
            listeners.splice(index, 1);
            if (this.debug) {
                console.log(`[EventManager] 移除监听器: ${eventName}`);
            }
        }

        // 如果没有监听器了，删除事件
        if (listeners.length === 0) {
            this.events.delete(eventName);
        }
    }

    /**
     * 移除指定事件的所有监听器
     * @param {string} eventName - 事件名称
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.events.delete(eventName);
            if (this.debug) {
                console.log(`[EventManager] 移除所有监听器: ${eventName}`);
            }
        } else {
            this.events.clear();
            if (this.debug) {
                console.log('[EventManager] 移除所有事件监听器');
            }
        }
    }

    /**
     * 触发事件
     * @param {string} eventName - 事件名称
     * @param {...any} args - 事件参数
     * @returns {boolean} 是否有监听器处理了事件
     */
    emit(eventName, ...args) {
        if (!this.events.has(eventName)) {
            if (this.debug) {
                console.log(`[EventManager] 没有监听器处理事件: ${eventName}`);
            }
            return false;
        }

        const listeners = [...this.events.get(eventName)];
        let hasListeners = false;

        if (this.debug) {
            console.log(`[EventManager] 触发事件: ${eventName}`, args);
        }

        for (const listenerWrapper of listeners) {
            try {
                const { listener, context, once, id } = listenerWrapper;
                
                // 调用监听器
                if (context) {
                    listener.call(context, ...args);
                } else {
                    listener(...args);
                }

                hasListeners = true;

                // 如果是一次性监听器，移除它
                if (once) {
                    this.off(eventName, id);
                }
            } catch (error) {
                console.error(`[EventManager] 监听器执行错误 (${eventName}):`, error);
            }
        }

        return hasListeners;
    }

    /**
     * 异步触发事件
     * @param {string} eventName - 事件名称
     * @param {...any} args - 事件参数
     * @returns {Promise<boolean>} 是否有监听器处理了事件
     */
    async emitAsync(eventName, ...args) {
        if (!this.events.has(eventName)) {
            return false;
        }

        const listeners = [...this.events.get(eventName)];
        let hasListeners = false;

        if (this.debug) {
            console.log(`[EventManager] 异步触发事件: ${eventName}`, args);
        }

        for (const listenerWrapper of listeners) {
            try {
                const { listener, context, once, id } = listenerWrapper;
                
                // 异步调用监听器
                if (context) {
                    await listener.call(context, ...args);
                } else {
                    await listener(...args);
                }

                hasListeners = true;

                // 如果是一次性监听器，移除它
                if (once) {
                    this.off(eventName, id);
                }
            } catch (error) {
                console.error(`[EventManager] 异步监听器执行错误 (${eventName}):`, error);
            }
        }

        return hasListeners;
    }

    /**
     * 等待事件触发
     * @param {string} eventName - 事件名称
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise} Promise对象
     */
    waitFor(eventName, timeout = 0) {
        return new Promise((resolve, reject) => {
            let timeoutId;

            const cleanup = this.once(eventName, (...args) => {
                if (timeoutId) clearTimeout(timeoutId);
                resolve(args);
            });

            if (timeout > 0) {
                timeoutId = setTimeout(() => {
                    cleanup();
                    reject(new Error(`等待事件 "${eventName}" 超时`));
                }, timeout);
            }
        });
    }

    /**
     * 获取事件监听器数量
     * @param {string} eventName - 事件名称
     * @returns {number} 监听器数量
     */
    listenerCount(eventName) {
        if (!this.events.has(eventName)) {
            return 0;
        }
        return this.events.get(eventName).length;
    }

    /**
     * 获取所有事件名称
     * @returns {Array<string>} 事件名称数组
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * 设置最大监听器数量
     * @param {number} max - 最大数量
     */
    setMaxListeners(max) {
        this.maxListeners = max;
    }

    /**
     * 启用/禁用调试模式
     * @param {boolean} enabled - 是否启用
     */
    setDebug(enabled) {
        this.debug = enabled;
    }

    /**
     * 创建命名空间事件管理器
     * @param {string} namespace - 命名空间
     * @returns {Object} 命名空间事件管理器
     */
    namespace(namespace) {
        const prefixEvent = (eventName) => `${namespace}:${eventName}`;
        
        return {
            on: (eventName, listener, options) => 
                this.on(prefixEvent(eventName), listener, options),
            once: (eventName, listener, options) => 
                this.once(prefixEvent(eventName), listener, options),
            off: (eventName, listenerOrId) => 
                this.off(prefixEvent(eventName), listenerOrId),
            emit: (eventName, ...args) => 
                this.emit(prefixEvent(eventName), ...args),
            emitAsync: (eventName, ...args) => 
                this.emitAsync(prefixEvent(eventName), ...args),
            waitFor: (eventName, timeout) => 
                this.waitFor(prefixEvent(eventName), timeout),
            listenerCount: (eventName) => 
                this.listenerCount(prefixEvent(eventName))
        };
    }

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     * @private
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 获取调试信息
     * @returns {Object} 调试信息
     */
    getDebugInfo() {
        const info = {
            totalEvents: this.events.size,
            totalListeners: 0,
            events: {}
        };

        for (const [eventName, listeners] of this.events) {
            info.totalListeners += listeners.length;
            info.events[eventName] = {
                listenerCount: listeners.length,
                listeners: listeners.map(l => ({
                    id: l.id,
                    priority: l.priority,
                    once: l.once,
                    hasContext: !!l.context
                }))
            };
        }

        return info;
    }
}

/**
 * 预定义事件类型的类型安全包装器
 */
class TypedEventManager extends EventManager {
    constructor() {
        super();
        this.types = EVENT_TYPES;
    }

    /**
     * 触发图片加载事件
     * @param {Object} imageData - 图片数据
     */
    emitImageLoaded(imageData) {
        this.emit(this.types.IMAGE_LOADED, imageData);
    }

    /**
     * 触发图片分析完成事件
     * @param {Object} analysisResult - 分析结果
     */
    emitImageAnalyzed(analysisResult) {
        this.emit(this.types.IMAGE_ANALYZED, analysisResult);
    }

    /**
     * 触发管理员登录事件
     * @param {Object} adminData - 管理员数据
     */
    emitAdminLogin(adminData) {
        this.emit(this.types.ADMIN_LOGIN, adminData);
    }

    /**
     * 触发管理员登出事件
     */
    emitAdminLogout() {
        this.emit(this.types.ADMIN_LOGOUT);
    }

    /**
     * 触发会话超时事件
     */
    emitSessionTimeout() {
        this.emit(this.types.SESSION_TIMEOUT);
    }

    /**
     * 触发上传进度事件
     * @param {Object} progressData - 进度数据
     */
    emitUploadProgress(progressData) {
        this.emit(this.types.UPLOAD_PROGRESS, progressData);
    }

    /**
     * 触发上传完成事件
     * @param {Object} uploadResult - 上传结果
     */
    emitUploadComplete(uploadResult) {
        this.emit(this.types.UPLOAD_COMPLETE, uploadResult);
    }

    /**
     * 触发主题变更事件
     * @param {Object} themeData - 主题数据
     */
    emitThemeChanged(themeData) {
        this.emit(this.types.THEME_CHANGED, themeData);
    }

    /**
     * 监听图片加载事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onImageLoaded(listener, options) {
        return this.on(this.types.IMAGE_LOADED, listener, options);
    }

    /**
     * 监听图片分析完成事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onImageAnalyzed(listener, options) {
        return this.on(this.types.IMAGE_ANALYZED, listener, options);
    }

    /**
     * 监听管理员登录事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onAdminLogin(listener, options) {
        return this.on(this.types.ADMIN_LOGIN, listener, options);
    }

    /**
     * 监听管理员登出事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onAdminLogout(listener, options) {
        return this.on(this.types.ADMIN_LOGOUT, listener, options);
    }

    /**
     * 监听会话超时事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onSessionTimeout(listener, options) {
        return this.on(this.types.SESSION_TIMEOUT, listener, options);
    }

    /**
     * 监听上传进度事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onUploadProgress(listener, options) {
        return this.on(this.types.UPLOAD_PROGRESS, listener, options);
    }

    /**
     * 监听上传完成事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onUploadComplete(listener, options) {
        return this.on(this.types.UPLOAD_COMPLETE, listener, options);
    }

    /**
     * 监听主题变更事件
     * @param {Function} listener - 监听器函数
     * @param {Object} options - 选项
     */
    onThemeChanged(listener, options) {
        return this.on(this.types.THEME_CHANGED, listener, options);
    }
}

// 创建全局事件管理器实例
const eventManager = new TypedEventManager();

// 在开发环境下启用调试
if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') {
    eventManager.setDebug(true);
}

export { EventManager, TypedEventManager };
export default eventManager;