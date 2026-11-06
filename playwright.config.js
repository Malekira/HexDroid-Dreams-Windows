const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './test/ui', timeout: process.env.CI ? 60000 : 20000, fullyParallel: false, workers: 1,
  use: { headless: true, viewport: { width: 1280, height: 820 }, launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: { command: 'node scripts/serve-ui.js', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  reporter: 'list'
});
