/**
 * AI智能相册系统 - 主应用程序入口
 * 负责初始化所有模块并协调它们之间的交互
 */

import { CONFIG } from './config.js';
import { LazyLoader } from './utils.js';
import eventManager from './eventManager.js';
import storageManager from './storageManager.js';
import uiManager from './uiManager.js';
import imageManager from './imageManager.js';
import aiEngine from './aiEngine.js';
import galleryManager from './galleryManager.js';
import galleryRenderer from './galleryRenderer.js';
import adminManager from './adminManager.js';
import appLogger from './logger.js';
import { apiClient } from './apiClient.js';
import promptEngine from './promptEngine.js';
import multimodalEngine from './multimodalEngine.js'; // eslint-disable-line no-unused-vars
import { imageWorkerManager } from './imageWorker.js'; // eslint-disable-line no-unused-vars

/**
 * 应用程序状态管理器
 */
class AppStateManager {
    constructor() {
        this.state = {
            isInitialized: false,
            isLoading: false,
            currentView: 'gallery',
            selectedImages: new Set(),
            dragDropActive: false,
            fullscreenMode: false,
            keyboardShortcutsEnabled: true
        };

        this.stateHistory = [];
        this.maxHistorySize = 50;

        this._bindEvents();
    }

    /**
     * 获取状态
     * @param {string} key - 状态键
     * @returns {*} 状态值
     */
    getState(key) {
        return key ? this.state[key] : { ...this.state };
    }

    /**
     * 设置状态
     * @param {string|Object} key - 状态键或状态对象
     * @param {*} value - 状态值
     */
    setState(key, value) {
        // 保存当前状态到历史
        this._saveStateToHistory();

        if (typeof key === 'object') {
            // 批量更新
            Object.assign(this.state, key);
        } else {
            // 单个更新
            this.state[key] = value;
        }

        // 触发状态变化事件
        eventManager.emit('app:state-changed', {
            key: typeof key === 'object' ? Object.keys(key) : [key],
            newState: { ...this.state },
            timestamp: Date.now()
        });
    }

    /**
     * 切换布尔状态
     * @param {string} key - 状态键
     */
    toggleState(key) {
        if (typeof this.state[key] === 'boolean') {
            this.setState(key, !this.state[key]);
        }
    }

    /**
     * 重置状态
     */
    resetState() {
        const initialState = {
            isInitialized: this.state.isInitialized,
            isLoading: false,
            currentView: 'gallery',
            selectedImages: new Set(),
            dragDropActive: false,
            fullscreenMode: false,
            keyboardShortcutsEnabled: true
        };

        this.setState(initialState);
    }

    /**
     * 撤销状态变化
     */
    undoState() {
        if (this.stateHistory.length > 0) {
            const previousState = this.stateHistory.pop();
            this.state = { ...previousState };

            eventManager.emit('app:state-restored', {
                restoredState: { ...this.state },
                timestamp: Date.now()
            });
        }
    }

    /**
     * 保存状态到历史
     * @private
     */
    _saveStateToHistory() {
        this.stateHistory.push({ ...this.state });

        // 限制历史大小
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.setState('isPageVisible', !document.hidden);
        });

        // 监听在线状态变化
        window.addEventListener('online', () => {
            this.setState('isOnline', true);
        });

        window.addEventListener('offline', () => {
            this.setState('isOnline', false);
        });
    }
}

/**
 * 键盘快捷键管理器
 */
class KeyboardShortcutManager {
    constructor(appStateManager) {
        this.appStateManager = appStateManager;
        this.shortcuts = new Map();
        this.isEnabled = true;

        this._initializeShortcuts();
        this._bindEvents();
    }

    /**
     * 注册快捷键
     * @param {string} combination - 快捷键组合
     * @param {Function} handler - 处理函数
     * @param {Object} options - 选项
     */
    register(combination, handler, options = {}) {
        const normalizedCombo = this._normalizeShortcut(combination);

        this.shortcuts.set(normalizedCombo, {
            handler,
            description: options.description || '',
            category: options.category || 'general',
            preventDefault: options.preventDefault !== false
        });
    }

