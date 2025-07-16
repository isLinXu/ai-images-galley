/**
 * AI智能相册系统 - 图片库管理模块
 * 负责图片展示、搜索、过滤、排序、分页等核心功能
 */

import { CONFIG } from './config.js';
import { StringUtils, ArrayUtils, TimeUtils, ValidationUtils, DOMUtils } from './utils.js';
import eventManager from './eventManager.js';
import storageManager from './storageManager.js';
import imageManager from './imageManager.js';
import uiManager from './uiManager.js';

/**
 * 搜索引擎
 */
class SearchEngine {
    constructor() {
        this.searchHistory = [];
        this.maxHistorySize = CONFIG.SEARCH.MAX_HISTORY_SIZE;
        this.searchWeights = CONFIG.SEARCH.WEIGHTS;
        
        this._loadSearchHistory();
    }

    /**
     * 执行搜索
     * @param {string} query - 搜索查询
     * @param {Array} images - 图片数组
     * @param {Object} options - 搜索选项
     * @returns {Array} 搜索结果
     */
    search(query, images, options = {}) {
        if (!query || !query.trim()) {
            return images;
        }

        const normalizedQuery = this._normalizeQuery(query);
        const searchTerms = this._extractSearchTerms(normalizedQuery);
        
        // 记录搜索历史
        this._addToHistory(query);
        
        // 计算每个图片的搜索分数
        const scoredImages = images.map(image => ({
            ...image,
            searchScore: this._calculateSearchScore(image, searchTerms, options)
        }));
        
        // 过滤和排序
        const filteredImages = scoredImages
            .filter(image => image.searchScore > 0)
            .sort((a, b) => b.searchScore - a.searchScore);
        
        // 触发搜索事件
        eventManager.emit('gallery:search-performed', {
            query,
            resultCount: filteredImages.length,
            totalImages: images.length,
            timestamp: Date.now()
        });
        
        return filteredImages;
    }

    /**
     * 计算搜索分数
     * @param {Object} image - 图片对象
     * @param {Array} searchTerms - 搜索词数组
     * @param {Object} options - 搜索选项
     * @returns {number} 搜索分数
     * @private
     */
    _calculateSearchScore(image, searchTerms, options) {
        let score = 0;
        const weights = { ...this.searchWeights, ...options.weights };
        
        searchTerms.forEach(term => {
            // 文件名匹配
            if (image.name && image.name.toLowerCase().includes(term)) {
                score += weights.filename;
            }
            
            // AI标签匹配
            if (image.aiTags) {
                const tagMatches = image.aiTags.filter(tag => 
                    tag.label.toLowerCase().includes(term)
                );
                tagMatches.forEach(tag => {
                    score += weights.aiTags * tag.confidence;
                });
            }
            
            // 自定义标签匹配
            if (image.customTags) {
                const customTagMatches = image.customTags.filter(tag => 
                    tag.toLowerCase().includes(term)
                );
                score += customTagMatches.length * weights.customTags;
            }
            
            // 笔记匹配
            if (image.notes && image.notes.toLowerCase().includes(term)) {
                score += weights.notes;
            }
            
            // AI描述匹配
            if (image.aiDescription && image.aiDescription.toLowerCase().includes(term)) {
                score += weights.aiDescription;
            }
            
            // EXIF数据匹配
            if (image.exifData) {
                const exifText = JSON.stringify(image.exifData).toLowerCase();
                if (exifText.includes(term)) {
                    score += weights.exifData;
                }
            }
        });
        
        return score;
    }

    /**
     * 标准化查询
     * @param {string} query - 原始查询
     * @returns {string} 标准化后的查询
     * @private
     */
    _normalizeQuery(query) {
        return query.toLowerCase().trim();
    }

    /**
     * 提取搜索词
     * @param {string} query - 标准化查询
     * @returns {Array} 搜索词数组
     * @private
     */
    _extractSearchTerms(query) {
        // 支持引号包围的短语搜索
        const phrases = query.match(/"([^"]+)"/g) || [];
        const phrasesContent = phrases.map(phrase => phrase.slice(1, -1));
        
        // 移除引号短语后的剩余词汇
        let remainingQuery = query;
        phrases.forEach(phrase => {
            remainingQuery = remainingQuery.replace(phrase, '');
        });
        
