// Reads the folder where Escriba saves its transcripts. Only reads, and only node: modules:
// the MCP SDK stays in server.js so this file can be tested without installing anything.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * `also`: more folders read together with `dir` (Escriba names its folder after the
 * browser's language, so one computer can have two).
 * @typedef {{ dir: string, also?: string[], selfName?: string }} Options
 * @typedef {{ from?: string, to?: string, participant?: string }} Filter
 * @typedef {{ name: string, time: string, paragraphs: string[] }} Turn
 * @typedef {{ file: string, title: string, date: string, start: string, duration: number,
 *             participants: string[], language: string }} Summary
 * @typedef {Summary & { link: string, turns: Turn[] }} Meeting
 * @typedef {{ file: string, title: string, date: string, speaker: string, time: string,
 *             text: string }} Hit
 */

// The extension's own parser, loaded the way the browser does: a classic script that
// declares the global `transcript`. The npm package carries a copy (made by `prepack`); in the
// repository it is read from the extension's source.
const bundled = path.join(import.meta.dirname, 'transcript.js');
const parserFile = fs.existsSync(bundled)
  ? bundled
  : path.join(import.meta.dirname, '..', 'src', 'shared', 'transcript.js');
const transcript = vm.runInThisContext(fs.readFileSync(parserFile, 'utf8') + '\ntranscript', {
  filename: parserFile,
});

export const MAX_HITS = 50;

/** @param {string} text */
const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
/** @param {Options} options */
const dirs = ({ dir, also = [] }) => [dir, ...also];

/**
 * @param {Options} options
 * @param {string} dir one of the folders
 * @param {string} file name inside it
 * @returns {Meeting | undefined} undefined when it is not a readable Escriba transcript
 */
function load({ selfName }, dir, file) {
  try {
    const md = fs.readFileSync(path.join(dir, file), 'utf8');
    const head = md.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '';
    const isEscriba =
      /^(date|fecha): \d{4}-\d\d-\d\d$/m.test(head) &&
      /^(duration_min|duracion_min): \d+$/m.test(head);
    if (!isEscriba) return undefined;
    // Meet labels the user's own speech "Tú" or "You", depending on its language.
    /** @param {string} name */
    const rename = (name) => (selfName && (name === 'Tú' || name === 'You') ? selfName : name);
    const parsed = transcript.fromMarkdown(md);
    return {
      file,
      title: parsed.title,
      date: parsed.date,
      start: parsed.start,
      duration: parsed.duration,
      participants: [...new Set(parsed.participants.map(rename))],
      language: parsed.language,
      link: head.match(/^(?:link|enlace): (.*)$/m)?.[1] ?? '',
      turns: parsed.turns.map((/** @type {Turn} */ turn) => ({ ...turn, name: rename(turn.name) })),
    };
  } catch {
    return undefined;
  }
}

/**
 * @param {Options} options
 * @param {Filter} filter
 * @returns {Meeting[]} newest first
 */
function meetings(options, { from, to, participant }) {
  const who = participant && fold(participant);
  return dirs(options)
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.md'))
        .flatMap((file) => load(options, dir, file) ?? []),
    )
    .filter(
      (m) =>
        (!from || m.date >= from) &&
        (!to || m.date <= to) &&
        (!who || m.participants.some((name) => fold(name).includes(who))),
    )
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
}

/**
 * @param {Options} options
 * @param {Filter} [filter] dates as YYYY-MM-DD, inclusive
 * @returns {Summary[]} newest first
 */
export function listMeetings(options, filter = {}) {
  return meetings(options, filter).map((m) => ({
    file: m.file,
    title: m.title,
    date: m.date,
    start: m.start,
    duration: m.duration,
    participants: m.participants,
    language: m.language,
  }));
}

/**
 * @param {Options} options
 * @param {Filter & { query: string }} search
 * @returns {{ hits: Hit[], capped: boolean }} at most MAX_HITS paragraphs, newest meeting first
 */
export function searchTranscripts(options, { query, ...filter }) {
  const needle = fold(query);
  /** @type {Hit[]} */
  const hits = [];
  for (const m of meetings(options, filter)) {
    for (const turn of m.turns) {
      for (const text of turn.paragraphs) {
        if (!fold(text).includes(needle)) continue;
        if (hits.length === MAX_HITS) return { hits, capped: true };
        hits.push({
          file: m.file,
          title: m.title,
          date: m.date,
          speaker: turn.name,
          time: turn.time,
          text,
        });
      }
    }
  }
  return { hits, capped: false };
}

/**
 * @param {Options} options
 * @param {string} file a name returned by listMeetings or searchTranscripts
 * @returns {Summary & { link: string, text: string }}
 */
export function readMeeting(options, file) {
  // A bare file name cannot leave the folder; anything with a directory part is refused.
  const bare = path.basename(file) === file && file.endsWith('.md');
  const meeting = bare
    ? dirs(options)
        .map((dir) => load(options, dir, file))
        .find(Boolean)
    : undefined;
  if (!meeting) throw new Error(`Not an Escriba transcript in the folder: ${file}`);
  const { turns, ...metadata } = meeting;
  const text = turns.map((t) => `${t.name} (${t.time}):\n${t.paragraphs.join('\n')}`).join('\n\n');
  return { ...metadata, text };
}