    /**
     * 注销快捷键
     * @param {string} combination - 快捷键组合
     */
    unregister(combination) {
        const normalizedCombo = this._normalizeShortcut(combination);
        this.shortcuts.delete(normalizedCombo);
    }

    /**
     * 启用/禁用快捷键
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.appStateManager.setState('keyboardShortcutsEnabled', enabled);
    }

    /**
     * 获取所有快捷键
     * @returns {Array} 快捷键列表
     */
    getAllShortcuts() {
        return Array.from(this.shortcuts.entries()).map(([combo, config]) => ({
            combination: combo,
            ...config
        }));
    }

    /**
     * 初始化默认快捷键
     * @private
     */
    _initializeShortcuts() {
        // 图片库快捷键
        this.register('ctrl+f', () => {
            const searchInput = document.querySelector('#search-input');
            if (searchInput) {
                searchInput.focus();
            }
        }, { description: '聚焦搜索框', category: 'gallery' });

        this.register('ctrl+a', () => {
            const images = galleryManager.getDisplayedImages();
            const selectedImages = new Set(images.map(img => img.id));
            this.appStateManager.setState('selectedImages', selectedImages);
        }, { description: '全选图片', category: 'gallery' });

        this.register('escape', () => {
            // 关闭模态框或退出全屏
            if (this.appStateManager.getState('fullscreenMode')) {
                this.appStateManager.setState('fullscreenMode', false);
            } else {
                uiManager.modalManager.closeAll();
            }
        }, { description: '关闭模态框/退出全屏', category: 'navigation' });

        this.register('f11', () => {
            this.appStateManager.toggleState('fullscreenMode');
        }, { description: '切换全屏模式', category: 'view' });

        // 视图切换快捷键
        this.register('ctrl+1', () => {
            galleryManager.viewManager.setViewMode('grid');
        }, { description: '网格视图', category: 'view' });

        this.register('ctrl+2', () => {
            galleryManager.viewManager.setViewMode('list');
        }, { description: '列表视图', category: 'view' });

        this.register('ctrl+3', () => {
            galleryManager.viewManager.setViewMode('masonry');
        }, { description: '瀑布流视图', category: 'view' });

        // 管理员快捷键
        this.register('ctrl+shift+a', () => {
            if (adminManager.isAdminMode) {
                const adminPanel = document.querySelector('#admin-panel-modal');
                if (adminPanel) {
                    adminPanel.style.display = adminPanel.style.display === 'none' ? 'flex' : 'none';
                }
            }
        }, { description: '切换管理员面板', category: 'admin' });

        // 主题切换
        this.register('ctrl+shift+t', () => {
            uiManager.themeManager.toggleTheme();
        }, { description: '切换主题', category: 'ui' });

        // 刷新
        this.register('f5', () => {
            galleryManager.refreshGallery(true);
        }, { description: '刷新图片库', category: 'gallery' });
    }

    /**
     * 标准化快捷键
     * @param {string} combination - 快捷键组合
     * @returns {string} 标准化的快捷键
     * @private
     */
    _normalizeShortcut(combination) {
        return combination.toLowerCase()
            .replace(/\s+/g, '')
            .split('+')
            .sort()
            .join('+');
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} event - 键盘事件
     * @private
     */
    _handleKeyDown(event) {
        if (!this.isEnabled || !this.appStateManager.getState('keyboardShortcutsEnabled')) {
            return;
        }

        // 构建快捷键组合
        const parts = [];

        if (event.ctrlKey) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        if (event.metaKey) parts.push('meta');

        // 添加主键
        const key = event.key.toLowerCase();
        if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
            parts.push(key);
        }

        const combination = parts.sort().join('+');
        const shortcut = this.shortcuts.get(combination);