        const words = remainingQuery.split(/\s+/).filter(word => word.length > 0);
        
        return [...phrasesContent, ...words];
    }

    /**
     * 添加到搜索历史
     * @param {string} query - 搜索查询
     * @private
     */
    _addToHistory(query) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;
        
        // 移除重复项
        this.searchHistory = this.searchHistory.filter(item => item.query !== trimmedQuery);
        
        // 添加到开头
        this.searchHistory.unshift({
            query: trimmedQuery,
            timestamp: Date.now(),
            count: 1
        });
        
        // 限制历史大小
        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
        }
        
        this._saveSearchHistory();
    }

    /**
     * 获取搜索建议
     * @param {string} partial - 部分查询
     * @returns {Array} 搜索建议
     */
    getSuggestions(partial) {
        if (!partial || partial.length < 2) {
            return this.searchHistory.slice(0, 5).map(item => item.query);
        }
        
        const normalizedPartial = partial.toLowerCase();
        
        return this.searchHistory
            .filter(item => item.query.toLowerCase().includes(normalizedPartial))
            .slice(0, 5)
            .map(item => item.query);
    }

    /**
     * 清除搜索历史
     */
    clearHistory() {
        this.searchHistory = [];
        this._saveSearchHistory();
        
        eventManager.emit('gallery:search-history-cleared', {
            timestamp: Date.now()
        });
    }

    /**
     * 加载搜索历史
     * @private
     */
    _loadSearchHistory() {
        try {
            const history = storageManager.specializedStorage.userPreferences.get('searchHistory');
            if (history && Array.isArray(history)) {
                this.searchHistory = history;
            }
        } catch (error) {
            console.warn('加载搜索历史失败:', error);
        }
    }

    /**
     * 保存搜索历史
     * @private
     */
    _saveSearchHistory() {
        try {
            storageManager.specializedStorage.userPreferences.set('searchHistory', this.searchHistory);
        } catch (error) {
            console.warn('保存搜索历史失败:', error);
        }
    }
}

/**
 * 过滤器管理器
 */
class FilterManager {
    constructor() {
        this.activeFilters = new Map();
        this.filterDefinitions = CONFIG.UI.FILTERS;
        
        this._initializeFilters();
    }

    /**
     * 设置过滤器
     * @param {string} filterType - 过滤器类型
     * @param {*} value - 过滤器值
     */
    setFilter(filterType, value) {
        if (value === null || value === undefined || value === '') {
            this.activeFilters.delete(filterType);
        } else {
            this.activeFilters.set(filterType, value);
        }
        
        eventManager.emit('gallery:filter-changed', {
            filterType,
            value,
            activeFilters: Object.fromEntries(this.activeFilters),
            timestamp: Date.now()
        });
    }

    /**
     * 获取过滤器值
     * @param {string} filterType - 过滤器类型
     * @returns {*} 过滤器值
     */
    getFilter(filterType) {
        return this.activeFilters.get(filterType);
    }

    /**
     * 清除所有过滤器
     */
    clearAllFilters() {
        this.activeFilters.clear();
        
        eventManager.emit('gallery:filters-cleared', {
            timestamp: Date.now()
        });
    }

    /**
     * 应用过滤器
     * @param {Array} images - 图片数组
     * @returns {Array} 过滤后的图片
     */
    applyFilters(images) {
        if (this.activeFilters.size === 0) {
            return images;
        }
        
        return images.filter(image => {
            return Array.from(this.activeFilters.entries()).every(([filterType, value]) => {
                return this._applyFilter(image, filterType, value);
            });
        });
    }

