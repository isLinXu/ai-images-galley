/**
 * AI智能相册系统 - UI管理器
 * 负责界面组件的创建、管理、交互和状态管理
 */

import { CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from './config.js';
import { DOMUtils, StringUtils, TimeUtils, ThrottleUtils } from './utils.js';
import eventManager from './eventManager.js';
import storageManager from './storageManager.js';

/**
 * 模态框管理器
 */
class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.modalStack = [];
        this.escapeKeyHandler = this._handleEscapeKey.bind(this);
        this.backdropClickHandler = this._handleBackdropClick.bind(this);
        
        this._bindGlobalEvents();
    }

    /**
     * 显示模态框
     * @param {string} modalId - 模态框ID
     * @param {Object} options - 显示选项
     */
    show(modalId, options = {}) {
        const {
            closeOnEscape = true,
            closeOnBackdrop = true,
            focus = true,
            onShow = null,
            onHide = null
        } = options;

        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`模态框不存在: ${modalId}`);
            return;
        }

        // 添加到活动模态框集合
        this.activeModals.add(modalId);
        this.modalStack.push({
            id: modalId,
            options,
            previousFocus: document.activeElement
        });

        // 显示模态框
        modal.style.display = 'flex';
        modal.classList.add('active');
        
        // 设置焦点
        if (focus) {
            this._setModalFocus(modal);
        }
        
        // 禁用背景滚动
        document.body.style.overflow = 'hidden';
        
        // 触发显示事件
        if (onShow) onShow(modal);
        eventManager.emit('modal:show', { modalId, modal });
        
        // 添加动画类
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }

    /**
     * 隐藏模态框
     * @param {string} modalId - 模态框ID
     */
    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal || !this.activeModals.has(modalId)) {
            return;
        }

        // 从活动模态框集合中移除
        this.activeModals.delete(modalId);
        const modalInfo = this.modalStack.find(m => m.id === modalId);
        this.modalStack = this.modalStack.filter(m => m.id !== modalId);

        // 添加隐藏动画
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('active');
            
            // 恢复焦点
            if (modalInfo?.previousFocus) {
                modalInfo.previousFocus.focus();
            }
            
            // 如果没有其他模态框，恢复背景滚动
            if (this.activeModals.size === 0) {
                document.body.style.overflow = '';
            }
            
            // 触发隐藏事件
            if (modalInfo?.options.onHide) {
                modalInfo.options.onHide(modal);
            }
            eventManager.emit('modal:hide', { modalId, modal });
        }, 300); // 动画持续时间
    }

    /**
     * 隐藏所有模态框
     */
    hideAll() {
        const modalIds = Array.from(this.activeModals);
        modalIds.forEach(id => this.hide(id));
    }

    /**
     * 设置模态框焦点
     * @param {HTMLElement} modal - 模态框元素
     * @private
     */
    _setModalFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }

    /**
     * 处理ESC键
     * @param {KeyboardEvent} event - 键盘事件
     * @private
     */
    _handleEscapeKey(event) {
        if (event.key === 'Escape' && this.modalStack.length > 0) {
            const topModal = this.modalStack[this.modalStack.length - 1];
            if (topModal.options.closeOnEscape !== false) {
                this.hide(topModal.id);
            }
        }
    }

    /**
     * 处理背景点击
     * @param {MouseEvent} event - 鼠标事件
     * @private
     */
    _handleBackdropClick(event) {
        if (this.modalStack.length === 0) return;
        
        const topModal = this.modalStack[this.modalStack.length - 1];
        const modal = document.getElementById(topModal.id);
        
        if (event.target === modal && topModal.options.closeOnBackdrop !== false) {
            this.hide(topModal.id);
        }
    }

    /**
     * 绑定全局事件
     * @private
     */
    _bindGlobalEvents() {
        document.addEventListener('keydown', this.escapeKeyHandler);
        document.addEventListener('click', this.backdropClickHandler);
    }

    /**
     * 获取活动模态框
     * @returns {Array} 活动模态框ID数组
     */
    getActiveModals() {
        return Array.from(this.activeModals);
    }
}

/**
 * 提示框管理器
 */
class TooltipManager {
    constructor() {
        this.activeTooltips = new Map();
        this.tooltipContainer = null;
        this.hideTimeout = null;
        
        this._createContainer();
    }

