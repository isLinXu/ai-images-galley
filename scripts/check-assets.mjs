/**
 * 资源完整性检查：manifest、PWA 图标、截图、本地化依赖和图片清单。
 * 不依赖浏览器，可在 CI 中快速发现“文件被移动/删除但引用未更新”的问题。
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());
const errors = [];

function fail(message) {
    errors.push(message);
}

function assertFile(relativePath, label = '') {
    const absolute = join(root, relativePath);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
        fail(`缺少文件: ${relativePath}${label ? ` (${label})` : ''}`);
        return false;
    }
    return true;
}

function pngSize(path) {
    try {
        const buffer = readFileSync(path);
        if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
            return null;
        }
        return {
            width: buffer.readUInt32BE(16),
            height: buffer.readUInt32BE(20)
        };
    } catch {
        return null;
    }
}

const requiredFiles = [
    'index.html',
    'index-modular.html',
    'manifest.json',
    'service-worker.js',
    'images/manifest.json',
    'src/js/app.js',
    'src/js/config.js',
    'src/js/imageSource.js',
    'src/js/galleryManager.js',
    'src/js/galleryRenderer.js',
    'vendor/tailwind.css',
    'vendor/tailwind-legacy.css',
    'vendor/fontawesome/css/all.min.css',
    'backend/app/main.py',
    'backend/requirements.txt'
];

requiredFiles.forEach((file) => assertFile(file));

// manifest 图标/截图
let manifest = null;
try {
    manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
} catch (error) {
    fail(`manifest.json 解析失败: ${error.message}`);
}

if (manifest) {
    if (!manifest.start_url || manifest.start_url === '/') {
        fail('manifest.start_url 必须是相对路径（例如 ./），否则 GitHub Pages 子路径部署会失效');
    }
    if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) {
        fail('manifest.icons 至少需要 192 和 512 两个尺寸');
    }
    (manifest.icons || []).forEach((icon) => {
        if (assertFile(icon.src, 'manifest icon')) {
            const size = pngSize(join(root, icon.src));
            const expected = String(icon.sizes || '');
            if (size && /^\d+x\d+$/.test(expected)) {
                const [width, height] = expected.split('x').map(Number);
                if (size.width !== width || size.height !== height) {
                    fail(`图标尺寸不匹配: ${icon.src} 实际 ${size.width}x${size.height}，声明 ${expected}`);
                }
            }
        }
    });
    (manifest.screenshots || []).forEach((screenshot) => {
        if (assertFile(screenshot.src, 'manifest screenshot')) {
            const size = pngSize(join(root, screenshot.src));
            const expected = String(screenshot.sizes || '');
            if (size && /^\d+x\d+$/.test(expected)) {
                const [width, height] = expected.split('x').map(Number);
                if (size.width !== width || size.height !== height) {
                    fail(`截图尺寸不匹配: ${screenshot.src} 实际 ${size.width}x${size.height}，声明 ${expected}`);
                }
            }
        }
    });
}

// 图片清单中的每个文件必须存在
try {
    const imageManifest = JSON.parse(readFileSync(join(root, 'images/manifest.json'), 'utf8'));
    const images = Array.isArray(imageManifest.images) ? imageManifest.images : [];
    if (images.length === 0) {
        fail('images/manifest.json 没有图片条目');
    }
    images.forEach((image) => {
        if (!image || !image.name) {
            fail('images/manifest.json 存在无效条目');
            return;
        }
        assertFile(join('images', image.name), 'image manifest');
        if (image.thumbnail) {
            assertFile(join('images', image.thumbnail), 'image thumbnail');
        }
    });
} catch (error) {
    fail(`images/manifest.json 解析失败: ${error.message}`);
}

// Service Worker 预缓存列表中的本地文件
try {
    const source = readFileSync(join(root, 'service-worker.js'), 'utf8');
    const match = source.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
    if (!match) {
        fail('service-worker.js 中找不到 STATIC_ASSETS');
    } else {
        const assets = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
        assets.forEach((asset) => {
            const relative = asset.replace(/^\.\//, '');
            if (!relative || relative === '') {
                return;
            }
            assertFile(relative, 'service worker precache');
        });
    }
} catch (error) {
    fail(`service-worker.js 读取失败: ${error.message}`);
}

if (errors.length > 0) {
    console.error(`资源检查失败 (${errors.length}):`);
    errors.forEach((error) => console.error(` - ${error}`));
    process.exit(1);
}

console.log('资源检查通过：manifest、PWA 图标/截图、图片清单和 Service Worker 预缓存均完整。');