    /**
     * 应用单个过滤器
     * @param {Object} image - 图片对象
     * @param {string} filterType - 过滤器类型
     * @param {*} value - 过滤器值
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _applyFilter(image, filterType, value) {
        switch (filterType) {
            case 'dateRange':
                return this._filterByDateRange(image, value);
            case 'fileType':
                return this._filterByFileType(image, value);
            case 'fileSize':
                return this._filterByFileSize(image, value);
            case 'hasAITags':
                return this._filterByAITags(image, value);
            case 'hasCustomTags':
                return this._filterByCustomTags(image, value);
            case 'hasNotes':
                return this._filterByNotes(image, value);
            case 'confidence':
                return this._filterByConfidence(image, value);
            case 'dimensions':
                return this._filterByDimensions(image, value);
            case 'orientation':
                return this._filterByOrientation(image, value);
            default:
                return true;
        }
    }

    /**
     * 按日期范围过滤
     * @param {Object} image - 图片对象
     * @param {Object} range - 日期范围
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByDateRange(image, range) {
        const imageDate = image.uploadTime || image.lastModified || 0;
        const { start, end } = range;
        
        if (start && imageDate < start) return false;
        if (end && imageDate > end) return false;
        
        return true;
    }

    /**
     * 按文件类型过滤
     * @param {Object} image - 图片对象
     * @param {string} fileType - 文件类型
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByFileType(image, fileType) {
        if (fileType === 'all') return true;
        
        const imageType = image.type || '';
        return imageType.toLowerCase().includes(fileType.toLowerCase());
    }

    /**
     * 按文件大小过滤
     * @param {Object} image - 图片对象
     * @param {Object} sizeRange - 大小范围
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByFileSize(image, sizeRange) {
        const imageSize = image.size || 0;
        const { min, max } = sizeRange;
        
        if (min && imageSize < min) return false;
        if (max && imageSize > max) return false;
        
        return true;
    }

    /**
     * 按AI标签过滤
     * @param {Object} image - 图片对象
     * @param {boolean} hasAITags - 是否有AI标签
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByAITags(image, hasAITags) {
        const hasAI = image.aiTags && image.aiTags.length > 0;
        return hasAITags ? hasAI : !hasAI;
    }

    /**
     * 按自定义标签过滤
     * @param {Object} image - 图片对象
     * @param {boolean} hasCustomTags - 是否有自定义标签
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByCustomTags(image, hasCustomTags) {
        const hasCustom = image.customTags && image.customTags.length > 0;
        return hasCustomTags ? hasCustom : !hasCustom;
    }

    /**
     * 按笔记过滤
     * @param {Object} image - 图片对象
     * @param {boolean} hasNotes - 是否有笔记
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByNotes(image, hasNotes) {
        const hasNote = image.notes && image.notes.trim().length > 0;
        return hasNotes ? hasNote : !hasNote;
    }

    /**
     * 按置信度过滤
     * @param {Object} image - 图片对象
     * @param {Object} confidenceRange - 置信度范围
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByConfidence(image, confidenceRange) {
        if (!image.aiTags || image.aiTags.length === 0) {
            return false;
        }
        
        const avgConfidence = image.aiTags.reduce((sum, tag) => sum + tag.confidence, 0) / image.aiTags.length;
        const { min, max } = confidenceRange;
        
        if (min && avgConfidence < min) return false;
        if (max && avgConfidence > max) return false;
        
        return true;
    }

    /**
     * 按尺寸过滤
     * @param {Object} image - 图片对象
     * @param {Object} dimensionsRange - 尺寸范围
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByDimensions(image, dimensionsRange) {
        const { width, height } = image;
        const { minWidth, maxWidth, minHeight, maxHeight } = dimensionsRange;
        
        if (minWidth && width < minWidth) return false;
        if (maxWidth && width > maxWidth) return false;
        if (minHeight && height < minHeight) return false;
        if (maxHeight && height > maxHeight) return false;
        
        return true;
    }

    /**
     * 按方向过滤
     * @param {Object} image - 图片对象
     * @param {string} orientation - 方向
     * @returns {boolean} 是否通过过滤
     * @private
     */
    _filterByOrientation(image, orientation) {
        if (orientation === 'all') return true;
        
        const { width, height } = image;
        const imageOrientation = width > height ? 'landscape' : 
                               width < height ? 'portrait' : 'square';
        
        return imageOrientation === orientation;
    }

