/**
 * AI智能相册系统 - 配置模块
 * 包含系统配置、常量定义和环境变量
 */

export const CONFIG = {
    // 安全配置
    SECURITY: {
        MAX_LOGIN_ATTEMPTS: 5,
        LOGIN_COOLDOWN: 300000, // 5分钟
        SESSION_TIMEOUT: 3600000, // 1小时
        TOKEN_MIN_LENGTH: 20
    },
    
    // AI模型配置
    AI: {
        ANALYSIS_QUEUE_SIZE: 10,
        WORKER_COUNT: 2,
        CONFIDENCE_THRESHOLD: 0.3,
        MAX_CACHE_SIZE: 100
    },
    
    // 图片配置
    IMAGE: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        THUMBNAIL_SIZE: 240,
        COMPRESSION_QUALITY: 0.8
    },
    
    // UI配置
    UI: {
        TOOLTIP_DURATION: 3000,
        ANIMATION_DURATION: 300,
        SEARCH_DEBOUNCE: 300,
        PRELOAD_COUNT: 5
    },
    
    // 存储配置
    STORAGE: {
        MAX_LOGS: 50,
        MAX_NOTES_LENGTH: 1000,
        CACHE_EXPIRY: 24 * 60 * 60 * 1000 // 24小时
    },
    
    // GitHub配置
    GITHUB: {
        API_BASE: 'https://api.github.com',
        UPLOAD_TIMEOUT: 30000,
        RETRY_COUNT: 3
    },
    
    // 主题配置
    THEMES: [
        {
            name: 'default',
            primary: '#3B82F6',
            secondary: '#10B981',
            accent: '#F59E0B'
        },
        {
            name: 'dark',
            primary: '#1E40AF',
            secondary: '#065F46',
            accent: '#B45309'
        },
        {
            name: 'purple',
            primary: '#7C3AED',
            secondary: '#059669',
            accent: '#DC2626'
        }
    ]
};

// 正则表达式模式
export const PATTERNS = {
    GITHUB_TOKEN: /^gh[ps]_[a-zA-Z0-9]{36,}$/,
    GITHUB_CLASSIC_TOKEN: /^[a-f0-9]{40}$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/
};

// 错误消息
export const ERROR_MESSAGES = {
    TOKEN_INVALID: 'Token格式不正确，请确保使用有效的GitHub Token',
    TOKEN_TOO_SHORT: 'Token长度不足，请检查是否完整',
    LOGIN_COOLDOWN: '登录尝试过多，请等待 {minutes} 分钟后重试',
    SESSION_EXPIRED: '会话已过期，请重新登录',
    UPLOAD_FAILED: '上传失败，请检查网络连接和Token权限',
    ANALYSIS_FAILED: 'AI分析失败，请稍后重试',
    MODEL_LOAD_FAILED: '模型加载失败，使用基础分析功能',
    FILE_TOO_LARGE: '文件过大，请选择小于10MB的图片',
    UNSUPPORTED_FORMAT: '不支持的文件格式'
};

// 成功消息
export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: '登录成功',
    LOGOUT_SUCCESS: '已安全退出',
    UPLOAD_SUCCESS: '上传成功',
    ANALYSIS_COMPLETE: '分析完成',
    NOTES_SAVED: '备注已保存',
    TAGS_ADDED: '标签已添加',
    DOWNLOAD_STARTED: '下载已开始',
    SHARE_SUCCESS: '分享成功',
    LOGS_CLEARED: '日志已清除'
};

// 本地存储键名
export const STORAGE_KEYS = {
    ADMIN_USER: 'admin_user',
    ADMIN_LOGS: 'admin_logs',
    IMAGE_NOTES: 'image_notes',
    CUSTOM_TAGS: 'custom_tags',
    THEME: 'theme',
    LAST_FAILED_LOGIN: 'last_failed_login',
    AI_CACHE: 'ai_analysis_cache',
    USER_PREFERENCES: 'user_preferences'
};

// 事件类型
export const EVENT_TYPES = {
    IMAGE_LOADED: 'image:loaded',
    IMAGE_ANALYZED: 'image:analyzed',
    ADMIN_LOGIN: 'admin:login',
    ADMIN_LOGOUT: 'admin:logout',
    SESSION_TIMEOUT: 'session:timeout',
    UPLOAD_PROGRESS: 'upload:progress',
    UPLOAD_COMPLETE: 'upload:complete',
    THEME_CHANGED: 'theme:changed'
};

// API端点
export const API_ENDPOINTS = {
    GITHUB_USER: '/user',
    GITHUB_REPOS: '/user/repos',
    GITHUB_CONTENTS: '/repos/{owner}/{repo}/contents/{path}',
    GITHUB_UPLOAD: '/repos/{owner}/{repo}/contents/{path}'
};

// 默认设置
export const DEFAULTS = {
    SORT_ORDER: 'newest',
    VIEW_MODE: 'grid',
    ITEMS_PER_PAGE: 20,
    AUTO_ANALYSIS: true,
    SHOW_CONFIDENCE: true,
    ENABLE_PRELOAD: true
};