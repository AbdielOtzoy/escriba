// @ts-check
// Pure transcript logic: no DOM and no chrome.* APIs, so it runs under Node for tests.

/**
 * One uninterrupted stretch of speech by one person.
 * @typedef {{ name: string, time: number, text: string }} Entry
 *
 * @typedef {{ title: string, link: string, start: number, entries: Entry[], language?: string }} Meeting
 *
 * A transcript read back from Markdown.
 * @typedef {{ name: string, time: string, paragraphs: string[] }} Turn
 * @typedef {{ title: string, date: string, start: string, duration: number,
 *             participants: string[], language: string, turns: Turn[] }} ParsedTranscript
 */

const transcript = (() => {
  /** @param {number} n */
  const pad = (n) => String(n).padStart(2, '0');
  /** @param {Date} d */
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /** @param {Date} d */
  const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  /**
   * Applies the latest text of a caption block to the entry list.
   *
   * Meet rewrites a block's text while the person talks (it corrects words), so the
   * entry is replaced whole. When the text suddenly gets much shorter, Meet emptied a
   * long block and started over: that opens a new entry instead of losing the old one.
   *
   * @param {Entry[]} entries mutated in place
   * @param {Entry | undefined} entry the entry this block has been feeding, if any
   * @param {string} name
   * @param {string} text
   * @param {number} now epoch ms
   * @returns {Entry | undefined} the entry the block feeds from now on
   */
  function updateEntry(entries, entry, name, text, now) {
    if (!text) return entry;
    if (!entry || entry.name !== name || text.length < entry.text.length - 100) {
      entry = { name, time: now, text };
      entries.push(entry);
    } else {
      entry.text = text;
    }
    return entry;
  }

  /**
   * @param {Meeting} meeting
   * @param {number} end epoch ms
   * @returns {string}
   */
  function toMarkdown({ title, link, start, entries, language }, end) {
    const startDate = new Date(start);
    const participants = [...new Set(entries.map((e) => e.name))];
    let md =
      `---\ntitle: ${JSON.stringify(title)}\ndate: ${isoDate(startDate)}\n` +
      `start: "${clock(startDate)}"\n` +
      `duration_min: ${Math.round((end - start) / 60000)}\n` +
      `participants: ${JSON.stringify(participants)}\n` +
      (language ? `language: ${JSON.stringify(language)}\n` : '') +
      `link: ${link}\n---\n\n# ${title}\n`;
    let previous;
    for (const e of entries) {
      md += e.name === previous ? '\n' : `\n**${e.name}** (${clock(new Date(e.time))})\n\n`;
      md += e.text + '\n';
      previous = e.name;
    }
    return md;
  }

  /**
   * Inverse of toMarkdown. The history stores only the Markdown, and the popup and the
   * history page read it back to show metadata and formatted turns.
   *
   * Also reads the Spanish front-matter keys written before version 2.
   *
   * @param {string} md
   * @returns {ParsedTranscript}
   */
  function fromMarkdown(md) {
    const [, head = '', body = md] = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || [];
    /** @param {...string} keys */
    const field = (...keys) => {
      for (const key of keys) {
        const found = head.match(new RegExp(`^${key}: (.*)$`, 'm'));
        if (found) return found[1];
      }
      return undefined;
    };
    /**
     * @template T
     * @param {string | undefined} value
     * @param {T} fallback
     * @returns {T}
     */
    const json = (value, fallback) => {
      try {
        return JSON.parse(value ?? '');
      } catch {
        return fallback;
      }
    };
    /** @type {Turn[]} */
    const turns = [];
    for (const line of body.split('\n')) {
      const heading = line.match(/^\*\*(.+)\*\* \((\d\d:\d\d)\)$/);
      if (heading) turns.push({ name: heading[1], time: heading[2], paragraphs: [] });
      else if (line.trim() && turns.length) turns[turns.length - 1].paragraphs.push(line);
    }
    return {
      title: json(field('title', 'titulo'), ''),
      date: field('date', 'fecha') || '',
      start: json(field('start', 'inicio'), ''),
      duration: Number(field('duration_min', 'duracion_min')) || 0,
      participants: json(field('participants', 'participantes'), []),
      language: json(field('language', 'idioma'), ''),
      turns,
    };
  }

  /**
   * @param {string} title
   * @param {number} start epoch ms
   * @param {string} [fallbackTitle] used when the title has no usable characters
   * @returns {string} e.g. "2026-11-12 1030 - Daily.md"
   */
  function fileName(title, start, fallbackTitle = 'meeting') {
    const d = new Date(start);
    const clean = title
      .replace(/[\\/:*?"<>|~]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    return `${isoDate(d)} ${pad(d.getHours())}${pad(d.getMinutes())} - ${clean || fallbackTitle}.md`;
  }

  /**
   * @param {Pick<ParsedTranscript, 'date' | 'start' | 'duration'>} parsed
   * @param {string} [locale]
   * @returns {string} e.g. "12 nov · 10:30 · 30 min"
   */
  function summary({ date, start, duration }, locale) {
    const d = new Date(`${date}T${start || '00:00'}`);
    const day = isNaN(d.getTime())
      ? date
      : d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return [day, start, `${duration} min`].filter(Boolean).join(' · ');
  }

  /**
   * Is the caption language, as Meet writes it ("Español (México)"), the language
   * `code` ("es")?
   *
   * @param {string} captionLanguage
   * @param {string} code two-letter language code
   * @param {string} uiLocale the locale Meet writes language names in
   * @returns {boolean}
   */
  function languageMatches(captionLanguage, code, uiLocale) {
    const name = new Intl.DisplayNames([uiLocale], { type: 'language' }).of(code) || code;
    return captionLanguage.toLowerCase().startsWith(name.toLowerCase());
  }

  return { updateEntry, toMarkdown, fromMarkdown, fileName, summary, languageMatches };
})();