    /**
     * 获取过滤器统计信息
     * @param {Array} images - 图片数组
     * @returns {Object} 统计信息
     */
    getFilterStats(images) {
        const stats = {
            total: images.length,
            fileTypes: {},
            orientations: { landscape: 0, portrait: 0, square: 0 },
            withAITags: 0,
            withCustomTags: 0,
            withNotes: 0,
            avgConfidence: 0,
            sizeRange: { min: Infinity, max: 0 },
            dateRange: { earliest: Infinity, latest: 0 }
        };
        
        let totalConfidence = 0;
        let confidenceCount = 0;
        
        images.forEach(image => {
            // 文件类型统计
            const fileType = image.type || 'unknown';
            stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
            
            // 方向统计
            const { width, height } = image;
            if (width > height) stats.orientations.landscape++;
            else if (width < height) stats.orientations.portrait++;
            else stats.orientations.square++;
            
            // 标签和笔记统计
            if (image.aiTags && image.aiTags.length > 0) {
                stats.withAITags++;
                const avgConf = image.aiTags.reduce((sum, tag) => sum + tag.confidence, 0) / image.aiTags.length;
                totalConfidence += avgConf;
                confidenceCount++;
            }
            
            if (image.customTags && image.customTags.length > 0) {
                stats.withCustomTags++;
            }
            
            if (image.notes && image.notes.trim()) {
                stats.withNotes++;
            }
            
            // 大小统计
            if (image.size) {
                stats.sizeRange.min = Math.min(stats.sizeRange.min, image.size);
                stats.sizeRange.max = Math.max(stats.sizeRange.max, image.size);
            }
            
            // 日期统计
            const imageDate = image.uploadTime || image.lastModified;
            if (imageDate) {
                stats.dateRange.earliest = Math.min(stats.dateRange.earliest, imageDate);
                stats.dateRange.latest = Math.max(stats.dateRange.latest, imageDate);
            }
        });
        
        // 计算平均置信度
        if (confidenceCount > 0) {
            stats.avgConfidence = totalConfidence / confidenceCount;
        }
        
        // 处理无限值
        if (stats.sizeRange.min === Infinity) stats.sizeRange.min = 0;
        if (stats.dateRange.earliest === Infinity) stats.dateRange.earliest = 0;
        
        return stats;
    }

    /**
     * 初始化过滤器
     * @private
     */
    _initializeFilters() {
        // 从存储中恢复过滤器状态
        try {
            const savedFilters = storageManager.specializedStorage.userPreferences.get('activeFilters');
            if (savedFilters) {
                this.activeFilters = new Map(Object.entries(savedFilters));
            }
        } catch (error) {
            console.warn('加载过滤器状态失败:', error);
        }
    }

    /**
     * 保存过滤器状态
     */
    saveFiltersState() {
        try {
            const filtersObject = Object.fromEntries(this.activeFilters);
            storageManager.specializedStorage.userPreferences.set('activeFilters', filtersObject);
        } catch (error) {
            console.warn('保存过滤器状态失败:', error);
        }
    }
}

/**
 * 排序管理器
 */
class SortManager {
    constructor() {
        this.currentSort = {
            field: CONFIG.UI.DEFAULT_SORT_FIELD,
            direction: CONFIG.UI.DEFAULT_SORT_DIRECTION
        };
        
        this.sortOptions = CONFIG.UI.SORT_OPTIONS;
        
        this._loadSortState();
    }

    /**
     * 设置排序
     * @param {string} field - 排序字段
     * @param {string} direction - 排序方向 ('asc' | 'desc')
     */
    setSort(field, direction = 'desc') {
        this.currentSort = { field, direction };
        
        this._saveSortState();
        
        eventManager.emit('gallery:sort-changed', {
            field,
            direction,
            timestamp: Date.now()
        });
    }

    /**
     * 切换排序方向
     * @param {string} field - 排序字段
     */
    toggleSort(field) {
        if (this.currentSort.field === field) {
            // 切换方向
            const newDirection = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
            this.setSort(field, newDirection);
        } else {
            // 设置新字段，默认降序
            this.setSort(field, 'desc');
        }
    }

    /**
     * 应用排序
     * @param {Array} images - 图片数组
     * @returns {Array} 排序后的图片
     */
    applySort(images) {
        const { field, direction } = this.currentSort;
        
        const sortedImages = [...images].sort((a, b) => {
            const result = this._compareImages(a, b, field);
            return direction === 'asc' ? result : -result;
        });
        
        return sortedImages;
    }

