# Agent guide — Escriba

Escriba is a Manifest V3 browser extension that transcribes Google Meet calls to Markdown
by reading the captions Meet renders. No bot joins the call, no audio is recorded and
nothing is sent anywhere. `README.md` describes what the user sees; this file is what you
need to change the code safely.

If `AGENTS.local.md` exists next to this file, read it too: it holds the maintainer's
private, machine-specific context and is not committed.

## Commands

```
npm install     # development tools only
npm run check   # lint + format check + type check + tests; must pass before committing
npm test        # tests only
npm run format  # fix formatting
```

## How the code is put together

There is **no build step and no runtime dependency**. The browser loads the files in
`src/` as they are. Keep it that way: do not add a bundler, TypeScript sources, a framework
or a library to the extension. `devDependencies` are for tooling only.

Every source file is a **classic script that declares exactly one top-level name** (an
object returned by an IIFE, or an anonymous IIFE for entry points). Files see each other
through those globals, in load order. There are no `import`, `export` or `module.exports`.

Adding or renaming a source file therefore means updating every place that lists them:

1. `manifest.json` (`content_scripts[].js`), for files used inside Meet.
2. The `<script>` tags of `src/popup/popup.html` and `src/history/history.html`.
3. `importScripts(...)` in `src/background/service-worker.js`.
4. `extensionGlobals` in `eslint.config.js`, if it declares a new global.
5. The `load(...)` calls in the tests that need it.

| Path                               | Responsibility                                                         |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `src/content/meet-dom.js`          | The only file that knows Meet's HTML                                   |
| `src/content/layout.js`            | Hides the captions and gives their space back to the video             |
| `src/content/watchdog.js`          | Decides when "not transcribing" must be reported                       |
| `src/content/main.js`              | State of the meeting, the 2 s tick, messaging. Coordinates the others  |
| `src/page/viewport-patch.js`       | Runs in the page's JS world; pairs with `layout.js`                    |
| `src/background/service-worker.js` | Writes files, keeps the history, recovers unsaved meetings, icon badge |
| `src/popup/`, `src/history/`       | The icon menu and the transcripts page                                 |
| `src/shared/transcript.js`         | Pure logic: entries, Markdown out and back. No DOM, no `chrome.*`      |
| `src/shared/constants.js`          | `MSG`, `STATE`, `STORAGE`, `DEFAULT_SETTINGS`                          |
| `src/shared/history.js`, `i18n.js` | Saved transcripts and texts, shared by worker and pages                |
| `_locales/en`, `_locales/es`       | Every user-facing text                                                 |
| `test/fixtures/`                   | Samples of Meet's HTML that the adapter tests run against              |

## Rules

- **Meet's HTML is touched only in `meet-dom.js`.** Find elements by icon name first
  (`<i>call_end</i>` and the like do not change with the interface language), by ARIA
  label only as a fallback, and never by CSS class: Meet regenerates class names.
- **A change to `meet-dom.js` comes with a fixture.** Update or add a sample in
  `test/fixtures/` and a test in `test/meet-dom.test.js`. Fixtures contain no real names,
  meeting codes or sentences.
- **No string literals for messages, states or storage keys.** Use `MSG`, `STATE` and
  `STORAGE`. A new message type is added there, with a comment saying who sends it to whom.
- **No user-facing text in code.** Add the key to both `_locales/en/messages.json` and
  `_locales/es/messages.json` and read it with `i18n.t()` or a `data-i18n` attribute.
- **Build DOM with `createElement` and `textContent`, never `innerHTML`.** Meet enforces
  Trusted Types, and transcript text is untrusted input in the extension pages.
- **Every `chrome.*` call in the content script goes through `extension()` / `send()`** in
  `main.js`. After the extension is reloaded the old script keeps running in the page and
  those calls throw; the wrapper shuts it down.
- **Saved data stays readable.** `transcript.fromMarkdown()` and `historyStore.list()`
  accept the Spanish field names written before version 2 (`titulo`, `archivo`…). Do not
  remove that, and keep a reader for the old shape whenever the format changes again.
- **Privacy is the product.** No network requests, analytics or remote code. A new
  permission in `manifest.json` needs the maintainer's explicit approval.
- **Types come from JSDoc.** Exported functions get `@param`/`@returns`; `npm run typecheck`
  runs with `strict`.

## Things that were learned the hard way

Do not "simplify" these without testing in a real call.

- **Turning captions on is two clicks.** The toolbar button (`translate_cc`) only opens a
  menu; the real button (`closed_caption_off`) is inside it. Pressing the toolbar button
  again while its menu is open, or closing the menu before the captions appear, cancels
  the activation. Once they are on, Escape closes the menu safely.
- **Meet sizes the video from `document.documentElement.clientHeight`,** not from what it
  measures. That is why hidden captions still leave an empty strip unless
  `viewport-patch.js` reports a taller window. `layout.js` writes the extra height in
  `<html data-escriba-extra>`; the two files must agree on that attribute.
- **Three things sit on top of the caption strip** and each needs its own correction, all
  in `layout.js`: the video size, the bottom edge of `<main>` (emoji reactions float up
  from it) and the notices stacked above the strip (chat message previews).
- **Meet rewrites inline styles** on those elements, so `layout.hideCaptions()` is called
  on every tick rather than once.
- **Capture is driven by a `MutationObserver`, not by the timer.** Browsers throttle timers
  in background tabs to as little as once a minute. The 2 s tick only handles joining,
  leaving, re-enabling captions and the backup.
- **A caption block's text is rewritten while the person talks,** and emptied when it gets
  long. `transcript.updateEntry()` handles both; an entry is replaced, not appended to.
- **Meet has no automatic language detection,** and text captured in the wrong language is
  still made of valid words, so a mismatch cannot be detected from the text.

## Testing

`npm test` covers the pure logic, the Meet adapter against the fixtures, the watchdog, and
the content script end to end with a simulated browser (`test/content.test.js`).

`npm run test:e2e` (Playwright, in `e2e/`; once: `npx playwright install chromium`) loads
the real extension in Chromium against a fake Meet page built from the fixtures. It is
not part of `npm run check`; CI runs it as a separate job.

It does not cover real Meet. After changing anything under `src/content/` or `src/page/`,
the change is not verified until someone reloads the extension at `chrome://extensions`
and checks in a call (`https://meet.new` creates one):

1. The icon shows **REC** within a few seconds and captions turn on by themselves.
2. No captions are visible and the video uses the full height.
3. An emoji reaction floats up from just above the toolbar.
4. The icon menu shows the caption language and the turn count grows while someone talks.
5. On leaving, a `.md` file appears in the downloads folder and in the transcripts page.

An agent cannot reload the extension. Say so, and ask the maintainer to do it, instead of
reporting the change as verified.

## Commits

Conventional Commits in English (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`),
one commit per reviewable unit, tests in the same commit as the behavior they cover. Bump
`version` in `manifest.json` and `package.json` together when behavior changes.
