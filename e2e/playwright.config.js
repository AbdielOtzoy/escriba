// End-to-end tests: the real unpacked extension in Chromium against a fake Meet page.
// Run with `npm run test:e2e` (once: `npx playwright install chromium`).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  outputDir: 'test-results',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  // The content script works on a 2 s tick: joining and leaving take a few of them.
  timeout: 45000,
  expect: { timeout: 15000 },
});
