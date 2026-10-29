/**
 * AI智能相册系统 - 画廊渲染器
 * 负责图片的网格/列表/瀑布流渲染，集成懒加载和AI分析
 */

import { StringUtils } from './utils.js';
import { uiLogger, galleryLogger } from './logger.js';
import eventManager from './eventManager.js';

/**
 * 画廊渲染器
 */
class GalleryRenderer {
    constructor(options = {}) {
        this.containerId = options.containerId || 'gallery-container';
        this.gridId = options.gridId || 'image-grid';
        this.listId = options.listId || 'image-list';
        this.masonryId = options.masonryId || 'image-masonry';
        this.emptyStateId = options.emptyStateId || 'empty-state';

        this.currentView = 'grid';
        this.lazyLoading = options.lazyLoading !== false;
        this.autoAnalyze = options.autoAnalyze || false;

        this._init();
    }

    /**
     * 初始化
     * @private
     */
    _init() {
        this._bindEvents();
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
        eventManager.on('gallery:display-updated', (data) => {
            const viewMode = data.viewMode || this.currentView;
            this.currentView = viewMode;
            this.render(data.displayedImages || [], { viewMode });
        });

        eventManager.on('gallery:render-required', (data) => {
            galleryLogger.debug('收到渲染请求:', data);
            this.currentView = data.viewMode || this.currentView;
        });
    }

    /**
     * 获取容器元素
     * @returns {HTMLElement|null}
     * @private
     */
    _getContainer(viewMode) {
        const map = {
            grid: this.gridId,
            list: this.listId,
            masonry: this.masonryId
        };
        return document.getElementById(map[viewMode] || this.gridId);
    }

    /**
     * 渲染图片列表
     * @param {Array} images - 图片数据数组
     * @param {Object} options - 渲染选项
     */
    render(images, options = {}) {
        const viewMode = options.viewMode || this.currentView;
        const container = this._getContainer(viewMode);
        const emptyState = document.getElementById(this.emptyStateId);

        if (!container) {
            galleryLogger.error('渲染容器不存在:', viewMode);
            return;
        }

        // 显示/隐藏空状态
        if (emptyState) {
            emptyState.classList.toggle('hidden', images.length > 0);
        }

        // 隐藏所有视图容器
        [this.gridId, this.listId, this.masonryId].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // 显示当前视图容器
        container.classList.remove('hidden');
        container.innerHTML = '';

        if (images.length === 0) {
            galleryLogger.debug('没有图片需要渲染');
            return;
        }

        const fragment = document.createDocumentFragment();

        images.forEach((image, index) => {
            const card = this._createImageCard(image, index, images);
            fragment.appendChild(card);
        });

        container.appendChild(fragment);

        // 触发渲染完成事件
        eventManager.emit('gallery:rendered', {
            count: images.length,
            viewMode,
            timestamp: Date.now()
        });

        galleryLogger.info(`渲染完成: ${images.length} 张图片, 视图: ${viewMode}`);
    }

    /**
     * 创建图片卡片
     * @param {Object} image - 图片数据
     * @param {number} index - 索引
     * @param {Array} allImages - 所有图片数组
     * @returns {HTMLElement}
     * @private
     */
    _createImageCard(image, index, allImages) {
        const card = document.createElement('div');
        card.className = 'image-card rounded-xl p-4 glass-effect';
        card.dataset.imageId = image.id;
        card.dataset.cacheKey = image.url || image.id;
        card.setAttribute('role', 'listitem');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `图片: ${StringUtils.escapeHtml(image.name || '未命名')}`);

        // 图片容器
        const container = this._createImageContainer(image);
        card.appendChild(container);

        // 详情区域
        const details = this._createImageDetails(image);
        card.appendChild(details);

        // 点击事件
        card.addEventListener('click', () => {
            eventManager.emit('gallery:image-clicked', {
                image,
                index,
                images: allImages
            });
        });