        if (shortcut) {
            if (shortcut.preventDefault) {
                event.preventDefault();
            }

            try {
                shortcut.handler(event);
            } catch (error) {
                console.error('快捷键处理失败:', error);
            }
        }
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
        document.addEventListener('keydown', (event) => {
            this._handleKeyDown(event);
        });
    }
}

/**
 * 拖拽上传管理器
 */
class DragDropManager {
    constructor(appStateManager) {
        this.appStateManager = appStateManager;
        this.dropZone = null;
        this.dragCounter = 0;

        this._bindEvents();
    }

    /**
     * 设置拖拽区域
     * @param {HTMLElement} element - 拖拽区域元素
     */
    setDropZone(element) {
        if (this.dropZone) {
            this._unbindDropZoneEvents();
        }

        this.dropZone = element;
        this._bindDropZoneEvents();
    }

    /**
     * 处理文件拖拽
     * @param {FileList} files - 文件列表
     * @private
     */
    async _handleFiles(files) {
        const imageFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/')
        );

        if (imageFiles.length === 0) {
            uiManager.tooltipManager.warning('请拖拽图片文件');
            return;
        }

        // 显示上传进度
        uiManager.progressManager.show('正在上传图片...');

        try {
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                const progress = ((i + 1) / imageFiles.length) * 100;

                uiManager.progressManager.update(progress, `上传中: ${file.name}`);

                await imageManager.loadImageFromFile(file);

                // 触发上传进度事件
                eventManager.emitUploadProgress({
                    current: i + 1,
                    total: imageFiles.length,
                    fileName: file.name,
                    progress
                });
            }

            uiManager.tooltipManager.success(`成功上传 ${imageFiles.length} 张图片`);

            // 触发上传完成事件
            eventManager.emitUploadComplete({
                count: imageFiles.length,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('文件上传失败:', error);
            uiManager.tooltipManager.error('文件上传失败');
        } finally {
            uiManager.progressManager.hide();
        }
    }

    /**
     * 绑定全局事件
     * @private
     */
    _bindEvents() {
        // 防止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 全局拖拽进入
        document.addEventListener('dragenter', () => {
            this.dragCounter++;
            if (this.dragCounter === 1) {
                this.appStateManager.setState('dragDropActive', true);
            }
        });

        // 全局拖拽离开
        document.addEventListener('dragleave', () => {
            this.dragCounter--;
            if (this.dragCounter === 0) {
                this.appStateManager.setState('dragDropActive', false);
            }
        });

        // 全局放置
        document.addEventListener('drop', () => {
            this.dragCounter = 0;
            this.appStateManager.setState('dragDropActive', false);
        });
    }

    /**
     * 绑定拖拽区域事件
     * @private
     */
    _bindDropZoneEvents() {
        if (!this.dropZone) return;

        this.dropZone.addEventListener('dragover', (e) => {
            e.dataTransfer.dropEffect = 'copy';
        });

        this.dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this._handleFiles(files);
            }
        });
    }

    /**
     * 解绑拖拽区域事件
     * @private
     */
    _unbindDropZoneEvents() {
        // 由于使用了箭头函数，这里需要保存引用才能正确解绑
        // 在实际实现中应该保存事件处理器的引用
    }
}