    /**
     * 比较两个图片
     * @param {Object} a - 图片A
     * @param {Object} b - 图片B
     * @param {string} field - 比较字段
     * @returns {number} 比较结果
     * @private
     */
    _compareImages(a, b, field) {
        switch (field) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            
            case 'uploadTime':
                return (a.uploadTime || 0) - (b.uploadTime || 0);
            
            case 'lastModified':
                return (a.lastModified || 0) - (b.lastModified || 0);
            
            case 'size':
                return (a.size || 0) - (b.size || 0);
            
            case 'dimensions':
                const aArea = (a.width || 0) * (a.height || 0);
                const bArea = (b.width || 0) * (b.height || 0);
                return aArea - bArea;
            
            case 'confidence':
                const aConf = this._getAverageConfidence(a);
                const bConf = this._getAverageConfidence(b);
                return aConf - bConf;
            
            case 'aiTagsCount':
                const aCount = (a.aiTags || []).length;
                const bCount = (b.aiTags || []).length;
                return aCount - bCount;
            
            case 'customTagsCount':
                const aCustomCount = (a.customTags || []).length;
                const bCustomCount = (b.customTags || []).length;
                return aCustomCount - bCustomCount;
            
            case 'random':
                return Math.random() - 0.5;
            
            default:
                return 0;
        }
    }

    /**
     * 获取平均置信度
     * @param {Object} image - 图片对象
     * @returns {number} 平均置信度
     * @private
     */
    _getAverageConfidence(image) {
        if (!image.aiTags || image.aiTags.length === 0) {
            return 0;
        }
        
        const total = image.aiTags.reduce((sum, tag) => sum + tag.confidence, 0);
        return total / image.aiTags.length;
    }

    /**
     * 获取当前排序状态
     * @returns {Object} 排序状态
     */
    getCurrentSort() {
        return { ...this.currentSort };
    }

    /**
     * 获取可用的排序选项
     * @returns {Array} 排序选项
     */
    getSortOptions() {
        return [...this.sortOptions];
    }

    /**
     * 加载排序状态
     * @private
     */
    _loadSortState() {
        try {
            const savedSort = storageManager.specializedStorage.userPreferences.get('sortState');
            if (savedSort) {
                this.currentSort = { ...this.currentSort, ...savedSort };
            }
        } catch (error) {
            console.warn('加载排序状态失败:', error);
        }
    }

    /**
     * 保存排序状态
     * @private
     */
    _saveSortState() {
        try {
            storageManager.specializedStorage.userPreferences.set('sortState', this.currentSort);
        } catch (error) {
            console.warn('保存排序状态失败:', error);
        }
    }
}

/**
 * 分页管理器
 */
class PaginationManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = CONFIG.UI.DEFAULT_ITEMS_PER_PAGE;
        this.totalItems = 0;
        
        this._loadPaginationState();
    }

    /**
     * 设置每页项目数
     * @param {number} itemsPerPage - 每页项目数
     */
    setItemsPerPage(itemsPerPage) {
        this.itemsPerPage = Math.max(1, itemsPerPage);
        this.currentPage = 1; // 重置到第一页
        
        this._savePaginationState();
        
        eventManager.emit('gallery:pagination-changed', {
            currentPage: this.currentPage,
            itemsPerPage: this.itemsPerPage,
            timestamp: Date.now()
        });
    }

    /**
     * 设置当前页
     * @param {number} page - 页码
     */
    setCurrentPage(page) {
        const totalPages = this.getTotalPages();
        this.currentPage = Math.max(1, Math.min(page, totalPages));
        
        this._savePaginationState();
        
        eventManager.emit('gallery:page-changed', {
            currentPage: this.currentPage,
            totalPages,
            timestamp: Date.now()
        });
    }

    /**
     * 下一页
     */
    nextPage() {
        this.setCurrentPage(this.currentPage + 1);
    }

    /**
     * 上一页
     */
    previousPage() {
        this.setCurrentPage(this.currentPage - 1);
    }

    /**
     * 第一页
     */
    firstPage() {
        this.setCurrentPage(1);
    }

    /**
     * 最后一页
     */
    lastPage() {
        this.setCurrentPage(this.getTotalPages());
    }

    /**
     * 应用分页
     * @param {Array} items - 项目数组
     * @returns {Array} 分页后的项目
     */
    applyPagination(items) {
        this.totalItems = items.length;
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        
        return items.slice(startIndex, endIndex);
    }

    /**
     * 获取总页数
     * @returns {number} 总页数
     */
    getTotalPages() {
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }

    /**
     * 获取分页信息
     * @returns {Object} 分页信息
     */
    getPaginationInfo() {
        const totalPages = this.getTotalPages();
        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
        
        return {
            currentPage: this.currentPage,
            totalPages,
            itemsPerPage: this.itemsPerPage,
            totalItems: this.totalItems,
            startItem,
            endItem,
            hasNext: this.currentPage < totalPages,
            hasPrevious: this.currentPage > 1
        };
    }

    /**
     * 获取页码范围
     * @param {number} maxVisible - 最大可见页码数
     * @returns {Array} 页码数组
     */
    getPageRange(maxVisible = 5) {
        const totalPages = this.getTotalPages();
        const current = this.currentPage;
        
        if (totalPages <= maxVisible) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        
        const half = Math.floor(maxVisible / 2);
        let start = Math.max(1, current - half);
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        // 调整起始位置
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }

    /**
     * 加载分页状态
     * @private
     */
    _loadPaginationState() {
        try {
            const savedPagination = storageManager.specializedStorage.userPreferences.get('paginationState');
            if (savedPagination) {
                this.itemsPerPage = savedPagination.itemsPerPage || this.itemsPerPage;
                // 不恢复当前页，总是从第一页开始
            }
        } catch (error) {
            console.warn('加载分页状态失败:', error);
        }
    }

    /**
     * 保存分页状态
     * @private
     */
    _savePaginationState() {
        try {
            storageManager.specializedStorage.userPreferences.set('paginationState', {
                itemsPerPage: this.itemsPerPage
                // 不保存当前页
            });
        } catch (error) {
            console.warn('保存分页状态失败:', error);
        }
    }
}

