// node --test
// The pure transcript logic.
const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helpers/load.js');

load('src/shared/transcript.js');
/* global transcript */

const at = (h, m) => new Date(2026, 10, 12, h, m).getTime();

const meeting = () => ({
  title: 'Daily',
  link: 'https://meet.google.com/abc-defg-hij',
  start: at(10, 30),
  entries: [
    { name: 'Ana', time: at(10, 31), text: 'Hola.' },
    { name: 'Ana', time: at(10, 32), text: 'Empiezo yo.' },
    { name: 'Luis', time: at(10, 33), text: 'Dale.' },
  ],
});

test('an entry is rewritten while the person keeps talking', () => {
  const entries = [];
  const e = transcript.updateEntry(entries, undefined, 'Ana', 'hola a', at(10, 30));
  transcript.updateEntry(entries, e, 'Ana', 'Hola a todos.', at(10, 30));
  assert.deepStrictEqual(entries, [{ name: 'Ana', time: at(10, 30), text: 'Hola a todos.' }]);
});

test('empty text does not create an entry', () => {
  const entries = [];
  assert.strictEqual(transcript.updateEntry(entries, undefined, 'Ana', '', 1), undefined);
  assert.strictEqual(entries.length, 0);
});

test('when Meet empties a long block, what was said before is kept', () => {
  const entries = [];
  const long = 'x'.repeat(500);
  const e = transcript.updateEntry(entries, undefined, 'Ana', long, 1);
  transcript.updateEntry(entries, e, 'Ana', 'Sigo hablando', 2);
  assert.deepStrictEqual(
    entries.map((x) => x.text),
    [long, 'Sigo hablando'],
  );
});

test('a block reused by another person starts a new entry', () => {
  const entries = [];
  const e = transcript.updateEntry(entries, undefined, 'Ana', 'Hola.', 1);
  transcript.updateEntry(entries, e, 'Luis', 'Hola.', 2);
  assert.deepStrictEqual(
    entries.map((x) => x.name),
    ['Ana', 'Luis'],
  );
});

test('toMarkdown groups by speaker and lists the participants', () => {
  const md = transcript.toMarkdown(meeting(), at(11, 0));
  assert.match(
    md,
    /date: 2026-11-12\nstart: "10:30"\nduration_min: 30\nparticipants: \["Ana","Luis"\]/,
  );
  assert.ok(
    md.endsWith(
      '# Daily\n\n**Ana** (10:31)\n\nHola.\n\nEmpiezo yo.\n\n**Luis** (10:33)\n\nDale.\n',
    ),
  );
});

test('the caption language is in the front matter only when known', () => {
  const withLanguage = { ...meeting(), language: 'Español (México)' };
  assert.match(
    transcript.toMarkdown(withLanguage, at(11, 0)),
    /\nlanguage: "Español \(México\)"\n/,
  );
  assert.doesNotMatch(transcript.toMarkdown(meeting(), at(11, 0)), /language:/);
});

test('fromMarkdown recovers what toMarkdown wrote', () => {
  const source = { ...meeting(), title: 'Daily: "equipo"', language: 'Español (México)' };
  assert.deepStrictEqual(transcript.fromMarkdown(transcript.toMarkdown(source, at(11, 0))), {
    title: 'Daily: "equipo"',
    date: '2026-11-12',
    start: '10:30',
    duration: 30,
    participants: ['Ana', 'Luis'],
    language: 'Español (México)',
    turns: [
      { name: 'Ana', time: '10:31', paragraphs: ['Hola.', 'Empiezo yo.'] },
      { name: 'Luis', time: '10:33', paragraphs: ['Dale.'] },
    ],
  });
});

test('fromMarkdown reads transcripts saved before version 2, with Spanish keys', () => {
  const md =
    '---\ntitulo: "Daily"\nfecha: 2026-11-12\ninicio: "10:30"\nduracion_min: 30\n' +
    'participantes: ["Ana"]\nidioma: "Español (México)"\nenlace: https://meet.google.com/x\n---\n\n' +
    '# Daily\n\n**Ana** (10:31)\n\nHola.\n';
  assert.deepStrictEqual(transcript.fromMarkdown(md), {
    title: 'Daily',
    date: '2026-11-12',
    start: '10:30',
    duration: 30,
    participants: ['Ana'],
    language: 'Español (México)',
    turns: [{ name: 'Ana', time: '10:31', paragraphs: ['Hola.'] }],
  });
});

test('fromMarkdown does not fail on text that is not in our format', () => {
  assert.deepStrictEqual(transcript.fromMarkdown('hola').turns, []);
});

test('fileName drops characters that are invalid in file names', () => {
  assert.strictEqual(
    transcript.fileName('Daily: equipo/dev?', at(9, 5)),
    '2026-11-12 0905 - Daily equipo dev.md',
  );
  assert.strictEqual(transcript.fileName('', at(9, 5), 'reunión'), '2026-11-12 0905 - reunión.md');
});

test('summary puts date, time and duration on one line', () => {
  assert.strictEqual(
    transcript.summary({ date: '2026-11-12', start: '10:30', duration: 30 }, 'en'),
    'Nov 12 · 10:30 · 30 min',
  );
});

test('languageMatches compares with the name Meet uses in its interface', () => {
  assert.ok(transcript.languageMatches('Español (México)', 'es', 'es-419'));
  assert.ok(transcript.languageMatches('Spanish (Mexico)', 'es', 'en'));
  assert.ok(!transcript.languageMatches('Inglés', 'es', 'es-419'));
});
