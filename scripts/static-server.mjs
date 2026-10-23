/**
 * 轻量静态服务器：用于本地开发、Playwright webServer 和离线/PWA 验证。
 * 支持正确的 MIME、Service-Worker-Allowed 和 no-store，避免 python http.server
 * 在并发请求下重置连接导致的 E2E 抖动。
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown; charset=utf-8'
};

createServer((request, response) => {
    try {
        const url = new URL(request.url || '/', `http://${request.headers.host || host}`);
        let filePath = normalize(join(root, decodeURIComponent(url.pathname)));
        const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
        if (filePath !== root && !filePath.startsWith(rootPrefix)) {
            response.writeHead(403);
            return response.end('forbidden');
        }
        if (existsSync(filePath) && statSync(filePath).isDirectory()) {
            filePath = join(filePath, 'index.html');
        }
        if (!existsSync(filePath)) {
            response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            return response.end('not found');
        }

        const stat = statSync(filePath);
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Cache-Control': 'no-store',
            'Service-Worker-Allowed': '/'
        });
        createReadStream(filePath).pipe(response);
    } catch (error) {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(String(error));
    }
}).listen(port, host, () => {
    console.log(`Static server: http://${host}:${port}/`);
});
