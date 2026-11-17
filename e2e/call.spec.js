// The real extension, loaded unpacked in Chromium, against a fake Meet call (fake-meet.js).
// Covers what the unit tests cannot: the manifest's load order, the MAIN-world script,
// the service worker and the save on leaving. No network is used.
const fs = require('node:fs');
const path = require('node:path');
const { test: base, expect, chromium } = require('@playwright/test');
const { fakeMeetHtml } = require('./fake-meet.js');

/* global MSG, STATE, STORAGE -- the extension's own, inside the service worker */

const EXTENSION = path.join(__dirname, '..');
const CALL_URL = 'https://meet.google.com/abc-defg-hij';

const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // the bundled Chromium is the one that runs extensions headless
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await context.route('https://meet.google.com/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: fakeMeetHtml() }),
    );
    await use(context);
    await context.close();
  },
  // The only tab, so the service worker can find it without the "tabs" permission.
  page: async ({ context }, use) => use(context.pages()[0]),
});

/**
 * Runs `fn` inside the extension's service worker, with the Meet tab's id.
 * @template T
 * @param {import('@playwright/test').BrowserContext} context
 * @param {(tabId: number) => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
async function inWorker(context, fn) {
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({}))[0].id);
  return /** @type {Promise<T>} */ (worker.evaluate(fn, tabId));
}

/** What the popup would show: asks the content script, as the popup does. */
const status = (context) =>
  inWorker(context, (tabId) => chrome.tabs.sendMessage(tabId, { type: MSG.GET_STATUS }));
const badge = (context) => inWorker(context, (tabId) => chrome.action.getBadgeText({ tabId }));
const togglePause = (context) =>
  inWorker(context, (tabId) => chrome.tabs.sendMessage(tabId, { type: MSG.TOGGLE_PAUSE }));
/** The extension's state names, read from the extension itself. */
const states = (context) => inWorker(context, () => STATE);

/** @param {import('@playwright/test').Page} page */
const say = (page, id, name, text) =>
  page.evaluate(([id, name, text]) => window.fakeMeet.say(id, name, text), [id, name, text]);

/** Opens the call and waits until the extension is capturing with the captions hidden. */
async function joinCall(page) {
  await page.goto(CALL_URL);
  await expect(page.locator('html')).toHaveAttribute('data-escriba-extra', '216');
}

/** Leaves the call and returns what the service worker saved. */
async function leaveCall(page, context) {
  await page.evaluate(() => window.fakeMeet.leave());
  await expect
    .poll(() =>
      inWorker(context, async () => {
        const all = await chrome.storage.local.get(null);
        return Object.keys(all).filter((key) => key.startsWith(STORAGE.HISTORY_PREFIX)).length;
      }),
    )
    .toBe(1);
  return inWorker(context, async () => {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all);
    return {
      history: all[keys.find((key) => key.startsWith(STORAGE.HISTORY_PREFIX)) || ''],
      pending: keys.filter((key) => key.startsWith(STORAGE.PENDING_PREFIX)),
    };
  });
}

test('joining a call starts the transcription and hides the captions', async ({
  page,
  context,
}) => {
  await page.goto(CALL_URL);
  const { RECORDING } = await states(context);
  const height = await page.evaluate(() => document.documentElement.clientHeight);
  const innerHeight = await page.evaluate(() => window.innerHeight);

  // It starts by itself and says so on the icon.
  await expect.poll(() => badge(context)).toBe('REC');
  expect((await status(context)).state).toBe(RECORDING);

  // Captions get turned on (menu, then the button inside it) and hidden.
  const strip = page.locator('[style*="bottom: 80px"]');
  await expect(strip).toHaveCSS('opacity', '0');
  await expect(strip).toHaveCSS('pointer-events', 'none');
  await expect(page.getByLabel('Subtítulos y traducción').first()).toHaveAttribute(
    'aria-expanded',
    'false',
  );

  // Their space goes back to the video: layout.js (isolated world) writes the height and
  // viewport-patch.js (page's world) reports a taller window to Meet.
  await expect(page.locator('html')).toHaveAttribute('data-escriba-extra', '216');
  expect(await page.evaluate(() => document.documentElement.clientHeight)).toBe(height + 216);
  expect(await page.evaluate(() => window.innerHeight)).toBe(innerHeight + 216);
  await expect(page.locator('main')).toHaveCSS('margin-bottom', '-216px');
  await expect(page.locator('[style*="bottom: 296px"]')).toHaveCSS('margin-bottom', '-216px');

  expect((await status(context)).language).toBe('Español (México)');
  expect(await badge(context)).toBe('REC');
});

