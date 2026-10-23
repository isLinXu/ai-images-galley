/**
 * AI智能相册系统 - Service Worker
 * 提供离线缓存和静态资源加速。
 *
 * 注意：所有资源路径都基于 Service Worker 的作用域计算，
 * 因此既支持站点根路径部署，也支持 GitHub Pages 的 /<repo>/ 子路径部署。
 */

const CACHE_VERSION = 'v6';
const STATIC_CACHE = `ai-gallery-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `ai-gallery-images-${CACHE_VERSION}`;
const API_CACHE = `ai-gallery-api-${CACHE_VERSION}`;
const CACHE_PREFIX = 'ai-gallery-';

const APP_SCOPE = self.registration.scope;

function scoped(path) {
    return new URL(path, APP_SCOPE).href;
}

// 只预缓存应用自身的核心资源；外部 CDN 资源交给浏览器 HTTP 缓存。
const STATIC_ASSETS = [
    './',
    './index.html',
    './index-modular.html',
    './manifest.json',
    './src/styles/main.css',
    './src/js/app.js',
    './src/js/config.js',
    './src/js/utils.js',
    './src/js/logger.js',
    './src/js/eventManager.js',
    './src/js/storageManager.js',
    './src/js/uiManager.js',
    './src/js/imageManager.js',
    './src/js/aiEngine.js',
    './src/js/galleryManager.js',
    './src/js/galleryRenderer.js',
    './src/js/adminManager.js',
    './src/js/apiClient.js',
    './src/js/promptEngine.js',
    './src/js/multimodalEngine.js',
    './src/js/imageWorker.js',
    './src/js/imageSource.js',
    './vendor/tailwind.css',
    './vendor/tailwind-legacy.css',
    './vendor/fontawesome/css/all.min.css',
    './assets/icons/icon-192x192.png',
    './assets/icons/icon-512x512.png',
    './assets/icons/icon-maskable-512.png',
    './assets/icons/icon-1024.png'
];

/**
 * 安装：逐个缓存核心资源，单个 404 不应导致整个安装失败。
 */
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(STATIC_CACHE);
            const results = await Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(scoped(asset))));
            const failed = results.filter((result) => result.status === 'rejected').length;
            if (failed > 0) {
                console.warn(`[SW] ${failed}/${STATIC_ASSETS.length} 个静态资源预缓存失败`);
            }
            await self.skipWaiting();
        })()
    );
});

/**
 * 激活：清理旧版本缓存并立即接管页面。
 */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(
                names
                    .filter((name) => name.startsWith(CACHE_PREFIX) && !name.endsWith(CACHE_VERSION))
                    .map((name) => caches.delete(name))
            );
            await self.clients.claim();
        })()
    );
});

function isSameOrigin(url) {
    return url.origin === self.location.origin;
}

/**
 * 获取缓存策略。
 */
function getCacheStrategy(request) {
    const url = new URL(request.url);

    if (!isSameOrigin(url)) {
        return 'passthrough';
    }

    if (request.mode === 'navigate') {
        return 'navigation';
    }

    if (url.pathname.includes('/api/')) {
        return 'network-first';
    }

    if (request.destination === 'image' || /\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(url.pathname)) {
        return 'cache-first';
    }

    if (
        request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font' ||
        request.destination === 'manifest' ||
        /\.(css|js|woff2?|ttf|json|html)$/i.test(url.pathname)
    ) {
        return 'stale-while-revalidate';
    }

    return 'network-first';
}

async function cacheFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.warn('[SW] 图片缓存失败:', error);
        return new Response('', { status: 504, statusText: 'Offline' });
    }
}

async function networkFirst(request, cacheName) {
    const cache = await caches.open(cacheName);
    try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        return new Response('离线模式：网络不可用', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    const networkPromise = fetch(request)
        .then((response) => {
            if (response.ok && response.type === 'basic') {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    if (cached) {
        // 后台更新，不阻塞当前请求。
        networkPromise.catch(() => {});
        return cached;
    }

    const response = await networkPromise;
    if (response) {
        return response;
    }

    return new Response('离线模式：资源不可用', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

async function navigationHandler(request) {
    const cache = await caches.open(STATIC_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached =
            (await cache.match(request)) ||
            (await cache.match(scoped('./index.html'))) ||
            (await cache.match(scoped('./')));
        if (cached) {
            return cached;
        }
        return new Response('离线模式：页面不可用', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

/**
 * 抓取事件。
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (!isSameOrigin(url) || url.protocol === 'chrome-extension:') {
        return;
    }

    const strategy = getCacheStrategy(request);

    switch (strategy) {
        case 'navigation':
            event.respondWith(navigationHandler(request));
            break;
        case 'cache-first':
            event.respondWith(cacheFirst(request, IMAGE_CACHE));
            break;
        case 'network-first':
            event.respondWith(networkFirst(request, API_CACHE));
            break;
        case 'stale-while-revalidate':
            event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
            break;
        default:
            break;
    }
});

/**
 * 消息事件：支持手动跳过等待、查询版本、清理缓存。
 */
self.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
        event.ports[0].postMessage({
            version: CACHE_VERSION,
            scope: APP_SCOPE,
            timestamp: Date.now()
        });
    }

    if (data.type === 'CLEAR_CACHE' && event.ports && event.ports[0]) {
        event.waitUntil(
            (async () => {
                const names = await caches.keys();
                await Promise.all(
                    names.filter((name) => name.startsWith(CACHE_PREFIX)).map((name) => caches.delete(name))
                );
                event.ports[0].postMessage({ success: true });
            })()
        );
    }
});

/**
 * 后台同步占位：当前应用的上传是显式操作，暂不需要队列同步。
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-images') {
        event.waitUntil(Promise.resolve());
    }
});