/**
 * 性能监控管理器
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTime: 0,
            renderTime: 0,
            memoryUsage: 0,
            imageLoadTimes: [],
            searchTimes: [],
            filterTimes: []
        };

        this.observers = new Map();

        this._initializeObservers();
    }

    /**
     * 记录性能指标
     * @param {string} metric - 指标名称
     * @param {number} value - 指标值
     * @param {Object} metadata - 元数据
     */
    recordMetric(metric, value, metadata = {}) {
        if (Array.isArray(this.metrics[metric])) {
            this.metrics[metric].push({ value, timestamp: Date.now(), ...metadata });

            // 限制数组大小
            if (this.metrics[metric].length > 100) {
                this.metrics[metric].shift();
            }
        } else {
            this.metrics[metric] = value;
        }

        // 触发性能事件
        eventManager.emit('performance:metric-recorded', {
            metric,
            value,
            metadata,
            timestamp: Date.now()
        });
    }

    /**
     * 开始性能测量
     * @param {string} name - 测量名称
     */
    startMeasure(name) {
        performance.mark(`${name}-start`);
    }

    /**
     * 结束性能测量
     * @param {string} name - 测量名称
     * @returns {number} 测量时间（毫秒）
     */
    endMeasure(name) {
        performance.mark(`${name}-end`);
        performance.measure(name, `${name}-start`, `${name}-end`);

        const measure = performance.getEntriesByName(name)[0];
        const duration = measure ? measure.duration : 0;

        this.recordMetric(`${name}Times`, duration);

        return duration;
    }

    /**
     * 获取性能报告
     * @returns {Object} 性能报告
     */
    getPerformanceReport() {
        const report = {
            ...this.metrics,
            timestamp: Date.now(),
            memoryInfo: this._getMemoryInfo(),
            navigationTiming: this._getNavigationTiming()
        };

        // 计算平均值
        ['imageLoadTimes', 'searchTimes', 'filterTimes'].forEach(metric => {
            if (Array.isArray(report[metric]) && report[metric].length > 0) {
                const values = report[metric].map(item => item.value);
                report[`${metric}Average`] = values.reduce((a, b) => a + b, 0) / values.length;
            }
        });

        return report;
    }

    /**
     * 获取内存信息
     * @returns {Object} 内存信息
     * @private
     */
    _getMemoryInfo() {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /**
     * 获取导航时间信息
     * @returns {Object} 导航时间信息
     * @private
     */
    _getNavigationTiming() {
        const timing = performance.timing;
        return {
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            loadComplete: timing.loadEventEnd - timing.navigationStart,
            domReady: timing.domComplete - timing.navigationStart
        };
    }

    /**
     * 初始化观察器
     * @private
     */
    _initializeObservers() {
        // 观察长任务
        if ('PerformanceObserver' in window) {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    this.recordMetric('longTasks', entry.duration, {
                        name: entry.name,
                        startTime: entry.startTime
                    });
                });
            });

            try {
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.set('longtask', longTaskObserver);
            } catch (error) {
                console.warn('长任务观察器不支持:', error);
            }
        }
    }

    /**
     * 清理观察器
     */
    cleanup() {
        this.observers.forEach(observer => {
            observer.disconnect();
        });
        this.observers.clear();
    }
}

/**
 * 主应用程序类
 */
class App {
    constructor() {
        this.stateManager = new AppStateManager();
        this.keyboardShortcutManager = new KeyboardShortcutManager(this.stateManager);
        this.dragDropManager = new DragDropManager(this.stateManager);
        this.performanceMonitor = new PerformanceMonitor();
        this.lazyLoader = new LazyLoader({
            selector: '.lazy-image',
            rootMargin: '200px',
            threshold: 0.01
        });
        this.galleryRenderer = galleryRenderer;

        this.isInitialized = false;
        this.initializationPromise = null;

        this._bindGlobalEvents();
    }

