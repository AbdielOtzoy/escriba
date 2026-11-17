// node --test
// The adapter for Google Meet's HTML, run against the samples in test/fixtures.
const test = require('node:test');
const assert = require('node:assert');
const { load, usePage } = require('./helpers/load.js');

load('src/content/meet-dom.js', 'src/content/watchdog.js');
/* global meetDom, watchdog */

/** Removes every label, as if Meet were in a language the extension has no words for. */
function stripLabels(doc) {
  for (const el of doc.querySelectorAll('[aria-label]')) el.removeAttribute('aria-label');
}

test('inCall tells a call from any other page', () => {
  usePage('call-captions-on.html');
  assert.ok(meetDom.inCall());
  usePage('<body><button aria-label="Unirse ahora">Unirse ahora</button></body>');
  assert.ok(!meetDom.inCall());
});

test('the call and the captions are found without relying on labels', () => {
  const doc = usePage('call-captions-on.html');
  stripLabels(doc);
  assert.ok(meetDom.inCall());
  const region = meetDom.captionRegion();
  assert.ok(region);
  assert.strictEqual(meetDom.readBlocks(region).size, 2);
});

test('captionRegion is absent while captions are off', () => {
  usePage('call-captions-off.html');
  assert.ok(!meetDom.captionRegion());
});

test('readBlocks returns who is speaking and what they said', () => {
  usePage('call-captions-on.html');
  const blocks = [...meetDom.readBlocks(meetDom.captionRegion()).values()];
  assert.deepStrictEqual(blocks, [
    { name: 'Ana Pérez', text: 'Buenos días a todos. Empezamos con el reporte.' },
    { name: 'Luis Gómez', text: 'Perfecto, yo sigo después.' },
  ]);
});

test('readBlocks keys each turn by its own element', () => {
  usePage('call-captions-on.html');
  const region = meetDom.captionRegion();
  const first = [...meetDom.readBlocks(region).keys()];
  const second = [...meetDom.readBlocks(region).keys()];
  assert.strictEqual(first.length, 2);
  assert.notStrictEqual(first[0], first[1]);
  assert.deepStrictEqual(first, second);
});

test('captionBox is the strip Meet reserves, not the toolbar or the video area', () => {
  usePage('call-captions-on.html');
  const box = meetDom.captionBox(meetDom.captionRegion());
  assert.strictEqual(box.style.bottom, '80px');
  assert.ok(!box.querySelector('main'));
  assert.ok(!box.textContent.includes('call_end'));
});

test('captionLanguage reads the language next to the globe icon', () => {
  usePage('call-captions-on.html');
  const box = meetDom.captionBox(meetDom.captionRegion());
  assert.strictEqual(meetDom.captionLanguage(box), 'Español (México)');
  assert.strictEqual(meetDom.captionLanguage(meetDom.captionRegion()), '');
});

test('openLanguageSettings presses the settings button of the caption strip', () => {
  const doc = usePage('call-captions-on.html');
  let pressed = '';
  for (const b of doc.querySelectorAll('button')) {
    b.addEventListener('click', () => (pressed = b.getAttribute('aria-label')));
  }
  meetDom.openLanguageSettings(meetDom.captionBox(meetDom.captionRegion()));
  assert.strictEqual(pressed, 'Abrir configuración de subtítulos');
});

test('turnCaptionsOn presses the real button when the menu is already open', () => {
  const doc = usePage('call-captions-off.html');
  const pressed = [];
  for (const b of doc.querySelectorAll('button'))
    b.addEventListener('click', () => pressed.push(b.id));
  meetDom.turnCaptionsOn();
  assert.deepStrictEqual(pressed, ['turn-on']);
});

