import { expect, test } from '@playwright/test';
import { mockGitHubImages } from './helpers.js';

test('模块化版通过后端 AI 分析图片', async ({ page }) => {
    let analysisRequest = null;

    await page.addInitScript(() => {
        localStorage.setItem('api_base_url', 'http://127.0.0.1:8000/api/v1');
    });

    await mockGitHubImages(page);

    await page.route('http://127.0.0.1:8000/api/v1/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const cors = { 'access-control-allow-origin': '*' };

        if (url.pathname.endsWith('/health')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: cors,
                body: JSON.stringify({ success: true, data: { status: 'healthy' } })
            });
        }
        if (url.pathname.endsWith('/prompts/templates')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: cors,
                body: JSON.stringify({ success: true, data: [] })
            });
        }
        if (url.pathname.endsWith('/analysis/url') && request.method() === 'POST') {
            analysisRequest = JSON.parse(request.postData() || '{}');
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: cors,
                body: JSON.stringify({
                    success: true,
                    message: 'AI分析完成',
                    data: {
                        image_id: analysisRequest.image_url,
                        classifications: [],
                        detections: [{ label: 'person', label_zh: '人物', confidence: 0.93, bbox: [0, 0, 10, 10] }],
                        caption: { caption: '一位站在花田中的女性。', confidence: 0.91 },
                        tags: ['人物', '花田', '户外'],
                        colors: [],
                        scene_type: 'portrait',
                        processing_time: 12.3,
                        model_version: 'gpt-4o-test',
                        provider: 'openai'
                    }
                })
            });
        }

        return route.fulfill({
            status: 404,
            contentType: 'application/json',
            headers: cors,
            body: '{}'
        });
    });

    await page.goto('/index-modular.html');
    await expect(page.locator('#image-grid .image-card')).toHaveCount(20);
    await page.locator('#image-grid .image-card').first().click();
    await expect(page.locator('#image-modal')).toBeVisible();

    await page.locator('#tab-ai-btn').click();
    await expect(page.locator('#ai-tags .tag-item')).toHaveCount(3);
    await expect(page.locator('#ai-tags')).toContainText('人物');
    await expect(page.locator('#ai-description')).toContainText('花田');
    await expect(page.locator('#ai-status')).toContainText('真实模型');
    await expect(page.locator('#detected-objects')).toContainText('人物');

    expect(analysisRequest).not.toBeNull();
    expect(analysisRequest.image_url).toContain('/images/');
    expect(analysisRequest.language).toBe('zh');
});