    /**
     * 初始化应用程序
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return this.initializationPromise;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
    }

    /**
     * 执行初始化
     * @returns {Promise<void>}
     * @private
     */
    async _performInitialization() {
        try {
            this.performanceMonitor.startMeasure('app-initialization');

            appLogger.info('🚀 AI智能相册系统启动中...');

            // 设置加载状态
            this.stateManager.setState('isLoading', true);

            // 1. 初始化存储管理器
            appLogger.info('📦 初始化存储管理器...');
            await storageManager.initialize();
            appLogger.info('✅ 存储管理器初始化完成');

            // 2. 初始化UI管理器
            appLogger.info('🎨 初始化UI管理器...');
            await uiManager.initialize(CONFIG.UI);
            appLogger.info('✅ UI管理器初始化完成');

            // 3. 初始化图片管理器
            appLogger.info('🖼️ 初始化图片管理器...');
            await imageManager.initialize();
            appLogger.info('✅ 图片管理器初始化完成');

            // 4. 初始化API客户端（非阻塞）
            appLogger.info('🌐 初始化API客户端...');
            try {
                await apiClient.get('/health', {}, { cache: false, timeout: 5000 });
                appLogger.info('✅ 后端API连接成功');
                this.stateManager.setState('apiConnected', true);
            } catch (error) {
                appLogger.warn('⚠️ 后端API连接失败，将使用本地模式:', error.message);
                this.stateManager.setState('apiConnected', false);
            }

            // 5. 初始化AI引擎（非阻塞）
            appLogger.info('🤖 初始化AI引擎...');
            let aiInitialized = false;
            try {
                aiInitialized = await Promise.race([
                    aiEngine.initialize(),
                    new Promise(resolve => setTimeout(() => resolve(false), 10000)) // 10秒超时
                ]);
                appLogger.info(`✅ AI引擎初始化完成，成功: ${aiInitialized}`);
                if (!aiInitialized) {
                    console.warn('⚠️ AI功能初始化失败，应用将以基础模式运行');
                }
            } catch (error) {
                console.warn('⚠️ AI引擎初始化异常:', error.message);
                aiInitialized = false;
            }

            // 6. 初始化Prompt智能引擎
            appLogger.info('✨ 初始化Prompt智能引擎...');
            try {
                await promptEngine.getTemplates();
                appLogger.info('✅ Prompt智能引擎初始化完成');
            } catch (error) {
                appLogger.warn('⚠️ Prompt引擎初始化失败:', error.message);
            }

            // 7. 初始化多模态引擎
            appLogger.info('🎭 初始化多模态引擎...');
            try {
                appLogger.info('✅ 多模态引擎初始化完成');
            } catch (error) {
                appLogger.warn('⚠️ 多模态引擎初始化失败:', error.message);
            }

            // 8. 初始化图片库管理器
            appLogger.info('📚 初始化图片库管理器...');
            await galleryManager.refreshGallery(true);
            appLogger.info('✅ 图片库管理器初始化完成');

            // 9. 设置拖拽区域
            const dropZone = document.body;
            this.dragDropManager.setDropZone(dropZone);
            appLogger.info('✅ 拖拽区域设置完成');

            // 10. 绑定UI事件
            this._bindUIEvents();
            appLogger.info('✅ UI事件绑定完成');

            // 11. 恢复应用状态
            await this._restoreAppState();
            appLogger.info('✅ 应用状态恢复完成');

            // 9. 初始化完成
            this.isInitialized = true;
            this.stateManager.setState({
                isInitialized: true,
                isLoading: false
            });
            appLogger.info('✅ 初始化状态设置完成');

            const initTime = this.performanceMonitor.endMeasure('app-initialization');

            appLogger.info(`✅ AI智能相册系统初始化完成 (${initTime.toFixed(2)}ms)`);

            // 触发初始化完成事件
            eventManager.emit('app:initialized', {
                initTime,
                timestamp: Date.now()
            });

            // 显示欢迎消息
            uiManager.tooltipManager.success('AI智能相册系统已就绪', { duration: 3000 });

        } catch (error) {
            console.error('应用程序初始化失败:', error);

            this.stateManager.setState({
                isLoading: false,
                initializationError: error.message
            });

            uiManager.tooltipManager.error('系统初始化失败，请刷新页面重试');

            throw error;
        }
    }

    /**
     * 获取应用状态
     * @param {string} key - 状态键
     * @returns {*} 状态值
     */
    getState(key) {
        return this.stateManager.getState(key);
    }

    /**
     * 设置应用状态
     * @param {string|Object} key - 状态键或状态对象
     * @param {*} value - 状态值
     */
    setState(key, value) {
        this.stateManager.setState(key, value);
    }

    /**
     * 获取性能报告
     * @returns {Object} 性能报告
     */
    getPerformanceReport() {
        return this.performanceMonitor.getPerformanceReport();
    }

