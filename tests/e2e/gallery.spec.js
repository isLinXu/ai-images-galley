import { expect, test } from '@playwright/test';
import { mockGitHubImages } from './helpers.js';

test.describe('经典版', () => {
    test('渲染 46 张图片并打开详情', async ({ page }) => {
        await mockGitHubImages(page);
        await page.goto('/index.html');

        await expect(page.locator('.image-card')).toHaveCount(46);
        await expect(page.locator('#loading-indicator')).toBeHidden();

        await page.locator('.image-card').first().click();
        await expect(page.locator('#image-detail-modal')).toBeVisible();
        await expect(page.locator('#modal-title')).not.toHaveText('图片详情');
        await expect(page.locator('#modal-image')).toHaveAttribute('src', /images\//);
    });

    test('搜索与空结果', async ({ page }) => {
        await mockGitHubImages(page);
        await page.goto('/index.html');
        await expect(page.locator('.image-card')).toHaveCount(46);

        await page.fill('#search-input', 'fcea6691');
        await expect(page.locator('.image-card')).toHaveCount(1);
        await page.fill('#search-input', 'no-such-image-xyz');
        await expect(page.locator('.image-card')).toHaveCount(0);
    });
});

test.describe('模块化版', () => {
    test('分页、搜索、视图、主题与详情', async ({ page }) => {
        await mockGitHubImages(page);
        await page.goto('/index-modular.html');

        await expect(page.locator('#image-grid .image-card')).toHaveCount(20);
        await expect(page.locator('#image-count')).toHaveText('1–20 / 共 46 张');

        await page.locator('#page-numbers [data-page="2"]').click();
        await expect(page.locator('#image-count')).toHaveText('21–40 / 共 46 张');
        await expect(page.locator('#image-grid .image-card')).toHaveCount(20);

        await page.locator('#view-list').click();
        await expect(page.locator('#image-list')).toBeVisible();
        await expect(page.locator('#image-grid')).toBeHidden();

        await page.fill('#search-input', 'fcea6691');
        await expect(page.locator('#image-count')).toHaveText('1–1 / 共 1 张');

        await page.locator('#view-grid').click();
        await page.locator('#image-grid .image-card').first().click();
        await expect(page.locator('#image-modal')).toBeVisible();
        await expect(page.locator('#info-filename')).toContainText('.png');
        await page.locator('#image-modal .modal-close').click();
        await expect(page.locator('#image-modal')).toBeHidden();

        const darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        await page.locator('#theme-toggle').click();
        const darkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        expect(darkAfter).not.toBe(darkBefore);
    });

    test('无效 Token 显示登录错误', async ({ page }) => {
        await mockGitHubImages(page);
        await page.goto('/index-modular.html');
        await page.locator('#admin-button').click();
        await page.fill('#github-token', 'bad-token');
        await page.locator('#admin-login-form button[type="submit"]').click();
        await expect(page.locator('#login-error')).toBeVisible();
        await expect(page.locator('#login-error')).toContainText('Token');
    });
});