/**
 * 视图管理器
 */
class ViewManager {
    constructor() {
        this.currentView = CONFIG.UI.DEFAULT_VIEW_MODE;
        this.viewOptions = CONFIG.UI.VIEW_MODES;
        this.gridColumns = CONFIG.UI.DEFAULT_GRID_COLUMNS;
        
        this._loadViewState();
    }

    /**
     * 设置视图模式
     * @param {string} viewMode - 视图模式
     */
    setViewMode(viewMode) {
        if (!this.viewOptions.includes(viewMode)) {
            console.warn(`未知的视图模式: ${viewMode}`);
            return;
        }
        
        this.currentView = viewMode;
        
        this._saveViewState();
        
        eventManager.emit('gallery:view-changed', {
            viewMode,
            timestamp: Date.now()
        });
    }

    /**
     * 设置网格列数
     * @param {number} columns - 列数
     */
    setGridColumns(columns) {
        this.gridColumns = Math.max(1, Math.min(columns, 10));
        
        this._saveViewState();
        
        eventManager.emit('gallery:grid-columns-changed', {
            columns: this.gridColumns,
            timestamp: Date.now()
        });
    }

    /**
     * 获取当前视图模式
     * @returns {string} 视图模式
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * 获取网格列数
     * @returns {number} 列数
     */
    getGridColumns() {
        return this.gridColumns;
    }

    /**
     * 获取可用视图模式
     * @returns {Array} 视图模式数组
     */
    getViewOptions() {
        return [...this.viewOptions];
    }

    /**
     * 切换到下一个视图模式
     */
    nextViewMode() {
        const currentIndex = this.viewOptions.indexOf(this.currentView);
        const nextIndex = (currentIndex + 1) % this.viewOptions.length;
        this.setViewMode(this.viewOptions[nextIndex]);
    }

    /**
     * 加载视图状态
     * @private
     */
    _loadViewState() {
        try {
            const savedView = storageManager.specializedStorage.userPreferences.get('viewState');
            if (savedView) {
                this.currentView = savedView.viewMode || this.currentView;
                this.gridColumns = savedView.gridColumns || this.gridColumns;
            }
        } catch (error) {
            console.warn('加载视图状态失败:', error);
        }
    }

    /**
     * 保存视图状态
     * @private
     */
    _saveViewState() {
        try {
            storageManager.specializedStorage.userPreferences.set('viewState', {
                viewMode: this.currentView,
                gridColumns: this.gridColumns
            });
        } catch (error) {
            console.warn('保存视图状态失败:', error);
        }
    }
}

/**
 * 主图片库管理器
 */