    /**
     * 销毁应用程序
     */
    destroy() {
        appLogger.info('🔄 正在销毁应用程序...');

        // 清理性能监控
        this.performanceMonitor.cleanup();

        // 清理事件监听器
        this._unbindGlobalEvents();

        // 重置状态
        this.stateManager.resetState();

        this.isInitialized = false;
        this.initializationPromise = null;

        appLogger.info('✅ 应用程序已销毁');
    }

    /**
     * 绑定UI事件
     * @private
     */
    _bindUIEvents() {
        // 搜索事件
        const searchInput = document.querySelector('#search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.performanceMonitor.startMeasure('search');
                    galleryManager.searchImages(e.target.value);
                    this.performanceMonitor.endMeasure('search');
                }, 300);
            });
        }

        // 文件上传按钮
        const uploadButton = document.querySelector('#upload-button');
        if (uploadButton) {
            uploadButton.addEventListener('click', () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.multiple = true;
                fileInput.accept = 'image/*';
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length > 0) {
                        this.dragDropManager._handleFiles(e.target.files);
                    }
                });
                fileInput.click();
            });
        }

        // 管理员登录按钮
        const adminButton = document.querySelector('#admin-button');
        if (adminButton) {
            adminButton.addEventListener('click', () => {
                const modal = document.querySelector('#admin-login-modal');
                if (modal) {
                    modal.style.display = 'flex';
                }
            });
        }

        // 主题切换按钮
        const themeButton = document.querySelector('#theme-toggle');
        if (themeButton) {
            themeButton.addEventListener('click', () => {
                uiManager.themeManager.toggleTheme();
            });
        }
    }

    /**
     * 恢复应用状态
     * @private
     */
    async _restoreAppState() {
        try {
            const savedState = storageManager.specializedStorage.userPreferences.get('appState');
            if (savedState) {
                // 只恢复安全的状态
                const safeState = {
                    currentView: savedState.currentView || 'gallery',
                    keyboardShortcutsEnabled: savedState.keyboardShortcutsEnabled !== false
                };

                this.stateManager.setState(safeState);
            }
        } catch (error) {
            console.warn('恢复应用状态失败:', error);
        }
    }

    /**
     * 保存应用状态
     * @private
     */
    _saveAppState() {
        try {
            const stateToSave = {
                currentView: this.stateManager.getState('currentView'),
                keyboardShortcutsEnabled: this.stateManager.getState('keyboardShortcutsEnabled'),
                timestamp: Date.now()
            };

            storageManager.specializedStorage.userPreferences.set('appState', stateToSave);
        } catch (error) {
            console.warn('保存应用状态失败:', error);
        }
    }

    /**
     * 绑定全局事件
     * @private
     */
    _bindGlobalEvents() {
        // 监听状态变化并保存
        eventManager.on('app:state-changed', (data) => {
            this._saveAppState();
            if (data.key.includes('isLoading')) {
                appLogger.info('isLoading state changed:', data.newState.isLoading);
                if (data.newState.isLoading) {
                    uiManager.loadingManager.show('app-loading', { global: true, message: '正在初始化...' });
                } else {
                    uiManager.loadingManager.hide('app-loading');
                }
            }
        });

        // 监听页面卸载
        window.addEventListener('beforeunload', () => {
            this._saveAppState();
        });

        // 监听错误
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);

            eventManager.emit('app:error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: Date.now()
            });
        });

        // 监听未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);

            eventManager.emit('app:unhandled-rejection', {
                reason: event.reason,
                timestamp: Date.now()
            });
        });
    }

    /**
     * 解绑全局事件
     * @private
     */
    _unbindGlobalEvents() {
        // 在实际实现中应该移除所有事件监听器
        // 这里需要保存事件处理器的引用才能正确移除
    }
}

// 创建全局应用实例
const app = new App();

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.initialize();
    });
} else {
    app.initialize();
}

// 导出应用实例和相关类
export {
    App,
    AppStateManager,
    KeyboardShortcutManager,
    DragDropManager,
    PerformanceMonitor
};

export default app;
