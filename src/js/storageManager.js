/**
 * AI智能相册系统 - 存储管理器
 * 提供统一的数据存储接口，支持localStorage、sessionStorage和内存存储
 */

import { CONFIG, STORAGE_KEYS } from './config.js';
import { ObjectUtils, TimeUtils } from './utils.js';
import eventManager from './eventManager.js';

/**
 * 存储适配器接口
 */
class StorageAdapter {
    get(key) {
        throw new Error('get方法必须被实现');
    }

    set(key, value) {
        throw new Error('set方法必须被实现');
    }

    remove(key) {
        throw new Error('remove方法必须被实现');
    }

    clear() {
        throw new Error('clear方法必须被实现');
    }

    keys() {
        throw new Error('keys方法必须被实现');
    }
}

/**
 * LocalStorage适配器
 */
class LocalStorageAdapter extends StorageAdapter {
    constructor() {
        super();
        this.storage = localStorage;
        this.available = this._checkAvailability();
    }

    get(key) {
        if (!this.available) return null;
        try {
            const item = this.storage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('LocalStorage读取错误:', error);
            return null;
        }
    }

    set(key, value) {
        if (!this.available) return false;
        try {
            this.storage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('LocalStorage写入错误:', error);
            return false;
        }
    }

    remove(key) {
        if (!this.available) return false;
        try {
            this.storage.removeItem(key);
            return true;
        } catch (error) {
            console.error('LocalStorage删除错误:', error);
            return false;
        }
    }

    clear() {
        if (!this.available) return false;
        try {
            this.storage.clear();
            return true;
        } catch (error) {
            console.error('LocalStorage清空错误:', error);
            return false;
        }
    }

    keys() {
        if (!this.available) return [];
        try {
            return Object.keys(this.storage);
        } catch (error) {
            console.error('LocalStorage获取键列表错误:', error);
            return [];
        }
    }

    _checkAvailability() {
        try {
            const testKey = '__storage_test__';
            this.storage.setItem(testKey, 'test');
            this.storage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }
}

/**
 * SessionStorage适配器
 */
class SessionStorageAdapter extends LocalStorageAdapter {
    constructor() {
        super();
        this.storage = sessionStorage;
        this.available = this._checkAvailability();
    }
}

/**
 * 内存存储适配器
 */
class MemoryStorageAdapter extends StorageAdapter {
    constructor() {
        super();
        this.data = new Map();
    }

    get(key) {
        return this.data.get(key) || null;
    }

    set(key, value) {
        this.data.set(key, value);
        return true;
    }

    remove(key) {
        return this.data.delete(key);
    }

    clear() {
        this.data.clear();
        return true;
    }

    keys() {
        return Array.from(this.data.keys());
    }
}

/**
 * 存储管理器主类
 */
class StorageManager {
    constructor() {
        this.adapters = {
            local: new LocalStorageAdapter(),
            session: new SessionStorageAdapter(),
            memory: new MemoryStorageAdapter()
        };
        
        this.defaultAdapter = 'local';
        this.cache = new Map();
        this.cacheTimeout = CONFIG.STORAGE.CACHE_EXPIRY;
        this.maxCacheSize = 100;
        this.isInitialized = false;
        
        // 初始化清理定时器
        this._startCleanupTimer();
    }

