/**
 * AI智能相册系统 - Service Worker
 * 提供离线缓存和性能优化
 */

const CACHE_NAME = 'ai-gallery-v1';
const STATIC_CACHE = 'ai-gallery-static-v1';
const IMAGE_CACHE = 'ai-gallery-images-v1';
const API_CACHE = 'ai-gallery-api-v1';

// 静态资源列表
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index-modular.html',
  '/manifest.json',
  '/src/styles/main.css',
  '/src/js/app.js',
  '/src/js/uiManager.js',
  '/src/js/imageManager.js',
  '/src/js/galleryManager.js',
  '/src/js/aiEngine.js',
  '/src/js/storageManager.js',
  '/src/js/adminManager.js',
  '/src/js/eventManager.js',
  '/src/js/utils.js',
  '/src/js/config.js'
];

// 外部CDN资源（可选缓存）
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.0/dist/mobilenet.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2/dist/coco-ssd.min.js'
];

/**
 * 安装事件 - 缓存静态资源
 */
self.addEventListener('install', (event) => {
  console.log('[SW] 安装中...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] 缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] 静态资源缓存完成');
        return self.skipWaiting();
      })
      .catch(error => {
        console.warn('[SW] 静态资源缓存失败:', error);
      })
  );
});

/**
 * 激活事件 - 清理旧缓存
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活中...');

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => {
              return name.startsWith('ai-gallery-') &&
                name !== STATIC_CACHE &&
                name !== IMAGE_CACHE &&
                name !== API_CACHE;
            })
            .map(name => {
              console.log('[SW] 删除旧缓存:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] 激活完成');
        return self.clients.claim();
      })
  );
});

/**
 * 获取缓存策略
 * @param {Request} request - 请求对象
 * @returns {string} 缓存策略名称
 */
function getCacheStrategy(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 静态资源
  if (request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'document' ||
      request.destination === 'manifest' ||
      pathname.endsWith('.css') ||
      pathname.endsWith('.js') ||
      pathname.endsWith('.html')) {
    return 'stale-while-revalidate';
  }

  // 图片资源
  if (request.destination === 'image' ||
      pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
    return 'cache-first';
  }

  // API 请求
  if (pathname.startsWith('/api/') || request.headers.get('Accept')?.includes('application/json')) {
    return 'network-first';
  }

  // 字体文件
  if (request.destination === 'font') {
    return 'cache-first';
  }

  // 默认策略
  return 'network-first';
}

/**
 * 缓存优先策略
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.warn('[SW] 缓存优先策略失败:', error);
    return new Response('离线模式 - 资源不可用', { status: 503 });
  }
}

/**
 * 网络优先策略
 */
async function networkFirst(request, cacheName, maxAge = 300000) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      // 添加缓存时间戳
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      cache.put(request, modifiedResponse);
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      // 检查缓存是否过期
      const cachedAt = cached.headers.get('sw-cached-at');
      if (cachedAt && (Date.now() - parseInt(cachedAt)) < maxAge) {
        return cached;
      }
    }
    console.warn('[SW] 网络优先策略失败:', error);
    return new Response('离线模式 - 网络不可用', { status: 503 });
  }
}

/**
 * 过时重新验证策略
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // 发起网络请求更新缓存（后台）
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(error => {
      console.warn('[SW] 后台更新失败:', error);
    });

  // 立即返回缓存（如果有）
  if (cached) {
    fetchPromise; // 触发但不等待
    return cached;
  }

  // 没有缓存时等待网络请求
  return fetchPromise;
}

/**
 * 获取请求对象
 * @param {Request} request - 原始请求
 * @returns {Request} 规范化后的请求
 */
function normalizeRequest(request) {
  const url = new URL(request.url);

  // 移除查询参数（用于缓存键）
  if (url.search) {
    return new Request(url.origin + url.pathname, request);
  }

  return request;
}

/**
 * 抓取事件 - 拦截请求
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const strategy = getCacheStrategy(request);
  const normalizedRequest = normalizeRequest(request);

  // 忽略非 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  // 忽略 Chrome 扩展请求
  if (request.url.startsWith('chrome-extension://')) {
    return;
  }

  let cacheName;
  switch (strategy) {
    case 'cache-first':
      cacheName = IMAGE_CACHE;
      event.respondWith(cacheFirst(normalizedRequest, cacheName));
      break;
    case 'network-first':
      cacheName = API_CACHE;
      event.respondWith(networkFirst(normalizedRequest, cacheName));
      break;
    case 'stale-while-revalidate':
      cacheName = STATIC_CACHE;
      event.respondWith(staleWhileRevalidate(normalizedRequest, cacheName));
      break;
    default:
      event.respondWith(networkFirst(normalizedRequest, API_CACHE));
  }
});

/**
 * 消息事件 - 处理主线程消息
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      timestamp: Date.now()
    });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});

/**
 * 同步事件 - 后台同步（如果支持）
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-images') {
    event.waitUntil(syncPendingImages());
  }
});

/**
 * 同步待处理的图片操作
 */
async function syncPendingImages() {
  // 这里可以实现后台同步逻辑
  console.log('[SW] 执行后台同步');
}

console.log('[SW] Service Worker 已加载');