    /**
     * 显示提示框
     * @param {string} message - 提示消息
     * @param {Object} options - 显示选项
     */
    show(message, options = {}) {
        const {
            type = 'info', // info, success, warning, error
            duration = 3000,
            position = 'top-right',
            closable = true,
            html = false
        } = options;

        const tooltip = this._createTooltip(message, { type, closable, html });
        const tooltipId = StringUtils.generateId();
        
        tooltip.setAttribute('data-tooltip-id', tooltipId);
        this.activeTooltips.set(tooltipId, tooltip);
        
        // 添加到容器
        this.tooltipContainer.appendChild(tooltip);
        
        // 添加显示动画
        requestAnimationFrame(() => {
            tooltip.classList.add('show');
        });
        
        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                this.hide(tooltipId);
            }, duration);
        }
        
        return tooltipId;
    }

    /**
     * 隐藏提示框
     * @param {string} tooltipId - 提示框ID
     */
    hide(tooltipId) {
        const tooltip = this.activeTooltips.get(tooltipId);
        if (!tooltip) return;
        
        tooltip.classList.remove('show');
        
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            this.activeTooltips.delete(tooltipId);
        }, 300);
    }

    /**
     * 创建提示框元素
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     * @returns {HTMLElement} 提示框元素
     * @private
     */
    _createTooltip(message, options) {
        const { type, closable, html } = options;
        
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip-${type}`;
        
        const content = document.createElement('div');
        content.className = 'tooltip-content';
        
        if (html) {
            content.innerHTML = message;
        } else {
            content.textContent = message;
        }
        
        tooltip.appendChild(content);
        
        // 添加关闭按钮
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'tooltip-close';
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => {
                const tooltipId = tooltip.getAttribute('data-tooltip-id');
                this.hide(tooltipId);
            };
            tooltip.appendChild(closeBtn);
        }
        
        return tooltip;
    }

    /**
     * 创建容器
     * @private
     */
    _createContainer() {
        this.tooltipContainer = document.createElement('div');
        this.tooltipContainer.className = 'tooltip-container';
        this.tooltipContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(this.tooltipContainer);
    }

    /**
     * 显示成功提示
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    success(message, options = {}) {
        return this.show(message, { ...options, type: 'success' });
    }

    /**
     * 显示错误提示
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    error(message, options = {}) {
        return this.show(message, { ...options, type: 'error', duration: 5000 });
    }

    /**
     * 显示警告提示
     * @param {string} message - 消息内容
     * @param {Object} options - 选项
     */
    warning(message, options = {}) {
        return this.show(message, { ...options, type: 'warning', duration: 4000 });
    }

    /**
     * 清除所有提示框
     */
    clear() {
        const tooltipIds = Array.from(this.activeTooltips.keys());
        tooltipIds.forEach(id => this.hide(id));
    }
}

/**
 * 进度条管理器
 */
class ProgressManager {
    constructor() {
        this.activeProgress = new Map();
        this.progressContainer = null;
        
        this._createContainer();
    }

    /**
     * 创建进度条
     * @param {string} id - 进度条ID
     * @param {Object} options - 选项
     * @returns {string} 进度条ID
     */
    create(id, options = {}) {
        const {
            title = '处理中...',
            showPercentage = true,
            showCancel = false,
            onCancel = null
        } = options;

        const progressElement = this._createProgressElement(id, {
            title,
            showPercentage,
            showCancel,
            onCancel
        });
        
        this.activeProgress.set(id, {
            element: progressElement,
            options,
            value: 0
        });
        
        this.progressContainer.appendChild(progressElement);
        
        // 添加显示动画
        requestAnimationFrame(() => {
            progressElement.classList.add('show');
        });
        
        return id;
    }

    /**
     * 更新进度
     * @param {string} id - 进度条ID
     * @param {number} value - 进度值 (0-100)
     * @param {string} message - 进度消息
     */
    update(id, value, message = '') {
        const progress = this.activeProgress.get(id);
        if (!progress) return;
        
        progress.value = Math.max(0, Math.min(100, value));
        
        const progressBar = progress.element.querySelector('.progress-bar');
        const progressText = progress.element.querySelector('.progress-text');
        const progressPercentage = progress.element.querySelector('.progress-percentage');
        
        if (progressBar) {
            progressBar.style.width = `${progress.value}%`;
        }
        
        if (progressText && message) {
            progressText.textContent = message;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(progress.value)}%`;
        }
        
        // 触发进度更新事件
        eventManager.emit('progress:update', {
            id,
            value: progress.value,
            message
        });
    }

    /**
     * 完成进度
     * @param {string} id - 进度条ID
     * @param {string} message - 完成消息
     */
    complete(id, message = '完成') {
        this.update(id, 100, message);
        
        setTimeout(() => {
            this.remove(id);
        }, 1000);
    }

    /**
     * 移除进度条
     * @param {string} id - 进度条ID
     */
    remove(id) {
        const progress = this.activeProgress.get(id);
        if (!progress) return;
        
        progress.element.classList.remove('show');
        
        setTimeout(() => {
            if (progress.element.parentNode) {
                progress.element.parentNode.removeChild(progress.element);
            }
            this.activeProgress.delete(id);
        }, 300);
    }

    /**
     * 创建进度条元素
     * @param {string} id - 进度条ID
     * @param {Object} options - 选项
     * @returns {HTMLElement} 进度条元素
     * @private
     */
    _createProgressElement(id, options) {
        const { title, showPercentage, showCancel, onCancel } = options;
        
        const element = document.createElement('div');
        element.className = 'progress-item';
        element.setAttribute('data-progress-id', id);
        
        element.innerHTML = `
            <div class="progress-header">
                <span class="progress-title">${title}</span>
                ${showPercentage ? '<span class="progress-percentage">0%</span>' : ''}
                ${showCancel ? '<button class="progress-cancel">×</button>' : ''}
            </div>
            <div class="progress-track">
                <div class="progress-bar"></div>
            </div>
            <div class="progress-text"></div>
        `;
        
        // 绑定取消按钮事件
        if (showCancel && onCancel) {
            const cancelBtn = element.querySelector('.progress-cancel');
            cancelBtn.onclick = () => {
                onCancel(id);
                this.remove(id);
            };
        }
        
        return element;
    }

    /**
     * 创建容器
     * @private
     */
    _createContainer() {
        this.progressContainer = document.createElement('div');
        this.progressContainer.className = 'progress-container';
        this.progressContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 300px;
        `;
        document.body.appendChild(this.progressContainer);
    }

    /**
     * 获取所有活动进度条
     * @returns {Array} 进度条信息数组
     */
    getActiveProgress() {
        return Array.from(this.activeProgress.entries()).map(([id, progress]) => ({
            id,
            value: progress.value,
            options: progress.options
        }));
    }
}

/**
 * 加载状态管理器
 */
class LoadingManager {
    constructor() {
        this.loadingStates = new Map();
        this.globalLoading = false;
        this.loadingOverlay = null;
        
        this._createOverlay();
    }

    /**
     * 显示加载状态
     * @param {string} id - 加载ID
     * @param {Object} options - 选项
     */
    show(id, options = {}) {
        const {
            message = '加载中...',
            global = false,
            target = null,
            spinner = true
        } = options;

        const loadingState = {
            id,
            message,
            global,
            target,
            spinner,
            startTime: Date.now()
        };
        
        this.loadingStates.set(id, loadingState);
        
        if (global) {
            this._showGlobalLoading(message, spinner);
        } else if (target) {
            this._showTargetLoading(target, message, spinner);
        }
        
        eventManager.emit('loading:show', { id, options });
    }

    /**
     * 隐藏加载状态
     * @param {string} id - 加载ID
     */
    hide(id) {
        const loadingState = this.loadingStates.get(id);
        if (!loadingState) return;
        
        const duration = Date.now() - loadingState.startTime;
        
        if (loadingState.global) {
            this._hideGlobalLoading();
        } else if (loadingState.target) {
            this._hideTargetLoading(loadingState.target);
        }
        
        this.loadingStates.delete(id);
        
        eventManager.emit('loading:hide', {
            id,
            duration
        });
    }

    /**
     * 显示全局加载
     * @param {string} message - 加载消息
     * @param {boolean} spinner - 是否显示旋转器
     * @private
     */
    _showGlobalLoading(message, spinner) {
        if (this.globalLoading) return;
        
        this.globalLoading = true;
        this.loadingOverlay.style.display = 'flex';
        
        const messageEl = this.loadingOverlay.querySelector('.loading-message');
        const spinnerEl = this.loadingOverlay.querySelector('.loading-spinner');
        
        if (messageEl) messageEl.textContent = message;
        if (spinnerEl) spinnerEl.style.display = spinner ? 'block' : 'none';
        
        requestAnimationFrame(() => {
            this.loadingOverlay.classList.add('show');
        });
    }

    /**
     * 隐藏全局加载
     * @private
     */
    _hideGlobalLoading() {
        if (!this.globalLoading) return;
        
        this.globalLoading = false;
        this.loadingOverlay.classList.remove('show');
        
        setTimeout(() => {
            this.loadingOverlay.style.display = 'none';
        }, 300);
    }

    /**
     * 显示目标加载
     * @param {HTMLElement} target - 目标元素
     * @param {string} message - 加载消息
     * @param {boolean} spinner - 是否显示旋转器
     * @private
     */
    _showTargetLoading(target, message, spinner) {
        if (!target) return;
        
        const loadingEl = document.createElement('div');
        loadingEl.className = 'target-loading';
        loadingEl.innerHTML = `
            ${spinner ? '<div class="loading-spinner"></div>' : ''}
            <div class="loading-message">${message}</div>
        `;
        
        target.style.position = 'relative';
        target.appendChild(loadingEl);
        
        requestAnimationFrame(() => {
            loadingEl.classList.add('show');
        });
    }

    /**
     * 隐藏目标加载
     * @param {HTMLElement} target - 目标元素
     * @private
     */
    _hideTargetLoading(target) {
        if (!target) return;
        
        const loadingEl = target.querySelector('.target-loading');
        if (loadingEl) {
            loadingEl.classList.remove('show');
            setTimeout(() => {
                if (loadingEl.parentNode) {
                    loadingEl.parentNode.removeChild(loadingEl);
                }
            }, 300);
        }
    }

    /**
     * 创建全局加载覆盖层
     * @private
     */
    _createOverlay() {
        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.className = 'loading-overlay';
        this.loadingOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        this.loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message">加载中...</div>
            </div>
        `;
        
        document.body.appendChild(this.loadingOverlay);
    }

    /**
     * 检查是否有活动的加载状态
     * @returns {boolean} 是否有活动加载
     */
    hasActiveLoading() {
        return this.loadingStates.size > 0;
    }

    /**
     * 获取所有加载状态
     * @returns {Array} 加载状态数组
     */
    getLoadingStates() {
        return Array.from(this.loadingStates.values());
    }
}

