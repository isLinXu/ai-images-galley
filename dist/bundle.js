// src/js/config.js
var CONFIG = {
  // 安全配置
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_COOLDOWN: 3e5,
    // 5分钟
    SESSION_TIMEOUT: 36e5,
    // 1小时
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
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    // 10MB
    SUPPORTED_FORMATS: ["jpg", "jpeg", "png", "gif", "webp"],
    THUMBNAIL_SIZE: 240,
    COMPRESSION_QUALITY: 0.8
  },
  // UI配置
  UI: {
    TOOLTIP_DURATION: 3e3,
    ANIMATION_DURATION: 300,
    SEARCH_DEBOUNCE: 300,
    PRELOAD_COUNT: 5
  },
  // 存储配置
  STORAGE: {
    MAX_LOGS: 50,
    MAX_NOTES_LENGTH: 1e3,
    CACHE_EXPIRY: 24 * 60 * 60 * 1e3
    // 24小时
  },
  // GitHub配置
  GITHUB: {
    API_BASE: "https://api.github.com",
    UPLOAD_TIMEOUT: 3e4,
    RETRY_COUNT: 3
  },
  // 主题配置
  THEMES: [
    {
      name: "default",
      primary: "#3B82F6",
      secondary: "#10B981",
      accent: "#F59E0B"
    },
    {
      name: "dark",
      primary: "#1E40AF",
      secondary: "#065F46",
      accent: "#B45309"
    },
    {
      name: "purple",
      primary: "#7C3AED",
      secondary: "#059669",
      accent: "#DC2626"
    }
  ]
};
var PATTERNS = {
  GITHUB_TOKEN: /^gh[ps]_[a-zA-Z0-9]{36,}$/,
  GITHUB_CLASSIC_TOKEN: /^[a-f0-9]{40}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/
};
var ERROR_MESSAGES = {
  TOKEN_INVALID: "Token\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u786E\u4FDD\u4F7F\u7528\u6709\u6548\u7684GitHub Token",
  TOKEN_TOO_SHORT: "Token\u957F\u5EA6\u4E0D\u8DB3\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u5B8C\u6574",
  LOGIN_COOLDOWN: "\u767B\u5F55\u5C1D\u8BD5\u8FC7\u591A\uFF0C\u8BF7\u7B49\u5F85 {minutes} \u5206\u949F\u540E\u91CD\u8BD5",
  SESSION_EXPIRED: "\u4F1A\u8BDD\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55",
  UPLOAD_FAILED: "\u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u548CToken\u6743\u9650",
  ANALYSIS_FAILED: "AI\u5206\u6790\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  MODEL_LOAD_FAILED: "\u6A21\u578B\u52A0\u8F7D\u5931\u8D25\uFF0C\u4F7F\u7528\u57FA\u7840\u5206\u6790\u529F\u80FD",
  FILE_TOO_LARGE: "\u6587\u4EF6\u8FC7\u5927\uFF0C\u8BF7\u9009\u62E9\u5C0F\u4E8E10MB\u7684\u56FE\u7247",
  UNSUPPORTED_FORMAT: "\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F"
};
var STORAGE_KEYS = {
  ADMIN_USER: "admin_user",
  ADMIN_LOGS: "admin_logs",
  IMAGE_NOTES: "image_notes",
  CUSTOM_TAGS: "custom_tags",
  THEME: "theme",
  LAST_FAILED_LOGIN: "last_failed_login",
  AI_CACHE: "ai_analysis_cache",
  USER_PREFERENCES: "user_preferences"
};
var EVENT_TYPES = {
  IMAGE_LOADED: "image:loaded",
  IMAGE_ANALYZED: "image:analyzed",
  ADMIN_LOGIN: "admin:login",
  ADMIN_LOGOUT: "admin:logout",
  SESSION_TIMEOUT: "session:timeout",
  UPLOAD_PROGRESS: "upload:progress",
  UPLOAD_COMPLETE: "upload:complete",
  THEME_CHANGED: "theme:changed"
};

// src/js/utils.js
var TimeUtils = {
  /**
   * 获取相对时间描述
   * @param {Date|string} date - 日期
   * @returns {string} 相对时间描述
   */
  getTimeAgo(date) {
    const now = /* @__PURE__ */ new Date();
    const targetDate = new Date(date);
    const diffMs = now - targetDate;
    const diffMins = Math.floor(diffMs / 6e4);
    const diffHours = Math.floor(diffMs / 36e5);
    const diffDays = Math.floor(diffMs / 864e5);
    if (diffMins < 1) return "\u521A\u521A";
    if (diffMins < 60) return `${diffMins}\u5206\u949F\u524D`;
    if (diffHours < 24) return `${diffHours}\u5C0F\u65F6\u524D`;
    if (diffDays < 30) return `${diffDays}\u5929\u524D`;
    return targetDate.toLocaleDateString("zh-CN");
  },
  /**
   * 格式化时间戳
   * @param {number|Date} timestamp - 时间戳
   * @returns {string} 格式化的时间字符串
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  },
  /**
   * 检查时间是否过期
   * @param {number|Date} timestamp - 时间戳
   * @param {number} expiry - 过期时间（毫秒）
   * @returns {boolean} 是否过期
   */
  isExpired(timestamp, expiry = CONFIG.STORAGE.CACHE_EXPIRY) {
    return Date.now() - new Date(timestamp).getTime() > expiry;
  }
};
var ValidationUtils = {
  /**
   * 验证GitHub Token
   * @param {string} token - GitHub Token
   * @returns {Object} 验证结果
   */
  validateGitHubToken(token) {
    if (!token || token.length < CONFIG.SECURITY.TOKEN_MIN_LENGTH) {
      return { valid: false, message: ERROR_MESSAGES.TOKEN_TOO_SHORT };
    }
    if (!PATTERNS.GITHUB_TOKEN.test(token) && !PATTERNS.GITHUB_CLASSIC_TOKEN.test(token)) {
      return { valid: false, message: ERROR_MESSAGES.TOKEN_INVALID };
    }
    return { valid: true };
  },
  /**
   * 验证文件类型
   * @param {File} file - 文件对象
   * @returns {Object} 验证结果
   */
  validateImageFile(file) {
    if (!file) {
      return { valid: false, message: "\u8BF7\u9009\u62E9\u6587\u4EF6" };
    }
    if (file.size > CONFIG.IMAGE.MAX_FILE_SIZE) {
      return { valid: false, message: ERROR_MESSAGES.FILE_TOO_LARGE };
    }
    const extension = file.name.split(".").pop().toLowerCase();
    if (!CONFIG.IMAGE.SUPPORTED_FORMATS.includes(extension)) {
      return { valid: false, message: ERROR_MESSAGES.UNSUPPORTED_FORMAT };
    }
    return { valid: true };
  },
  /**
   * 验证邮箱格式
   * @param {string} email - 邮箱地址
   * @returns {boolean} 是否有效
   */
  validateEmail(email) {
    return PATTERNS.EMAIL.test(email);
  },
  /**
   * 验证URL格式
   * @param {string} url - URL地址
   * @returns {boolean} 是否有效
   */
  validateURL(url) {
    return PATTERNS.URL.test(url);
  }
};
var StringUtils = {
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
  /**
   * 截断字符串
   * @param {string} str - 原字符串
   * @param {number} length - 最大长度
   * @param {string} suffix - 后缀
   * @returns {string} 截断后的字符串
   */
  truncate(str, length = 50, suffix = "...") {
    if (!str || str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  },
  /**
   * 转换为驼峰命名
   * @param {string} str - 原字符串
   * @returns {string} 驼峰命名字符串
   */
  toCamelCase(str) {
    return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : "");
  },
  /**
   * 转换为短横线命名
   * @param {string} str - 原字符串
   * @returns {string} 短横线命名字符串
   */
  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  },
  /**
   * 清理HTML标签
   * @param {string} html - HTML字符串
   * @returns {string} 纯文本
   */
  stripHtml(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  },
  /**
   * 转义HTML字符
   * @param {string} str - 原字符串
   * @returns {string} 转义后的字符串
   */
  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
};
var ObjectUtils = {
  /**
   * 深度克隆
   * @param {*} obj - 原对象
   * @returns {*} 克隆后的对象
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map((item) => this.deepClone(item));
    if (typeof obj === "object") {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  },
  /**
   * 深度合并对象
   * @param {Object} target - 目标对象
   * @param {...Object} sources - 源对象
   * @returns {Object} 合并后的对象
   */
  deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();
    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }
    return this.deepMerge(target, ...sources);
  },
  /**
   * 检查是否为对象
   * @param {*} item - 检查项
   * @returns {boolean} 是否为对象
   */
  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  },
  /**
   * 获取嵌套属性值
   * @param {Object} obj - 对象
   * @param {string} path - 属性路径
   * @param {*} defaultValue - 默认值
   * @returns {*} 属性值
   */
  get(obj, path, defaultValue = void 0) {
    const keys = path.split(".");
    let result = obj;
    for (const key of keys) {
      if (result == null || typeof result !== "object") {
        return defaultValue;
      }
      result = result[key];
    }
    return result !== void 0 ? result : defaultValue;
  },
  /**
   * 设置嵌套属性值
   * @param {Object} obj - 对象
   * @param {string} path - 属性路径
   * @param {*} value - 属性值
   */
  set(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    let current = obj;
    for (const key of keys) {
      if (!(key in current) || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }
    current[lastKey] = value;
  }
};
var FileUtils = {
  /**
   * 读取文件为Base64
   * @param {File} file - 文件对象
   * @returns {Promise<string>} Base64字符串
   */
  readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  /**
   * 读取文件为文本
   * @param {File} file - 文件对象
   * @returns {Promise<string>} 文本内容
   */
  readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },
  /**
   * 下载文件
   * @param {string} url - 文件URL
   * @param {string} filename - 文件名
   */
  download(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
  /**
   * 获取文件扩展名
   * @param {string} filename - 文件名
   * @returns {string} 扩展名
   */
  getExtension(filename) {
    return filename.split(".").pop().toLowerCase();
  },
  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化的大小
   */
  formatSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
};
var ThrottleUtils = {
  /**
   * 防抖函数
   * @param {Function} func - 原函数
   * @param {number} delay - 延迟时间
   * @returns {Function} 防抖后的函数
   */
  debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  },
  /**
   * 节流函数
   * @param {Function} func - 原函数
   * @param {number} delay - 延迟时间
   * @returns {Function} 节流后的函数
   */
  throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }
};
var AsyncUtils = {
  /**
   * 延迟执行
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise} Promise对象
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  /**
   * 重试执行
   * @param {Function} fn - 执行函数
   * @param {number} retries - 重试次数
   * @param {number} delay - 重试间隔
   * @returns {Promise} Promise对象
   */
  async retry(fn, retries = 3, delay = 1e3) {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        await this.delay(delay);
        return this.retry(fn, retries - 1, delay);
      }
      throw error;
    }
  },
  /**
   * 超时执行
   * @param {Promise} promise - Promise对象
   * @param {number} timeout - 超时时间
   * @returns {Promise} Promise对象
   */
  timeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout)
      )
    ]);
  }
};
var MathUtils = {
  /**
   * 限制数值范围
   * @param {number} value - 数值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 限制后的数值
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },
  /**
   * 线性插值
   * @param {number} start - 起始值
   * @param {number} end - 结束值
   * @param {number} t - 插值参数（0-1）
   * @returns {number} 插值结果
   */
  lerp(start, end, t) {
    return start + (end - start) * t;
  },
  /**
   * 映射数值范围
   * @param {number} value - 数值
   * @param {number} inMin - 输入最小值
   * @param {number} inMax - 输入最大值
   * @param {number} outMin - 输出最小值
   * @param {number} outMax - 输出最大值
   * @returns {number} 映射后的数值
   */
  map(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  },
  /**
   * 生成随机数
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 随机数
   */
  random(min = 0, max = 1) {
    return Math.random() * (max - min) + min;
  },
  /**
   * 生成随机整数
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 随机整数
   */
  randomInt(min, max) {
    return Math.floor(this.random(min, max + 1));
  }
};

// src/js/eventManager.js
var EventManager = class {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
    this.onceEvents = /* @__PURE__ */ new Map();
    this.maxListeners = 10;
    this.debug = false;
  }
  /**
   * 注册事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   * @returns {Function} 取消监听的函数
   */
  on(eventName, listener, options = {}) {
    if (typeof listener !== "function") {
      throw new Error("\u76D1\u542C\u5668\u5FC5\u987B\u662F\u4E00\u4E2A\u51FD\u6570");
    }
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }
    const listeners = this.events.get(eventName);
    if (listeners.length >= this.maxListeners) {
      console.warn(`\u4E8B\u4EF6 "${eventName}" \u7684\u76D1\u542C\u5668\u6570\u91CF\u5DF2\u8FBE\u5230\u6700\u5927\u9650\u5236 ${this.maxListeners}`);
    }
    const listenerWrapper = {
      listener,
      once: options.once || false,
      priority: options.priority || 0,
      context: options.context || null,
      id: this._generateId()
    };
    const insertIndex = listeners.findIndex((l) => l.priority < listenerWrapper.priority);
    if (insertIndex === -1) {
      listeners.push(listenerWrapper);
    } else {
      listeners.splice(insertIndex, 0, listenerWrapper);
    }
    if (this.debug) {
      console.log(`[EventManager] \u6CE8\u518C\u76D1\u542C\u5668: ${eventName}`, listenerWrapper);
    }
    return () => this.off(eventName, listenerWrapper.id);
  }
  /**
   * 注册一次性事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   * @returns {Function} 取消监听的函数
   */
  once(eventName, listener, options = {}) {
    return this.on(eventName, listener, { ...options, once: true });
  }
  /**
   * 移除事件监听器
   * @param {string} eventName - 事件名称
   * @param {string|Function} listenerOrId - 监听器函数或ID
   */
  off(eventName, listenerOrId) {
    if (!this.events.has(eventName)) {
      return;
    }
    const listeners = this.events.get(eventName);
    let index = -1;
    if (typeof listenerOrId === "string") {
      index = listeners.findIndex((l) => l.id === listenerOrId);
    } else if (typeof listenerOrId === "function") {
      index = listeners.findIndex((l) => l.listener === listenerOrId);
    }
    if (index !== -1) {
      listeners.splice(index, 1);
      if (this.debug) {
        console.log(`[EventManager] \u79FB\u9664\u76D1\u542C\u5668: ${eventName}`);
      }
    }
    if (listeners.length === 0) {
      this.events.delete(eventName);
    }
  }
  /**
   * 移除指定事件的所有监听器
   * @param {string} eventName - 事件名称
   */
  removeAllListeners(eventName) {
    if (eventName) {
      this.events.delete(eventName);
      if (this.debug) {
        console.log(`[EventManager] \u79FB\u9664\u6240\u6709\u76D1\u542C\u5668: ${eventName}`);
      }
    } else {
      this.events.clear();
      if (this.debug) {
        console.log("[EventManager] \u79FB\u9664\u6240\u6709\u4E8B\u4EF6\u76D1\u542C\u5668");
      }
    }
  }
  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {...any} args - 事件参数
   * @returns {boolean} 是否有监听器处理了事件
   */
  emit(eventName, ...args) {
    if (!this.events.has(eventName)) {
      if (this.debug) {
        console.log(`[EventManager] \u6CA1\u6709\u76D1\u542C\u5668\u5904\u7406\u4E8B\u4EF6: ${eventName}`);
      }
      return false;
    }
    const listeners = [...this.events.get(eventName)];
    let hasListeners = false;
    if (this.debug) {
      console.log(`[EventManager] \u89E6\u53D1\u4E8B\u4EF6: ${eventName}`, args);
    }
    for (const listenerWrapper of listeners) {
      try {
        const { listener, context, once, id } = listenerWrapper;
        if (context) {
          listener.call(context, ...args);
        } else {
          listener(...args);
        }
        hasListeners = true;
        if (once) {
          this.off(eventName, id);
        }
      } catch (error) {
        console.error(`[EventManager] \u76D1\u542C\u5668\u6267\u884C\u9519\u8BEF (${eventName}):`, error);
      }
    }
    return hasListeners;
  }
  /**
   * 异步触发事件
   * @param {string} eventName - 事件名称
   * @param {...any} args - 事件参数
   * @returns {Promise<boolean>} 是否有监听器处理了事件
   */
  async emitAsync(eventName, ...args) {
    if (!this.events.has(eventName)) {
      return false;
    }
    const listeners = [...this.events.get(eventName)];
    let hasListeners = false;
    if (this.debug) {
      console.log(`[EventManager] \u5F02\u6B65\u89E6\u53D1\u4E8B\u4EF6: ${eventName}`, args);
    }
    for (const listenerWrapper of listeners) {
      try {
        const { listener, context, once, id } = listenerWrapper;
        if (context) {
          await listener.call(context, ...args);
        } else {
          await listener(...args);
        }
        hasListeners = true;
        if (once) {
          this.off(eventName, id);
        }
      } catch (error) {
        console.error(`[EventManager] \u5F02\u6B65\u76D1\u542C\u5668\u6267\u884C\u9519\u8BEF (${eventName}):`, error);
      }
    }
    return hasListeners;
  }
  /**
   * 等待事件触发
   * @param {string} eventName - 事件名称
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise} Promise对象
   */
  waitFor(eventName, timeout = 0) {
    return new Promise((resolve, reject) => {
      let timeoutId;
      const cleanup = this.once(eventName, (...args) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(args);
      });
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`\u7B49\u5F85\u4E8B\u4EF6 "${eventName}" \u8D85\u65F6`));
        }, timeout);
      }
    });
  }
  /**
   * 获取事件监听器数量
   * @param {string} eventName - 事件名称
   * @returns {number} 监听器数量
   */
  listenerCount(eventName) {
    if (!this.events.has(eventName)) {
      return 0;
    }
    return this.events.get(eventName).length;
  }
  /**
   * 获取所有事件名称
   * @returns {Array<string>} 事件名称数组
   */
  eventNames() {
    return Array.from(this.events.keys());
  }
  /**
   * 设置最大监听器数量
   * @param {number} max - 最大数量
   */
  setMaxListeners(max) {
    this.maxListeners = max;
  }
  /**
   * 启用/禁用调试模式
   * @param {boolean} enabled - 是否启用
   */
  setDebug(enabled) {
    this.debug = enabled;
  }
  /**
   * 创建命名空间事件管理器
   * @param {string} namespace - 命名空间
   * @returns {Object} 命名空间事件管理器
   */
  namespace(namespace) {
    const prefixEvent = (eventName) => `${namespace}:${eventName}`;
    return {
      on: (eventName, listener, options) => this.on(prefixEvent(eventName), listener, options),
      once: (eventName, listener, options) => this.once(prefixEvent(eventName), listener, options),
      off: (eventName, listenerOrId) => this.off(prefixEvent(eventName), listenerOrId),
      emit: (eventName, ...args) => this.emit(prefixEvent(eventName), ...args),
      emitAsync: (eventName, ...args) => this.emitAsync(prefixEvent(eventName), ...args),
      waitFor: (eventName, timeout) => this.waitFor(prefixEvent(eventName), timeout),
      listenerCount: (eventName) => this.listenerCount(prefixEvent(eventName))
    };
  }
  /**
   * 生成唯一ID
   * @returns {string} 唯一ID
   * @private
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  /**
   * 获取调试信息
   * @returns {Object} 调试信息
   */
  getDebugInfo() {
    const info = {
      totalEvents: this.events.size,
      totalListeners: 0,
      events: {}
    };
    for (const [eventName, listeners] of this.events) {
      info.totalListeners += listeners.length;
      info.events[eventName] = {
        listenerCount: listeners.length,
        listeners: listeners.map((l) => ({
          id: l.id,
          priority: l.priority,
          once: l.once,
          hasContext: !!l.context
        }))
      };
    }
    return info;
  }
};
var TypedEventManager = class extends EventManager {
  constructor() {
    super();
    this.types = EVENT_TYPES;
  }
  /**
   * 触发图片加载事件
   * @param {Object} imageData - 图片数据
   */
  emitImageLoaded(imageData) {
    this.emit(this.types.IMAGE_LOADED, imageData);
  }
  /**
   * 触发图片分析完成事件
   * @param {Object} analysisResult - 分析结果
   */
  emitImageAnalyzed(analysisResult) {
    this.emit(this.types.IMAGE_ANALYZED, analysisResult);
  }
  /**
   * 触发管理员登录事件
   * @param {Object} adminData - 管理员数据
   */
  emitAdminLogin(adminData) {
    this.emit(this.types.ADMIN_LOGIN, adminData);
  }
  /**
   * 触发管理员登出事件
   */
  emitAdminLogout() {
    this.emit(this.types.ADMIN_LOGOUT);
  }
  /**
   * 触发会话超时事件
   */
  emitSessionTimeout() {
    this.emit(this.types.SESSION_TIMEOUT);
  }
  /**
   * 触发上传进度事件
   * @param {Object} progressData - 进度数据
   */
  emitUploadProgress(progressData) {
    this.emit(this.types.UPLOAD_PROGRESS, progressData);
  }
  /**
   * 触发上传完成事件
   * @param {Object} uploadResult - 上传结果
   */
  emitUploadComplete(uploadResult) {
    this.emit(this.types.UPLOAD_COMPLETE, uploadResult);
  }
  /**
   * 触发主题变更事件
   * @param {Object} themeData - 主题数据
   */
  emitThemeChanged(themeData) {
    this.emit(this.types.THEME_CHANGED, themeData);
  }
  /**
   * 监听图片加载事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onImageLoaded(listener, options) {
    return this.on(this.types.IMAGE_LOADED, listener, options);
  }
  /**
   * 监听图片分析完成事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onImageAnalyzed(listener, options) {
    return this.on(this.types.IMAGE_ANALYZED, listener, options);
  }
  /**
   * 监听管理员登录事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onAdminLogin(listener, options) {
    return this.on(this.types.ADMIN_LOGIN, listener, options);
  }
  /**
   * 监听管理员登出事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onAdminLogout(listener, options) {
    return this.on(this.types.ADMIN_LOGOUT, listener, options);
  }
  /**
   * 监听会话超时事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onSessionTimeout(listener, options) {
    return this.on(this.types.SESSION_TIMEOUT, listener, options);
  }
  /**
   * 监听上传进度事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onUploadProgress(listener, options) {
    return this.on(this.types.UPLOAD_PROGRESS, listener, options);
  }
  /**
   * 监听上传完成事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onUploadComplete(listener, options) {
    return this.on(this.types.UPLOAD_COMPLETE, listener, options);
  }
  /**
   * 监听主题变更事件
   * @param {Function} listener - 监听器函数
   * @param {Object} options - 选项
   */
  onThemeChanged(listener, options) {
    return this.on(this.types.THEME_CHANGED, listener, options);
  }
};
var eventManager = new TypedEventManager();
if (typeof process !== "undefined" && true) {
  eventManager.setDebug(true);
}
var eventManager_default = eventManager;

