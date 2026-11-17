// node --test
// The content script end to end, against a saved sample of a call and a fake chrome.*:
// joining, capturing, backing up and saving when the call ends.
const test = require('node:test');
const assert = require('node:assert');
const { load, usePage } = require('./helpers/load.js');

/* global MSG, STATE, STORAGE */

test('a call is transcribed from joining to leaving', async (t) => {
  t.mock.timers.enable({
    apis: ['setInterval', 'setTimeout', 'Date'],
    now: Date.UTC(2026, 10, 12, 16),
  });
  const doc = usePage('call-captions-on.html', { title: 'Meet: Daily' });
  const window = doc.defaultView;
  globalThis.MutationObserver = window.MutationObserver;
  globalThis.Event = window.Event;
  globalThis.addEventListener = window.addEventListener.bind(window);
  globalThis.dispatchEvent = window.dispatchEvent.bind(window);

  const sent = [];
  const stored = {};
  let onMessage;
  globalThis.chrome = {
    runtime: {
      sendMessage: async (message) => {
        sent.push(message);
        return message.type === MSG.HELLO ? 7 : undefined;
      },
      onMessage: { addListener: (listener) => (onMessage = listener) },
    },
    storage: {
      local: {
        get: async () => ({}),
        set: async (items) => void Object.assign(stored, items),
      },
      onChanged: { addListener() {} },
    },
    i18n: { getMessage: (key) => key, getUILanguage: () => 'es-419' },
  };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const ofType = (type) => sent.filter((m) => m.type === type);
  const ask = (type) => {
    let reply;
    onMessage({ type }, {}, (value) => (reply = value));
    return reply;
  };

  load(
    'src/shared/constants.js',
    'src/shared/i18n.js',
    'src/shared/transcript.js',
    'src/content/meet-dom.js',
    'src/content/layout.js',
    'src/content/watchdog.js',
    'src/content/main.js',
  );
  await settle();
  assert.strictEqual(ofType(MSG.HELLO).length, 1);
  assert.strictEqual(ask(MSG.GET_STATUS).state, STATE.IDLE);

  // First tick: the call is detected and the transcription starts by itself.
  t.mock.timers.tick(2000);
  assert.strictEqual(ask(MSG.GET_STATUS).state, STATE.RECORDING);

  // Second tick: the captions already on screen are captured, hidden and backed up.
  t.mock.timers.tick(2000);
  await settle();
  const status = ask(MSG.GET_STATUS);
  assert.deepStrictEqual(
    { state: status.state, count: status.count, language: status.language },
    { state: STATE.RECORDING, count: 2, language: 'Español (México)' },
  );
  const box = doc.querySelector('[role="region"][tabindex="0"]').closest('[style*="80px"]');
  assert.strictEqual(box.style.opacity, '0');
  const [pendingKey] = Object.keys(stored).filter((k) => k.startsWith(STORAGE.PENDING_PREFIX));
  assert.ok(pendingKey, 'a backup of the meeting in progress is kept');
  assert.strictEqual(stored[pendingKey].tabId, 7);
  assert.deepStrictEqual(
    ofType(MSG.NOTIFY).map((m) => m.messageKey),
    ['notifyLanguage'],
    'the first meeting ever tells which language is being transcribed',
  );

  // Ana keeps talking: Meet rewrites her block and the entry follows it.
  const anaText = doc.querySelector('[role="region"][tabindex="0"] img').parentElement
    .nextElementSibling;
  anaText.textContent = 'Buenos días a todos. Empezamos con el reporte de ventas.';
  await settle();
  assert.strictEqual(ask(MSG.GET_STATUS).count, 2);

  // Paused: what is said is not captured, and is skipped when resuming.
  assert.strictEqual(ask(MSG.TOGGLE_PAUSE).state, STATE.PAUSED);
  anaText.textContent += ' Esto no debe quedar.';
  await settle();
  assert.strictEqual(ask(MSG.TOGGLE_PAUSE).state, STATE.RECORDING);
  await settle();
  assert.strictEqual(ask(MSG.GET_STATUS).count, 2, 'resuming alone captures nothing');

  // Ana goes on in the same block: only what she says after resuming is captured, even
  // though Meet corrects a word of what she said during the pause.
  anaText.textContent = anaText.textContent.replace('quedar.', 'salir.') + ' Esto sí queda.';
  await settle();
  assert.strictEqual(ask(MSG.GET_STATUS).count, 3);

  // Leaving the call: two ticks outside and the transcript is handed over.
  doc.querySelector('[aria-label="Abandonar la llamada"]').remove();
  t.mock.timers.tick(2000);
  assert.strictEqual(ofType(MSG.SAVE).length, 0);
  t.mock.timers.tick(2000);
  const [save] = ofType(MSG.SAVE);
  assert.ok(save, 'the finished transcript is sent to the service worker');
  assert.strictEqual(save.key, pendingKey);
  assert.match(save.record.fileName, /^2026-11-12 \d{4} - Daily\.md$/);
  assert.match(save.record.md, /title: "Daily"/);
  assert.match(save.record.md, /language: "Español \(México\)"/);
  assert.match(
    save.record.md,
    /\*\*Ana Pérez\*\* \(\d\d:\d\d\)\n\nBuenos días a todos\. Empezamos con el reporte de ventas\.\n/,
  );
  assert.match(save.record.md, /\*\*Luis Gómez\*\* \(\d\d:\d\d\)\n\nPerfecto, yo sigo después\.\n/);
  assert.match(save.record.md, /\*\*Ana Pérez\*\* \(\d\d:\d\d\)\n\nEsto sí queda\.\n/);
  assert.doesNotMatch(save.record.md, /Esto no debe/);
  assert.strictEqual(ask(MSG.GET_STATUS).state, STATE.IDLE);
});