test('caption blocks become transcript entries as they appear and are rewritten', async ({
  page,
  context,
}) => {
  await joinCall(page);
  expect((await status(context)).count).toBe(0);

  await say(page, 'a', 'Marta Ruiz', 'Good morning');
  await expect.poll(async () => (await status(context)).count).toBe(1);

  // Meet rewrites the block while she keeps talking: same entry, not a new one.
  await say(page, 'a', 'Marta Ruiz', 'Good morning, everyone. Let us begin.');
  await say(page, 'b', 'Diego Soto', 'Ready when you are.');
  await expect.poll(async () => (await status(context)).count).toBe(2);
  await say(page, 'b', 'Diego Soto', 'Ready when you are, Marta.');
  await page.waitForTimeout(300);
  expect((await status(context)).count).toBe(2);
});

test('leaving the call saves the transcript to the history and to disk', async ({
  page,
  context,
}) => {
  await joinCall(page);
  await say(page, 'a', 'Marta Ruiz', 'Good morning');
  await say(page, 'a', 'Marta Ruiz', 'Good morning, everyone. Let us begin.');
  await say(page, 'b', 'Diego Soto', 'Ready when you are.');
  await expect.poll(async () => (await status(context)).count).toBe(2);

  const { history, pending } = await leaveCall(page, context);
  expect(history.fileName).toMatch(/^\d{4}-\d\d-\d\d \d{4} - Weekly sync\.md$/);
  expect(history.md).toContain('title: "Weekly sync"');
  expect(history.md).toMatch(/\*\*Marta Ruiz\*\* \(\d\d:\d\d\)\n\nGood morning, everyone\. Let us/);
  expect(history.md).toMatch(/\*\*Diego Soto\*\* \(\d\d:\d\d\)\n\nReady when you are\.\n/);
  expect(history.md).not.toContain('Good morning\n');
  expect(pending, 'the backup is removed once saved').toEqual([]);

  // The file. Playwright emits no `download` event for chrome.downloads and stores the
  // file under a generated name, so the folder and file name asked for cannot be checked
  // here: chrome.downloads tells where it was written, and its content is compared.
  await expect
    .poll(() => inWorker(context, async () => (await chrome.downloads.search({}))[0]?.state))
    .toBe('complete');
  const downloads = await inWorker(context, () => chrome.downloads.search({}));
  expect(downloads).toHaveLength(1);
  expect(downloads[0].mime).toBe('text/markdown');
  expect(fs.readFileSync(downloads[0].filename, 'utf8')).toBe(history.md);

  await expect.poll(() => badge(context)).toBe('');
  expect((await status(context)).state).toBe((await states(context)).IDLE);
});

test('after a pause, only what is said after resuming is captured', async ({ page, context }) => {
  await joinCall(page);
  const { PAUSED, RECORDING } = await states(context);
  await say(page, 'a', 'Marta Ruiz', 'Said before the pause.');
  await expect.poll(async () => (await status(context)).count).toBe(1);

  expect((await togglePause(context)).state).toBe(PAUSED);
  await expect.poll(() => badge(context)).toBe('II');
  await say(page, 'a', 'Marta Ruiz', 'Said before the pause. Off the record words.');
  await page.waitForTimeout(300);

  // She keeps talking in the same block after resuming.
  expect((await togglePause(context)).state).toBe(RECORDING);
  await say(
    page,
    'a',
    'Marta Ruiz',
    'Said before the pause. Off the record words. Back on after resuming.',
  );
  await page.waitForTimeout(300);

  const { history } = await leaveCall(page, context);
  expect(history.md).toContain('Said before the pause.');
  expect(history.md).toContain('Back on after resuming.');
  expect(history.md).not.toContain('Off the record');
});

test('the outline for a bug report describes the page without names or text', async ({
  page,
  context,
}) => {
  await joinCall(page);
  await say(page, 'a', 'Marta Ruiz', 'Good morning, everyone.');
  await expect.poll(async () => (await status(context)).count).toBe(1);

  const reply = await inWorker(context, (tabId) =>
    chrome.tabs.sendMessage(tabId, { type: MSG.GET_SKELETON }),
  );
  expect(reply.skeleton).toMatch(/^lang=\S+ inCall=true captionRegion=true blocks=1\n/);
  expect(reply.skeleton).toContain('i "call_end"');
  expect(reply.skeleton).not.toMatch(/Marta|Ruiz|Good morning|abc-defg/);
});
