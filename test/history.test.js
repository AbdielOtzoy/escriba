// node --test
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/load.js');

load('src/shared/constants.js', 'src/shared/i18n.js', 'src/shared/history.js');
/* global historyStore */

test('files go to the same downloads folder whatever the browser language', async () => {
  const requests = [];
  globalThis.chrome = { downloads: { download: async (options) => requests.push(options) } };
  await historyStore.download('2026-11-12 1030 - Daily.md', '# Daily\n');
  assert.strictEqual(requests[0].filename, 'transcripciones-meet/2026-11-12 1030 - Daily.md');
  assert.strictEqual(requests[0].saveAs, false);
});