class GalleryManager {
    constructor() {
        this.searchEngine = new SearchEngine();
        this.filterManager = new FilterManager();
        this.sortManager = new SortManager();
        this.paginationManager = new PaginationManager();
        this.viewManager = new ViewManager();
        
        this.images = [];
        this.filteredImages = [];
        this.displayedImages = [];
        
        this.isLoading = false;
        this.lastRefreshTime = 0;
        this.isInitialized = false;
        
        this._bindEvents();
        this._initializeGallery();
    }

    /**
     * 刷新图片库
     * @param {boolean} force - 是否强制刷新
     */
    async refreshGallery(options = {}) {
        const { force = false, showLoading = true } = options;

        if (this.isLoading && !force) {
            return;
        }
        
        this.isLoading = true;
        
        try {
            if (showLoading) {
                uiManager.loadingManager.show('正在加载图片库...');
            }
            
            this.images = await imageManager.getAllImages();
            
            this._updateDisplayedImages();
            
            this.lastRefreshTime = Date.now();
            
            eventManager.emit('gallery:refreshed', {
                totalImages: this.images.length,
                displayedImages: this.displayedImages.length,
                timestamp: this.lastRefreshTime
            });
            
        } catch (error) {
            console.error('刷新图片库失败:', error);
            if (showLoading) {
                uiManager.tooltipManager.error('刷新图片库失败');
            }
        } finally {
            this.isLoading = false;
            if (showLoading) {
                uiManager.loadingManager.hide();
            }
        }
    }

    /**
     * 搜索图片
     * @param {string} query - 搜索查询
     * @param {Object} options - 搜索选项
     */
    searchImages(query, options = {}) {
        const searchResults = this.searchEngine.search(query, this.images, options);
        
        // 更新过滤后的图片
        this.filteredImages = this.filterManager.applyFilters(searchResults);
        
        // 重置分页到第一页
        this.paginationManager.setCurrentPage(1);
        
        // 更新显示的图片
        this._updateDisplayedImages();
    }

    /**
     * 应用过滤器
     */
    applyFilters() {
        // 如果有搜索查询，先应用搜索
        const baseImages = this.searchEngine.searchHistory.length > 0 ? 
            this.searchEngine.search(this.searchEngine.searchHistory[0]?.query || '', this.images) : 
            this.images;
        
        this.filteredImages = this.filterManager.applyFilters(baseImages);
        
        // 重置分页到第一页
        this.paginationManager.setCurrentPage(1);
        
        // 更新显示的图片
        this._updateDisplayedImages();
    }

    /**
     * 应用排序
     */
    applySort() {
        this._updateDisplayedImages();
    }

    /**
     * 应用分页
     */
    applyPagination() {
        this._updateDisplayedImages();
    }

    /**
     * 添加图片
     * @param {Object} imageData - 图片数据
     */
    addImage(imageData) {
        this.images.unshift(imageData);
        this._updateDisplayedImages();
        
        eventManager.emit('gallery:image-added', {
            image: imageData,
            totalImages: this.images.length,
            timestamp: Date.now()
        });
    }

