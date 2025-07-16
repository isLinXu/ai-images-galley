/**
 * AI智能相册系统 - 管理员功能模块
 * 负责管理员登录、权限验证、活动日志、安全设置等功能
 */

import { CONFIG, ERROR_MESSAGES, SUCCESS_MESSAGES } from './config.js';
import { ValidationUtils, TimeUtils, StringUtils, AsyncUtils } from './utils.js';
import eventManager from './eventManager.js';
import storageManager from './storageManager.js';
import uiManager from './uiManager.js';

/**
 * 安全管理器
 */
class SecurityManager {
    constructor() {
        this.failedAttempts = new Map();
        this.blockedIPs = new Set();
        this.sessionTokens = new Map();
        this.maxFailedAttempts = CONFIG.SECURITY.MAX_LOGIN_ATTEMPTS;
        this.cooldownPeriod = CONFIG.SECURITY.LOGIN_COOLDOWN;
        this.sessionTimeout = CONFIG.SECURITY.SESSION_TIMEOUT;
        
        this._loadSecurityData();
        this._startCleanupTimer();
    }

    /**
     * 验证GitHub Token
     * @param {string} token - GitHub Personal Access Token
     * @returns {Promise<Object>} 验证结果
     */
    async validateGitHubToken(token) {
        if (!ValidationUtils.isValidGitHubToken(token)) {
            return {
                valid: false,
                error: ERROR_MESSAGES.INVALID_TOKEN_FORMAT
            };
        }

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                return {
                    valid: true,
                    user: {
                        login: userData.login,
                        id: userData.id,
                        name: userData.name,
                        email: userData.email,
                        avatar_url: userData.avatar_url
                    }
                };
            } else {
                return {
                    valid: false,
                    error: response.status === 401 ? 
                        ERROR_MESSAGES.INVALID_TOKEN : 
                        ERROR_MESSAGES.TOKEN_VERIFICATION_FAILED
                };
            }
        } catch (error) {
            console.error('Token验证失败:', error);
            return {
                valid: false,
                error: ERROR_MESSAGES.NETWORK_ERROR
            };
        }
    }

    /**
     * 检查登录冷却时间
     * @param {string} identifier - 标识符（IP或用户ID）
     * @returns {Object} 冷却检查结果
     */
    checkLoginCooldown(identifier) {
        const attempts = this.failedAttempts.get(identifier);
        
        if (!attempts) {
            return { allowed: true, remainingTime: 0 };
        }

        const { count, lastAttempt } = attempts;
        
        if (count < this.maxFailedAttempts) {
            return { allowed: true, remainingTime: 0 };
        }

        const timeSinceLastAttempt = Date.now() - lastAttempt;
        const remainingTime = this.cooldownPeriod - timeSinceLastAttempt;

        if (remainingTime <= 0) {
            // 冷却时间已过，重置计数
            this.failedAttempts.delete(identifier);
            return { allowed: true, remainingTime: 0 };
        }

        return {
            allowed: false,
            remainingTime,
            formattedTime: TimeUtils.formatDuration(remainingTime)
        };
    }

    /**
     * 记录失败的登录尝试
     * @param {string} identifier - 标识符
     * @param {Object} details - 详细信息
     */
    recordFailedLogin(identifier, details = {}) {
        const current = this.failedAttempts.get(identifier) || { count: 0, attempts: [] };
        
        current.count++;
        current.lastAttempt = Date.now();
        current.attempts.push({
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            ...details
        });

        // 只保留最近的尝试记录
        if (current.attempts.length > 10) {
            current.attempts = current.attempts.slice(-10);
        }

        this.failedAttempts.set(identifier, current);
        
        // 保存到持久化存储
        this._saveSecurityData();
        
        // 触发安全事件
        eventManager.emit('security:failed-login', {
            identifier,
            count: current.count,
            timestamp: Date.now()
        });

        // 如果达到最大尝试次数，触发封锁事件
        if (current.count >= this.maxFailedAttempts) {
            this.blockedIPs.add(identifier);
            eventManager.emit('security:ip-blocked', {
                identifier,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 清除登录尝试记录
     * @param {string} identifier - 标识符
     */
    clearLoginAttempts(identifier) {
        this.failedAttempts.delete(identifier);
        this.blockedIPs.delete(identifier);
        this._saveSecurityData();
        
        eventManager.emit('security:attempts-cleared', {
            identifier,
            timestamp: Date.now()
        });
    }

    /**
     * 生成会话令牌
     * @param {Object} userData - 用户数据
     * @returns {string} 会话令牌
     */
    generateSessionToken(userData) {
        const token = StringUtils.generateId(32);
        const session = {
            token,
            user: userData,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + this.sessionTimeout,
            userAgent: navigator.userAgent
        };
        
        this.sessionTokens.set(token, session);
        return token;
    }

    /**
     * 验证会话令牌
     * @param {string} token - 会话令牌
     * @returns {Object|null} 会话信息或null
     */
    validateSessionToken(token) {
        const session = this.sessionTokens.get(token);
        
        if (!session) {
            return null;
        }
        
        // 检查是否过期
        if (Date.now() > session.expiresAt) {
            this.sessionTokens.delete(token);
            return null;
        }
        
        // 更新最后活动时间
        session.lastActivity = Date.now();
        
        return session;
    }

    /**
     * 撤销会话令牌
     * @param {string} token - 会话令牌
     */
    revokeSessionToken(token) {
        this.sessionTokens.delete(token);
        
        eventManager.emit('security:session-revoked', {
            token,
            timestamp: Date.now()
        });
    }

    /**
     * 清理过期会话
     * @private
     */
    _cleanupExpiredSessions() {
        const now = Date.now();
        const expiredTokens = [];
        
        for (const [token, session] of this.sessionTokens.entries()) {
            if (now > session.expiresAt) {
                expiredTokens.push(token);
            }
        }
        
        expiredTokens.forEach(token => {
            this.sessionTokens.delete(token);
        });
        
        if (expiredTokens.length > 0) {
            eventManager.emit('security:sessions-expired', {
                count: expiredTokens.length,
                timestamp: now
            });
        }
    }

    /**
     * 启动清理定时器
     * @private
     */
    _startCleanupTimer() {
        setInterval(() => {
            this._cleanupExpiredSessions();
        }, 60000); // 每分钟清理一次
    }

    /**
     * 加载安全数据
     * @private
     */
    _loadSecurityData() {
        try {
            const data = storageManager.specializedStorage.adminData.get('securityData');
            if (data) {
                this.failedAttempts = new Map(data.failedAttempts || []);
                this.blockedIPs = new Set(data.blockedIPs || []);
            }
        } catch (error) {
            console.warn('加载安全数据失败:', error);
        }
    }

    /**
     * 保存安全数据
     * @private
     */
    _saveSecurityData() {
        try {
            const data = {
                failedAttempts: Array.from(this.failedAttempts.entries()),
                blockedIPs: Array.from(this.blockedIPs),
                lastUpdated: Date.now()
            };
            storageManager.specializedStorage.adminData.set('securityData', data);
        } catch (error) {
            console.warn('保存安全数据失败:', error);
        }
    }

    /**
     * 获取安全统计信息
     * @returns {Object} 安全统计
     */
    getSecurityStats() {
        return {
            failedAttempts: this.failedAttempts.size,
            blockedIPs: this.blockedIPs.size,
            activeSessions: this.sessionTokens.size,
            maxFailedAttempts: this.maxFailedAttempts,
            cooldownPeriod: this.cooldownPeriod,
            sessionTimeout: this.sessionTimeout
        };
    }
}

/**
 * 活动日志管理器
 */
class ActivityLogManager {
    constructor() {
        this.logs = [];
        this.maxLogs = CONFIG.ADMIN.MAX_ACTIVITY_LOGS;
        this.logTypes = CONFIG.ADMIN.LOG_TYPES;
        
        this._loadLogs();
    }

    /**
     * 记录管理员活动
     * @param {string} action - 活动类型
     * @param {Object} details - 活动详情
     */
    logActivity(action, details = {}) {
        const logEntry = {
            id: StringUtils.generateId(),
            timestamp: Date.now(),
            action,
            user: details.user || 'system',
            userAgent: navigator.userAgent,
            ip: this._getClientIP(),
            details: {
                ...details,
                url: window.location.href,
                referrer: document.referrer
            }
        };
        
        this.logs.unshift(logEntry);
        
        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
        
        // 保存到持久化存储
        this._saveLogs();
        
        // 触发日志事件
        eventManager.emit('admin:activity-logged', logEntry);
        
        console.log(`管理员活动记录: ${action}`, details);
    }

    /**
     * 获取活动日志
     * @param {Object} filters - 过滤条件
     * @returns {Array} 过滤后的日志
     */
    getLogs(filters = {}) {
        let filteredLogs = [...this.logs];
        
        // 按动作类型过滤
        if (filters.action) {
            filteredLogs = filteredLogs.filter(log => log.action === filters.action);
        }
        
        // 按用户过滤
        if (filters.user) {
            filteredLogs = filteredLogs.filter(log => log.user === filters.user);
        }
        
        // 按时间范围过滤
        if (filters.startTime) {
            filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startTime);
        }
        
        if (filters.endTime) {
            filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endTime);
        }
        
        // 分页
        if (filters.page && filters.pageSize) {
            const start = (filters.page - 1) * filters.pageSize;
            const end = start + filters.pageSize;
            filteredLogs = filteredLogs.slice(start, end);
        }
        
        return filteredLogs;
    }

    /**
     * 清除活动日志
     * @param {Object} options - 清除选项
     */
    clearLogs(options = {}) {
        const { olderThan, action, user } = options;
        
        if (olderThan) {
            // 清除指定时间之前的日志
            this.logs = this.logs.filter(log => log.timestamp > olderThan);
        } else if (action) {
            // 清除指定动作的日志
            this.logs = this.logs.filter(log => log.action !== action);
        } else if (user) {
            // 清除指定用户的日志
            this.logs = this.logs.filter(log => log.user !== user);
        } else {
            // 清除所有日志
            this.logs = [];
        }
        
        this._saveLogs();
        
        eventManager.emit('admin:logs-cleared', {
            options,
            timestamp: Date.now()
        });
    }

    /**
     * 导出日志
     * @param {string} format - 导出格式 ('json', 'csv')
     * @param {Object} filters - 过滤条件
     * @returns {string} 导出的数据
     */
    exportLogs(format = 'json', filters = {}) {
        const logs = this.getLogs(filters);
        
        if (format === 'csv') {
            return this._exportToCSV(logs);
        } else {
            return JSON.stringify(logs, null, 2);
        }
    }

    /**
     * 导出为CSV格式
     * @param {Array} logs - 日志数组
     * @returns {string} CSV字符串
     * @private
     */
    _exportToCSV(logs) {
        if (logs.length === 0) return '';
        
        const headers = ['时间', '动作', '用户', 'IP地址', '用户代理', '详情'];
        const rows = logs.map(log => [
            TimeUtils.formatDateTime(log.timestamp),
            log.action,
            log.user,
            log.ip || 'unknown',
            log.userAgent || 'unknown',
            JSON.stringify(log.details)
        ]);
        
        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
        
        return csvContent;
    }

    /**
     * 获取客户端IP
     * @returns {string} IP地址
     * @private
     */
    _getClientIP() {
        // 在实际应用中，这通常由服务器提供
        // 这里返回一个占位符
        return 'client-ip';
    }

    /**
     * 加载日志
     * @private
     */
    _loadLogs() {
        try {
            const savedLogs = storageManager.specializedStorage.adminData.get('activityLogs');
            if (savedLogs && Array.isArray(savedLogs)) {
                this.logs = savedLogs;
            }
        } catch (error) {
            console.warn('加载活动日志失败:', error);
        }
    }

    /**
     * 保存日志
     * @private
     */
    _saveLogs() {
        try {
            storageManager.specializedStorage.adminData.set('activityLogs', this.logs);
        } catch (error) {
            console.warn('保存活动日志失败:', error);
        }
    }

    /**
     * 获取日志统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {
            totalLogs: this.logs.length,
            actionCounts: {},
            userCounts: {},
            recentActivity: []
        };
        
        // 统计各种动作的数量
        this.logs.forEach(log => {
            stats.actionCounts[log.action] = (stats.actionCounts[log.action] || 0) + 1;
            stats.userCounts[log.user] = (stats.userCounts[log.user] || 0) + 1;
        });
        
        // 获取最近的活动
        stats.recentActivity = this.logs.slice(0, 10);
        
        return stats;
    }
}

/**
 * 权限管理器
 */
class PermissionManager {
    constructor() {
        this.permissions = CONFIG.ADMIN.PERMISSIONS;
        this.userPermissions = new Map();
        
        this._loadPermissions();
    }

    /**
     * 检查权限
     * @param {string} user - 用户标识
     * @param {string} permission - 权限名称
     * @returns {boolean} 是否有权限
     */
    hasPermission(user, permission) {
        const userPerms = this.userPermissions.get(user) || [];
        return userPerms.includes(permission) || userPerms.includes('admin');
    }

    /**
     * 授予权限
     * @param {string} user - 用户标识
     * @param {string} permission - 权限名称
     */
    grantPermission(user, permission) {
        if (!this.permissions.includes(permission)) {
            throw new Error(`未知权限: ${permission}`);
        }
        
        const userPerms = this.userPermissions.get(user) || [];
        if (!userPerms.includes(permission)) {
            userPerms.push(permission);
            this.userPermissions.set(user, userPerms);
            this._savePermissions();
            
            eventManager.emit('admin:permission-granted', {
                user,
                permission,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 撤销权限
     * @param {string} user - 用户标识
     * @param {string} permission - 权限名称
     */
    revokePermission(user, permission) {
        const userPerms = this.userPermissions.get(user) || [];
        const index = userPerms.indexOf(permission);
        
        if (index > -1) {
            userPerms.splice(index, 1);
            this.userPermissions.set(user, userPerms);
            this._savePermissions();
            
            eventManager.emit('admin:permission-revoked', {
                user,
                permission,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 获取用户权限
     * @param {string} user - 用户标识
     * @returns {Array} 权限列表
     */
    getUserPermissions(user) {
        return this.userPermissions.get(user) || [];
    }

    /**
     * 加载权限
     * @private
     */
    _loadPermissions() {
        try {
            const savedPerms = storageManager.specializedStorage.adminData.get('userPermissions');
            if (savedPerms) {
                this.userPermissions = new Map(savedPerms);
            }
        } catch (error) {
            console.warn('加载权限数据失败:', error);
        }
    }

    /**
     * 保存权限
     * @private
     */
    _savePermissions() {
        try {
            const permsArray = Array.from(this.userPermissions.entries());
            storageManager.specializedStorage.adminData.set('userPermissions', permsArray);
        } catch (error) {
            console.warn('保存权限数据失败:', error);
        }
    }
}

/**
 * 会话管理器
 */
class SessionManager {
    constructor() {
        this.currentSession = null;
        this.sessionTimeout = CONFIG.SECURITY.SESSION_TIMEOUT;
        this.warningTime = CONFIG.SECURITY.SESSION_WARNING_TIME;
        this.sessionTimer = null;
        this.warningTimer = null;
        
        this._bindEvents();
    }

    /**
     * 开始会话监控
     * @param {Object} sessionData - 会话数据
     */
    startSession(sessionData) {
        this.currentSession = {
            ...sessionData,
            startTime: Date.now(),
            lastActivity: Date.now()
        };
        
        this._startSessionTimers();
        this._bindActivityListeners();
        
        eventManager.emit('admin:session-started', {
            user: sessionData.user,
            timestamp: Date.now()
        });
    }

    /**
     * 结束会话
     * @param {string} reason - 结束原因
     */
    endSession(reason = 'logout') {
        if (!this.currentSession) return;
        
        const sessionDuration = Date.now() - this.currentSession.startTime;
        
        this._clearTimers();
        this._unbindActivityListeners();
        
        eventManager.emit('admin:session-ended', {
            user: this.currentSession.user,
            reason,
            duration: sessionDuration,
            timestamp: Date.now()
        });
        
        this.currentSession = null;
    }

    /**
     * 更新会话活动
     */
    updateActivity() {
        if (!this.currentSession) return;
        
        this.currentSession.lastActivity = Date.now();
        this._resetSessionTimers();
    }

    /**
     * 检查会话是否有效
     * @returns {boolean} 会话是否有效
     */
    isSessionValid() {
        if (!this.currentSession) return false;
        
        const timeSinceActivity = Date.now() - this.currentSession.lastActivity;
        return timeSinceActivity < this.sessionTimeout;
    }

    /**
     * 获取会话信息
     * @returns {Object|null} 会话信息
     */
    getSessionInfo() {
        if (!this.currentSession) return null;
        
        const timeSinceActivity = Date.now() - this.currentSession.lastActivity;
        const remainingTime = this.sessionTimeout - timeSinceActivity;
        
        return {
            ...this.currentSession,
            timeSinceActivity,
            remainingTime,
            isValid: this.isSessionValid()
        };
    }

    /**
     * 启动会话定时器
     * @private
     */
    _startSessionTimers() {
        this._clearTimers();
        
        // 设置警告定时器
        this.warningTimer = setTimeout(() => {
            this._showSessionWarning();
        }, this.sessionTimeout - this.warningTime);
        
        // 设置超时定时器
        this.sessionTimer = setTimeout(() => {
            this._handleSessionTimeout();
        }, this.sessionTimeout);
    }

    /**
     * 重置会话定时器
     * @private
     */
    _resetSessionTimers() {
        this._startSessionTimers();
    }

    /**
     * 清除定时器
     * @private
     */
    _clearTimers() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
        
        if (this.warningTimer) {
            clearTimeout(this.warningTimer);
            this.warningTimer = null;
        }
    }

    /**
     * 显示会话警告
     * @private
     */
    _showSessionWarning() {
        const remainingTime = TimeUtils.formatDuration(this.warningTime);
        
        uiManager.tooltipManager.warning(
            `会话即将在 ${remainingTime} 后过期，请保持活动状态`,
            { duration: 10000 }
        );
        
        eventManager.emit('admin:session-warning', {
            remainingTime: this.warningTime,
            timestamp: Date.now()
        });
    }

    /**
     * 处理会话超时
     * @private
     */
    _handleSessionTimeout() {
        uiManager.tooltipManager.error('会话已超时，请重新登录');
        
        // 记录会话超时活动
        eventManager.emit('admin:session-timeout', {
            user: this.currentSession?.user,
            timestamp: Date.now()
        });
        
        this.endSession('timeout');
        
        // 强制退出管理模式
        eventManager.emit('admin:force-logout');
    }

    /**
     * 绑定活动监听器
     * @private
     */
    _bindActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        
        this.activityHandler = () => {
            this.updateActivity();
        };
        
        events.forEach(event => {
            document.addEventListener(event, this.activityHandler, true);
        });
    }

    /**
     * 解绑活动监听器
     * @private
     */
    _unbindActivityListeners() {
        if (!this.activityHandler) return;
        
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        
        events.forEach(event => {
            document.removeEventListener(event, this.activityHandler, true);
        });
        
        this.activityHandler = null;
    }

    /**
     * 绑定事件
     * @private
     */
    _bindEvents() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面隐藏时暂停会话监控
                this._clearTimers();
            } else {
                // 页面显示时恢复会话监控
                if (this.currentSession) {
                    this._startSessionTimers();
                }
            }
        });
    }
}

/**
 * 主管理员管理器
 */
class AdminManager {
    constructor() {
        this.securityManager = new SecurityManager();
        this.activityLogManager = new ActivityLogManager();
        this.permissionManager = new PermissionManager();
        this.sessionManager = new SessionManager();
        
        this.isAdminMode = false;
        this.currentAdmin = null;
        
        this._bindEvents();
        this._loadAdminState();
    }

    /**
     * 管理员登录
     * @param {string} token - GitHub Token
     * @returns {Promise<Object>} 登录结果
     */
    async login(token) {
        try {
            // 获取客户端标识符
            const identifier = this._getClientIdentifier();
            
            // 检查登录冷却
            const cooldownCheck = this.securityManager.checkLoginCooldown(identifier);
            if (!cooldownCheck.allowed) {
                return {
                    success: false,
                    error: `登录尝试过于频繁，请在 ${cooldownCheck.formattedTime} 后重试`
                };
            }
            
            // 验证Token
            const validation = await this.securityManager.validateGitHubToken(token);
            
            if (!validation.valid) {
                // 记录失败尝试
                this.securityManager.recordFailedLogin(identifier, {
                    reason: validation.error,
                    token: token.substring(0, 8) + '...'
                });
                
                return {
                    success: false,
                    error: validation.error
                };
            }
            
            // 清除失败尝试记录
            this.securityManager.clearLoginAttempts(identifier);
            
            // 生成会话令牌
            const sessionToken = this.securityManager.generateSessionToken(validation.user);
            
            // 设置管理员状态
            this.isAdminMode = true;
            this.currentAdmin = {
                ...validation.user,
                sessionToken,
                loginTime: Date.now()
            };
            
            // 保存到本地存储
            this._saveAdminState();
            
            // 启动会话监控
            this.sessionManager.startSession(this.currentAdmin);
            
            // 记录登录活动
            this.activityLogManager.logActivity('LOGIN', {
                user: validation.user.login,
                success: true,
                sessionToken
            });
            
            // 触发登录成功事件
            eventManager.emitAdminLogin({
                user: validation.user,
                timestamp: Date.now()
            });
            
            return {
                success: true,
                user: validation.user,
                sessionToken
            };
            
        } catch (error) {
            console.error('管理员登录失败:', error);
            return {
                success: false,
                error: ERROR_MESSAGES.LOGIN_FAILED
            };
        }
    }

    /**
     * 管理员登出
     */
    logout() {
        if (!this.isAdminMode) return;
        
        const user = this.currentAdmin?.login || 'unknown';
        
        // 撤销会话令牌
        if (this.currentAdmin?.sessionToken) {
            this.securityManager.revokeSessionToken(this.currentAdmin.sessionToken);
        }
        
        // 结束会话监控
        this.sessionManager.endSession('logout');
        
        // 记录登出活动
        this.activityLogManager.logActivity('LOGOUT', {
            user,
            sessionDuration: Date.now() - (this.currentAdmin?.loginTime || Date.now())
        });
        
        // 清除管理员状态
        this.isAdminMode = false;
        this.currentAdmin = null;
        
        // 清除本地存储
        this._clearAdminState();
        
        // 触发登出事件
        eventManager.emitAdminLogout({
            user,
            timestamp: Date.now()
        });
    }

    /**
     * 检查管理员权限
     * @param {string} permission - 权限名称
     * @returns {boolean} 是否有权限
     */
    hasPermission(permission) {
        if (!this.isAdminMode || !this.currentAdmin) {
            return false;
        }
        
        return this.permissionManager.hasPermission(this.currentAdmin.login, permission);
    }

    /**
     * 验证当前会话
     * @returns {boolean} 会话是否有效
     */
    validateSession() {
        if (!this.isAdminMode || !this.currentAdmin) {
            return false;
        }
        
        // 验证会话令牌
        const session = this.securityManager.validateSessionToken(this.currentAdmin.sessionToken);
        if (!session) {
            this.logout();
            return false;
        }
        
        // 验证会话管理器
        if (!this.sessionManager.isSessionValid()) {
            this.logout();
            return false;
        }
        
        return true;
    }

    /**
     * 获取管理员信息
     * @returns {Object|null} 管理员信息
     */
    getAdminInfo() {
        if (!this.isAdminMode || !this.currentAdmin) {
            return null;
        }
        
        return {
            ...this.currentAdmin,
            sessionInfo: this.sessionManager.getSessionInfo(),
            permissions: this.permissionManager.getUserPermissions(this.currentAdmin.login)
        };
    }

    /**
     * 获取系统统计信息
     * @returns {Object} 统计信息
     */
    getSystemStats() {
        return {
            security: this.securityManager.getSecurityStats(),
            activity: this.activityLogManager.getStats(),
            session: this.sessionManager.getSessionInfo(),
            admin: {
                isAdminMode: this.isAdminMode,
                currentAdmin: this.currentAdmin?.login || null,
                loginTime: this.currentAdmin?.loginTime || null
            }
        };
    }

    /**
     * 获取客户端标识符
     * @returns {string} 客户端标识符
     * @private
     */
    _getClientIdentifier() {
        // 在实际应用中，这应该是真实的IP地址
        // 这里使用浏览器指纹作为标识符
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset()
        ].join('|');
        
        return StringUtils.hash(fingerprint);
    }

    /**
     * 保存管理员状态
     * @private
     */
    _saveAdminState() {
        try {
            const state = {
                isAdminMode: this.isAdminMode,
                currentAdmin: this.currentAdmin,
                timestamp: Date.now()
            };
            storageManager.specializedStorage.adminData.set('adminState', state);
        } catch (error) {
            console.warn('保存管理员状态失败:', error);
        }
    }

    /**
     * 加载管理员状态
     * @private
     */
    _loadAdminState() {
        try {
            const state = storageManager.specializedStorage.adminData.get('adminState');
            if (state && state.isAdminMode && state.currentAdmin) {
                // 验证保存的会话是否仍然有效
                const session = this.securityManager.validateSessionToken(state.currentAdmin.sessionToken);
                if (session) {
                    this.isAdminMode = true;
                    this.currentAdmin = state.currentAdmin;
                    this.sessionManager.startSession(this.currentAdmin);
                    
                    console.log('恢复管理员会话:', this.currentAdmin.login);
                } else {
                    this._clearAdminState();
                }
            }
        } catch (error) {
            console.warn('加载管理员状态失败:', error);
            this._clearAdminState();
        }
    }

    /**
     * 清除管理员状态
     * @private
     */
    _clearAdminState() {
        try {
            storageManager.specializedStorage.adminData.remove('adminState');
        } catch (error) {
            console.warn('清除管理员状态失败:', error);
        }
    }

    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        // 监听强制登出事件
        eventManager.on('admin:force-logout', () => {
            this.logout();
        });
        
        // 监听会话超时事件
        eventManager.on('admin:session-timeout', (data) => {
            this.activityLogManager.logActivity('SESSION_TIMEOUT', {
                user: data.user,
                reason: 'inactivity'
            });
        });
        
        // 监听页面卸载事件
        window.addEventListener('beforeunload', () => {
            if (this.isAdminMode) {
                this.activityLogManager.logActivity('PAGE_UNLOAD', {
                    user: this.currentAdmin?.login
                });
            }
        });
    }
}

// 创建全局管理员管理器实例
const adminManager = new AdminManager();

export {
    SecurityManager,
    ActivityLogManager,
    PermissionManager,
    SessionManager,
    AdminManager
};

export default adminManager;