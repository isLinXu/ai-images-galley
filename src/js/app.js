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
import imageUploader from './uploader.js';
import appLogger from './logger.js';
import { apiClient, analysisAPI } from './apiClient.js';
import promptEngine from './promptEngine.js';
import multimodalEngine from './multimodalEngine.js'; // eslint-disable-line no-unused-vars

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
        this.register(
            'ctrl+f',
            () => {
                const searchInput = document.querySelector('#search-input');
                if (searchInput) {
                    searchInput.focus();
                }
            },
            { description: '聚焦搜索框', category: 'gallery' }
        );

        this.register(
            'ctrl+a',
            () => {
                const images = galleryManager.getDisplayedImages();
                const selectedImages = new Set(images.map((img) => img.id));
                this.appStateManager.setState('selectedImages', selectedImages);
            },
            { description: '全选图片', category: 'gallery' }
        );

        this.register(
            'escape',
            () => {
                // 关闭模态框或退出全屏
                if (this.appStateManager.getState('fullscreenMode')) {
                    this.appStateManager.setState('fullscreenMode', false);
                } else {
                    uiManager.modalManager.closeAll();
                }
            },
            { description: '关闭模态框/退出全屏', category: 'navigation' }
        );

        this.register(
            'f11',
            () => {
                this.appStateManager.toggleState('fullscreenMode');
            },
            { description: '切换全屏模式', category: 'view' }
        );

        // 视图切换快捷键
        this.register(
            'ctrl+1',
            () => {
                galleryManager.viewManager.setViewMode('grid');
            },
            { description: '网格视图', category: 'view' }
        );

        this.register(
            'ctrl+2',
            () => {
                galleryManager.viewManager.setViewMode('list');
            },
            { description: '列表视图', category: 'view' }
        );

        this.register(
            'ctrl+3',
            () => {
                galleryManager.viewManager.setViewMode('masonry');
            },
            { description: '瀑布流视图', category: 'view' }
        );

        // 管理员快捷键
        this.register(
            'ctrl+shift+a',
            () => {
                if (adminManager.isAdminMode) {
                    const adminPanel = document.querySelector('#admin-panel-modal');
                    if (adminPanel) {
                        adminPanel.style.display = adminPanel.style.display === 'none' ? 'flex' : 'none';
                    }
                }
            },
            { description: '切换管理员面板', category: 'admin' }
        );

        // 主题切换
        this.register(
            'ctrl+shift+t',
            () => {
                uiManager.themeManager.toggleTheme();
            },
            { description: '切换主题', category: 'ui' }
        );

        // 刷新
        this.register(
            'f5',
            () => {
                galleryManager.refreshGallery(true);
            },
            { description: '刷新图片库', category: 'gallery' }
        );
    }

    /**
     * 标准化快捷键
     * @param {string} combination - 快捷键组合
     * @returns {string} 标准化的快捷键
     * @private
     */
    _normalizeShortcut(combination) {
        return combination.toLowerCase().replace(/\s+/g, '').split('+').sort().join('+');
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
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'));

        if (imageFiles.length === 0) {
            uiManager.tooltipManager.warning('请选择图片文件');
            return;
        }

        if (!adminManager.isAdminMode && !adminManager.getAuthToken()) {
            uiManager.tooltipManager.warning('请先以管理员身份登录 GitHub');
            uiManager.modalManager.show('admin-login-modal');
            return;
        }

        const progressId = `upload-${Date.now()}`;
        uiManager.progressManager.create(progressId, {
            title: '正在上传图片...',
            showPercentage: true
        });

        try {
            const result = await imageUploader.uploadFiles(imageFiles, {
                onProgress: ({ current, total, fileName }) => {
                    const progress = (current / total) * 100;
                    uiManager.progressManager.update(
                        progressId,
                        Math.round(progress),
                        `上传中 (${current}/${total}): ${fileName}`
                    );
                    eventManager.emitUploadProgress({
                        current,
                        total,
                        fileName,
                        progress
                    });
                }
            });

            if (result.uploaded.length > 0) {
                await galleryManager.refreshGallery({ force: true, showLoading: false });
                eventManager.emitUploadComplete({
                    count: result.uploaded.length,
                    timestamp: Date.now()
                });
            }

            const summary = [`成功 ${result.uploaded.length}`];
            if (result.skipped.length) summary.push(`跳过 ${result.skipped.length}`);
            if (result.failed.length) summary.push(`失败 ${result.failed.length}`);
            if (result.failed.length > 0) {
                uiManager.tooltipManager.error(`${summary.join(' / ')}：${result.failed[0].error}`);
            } else {
                uiManager.tooltipManager.success(summary.join(' / '));
            }
        } catch (error) {
            console.error('文件上传失败:', error);
            uiManager.tooltipManager.error(error.message || '文件上传失败');
        } finally {
            uiManager.progressManager.remove(progressId);
        }
    }

    /**
     * 绑定全局事件
     * @private
     */
    _bindEvents() {
        // 防止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
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
        ['imageLoadTimes', 'searchTimes', 'filterTimes'].forEach((metric) => {
            if (Array.isArray(report[metric]) && report[metric].length > 0) {
                const values = report[metric].map((item) => item.value);
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
        this.observers.forEach((observer) => {
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
        this.currentModalImage = null;

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

            // 4. 初始化API客户端（仅在显式配置后启用，避免默认连接 localhost 造成控制台噪音）
            if (CONFIG.API.ENABLED) {
                appLogger.info('🌐 初始化API客户端...');
                apiClient
                    .get('/health', {}, { cache: false })
                    .then(() => {
                        appLogger.info('✅ 后端API连接成功');
                        this.stateManager.setState('apiConnected', true);
                    })
                    .catch((error) => {
                        appLogger.warn('⚠️ 后端API连接失败，将使用本地模式:', error.message);
                        this.stateManager.setState('apiConnected', false);
                    });
            } else {
                appLogger.info('ℹ️ 未配置后端 API，使用本地模式');
                this.stateManager.setState('apiConnected', false);
            }

            // 5. 初始化AI引擎（可选；模块化预览版默认关闭）
            if (CONFIG.AI.ENABLED) {
                appLogger.info('🤖 后台初始化AI引擎...');
                aiEngine
                    .initialize()
                    .then((success) => {
                        appLogger.info(`✅ AI引擎初始化完成，成功: ${success}`);
                        if (!success) {
                            console.warn('⚠️ AI功能初始化失败，应用将以基础模式运行');
                        }
                    })
                    .catch((error) => {
                        console.warn('⚠️ AI引擎初始化异常:', error.message);
                    });
            } else {
                appLogger.info('ℹ️ AI 分析默认关闭，可在 config.js 中开启 CONFIG.AI.ENABLED');
            }

            // 6. 初始化Prompt智能引擎（仅在配置后端后请求远端模板）
            if (CONFIG.API.ENABLED) {
                appLogger.info('✨ 后台初始化Prompt智能引擎...');
                promptEngine
                    .getTemplates()
                    .then(() => appLogger.info('✅ Prompt智能引擎初始化完成'))
                    .catch((error) => appLogger.warn('⚠️ Prompt引擎初始化失败:', error.message));
            } else {
                appLogger.info('ℹ️ Prompt 使用本地模板');
            }

            // 7. 初始化多模态引擎
            appLogger.info('🎭 初始化多模态引擎...');
            appLogger.info('✅ 多模态引擎初始化完成');

            // 8. 初始化图片库管理器
            appLogger.info('📚 初始化图片库管理器...');
            this._bindUIEvents();
            await galleryManager.refreshGallery({ force: true, showLoading: false });
            this._syncGalleryUi();
            appLogger.info('✅ 图片库管理器初始化完成');

            // 9. 设置拖拽区域
            const dropZone = document.body;
            this.dragDropManager.setDropZone(dropZone);
            appLogger.info('✅ 拖拽区域设置完成');

            // 10. UI事件已在上方绑定
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
                }, CONFIG.UI.SEARCH_DEBOUNCE);
            });
        }

        // 搜索清除按钮
        const searchClear = document.querySelector('#search-clear');
        if (searchInput && searchClear) {
            const syncClearButton = () => {
                searchClear.classList.toggle('hidden', searchInput.value.length === 0);
            };
            searchInput.addEventListener('input', syncClearButton);
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                syncClearButton();
                galleryManager.searchImages('');
                searchInput.focus();
            });
        }

        // 上传按钮：登录后通过 GitHub Contents API 持久化
        const uploadButton = document.querySelector('#upload-button');
        const uploadInput = document.querySelector('#upload-input');
        if (uploadButton && uploadInput) {
            uploadButton.addEventListener('click', () => {
                if (!adminManager.isAdminMode && !adminManager.getAuthToken()) {
                    uiManager.tooltipManager.warning('请先以管理员身份登录 GitHub');
                    uiManager.modalManager.show('admin-login-modal');
                    return;
                }
                uploadInput.click();
            });
            uploadInput.addEventListener('change', (event) => {
                if (event.target.files && event.target.files.length > 0) {
                    this.dragDropManager._handleFiles(event.target.files);
                }
                event.target.value = '';
            });
        }

        // 管理员登录
        const adminButton = document.querySelector('#admin-button');
        if (adminButton) {
            adminButton.addEventListener('click', () => {
                uiManager.modalManager.show('admin-login-modal');
            });
        }

        const adminForm = document.querySelector('#admin-login-form');
        if (adminForm) {
            adminForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const tokenInput = document.querySelector('#github-token');
                const errorBox = document.querySelector('#login-error');
                const submitButton = adminForm.querySelector('button[type="submit"]');
                const token = tokenInput ? tokenInput.value.trim() : '';

                if (errorBox) {
                    errorBox.classList.add('hidden');
                    errorBox.textContent = '';
                }

                if (!token) {
                    if (errorBox) {
                        errorBox.textContent = '请输入 GitHub Token';
                        errorBox.classList.remove('hidden');
                    }
                    return;
                }

                if (submitButton) {
                    submitButton.disabled = true;
                }
                try {
                    const result = await adminManager.login(token);
                    if (result.success) {
                        if (tokenInput) tokenInput.value = '';
                        uiManager.modalManager.hide('admin-login-modal');
                        uiManager.tooltipManager.success(
                            `欢迎，${result.user?.name || result.user?.login || '管理员'}`
                        );
                        const status = document.querySelector('#admin-button');
                        if (status) {
                            status.setAttribute('aria-label', `管理员：${result.user?.login || '已登录'}`);
                        }
                    } else if (errorBox) {
                        errorBox.textContent = result.error || '登录失败';
                        errorBox.classList.remove('hidden');
                    }
                } catch (error) {
                    if (errorBox) {
                        errorBox.textContent = error.message || '登录失败';
                        errorBox.classList.remove('hidden');
                    }
                } finally {
                    if (submitButton) {
                        submitButton.disabled = false;
                    }
                }
            });
        }

        const tokenVisibility = document.querySelector('#toggle-token-visibility');
        if (tokenVisibility) {
            tokenVisibility.addEventListener('click', () => {
                const input = document.querySelector('#github-token');
                if (!input) return;
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                const icon = tokenVisibility.querySelector('i');
                if (icon) {
                    icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
                }
            });
        }

        // 图片详情标签页与 AI 分析
        document.querySelectorAll('#image-modal .tab-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const tab = button.dataset.tab || 'info';
                this._switchModalTab(tab);
                if (tab === 'ai' && this.currentModalImage && !this.currentModalImage.aiAnalyzed) {
                    this._analyzeCurrentImageWithBackend();
                }
            });
        });

        const reanalyzeButton = document.querySelector('#reanalyze-btn');
        if (reanalyzeButton) {
            reanalyzeButton.addEventListener('click', () => {
                if (this.currentModalImage) {
                    this._analyzeCurrentImageWithBackend();
                }
            });
        }

        // 模态框关闭按钮
        document.querySelectorAll('.modal-close').forEach((button) => {
            button.addEventListener('click', () => uiManager.modalManager.hideAll());
        });

        // 主题切换按钮
        const themeButton = document.querySelector('#theme-toggle');
        if (themeButton) {
            themeButton.addEventListener('click', () => {
                uiManager.themeManager.toggleTheme();
            });
        }

        // 视图切换
        document.querySelectorAll('.view-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const viewMode = button.dataset.view;
                if (viewMode) {
                    galleryManager.viewManager.setViewMode(viewMode);
                }
            });
        });

        // 排序
        const sortSelect = document.querySelector('#sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const [rawField, direction] = sortSelect.value.split('-');
                const field = rawField === 'date' ? 'uploadTime' : rawField;
                galleryManager.sortManager.setSort(field, direction || 'desc');
                galleryManager.paginationManager.setCurrentPage(1);
            });
        }

        // 过滤器
        const dateFilter = document.querySelector('#date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                const value = dateFilter.value;
                if (!value) {
                    galleryManager.filterManager.setFilter('dateRange', null);
                    return;
                }
                const now = new Date();
                const start = new Date(now);
                if (value === 'today') {
                    start.setHours(0, 0, 0, 0);
                } else if (value === 'week') {
                    start.setDate(start.getDate() - 7);
                } else if (value === 'month') {
                    start.setMonth(start.getMonth() - 1);
                } else if (value === 'year') {
                    start.setFullYear(start.getFullYear() - 1);
                }
                galleryManager.filterManager.setFilter('dateRange', {
                    start: start.getTime(),
                    end: Date.now()
                });
            });
        }

        const typeFilter = document.querySelector('#type-filter');
        if (typeFilter) {
            typeFilter.addEventListener('change', () => {
                galleryManager.filterManager.setFilter('fileType', typeFilter.value || null);
            });
        }

        const clearFilters = document.querySelector('#clear-filters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                galleryManager.filterManager.clearAllFilters();
                if (dateFilter) dateFilter.value = '';
                if (typeFilter) typeFilter.value = '';
                const aiTagFilter = document.querySelector('#ai-tag-filter');
                if (aiTagFilter) aiTagFilter.value = '';
                galleryManager.applyFilters();
            });
        }

        // 分页
        const prevPage = document.querySelector('#prev-page');
        const nextPage = document.querySelector('#next-page');
        if (prevPage) {
            prevPage.addEventListener('click', () => galleryManager.paginationManager.previousPage());
        }
        if (nextPage) {
            nextPage.addEventListener('click', () => galleryManager.paginationManager.nextPage());
        }
        const pageNumbers = document.querySelector('#page-numbers');
        if (pageNumbers) {
            pageNumbers.addEventListener('click', (event) => {
                const button = event.target.closest('[data-page]');
                if (button) {
                    galleryManager.paginationManager.setCurrentPage(Number(button.dataset.page));
                }
            });
        }

        // 画廊事件
        eventManager.on('gallery:display-updated', (data) => this._renderGalleryChrome(data));
        eventManager.on('gallery:view-changed', (data) => this._syncViewButtons(data.viewMode));
        eventManager.on('gallery:rendered', () => this.lazyLoader.observeAll());
        eventManager.on('gallery:image-clicked', (data) => {
            if (data && data.image) {
                this._openImageModal(data.image);
            }
        });
    }

    /**
     * 同步画廊外围 UI（数量与分页）
     * @private
     */
    _syncGalleryUi() {
        this._renderGalleryChrome({
            displayedImages: galleryManager.getDisplayedImages(),
            paginationInfo: galleryManager.paginationManager.getPaginationInfo(),
            viewMode: galleryManager.viewManager.getCurrentView()
        });
        this._syncViewButtons(galleryManager.viewManager.getCurrentView());
    }

    /**
     * 渲染图片数量与分页控件
     * @param {Object} data - display-updated 事件数据
     * @private
     */
    _renderGalleryChrome(data = {}) {
        const count = document.querySelector('#image-count');
        if (count) {
            const info = data.paginationInfo || {};
            const total = info.totalItems || 0;
            const start = info.startItem || 0;
            const end = info.endItem || 0;
            count.textContent = total > 0 ? `${start}–${end} / 共 ${total} 张` : '0 张图片';
        }

        const pagination = document.querySelector('#pagination');
        const pageNumbers = document.querySelector('#page-numbers');
        const prevPage = document.querySelector('#prev-page');
        const nextPage = document.querySelector('#next-page');
        const info = data.paginationInfo || {};
        const totalPages = info.totalPages || 0;

        if (pagination) {
            pagination.classList.toggle('hidden', totalPages <= 1);
        }
        if (prevPage) {
            prevPage.disabled = !info.hasPrevious;
        }
        if (nextPage) {
            nextPage.disabled = !info.hasNext;
        }
        if (!pageNumbers) return;

        pageNumbers.innerHTML = '';
        if (totalPages <= 1) return;

        const current = info.currentPage || 1;
        const pages = galleryManager.paginationManager.getPageRange(7);
        pages.forEach((page) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.page = String(page);
            button.className = `pagination-btn${page === current ? ' active' : ''}`;
            button.textContent = String(page);
            button.setAttribute('aria-label', `第 ${page} 页`);
            if (page === current) {
                button.setAttribute('aria-current', 'page');
            }
            pageNumbers.appendChild(button);
        });
    }

    /**
     * 同步视图按钮状态
     * @param {string} viewMode - 当前视图
     * @private
     */
    _syncViewButtons(viewMode) {
        document.querySelectorAll('.view-btn').forEach((button) => {
            const active = button.dataset.view === viewMode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-checked', active ? 'true' : 'false');
        });
    }

    /**
     * 打开图片详情模态框
     * @param {Object} image - 图片数据
     * @private
     */
    _openImageModal(image) {
        const modal = document.querySelector('#image-modal');
        if (!modal) return;

        this.currentModalImage = image;
        this._switchModalTab('info');

        const modalImage = document.querySelector('#modal-image');
        if (modalImage) {
            modalImage.src = image.url;
            modalImage.alt = image.name || '';
        }

        const title = document.querySelector('#modal-title');
        if (title) title.textContent = image.name || '图片详情';

        const setText = (selector, value) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = value;
        };

        setText('#info-filename', image.name || '未知');
        setText('#info-filesize', image.size ? `${(image.size / 1024).toFixed(1)} KB` : '未知');
        setText('#info-dimensions', image.width && image.height ? `${image.width} × ${image.height}` : '未知');
        setText('#info-upload-time', image.timestamp ? new Date(image.timestamp).toLocaleString('zh-CN') : '未知');

        const aiTags = document.querySelector('#ai-tags');
        if (aiTags) {
            aiTags.innerHTML = '';
            const tags = Array.isArray(image.aiTags) ? image.aiTags : [];
            if (tags.length === 0) {
                const empty = document.createElement('span');
                empty.className = 'text-sm text-gray-500';
                empty.textContent = '暂无 AI 标签';
                aiTags.appendChild(empty);
            } else {
                tags.forEach((tag) => {
                    const chip = document.createElement('span');
                    chip.className = 'tag-item text-sm px-2 py-1 rounded-full';
                    chip.textContent = typeof tag === 'string' ? tag : tag.label || '';
                    aiTags.appendChild(chip);
                });
            }
        }
        setText('#ai-description', image.aiDescription || '暂无 AI 描述');
        const objects = document.querySelector('#detected-objects');
        if (objects) {
            objects.innerHTML = '';
            const detections = Array.isArray(image.detections) ? image.detections : [];
            if (detections.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'text-sm text-gray-500';
                empty.textContent = '暂无检测结果';
                objects.appendChild(empty);
            }
        }

        setText(
            '#ai-status',
            CONFIG.API.ENABLED
                ? '点击「AI分析」或「重新分析」调用后端视觉模型。'
                : 'AI 分析需要后端 API：请先启动 backend 并设置 localStorage.api_base_url 后刷新。'
        );

        uiManager.modalManager.show('image-modal');
    }

    /**
     * 切换图片详情模态框标签页
     * @param {string} tab - info | ai | notes
     * @private
     */
    _switchModalTab(tab) {
        document.querySelectorAll('#image-modal .tab-btn').forEach((button) => {
            const active = button.dataset.tab === tab;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        ['info', 'ai', 'notes'].forEach((name) => {
            const content = document.querySelector(`#tab-${name}`);
            if (content) {
                content.classList.toggle('hidden', name !== tab);
            }
        });
    }

    /**
     * 调用后端真实 AI 分析当前图片
     * @private
     */
    async _analyzeCurrentImageWithBackend() {
        const image = this.currentModalImage;
        const status = document.querySelector('#ai-status');
        const description = document.querySelector('#ai-description');
        const tagsContainer = document.querySelector('#ai-tags');
        const objectsContainer = document.querySelector('#detected-objects');
        const button = document.querySelector('#reanalyze-btn');

        if (!image) return;
        if (!CONFIG.API.ENABLED) {
            if (status) {
                status.textContent = 'AI 分析需要后端 API：请先启动 backend，并设置 localStorage.api_base_url 后刷新。';
            }
            return;
        }

        const setStatus = (text) => {
            if (status) status.textContent = text;
        };
        const setDescription = (text) => {
            if (description) description.textContent = text;
        };

        if (button) button.disabled = true;
        setStatus('正在调用后端视觉模型...');
        setDescription('分析中...');
        if (tagsContainer) tagsContainer.innerHTML = '';
        if (objectsContainer) objectsContainer.innerHTML = '';

        try {
            const imageUrl = new URL(image.url, location.href).href;
            const result = await analysisAPI.analyzeUrl({
                image_url: imageUrl,
                analysis_types: ['all'],
                language: 'zh',
                confidence_threshold: 0.3
            });

            if (!result || !result.success || !result.data) {
                throw new Error(result?.message || 'AI 分析失败');
            }

            const data = result.data;
            const tags = Array.isArray(data.tags) ? data.tags : [];
            if (tagsContainer) {
                tagsContainer.innerHTML = '';
                tags.forEach((tag) => {
                    const chip = document.createElement('span');
                    chip.className = 'tag-item text-sm px-2 py-1 rounded-full';
                    chip.textContent = String(tag);
                    tagsContainer.appendChild(chip);
                });
            }

            const caption = data.caption?.caption || '';
            setDescription(caption || (tags.length ? tags.join('、') : '暂无 AI 描述'));

            const detections = Array.isArray(data.detections) ? data.detections : [];
            if (objectsContainer) {
                objectsContainer.innerHTML = '';
                if (detections.length === 0) {
                    const empty = document.createElement('p');
                    empty.className = 'text-sm text-gray-500';
                    empty.textContent = '暂无检测结果';
                    objectsContainer.appendChild(empty);
                } else {
                    detections.slice(0, 8).forEach((item) => {
                        const line = document.createElement('p');
                        line.className = 'text-sm text-gray-700 dark:text-gray-300';
                        const label = item.label_zh || item.label || '对象';
                        const confidence = Math.round((Number(item.confidence) || 0) * 100);
                        line.textContent = `${label} · ${confidence}%`;
                        objectsContainer.appendChild(line);
                    });
                }
            }

            image.aiTags = tags;
            image.aiDescription = caption;
            image.aiAnalyzed = true;
            image.detections = detections;
            setStatus(
                data.provider === 'openai'
                    ? `真实模型分析完成（${data.model_version || 'vision'}）`
                    : '演示数据：未配置 AI_API_KEY，配置后自动使用真实模型。'
            );
        } catch (error) {
            setStatus(`分析失败：${error.message}`);
            setDescription('无法获取 AI 分析结果，请检查后端服务或 API 配置。');
        } finally {
            if (button) button.disabled = false;
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
export { App, AppStateManager, KeyboardShortcutManager, DragDropManager, PerformanceMonitor };

export default app;