    /**
     * 移除图片
     * @param {string} imageId - 图片ID
     */
    removeImage(imageId) {
        const index = this.images.findIndex(img => img.id === imageId);
        if (index > -1) {
            const removedImage = this.images.splice(index, 1)[0];
            this._updateDisplayedImages();
            
            eventManager.emit('gallery:image-removed', {
                image: removedImage,
                totalImages: this.images.length,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 更新图片
     * @param {string} imageId - 图片ID
     * @param {Object} updates - 更新数据
     */
    updateImage(imageId, updates) {
        const index = this.images.findIndex(img => img.id === imageId);
        if (index > -1) {
            this.images[index] = { ...this.images[index], ...updates };
            this._updateDisplayedImages();
            
            eventManager.emit('gallery:image-updated', {
                imageId,
                updates,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取图片
     * @param {string} imageId - 图片ID
     * @returns {Object|null} 图片对象
     */
    getImage(imageId) {
        return this.images.find(img => img.id === imageId) || null;
    }

    /**
     * 获取所有图片
     * @returns {Array} 图片数组
     */
    getAllImages() {
        return [...this.images];
    }

    /**
     * 获取显示的图片
     * @returns {Array} 显示的图片数组
     */
    getDisplayedImages() {
        return [...this.displayedImages];
    }

    /**
     * 获取过滤后的图片
     * @returns {Array} 过滤后的图片数组
     */
    getFilteredImages() {
        return [...this.filteredImages];
    }

    /**
     * 获取图片库统计信息
     * @returns {Object} 统计信息
     */
    getGalleryStats() {
        return {
            totalImages: this.images.length,
            filteredImages: this.filteredImages.length,
            displayedImages: this.displayedImages.length,
            currentPage: this.paginationManager.currentPage,
            totalPages: this.paginationManager.getTotalPages(),
            viewMode: this.viewManager.currentView,
            sortField: this.sortManager.currentSort.field,
            sortDirection: this.sortManager.currentSort.direction,
            activeFilters: Object.fromEntries(this.filterManager.activeFilters),
            lastRefreshTime: this.lastRefreshTime
        };
    }

    /**
     * 清除所有过滤器和搜索
     */
    clearAllFilters() {
        this.filterManager.clearAllFilters();
        this.searchEngine.clearHistory();
        this.filteredImages = [...this.images];
        this.paginationManager.setCurrentPage(1);
        this._updateDisplayedImages();
    }

    /**
     * 导出图片库数据
     * @param {string} format - 导出格式
     * @returns {string} 导出的数据
     */
    exportGalleryData(format = 'json') {
        const data = {
            images: this.images,
            stats: this.getGalleryStats(),
            exportTime: Date.now(),
            version: '1.0'
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        // 可以扩展其他格式
        return JSON.stringify(data);
    }

    /**
     * 更新显示的图片
     * @private
     */
    _updateDisplayedImages() {
        // 如果没有过滤后的图片，使用所有图片
        let workingImages = this.filteredImages.length > 0 ? this.filteredImages : this.images;
        
        // 应用排序
        workingImages = this.sortManager.applySort(workingImages);
        
        // 应用分页
        this.displayedImages = this.paginationManager.applyPagination(workingImages);
        
        // 触发更新事件
        eventManager.emit('gallery:display-updated', {
            displayedImages: this.displayedImages,
            totalFiltered: workingImages.length,
            paginationInfo: this.paginationManager.getPaginationInfo(),
            timestamp: Date.now()
        });
    }

    /**
     * 初始化图片库
     * @private
     */
    async _initializeGallery() {
        await this.refreshGallery({ force: true, showLoading: false });
    }

    /**
     * 初始化图片库管理器
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('GalleryManager already initialized');
            return;
        }

        try {
            console.log('Initializing GalleryManager...');
            
            // 初始化各个子管理器
            // 这里可以添加任何需要的初始化逻辑
            
            this.isInitialized = true;
            console.log('GalleryManager initialized successfully');
        } catch (error) {
            console.error('Failed to initialize GalleryManager:', error);
            throw error;
        }
    }

    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        // 监听图片管理器事件
        eventManager.on('image:loaded', () => {
            this.refreshGallery();
        });
        
        eventManager.on('image:removed', (data) => {
            this.removeImage(data.imageId);
        });
        
        eventManager.on('image:updated', (data) => {
            this.updateImage(data.imageId, data.updates);
        });
        
        // 监听过滤器变化
        eventManager.on('gallery:filter-changed', () => {
            this.applyFilters();
            this.filterManager.saveFiltersState();
        });
        
        // 监听排序变化
        eventManager.on('gallery:sort-changed', () => {
            this.applySort();
        });
        
        // 监听分页变化
        eventManager.on('gallery:pagination-changed', () => {
            this.applyPagination();
        });
        
        eventManager.on('gallery:page-changed', () => {
            this.applyPagination();
        });
        
        // 监听视图变化
        eventManager.on('gallery:view-changed', () => {
            // 视图变化可能需要重新渲染
            eventManager.emit('gallery:render-required', {
                viewMode: this.viewManager.currentView,
                timestamp: Date.now()
            });
        });
        
        eventManager.on('gallery:grid-columns-changed', () => {
            eventManager.emit('gallery:render-required', {
                gridColumns: this.viewManager.gridColumns,
                timestamp: Date.now()
            });
        });
    }
}

// 创建全局图片库管理器实例
const galleryManager = new GalleryManager();

export {
    SearchEngine,
    FilterManager,
    SortManager,
    PaginationManager,
    ViewManager,
    GalleryManager
};

export default galleryManager;