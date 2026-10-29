/**
 * 模块化版图片上传器
 *
 * 目前支持 GitHub Contents API 持久化：
 *   - 浏览器端压缩/缩放为 JPEG（GIF 保持原样）
 *   - 覆盖同名文件时自动读取 sha
 *   - 上传成功后清空 imageSource 缓存，交由 GalleryManager 重新拉取
 *
 * 若后续接入后端，可在此增加基于 imageAPI.upload 的策略，而不改动 UI。
 */

import { CONFIG } from './config.js';
import imageManager from './imageManager.js';
import imageSource from './imageSource.js';
import { appLogger } from './logger.js';

export const AUTH_TOKEN_KEY = 'github_token';
const MAX_UPLOAD_BYTES = CONFIG.IMAGE.MAX_FILE_SIZE;
const ALLOWED_EXTENSIONS = new Set(CONFIG.IMAGE.SUPPORTED_FORMATS);

function readToken() {
    try {
        return sessionStorage.getItem(AUTH_TOKEN_KEY) || '';
    } catch {
        return '';
    }
}

function writeToken(token) {
    try {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
        return true;
    } catch {
        return false;
    }
}

function clearToken() {
    try {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
    } catch {
        // ignore
    }
}

function sanitizeFileName(name) {
    const base = String(name || '')
        // 控制字符用于清理文件名，不影响可读性
        // eslint-disable-next-line no-control-regex
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
        .replace(/^\.+/, '')
        .trim();
    return (base.slice(0, 180) || `image_${Date.now()}.jpg`).replace(/\s+/g, '-');
}

function extensionOf(name) {
    return (
        String(name || '')
            .split('.')
            .pop() || ''
    ).toLowerCase();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
        reader.readAsDataURL(file);
    });
}

class ImageUploader {
    constructor() {
        this.token = '';
    }

    isAuthenticated() {
        return Boolean(readToken() || this.token);
    }

    setToken(token) {
        this.token = token || '';
        if (this.token) {
            writeToken(this.token);
        } else {
            clearToken();
        }
    }

    clearToken() {
        this.token = '';
        clearToken();
    }

    /**
     * 上传多个文件
     * @param {FileList|File[]} fileList - 文件列表
     * @param {Object} options - { onProgress, onConflict, compress }
     * @returns {Promise<{uploaded: Array, skipped: Array, failed: Array}>}
     */
    async uploadFiles(fileList, options = {}) {
        const files = Array.from(fileList || []);
        const token = readToken() || this.token;
        if (!token) {
            throw new Error('请先以管理员身份登录 GitHub');
        }

        const {
            onProgress = null,
            // eslint-disable-next-line no-alert
            onConflict = (name) => window.confirm(`文件 ${name} 已存在，是否覆盖？`),
            compress = true
        } = options;

        const uploaded = [];
        const skipped = [];
        const failed = [];

        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            try {
                if (onProgress) {
                    onProgress({ current: index + 1, total: files.length, fileName: file.name });
                }
                if (!file || !file.size) {
                    throw new Error('文件为空');
                }
                if (file.size > MAX_UPLOAD_BYTES) {
                    throw new Error(`文件超过 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB 限制`);
                }
                const extension = extensionOf(file.name);
                if (!ALLOWED_EXTENSIONS.has(extension)) {
                    throw new Error(`不支持的文件格式: ${file.name}`);
                }
                if (file.type && !file.type.startsWith('image/')) {
                    throw new Error(`文件不是图片: ${file.name}`);
                }

                let uploadFile = file;
                let targetName = sanitizeFileName(file.name);
                if (compress && extension !== 'gif') {
                    targetName = `${targetName.replace(/\.[^.]+$/, '')}.jpg`;
                    const blob = await imageManager.processor.compressImage(file, {
                        maxWidth: CONFIG.IMAGE.MAX_WIDTH,
                        maxHeight: CONFIG.IMAGE.MAX_HEIGHT,
                        quality: CONFIG.IMAGE.COMPRESSION_QUALITY,
                        format: 'image/jpeg'
                    });
                    uploadFile = new File([blob], targetName, { type: 'image/jpeg' });
                } else {
                    uploadFile = new File([file], targetName, { type: file.type || 'image/jpeg' });
                }

                const result = await this._uploadSingle(uploadFile, targetName, token, onConflict);
                if (result.skipped) {
                    skipped.push(targetName);
                } else {
                    let thumbnailUrl = null;
                    try {
                        thumbnailUrl = await this._uploadThumbnail(uploadFile, targetName, token);
                    } catch (error) {
                        appLogger.warn('缩略图上传失败，卡片将回退使用原图:', error.message);
                    }
                    uploaded.push({
                        id: targetName,
                        name: targetName,
                        url: `images/${encodeURIComponent(targetName)}`,
                        thumbnailUrl,
                        size: uploadFile.size,
                        timestamp: Date.now(),
                        loadMethod: 'GitHub Upload'
                    });
                }
            } catch (error) {
                appLogger.error(`上传 ${file?.name || '未知文件'} 失败:`, error);
                failed.push({ name: file?.name || '未知文件', error: error.message });
            }
        }

        if (uploaded.length > 0) {
            imageSource.invalidate();
        }

        return { uploaded, skipped, failed };
    }

    async _uploadThumbnail(file, targetName, token) {
        const thumbnailBlob = await imageManager.processor.compressImage(file, {
            maxWidth: 640,
            maxHeight: 640,
            quality: 0.78,
            format: 'image/webp'
        });
        if (thumbnailBlob.type !== 'image/webp') {
            throw new Error(`浏览器未生成 WebP（实际 ${thumbnailBlob.type || 'unknown'}）`);
        }
        const thumbnailName = `${targetName.replace(/\.[^.]+$/, '')}.webp`;
        const thumbnailFile = new File([thumbnailBlob], thumbnailName, { type: 'image/webp' });
        await this._uploadSingle(thumbnailFile, `thumbnails/${thumbnailName}`, token, () => true);
        return `images/thumbnails/${encodeURIComponent(thumbnailName)}`;
    }

    async _uploadSingle(file, relativePath, token, onConflict) {
        const { OWNER, REPO, BRANCH, API_BASE, IMAGE_PATH } = CONFIG.GITHUB;
        const encodedPath = relativePath
            .split('/')
            .map((part) => encodeURIComponent(part))
            .join('/');
        const url = `${API_BASE}/repos/${OWNER}/${REPO}/contents/${IMAGE_PATH}/${encodedPath}`;
        const headers = {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        let existingSha = null;
        const check = await fetch(`${url}?ref=${encodeURIComponent(BRANCH)}`, { headers });
        if (check.ok) {
            const existing = await check.json();
            existingSha = existing.sha || null;
            if (!onConflict(relativePath)) {
                return { skipped: true };
            }
        } else if (check.status !== 404) {
            throw new Error(`检查文件失败 (HTTP ${check.status})`);
        }

        const content = await fileToBase64(file);
        const body = {
            message: `Upload ${relativePath} via AI Gallery`,
            content,
            branch: BRANCH
        };
        if (existingSha) {
            body.sha = existingSha;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            let message = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                message = errorData.message || message;
            } catch {
                // ignore invalid JSON
            }
            throw new Error(message);
        }

        return { skipped: false };
    }
}

const imageUploader = new ImageUploader();

export { ImageUploader };
export default imageUploader;
