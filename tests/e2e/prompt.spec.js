import { expect, test } from '@playwright/test';
import { mockGitHubImages } from './helpers.js';

test('模块化版 Prompt 优化器在无后端时使用本地规则', async ({ page }) => {
    await mockGitHubImages(page);
    await page.goto('/index-modular.html');

    await page.locator('#prompt-button').click();
    await expect(page.locator('#prompt-modal')).toBeVisible();

    await page.fill('#prompt-input', '花田里的女孩，午后阳光');
    await page.selectOption('#prompt-style', 'photography');
    await page.locator('#prompt-submit').click();

    await expect(page.locator('#prompt-status')).toContainText('本地规则');
    await expect(page.locator('#prompt-output')).toContainText('花田里的女孩');
    await expect(page.locator('#prompt-output')).toContainText('professional quality');
    await expect(page.locator('#prompt-negative-output')).toContainText('blur');
    await expect(page.locator('#prompt-tags .tag-item').first()).toBeVisible();
});