test('turnCaptionsOn opens the menu first when the real button is not on the page', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const doc = usePage('call-captions-off.html');
  const turnOn = doc.getElementById('turn-on');
  const dialog = turnOn.closest('[role="dialog"]');
  const dialogParent = dialog.parentElement;
  dialog.remove();
  const menu = doc.getElementById('menu');
  menu.setAttribute('aria-expanded', 'false');
  const pressed = [];
  // Meet renders the menu contents when the toolbar button is pressed.
  menu.addEventListener('click', () => {
    pressed.push('menu');
    menu.setAttribute('aria-expanded', 'true');
    dialogParent.append(dialog);
  });
  turnOn.addEventListener('click', () => pressed.push('turn-on'));

  meetDom.turnCaptionsOn();
  assert.deepStrictEqual(pressed, ['menu']);
  t.mock.timers.tick(600);
  assert.deepStrictEqual(pressed, ['menu', 'turn-on']);
});

test('turnCaptionsOn does not press the menu again while it is open and empty', () => {
  const doc = usePage('call-captions-off.html');
  doc.getElementById('turn-on').closest('[role="dialog"]').remove();
  let presses = 0;
  doc.getElementById('menu').addEventListener('click', () => presses++);
  meetDom.turnCaptionsOn();
  assert.strictEqual(presses, 0);
});

test('meetingTitle prefers the tab title without the "Meet" prefix', () => {
  usePage('call-captions-on.html', { title: 'Meet: Daily del equipo' });
  assert.strictEqual(meetDom.meetingTitle(), 'Daily del equipo');
  usePage('call-captions-on.html', { title: '' });
  assert.strictEqual(meetDom.meetingTitle(), 'abc-defg-hij');
});

test('uiLocale is the language of the Meet page', () => {
  usePage('call-captions-on.html');
  assert.strictEqual(meetDom.uiLocale(), 'es-419');
});

test('watchdog reports captions off only after the grace period', () => {
  usePage('call-captions-off.html');
  watchdog.reset();
  assert.strictEqual(watchdog.check(null, 1000), null);
  assert.strictEqual(watchdog.check(null, 1000 + watchdog.GRACE_MS), null);
  assert.strictEqual(watchdog.check(null, 1001 + watchdog.GRACE_MS), 'alertCaptionsOff');
});

test('watchdog stays quiet while captions can be read, and forgets past trouble', () => {
  usePage('call-captions-on.html');
  watchdog.reset();
  watchdog.check(null, 1000);
  assert.strictEqual(watchdog.check(meetDom.captionRegion(), 999999), null);
  assert.strictEqual(watchdog.check(null, 1000000), null);
});

test('watchdog reports captions it cannot read', () => {
  const doc = usePage('call-captions-on.html');
  const region = meetDom.captionRegion();
  // Same turns on screen, but in a structure the adapter does not understand.
  for (const img of doc.querySelectorAll('img')) img.parentElement.nextElementSibling.remove();
  watchdog.reset();
  assert.strictEqual(watchdog.check(region, 1000), null);
  assert.strictEqual(watchdog.check(region, 1001 + watchdog.GRACE_MS), 'alertUnreadable');
});

test('skeleton describes the page without any name, text or label', () => {
  const doc = usePage('call-captions-on.html');
  doc.querySelector('main').setAttribute('data-meeting-title', 'Daily');
  doc.querySelector('img').setAttribute('src', 'https://example.com/ana.png');
  doc.querySelector('main').style.backgroundImage = 'url(https://example.com/ana.png)';
  const outline = meetDom.skeleton();
  assert.match(outline, /^lang=es-419 inCall=true captionRegion=true blocks=2\n/);
  // What the adapter and layout.js look for is there…
  assert.match(outline, /div role=region aria-label tabindex=0\n/);
  assert.match(outline, /i "call_end"\n/);
  assert.match(outline, /main style="inset: 64px 16px 296px" data-meeting-title\n/);
  assert.match(outline, /button role=button aria-label aria-pressed=true aria-expanded=false/);
  // …two caption blocks alike are written once…
  assert.match(outline, /\(same ×1\)/);
  // …and nothing a person said, is called or can be reached at.
  assert.doesNotMatch(
    outline,
    /Ana|Pérez|Luis|Buenos|Perfecto|Español|Abandonar|Daily|example|abc-defg/,
  );
});
