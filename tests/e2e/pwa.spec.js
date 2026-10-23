import { expect, test } from '@playwright/test';
import { mockGitHubImages } from './helpers.js';

test.use({ serviceWorkers: 'allow' });

test('Service Worker 注册并在离线时返回缓存页面', async ({ page, context }) => {
    await mockGitHubImages(page);
    await page.goto('/index.html');
    await expect(page.locator('.image-card')).toHaveCount(46);
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
    });

    // 第二次加载由 Service Worker 接管，确保 shell 和图片进入缓存。
    await page.reload();
    await expect(page.locator('.image-card')).toHaveCount(46);
    await page.waitForTimeout(1000);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('.image-card')).toHaveCount(46);
});