    /**
     * 初始化存储管理器
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('StorageManager already initialized');
            return;
        }

        try {
            console.log('Initializing StorageManager...');
            
            // 检查存储适配器可用性
            for (const [name, adapter] of Object.entries(this.adapters)) {
                if (!adapter.available) {
                    console.warn(`Storage adapter '${name}' is not available`);
                }
            }
            
            this.isInitialized = true;
            console.log('StorageManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize StorageManager:', error);
            throw error;
        }
    }

    /**
     * 获取数据
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @param {string} adapter - 存储适配器类型
     * @returns {*} 数据值
     */
    get(key, defaultValue = null, adapter = this.defaultAdapter) {
        // 先检查缓存
        const cacheKey = `${adapter}:${key}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (!TimeUtils.isExpired(cached.timestamp, this.cacheTimeout)) {
                return cached.value;
            } else {
                this.cache.delete(cacheKey);
            }
        }

        // 从存储适配器获取
        const value = this.adapters[adapter].get(key);
        const result = value !== null ? value : defaultValue;

        // 缓存结果
        if (result !== null) {
            this._setCache(cacheKey, result);
        }

        return result;
    }

    /**
     * 设置数据
     * @param {string} key - 键名
     * @param {*} value - 数据值
     * @param {string} adapter - 存储适配器类型
     * @returns {boolean} 是否成功
     */
    set(key, value, adapter = this.defaultAdapter) {
        const success = this.adapters[adapter].set(key, value);
        
        if (success) {
            // 更新缓存
            const cacheKey = `${adapter}:${key}`;
            this._setCache(cacheKey, value);
            
            // 触发存储变更事件
            eventManager.emit('storage:changed', {
                key,
                value,
                adapter,
                action: 'set'
            });
        }
        
        return success;
    }

    /**
     * 删除数据
     * @param {string} key - 键名
     * @param {string} adapter - 存储适配器类型
     * @returns {boolean} 是否成功
     */
    remove(key, adapter = this.defaultAdapter) {
        const success = this.adapters[adapter].remove(key);
        
        if (success) {
            // 清除缓存
            const cacheKey = `${adapter}:${key}`;
            this.cache.delete(cacheKey);
            
            // 触发存储变更事件
            eventManager.emit('storage:changed', {
                key,
                adapter,
                action: 'remove'
            });
        }
        
        return success;
    }

    /**
     * 清空存储
     * @param {string} adapter - 存储适配器类型
     * @returns {boolean} 是否成功
     */
    clear(adapter = this.defaultAdapter) {
        const success = this.adapters[adapter].clear();
        
        if (success) {
            // 清除相关缓存
            for (const cacheKey of this.cache.keys()) {
                if (cacheKey.startsWith(`${adapter}:`)) {
                    this.cache.delete(cacheKey);
                }
            }
            
            // 触发存储变更事件
            eventManager.emit('storage:changed', {
                adapter,
                action: 'clear'
            });
        }
        
        return success;
    }

    /**
     * 获取所有键名
     * @param {string} adapter - 存储适配器类型
     * @returns {Array<string>} 键名数组
     */
    keys(adapter = this.defaultAdapter) {
        return this.adapters[adapter].keys();
    }

    /**
     * 检查键是否存在
     * @param {string} key - 键名
     * @param {string} adapter - 存储适配器类型
     * @returns {boolean} 是否存在
     */
    has(key, adapter = this.defaultAdapter) {
        return this.get(key, undefined, adapter) !== null;
    }

    /**
     * 获取存储大小（字节）
     * @param {string} adapter - 存储适配器类型
     * @returns {number} 存储大小
     */
    getSize(adapter = this.defaultAdapter) {
        if (adapter === 'memory') {
            let size = 0;
            for (const [key, value] of this.adapters[adapter].data) {
                size += JSON.stringify({ key, value }).length;
            }
            return size;
        }
        
        // 对于localStorage和sessionStorage
        let size = 0;
        const keys = this.keys(adapter);
        for (const key of keys) {
            const value = this.adapters[adapter].get(key);
            size += key.length + JSON.stringify(value).length;
        }
        return size;
    }

    /**
     * 获取存储使用情况
     * @returns {Object} 使用情况统计
     */
    getUsage() {
        return {
            local: {
                size: this.getSize('local'),
                keys: this.keys('local').length,
                available: this.adapters.local.available
            },
            session: {
                size: this.getSize('session'),
                keys: this.keys('session').length,
                available: this.adapters.session.available
            },
            memory: {
                size: this.getSize('memory'),
                keys: this.keys('memory').length,
                available: true
            },
            cache: {
                size: this.cache.size,
                maxSize: this.maxCacheSize
            }
        };
    }

    /**
     * 设置缓存
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @private
     */
    _setCache(key, value) {
        // 检查缓存大小限制
        if (this.cache.size >= this.maxCacheSize) {
            // 删除最旧的缓存项
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            value: ObjectUtils.deepClone(value),
            timestamp: Date.now()
        });
    }

    /**
     * 启动清理定时器
     * @private
     */
    _startCleanupTimer() {
        setInterval(() => {
            this._cleanupCache();
        }, 60000); // 每分钟清理一次
    }

    /**
     * 清理过期缓存
     * @private
     */
    _cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache) {
            if (now - cached.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 导出数据
     * @param {string} adapter - 存储适配器类型
     * @returns {Object} 导出的数据
     */
    export(adapter = this.defaultAdapter) {
        const data = {};
        const keys = this.keys(adapter);
        
        for (const key of keys) {
            data[key] = this.get(key, null, adapter);
        }
        
        return {
            adapter,
            timestamp: new Date().toISOString(),
            data
        };
    }

    /**
     * 导入数据
     * @param {Object} exportData - 导出的数据
     * @param {boolean} merge - 是否合并（否则覆盖）
     * @returns {boolean} 是否成功
     */
    import(exportData, merge = true) {
        try {
            const { adapter, data } = exportData;
            
            if (!merge) {
                this.clear(adapter);
            }
            
            for (const [key, value] of Object.entries(data)) {
                this.set(key, value, adapter);
            }
            
            return true;
        } catch (error) {
            console.error('数据导入失败:', error);
            return false;
        }
    }

    /**
     * 创建命名空间存储
     * @param {string} namespace - 命名空间
     * @returns {Object} 命名空间存储对象
     */
    namespace(namespace) {
        const prefixKey = (key) => `${namespace}:${key}`;
        
        return {
            get: (key, defaultValue, adapter) => 
                this.get(prefixKey(key), defaultValue, adapter),
            set: (key, value, adapter) => 
                this.set(prefixKey(key), value, adapter),
            remove: (key, adapter) => 
                this.remove(prefixKey(key), adapter),
            has: (key, adapter) => 
                this.has(prefixKey(key), adapter),
            keys: (adapter) => 
                this.keys(adapter)
                    .filter(key => key.startsWith(`${namespace}:`))
                    .map(key => key.substring(namespace.length + 1)),
            clear: () => {
                const keys = this.keys()
                    .filter(key => key.startsWith(`${namespace}:`));
                for (const key of keys) {
                    this.remove(key);
                }
            }
        };
    }
}

/**
 * 专用存储管理器
 * 为特定数据类型提供便捷的存储接口
 */
class SpecializedStorageManager {
    constructor(storageManager) {
        this.storage = storageManager;
    }

    /**
     * 管理员数据管理
     */
    get admin() {
        return {
            getUser: () => this.storage.get(STORAGE_KEYS.ADMIN_USER),
            setUser: (userData) => this.storage.set(STORAGE_KEYS.ADMIN_USER, userData),
            removeUser: () => this.storage.remove(STORAGE_KEYS.ADMIN_USER),
            
            getLogs: () => this.storage.get(STORAGE_KEYS.ADMIN_LOGS, []),
            setLogs: (logs) => this.storage.set(STORAGE_KEYS.ADMIN_LOGS, logs),
            addLog: (log) => {
                const logs = this.getLogs();
                logs.unshift(log);
                if (logs.length > CONFIG.STORAGE.MAX_LOGS) {
                    logs.splice(CONFIG.STORAGE.MAX_LOGS);
                }
                this.setLogs(logs);
            },
            clearLogs: () => this.storage.remove(STORAGE_KEYS.ADMIN_LOGS)
        };
    }

    /**
     * 图片数据管理
     */
    get images() {
        return {
            getNotes: () => this.storage.get(STORAGE_KEYS.IMAGE_NOTES, new Map()),
            setNotes: (notes) => this.storage.set(STORAGE_KEYS.IMAGE_NOTES, notes),
            getNote: (imageUrl) => {
                const notes = this.getNotes();
                return notes.get ? notes.get(imageUrl) : notes[imageUrl];
            },
            setNote: (imageUrl, note) => {
                const notes = this.getNotes();
                if (notes.set) {
                    notes.set(imageUrl, note);
                } else {
                    notes[imageUrl] = note;
                }
                this.setNotes(notes);
            },
            removeNote: (imageUrl) => {
                const notes = this.getNotes();
                if (notes.delete) {
                    notes.delete(imageUrl);
                } else {
                    delete notes[imageUrl];
                }
                this.setNotes(notes);
            },
            
            getTags: () => this.storage.get(STORAGE_KEYS.CUSTOM_TAGS, new Map()),
            setTags: (tags) => this.storage.set(STORAGE_KEYS.CUSTOM_TAGS, tags),
            getImageTags: (imageUrl) => {
                const tags = this.getTags();
                return tags.get ? tags.get(imageUrl) : tags[imageUrl] || [];
            },
            setImageTags: (imageUrl, imageTags) => {
                const tags = this.getTags();
                if (tags.set) {
                    tags.set(imageUrl, imageTags);
                } else {
                    tags[imageUrl] = imageTags;
                }
                this.setTags(tags);
            },
            addImageTag: (imageUrl, tag) => {
                const imageTags = this.getImageTags(imageUrl);
                if (!imageTags.includes(tag)) {
                    imageTags.push(tag);
                    this.setImageTags(imageUrl, imageTags);
                }
            },
            removeImageTag: (imageUrl, tag) => {
                const imageTags = this.getImageTags(imageUrl);
                const index = imageTags.indexOf(tag);
                if (index !== -1) {
                    imageTags.splice(index, 1);
                    this.setImageTags(imageUrl, imageTags);
                }
            }
        };
    }

    /**
     * AI缓存管理
     */
    get aiCache() {
        return {
            get: (key) => this.storage.get(`${STORAGE_KEYS.AI_CACHE}:${key}`),
            set: (key, value) => this.storage.set(`${STORAGE_KEYS.AI_CACHE}:${key}`, {
                value,
                timestamp: Date.now()
            }),
            remove: (key) => this.storage.remove(`${STORAGE_KEYS.AI_CACHE}:${key}`),
            clear: () => {
                const keys = this.storage.keys()
                    .filter(key => key.startsWith(STORAGE_KEYS.AI_CACHE));
                for (const key of keys) {
                    this.storage.remove(key);
                }
            },
            cleanup: () => {
                const keys = this.storage.keys()
                    .filter(key => key.startsWith(STORAGE_KEYS.AI_CACHE));
                for (const key of keys) {
                    const cached = this.storage.get(key);
                    if (cached && TimeUtils.isExpired(cached.timestamp)) {
                        this.storage.remove(key);
                    }
                }
            }
        };
    }

    /**
     * 用户偏好设置管理
     */
    get preferences() {
        return {
            get: (key, defaultValue) => {
                const prefs = this.storage.get(STORAGE_KEYS.USER_PREFERENCES, {});
                return ObjectUtils.get(prefs, key, defaultValue);
            },
            set: (key, value) => {
                const prefs = this.storage.get(STORAGE_KEYS.USER_PREFERENCES, {});
                ObjectUtils.set(prefs, key, value);
                this.storage.set(STORAGE_KEYS.USER_PREFERENCES, prefs);
            },
            remove: (key) => {
                const prefs = this.storage.get(STORAGE_KEYS.USER_PREFERENCES, {});
                const keys = key.split('.');
                const lastKey = keys.pop();
                let current = prefs;
                for (const k of keys) {
                    if (!(k in current)) return;
                    current = current[k];
                }
                delete current[lastKey];
                this.storage.set(STORAGE_KEYS.USER_PREFERENCES, prefs);
            },
            clear: () => this.storage.remove(STORAGE_KEYS.USER_PREFERENCES)
        };
    }

    /**
     * 主题管理
     */
    get theme() {
        return {
            get: () => this.storage.get(STORAGE_KEYS.THEME),
            set: (themeData) => this.storage.set(STORAGE_KEYS.THEME, themeData),
            remove: () => this.storage.remove(STORAGE_KEYS.THEME)
        };
    }
}

// 创建全局存储管理器实例
const storageManager = new StorageManager();
const specializedStorage = new SpecializedStorageManager(storageManager);

export {
    StorageManager,
    SpecializedStorageManager,
    LocalStorageAdapter,
    SessionStorageAdapter,
    MemoryStorageAdapter,
    specializedStorage
};

export default storageManager;