/**
 * 主题管理器
 */
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.themes = CONFIG.THEMES;
        this.transitionDuration = 300;
        
        this._loadSavedTheme();
        this._bindEvents();
    }

    /**
     * 设置主题
     * @param {string} themeName - 主题名称
     */
    setTheme(themeName) {
        if (!this.themes[themeName]) {
            console.error(`主题不存在: ${themeName}`);
            return;
        }
        
        const oldTheme = this.currentTheme;
        this.currentTheme = themeName;
        
        // 添加过渡效果
        document.body.style.transition = `all ${this.transitionDuration}ms ease`;
        
        // 移除旧主题类
        document.body.classList.remove(`theme-${oldTheme}`);
        
        // 添加新主题类
        document.body.classList.add(`theme-${themeName}`);
        
        // 更新CSS变量
        this._updateCSSVariables(this.themes[themeName]);
        
        // 保存主题设置
        storageManager.specializedStorage.userPreferences.set('theme', themeName);
        
        // 移除过渡效果
        setTimeout(() => {
            document.body.style.transition = '';
        }, this.transitionDuration);
        
        // 触发主题变更事件
        eventManager.emitThemeChanged({
            oldTheme,
            newTheme: themeName,
            themeData: this.themes[themeName]
        });
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const themeNames = Object.keys(this.themes);
        const currentIndex = themeNames.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeNames.length;
        
        this.setTheme(themeNames[nextIndex]);
    }

    /**
     * 获取当前主题
     * @returns {string} 当前主题名称
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * 获取主题数据
     * @param {string} themeName - 主题名称
     * @returns {Object|null} 主题数据
     */
    getThemeData(themeName) {
        return this.themes[themeName] || null;
    }

    /**
     * 更新CSS变量
     * @param {Object} themeData - 主题数据
     * @private
     */
    _updateCSSVariables(themeData) {
        const root = document.documentElement;
        
        Object.entries(themeData).forEach(([key, value]) => {
            if (typeof value === 'string') {
                root.style.setProperty(`--${key}`, value);
            } else if (typeof value === 'object') {
                Object.entries(value).forEach(([subKey, subValue]) => {
                    root.style.setProperty(`--${key}-${subKey}`, subValue);
                });
            }
        });
    }

    /**
     * 加载保存的主题
     * @private
     */
    _loadSavedTheme() {
        const savedTheme = storageManager.specializedStorage.userPreferences.get('theme');
        if (savedTheme && this.themes[savedTheme]) {
            this.setTheme(savedTheme);
        } else {
            // 检测系统主题偏好
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
        // 监听系统主题变化
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addListener((e) => {
            const autoTheme = storageManager.specializedStorage.userPreferences.get('autoTheme');
            if (autoTheme) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    /**
     * 设置自动主题
     * @param {boolean} enabled - 是否启用自动主题
     */
    setAutoTheme(enabled) {
        storageManager.specializedStorage.userPreferences.set('autoTheme', enabled);
        
        if (enabled) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.setTheme(prefersDark ? 'dark' : 'light');
        }
    }
}

/**
 * 响应式管理器
 */
class ResponsiveManager {
    constructor() {
        this.breakpoints = CONFIG.UI.BREAKPOINTS;
        this.currentBreakpoint = null;
        this.resizeHandler = ThrottleUtils.throttle(this._handleResize.bind(this), 250);
        
        this._init();
    }

    /**
     * 初始化
     * @private
     */
    _init() {
        this._updateBreakpoint();
        window.addEventListener('resize', this.resizeHandler);
    }

    /**
     * 处理窗口大小变化
     * @private
     */
    _handleResize() {
        const oldBreakpoint = this.currentBreakpoint;
        this._updateBreakpoint();
        
        if (oldBreakpoint !== this.currentBreakpoint) {
            eventManager.emit('responsive:breakpoint-change', {
                oldBreakpoint,
                newBreakpoint: this.currentBreakpoint,
                windowWidth: window.innerWidth
            });
        }
    }

    /**
     * 更新断点
     * @private
     */
    _updateBreakpoint() {
        const width = window.innerWidth;
        
        for (const [name, minWidth] of Object.entries(this.breakpoints)) {
            if (width >= minWidth) {
                this.currentBreakpoint = name;
            }
        }
        
        // 更新body类
        document.body.className = document.body.className
            .replace(/\bbreakpoint-\w+\b/g, '')
            .trim();
        document.body.classList.add(`breakpoint-${this.currentBreakpoint}`);
    }

    /**
     * 获取当前断点
     * @returns {string} 当前断点名称
     */
    getCurrentBreakpoint() {
        return this.currentBreakpoint;
    }

    /**
     * 检查是否为移动设备
     * @returns {boolean} 是否为移动设备
     */
    isMobile() {
        return this.currentBreakpoint === 'xs' || this.currentBreakpoint === 'sm';
    }

    /**
     * 检查是否为平板设备
     * @returns {boolean} 是否为平板设备
     */
    isTablet() {
        return this.currentBreakpoint === 'md';
    }

    /**
     * 检查是否为桌面设备
     * @returns {boolean} 是否为桌面设备
     */
    isDesktop() {
        return this.currentBreakpoint === 'lg' || this.currentBreakpoint === 'xl';
    }
}

/**
 * 主UI管理器
 */
class UIManager {
    constructor() {
        this.modalManager = new ModalManager();
        this.tooltipManager = new TooltipManager();
        this.progressManager = new ProgressManager();
        this.loadingManager = new LoadingManager();
        this.themeManager = new ThemeManager();
        this.responsiveManager = new ResponsiveManager();
        
        this.initialized = false;
        this._bindEvents();
    }

    /**
     * 初始化UI管理器
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // 初始化各个管理器
            await this._initializeComponents();
            
            // 设置全局UI事件监听器
            this._setupGlobalListeners();
            
            this.initialized = true;
            
            eventManager.emit('ui:initialized');
            console.log('UI管理器初始化完成');
            
        } catch (error) {
            console.error('UI管理器初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化组件
     * @private
     */
    async _initializeComponents() {
        // 这里可以添加组件初始化逻辑
        // 例如：加载自定义组件、设置默认状态等
    }

    /**
     * 设置全局监听器
     * @private
     */
    _setupGlobalListeners() {
        // 监听键盘快捷键
        document.addEventListener('keydown', this._handleGlobalKeydown.bind(this));
        
        // 监听点击事件（用于关闭下拉菜单等）
        document.addEventListener('click', this._handleGlobalClick.bind(this));
        
        // 监听滚动事件
        window.addEventListener('scroll', ThrottleUtils.throttle(this._handleGlobalScroll.bind(this), 100));
    }

    /**
     * 处理全局键盘事件
     * @param {KeyboardEvent} event - 键盘事件
     * @private
     */
    _handleGlobalKeydown(event) {
        // Ctrl/Cmd + K: 搜索
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            eventManager.emit('ui:search-shortcut');
        }
        
        // Ctrl/Cmd + T: 切换主题
        if ((event.ctrlKey || event.metaKey) && event.key === 't') {
            event.preventDefault();
            this.themeManager.toggleTheme();
        }
        
        // F11: 全屏切换
        if (event.key === 'F11') {
            event.preventDefault();
            this.toggleFullscreen();
        }
    }

    /**
     * 处理全局点击事件
     * @param {MouseEvent} event - 鼠标事件
     * @private
     */
    _handleGlobalClick(event) {
        // 关闭所有下拉菜单
        const dropdowns = document.querySelectorAll('.dropdown.open');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(event.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    /**
     * 处理全局滚动事件
     * @private
     */
    _handleGlobalScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 更新滚动位置类
        if (scrollTop > 100) {
            document.body.classList.add('scrolled');
        } else {
            document.body.classList.remove('scrolled');
        }
        
        // 触发滚动事件
        eventManager.emit('ui:scroll', { scrollTop });
    }

    /**
     * 切换全屏模式
     */
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error('无法进入全屏模式:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    /**
     * 显示确认对话框
     * @param {string} message - 确认消息
     * @param {Object} options - 选项
     * @returns {Promise<boolean>} 用户选择结果
     */
    confirm(message, options = {}) {
        const {
            title = '确认',
            confirmText = '确定',
            cancelText = '取消',
            type = 'warning'
        } = options;
        
        return new Promise((resolve) => {
            // 创建确认对话框
            const dialog = document.createElement('div');
            dialog.className = `confirm-dialog confirm-${type}`;
            dialog.innerHTML = `
                <div class="confirm-content">
                    <h3 class="confirm-title">${title}</h3>
                    <p class="confirm-message">${message}</p>
                    <div class="confirm-actions">
                        <button class="btn btn-secondary confirm-cancel">${cancelText}</button>
                        <button class="btn btn-primary confirm-ok">${confirmText}</button>
                    </div>
                </div>
            `;
            
            // 添加事件监听器
            const okBtn = dialog.querySelector('.confirm-ok');
            const cancelBtn = dialog.querySelector('.confirm-cancel');
            
            const cleanup = () => {
                document.body.removeChild(dialog);
            };
            
            okBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            // 添加到页面
            document.body.appendChild(dialog);
            
            // 聚焦到确定按钮
            okBtn.focus();
        });
    }

    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        // 监听页面卸载事件
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 清理各个管理器
        this.tooltipManager.clear();
        this.modalManager.hideAll();
        
        // 移除事件监听器
        window.removeEventListener('resize', this.responsiveManager.resizeHandler);
        
        console.log('UI管理器资源已清理');
    }

    /**
     * 获取管理器统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            initialized: this.initialized,
            activeModals: this.modalManager.getActiveModals(),
            activeTooltips: this.tooltipManager.activeTooltips.size,
            activeProgress: this.progressManager.getActiveProgress(),
            loadingStates: this.loadingManager.getLoadingStates(),
            currentTheme: this.themeManager.getCurrentTheme(),
            currentBreakpoint: this.responsiveManager.getCurrentBreakpoint()
        };
    }
}

// 创建全局UI管理器实例
const uiManager = new UIManager();

export {
    ModalManager,
    TooltipManager,
    ProgressManager,
    LoadingManager,
    ThemeManager,
    ResponsiveManager,
    UIManager
};

export default uiManager;