/**
 * AI智能相册系统 - 图片来源模块
 *
 * 负责以只读方式加载图片库内容，按以下顺序降级：
 *   1. GitHub Contents API（可获取最新上传内容）
 *   2. images/manifest.json（本地/离线清单，避免 API 限流导致空白）
 *   3. 目录索引（本地静态服务器开发时可用）
 *
 * 该模块只负责“读”，上传仍由管理端显式操作完成。
 */

import { CONFIG } from './config.js';
import { galleryLogger } from './logger.js';

const CACHE_KEY = 'gallery_source_cache_v3';
const CACHE_TTL = 5 * 60 * 1000;
const IMAGE_EXTENSION = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;

function encodeImageUrl(name) {
    return `images/${encodeURIComponent(name)}`;
}

function encodeImagePath(imagePath) {
    return `images/${String(imagePath)
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')}`;
}

function normalizeName(value) {
    return String(value || '')
        .replace(/^\.\//, '')
        .replace(/^images\//, '');
}

function fileType(name) {
    const extension = (
        String(name || '')
            .split('.')
            .pop() || ''
    ).toLowerCase();
    return extension === 'jpeg' ? 'jpg' : extension;
}

class ImageSource {
    constructor() {
        this.cache = null;
        this.cacheTime = 0;
    }

    /**
     * 加载图片列表
     * @param {Object} options - { force: boolean }
     * @returns {Promise<Array>}
     */
    async loadImages(options = {}) {
        const { force = false } = options;

        if (!force && this.cache && Date.now() - this.cacheTime < CACHE_TTL) {
            return this.cache;
        }

        if (!force) {
            const stored = this._readCache();
            if (stored) {
                this.cache = stored;
                this.cacheTime = Date.now();
                return stored;
            }
        }

        let images = [];
        // 清单同时提供文件大小与 Git 最后提交时间，用于排序和日期过滤。
        const metadataPromise = this._loadFromManifest().catch(() => []);

        try {
            images = await this._loadFromGitHub();
        } catch (error) {
            galleryLogger.warn('GitHub API 加载失败:', error.message);
        }

        if (images.length > 0) {
            const metadata = await metadataPromise;
            const metadataByName = new Map(metadata.map((item) => [item.name, item]));
            images = images.map((image) => {
                const extra = metadataByName.get(image.name);
                const timestamp = extra?.timestamp || 0;
                return {
                    ...image,
                    size: image.size || extra?.size || 0,
                    width: extra?.width || image.width || 0,
                    height: extra?.height || image.height || 0,
                    thumbnailUrl: extra?.thumbnailUrl || image.thumbnailUrl || null,
                    timestamp,
                    uploadTime: timestamp
                };
            });
            galleryLogger.info(`GitHub API 加载了 ${images.length} 张图片`);
        } else {
            const metadata = await metadataPromise;
            if (metadata.length > 0) {
                galleryLogger.info(`静态清单 加载了 ${metadata.length} 张图片`);
                images = metadata;
            } else {
                try {
                    images = await this._loadFromDirectoryIndex();
                    if (images.length > 0) {
                        galleryLogger.info(`目录索引 加载了 ${images.length} 张图片`);
                    }
                } catch (error) {
                    galleryLogger.warn('目录索引 加载失败:', error.message);
                }
            }
        }

        this.cache = this._dedupe(images);
        this.cacheTime = Date.now();
        this._writeCache(this.cache);
        return this.cache;
    }

    /**
     * 清空缓存；上传新图片后调用，确保下次刷新能拿到新内容。
     */
    invalidate() {
        this.cache = null;
        this.cacheTime = 0;
        try {
            sessionStorage.removeItem(CACHE_KEY);
        } catch {
            // ignore
        }
    }

    async _loadFromGitHub() {
        const { OWNER, REPO, BRANCH, API_BASE, IMAGE_PATH } = CONFIG.GITHUB;
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${IMAGE_PATH}?ref=${encodeURIComponent(BRANCH)}`;
        const response = await fetch(url, {
            headers: { Accept: 'application/vnd.github.v3+json' }
        });

        if (!response.ok) {
            throw new Error(`GitHub API HTTP ${response.status}`);
        }

        const files = await response.json();
        if (!Array.isArray(files)) {
            throw new Error('GitHub API 返回格式异常');
        }

        return files
            .filter((file) => file && file.type === 'file' && IMAGE_EXTENSION.test(file.name || ''))
            .map((file) => ({
                id: file.sha || file.name,
                name: file.name,
                url: encodeImageUrl(file.name),
                type: fileType(file.name),
                size: file.size,
                width: 0,
                height: 0,
                // 约定：同名 WebP 缩略图位于 images/thumbnails/ 下；
                // 文件不存在时由渲染器回退到原图。
                thumbnailUrl: encodeImagePath(`thumbnails/${file.name.replace(/\.[^.]+$/, '')}.webp`),
                timestamp: 0,
                uploadTime: 0,
                loadMethod: 'GitHub API'
            }));
    }

    async _loadFromManifest() {
        const response = await fetch('images/manifest.json', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`清单 HTTP ${response.status}`);
        }
        const data = await response.json();
        const files = Array.isArray(data.images) ? data.images : [];

        return files
            .filter((file) => file && IMAGE_EXTENSION.test(file.name || ''))
            .map((file) => ({
                id: file.name,
                name: file.name,
                url: encodeImageUrl(file.name),
                type: fileType(file.name),
                size: file.size || 0,
                width: file.width || 0,
                height: file.height || 0,
                format: file.format || (file.name.split('.').pop() || '').toLowerCase(),
                thumbnailUrl: file.thumbnail ? encodeImagePath(file.thumbnail) : null,
                timestamp: file.timestamp || 0,
                uploadTime: file.timestamp || 0,
                loadMethod: '本地清单'
            }));
    }

    async _loadFromDirectoryIndex() {
        const response = await fetch('images/', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`目录索引 HTTP ${response.status}`);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const names = new Set();

        doc.querySelectorAll('a[href]').forEach((link) => {
            const href = link.getAttribute('href') || '';
            const name = normalizeName(href.split('?')[0]);
            if (name && IMAGE_EXTENSION.test(name)) {
                names.add(name);
            }
        });

        return Array.from(names).map((name) => ({
            id: name,
            name,
            url: encodeImageUrl(name),
            type: fileType(name),
            size: 0,
            width: 0,
            height: 0,
            timestamp: 0,
            uploadTime: 0,
            loadMethod: '目录索引'
        }));
    }

    _dedupe(images) {
        const seen = new Set();
        return images.filter((image) => {
            if (!image || !image.name || seen.has(image.name)) return false;
            seen.add(image.name);
            return true;
        });
    }

    _readCache() {
        try {
            const raw = sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.images)) return null;
            if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
            return parsed.images;
        } catch {
            return null;
        }
    }

    _writeCache(images) {
        try {
            sessionStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    timestamp: Date.now(),
                    images
                })
            );
        } catch {
            // 存储配额不足时忽略缓存失败
        }
    }
}

const imageSource = new ImageSource();

export { ImageSource };
export default imageSource;
