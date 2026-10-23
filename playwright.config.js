import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 45000,
    expect: { timeout: 10000 },
    fullyParallel: false,
    workers: 1,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:8080',
        headless: true,
        viewport: { width: 1280, height: 900 },
        serviceWorkers: 'block',
        // 本地优先使用系统 Chrome；CI 安装 Playwright Chromium
        ...(process.env.CI ? {} : { channel: 'chrome' }),
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'node scripts/static-server.mjs',
        url: 'http://127.0.0.1:8080/index.html',
        reuseExistingServer: !process.env.CI,
        timeout: 30000
    }
});
