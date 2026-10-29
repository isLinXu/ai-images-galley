/**
 * AI 分析结果本地缓存
 *
 * 让分析结果在刷新后仍能展示到卡片上，并避免重复调用模型。
 * 缓存只保存在当前浏览器，不替代服务端持久化。
 */

import { CONFIG } from './config.js';
import storageManager from './storageManager.js';
import { appLogger } from './logger.js';

const TTL = CONFIG.STORAGE.CACHE_EXPIRY;

function cacheKey(image) {
    return String(image?.name || image?.id || image?.url || '');
}

class AIResultStore {
    save(image, result) {
        const key = cacheKey(image);
        if (!key || !result) return;
        try {
            storageManager.specializedStorage.aiCache.set(key, {
                tags: Array.isArray(result.tags) ? result.tags : [],
                description: result.description || result.caption || '',
                detections: Array.isArray(result.detections) ? result.detections : [],
                provider: result.provider || 'unknown',
                modelVersion: result.modelVersion || '',
                analyzedAt: Date.now()
            });
        } catch (error) {
            appLogger.warn('保存 AI 结果失败:', error.message);
        }
    }

    load(image) {
        const key = cacheKey(image);
        if (!key) return null;
        try {
            const cached = storageManager.specializedStorage.aiCache.get(key);
            if (!cached || !cached.value || Date.now() - cached.timestamp > TTL) {
                return null;
            }
            return cached.value;
        } catch {
            return null;
        }
    }

    apply(images) {
        return images.map((image) => {
            const cached = this.load(image);
            if (!cached) return image;
            return {
                ...image,
                aiTags: cached.tags || [],
                aiDescription: cached.description || '',
                detections: cached.detections || [],
                aiProvider: cached.provider || '',
                aiAnalyzed: true
            };
        });
    }

    remove(image) {
        const key = cacheKey(image);
        if (key) {
            storageManager.specializedStorage.aiCache.remove(key);
        }
    }

    clear() {
        storageManager.specializedStorage.aiCache.clear();
    }
}

const aiResultStore = new AIResultStore();

export { AIResultStore };
export default aiResultStore;