        // 键盘事件
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                eventManager.emit('gallery:image-clicked', {
                    image,
                    index,
                    images: allImages
                });
            }
        });

        return card;
    }

    /**
     * 创建图片容器
     * @param {Object} image - 图片数据
     * @returns {HTMLElement}
     * @private
     */
    _createImageContainer(image) {
        const container = document.createElement('div');
        container.className = 'image-container relative overflow-hidden rounded-lg';

        // 加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className =
            'image-loading pulse-animation absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700';
        loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin text-2xl text-gray-400" aria-hidden="true"></i>';
        container.appendChild(loadingIndicator);

        // 图片元素
        const img = document.createElement('img');
        const displayUrl = image.thumbnailUrl || image.url;
        img.alt = StringUtils.escapeHtml(image.name || '');
        img.className = 'smart-crop lazy-image w-full h-full object-cover';
        img.loading = 'lazy';
        img.decoding = 'async';
        if (image.width && image.height) {
            img.width = image.width;
            img.height = image.height;
        }

        if (this.lazyLoading && displayUrl) {
            img.dataset.src = displayUrl;
            img.dataset.fullSrc = image.url || displayUrl;
            img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        } else if (displayUrl) {
            img.src = displayUrl;
        }

        img.onload = () => {
            img.classList.add('loaded');
            loadingIndicator.remove();
        };

        img.onerror = () => {
            // 缩略图可能尚未生成（例如仓库手动新增图片），回退到原图一次。
            if (image.thumbnailUrl && image.url && displayUrl !== image.url && !img.dataset.thumbnailFallback) {
                img.dataset.thumbnailFallback = '1';
                img.src = image.url;
                return;
            }
            loadingIndicator.innerHTML = `
                <div class="text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl" aria-hidden="true"></i>
                    <span class="block text-sm mt-1">加载失败</span>
                </div>
            `;
        };

        container.appendChild(img);

        // AI分析覆盖层
        const overlay = document.createElement('div');
        overlay.className =
            'ai-analysis-overlay absolute inset-0 flex items-center justify-center flex-col opacity-0 transition-opacity duration-300';
        overlay.innerHTML = `
            <svg class="ai-progress-ring w-16 h-16" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="25" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
                <circle class="progress" cx="30" cy="30" r="25" fill="none" stroke="white" stroke-width="3"
                    stroke-dasharray="157" stroke-dashoffset="157" transform="rotate(-90 30 30)"/>
            </svg>
            <p class="text-white font-semibold mt-2 text-sm">AI分析中...</p>
        `;
        container.appendChild(overlay);

        return container;
    }

    /**
     * 创建图片详情
     * @param {Object} image - 图片数据
     * @returns {HTMLElement}
     * @private
     */
    _createImageDetails(image) {
        const details = document.createElement('div');
        details.className = 'mt-4';

        const title = document.createElement('h3');
        title.className = 'high-contrast-text font-semibold truncate text-sm';
        title.textContent = image.name || '未命名';
        title.title = image.name || '';
        details.appendChild(title);

        // 标签区域
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags flex flex-wrap gap-2 mt-2';

        if (image.aiTags && image.aiTags.length > 0) {
            image.aiTags.slice(0, 3).forEach((tag) => {
                const tagEl = document.createElement('span');
                tagEl.className =
                    'tag text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
                tagEl.textContent = typeof tag === 'string' ? tag : tag.label || '';
                tagsContainer.appendChild(tagEl);
            });
        }

        details.appendChild(tagsContainer);

        // 元信息
        const meta = document.createElement('div');
        meta.className = 'flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400';

        const sizeText = image.size ? this._formatFileSize(image.size) : '';
        const dateValue = image.uploadTime || image.timestamp;
        const dateText = dateValue ? this._formatDate(dateValue) : '';

        meta.innerHTML = `
            <span>${sizeText}</span>
            <span>${dateText}</span>
        `;
        details.appendChild(meta);

        return details;
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string}
     * @private
     */
    _formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    /**
     * 格式化日期
     * @param {Date|string} date - 日期
     * @returns {string}
     * @private
     */
    _formatDate(date) {
        const d = new Date(date);
        return d.toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * 切换视图模式
     * @param {string} viewMode - 视图模式 (grid/list/masonry)
     */
    setViewMode(viewMode) {
        if (!['grid', 'list', 'masonry'].includes(viewMode)) {
            uiLogger.warn('不支持的视图模式:', viewMode);
            return;
        }
        this.currentView = viewMode;
        galleryLogger.debug('切换视图模式:', viewMode);
    }

    /**
     * 显示AI分析状态
     * @param {string} imageId - 图片ID
     * @param {number} progress - 进度 (0-100)
     */
    setAnalysisProgress(imageId, progress) {
        const card = document.querySelector(`[data-image-id="${imageId}"]`);
        if (!card) return;

        const overlay = card.querySelector('.ai-analysis-overlay');
        if (!overlay) return;

        if (progress > 0 && progress < 100) {
            overlay.style.opacity = '1';
            const circle = overlay.querySelector('.progress');
            if (circle) {
                const offset = 157 - (157 * progress) / 100;
                circle.style.strokeDashoffset = offset;
            }
        } else if (progress >= 100) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    /**
     * 更新图片标签
     * @param {string} imageId - 图片ID
     * @param {Array} tags - 标签数组
     */
    updateTags(imageId, tags) {
        const card = document.querySelector(`[data-image-id="${imageId}"]`);
        if (!card) return;

        const tagsContainer = card.querySelector('.tags');
        if (!tagsContainer) return;

        tagsContainer.innerHTML = '';
        tags.slice(0, 3).forEach((tag) => {
            const tagEl = document.createElement('span');
            tagEl.className =
                'tag text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
            tagEl.textContent = tag;
            tagsContainer.appendChild(tagEl);
        });
    }

    /**
     * 清空渲染
     */
    clear() {
        [this.gridId, this.listId, this.masonryId].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }
}

const galleryRenderer = new GalleryRenderer();

export { GalleryRenderer };
export default galleryRenderer;
