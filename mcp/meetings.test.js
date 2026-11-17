// Runs without the MCP SDK: the root `npm test` picks this file up too.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { MAX_HITS, listMeetings, readMeeting, searchTranscripts } from './meetings.js';
import { createSampleFolder, removeSampleFolder } from './samples.js';

/** @type {string} */
let dir;
before(() => (dir = createSampleFolder()));
after(() => removeSampleFolder(dir));

test('lists only Escriba transcripts in the folder itself, newest first', () => {
  const list = listMeetings({ dir });
  assert.deepEqual(
    list.map((m) => m.file),
    [
      '2026-11-12 1030 - Daily.md',
      '2026-11-10 0900 - Planning.md',
      '2026-10-03 1600 - Retro.md',
      '2026-09-01 0800 - Long.md',
    ],
  );
  assert.deepEqual(list[0], {
    file: '2026-11-12 1030 - Daily.md',
    title: 'Daily',
    date: '2026-11-12',
    start: '10:30',
    duration: 15,
    participants: ['Tú', 'Marta Ibáñez'],
    language: 'Español (México)',
  });
});

test('reads the Spanish front-matter keys written before version 2', () => {
  const retro = readMeeting({ dir }, '2026-10-03 1600 - Retro.md');
  assert.equal(retro.title, 'Retro');
  assert.equal(retro.date, '2026-10-03');
  assert.equal(retro.start, '16:00');
  assert.equal(retro.duration, 30);
  assert.deepEqual(retro.participants, ['Íñigo Peña', 'Tú']);
  assert.equal(retro.language, 'Español (México)');
  assert.equal(retro.link, 'https://meet.google.com/uvw-xyza-bcd');
});

test('filters by date range, both ends inclusive', () => {
  const titles = (/** @type {object} */ filter) =>
    listMeetings({ dir }, filter).map((m) => m.title);
  assert.deepEqual(titles({ from: '2026-11-10' }), ['Daily', 'Planning']);
  assert.deepEqual(titles({ to: '2026-10-03' }), ['Retro', 'Long']);
  assert.deepEqual(titles({ from: '2026-10-03', to: '2026-11-10' }), ['Planning', 'Retro']);
});

test('filters by participant ignoring case and accents', () => {
  const titles = (/** @type {string} */ participant) =>
    listMeetings({ dir }, { participant }).map((m) => m.title);
  assert.deepEqual(titles('ibanez'), ['Daily']);
  assert.deepEqual(titles('INIGO'), ['Retro']);
  assert.deepEqual(titles('nobody'), []);
});

test('replaces "Tú" and "You" with the configured name everywhere', () => {
  const options = { dir, selfName: 'Lucía Ferrer' };
  const list = listMeetings(options, { participant: 'lucia' });
  assert.deepEqual(
    list.map((m) => m.title),
    ['Daily', 'Planning', 'Retro'],
  );
  assert.deepEqual(list[0].participants, ['Lucía Ferrer', 'Marta Ibáñez']);
  assert.deepEqual(list[1].participants, ['Oskar Lindqvist', 'Lucía Ferrer']);
  assert.deepEqual(listMeetings(options, { participant: 'tú' }), []);

  const { hits } = searchTranscripts(options, { query: 'catalog' });
  assert.deepEqual(
    hits.map((h) => h.speaker),
    ['Lucía Ferrer', 'Lucía Ferrer'],
  );
  assert.match(readMeeting(options, '2026-11-12 1030 - Daily.md').text, /^Lucía Ferrer \(10:30\):/);

  // Without the setting, names stay as Meet wrote them; the files never change.
  assert.equal(listMeetings({ dir }, { participant: 'lucia' }).length, 0);
  const onDisk = fs.readFileSync(path.join(dir, '2026-11-12 1030 - Daily.md'), 'utf8');
  assert.match(onDisk, /\*\*Tú\*\* \(10:30\)/);
});

test('searches what was said, ignoring case and accents', () => {
  const { hits, capped } = searchTranscripts({ dir }, { query: 'FACTURACION' });
  assert.equal(capped, false);
  assert.deepEqual(hits, [
    {
      file: '2026-11-12 1030 - Daily.md',
      title: 'Daily',
      date: '2026-11-12',
      speaker: 'Marta Ibáñez',
      time: '10:31',
      text: 'El informe de facturación sale mañana.',
    },
    {
      file: '2026-10-03 1600 - Retro.md',
      title: 'Retro',
      date: '2026-10-03',
      speaker: 'Íñigo Peña',
      time: '16:00',
      text: 'La facturación falló dos veces este mes.',
    },
  ]);
});

test('search honours the date and participant filters', () => {
  const found = (/** @type {object} */ filter) =>
    searchTranscripts({ dir }, { query: 'almacén', ...filter }).hits.map((h) => h.title);
  assert.deepEqual(found({}), ['Daily', 'Retro']);
  assert.deepEqual(found({ to: '2026-10-31' }), ['Retro']);
  assert.deepEqual(found({ participant: 'marta' }), ['Daily']);
});

test('search stops at the cap and says so', () => {
  const { hits, capped } = searchTranscripts({ dir }, { query: 'zebra' });
  assert.equal(hits.length, MAX_HITS);
  assert.equal(capped, true);
  assert.equal(searchTranscripts({ dir }, { query: 'zebra number 7.' }).capped, false);
});

test('reads a whole meeting as text with its metadata', () => {
  assert.deepEqual(readMeeting({ dir }, '2026-11-12 1030 - Daily.md'), {
    file: '2026-11-12 1030 - Daily.md',
    title: 'Daily',
    date: '2026-11-12',
    start: '10:30',
    duration: 15,
    participants: ['Tú', 'Marta Ibáñez'],
    language: 'Español (México)',
    link: 'https://meet.google.com/abc-defg-hij',
    text:
      'Tú (10:30):\nHoy termino la migración del catálogo.\n\n' +
      'Marta Ibáñez (10:31):\nEl informe de facturación sale mañana.\n' +
      'Después reviso los permisos del almacén.',
  });
});

test('refuses files outside the folder and files that are not transcripts', () => {
  const outside = path.basename(dir) + '-outside.md';
  assert.ok(fs.existsSync(path.join(dir, '..', outside)));
  for (const file of [
    `../${outside}`,
    path.join(dir, '..', outside),
    path.join(dir, '2026-11-12 1030 - Daily.md'),
    'old/2026-11-12 1030 - Daily.md',
    '..',
    'notes.md',
    'report.txt',
    'missing.md',
    '2026-01-01 0000 - Folder.md',
  ]) {
    assert.throws(() => readMeeting({ dir }, file), /Not an Escriba transcript/, file);
  }
});

test('a missing folder is an error, not an empty list', () => {
  assert.throws(() => listMeetings({ dir: path.join(dir, 'nope') }), /ENOENT/);
});

test('a second folder is read together with the first', () => {
  const other = fs.mkdtempSync(path.join(path.dirname(dir), 'escriba-mcp-also-'));
  try {
    const name = '2026-12-01 0900 - Planning.md';
    const md = fs
      .readFileSync(path.join(dir, '2026-11-12 1030 - Daily.md'), 'utf8')
      .replace('date: 2026-11-12', 'date: 2026-12-01');
    fs.writeFileSync(path.join(other, name), md);
    const options = { dir, also: [other] };
    assert.equal(listMeetings(options).length, listMeetings({ dir }).length + 1);
    assert.equal(listMeetings(options)[0].file, name);
    assert.equal(readMeeting(options, name).date, '2026-12-01');
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
  }
});
