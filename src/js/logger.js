/**
 * AI智能相册系统 - 日志模块
 * 提供全局日志实例，替代直接使用 console
 */

import { Logger, LogLevel } from './utils.js';

/**
 * 全局日志实例
 * 根据环境自动设置日志级别
 */
const logger = new Logger('app', {
    level: (() => {
        // 生产环境只显示警告和错误
        if (typeof globalThis !== 'undefined' && globalThis.location?.hostname !== 'localhost') {
            return LogLevel.WARN;
        }
        return LogLevel.DEBUG;
    })()
});

// 创建各模块专用的日志实例
export const appLogger = logger.child('main');
export const uiLogger = logger.child('ui');
export const imageLogger = logger.child('image');
export const galleryLogger = logger.child('gallery');
export const aiLogger = logger.child('ai');
export const storageLogger = logger.child('storage');
export const adminLogger = logger.child('admin');
export const eventLogger = logger.child('event');

export { logger as default, LogLevel };