// src/js/storageManager.js
var StorageAdapter = class {
  get(key) {
    throw new Error("get\u65B9\u6CD5\u5FC5\u987B\u88AB\u5B9E\u73B0");
  }
  set(key, value) {
    throw new Error("set\u65B9\u6CD5\u5FC5\u987B\u88AB\u5B9E\u73B0");
  }
  remove(key) {
    throw new Error("remove\u65B9\u6CD5\u5FC5\u987B\u88AB\u5B9E\u73B0");
  }
  clear() {
    throw new Error("clear\u65B9\u6CD5\u5FC5\u987B\u88AB\u5B9E\u73B0");
  }
  keys() {
    throw new Error("keys\u65B9\u6CD5\u5FC5\u987B\u88AB\u5B9E\u73B0");
  }
};
var LocalStorageAdapter = class extends StorageAdapter {
  constructor() {
    super();
    this.storage = localStorage;
    this.available = this._checkAvailability();
  }
  get(key) {
    if (!this.available) return null;
    try {
      const item = this.storage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("LocalStorage\u8BFB\u53D6\u9519\u8BEF:", error);
      return null;
    }
  }
  set(key, value) {
    if (!this.available) return false;
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("LocalStorage\u5199\u5165\u9519\u8BEF:", error);
      return false;
    }
  }
  remove(key) {
    if (!this.available) return false;
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.error("LocalStorage\u5220\u9664\u9519\u8BEF:", error);
      return false;
    }
  }
  clear() {
    if (!this.available) return false;
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error("LocalStorage\u6E05\u7A7A\u9519\u8BEF:", error);
      return false;
    }
  }
  keys() {
    if (!this.available) return [];
    try {
      return Object.keys(this.storage);
    } catch (error) {
      console.error("LocalStorage\u83B7\u53D6\u952E\u5217\u8868\u9519\u8BEF:", error);
      return [];
    }
  }
  _checkAvailability() {
    try {
      const testKey = "__storage_test__";
      this.storage.setItem(testKey, "test");
      this.storage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }
};
var SessionStorageAdapter = class extends LocalStorageAdapter {
  constructor() {
    super();
    this.storage = sessionStorage;
    this.available = this._checkAvailability();
  }
};
var MemoryStorageAdapter = class extends StorageAdapter {
  constructor() {
    super();
    this.data = /* @__PURE__ */ new Map();
  }
  get(key) {
    return this.data.get(key) || null;
  }
  set(key, value) {
    this.data.set(key, value);
    return true;
  }
  remove(key) {
    return this.data.delete(key);
  }
  clear() {
    this.data.clear();
    return true;
  }
  keys() {
    return Array.from(this.data.keys());
  }
};
var StorageManager = class {
  constructor() {
    this.adapters = {
      local: new LocalStorageAdapter(),
      session: new SessionStorageAdapter(),
      memory: new MemoryStorageAdapter()
    };
    this.defaultAdapter = "local";
    this.cache = /* @__PURE__ */ new Map();
    this.cacheTimeout = CONFIG.STORAGE.CACHE_EXPIRY;
    this.maxCacheSize = 100;
    this.isInitialized = false;
    this._startCleanupTimer();
  }
  /**
   * 初始化存储管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("StorageManager already initialized");
      return;
    }
    try {
      console.log("Initializing StorageManager...");
      for (const [name, adapter] of Object.entries(this.adapters)) {
        if (!adapter.available) {
          console.warn(`Storage adapter '${name}' is not available`);
        }
      }
      this.isInitialized = true;
      console.log("StorageManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize StorageManager:", error);
      throw error;
    }
  }
  /**
   * 获取数据
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @param {string} adapter - 存储适配器类型
   * @returns {*} 数据值
   */
  get(key, defaultValue = null, adapter = this.defaultAdapter) {
    const cacheKey = `${adapter}:${key}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (!TimeUtils.isExpired(cached.timestamp, this.cacheTimeout)) {
        return cached.value;
      } else {
        this.cache.delete(cacheKey);
      }
    }
    const value = this.adapters[adapter].get(key);
    const result = value !== null ? value : defaultValue;
    if (result !== null) {
      this._setCache(cacheKey, result);
    }
    return result;
  }
  /**
   * 设置数据
   * @param {string} key - 键名
   * @param {*} value - 数据值
   * @param {string} adapter - 存储适配器类型
   * @returns {boolean} 是否成功
   */
  set(key, value, adapter = this.defaultAdapter) {
    const success = this.adapters[adapter].set(key, value);
    if (success) {
      const cacheKey = `${adapter}:${key}`;
      this._setCache(cacheKey, value);
      eventManager_default.emit("storage:changed", {
        key,
        value,
        adapter,
        action: "set"
      });
    }
    return success;
  }
  /**
   * 删除数据
   * @param {string} key - 键名
   * @param {string} adapter - 存储适配器类型
   * @returns {boolean} 是否成功
   */
  remove(key, adapter = this.defaultAdapter) {
    const success = this.adapters[adapter].remove(key);
    if (success) {
      const cacheKey = `${adapter}:${key}`;
      this.cache.delete(cacheKey);
      eventManager_default.emit("storage:changed", {
        key,
        adapter,
        action: "remove"
      });
    }
    return success;
  }
  /**
   * 清空存储
   * @param {string} adapter - 存储适配器类型
   * @returns {boolean} 是否成功
   */
  clear(adapter = this.defaultAdapter) {
    const success = this.adapters[adapter].clear();
    if (success) {
      for (const cacheKey of this.cache.keys()) {
        if (cacheKey.startsWith(`${adapter}:`)) {
          this.cache.delete(cacheKey);
        }
      }
      eventManager_default.emit("storage:changed", {
        adapter,
        action: "clear"
      });
    }
    return success;
  }
  /**
   * 获取所有键名
   * @param {string} adapter - 存储适配器类型
   * @returns {Array<string>} 键名数组
   */
  keys(adapter = this.defaultAdapter) {
    return this.adapters[adapter].keys();
  }
  /**
   * 检查键是否存在
   * @param {string} key - 键名
   * @param {string} adapter - 存储适配器类型
   * @returns {boolean} 是否存在
   */
  has(key, adapter = this.defaultAdapter) {
    return this.get(key, void 0, adapter) !== null;
  }
  /**
   * 获取存储大小（字节）
   * @param {string} adapter - 存储适配器类型
   * @returns {number} 存储大小
   */
  getSize(adapter = this.defaultAdapter) {
    if (adapter === "memory") {
      let size2 = 0;
      for (const [key, value] of this.adapters[adapter].data) {
        size2 += JSON.stringify({ key, value }).length;
      }
      return size2;
    }
    let size = 0;
    const keys = this.keys(adapter);
    for (const key of keys) {
      const value = this.adapters[adapter].get(key);
      size += key.length + JSON.stringify(value).length;
    }
    return size;
  }
  /**
   * 获取存储使用情况
   * @returns {Object} 使用情况统计
   */
  getUsage() {
    return {
      local: {
        size: this.getSize("local"),
        keys: this.keys("local").length,
        available: this.adapters.local.available
      },
      session: {
        size: this.getSize("session"),
        keys: this.keys("session").length,
        available: this.adapters.session.available
      },
      memory: {
        size: this.getSize("memory"),
        keys: this.keys("memory").length,
        available: true
      },
      cache: {
        size: this.cache.size,
        maxSize: this.maxCacheSize
      }
    };
  }
  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   * @private
   */
  _setCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value: ObjectUtils.deepClone(value),
      timestamp: Date.now()
    });
  }
  /**
   * 启动清理定时器
   * @private
   */
  _startCleanupTimer() {
    setInterval(() => {
      this._cleanupCache();
    }, 6e4);
  }
  /**
   * 清理过期缓存
   * @private
   */
  _cleanupCache() {
    const now = Date.now();
    for (const [key, cached] of this.cache) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
  /**
   * 导出数据
   * @param {string} adapter - 存储适配器类型
   * @returns {Object} 导出的数据
   */
  export(adapter = this.defaultAdapter) {
    const data = {};
    const keys = this.keys(adapter);
    for (const key of keys) {
      data[key] = this.get(key, null, adapter);
    }
    return {
      adapter,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      data
    };
  }
  /**
   * 导入数据
   * @param {Object} exportData - 导出的数据
   * @param {boolean} merge - 是否合并（否则覆盖）
   * @returns {boolean} 是否成功
   */
  import(exportData, merge = true) {
    try {
      const { adapter, data } = exportData;
      if (!merge) {
        this.clear(adapter);
      }
      for (const [key, value] of Object.entries(data)) {
        this.set(key, value, adapter);
      }
      return true;
    } catch (error) {
      console.error("\u6570\u636E\u5BFC\u5165\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 创建命名空间存储
   * @param {string} namespace - 命名空间
   * @returns {Object} 命名空间存储对象
   */
  namespace(namespace) {
    const prefixKey = (key) => `${namespace}:${key}`;
    return {
      get: (key, defaultValue, adapter) => this.get(prefixKey(key), defaultValue, adapter),
      set: (key, value, adapter) => this.set(prefixKey(key), value, adapter),
      remove: (key, adapter) => this.remove(prefixKey(key), adapter),
      has: (key, adapter) => this.has(prefixKey(key), adapter),
      keys: (adapter) => this.keys(adapter).filter((key) => key.startsWith(`${namespace}:`)).map((key) => key.substring(namespace.length + 1)),
      clear: () => {
        const keys = this.keys().filter((key) => key.startsWith(`${namespace}:`));
        for (const key of keys) {
          this.remove(key);
        }
      }
    };
  }
};
var SpecializedStorageManager = class {
  constructor(storageManager2) {
    this.storage = storageManager2;
  }
  /**
   * 管理员数据管理
   */
  get admin() {
    return {
      getUser: () => this.storage.get(STORAGE_KEYS.ADMIN_USER),
      setUser: (userData) => this.storage.set(STORAGE_KEYS.ADMIN_USER, userData),
      removeUser: () => this.storage.remove(STORAGE_KEYS.ADMIN_USER),
      getLogs: () => this.storage.get(STORAGE_KEYS.ADMIN_LOGS, []),
      setLogs: (logs) => this.storage.set(STORAGE_KEYS.ADMIN_LOGS, logs),
      addLog: (log) => {
        const logs = this.getLogs();
        logs.unshift(log);
        if (logs.length > CONFIG.STORAGE.MAX_LOGS) {
          logs.splice(CONFIG.STORAGE.MAX_LOGS);
        }
        this.setLogs(logs);
      },
      clearLogs: () => this.storage.remove(STORAGE_KEYS.ADMIN_LOGS)
    };
  }
  /**
   * 图片数据管理
   */
  get images() {
    return {
      getNotes: () => this.storage.get(STORAGE_KEYS.IMAGE_NOTES, /* @__PURE__ */ new Map()),
      setNotes: (notes) => this.storage.set(STORAGE_KEYS.IMAGE_NOTES, notes),
      getNote: (imageUrl) => {
        const notes = this.getNotes();
        return notes.get ? notes.get(imageUrl) : notes[imageUrl];
      },
      setNote: (imageUrl, note) => {
        const notes = this.getNotes();
        if (notes.set) {
          notes.set(imageUrl, note);
        } else {
          notes[imageUrl] = note;
        }
        this.setNotes(notes);
      },
      removeNote: (imageUrl) => {
        const notes = this.getNotes();
        if (notes.delete) {
          notes.delete(imageUrl);
        } else {
          delete notes[imageUrl];
        }
        this.setNotes(notes);
      },
      getTags: () => this.storage.get(STORAGE_KEYS.CUSTOM_TAGS, /* @__PURE__ */ new Map()),
      setTags: (tags) => this.storage.set(STORAGE_KEYS.CUSTOM_TAGS, tags),
      getImageTags: (imageUrl) => {
        const tags = this.getTags();
        return tags.get ? tags.get(imageUrl) : tags[imageUrl] || [];
      },
      setImageTags: (imageUrl, imageTags) => {
        const tags = this.getTags();
        if (tags.set) {
          tags.set(imageUrl, imageTags);
        } else {
          tags[imageUrl] = imageTags;
        }
        this.setTags(tags);
      },
      addImageTag: (imageUrl, tag) => {
        const imageTags = this.getImageTags(imageUrl);
        if (!imageTags.includes(tag)) {
          imageTags.push(tag);
          this.setImageTags(imageUrl, imageTags);
        }
      },
      removeImageTag: (imageUrl, tag) => {
        const imageTags = this.getImageTags(imageUrl);
        const index = imageTags.indexOf(tag);
        if (index !== -1) {
          imageTags.splice(index, 1);
          this.setImageTags(imageUrl, imageTags);
        }
      }
    };
  }
  /**
   * AI缓存管理
   */
  get aiCache() {
    return {
      get: (key) => this.storage.get(`${STORAGE_KEYS.AI_CACHE}:${key}`),
      set: (key, value) => this.storage.set(`${STORAGE_KEYS.AI_CACHE}:${key}`, {
        value,
        timestamp: Date.now()
      }),
      remove: (key) => this.storage.remove(`${STORAGE_KEYS.AI_CACHE}:${key}`),
      clear: () => {
        const keys = this.storage.keys().filter((key) => key.startsWith(STORAGE_KEYS.AI_CACHE));
        for (const key of keys) {
          this.storage.remove(key);
        }
      },
      cleanup: () => {
        const keys = this.storage.keys().filter((key) => key.startsWith(STORAGE_KEYS.AI_CACHE));
        for (const key of keys) {
          const cached = this.storage.get(key);
          if (cached && TimeUtils.isExpired(cached.timestamp)) {
            this.storage.remove(key);
          }
        }
      }
    };
  }
  /**
   * 用户偏好设置管理
   */
  get preferences() {
    return {
      get: (key, defaultValue) => {
        const prefs = this.storage.get(STORAGE_KEYS.USER_PREFERENCES, {});
        return ObjectUtils.get(prefs, key, defaultValue);
      },
      set: (key, value) => {
        const prefs = this.storage.get(STORAGE_KEYS.USER_PREFERENCES, {});
        ObjectUtils.set(prefs, key, value);
        this.storage.set(STORAGE_KEYS.USER_PREFERENCES, prefs);
      },
      remove: (key) => {
        const prefs = this.storage.get(STORAGE_KEYS.USER_PREFERENCES, {});
        const keys = key.split(".");
        const lastKey = keys.pop();
        let current = prefs;
        for (const k of keys) {
          if (!(k in current)) return;
          current = current[k];
        }
        delete current[lastKey];
        this.storage.set(STORAGE_KEYS.USER_PREFERENCES, prefs);
      },
      clear: () => this.storage.remove(STORAGE_KEYS.USER_PREFERENCES)
    };
  }
  /**
   * 主题管理
   */
  get theme() {
    return {
      get: () => this.storage.get(STORAGE_KEYS.THEME),
      set: (themeData) => this.storage.set(STORAGE_KEYS.THEME, themeData),
      remove: () => this.storage.remove(STORAGE_KEYS.THEME)
    };
  }
};
var storageManager = new StorageManager();
var specializedStorage = new SpecializedStorageManager(storageManager);
var storageManager_default = storageManager;

// src/js/uiManager.js
var ModalManager = class {
  constructor() {
    this.activeModals = /* @__PURE__ */ new Set();
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
      console.error(`\u6A21\u6001\u6846\u4E0D\u5B58\u5728: ${modalId}`);
      return;
    }
    this.activeModals.add(modalId);
    this.modalStack.push({
      id: modalId,
      options,
      previousFocus: document.activeElement
    });
    modal.style.display = "flex";
    modal.classList.add("active");
    if (focus) {
      this._setModalFocus(modal);
    }
    document.body.style.overflow = "hidden";
    if (onShow) onShow(modal);
    eventManager_default.emit("modal:show", { modalId, modal });
    requestAnimationFrame(() => {
      modal.classList.add("show");
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
    this.activeModals.delete(modalId);
    const modalInfo = this.modalStack.find((m) => m.id === modalId);
    this.modalStack = this.modalStack.filter((m) => m.id !== modalId);
    modal.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
      modal.classList.remove("active");
      if (modalInfo?.previousFocus) {
        modalInfo.previousFocus.focus();
      }
      if (this.activeModals.size === 0) {
        document.body.style.overflow = "";
      }
      if (modalInfo?.options.onHide) {
        modalInfo.options.onHide(modal);
      }
      eventManager_default.emit("modal:hide", { modalId, modal });
    }, 300);
  }
  /**
   * 隐藏所有模态框
   */
  hideAll() {
    const modalIds = Array.from(this.activeModals);
    modalIds.forEach((id) => this.hide(id));
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
    if (event.key === "Escape" && this.modalStack.length > 0) {
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
    document.addEventListener("keydown", this.escapeKeyHandler);
    document.addEventListener("click", this.backdropClickHandler);
  }
  /**
   * 获取活动模态框
   * @returns {Array} 活动模态框ID数组
   */
  getActiveModals() {
    return Array.from(this.activeModals);
  }
};
var TooltipManager = class {
  constructor() {
    this.activeTooltips = /* @__PURE__ */ new Map();
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
      type = "info",
      // info, success, warning, error
      duration = 3e3,
      position = "top-right",
      closable = true,
      html = false
    } = options;
    const tooltip = this._createTooltip(message, { type, closable, html });
    const tooltipId = StringUtils.generateId();
    tooltip.setAttribute("data-tooltip-id", tooltipId);
    this.activeTooltips.set(tooltipId, tooltip);
    this.tooltipContainer.appendChild(tooltip);
    requestAnimationFrame(() => {
      tooltip.classList.add("show");
    });
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
    tooltip.classList.remove("show");
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
    const tooltip = document.createElement("div");
    tooltip.className = `tooltip tooltip-${type}`;
    const content = document.createElement("div");
    content.className = "tooltip-content";
    if (html) {
      content.innerHTML = message;
    } else {
      content.textContent = message;
    }
    tooltip.appendChild(content);
    if (closable) {
      const closeBtn = document.createElement("button");
      closeBtn.className = "tooltip-close";
      closeBtn.innerHTML = "\xD7";
      closeBtn.onclick = () => {
        const tooltipId = tooltip.getAttribute("data-tooltip-id");
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
    this.tooltipContainer = document.createElement("div");
    this.tooltipContainer.className = "tooltip-container";
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
    return this.show(message, { ...options, type: "success" });
  }
  /**
   * 显示错误提示
   * @param {string} message - 消息内容
   * @param {Object} options - 选项
   */
  error(message, options = {}) {
    return this.show(message, { ...options, type: "error", duration: 5e3 });
  }
  /**
   * 显示警告提示
   * @param {string} message - 消息内容
   * @param {Object} options - 选项
   */
  warning(message, options = {}) {
    return this.show(message, { ...options, type: "warning", duration: 4e3 });
  }
  /**
   * 清除所有提示框
   */
  clear() {
    const tooltipIds = Array.from(this.activeTooltips.keys());
    tooltipIds.forEach((id) => this.hide(id));
  }
};
var ProgressManager = class {
  constructor() {
    this.activeProgress = /* @__PURE__ */ new Map();
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
      title = "\u5904\u7406\u4E2D...",
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
    requestAnimationFrame(() => {
      progressElement.classList.add("show");
    });
    return id;
  }
  /**
   * 更新进度
   * @param {string} id - 进度条ID
   * @param {number} value - 进度值 (0-100)
   * @param {string} message - 进度消息
   */
  update(id, value, message = "") {
    const progress = this.activeProgress.get(id);
    if (!progress) return;
    progress.value = Math.max(0, Math.min(100, value));
    const progressBar = progress.element.querySelector(".progress-bar");
    const progressText = progress.element.querySelector(".progress-text");
    const progressPercentage = progress.element.querySelector(".progress-percentage");
    if (progressBar) {
      progressBar.style.width = `${progress.value}%`;
    }
    if (progressText && message) {
      progressText.textContent = message;
    }
    if (progressPercentage) {
      progressPercentage.textContent = `${Math.round(progress.value)}%`;
    }
    eventManager_default.emit("progress:update", {
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
  complete(id, message = "\u5B8C\u6210") {
    this.update(id, 100, message);
    setTimeout(() => {
      this.remove(id);
    }, 1e3);
  }
  /**
   * 移除进度条
   * @param {string} id - 进度条ID
   */
  remove(id) {
    const progress = this.activeProgress.get(id);
    if (!progress) return;
    progress.element.classList.remove("show");
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
    const element = document.createElement("div");
    element.className = "progress-item";
    element.setAttribute("data-progress-id", id);
    element.innerHTML = `
            <div class="progress-header">
                <span class="progress-title">${title}</span>
                ${showPercentage ? '<span class="progress-percentage">0%</span>' : ""}
                ${showCancel ? '<button class="progress-cancel">\xD7</button>' : ""}
            </div>
            <div class="progress-track">
                <div class="progress-bar"></div>
            </div>
            <div class="progress-text"></div>
        `;
    if (showCancel && onCancel) {
      const cancelBtn = element.querySelector(".progress-cancel");
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
    this.progressContainer = document.createElement("div");
    this.progressContainer.className = "progress-container";
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
};
var LoadingManager = class {
  constructor() {
    this.loadingStates = /* @__PURE__ */ new Map();
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
      message = "\u52A0\u8F7D\u4E2D...",
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
    eventManager_default.emit("loading:show", { id, options });
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
    eventManager_default.emit("loading:hide", {
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
    this.loadingOverlay.style.display = "flex";
    const messageEl = this.loadingOverlay.querySelector(".loading-message");
    const spinnerEl = this.loadingOverlay.querySelector(".loading-spinner");
    if (messageEl) messageEl.textContent = message;
    if (spinnerEl) spinnerEl.style.display = spinner ? "block" : "none";
    requestAnimationFrame(() => {
      this.loadingOverlay.classList.add("show");
    });
  }
  /**
   * 隐藏全局加载
   * @private
   */
  _hideGlobalLoading() {
    if (!this.globalLoading) return;
    this.globalLoading = false;
    this.loadingOverlay.classList.remove("show");
    setTimeout(() => {
      this.loadingOverlay.style.display = "none";
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
    const loadingEl = document.createElement("div");
    loadingEl.className = "target-loading";
    loadingEl.innerHTML = `
            ${spinner ? '<div class="loading-spinner"></div>' : ""}
            <div class="loading-message">${message}</div>
        `;
    target.style.position = "relative";
    target.appendChild(loadingEl);
    requestAnimationFrame(() => {
      loadingEl.classList.add("show");
    });
  }
  /**
   * 隐藏目标加载
   * @param {HTMLElement} target - 目标元素
   * @private
   */
  _hideTargetLoading(target) {
    if (!target) return;
    const loadingEl = target.querySelector(".target-loading");
    if (loadingEl) {
      loadingEl.classList.remove("show");
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
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.className = "loading-overlay";
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
                <div class="loading-message">\u52A0\u8F7D\u4E2D...</div>
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
};
var ThemeManager = class {
  constructor() {
    this.currentTheme = "light";
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
      console.error(`\u4E3B\u9898\u4E0D\u5B58\u5728: ${themeName}`);
      return;
    }
    const oldTheme = this.currentTheme;
    this.currentTheme = themeName;
    document.body.style.transition = `all ${this.transitionDuration}ms ease`;
    document.body.classList.remove(`theme-${oldTheme}`);
    document.body.classList.add(`theme-${themeName}`);
    this._updateCSSVariables(this.themes[themeName]);
    storageManager_default.specializedStorage.userPreferences.set("theme", themeName);
    setTimeout(() => {
      document.body.style.transition = "";
    }, this.transitionDuration);
    eventManager_default.emitThemeChanged({
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
      if (typeof value === "string") {
        root.style.setProperty(`--${key}`, value);
      } else if (typeof value === "object") {
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
    const savedTheme = storageManager_default.specializedStorage.userPreferences.get("theme");
    if (savedTheme && this.themes[savedTheme]) {
      this.setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.setTheme(prefersDark ? "dark" : "light");
    }
  }
  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addListener((e) => {
      const autoTheme = storageManager_default.specializedStorage.userPreferences.get("autoTheme");
      if (autoTheme) {
        this.setTheme(e.matches ? "dark" : "light");
      }
    });
  }
  /**
   * 设置自动主题
   * @param {boolean} enabled - 是否启用自动主题
   */
  setAutoTheme(enabled) {
    storageManager_default.specializedStorage.userPreferences.set("autoTheme", enabled);
    if (enabled) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.setTheme(prefersDark ? "dark" : "light");
    }
  }
};
var ResponsiveManager = class {
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
    window.addEventListener("resize", this.resizeHandler);
  }
  /**
   * 处理窗口大小变化
   * @private
   */
  _handleResize() {
    const oldBreakpoint = this.currentBreakpoint;
    this._updateBreakpoint();
    if (oldBreakpoint !== this.currentBreakpoint) {
      eventManager_default.emit("responsive:breakpoint-change", {
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
    document.body.className = document.body.className.replace(/\bbreakpoint-\w+\b/g, "").trim();
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
    return this.currentBreakpoint === "xs" || this.currentBreakpoint === "sm";
  }
  /**
   * 检查是否为平板设备
   * @returns {boolean} 是否为平板设备
   */
  isTablet() {
    return this.currentBreakpoint === "md";
  }
  /**
   * 检查是否为桌面设备
   * @returns {boolean} 是否为桌面设备
   */
  isDesktop() {
    return this.currentBreakpoint === "lg" || this.currentBreakpoint === "xl";
  }
};
var UIManager = class {
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
      await this._initializeComponents();
      this._setupGlobalListeners();
      this.initialized = true;
      eventManager_default.emit("ui:initialized");
      console.log("UI\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5B8C\u6210");
    } catch (error) {
      console.error("UI\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 初始化组件
   * @private
   */
  async _initializeComponents() {
  }
  /**
   * 设置全局监听器
   * @private
   */
  _setupGlobalListeners() {
    document.addEventListener("keydown", this._handleGlobalKeydown.bind(this));
    document.addEventListener("click", this._handleGlobalClick.bind(this));
    window.addEventListener("scroll", ThrottleUtils.throttle(this._handleGlobalScroll.bind(this), 100));
  }
  /**
   * 处理全局键盘事件
   * @param {KeyboardEvent} event - 键盘事件
   * @private
   */
  _handleGlobalKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "k") {
      event.preventDefault();
      eventManager_default.emit("ui:search-shortcut");
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "t") {
      event.preventDefault();
      this.themeManager.toggleTheme();
    }
    if (event.key === "F11") {
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
    const dropdowns = document.querySelectorAll(".dropdown.open");
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove("open");
      }
    });
  }
  /**
   * 处理全局滚动事件
   * @private
   */
  _handleGlobalScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (scrollTop > 100) {
      document.body.classList.add("scrolled");
    } else {
      document.body.classList.remove("scrolled");
    }
    eventManager_default.emit("ui:scroll", { scrollTop });
  }
  /**
   * 切换全屏模式
   */
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("\u65E0\u6CD5\u8FDB\u5165\u5168\u5C4F\u6A21\u5F0F:", err);
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
      title = "\u786E\u8BA4",
      confirmText = "\u786E\u5B9A",
      cancelText = "\u53D6\u6D88",
      type = "warning"
    } = options;
    return new Promise((resolve) => {
      const dialog = document.createElement("div");
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
      const okBtn = dialog.querySelector(".confirm-ok");
      const cancelBtn = dialog.querySelector(".confirm-cancel");
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
      document.body.appendChild(dialog);
      okBtn.focus();
    });
  }
  /**
   * 绑定事件监听器
   * @private
   */
  _bindEvents() {
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }
  /**
   * 清理资源
   */
  cleanup() {
    this.tooltipManager.clear();
    this.modalManager.hideAll();
    window.removeEventListener("resize", this.responsiveManager.resizeHandler);
    console.log("UI\u7BA1\u7406\u5668\u8D44\u6E90\u5DF2\u6E05\u7406");
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
};
var uiManager = new UIManager();
var uiManager_default = uiManager;

// src/js/imageManager.js
var ImageMetadataManager = class {
  constructor() {
    this.metadataCache = /* @__PURE__ */ new Map();
    this.exifReader = null;
  }
  /**
   * 提取图像元数据
   * @param {File} file - 图像文件
   * @returns {Promise<Object>} 元数据对象
   */
  async extractMetadata(file) {
    try {
      const metadata = {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        lastModified: new Date(file.lastModified),
        extractedAt: /* @__PURE__ */ new Date(),
        basic: await this._extractBasicMetadata(file),
        exif: await this._extractExifData(file),
        computed: {}
      };
      metadata.computed = this._computeDerivedProperties(metadata);
      return metadata;
    } catch (error) {
      console.error("\u5143\u6570\u636E\u63D0\u53D6\u5931\u8D25:", error);
      return this._createFallbackMetadata(file);
    }
  }
  /**
   * 提取基础元数据
   * @param {File} file - 图像文件
   * @returns {Promise<Object>} 基础元数据
   * @private
   */
  async _extractBasicMetadata(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const metadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight,
          megapixels: img.naturalWidth * img.naturalHeight / 1e6
        };
        URL.revokeObjectURL(url);
        resolve(metadata);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.error(`Failed to load image: ${file.name}`);
        resolve({
          width: 0,
          height: 0,
          aspectRatio: 1,
          megapixels: 0,
          error: "Image load failed"
        });
      };
      img.src = url;
    });
  }
  /**
   * 提取EXIF数据
   * @param {File} file - 图像文件
   * @returns {Promise<Object>} EXIF数据
   * @private
   */
  async _extractExifData(file) {
    try {
      return {
        camera: null,
        lens: null,
        settings: {
          iso: null,
          aperture: null,
          shutterSpeed: null,
          focalLength: null
        },
        location: {
          latitude: null,
          longitude: null,
          altitude: null
        },
        datetime: {
          taken: null,
          digitized: null,
          modified: null
        },
        orientation: 1
      };
    } catch (error) {
      console.warn("EXIF\u6570\u636E\u63D0\u53D6\u5931\u8D25:", error);
      return {};
    }
  }
  /**
   * 计算派生属性
   * @param {Object} metadata - 原始元数据
   * @returns {Object} 派生属性
   * @private
   */
  _computeDerivedProperties(metadata) {
    const { basic } = metadata;
    return {
      orientation: this._determineOrientation(basic.aspectRatio),
      quality: this._assessImageQuality(basic, metadata.fileSize),
      category: this._categorizeByDimensions(basic),
      sizeCategory: this._categorizeBySizeCategory(metadata.fileSize),
      displayName: this._generateDisplayName(metadata.fileName)
    };
  }
  /**
   * 确定图像方向
   * @param {number} aspectRatio - 宽高比
   * @returns {string} 方向类型
   * @private
   */
  _determineOrientation(aspectRatio) {
    if (aspectRatio > 1.2) return "landscape";
    if (aspectRatio < 0.8) return "portrait";
    return "square";
  }
  /**
   * 评估图像质量
   * @param {Object} basic - 基础元数据
   * @param {number} fileSize - 文件大小
   * @returns {string} 质量等级
   * @private
   */
  _assessImageQuality(basic, fileSize) {
    const { width, height, megapixels } = basic;
    const compressionRatio = fileSize / (width * height * 3);
    if (megapixels >= 12 && compressionRatio > 0.1) return "high";
    if (megapixels >= 6 && compressionRatio > 0.05) return "medium";
    return "low";
  }
  /**
   * 按尺寸分类
   * @param {Object} basic - 基础元数据
   * @returns {string} 尺寸类别
   * @private
   */
  _categorizeByDimensions(basic) {
    const { width, height } = basic;
    const maxDimension = Math.max(width, height);
    if (maxDimension >= 4e3) return "ultra-high";
    if (maxDimension >= 2e3) return "high";
    if (maxDimension >= 1e3) return "medium";
    return "low";
  }
  /**
   * 按文件大小分类
   * @param {number} fileSize - 文件大小
   * @returns {string} 大小类别
   * @private
   */
  _categorizeBySizeCategory(fileSize) {
    const sizeMB = fileSize / (1024 * 1024);
    if (sizeMB >= 10) return "large";
    if (sizeMB >= 5) return "medium";
    if (sizeMB >= 1) return "small";
    return "tiny";
  }
  /**
   * 生成显示名称
   * @param {string} fileName - 文件名
   * @returns {string} 显示名称
   * @private
   */
  _generateDisplayName(fileName) {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    return StringUtils.truncate(nameWithoutExt, 30);
  }
  /**
   * 创建备用元数据
   * @param {File} file - 图像文件
   * @returns {Object} 备用元数据
   * @private
   */
  _createFallbackMetadata(file) {
    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: new Date(file.lastModified),
      extractedAt: /* @__PURE__ */ new Date(),
      basic: {
        width: 0,
        height: 0,
        aspectRatio: 1,
        megapixels: 0
      },
      exif: {},
      computed: {
        orientation: "unknown",
        quality: "unknown",
        category: "unknown",
        sizeCategory: "unknown",
        displayName: file.name
      },
      error: true
    };
  }
};
var ImageCacheManager = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.thumbnailCache = /* @__PURE__ */ new Map();
    this.maxCacheSize = CONFIG.IMAGE.MAX_CACHE_SIZE;
    this.maxThumbnailCacheSize = CONFIG.IMAGE.MAX_THUMBNAIL_CACHE_SIZE;
    this.compressionQuality = CONFIG.IMAGE.COMPRESSION_QUALITY;
  }
  /**
   * 获取缓存的图像
   * @param {string} key - 缓存键
   * @returns {string|null} 图像URL或null
   */
  get(key) {
    if (this.cache.has(key)) {
      const item = this.cache.get(key);
      item.lastAccessed = Date.now();
      return item.url;
    }
    return null;
  }
  /**
   * 缓存图像
   * @param {string} key - 缓存键
   * @param {string} url - 图像URL
   * @param {Object} metadata - 元数据
   */
  set(key, url, metadata = {}) {
    if (this.cache.size >= this.maxCacheSize) {
      this._evictLeastRecentlyUsed();
    }
    this.cache.set(key, {
      url,
      metadata,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      size: this._estimateSize(url)
    });
  }
  /**
   * 获取缓存的缩略图
   * @param {string} key - 缓存键
   * @returns {string|null} 缩略图URL或null
   */
  getThumbnail(key) {
    if (this.thumbnailCache.has(key)) {
      const item = this.thumbnailCache.get(key);
      item.lastAccessed = Date.now();
      return item.url;
    }
    return null;
  }
  /**
   * 缓存缩略图
   * @param {string} key - 缓存键
   * @param {string} url - 缩略图URL
   */
  setThumbnail(key, url) {
    if (this.thumbnailCache.size >= this.maxThumbnailCacheSize) {
      this._evictLeastRecentlyUsedThumbnail();
    }
    this.thumbnailCache.set(key, {
      url,
      createdAt: Date.now(),
      lastAccessed: Date.now()
    });
  }
  /**
   * 生成缩略图
   * @param {File|string} source - 图像文件或URL
   * @param {number} maxSize - 最大尺寸
   * @returns {Promise<string>} 缩略图URL
   */
  async generateThumbnail(source, maxSize = CONFIG.IMAGE.THUMBNAIL_SIZE) {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      return new Promise((resolve, reject) => {
        img.onload = () => {
          const { width, height } = this._calculateThumbnailSize(
            img.naturalWidth,
            img.naturalHeight,
            maxSize
          );
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject(new Error("\u7F29\u7565\u56FE\u751F\u6210\u5931\u8D25"));
            }
          }, "image/jpeg", this.compressionQuality);
        };
        img.onerror = () => reject(new Error("\u56FE\u50CF\u52A0\u8F7D\u5931\u8D25"));
        if (source instanceof File) {
          img.src = URL.createObjectURL(source);
        } else {
          img.src = source;
        }
      });
    } catch (error) {
      console.error("\u7F29\u7565\u56FE\u751F\u6210\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 计算缩略图尺寸
   * @param {number} originalWidth - 原始宽度
   * @param {number} originalHeight - 原始高度
   * @param {number} maxSize - 最大尺寸
   * @returns {Object} 缩略图尺寸
   * @private
   */
  _calculateThumbnailSize(originalWidth, originalHeight, maxSize) {
    const aspectRatio = originalWidth / originalHeight;
    let width, height;
    if (originalWidth > originalHeight) {
      width = Math.min(originalWidth, maxSize);
      height = width / aspectRatio;
    } else {
      height = Math.min(originalHeight, maxSize);
      width = height * aspectRatio;
    }
    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }
  /**
   * 估算图像大小
   * @param {string} url - 图像URL
   * @returns {number} 估算大小（字节）
   * @private
   */
  _estimateSize(url) {
    return url.length * 0.75;
  }
  /**
   * 清除最近最少使用的缓存项
   * @private
   */
  _evictLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const item = this.cache.get(oldestKey);
      URL.revokeObjectURL(item.url);
      this.cache.delete(oldestKey);
    }
  }
  /**
   * 清除最近最少使用的缩略图缓存项
   * @private
   */
  _evictLeastRecentlyUsedThumbnail() {
    let oldestKey = null;
    let oldestTime = Date.now();
    for (const [key, item] of this.thumbnailCache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const item = this.thumbnailCache.get(oldestKey);
      URL.revokeObjectURL(item.url);
      this.thumbnailCache.delete(oldestKey);
    }
  }
  /**
   * 清理所有缓存
   */
  clear() {
    for (const item of this.cache.values()) {
      URL.revokeObjectURL(item.url);
    }
    for (const item of this.thumbnailCache.values()) {
      URL.revokeObjectURL(item.url);
    }
    this.cache.clear();
    this.thumbnailCache.clear();
  }
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      thumbnailCacheSize: this.thumbnailCache.size,
      maxCacheSize: this.maxCacheSize,
      maxThumbnailCacheSize: this.maxThumbnailCacheSize,
      totalMemoryUsage: this._calculateTotalMemoryUsage()
    };
  }
  /**
   * 计算总内存使用量
   * @returns {number} 内存使用量（字节）
   * @private
   */
  _calculateTotalMemoryUsage() {
    let total = 0;
    for (const item of this.cache.values()) {
      total += item.size || 0;
    }
    total += this.thumbnailCache.size * 1e4;
    return total;
  }
};
var ImageProcessor = class {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
  }
  /**
   * 压缩图像
   * @param {File} file - 原始图像文件
   * @param {Object} options - 压缩选项
   * @returns {Promise<Blob>} 压缩后的图像Blob
   */
  async compressImage(file, options = {}) {
    const {
      maxWidth = CONFIG.IMAGE.MAX_WIDTH,
      maxHeight = CONFIG.IMAGE.MAX_HEIGHT,
      quality = CONFIG.IMAGE.COMPRESSION_QUALITY,
      format = "image/jpeg"
    } = options;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const { width, height } = this._calculateCompressedSize(
            img.naturalWidth,
            img.naturalHeight,
            maxWidth,
            maxHeight
          );
          this.canvas.width = width;
          this.canvas.height = height;
          this.ctx.drawImage(img, 0, 0, width, height);
          this.canvas.toBlob((blob) => {
            URL.revokeObjectURL(url);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("\u56FE\u50CF\u538B\u7F29\u5931\u8D25"));
            }
          }, format, quality);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("\u56FE\u50CF\u52A0\u8F7D\u5931\u8D25"));
      };
      img.src = url;
    });
  }
  /**
   * 计算压缩后的尺寸
   * @param {number} originalWidth - 原始宽度
   * @param {number} originalHeight - 原始高度
   * @param {number} maxWidth - 最大宽度
   * @param {number} maxHeight - 最大高度
   * @returns {Object} 压缩后的尺寸
   * @private
   */
  _calculateCompressedSize(originalWidth, originalHeight, maxWidth, maxHeight) {
    let { width, height } = { width: originalWidth, height: originalHeight };
    if (width > maxWidth) {
      height = height * maxWidth / width;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = width * maxHeight / height;
      height = maxHeight;
    }
    return {
      width: Math.round(width),
      height: Math.round(height)
    };
  }
  /**
   * 旋转图像
   * @param {HTMLImageElement} img - 图像元素
   * @param {number} degrees - 旋转角度
   * @returns {Promise<string>} 旋转后的图像URL
   */
  async rotateImage(img, degrees) {
    return new Promise((resolve, reject) => {
      try {
        const radians = degrees * Math.PI / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        const newWidth = img.naturalWidth * cos + img.naturalHeight * sin;
        const newHeight = img.naturalWidth * sin + img.naturalHeight * cos;
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        this.ctx.translate(newWidth / 2, newHeight / 2);
        this.ctx.rotate(radians);
        this.ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        this.canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            resolve(url);
          } else {
            reject(new Error("\u56FE\u50CF\u65CB\u8F6C\u5931\u8D25"));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
   * 应用滤镜
   * @param {HTMLImageElement} img - 图像元素
   * @param {string} filter - 滤镜类型
   * @returns {Promise<string>} 处理后的图像URL
   */
  async applyFilter(img, filter) {
    return new Promise((resolve, reject) => {
      try {
        this.canvas.width = img.naturalWidth;
        this.canvas.height = img.naturalHeight;
        this.ctx.filter = this._getFilterCSS(filter);
        this.ctx.drawImage(img, 0, 0);
        this.canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            resolve(url);
          } else {
            reject(new Error("\u6EE4\u955C\u5E94\u7528\u5931\u8D25"));
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  /**
   * 获取滤镜CSS
   * @param {string} filter - 滤镜类型
   * @returns {string} CSS滤镜字符串
   * @private
   */
  _getFilterCSS(filter) {
    const filters = {
      "grayscale": "grayscale(100%)",
      "sepia": "sepia(100%)",
      "blur": "blur(2px)",
      "brightness": "brightness(120%)",
      "contrast": "contrast(120%)",
      "saturate": "saturate(150%)",
      "vintage": "sepia(50%) contrast(120%) brightness(110%)"
    };
    return filters[filter] || "none";
  }
};
var ImageManager = class {
  constructor() {
    this.metadataManager = new ImageMetadataManager();
    this.cacheManager = new ImageCacheManager();
    this.processor = new ImageProcessor();
    this.loadedImages = /* @__PURE__ */ new Map();
    this.loadingPromises = /* @__PURE__ */ new Map();
    this.supportedFormats = CONFIG.IMAGE.SUPPORTED_FORMATS;
    this.isInitialized = false;
    this._bindEvents();
  }
  /**
   * 初始化图片管理器
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }
    try {
      console.log("ImageManager: \u6B63\u5728\u521D\u59CB\u5316\u56FE\u7247\u7BA1\u7406\u5668...");
      this.isInitialized = true;
      console.log("ImageManager: \u56FE\u7247\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5B8C\u6210");
    } catch (error) {
      console.error("ImageManager: \u521D\u59CB\u5316\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 加载图像
   * @param {File|string} source - 图像文件或URL
   * @param {Object} options - 加载选项
   * @returns {Promise<Object>} 图像对象
   */
  async loadImage(source, options = {}) {
    const {
      generateThumbnail = true,
      extractMetadata = true,
      useCache = true,
      priority = "normal"
    } = options;
    try {
      const cacheKey = this._generateCacheKey(source);
      if (useCache && this.loadedImages.has(cacheKey)) {
        return this.loadedImages.get(cacheKey);
      }
      if (this.loadingPromises.has(cacheKey)) {
        return this.loadingPromises.get(cacheKey);
      }
      const loadingPromise = this._loadImageInternal(source, {
        generateThumbnail,
        extractMetadata,
        cacheKey,
        priority
      });
      this.loadingPromises.set(cacheKey, loadingPromise);
      const result = await loadingPromise;
      if (useCache) {
        this.loadedImages.set(cacheKey, result);
      }
      this.loadingPromises.delete(cacheKey);
      return result;
    } catch (error) {
      console.error("\u56FE\u50CF\u52A0\u8F7D\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 内部图像加载方法
   * @param {File|string} source - 图像源
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 图像对象
   * @private
   */
  async _loadImageInternal(source, options) {
    const { generateThumbnail, extractMetadata, cacheKey, priority } = options;
    eventManager_default.emitImageLoading({
      cacheKey,
      source: source instanceof File ? source.name : source,
      priority
    });
    const imageObj = {
      id: StringUtils.generateId(),
      cacheKey,
      source,
      url: null,
      thumbnailUrl: null,
      metadata: null,
      element: null,
      loadedAt: /* @__PURE__ */ new Date(),
      error: null
    };
    try {
      if (source instanceof File) {
        imageObj.url = URL.createObjectURL(source);
      } else {
        imageObj.url = source;
      }
      imageObj.element = await this._createImageElement(imageObj.url);
      const tasks = [];
      if (extractMetadata && source instanceof File) {
        tasks.push(
          this.metadataManager.extractMetadata(source).then((metadata) => {
            imageObj.metadata = metadata;
          }).catch((error) => {
            console.warn("\u5143\u6570\u636E\u63D0\u53D6\u5931\u8D25:", error);
            imageObj.metadata = this.metadataManager._createFallbackMetadata(source);
          })
        );
      }
      if (generateThumbnail) {
        tasks.push(
          this.cacheManager.generateThumbnail(source).then((thumbnailUrl) => {
            imageObj.thumbnailUrl = thumbnailUrl;
            this.cacheManager.setThumbnail(cacheKey, thumbnailUrl);
          }).catch((error) => {
            console.warn("\u7F29\u7565\u56FE\u751F\u6210\u5931\u8D25:", error);
          })
        );
      }
      await Promise.allSettled(tasks);
      this.cacheManager.set(cacheKey, imageObj.url, imageObj.metadata);
      eventManager_default.emitImageLoaded({
        imageObj,
        loadTime: Date.now() - imageObj.loadedAt.getTime()
      });
      return imageObj;
    } catch (error) {
      imageObj.error = error;
      eventManager_default.emit("image:load-failed", {
        cacheKey,
        error: error.message
      });
      throw error;
    }
  }
  /**
   * 创建图像元素
   * @param {string} url - 图像URL
   * @returns {Promise<HTMLImageElement>} 图像元素
   * @private
   */
  _createImageElement(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("\u56FE\u50CF\u52A0\u8F7D\u5931\u8D25"));
      img.src = url;
    });
  }
  /**
   * 生成缓存键
   * @param {File|string} source - 图像源
   * @returns {string} 缓存键
   * @private
   */
  _generateCacheKey(source) {
    if (source instanceof File) {
      return `file:${source.name}:${source.size}:${source.lastModified}`;
    }
    return `url:${StringUtils.hash(source)}`;
  }
  /**
   * 批量加载图像
   * @param {Array} sources - 图像源数组
   * @param {Object} options - 加载选项
   * @returns {Promise<Array>} 图像对象数组
   */
  async loadImages(sources, options = {}) {
    const {
      concurrency = CONFIG.IMAGE.CONCURRENT_LOADS,
      onProgress = null
    } = options;
    const results = [];
    let completed = 0;
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(async (source) => {
        try {
          const result = await this.loadImage(source, options);
          completed++;
          if (onProgress) {
            onProgress({
              completed,
              total: sources.length,
              percentage: completed / sources.length * 100
            });
          }
          return result;
        } catch (error) {
          completed++;
          console.error("\u6279\u91CF\u52A0\u8F7D\u4E2D\u7684\u56FE\u50CF\u5931\u8D25:", error);
          return null;
        }
      });
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map((r) => r.status === "fulfilled" ? r.value : null));
    }
    return results.filter(Boolean);
  }
  /**
   * 验证图像文件
   * @param {File} file - 图像文件
   * @returns {Object} 验证结果
   */
  validateImageFile(file) {
    const errors = [];
    if (!this.supportedFormats.includes(file.type)) {
      errors.push(`\u4E0D\u652F\u6301\u7684\u6587\u4EF6\u683C\u5F0F: ${file.type}`);
    }
    if (file.size > CONFIG.IMAGE.MAX_FILE_SIZE) {
      errors.push(`\u6587\u4EF6\u8FC7\u5927: ${FileUtils.formatSize(file.size)} > ${FileUtils.formatSize(CONFIG.IMAGE.MAX_FILE_SIZE)}`);
    }
    if (file.size === 0) {
      errors.push("\u6587\u4EF6\u4E3A\u7A7A");
    }
    return {
      valid: errors.length === 0,
      errors
    };
  }
  /**
   * 获取图像信息
   * @param {string} cacheKey - 缓存键
   * @returns {Object|null} 图像信息
   */
  getImageInfo(cacheKey) {
    return this.loadedImages.get(cacheKey) || null;
  }
  /**
   * 移除图像
   * @param {string} cacheKey - 缓存键
   */
  removeImage(cacheKey) {
    const imageObj = this.loadedImages.get(cacheKey);
    if (imageObj) {
      if (imageObj.url && imageObj.source instanceof File) {
        URL.revokeObjectURL(imageObj.url);
      }
      if (imageObj.thumbnailUrl) {
        URL.revokeObjectURL(imageObj.thumbnailUrl);
      }
      this.loadedImages.delete(cacheKey);
    }
  }
  /**
   * 清理所有图像
   */
  clear() {
    for (const imageObj of this.loadedImages.values()) {
      if (imageObj.url && imageObj.source instanceof File) {
        URL.revokeObjectURL(imageObj.url);
      }
      if (imageObj.thumbnailUrl) {
        URL.revokeObjectURL(imageObj.thumbnailUrl);
      }
    }
    this.loadedImages.clear();
    this.loadingPromises.clear();
    this.cacheManager.clear();
  }
  /**
   * 获取所有已加载的图片
   * @returns {Promise<Array>} 图片对象数组
   */
  async getAllImages() {
    const images = Array.from(this.loadedImages.values());
    if (images.length === 0) {
      console.log("ImageManager: \u5F53\u524D\u6CA1\u6709\u5DF2\u52A0\u8F7D\u7684\u56FE\u7247");
      return [];
    }
    return images;
  }
  /**
   * 获取管理器统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      loadedImages: this.loadedImages.size,
      loadingImages: this.loadingPromises.size,
      cacheStats: this.cacheManager.getStats(),
      supportedFormats: this.supportedFormats
    };
  }
  /**
   * 绑定事件监听器
   * @private
   */
  _bindEvents() {
    window.addEventListener("beforeunload", () => {
      this.clear();
    });
    if ("memory" in performance) {
      setInterval(() => {
        const memInfo = performance.memory;
        const usageRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        if (usageRatio > 0.8) {
          console.warn("\u5185\u5B58\u4F7F\u7528\u7387\u8FC7\u9AD8\uFF0C\u6E05\u7406\u56FE\u50CF\u7F13\u5B58");
          this._cleanupMemory();
        }
      }, 3e4);
    }
  }
  /**
   * 清理内存
   * @private
   */
  _cleanupMemory() {
    const images = Array.from(this.loadedImages.entries()).sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    const toRemove = images.slice(0, Math.floor(images.length * 0.5));
    for (const [cacheKey] of toRemove) {
      this.removeImage(cacheKey);
    }
    this.cacheManager.clear();
    console.log(`\u5DF2\u6E05\u7406 ${toRemove.length} \u4E2A\u56FE\u50CF\u4EE5\u91CA\u653E\u5185\u5B58`);
  }
};
var imageManager = new ImageManager();
var imageManager_default = imageManager;

// src/js/aiEngine.js
var TensorFlowModelManager = class {
  constructor() {
    this.models = {};
    this.loadingProgress = 0;
    this.isLoaded = false;
    this.loadingPromise = null;
    this.retryCount = 0;
    this.maxRetries = CONFIG.GITHUB.RETRY_COUNT;
  }
  /**
   * 加载所有模型
   * @returns {Promise<boolean>} 是否成功加载
   */
  async loadModels() {
    try {
      this.isLoading = true;
      this.loadingProgress = 0;
      console.log("\u5F00\u59CB\u52A0\u8F7DAI\u6A21\u578B...");
      const [mobileNetSuccess, cocoSsdSuccess] = await Promise.all([
        this._loadMobileNet().then((success) => {
          this.loadingProgress += 50;
          eventManager_default.emit("ai:model-progress", { progress: this.loadingProgress });
          return success;
        }),
        this._loadCocoSsd().then((success) => {
          this.loadingProgress += 50;
          eventManager_default.emit("ai:model-progress", { progress: this.loadingProgress });
          return success;
        })
      ]);
      this.isLoading = false;
      this.loadingProgress = 100;
      const overallSuccess = mobileNetSuccess || cocoSsdSuccess;
      if (overallSuccess) {
        console.log("AI\u6A21\u578B\u52A0\u8F7D\u5B8C\u6210 (MobileNet:", mobileNetSuccess, ", COCO-SSD:", cocoSsdSuccess, ")");
        eventManager_default.emit("ai:models-loaded");
      } else {
        console.warn("\u6240\u6709AI\u6A21\u578B\u52A0\u8F7D\u5931\u8D25");
        eventManager_default.emit("ai:models-error", { error: "\u6240\u6709\u6A21\u578B\u52A0\u8F7D\u5931\u8D25" });
      }
      return overallSuccess;
    } catch (error) {
      this.isLoading = false;
      this.loadingProgress = 0;
      console.warn("AI\u6A21\u578B\u52A0\u8F7D\u5F02\u5E38:", error.message);
      eventManager_default.emit("ai:models-error", { error: error.message });
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`\u6B63\u5728\u91CD\u8BD5\u52A0\u8F7D\u6A21\u578B (${this.retryCount}/${this.maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, 2e3));
        return this.loadModels();
      }
      return false;
    }
  }
  /**
   * 内部模型加载方法
   * @returns {Promise<boolean>} 是否加载成功
   * @private
   */
  async _loadModelsInternal() {
    try {
      this.updateProgress(0, "\u5F00\u59CB\u52A0\u8F7DAI\u6A21\u578B...");
      if (typeof tf === "undefined") {
        throw new Error("TensorFlow.js\u672A\u52A0\u8F7D");
      }
      this.updateProgress(20, "\u6B63\u5728\u52A0\u8F7DMobileNet\u5206\u7C7B\u6A21\u578B...");
      await this._loadMobileNet();
      this.updateProgress(60, "\u6B63\u5728\u52A0\u8F7DCOCO-SSD\u68C0\u6D4B\u6A21\u578B...");
      await this._loadCocoSsd();
      this.updateProgress(100, "\u6240\u6709\u6A21\u578B\u52A0\u8F7D\u5B8C\u6210\uFF01");
      this.isLoaded = true;
      eventManager_default.emit("ai:models-loaded", {
        models: Object.keys(this.models),
        loadTime: Date.now()
      });
      return true;
    } catch (error) {
      console.error("AI\u6A21\u578B\u52A0\u8F7D\u5931\u8D25:", error);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.updateProgress(0, `\u52A0\u8F7D\u5931\u8D25\uFF0C\u6B63\u5728\u91CD\u8BD5 (${this.retryCount}/${this.maxRetries})...`);
        await AsyncUtils.delay(2e3);
        return this._loadModelsInternal();
      }
      this.updateProgress(0, ERROR_MESSAGES.MODEL_LOAD_FAILED);
      eventManager_default.emit("ai:models-load-failed", {
        error: error.message,
        retryCount: this.retryCount
      });
      return false;
    }
  }
  /**
   * 加载MobileNet模型
   * @private
   */
  async _loadMobileNet() {
    try {
      if (typeof mobilenet === "undefined") {
        console.warn("MobileNet\u5E93\u672A\u52A0\u8F7D\uFF0C\u8DF3\u8FC7\u6A21\u578B\u52A0\u8F7D");
        return false;
      }
      this.models.mobilenet = await mobilenet.load({
        version: 2,
        alpha: 1
      });
      console.log("MobileNet\u6A21\u578B\u52A0\u8F7D\u6210\u529F");
      return true;
    } catch (error) {
      console.warn("MobileNet\u6A21\u578B\u52A0\u8F7D\u5931\u8D25:", error.message);
      return false;
    }
  }
  /**
   * 加载COCO-SSD模型
   * @private
   */
  async _loadCocoSsd() {
    try {
      if (typeof cocoSsd === "undefined") {
        console.warn("COCO-SSD\u5E93\u672A\u52A0\u8F7D\uFF0C\u8DF3\u8FC7\u6A21\u578B\u52A0\u8F7D");
        return false;
      }
      this.models.cocoSsd = await cocoSsd.load({
        base: "mobilenet_v2"
      });
      console.log("COCO-SSD\u6A21\u578B\u52A0\u8F7D\u6210\u529F");
      return true;
    } catch (error) {
      console.warn("COCO-SSD\u6A21\u578B\u52A0\u8F7D\u5931\u8D25:", error.message);
      return false;
    }
  }
  /**
   * 更新加载进度
   * @param {number} percentage - 进度百分比
   * @param {string} message - 进度消息
   */
  updateProgress(percentage, message) {
    this.loadingProgress = percentage;
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.querySelector("#model-loading-progress p");
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    if (progressText) {
      progressText.textContent = message;
    }
    eventManager_default.emit("ai:loading-progress", {
      percentage,
      message
    });
  }
  /**
   * 使用MobileNet进行图像分类
   * @param {HTMLImageElement} imageElement - 图像元素
   * @returns {Promise<Array>} 分类结果
   */
  async classifyImage(imageElement) {
    if (!this.models.mobilenet) {
      throw new Error("MobileNet\u6A21\u578B\u672A\u52A0\u8F7D");
    }
    try {
      const predictions = await this.models.mobilenet.classify(imageElement, 5);
      return predictions.map((pred) => ({
        label: pred.className,
        confidence: pred.probability,
        category: "classification",
        source: "mobilenet"
      }));
    } catch (error) {
      console.error("\u56FE\u50CF\u5206\u7C7B\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 使用COCO-SSD进行物体检测
   * @param {HTMLImageElement} imageElement - 图像元素
   * @returns {Promise<Array>} 检测结果
   */
  async detectObjects(imageElement) {
    if (!this.models.cocoSsd) {
      throw new Error("COCO-SSD\u6A21\u578B\u672A\u52A0\u8F7D");
    }
    try {
      const predictions = await this.models.cocoSsd.detect(imageElement, 10);
      return predictions.map((pred) => ({
        label: pred.class,
        confidence: pred.score,
        category: "detection",
        bbox: pred.bbox,
        source: "coco-ssd"
      }));
    } catch (error) {
      console.error("\u7269\u4F53\u68C0\u6D4B\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 获取模型信息
   * @returns {Object} 模型信息
   */
  getModelInfo() {
    return {
      isLoaded: this.isLoaded,
      loadingProgress: this.loadingProgress,
      availableModels: Object.keys(this.models),
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  }
  /**
   * 释放模型资源
   */
  dispose() {
    for (const [name, model] of Object.entries(this.models)) {
      if (model && typeof model.dispose === "function") {
        model.dispose();
        console.log(`\u5DF2\u91CA\u653E\u6A21\u578B: ${name}`);
      }
    }
    this.models = {};
    this.isLoaded = false;
    this.loadingPromise = null;
  }
};
var EnhancedAIEngine = class {
  constructor() {
    this.analysisCache = /* @__PURE__ */ new Map();
    this.analysisQueue = [];
    this.isProcessing = false;
    this.workers = CONFIG.AI.WORKER_COUNT;
    this.tensorflowManager = new TensorFlowModelManager();
    this.confidenceThreshold = CONFIG.AI.CONFIDENCE_THRESHOLD;
    this.maxCacheSize = CONFIG.AI.MAX_CACHE_SIZE;
    this._bindEvents();
  }
  /**
   * 初始化AI引擎
   * @returns {Promise<boolean>} 是否初始化成功
   */
  async initialize() {
    try {
      console.log("\u{1F916} \u5F00\u59CB\u521D\u59CB\u5316AI\u5F15\u64CE...");
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("AI\u5F15\u64CE\u521D\u59CB\u5316\u8D85\u65F6\uFF0810\u79D2\uFF09"));
        }, 1e4);
      });
      if (typeof tf === "undefined") {
        console.warn("TensorFlow.js\u5E93\u672A\u52A0\u8F7D\uFF0C\u8DF3\u8FC7AI\u529F\u80FD\u521D\u59CB\u5316");
        eventManager_default.emit("ai:engine-fallback", {
          error: "TensorFlow.js\u5E93\u672A\u52A0\u8F7D",
          timestamp: Date.now()
        });
        return false;
      }
      const success = await Promise.race([
        this.tensorflowManager.loadModels(),
        timeoutPromise
      ]);
      if (success) {
        console.log("\u2705 AI\u5F15\u64CE\u521D\u59CB\u5316\u6210\u529F");
        eventManager_default.emit("ai:engine-ready");
      } else {
        console.warn("\u26A0\uFE0F AI\u5F15\u64CE\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u5C06\u4F7F\u7528\u57FA\u7840\u6A21\u5F0F");
        eventManager_default.emit("ai:engine-fallback");
      }
      return success;
    } catch (error) {
      console.warn("\u26A0\uFE0F AI\u5F15\u64CE\u521D\u59CB\u5316\u5931\u8D25:", error.message);
      console.log("\u{1F504} \u5E94\u7528\u5C06\u7EE7\u7EED\u8FD0\u884C\uFF0C\u4F46AI\u529F\u80FD\u5C06\u4E0D\u53EF\u7528");
      eventManager_default.emit("ai:engine-fallback", {
        error: error.message,
        timestamp: Date.now()
      });
      return false;
    }
  }
  /**
   * 分析图像
   * @param {Object} imageFile - 图像文件对象
   * @param {HTMLImageElement} imageElement - 图像DOM元素
   * @param {string} priority - 优先级 ('high', 'normal', 'low')
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeImage(imageFile, imageElement, priority = "normal") {
    const cacheKey = this._generateCacheKey(imageFile, imageElement);
    if (this.analysisCache.has(cacheKey)) {
      const cached = this.analysisCache.get(cacheKey);
      console.log("\u4F7F\u7528\u7F13\u5B58\u7684\u5206\u6790\u7ED3\u679C:", cacheKey);
      return cached;
    }
    return new Promise((resolve, reject) => {
      const task = {
        imageFile,
        imageElement,
        cacheKey,
        priority,
        resolve,
        reject,
        timestamp: Date.now()
      };
      this._insertTaskByPriority(task);
      this._processQueue();
    });
  }
  /**
   * 处理分析队列
   * @private
   */
  async _processQueue() {
    if (this.isProcessing || this.analysisQueue.length === 0) {
      return;
    }
    this.isProcessing = true;
    try {
      const tasks = this.analysisQueue.splice(0, this.workers);
      const promises = tasks.map((task) => this._processTask(task));
      await Promise.allSettled(promises);
      if (this.analysisQueue.length > 0) {
        setTimeout(() => {
          this.isProcessing = false;
          this._processQueue();
        }, 100);
      } else {
        this.isProcessing = false;
      }
    } catch (error) {
      console.error("\u961F\u5217\u5904\u7406\u9519\u8BEF:", error);
      this.isProcessing = false;
    }
  }
  /**
   * 处理单个分析任务
   * @param {Object} task - 分析任务
   * @private
   */
  async _processTask(task) {
    const { imageFile, imageElement, cacheKey, resolve, reject } = task;
    try {
      const startTime = Date.now();
      const result = await this._performAnalysis(imageElement);
      const processedResult = this._postProcessResult(result, imageFile);
      this._cacheResult(cacheKey, processedResult);
      const analysisTime = Date.now() - startTime;
      processedResult.analysisTime = analysisTime;
      console.log(`\u56FE\u50CF\u5206\u6790\u5B8C\u6210: ${cacheKey}, \u8017\u65F6: ${analysisTime}ms`);
      eventManager_default.emitImageAnalyzed({
        cacheKey,
        result: processedResult,
        analysisTime
      });
      resolve(processedResult);
    } catch (error) {
      console.error("\u56FE\u50CF\u5206\u6790\u5931\u8D25:", error);
      const fallbackResult = this._createFallbackResult(imageFile, error);
      resolve(fallbackResult);
    }
  }
  /**
   * 执行AI分析
   * @param {HTMLImageElement} imageElement - 图像元素
   * @returns {Promise<Object>} 原始分析结果
   * @private
   */
  async _performAnalysis(imageElement) {
    const results = {
      classifications: [],
      detections: [],
      metadata: {
        timestamp: Date.now(),
        imageSize: {
          width: imageElement.naturalWidth,
          height: imageElement.naturalHeight
        }
      }
    };
    const tasks = [];
    if (this.tensorflowManager.models.mobilenet) {
      tasks.push(
        this.tensorflowManager.classifyImage(imageElement).then((classifications) => {
          results.classifications = classifications;
        }).catch((error) => {
          console.warn("\u56FE\u50CF\u5206\u7C7B\u5931\u8D25:", error);
        })
      );
    }
    if (this.tensorflowManager.models.cocoSsd) {
      tasks.push(
        this.tensorflowManager.detectObjects(imageElement).then((detections) => {
          results.detections = detections;
        }).catch((error) => {
          console.warn("\u7269\u4F53\u68C0\u6D4B\u5931\u8D25:", error);
        })
      );
    }
    await Promise.allSettled(tasks);
    return results;
  }
  /**
   * 后处理分析结果
   * @param {Object} rawResult - 原始分析结果
   * @param {Object} imageFile - 图像文件
   * @returns {Object} 处理后的结果
   * @private
   */
  _postProcessResult(rawResult, imageFile) {
    const { classifications, detections, metadata } = rawResult;
    const filteredClassifications = classifications.filter(
      (item) => item.confidence >= this.confidenceThreshold
    );
    const filteredDetections = detections.filter(
      (item) => item.confidence >= this.confidenceThreshold
    );
    const smartTags = this._generateSmartTags(filteredClassifications, filteredDetections);
    const overallConfidence = this._calculateOverallConfidence(
      filteredClassifications,
      filteredDetections
    );
    const description = this._generateDescription(filteredClassifications, filteredDetections);
    const features = this._analyzeImageFeatures(metadata.imageSize, smartTags);
    return {
      confidence: overallConfidence,
      smartTags,
      description,
      features,
      classifications: filteredClassifications,
      detections: filteredDetections,
      metadata: {
        ...metadata,
        fileName: imageFile?.name,
        fileSize: imageFile?.size,
        processingVersion: "1.0.0"
      }
    };
  }
  /**
   * 生成智能标签
   * @param {Array} classifications - 分类结果
   * @param {Array} detections - 检测结果
   * @returns {Array} 智能标签
   * @private
   */
  _generateSmartTags(classifications, detections) {
    const tags = /* @__PURE__ */ new Set();
    classifications.forEach((item) => {
      const cleanLabel = this._cleanLabel(item.label);
      if (cleanLabel) tags.add(cleanLabel);
    });
    detections.forEach((item) => {
      const cleanLabel = this._cleanLabel(item.label);
      if (cleanLabel) tags.add(cleanLabel);
    });
    const combinedTags = this._generateCombinedTags(Array.from(tags));
    combinedTags.forEach((tag) => tags.add(tag));
    return Array.from(tags).slice(0, 10);
  }
  /**
   * 清理标签文本
   * @param {string} label - 原始标签
   * @returns {string} 清理后的标签
   * @private
   */
  _cleanLabel(label) {
    if (!label) return "";
    let cleaned = label.replace(/[^a-zA-Z\u4e00-\u9fa5\s]/g, "");
    const translations = {
      "person": "\u4EBA\u7269",
      "car": "\u6C7D\u8F66",
      "dog": "\u72D7",
      "cat": "\u732B",
      "bird": "\u9E1F",
      "flower": "\u82B1\u6735",
      "tree": "\u6811\u6728",
      "building": "\u5EFA\u7B51",
      "food": "\u98DF\u7269",
      "animal": "\u52A8\u7269",
      "nature": "\u81EA\u7136",
      "landscape": "\u98CE\u666F",
      "portrait": "\u8096\u50CF",
      "indoor": "\u5BA4\u5185",
      "outdoor": "\u6237\u5916"
    };
    const lowerLabel = cleaned.toLowerCase();
    for (const [en, zh] of Object.entries(translations)) {
      if (lowerLabel.includes(en)) {
        return zh;
      }
    }
    return cleaned.trim();
  }
  /**
   * 生成组合标签
   * @param {Array} tags - 基础标签
   * @returns {Array} 组合标签
   * @private
   */
  _generateCombinedTags(tags) {
    const combined = [];
    if (tags.includes("\u4EBA\u7269") && tags.includes("\u6237\u5916")) {
      combined.push("\u6237\u5916\u4EBA\u50CF");
    }
    if (tags.includes("\u52A8\u7269") && tags.includes("\u81EA\u7136")) {
      combined.push("\u91CE\u751F\u52A8\u7269");
    }
    if (tags.includes("\u5EFA\u7B51") && tags.includes("\u98CE\u666F")) {
      combined.push("\u57CE\u5E02\u98CE\u5149");
    }
    return combined;
  }
  /**
   * 计算总体置信度
   * @param {Array} classifications - 分类结果
   * @param {Array} detections - 检测结果
   * @returns {number} 总体置信度
   * @private
   */
  _calculateOverallConfidence(classifications, detections) {
    const allResults = [...classifications, ...detections];
    if (allResults.length === 0) return 0;
    const weightedSum = allResults.reduce((sum, item, index) => {
      const weight = Math.exp(-index * 0.1);
      return sum + item.confidence * weight;
    }, 0);
    const totalWeight = allResults.reduce((sum, _, index) => {
      return sum + Math.exp(-index * 0.1);
    }, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
  /**
   * 生成图像描述
   * @param {Array} classifications - 分类结果
   * @param {Array} detections - 检测结果
   * @returns {string} 图像描述
   * @private
   */
  _generateDescription(classifications, detections) {
    const descriptions = [];
    if (classifications.length > 0) {
      const topClass = classifications[0];
      descriptions.push(`\u8FD9\u662F\u4E00\u5F20\u5173\u4E8E${this._cleanLabel(topClass.label)}\u7684\u56FE\u7247`);
    }
    if (detections.length > 0) {
      const objectCounts = {};
      detections.forEach((detection) => {
        const label = this._cleanLabel(detection.label);
        objectCounts[label] = (objectCounts[label] || 0) + 1;
      });
      const objectList = Object.entries(objectCounts).map(([label, count]) => count > 1 ? `${count}\u4E2A${label}` : label).slice(0, 3).join("\u3001");
      if (objectList) {
        descriptions.push(`\u56FE\u4E2D\u5305\u542B${objectList}`);
      }
    }
    return descriptions.join("\uFF0C") || "\u8FD9\u662F\u4E00\u5F20\u56FE\u7247";
  }
  /**
   * 分析图像特征
   * @param {Object} imageSize - 图像尺寸
   * @param {Array} tags - 标签
   * @returns {Object} 图像特征
   * @private
   */
  _analyzeImageFeatures(imageSize, tags) {
    const { width, height } = imageSize;
    const aspectRatio = width / height;
    return {
      aspectRatio,
      orientation: aspectRatio > 1.2 ? "landscape" : aspectRatio < 0.8 ? "portrait" : "square",
      resolution: width * height,
      category: this._categorizeImage(tags),
      complexity: this._calculateComplexity(tags)
    };
  }
  /**
   * 图像分类
   * @param {Array} tags - 标签
   * @returns {string} 图像类别
   * @private
   */
  _categorizeImage(tags) {
    const categories = {
      "\u4EBA\u7269": ["\u4EBA\u7269", "\u8096\u50CF", "\u6237\u5916\u4EBA\u50CF"],
      "\u52A8\u7269": ["\u52A8\u7269", "\u72D7", "\u732B", "\u9E1F", "\u91CE\u751F\u52A8\u7269"],
      "\u98CE\u666F": ["\u98CE\u666F", "\u81EA\u7136", "\u6811\u6728", "\u6237\u5916", "\u57CE\u5E02\u98CE\u5149"],
      "\u5EFA\u7B51": ["\u5EFA\u7B51", "\u57CE\u5E02\u98CE\u5149"],
      "\u98DF\u7269": ["\u98DF\u7269"],
      "\u5176\u4ED6": []
    };
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((keyword) => tags.includes(keyword))) {
        return category;
      }
    }
    return "\u5176\u4ED6";
  }
  /**
   * 计算图像复杂度
   * @param {Array} tags - 标签
   * @returns {number} 复杂度分数 (0-1)
   * @private
   */
  _calculateComplexity(tags) {
    const tagCount = tags.length;
    const uniqueCategories = new Set(tags.map((tag) => this._categorizeImage([tag]))).size;
    const countScore = Math.min(tagCount / 10, 1);
    const diversityScore = Math.min(uniqueCategories / 5, 1);
    return (countScore + diversityScore) / 2;
  }
  /**
   * 创建备用分析结果
   * @param {Object} imageFile - 图像文件
   * @param {Error} error - 错误对象
   * @returns {Object} 备用结果
   * @private
   */
  _createFallbackResult(imageFile, error) {
    return {
      confidence: 0,
      smartTags: ["\u56FE\u7247"],
      description: "\u65E0\u6CD5\u5206\u6790\u6B64\u56FE\u7247",
      features: {
        aspectRatio: 1,
        orientation: "unknown",
        resolution: 0,
        category: "\u5176\u4ED6",
        complexity: 0
      },
      classifications: [],
      detections: [],
      metadata: {
        timestamp: Date.now(),
        fileName: imageFile?.name,
        fileSize: imageFile?.size,
        error: error.message,
        fallback: true
      }
    };
  }
  /**
   * 生成缓存键
   * @param {Object} imageFile - 图像文件
   * @param {HTMLImageElement} imageElement - 图像元素
   * @returns {string} 缓存键
   * @private
   */
  _generateCacheKey(imageFile, imageElement) {
    if (imageFile?.name) {
      return `file:${imageFile.name}:${imageFile.size}`;
    }
    return `url:${StringUtils.generateId()}`;
  }
  /**
   * 缓存分析结果
   * @param {string} key - 缓存键
   * @param {Object} result - 分析结果
   * @private
   */
  _cacheResult(key, result) {
    if (this.analysisCache.size >= this.maxCacheSize) {
      const oldestKey = this.analysisCache.keys().next().value;
      this.analysisCache.delete(oldestKey);
    }
    this.analysisCache.set(key, result);
    storageManager_default.specializedStorage.aiCache.set(key, result);
  }
  /**
   * 按优先级插入任务
   * @param {Object} task - 分析任务
   * @private
   */
  _insertTaskByPriority(task) {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    const taskPriority = priorityOrder[task.priority] || 2;
    let insertIndex = this.analysisQueue.length;
    for (let i = 0; i < this.analysisQueue.length; i++) {
      const queuePriority = priorityOrder[this.analysisQueue[i].priority] || 2;
      if (taskPriority > queuePriority) {
        insertIndex = i;
        break;
      }
    }
    this.analysisQueue.splice(insertIndex, 0, task);
  }
  /**
   * 绑定事件监听器
   * @private
   */
  _bindEvents() {
    window.addEventListener("beforeunload", () => {
      this.dispose();
    });
  }
  /**
   * 获取分析统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      cacheSize: this.analysisCache.size,
      queueLength: this.analysisQueue.length,
      isProcessing: this.isProcessing,
      modelInfo: this.tensorflowManager.getModelInfo(),
      confidenceThreshold: this.confidenceThreshold
    };
  }
  /**
   * 清理缓存
   */
  clearCache() {
    this.analysisCache.clear();
    storageManager_default.specializedStorage.aiCache.clear();
    console.log("AI\u5206\u6790\u7F13\u5B58\u5DF2\u6E05\u7406");
  }
  /**
   * 设置置信度阈值
   * @param {number} threshold - 置信度阈值 (0-1)
   */
  setConfidenceThreshold(threshold) {
    this.confidenceThreshold = MathUtils.clamp(threshold, 0, 1);
    console.log(`\u7F6E\u4FE1\u5EA6\u9608\u503C\u5DF2\u8BBE\u7F6E\u4E3A: ${this.confidenceThreshold}`);
  }
  /**
   * 释放资源
   */
  dispose() {
    this.tensorflowManager.dispose();
    this.analysisCache.clear();
    this.analysisQueue.length = 0;
    this.isProcessing = false;
    console.log("AI\u5F15\u64CE\u8D44\u6E90\u5DF2\u91CA\u653E");
  }
};
var aiEngine = new EnhancedAIEngine();
var aiEngine_default = aiEngine;

// src/js/galleryManager.js
var SearchEngine = class {
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
    this._addToHistory(query);
    const scoredImages = images.map((image) => ({
      ...image,
      searchScore: this._calculateSearchScore(image, searchTerms, options)
    }));
    const filteredImages = scoredImages.filter((image) => image.searchScore > 0).sort((a, b) => b.searchScore - a.searchScore);
    eventManager_default.emit("gallery:search-performed", {
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
    searchTerms.forEach((term) => {
      if (image.name && image.name.toLowerCase().includes(term)) {
        score += weights.filename;
      }
      if (image.aiTags) {
        const tagMatches = image.aiTags.filter(
          (tag) => tag.label.toLowerCase().includes(term)
        );
        tagMatches.forEach((tag) => {
          score += weights.aiTags * tag.confidence;
        });
      }
      if (image.customTags) {
        const customTagMatches = image.customTags.filter(
          (tag) => tag.toLowerCase().includes(term)
        );
        score += customTagMatches.length * weights.customTags;
      }
      if (image.notes && image.notes.toLowerCase().includes(term)) {
        score += weights.notes;
      }
      if (image.aiDescription && image.aiDescription.toLowerCase().includes(term)) {
        score += weights.aiDescription;
      }
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
    const phrases = query.match(/"([^"]+)"/g) || [];
    const phrasesContent = phrases.map((phrase) => phrase.slice(1, -1));
    let remainingQuery = query;
    phrases.forEach((phrase) => {
      remainingQuery = remainingQuery.replace(phrase, "");
    });
    const words = remainingQuery.split(/\s+/).filter((word) => word.length > 0);
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
    this.searchHistory = this.searchHistory.filter((item) => item.query !== trimmedQuery);
    this.searchHistory.unshift({
      query: trimmedQuery,
      timestamp: Date.now(),
      count: 1
    });
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
      return this.searchHistory.slice(0, 5).map((item) => item.query);
    }
    const normalizedPartial = partial.toLowerCase();
    return this.searchHistory.filter((item) => item.query.toLowerCase().includes(normalizedPartial)).slice(0, 5).map((item) => item.query);
  }
  /**
   * 清除搜索历史
   */
  clearHistory() {
    this.searchHistory = [];
    this._saveSearchHistory();
    eventManager_default.emit("gallery:search-history-cleared", {
      timestamp: Date.now()
    });
  }
  /**
   * 加载搜索历史
   * @private
   */
  _loadSearchHistory() {
    try {
      const history = storageManager_default.specializedStorage.userPreferences.get("searchHistory");
      if (history && Array.isArray(history)) {
        this.searchHistory = history;
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u641C\u7D22\u5386\u53F2\u5931\u8D25:", error);
    }
  }
  /**
   * 保存搜索历史
   * @private
   */
  _saveSearchHistory() {
    try {
      storageManager_default.specializedStorage.userPreferences.set("searchHistory", this.searchHistory);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u641C\u7D22\u5386\u53F2\u5931\u8D25:", error);
    }
  }
};
var FilterManager = class {
  constructor() {
    this.activeFilters = /* @__PURE__ */ new Map();
    this.filterDefinitions = CONFIG.UI.FILTERS;
    this._initializeFilters();
  }
  /**
   * 设置过滤器
   * @param {string} filterType - 过滤器类型
   * @param {*} value - 过滤器值
   */
  setFilter(filterType, value) {
    if (value === null || value === void 0 || value === "") {
      this.activeFilters.delete(filterType);
    } else {
      this.activeFilters.set(filterType, value);
    }
    eventManager_default.emit("gallery:filter-changed", {
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
    eventManager_default.emit("gallery:filters-cleared", {
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
    return images.filter((image) => {
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
      case "dateRange":
        return this._filterByDateRange(image, value);
      case "fileType":
        return this._filterByFileType(image, value);
      case "fileSize":
        return this._filterByFileSize(image, value);
      case "hasAITags":
        return this._filterByAITags(image, value);
      case "hasCustomTags":
        return this._filterByCustomTags(image, value);
      case "hasNotes":
        return this._filterByNotes(image, value);
      case "confidence":
        return this._filterByConfidence(image, value);
      case "dimensions":
        return this._filterByDimensions(image, value);
      case "orientation":
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
    if (fileType === "all") return true;
    const imageType = image.type || "";
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
    if (orientation === "all") return true;
    const { width, height } = image;
    const imageOrientation = width > height ? "landscape" : width < height ? "portrait" : "square";
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
    images.forEach((image) => {
      const fileType = image.type || "unknown";
      stats.fileTypes[fileType] = (stats.fileTypes[fileType] || 0) + 1;
      const { width, height } = image;
      if (width > height) stats.orientations.landscape++;
      else if (width < height) stats.orientations.portrait++;
      else stats.orientations.square++;
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
      if (image.size) {
        stats.sizeRange.min = Math.min(stats.sizeRange.min, image.size);
        stats.sizeRange.max = Math.max(stats.sizeRange.max, image.size);
      }
      const imageDate = image.uploadTime || image.lastModified;
      if (imageDate) {
        stats.dateRange.earliest = Math.min(stats.dateRange.earliest, imageDate);
        stats.dateRange.latest = Math.max(stats.dateRange.latest, imageDate);
      }
    });
    if (confidenceCount > 0) {
      stats.avgConfidence = totalConfidence / confidenceCount;
    }
    if (stats.sizeRange.min === Infinity) stats.sizeRange.min = 0;
    if (stats.dateRange.earliest === Infinity) stats.dateRange.earliest = 0;
    return stats;
  }
  /**
   * 初始化过滤器
   * @private
   */
  _initializeFilters() {
    try {
      const savedFilters = storageManager_default.specializedStorage.userPreferences.get("activeFilters");
      if (savedFilters) {
        this.activeFilters = new Map(Object.entries(savedFilters));
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u8FC7\u6EE4\u5668\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 保存过滤器状态
   */
  saveFiltersState() {
    try {
      const filtersObject = Object.fromEntries(this.activeFilters);
      storageManager_default.specializedStorage.userPreferences.set("activeFilters", filtersObject);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u8FC7\u6EE4\u5668\u72B6\u6001\u5931\u8D25:", error);
    }
  }
};
var SortManager = class {
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
  setSort(field, direction = "desc") {
    this.currentSort = { field, direction };
    this._saveSortState();
    eventManager_default.emit("gallery:sort-changed", {
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
      const newDirection = this.currentSort.direction === "asc" ? "desc" : "asc";
      this.setSort(field, newDirection);
    } else {
      this.setSort(field, "desc");
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
      return direction === "asc" ? result : -result;
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
      case "name":
        return (a.name || "").localeCompare(b.name || "");
      case "uploadTime":
        return (a.uploadTime || 0) - (b.uploadTime || 0);
      case "lastModified":
        return (a.lastModified || 0) - (b.lastModified || 0);
      case "size":
        return (a.size || 0) - (b.size || 0);
      case "dimensions":
        const aArea = (a.width || 0) * (a.height || 0);
        const bArea = (b.width || 0) * (b.height || 0);
        return aArea - bArea;
      case "confidence":
        const aConf = this._getAverageConfidence(a);
        const bConf = this._getAverageConfidence(b);
        return aConf - bConf;
      case "aiTagsCount":
        const aCount = (a.aiTags || []).length;
        const bCount = (b.aiTags || []).length;
        return aCount - bCount;
      case "customTagsCount":
        const aCustomCount = (a.customTags || []).length;
        const bCustomCount = (b.customTags || []).length;
        return aCustomCount - bCustomCount;
      case "random":
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
      const savedSort = storageManager_default.specializedStorage.userPreferences.get("sortState");
      if (savedSort) {
        this.currentSort = { ...this.currentSort, ...savedSort };
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u6392\u5E8F\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 保存排序状态
   * @private
   */
  _saveSortState() {
    try {
      storageManager_default.specializedStorage.userPreferences.set("sortState", this.currentSort);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u6392\u5E8F\u72B6\u6001\u5931\u8D25:", error);
    }
  }
};
var PaginationManager = class {
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
    this.currentPage = 1;
    this._savePaginationState();
    eventManager_default.emit("gallery:pagination-changed", {
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
    eventManager_default.emit("gallery:page-changed", {
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
      const savedPagination = storageManager_default.specializedStorage.userPreferences.get("paginationState");
      if (savedPagination) {
        this.itemsPerPage = savedPagination.itemsPerPage || this.itemsPerPage;
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u5206\u9875\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 保存分页状态
   * @private
   */
  _savePaginationState() {
    try {
      storageManager_default.specializedStorage.userPreferences.set("paginationState", {
        itemsPerPage: this.itemsPerPage
        // 不保存当前页
      });
    } catch (error) {
      console.warn("\u4FDD\u5B58\u5206\u9875\u72B6\u6001\u5931\u8D25:", error);
    }
  }
};
var ViewManager = class {
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
      console.warn(`\u672A\u77E5\u7684\u89C6\u56FE\u6A21\u5F0F: ${viewMode}`);
      return;
    }
    this.currentView = viewMode;
    this._saveViewState();
    eventManager_default.emit("gallery:view-changed", {
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
    eventManager_default.emit("gallery:grid-columns-changed", {
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
      const savedView = storageManager_default.specializedStorage.userPreferences.get("viewState");
      if (savedView) {
        this.currentView = savedView.viewMode || this.currentView;
        this.gridColumns = savedView.gridColumns || this.gridColumns;
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u89C6\u56FE\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 保存视图状态
   * @private
   */
  _saveViewState() {
    try {
      storageManager_default.specializedStorage.userPreferences.set("viewState", {
        viewMode: this.currentView,
        gridColumns: this.gridColumns
      });
    } catch (error) {
      console.warn("\u4FDD\u5B58\u89C6\u56FE\u72B6\u6001\u5931\u8D25:", error);
    }
  }
};
var GalleryManager = class {
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
        uiManager_default.loadingManager.show("\u6B63\u5728\u52A0\u8F7D\u56FE\u7247\u5E93...");
      }
      this.images = await imageManager_default.getAllImages();
      this._updateDisplayedImages();
      this.lastRefreshTime = Date.now();
      eventManager_default.emit("gallery:refreshed", {
        totalImages: this.images.length,
        displayedImages: this.displayedImages.length,
        timestamp: this.lastRefreshTime
      });
    } catch (error) {
      console.error("\u5237\u65B0\u56FE\u7247\u5E93\u5931\u8D25:", error);
      if (showLoading) {
        uiManager_default.tooltipManager.error("\u5237\u65B0\u56FE\u7247\u5E93\u5931\u8D25");
      }
    } finally {
      this.isLoading = false;
      if (showLoading) {
        uiManager_default.loadingManager.hide();
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
    this.filteredImages = this.filterManager.applyFilters(searchResults);
    this.paginationManager.setCurrentPage(1);
    this._updateDisplayedImages();
  }
  /**
   * 应用过滤器
   */
  applyFilters() {
    const baseImages = this.searchEngine.searchHistory.length > 0 ? this.searchEngine.search(this.searchEngine.searchHistory[0]?.query || "", this.images) : this.images;
    this.filteredImages = this.filterManager.applyFilters(baseImages);
    this.paginationManager.setCurrentPage(1);
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
    eventManager_default.emit("gallery:image-added", {
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
    const index = this.images.findIndex((img) => img.id === imageId);
    if (index > -1) {
      const removedImage = this.images.splice(index, 1)[0];
      this._updateDisplayedImages();
      eventManager_default.emit("gallery:image-removed", {
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
    const index = this.images.findIndex((img) => img.id === imageId);
    if (index > -1) {
      this.images[index] = { ...this.images[index], ...updates };
      this._updateDisplayedImages();
      eventManager_default.emit("gallery:image-updated", {
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
    return this.images.find((img) => img.id === imageId) || null;
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
  exportGalleryData(format = "json") {
    const data = {
      images: this.images,
      stats: this.getGalleryStats(),
      exportTime: Date.now(),
      version: "1.0"
    };
    if (format === "json") {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }
  /**
   * 更新显示的图片
   * @private
   */
  _updateDisplayedImages() {
    let workingImages = this.filteredImages.length > 0 ? this.filteredImages : this.images;
    workingImages = this.sortManager.applySort(workingImages);
    this.displayedImages = this.paginationManager.applyPagination(workingImages);
    eventManager_default.emit("gallery:display-updated", {
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
      console.log("GalleryManager already initialized");
      return;
    }
    try {
      console.log("Initializing GalleryManager...");
      this.isInitialized = true;
      console.log("GalleryManager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize GalleryManager:", error);
      throw error;
    }
  }
  /**
   * 绑定事件监听器
   * @private
   */
  _bindEvents() {
    eventManager_default.on("image:loaded", () => {
      this.refreshGallery();
    });
    eventManager_default.on("image:removed", (data) => {
      this.removeImage(data.imageId);
    });
    eventManager_default.on("image:updated", (data) => {
      this.updateImage(data.imageId, data.updates);
    });
    eventManager_default.on("gallery:filter-changed", () => {
      this.applyFilters();
      this.filterManager.saveFiltersState();
    });
    eventManager_default.on("gallery:sort-changed", () => {
      this.applySort();
    });
    eventManager_default.on("gallery:pagination-changed", () => {
      this.applyPagination();
    });
    eventManager_default.on("gallery:page-changed", () => {
      this.applyPagination();
    });
    eventManager_default.on("gallery:view-changed", () => {
      eventManager_default.emit("gallery:render-required", {
        viewMode: this.viewManager.currentView,
        timestamp: Date.now()
      });
    });
    eventManager_default.on("gallery:grid-columns-changed", () => {
      eventManager_default.emit("gallery:render-required", {
        gridColumns: this.viewManager.gridColumns,
        timestamp: Date.now()
      });
    });
  }
};
var galleryManager = new GalleryManager();
var galleryManager_default = galleryManager;

// src/js/adminManager.js
var SecurityManager = class {
  constructor() {
    this.failedAttempts = /* @__PURE__ */ new Map();
    this.blockedIPs = /* @__PURE__ */ new Set();
    this.sessionTokens = /* @__PURE__ */ new Map();
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
      const response = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github.v3+json"
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
          error: response.status === 401 ? ERROR_MESSAGES.INVALID_TOKEN : ERROR_MESSAGES.TOKEN_VERIFICATION_FAILED
        };
      }
    } catch (error) {
      console.error("Token\u9A8C\u8BC1\u5931\u8D25:", error);
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
    if (current.attempts.length > 10) {
      current.attempts = current.attempts.slice(-10);
    }
    this.failedAttempts.set(identifier, current);
    this._saveSecurityData();
    eventManager_default.emit("security:failed-login", {
      identifier,
      count: current.count,
      timestamp: Date.now()
    });
    if (current.count >= this.maxFailedAttempts) {
      this.blockedIPs.add(identifier);
      eventManager_default.emit("security:ip-blocked", {
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
    eventManager_default.emit("security:attempts-cleared", {
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
    if (Date.now() > session.expiresAt) {
      this.sessionTokens.delete(token);
      return null;
    }
    session.lastActivity = Date.now();
    return session;
  }
  /**
   * 撤销会话令牌
   * @param {string} token - 会话令牌
   */
  revokeSessionToken(token) {
    this.sessionTokens.delete(token);
    eventManager_default.emit("security:session-revoked", {
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
    expiredTokens.forEach((token) => {
      this.sessionTokens.delete(token);
    });
    if (expiredTokens.length > 0) {
      eventManager_default.emit("security:sessions-expired", {
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
    }, 6e4);
  }
  /**
   * 加载安全数据
   * @private
   */
  _loadSecurityData() {
    try {
      const data = storageManager_default.specializedStorage.adminData.get("securityData");
      if (data) {
        this.failedAttempts = new Map(data.failedAttempts || []);
        this.blockedIPs = new Set(data.blockedIPs || []);
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u5B89\u5168\u6570\u636E\u5931\u8D25:", error);
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
      storageManager_default.specializedStorage.adminData.set("securityData", data);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u5B89\u5168\u6570\u636E\u5931\u8D25:", error);
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
};
var ActivityLogManager = class {
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
      user: details.user || "system",
      userAgent: navigator.userAgent,
      ip: this._getClientIP(),
      details: {
        ...details,
        url: window.location.href,
        referrer: document.referrer
      }
    };
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    this._saveLogs();
    eventManager_default.emit("admin:activity-logged", logEntry);
    console.log(`\u7BA1\u7406\u5458\u6D3B\u52A8\u8BB0\u5F55: ${action}`, details);
  }
  /**
   * 获取活动日志
   * @param {Object} filters - 过滤条件
   * @returns {Array} 过滤后的日志
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];
    if (filters.action) {
      filteredLogs = filteredLogs.filter((log) => log.action === filters.action);
    }
    if (filters.user) {
      filteredLogs = filteredLogs.filter((log) => log.user === filters.user);
    }
    if (filters.startTime) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp >= filters.startTime);
    }
    if (filters.endTime) {
      filteredLogs = filteredLogs.filter((log) => log.timestamp <= filters.endTime);
    }
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
      this.logs = this.logs.filter((log) => log.timestamp > olderThan);
    } else if (action) {
      this.logs = this.logs.filter((log) => log.action !== action);
    } else if (user) {
      this.logs = this.logs.filter((log) => log.user !== user);
    } else {
      this.logs = [];
    }
    this._saveLogs();
    eventManager_default.emit("admin:logs-cleared", {
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
  exportLogs(format = "json", filters = {}) {
    const logs = this.getLogs(filters);
    if (format === "csv") {
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
    if (logs.length === 0) return "";
    const headers = ["\u65F6\u95F4", "\u52A8\u4F5C", "\u7528\u6237", "IP\u5730\u5740", "\u7528\u6237\u4EE3\u7406", "\u8BE6\u60C5"];
    const rows = logs.map((log) => [
      TimeUtils.formatDateTime(log.timestamp),
      log.action,
      log.user,
      log.ip || "unknown",
      log.userAgent || "unknown",
      JSON.stringify(log.details)
    ]);
    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    return csvContent;
  }
  /**
   * 获取客户端IP
   * @returns {string} IP地址
   * @private
   */
  _getClientIP() {
    return "client-ip";
  }
  /**
   * 加载日志
   * @private
   */
  _loadLogs() {
    try {
      const savedLogs = storageManager_default.specializedStorage.adminData.get("activityLogs");
      if (savedLogs && Array.isArray(savedLogs)) {
        this.logs = savedLogs;
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u6D3B\u52A8\u65E5\u5FD7\u5931\u8D25:", error);
    }
  }
  /**
   * 保存日志
   * @private
   */
  _saveLogs() {
    try {
      storageManager_default.specializedStorage.adminData.set("activityLogs", this.logs);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u6D3B\u52A8\u65E5\u5FD7\u5931\u8D25:", error);
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
    this.logs.forEach((log) => {
      stats.actionCounts[log.action] = (stats.actionCounts[log.action] || 0) + 1;
      stats.userCounts[log.user] = (stats.userCounts[log.user] || 0) + 1;
    });
    stats.recentActivity = this.logs.slice(0, 10);
    return stats;
  }
};
var PermissionManager = class {
  constructor() {
    this.permissions = CONFIG.ADMIN.PERMISSIONS;
    this.userPermissions = /* @__PURE__ */ new Map();
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
    return userPerms.includes(permission) || userPerms.includes("admin");
  }
  /**
   * 授予权限
   * @param {string} user - 用户标识
   * @param {string} permission - 权限名称
   */
  grantPermission(user, permission) {
    if (!this.permissions.includes(permission)) {
      throw new Error(`\u672A\u77E5\u6743\u9650: ${permission}`);
    }
    const userPerms = this.userPermissions.get(user) || [];
    if (!userPerms.includes(permission)) {
      userPerms.push(permission);
      this.userPermissions.set(user, userPerms);
      this._savePermissions();
      eventManager_default.emit("admin:permission-granted", {
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
      eventManager_default.emit("admin:permission-revoked", {
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
      const savedPerms = storageManager_default.specializedStorage.adminData.get("userPermissions");
      if (savedPerms) {
        this.userPermissions = new Map(savedPerms);
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u6743\u9650\u6570\u636E\u5931\u8D25:", error);
    }
  }
  /**
   * 保存权限
   * @private
   */
  _savePermissions() {
    try {
      const permsArray = Array.from(this.userPermissions.entries());
      storageManager_default.specializedStorage.adminData.set("userPermissions", permsArray);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u6743\u9650\u6570\u636E\u5931\u8D25:", error);
    }
  }
};
var SessionManager = class {
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
    eventManager_default.emit("admin:session-started", {
      user: sessionData.user,
      timestamp: Date.now()
    });
  }
  /**
   * 结束会话
   * @param {string} reason - 结束原因
   */
  endSession(reason = "logout") {
    if (!this.currentSession) return;
    const sessionDuration = Date.now() - this.currentSession.startTime;
    this._clearTimers();
    this._unbindActivityListeners();
    eventManager_default.emit("admin:session-ended", {
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
    this.warningTimer = setTimeout(() => {
      this._showSessionWarning();
    }, this.sessionTimeout - this.warningTime);
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
    uiManager_default.tooltipManager.warning(
      `\u4F1A\u8BDD\u5373\u5C06\u5728 ${remainingTime} \u540E\u8FC7\u671F\uFF0C\u8BF7\u4FDD\u6301\u6D3B\u52A8\u72B6\u6001`,
      { duration: 1e4 }
    );
    eventManager_default.emit("admin:session-warning", {
      remainingTime: this.warningTime,
      timestamp: Date.now()
    });
  }
  /**
   * 处理会话超时
   * @private
   */
  _handleSessionTimeout() {
    uiManager_default.tooltipManager.error("\u4F1A\u8BDD\u5DF2\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55");
    eventManager_default.emit("admin:session-timeout", {
      user: this.currentSession?.user,
      timestamp: Date.now()
    });
    this.endSession("timeout");
    eventManager_default.emit("admin:force-logout");
  }
  /**
   * 绑定活动监听器
   * @private
   */
  _bindActivityListeners() {
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    this.activityHandler = () => {
      this.updateActivity();
    };
    events.forEach((event) => {
      document.addEventListener(event, this.activityHandler, true);
    });
  }
  /**
   * 解绑活动监听器
   * @private
   */
  _unbindActivityListeners() {
    if (!this.activityHandler) return;
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    events.forEach((event) => {
      document.removeEventListener(event, this.activityHandler, true);
    });
    this.activityHandler = null;
  }
  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this._clearTimers();
      } else {
        if (this.currentSession) {
          this._startSessionTimers();
        }
      }
    });
  }
};
var AdminManager = class {
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
      const identifier = this._getClientIdentifier();
      const cooldownCheck = this.securityManager.checkLoginCooldown(identifier);
      if (!cooldownCheck.allowed) {
        return {
          success: false,
          error: `\u767B\u5F55\u5C1D\u8BD5\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u5728 ${cooldownCheck.formattedTime} \u540E\u91CD\u8BD5`
        };
      }
      const validation = await this.securityManager.validateGitHubToken(token);
      if (!validation.valid) {
        this.securityManager.recordFailedLogin(identifier, {
          reason: validation.error,
          token: token.substring(0, 8) + "..."
        });
        return {
          success: false,
          error: validation.error
        };
      }
      this.securityManager.clearLoginAttempts(identifier);
      const sessionToken = this.securityManager.generateSessionToken(validation.user);
      this.isAdminMode = true;
      this.currentAdmin = {
        ...validation.user,
        sessionToken,
        loginTime: Date.now()
      };
      this._saveAdminState();
      this.sessionManager.startSession(this.currentAdmin);
      this.activityLogManager.logActivity("LOGIN", {
        user: validation.user.login,
        success: true,
        sessionToken
      });
      eventManager_default.emitAdminLogin({
        user: validation.user,
        timestamp: Date.now()
      });
      return {
        success: true,
        user: validation.user,
        sessionToken
      };
    } catch (error) {
      console.error("\u7BA1\u7406\u5458\u767B\u5F55\u5931\u8D25:", error);
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
    const user = this.currentAdmin?.login || "unknown";
    if (this.currentAdmin?.sessionToken) {
      this.securityManager.revokeSessionToken(this.currentAdmin.sessionToken);
    }
    this.sessionManager.endSession("logout");
    this.activityLogManager.logActivity("LOGOUT", {
      user,
      sessionDuration: Date.now() - (this.currentAdmin?.loginTime || Date.now())
    });
    this.isAdminMode = false;
    this.currentAdmin = null;
    this._clearAdminState();
    eventManager_default.emitAdminLogout({
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
    const session = this.securityManager.validateSessionToken(this.currentAdmin.sessionToken);
    if (!session) {
      this.logout();
      return false;
    }
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
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      (/* @__PURE__ */ new Date()).getTimezoneOffset()
    ].join("|");
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
      storageManager_default.specializedStorage.adminData.set("adminState", state);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u7BA1\u7406\u5458\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 加载管理员状态
   * @private
   */
  _loadAdminState() {
    try {
      const state = storageManager_default.specializedStorage.adminData.get("adminState");
      if (state && state.isAdminMode && state.currentAdmin) {
        const session = this.securityManager.validateSessionToken(state.currentAdmin.sessionToken);
        if (session) {
          this.isAdminMode = true;
          this.currentAdmin = state.currentAdmin;
          this.sessionManager.startSession(this.currentAdmin);
          console.log("\u6062\u590D\u7BA1\u7406\u5458\u4F1A\u8BDD:", this.currentAdmin.login);
        } else {
          this._clearAdminState();
        }
      }
    } catch (error) {
      console.warn("\u52A0\u8F7D\u7BA1\u7406\u5458\u72B6\u6001\u5931\u8D25:", error);
      this._clearAdminState();
    }
  }
  /**
   * 清除管理员状态
   * @private
   */
  _clearAdminState() {
    try {
      storageManager_default.specializedStorage.adminData.remove("adminState");
    } catch (error) {
      console.warn("\u6E05\u9664\u7BA1\u7406\u5458\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 绑定事件监听器
   * @private
   */
  _bindEvents() {
    eventManager_default.on("admin:force-logout", () => {
      this.logout();
    });
    eventManager_default.on("admin:session-timeout", (data) => {
      this.activityLogManager.logActivity("SESSION_TIMEOUT", {
        user: data.user,
        reason: "inactivity"
      });
    });
    window.addEventListener("beforeunload", () => {
      if (this.isAdminMode) {
        this.activityLogManager.logActivity("PAGE_UNLOAD", {
          user: this.currentAdmin?.login
        });
      }
    });
  }
};
var adminManager = new AdminManager();
var adminManager_default = adminManager;

// src/js/app.js
var AppStateManager = class {
  constructor() {
    this.state = {
      isInitialized: false,
      isLoading: false,
      currentView: "gallery",
      selectedImages: /* @__PURE__ */ new Set(),
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
    this._saveStateToHistory();
    if (typeof key === "object") {
      Object.assign(this.state, key);
    } else {
      this.state[key] = value;
    }
    eventManager_default.emit("app:state-changed", {
      key: typeof key === "object" ? Object.keys(key) : [key],
      newState: { ...this.state },
      timestamp: Date.now()
    });
  }
  /**
   * 切换布尔状态
   * @param {string} key - 状态键
   */
  toggleState(key) {
    if (typeof this.state[key] === "boolean") {
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
      currentView: "gallery",
      selectedImages: /* @__PURE__ */ new Set(),
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
      eventManager_default.emit("app:state-restored", {
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
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }
  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    document.addEventListener("visibilitychange", () => {
      this.setState("isPageVisible", !document.hidden);
    });
    window.addEventListener("online", () => {
      this.setState("isOnline", true);
    });
    window.addEventListener("offline", () => {
      this.setState("isOnline", false);
    });
  }
};
var KeyboardShortcutManager = class {
  constructor(appStateManager) {
    this.appStateManager = appStateManager;
    this.shortcuts = /* @__PURE__ */ new Map();
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
      description: options.description || "",
      category: options.category || "general",
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
    this.appStateManager.setState("keyboardShortcutsEnabled", enabled);
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
    this.register("ctrl+f", () => {
      const searchInput = document.querySelector("#search-input");
      if (searchInput) {
        searchInput.focus();
      }
    }, { description: "\u805A\u7126\u641C\u7D22\u6846", category: "gallery" });
    this.register("ctrl+a", () => {
      const images = galleryManager_default.getDisplayedImages();
      const selectedImages = new Set(images.map((img) => img.id));
      this.appStateManager.setState("selectedImages", selectedImages);
    }, { description: "\u5168\u9009\u56FE\u7247", category: "gallery" });
    this.register("escape", () => {
      if (this.appStateManager.getState("fullscreenMode")) {
        this.appStateManager.setState("fullscreenMode", false);
      } else {
        uiManager_default.modalManager.closeAll();
      }
    }, { description: "\u5173\u95ED\u6A21\u6001\u6846/\u9000\u51FA\u5168\u5C4F", category: "navigation" });
    this.register("f11", () => {
      this.appStateManager.toggleState("fullscreenMode");
    }, { description: "\u5207\u6362\u5168\u5C4F\u6A21\u5F0F", category: "view" });
    this.register("ctrl+1", () => {
      galleryManager_default.viewManager.setViewMode("grid");
    }, { description: "\u7F51\u683C\u89C6\u56FE", category: "view" });
    this.register("ctrl+2", () => {
      galleryManager_default.viewManager.setViewMode("list");
    }, { description: "\u5217\u8868\u89C6\u56FE", category: "view" });
    this.register("ctrl+3", () => {
      galleryManager_default.viewManager.setViewMode("masonry");
    }, { description: "\u7011\u5E03\u6D41\u89C6\u56FE", category: "view" });
    this.register("ctrl+shift+a", () => {
      if (adminManager_default.isAdminMode) {
        const adminPanel = document.querySelector("#admin-panel-modal");
        if (adminPanel) {
          adminPanel.style.display = adminPanel.style.display === "none" ? "flex" : "none";
        }
      }
    }, { description: "\u5207\u6362\u7BA1\u7406\u5458\u9762\u677F", category: "admin" });
    this.register("ctrl+shift+t", () => {
      uiManager_default.themeManager.toggleTheme();
    }, { description: "\u5207\u6362\u4E3B\u9898", category: "ui" });
    this.register("f5", () => {
      galleryManager_default.refreshGallery(true);
    }, { description: "\u5237\u65B0\u56FE\u7247\u5E93", category: "gallery" });
  }
  /**
   * 标准化快捷键
   * @param {string} combination - 快捷键组合
   * @returns {string} 标准化的快捷键
   * @private
   */
  _normalizeShortcut(combination) {
    return combination.toLowerCase().replace(/\s+/g, "").split("+").sort().join("+");
  }
  /**
   * 处理键盘事件
   * @param {KeyboardEvent} event - 键盘事件
   * @private
   */
  _handleKeyDown(event) {
    if (!this.isEnabled || !this.appStateManager.getState("keyboardShortcutsEnabled")) {
      return;
    }
    const parts = [];
    if (event.ctrlKey) parts.push("ctrl");
    if (event.shiftKey) parts.push("shift");
    if (event.altKey) parts.push("alt");
    if (event.metaKey) parts.push("meta");
    const key = event.key.toLowerCase();
    if (!["control", "shift", "alt", "meta"].includes(key)) {
      parts.push(key);
    }
    const combination = parts.sort().join("+");
    const shortcut = this.shortcuts.get(combination);
    if (shortcut) {
      if (shortcut.preventDefault) {
        event.preventDefault();
      }
      try {
        shortcut.handler(event);
      } catch (error) {
        console.error("\u5FEB\u6377\u952E\u5904\u7406\u5931\u8D25:", error);
      }
    }
  }
  /**
   * 绑定事件
   * @private
   */
  _bindEvents() {
    document.addEventListener("keydown", (event) => {
      this._handleKeyDown(event);
    });
  }
};
var DragDropManager = class {
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
    const imageFiles = Array.from(files).filter(
      (file) => file.type.startsWith("image/")
    );
    if (imageFiles.length === 0) {
      uiManager_default.tooltipManager.warning("\u8BF7\u62D6\u62FD\u56FE\u7247\u6587\u4EF6");
      return;
    }
    uiManager_default.progressManager.show("\u6B63\u5728\u4E0A\u4F20\u56FE\u7247...");
    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const progress = (i + 1) / imageFiles.length * 100;
        uiManager_default.progressManager.update(progress, `\u4E0A\u4F20\u4E2D: ${file.name}`);
        await imageManager_default.loadImageFromFile(file);
        eventManager_default.emitUploadProgress({
          current: i + 1,
          total: imageFiles.length,
          fileName: file.name,
          progress
        });
      }
      uiManager_default.tooltipManager.success(`\u6210\u529F\u4E0A\u4F20 ${imageFiles.length} \u5F20\u56FE\u7247`);
      eventManager_default.emitUploadComplete({
        count: imageFiles.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25:", error);
      uiManager_default.tooltipManager.error("\u6587\u4EF6\u4E0A\u4F20\u5931\u8D25");
    } finally {
      uiManager_default.progressManager.hide();
    }
  }
  /**
   * 绑定全局事件
   * @private
   */
  _bindEvents() {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      document.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    document.addEventListener("dragenter", () => {
      this.dragCounter++;
      if (this.dragCounter === 1) {
        this.appStateManager.setState("dragDropActive", true);
      }
    });
    document.addEventListener("dragleave", () => {
      this.dragCounter--;
      if (this.dragCounter === 0) {
        this.appStateManager.setState("dragDropActive", false);
      }
    });
    document.addEventListener("drop", () => {
      this.dragCounter = 0;
      this.appStateManager.setState("dragDropActive", false);
    });
  }
  /**
   * 绑定拖拽区域事件
   * @private
   */
  _bindDropZoneEvents() {
    if (!this.dropZone) return;
    this.dropZone.addEventListener("dragover", (e) => {
      e.dataTransfer.dropEffect = "copy";
    });
    this.dropZone.addEventListener("drop", (e) => {
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
  }
};
var PerformanceMonitor = class {
  constructor() {
    this.metrics = {
      loadTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      imageLoadTimes: [],
      searchTimes: [],
      filterTimes: []
    };
    this.observers = /* @__PURE__ */ new Map();
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
      if (this.metrics[metric].length > 100) {
        this.metrics[metric].shift();
      }
    } else {
      this.metrics[metric] = value;
    }
    eventManager_default.emit("performance:metric-recorded", {
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
    ["imageLoadTimes", "searchTimes", "filterTimes"].forEach((metric) => {
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
    if ("PerformanceObserver" in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.recordMetric("longTasks", entry.duration, {
            name: entry.name,
            startTime: entry.startTime
          });
        });
      });
      try {
        longTaskObserver.observe({ entryTypes: ["longtask"] });
        this.observers.set("longtask", longTaskObserver);
      } catch (error) {
        console.warn("\u957F\u4EFB\u52A1\u89C2\u5BDF\u5668\u4E0D\u652F\u6301:", error);
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
};
var App = class {
  constructor() {
    this.stateManager = new AppStateManager();
    this.keyboardShortcutManager = new KeyboardShortcutManager(this.stateManager);
    this.dragDropManager = new DragDropManager(this.stateManager);
    this.performanceMonitor = new PerformanceMonitor();
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
      this.performanceMonitor.startMeasure("app-initialization");
      console.log("\u{1F680} AI\u667A\u80FD\u76F8\u518C\u7CFB\u7EDF\u542F\u52A8\u4E2D...");
      this.stateManager.setState("isLoading", true);
      console.log("\u{1F4E6} \u521D\u59CB\u5316\u5B58\u50A8\u7BA1\u7406\u5668...");
      await storageManager_default.initialize();
      console.log("\u2705 \u5B58\u50A8\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5B8C\u6210");
      console.log("\u{1F3A8} \u521D\u59CB\u5316UI\u7BA1\u7406\u5668...");
      await uiManager_default.initialize(CONFIG.UI);
      console.log("\u2705 UI\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5B8C\u6210");
      console.log("\u{1F5BC}\uFE0F \u521D\u59CB\u5316\u56FE\u7247\u7BA1\u7406\u5668...");
      await imageManager_default.initialize();
      console.log("\u2705 \u56FE\u7247\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5B8C\u6210");
      console.log("\u{1F916} \u521D\u59CB\u5316AI\u5F15\u64CE...");
      let aiInitialized = false;
      try {
        aiInitialized = await Promise.race([
          aiEngine_default.initialize(),
          new Promise((resolve) => setTimeout(() => resolve(false), 1e4))
          // 10秒超时
        ]);
        console.log("\u2705 AI\u5F15\u64CE\u521D\u59CB\u5316\u5B8C\u6210\uFF0C\u6210\u529F: " + aiInitialized);
        if (!aiInitialized) {
          console.warn("\u26A0\uFE0F AI\u529F\u80FD\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u5E94\u7528\u5C06\u4EE5\u57FA\u7840\u6A21\u5F0F\u8FD0\u884C");
        }
      } catch (error) {
        console.warn("\u26A0\uFE0F AI\u5F15\u64CE\u521D\u59CB\u5316\u5F02\u5E38:", error.message);
        aiInitialized = false;
      }
      console.log("\u{1F4DA} \u521D\u59CB\u5316\u56FE\u7247\u5E93\u7BA1\u7406\u5668...");
      await galleryManager_default.refreshGallery(true);
      console.log("\u2705 \u56FE\u7247\u5E93\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5B8C\u6210");
      const dropZone = document.body;
      this.dragDropManager.setDropZone(dropZone);
      console.log("\u2705 \u62D6\u62FD\u533A\u57DF\u8BBE\u7F6E\u5B8C\u6210");
      this._bindUIEvents();
      console.log("\u2705 UI\u4E8B\u4EF6\u7ED1\u5B9A\u5B8C\u6210");
      await this._restoreAppState();
      console.log("\u2705 \u5E94\u7528\u72B6\u6001\u6062\u590D\u5B8C\u6210");
      this.isInitialized = true;
      this.stateManager.setState({
        isInitialized: true,
        isLoading: false
      });
      console.log("\u2705 \u521D\u59CB\u5316\u72B6\u6001\u8BBE\u7F6E\u5B8C\u6210");
      const initTime = this.performanceMonitor.endMeasure("app-initialization");
      console.log(`\u2705 AI\u667A\u80FD\u76F8\u518C\u7CFB\u7EDF\u521D\u59CB\u5316\u5B8C\u6210 (${initTime.toFixed(2)}ms)`);
      eventManager_default.emit("app:initialized", {
        initTime,
        timestamp: Date.now()
      });
      uiManager_default.tooltipManager.success("AI\u667A\u80FD\u76F8\u518C\u7CFB\u7EDF\u5DF2\u5C31\u7EEA", { duration: 3e3 });
    } catch (error) {
      console.error("\u5E94\u7528\u7A0B\u5E8F\u521D\u59CB\u5316\u5931\u8D25:", error);
      this.stateManager.setState({
        isLoading: false,
        initializationError: error.message
      });
      uiManager_default.tooltipManager.error("\u7CFB\u7EDF\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u91CD\u8BD5");
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
    console.log("\u{1F504} \u6B63\u5728\u9500\u6BC1\u5E94\u7528\u7A0B\u5E8F...");
    this.performanceMonitor.cleanup();
    this._unbindGlobalEvents();
    this.stateManager.resetState();
    this.isInitialized = false;
    this.initializationPromise = null;
    console.log("\u2705 \u5E94\u7528\u7A0B\u5E8F\u5DF2\u9500\u6BC1");
  }
  /**
   * 绑定UI事件
   * @private
   */
  _bindUIEvents() {
    const searchInput = document.querySelector("#search-input");
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.performanceMonitor.startMeasure("search");
          galleryManager_default.searchImages(e.target.value);
          this.performanceMonitor.endMeasure("search");
        }, 300);
      });
    }
    const uploadButton = document.querySelector("#upload-button");
    if (uploadButton) {
      uploadButton.addEventListener("click", () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.multiple = true;
        fileInput.accept = "image/*";
        fileInput.addEventListener("change", (e) => {
          if (e.target.files.length > 0) {
            this.dragDropManager._handleFiles(e.target.files);
          }
        });
        fileInput.click();
      });
    }
    const adminButton = document.querySelector("#admin-button");
    if (adminButton) {
      adminButton.addEventListener("click", () => {
        const modal = document.querySelector("#admin-login-modal");
        if (modal) {
          modal.style.display = "flex";
        }
      });
    }
    const themeButton = document.querySelector("#theme-toggle");
    if (themeButton) {
      themeButton.addEventListener("click", () => {
        uiManager_default.themeManager.toggleTheme();
      });
    }
  }
  /**
   * 恢复应用状态
   * @private
   */
  async _restoreAppState() {
    try {
      const savedState = storageManager_default.specializedStorage.userPreferences.get("appState");
      if (savedState) {
        const safeState = {
          currentView: savedState.currentView || "gallery",
          keyboardShortcutsEnabled: savedState.keyboardShortcutsEnabled !== false
        };
        this.stateManager.setState(safeState);
      }
    } catch (error) {
      console.warn("\u6062\u590D\u5E94\u7528\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 保存应用状态
   * @private
   */
  _saveAppState() {
    try {
      const stateToSave = {
        currentView: this.stateManager.getState("currentView"),
        keyboardShortcutsEnabled: this.stateManager.getState("keyboardShortcutsEnabled"),
        timestamp: Date.now()
      };
      storageManager_default.specializedStorage.userPreferences.set("appState", stateToSave);
    } catch (error) {
      console.warn("\u4FDD\u5B58\u5E94\u7528\u72B6\u6001\u5931\u8D25:", error);
    }
  }
  /**
   * 绑定全局事件
   * @private
   */
  _bindGlobalEvents() {
    eventManager_default.on("app:state-changed", (data) => {
      this._saveAppState();
      if (data.key.includes("isLoading")) {
        console.log("isLoading state changed:", data.newState.isLoading);
        if (data.newState.isLoading) {
          uiManager_default.loadingManager.show("app-loading", { global: true, message: "\u6B63\u5728\u521D\u59CB\u5316..." });
        } else {
          uiManager_default.loadingManager.hide("app-loading");
        }
      }
    });
    window.addEventListener("beforeunload", () => {
      this._saveAppState();
    });
    window.addEventListener("error", (event) => {
      console.error("\u5168\u5C40\u9519\u8BEF:", event.error);
      eventManager_default.emit("app:error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: Date.now()
      });
    });
    window.addEventListener("unhandledrejection", (event) => {
      console.error("\u672A\u5904\u7406\u7684Promise\u62D2\u7EDD:", event.reason);
      eventManager_default.emit("app:unhandled-rejection", {
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
  }
};
var app = new App();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    app.initialize();
  });
} else {
  app.initialize();
}
var app_default = app;
export {
  App,
  AppStateManager,
  DragDropManager,
  KeyboardShortcutManager,
  PerformanceMonitor,
  app_default as default
};
