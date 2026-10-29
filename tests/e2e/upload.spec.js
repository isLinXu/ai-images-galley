import { expect, test } from '@playwright/test';
import { manifest, testImagePath } from './helpers.js';

test('模块化版通过 GitHub Contents API 上传图片', async ({ page }) => {
    const uploadedImages = new Set();
    const uploadedThumbnails = new Set();
    const putBodies = new Map();

    await page.addInitScript(() => {
        sessionStorage.setItem('github_token', 'github_pat_test_token_1234567890');
    });

    await page.route('https://api.github.com/repos/isLinXu/ai-images-galley/contents/images**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const prefix = '/repos/isLinXu/ai-images-galley/contents/images/';
        const name = url.pathname.startsWith(prefix) ? decodeURIComponent(url.pathname.slice(prefix.length)) : '';

        if (request.method() === 'GET' && !name) {
            const files = [
                ...manifest.images.map((image) => ({
                    name: image.name,
                    type: 'file',
                    size: image.size,
                    sha: `sha-${image.name}`
                })),
                ...Array.from(uploadedImages).map((key) => ({
                    name: key,
                    type: 'file',
                    size: 1000,
                    sha: `sha-${key}`
                }))
            ];
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(files)
            });
        }

        if (request.method() === 'GET' && name) {
            if (uploadedImages.has(name) || uploadedThumbnails.has(name)) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ name, sha: `sha-${name}` })
                });
            }
            return route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Not Found' })
            });
        }

        if (request.method() === 'PUT' && name) {
            putBodies.set(name, JSON.parse(request.postData() || '{}'));
            if (name.startsWith('thumbnails/')) {
                uploadedThumbnails.add(name);
            } else {
                uploadedImages.add(name);
            }
            return route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({ content: { name, sha: `sha-${name}` } })
            });
        }

        return route.fulfill({ status: 500, body: 'unexpected request' });
    });

    await page.goto('/index-modular.html');
    await expect(page.locator('#image-count')).toHaveText('1–20 / 共 46 张');

    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#upload-button').click()]);
    await chooser.setFiles(testImagePath());

    await expect(page.locator('#image-count')).toHaveText('1–20 / 共 47 张');

    const originalName = Array.from(uploadedImages)[0];
    const thumbnailName = Array.from(uploadedThumbnails)[0];
    expect(originalName).toMatch(/\.jpg$/);
    expect(thumbnailName).toMatch(/^thumbnails\/.*\.webp$/);

    const originalBody = putBodies.get(originalName);
    const thumbnailBody = putBodies.get(thumbnailName);
    expect(originalBody.branch).toBe('main');
    expect(originalBody.content.startsWith('/9j/')).toBe(true);
    expect(originalBody.content.length).toBeGreaterThan(1000);
    expect(thumbnailBody.content.startsWith('UklGR')).toBe(true);
});
