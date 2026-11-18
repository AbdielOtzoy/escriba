// node --test
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/load.js');

load(
  'src/shared/constants.js',
  'src/shared/i18n.js',
  'src/shared/transcript.js',
  'src/shared/history.js',
);
/* global historyStore, STORAGE */

test('files go to the same downloads folder whatever the browser language', async () => {
  const requests = [];
  globalThis.chrome = { downloads: { download: async (options) => requests.push(options) } };
  await historyStore.download('2026-11-12 1030 - Daily.md', '# Daily\n');
  assert.strictEqual(requests[0].filename, 'transcripciones-meet/2026-11-12 1030 - Daily.md');
  assert.strictEqual(requests[0].saveAs, false);
});

test('lists the newest transcripts reading only those, old field names included', async () => {
  const stored = {
    [STORAGE.HISTORY_PREFIX + 100]: { fileName: 'Oldest.md', md: '# Oldest\n' },
    [STORAGE.HISTORY_PREFIX + 300]: { archivo: 'Newest.md', md: '' },
    [STORAGE.HISTORY_PREFIX + 200]: { fileName: 'Middle.md', md: '# Middle\n' },
    [STORAGE.PENDING_PREFIX + 400]: { fileName: 'Unsaved.md', md: '# Unsaved\n' },
    [STORAGE.SETTINGS]: {},
  };
  const asked = [];
  globalThis.chrome = {
    storage: {
      local: {
        getKeys: async () => Object.keys(stored),
        get: async (keys) => {
          asked.push(keys);
          return Object.fromEntries(keys.map((key) => [key, stored[key]]));
        },
      },
    },
  };

  const recent = await historyStore.list(2);
  assert.deepStrictEqual(
    recent.map((item) => [item.key, item.fileName, item.title]),
    [
      [STORAGE.HISTORY_PREFIX + 300, 'Newest.md', 'Newest'],
      [STORAGE.HISTORY_PREFIX + 200, 'Middle.md', 'Middle'],
    ],
  );
  assert.deepStrictEqual(asked, [[STORAGE.HISTORY_PREFIX + 300, STORAGE.HISTORY_PREFIX + 200]]);
  assert.strictEqual((await historyStore.list()).length, 3);
});
