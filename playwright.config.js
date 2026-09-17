const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: true,
  reporter: 'line',
  use: {
    trace: 'off',
    video: 'off',
    screenshot: 'off'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], browserName: 'webkit' } },
    // WebKit with an iPhone profile approximates Safari; real iOS Safari is not runnable locally.
    { name: 'webkit-iphone', use: { ...devices['iPhone 13'], browserName: 'webkit' } }
  ]
});
