import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
export const manifest = JSON.parse(readFileSync(resolve(root, 'images/manifest.json'), 'utf8'));

/**
 * 让测试不依赖 GitHub API 的真实网络/限流：返回与 manifest 对应的 Contents 列表。
 */
export async function mockGitHubImages(page) {
    await page.route('https://api.github.com/repos/isLinXu/ai-images-galley/contents/images**', async (route) => {
        const files = manifest.images.map((image) => ({
            name: image.name,
            type: 'file',
            size: image.size,
            sha: `sha-${image.name}`
        }));
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(files)
        });
    });
}

export function testImagePath() {
    return resolve(root, 'images/0d0d171f-c05c-4570-b7c2-7f0e23d7050a.png');
}
