// Renders docs/images/*.png and docs/store/*.png from the real extension with made-up meetings.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

/* global transcript, STORAGE -- the extension's own, inside the service worker */

const ROOT = path.join(__dirname, '..');
const IMAGES = path.join(ROOT, 'docs', 'images');
const STORE = path.join(ROOT, 'docs', 'store');

/** What the popup is told by the Meet tab: a call in progress. */
const STATUS = { state: 'recording', count: 37, alertKey: null, language: 'English' };

// Fictional meetings, newest first. Each turn is "<minutes after the start> <speaker>: <text>".
const MEETINGS = [
  {
    title: 'Weekly product sync',
    start: '2026-11-18T10:30',
    minutes: 32,
    turns: `
      1 Ana: Good morning, everyone. Let’s start with the release. Marco, where are we with the export feature?
      1.5 Marco: It’s merged. QA found two small issues on Friday and both are fixed. I’d like one more day of testing before we ship it.
      2.5 Ana: One more day works. Priya, does that change anything for the launch post?
      3 Priya: No, the post is ready. I only need the final screenshots, and I can take them as soon as the build is on staging.
      4 Sam: On the support side, the most common question this week was still about exporting to PDF. This release should cut those tickets in half.
      5 Ana: Great. Let’s track that number for the next two weeks.
      6 Marco: One risk: importing older files is slower than we expected. It works, but large files take about a minute.
      7 Priya: Can we show a progress bar? People are fine waiting if they can see something is happening.
      7.5 Marco: Yes, that’s a small change. I’ll add it before Thursday.
      9 Ana: Perfect. Marco ships the export on Wednesday with the progress bar, Priya publishes the post on Thursday, and Sam brings the ticket numbers next week.
      9.5 Sam: Sounds good.`,
  },
  {
    title: 'Q3 roadmap review',
    start: '2026-11-17T16:00',
    minutes: 48,
    turns: `
      0 Lena: Thanks for joining. The goal today is to agree on three themes for next quarter, and on what we drop to make room.
      1 Tomás: From sales, the loudest request is clearer pricing for teams. Prospects ask about it in almost every call.
      2 Lena: Agreed, team pricing is the first theme. Marco, what would it take on the product side?
      3 Marco: Mostly billing work: seats, invoices and a simple admin page. Six weeks with two people.
      5 Priya: I’d make onboarding the second theme. Half of new teams never invite a second person, and that hurts every metric we care about.
      6 Tomás: That matches what I hear. If the first week goes well, they stay.
      8 Lena: Then the third theme is performance on large workspaces. We keep pushing it back and the complaints keep growing.
      9 Marco: To fit all three, we should pause the mobile redesign until next year.
      10 Lena: Fine by me. I’ll write it up today and share it before Friday so everyone can comment.`,
  },
  {
    title: 'Design critique: onboarding',
    start: '2026-11-17T11:00',
    minutes: 25,
    turns: `
      0 Priya: Here’s the new first-run flow. Three steps instead of six, and inviting the team comes second instead of last.
      2 Sam: I like that the empty state explains what to do next. The old one was just a blank page.
      4 Ana: The text on step two is a bit long. Could we cut it to one sentence?
      5 Priya: Yes. I’ll try a shorter version and test both with five people next week.`,
  },
  {
    title: 'Customer interview #12',
    start: '2026-11-14T15:30',
    minutes: 41,
    turns: `
      0 Sam: Thanks for taking the time. Could you walk me through how your team uses the app today?
      1 Jordan: We plan every project in it. The weekly report is what my manager looks at the most.
      3 Sam: What almost made you choose something else?
      3.5 Jordan: Honestly, the pricing page. It wasn’t clear what we’d pay once the team grew past ten people.`,
  },
  {
    title: 'Sprint planning',
    start: '2026-11-13T09:00',
    minutes: 55,
    turns: `
      0 Marco: We have room for about thirty points. The export feature takes most of it.
      2 Lena: Let’s keep a few points for the pricing experiment, so it can start next sprint.
      3 Ana: Then the settings cleanup goes back to the backlog. Nobody is blocked by it.`,
  },
  {
    title: '1:1 Ana / Sam',
    start: '2026-11-12T13:00',
    minutes: 20,
    turns: `
      0 Ana: How did the support rotation go this week?
      1 Sam: Busier than usual, but the new help articles are working. Fewer people ask the same question twice.
      2 Ana: Nice. Let’s share those numbers in the next product sync.`,
  },
].map((meeting) => ({
  ...meeting,
  turns: meeting.turns
    .trim()
    .split('\n')
    .map((line) => {
      const [, at, name, text] = /** @type {RegExpMatchArray} */ (
        line.trim().match(/^([\d.]+) ([^:]+): (.+)$/)
      );
      return [name, Number(at), text];
    }),
}));

/** @param {string} text */
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** @param {Buffer} png */
const img = (png) => `data:image/png;base64,${png.toString('base64')}`;
const icon = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, 'icons', 'icon.svg')).toString('base64')}`;
/** The same color per person as on the transcripts page (history.js). @param {string} name */
const hue = (name) => [...name].reduce((h, c) => (h * 31 + (c.codePointAt(0) || 0)) % 360, 7);

/** Writes the meetings to the extension's history; returns what was stored, by key. */
async function seed(worker) {
  return worker.evaluate(async (meetings) => {
    /** @type {Record<string, { fileName: string, md: string }>} */
    const records = {};
    for (const { title, start: localTime, minutes, turns } of meetings) {
      const start = new Date(localTime).getTime();
      const entries = turns.map(([name, at, text]) => ({ name, time: start + at * 60000, text }));
      const md = transcript.toMarkdown(
        {
          title,
          link: 'https://meet.google.com/abc-defg-hij',
          start,
          entries,
          language: 'English',
        },
        start + minutes * 60000,
      );
      records[STORAGE.HISTORY_PREFIX + start] = { fileName: transcript.fileName(title, start), md };
    }
    await chrome.storage.local.set(records);
    return records;
  }, MEETINGS);
}

/** The real popup and transcripts page, at twice the pixel density. */
async function captureExtension() {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', // the bundled Chromium is the one that runs extensions headless
    locale: 'en-US',
    colorScheme: 'light',
    deviceScaleFactor: 2,
    args: ['--lang=en-US', `--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    const base = `chrome-extension://${new URL(worker.url()).host}/src`;
    const records = await seed(worker);

    // The popup asks the active tab for its status; here that tab is a call in progress.
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 320, height: 100 });
    await popup.addInitScript((status) => {
      chrome.tabs.query = async () => [/** @type {chrome.tabs.Tab} */ ({ id: 1 })];
      chrome.tabs.sendMessage = async () => status;
    }, STATUS);
    await popup.goto(`${base}/popup/popup.html`);
    await popup.locator('#recent li').nth(1).waitFor();
    await popup.locator('#language:not([hidden])').waitFor();
    const shots = { popup: await popup.screenshot({ fullPage: true }) };
    // The store images leave out the bug report row: next to "Transcribing" it reads as an error.
    const { y } = await popup.locator('#report').evaluate((el) => el.getBoundingClientRect());
    shots.menu = await popup.screenshot({
      fullPage: true,
      clip: { x: 0, y: 0, width: 320, height: y },
    });

    const page = await context.newPage();
    await page.setViewportSize({ width: 1120, height: 680 });
    await page.goto(`${base}/history/history.html`);
    await page.locator('#detail .turn').first().waitFor();
    shots.transcripts = await page.screenshot();
    await page.fill('#search', 'pricing');
    await page.locator('#list li').nth(2).waitFor();
    shots.search = await page.screenshot();
    await page.fill('#search', '');
    await page.click('#openSettings');
    await page.mouse.move(600, 600);
    shots.settings = await page.screenshot();

    const [weekly] = Object.values(records).filter((r) => r.md.includes('Weekly product sync'));
    return { ...shots, file: weekly };
  } finally {
    await context.close();
  }
}

const CSS = `
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; overflow: hidden; }
  body { position: relative; font: 16px/1.4 system-ui, sans-serif; color: #1f2328; background: #eef0f3;
         -webkit-font-smoothing: antialiased; }
  h1 { margin: 0; font-size: 50px; line-height: 1.08; letter-spacing: -0.025em; font-weight: 700; }
  .sub { margin: 18px 0 0; font-size: 22px; line-height: 1.45; color: #656d76; }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; font-size: 22px; font-weight: 650; }
  .brand img { width: 44px; height: 44px; }
  .card { background: #fff; border: 1px solid #d8dce1; border-radius: 14px; overflow: hidden;
          box-shadow: 0 30px 70px rgba(31, 35, 40, 0.16), 0 2px 6px rgba(31, 35, 40, 0.06); }
  .card > img { display: block; width: 100%; }
  .top { position: absolute; left: 0; right: 0; top: 56px; text-align: center; }
  .top .sub { margin-top: 12px; }
  .bleed { position: absolute; left: 80px; right: 80px; top: 214px; border-bottom: 0;
           border-radius: 14px 14px 0 0; }
`;

const brand = `<div class="brand"><img src="${icon}" alt="" />Escriba</div>`;

/** A dark call with four people, and the popup open over it. */
function callScene(popup) {
  const tile = (name) =>
    `<div class="tile"><span class="avatar" style="background: hsl(${hue(name)} 45% 42%)">${name[0]}</span>
      <span class="name">${name}</span></div>`;
  const tiles = ['Ana', 'Marco', 'Priya', 'Sam'].map(tile).join('');
  return `
    <style>
      .call { position: absolute; left: 600px; top: 150px; width: 620px; height: 500px; padding: 14px;
              display: grid; grid-template: 1fr 1fr / 1fr 1fr; gap: 10px; border-radius: 22px; background: #202124; }
      .tile { position: relative; display: grid; place-items: center; border-radius: 12px; background: #3c4043; }
      .avatar { display: grid; place-items: center; width: 76px; height: 76px; border-radius: 50%;
                color: #fff; font-size: 32px; font-weight: 600; }
      .tile .name { position: absolute; left: 12px; bottom: 9px; color: #e8eaed; font-size: 14px; }
      .badge { position: absolute; left: 1150px; top: 52px; width: 52px; height: 52px; padding: 6px;
               border-radius: 12px; background: #fff; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25); }
      .badge img { width: 40px; height: 40px; }
      .badge span { position: absolute; right: -12px; bottom: -4px; padding: 1px 5px; border-radius: 5px;
                    background: #d93025; color: #fff; font-size: 12px; font-weight: 700; }
      .popup { position: absolute; left: 820px; top: 120px; width: 420px; }
    </style>
    <div class="call">${tiles}</div>
    <div class="badge"><img src="${icon}" alt="" /><span>REC</span></div>
    <div class="card popup"><img src="${img(popup)}" alt="" /></div>`;
}

/** A Markdown file as it sits in Downloads, lightly colored. */
function markdownFile({ fileName, md }) {
  let inHead = false;
  const lines = md
    .trimEnd()
    .split('\n')
    .map((line) => {
      if (line === '---') {
        inHead = !inHead;
        return `<span class="m">---</span>`;
      }
      const field = inHead && line.match(/^(\w+): (.*)$/);
      if (field) return `<span class="m">${field[1]}:</span> ${esc(field[2])}`;
      const turn = line.match(/^\*\*(.+)\*\* \((\d\d:\d\d)\)$/);
      if (turn)
        return `<b style="color: hsl(${hue(turn[1])} 60% 38%)">**${esc(turn[1])}**</b> <span class="m">(${turn[2]})</span>`;
      if (line.startsWith('# ')) return `<b>${esc(line)}</b>`;
      return esc(line);
    });
  return `
    <style>
      .file { position: absolute; left: 520px; right: 56px; top: 56px; bottom: -20px; }
      .file header { display: flex; gap: 8px; align-items: center; padding: 12px 18px; border-bottom: 1px solid #d8dce1;
                     background: #f6f7f9; color: #656d76; font-size: 14px; }
      .file header b { color: #1f2328; font-weight: 600; }
      pre { margin: 0; padding: 18px 22px; font: 14.5px/1.6 ui-monospace, Menlo, monospace; white-space: pre-wrap; }
      .m { color: #8c959f; }
    </style>
    <div class="card file">
      <header>Downloads / transcripciones-meet / <b>${esc(fileName)}</b></header>
      <pre>${lines.join('\n')}</pre>
    </div>`;
}

/** @param {string} paths SVG drawn on a 24 × 24 grid */
const glyph = (paths) =>
  `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const SLASH = '<path d="M3 3l18 18" />';
const PROMISES = [
  [
    'No bot in the call',
    'It reads the captions Google Meet already shows you. Nobody else joins.',
    glyph(
      '<rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V5M2 13v2M22 13v2" /><circle cx="12" cy="4" r="1" /><circle cx="8.5" cy="13.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="15.5" cy="13.5" r="1.3" fill="currentColor" stroke="none" />' +
        SLASH,
    ),
  ],
  [
    'No audio recorded',
    'Only the caption text is kept: no sound, no video, no chat.',
    glyph(
      '<rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />' +
        SLASH,
    ),
  ],
  [
    'No servers, no analytics',
    'No network requests, no accounts, no remote code. Not even the developer sees anything.',
    glyph(
      '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5 4.75 4.75 0 0 1 17.5 18Z" />' + SLASH,
    ),
  ],
  [
    'Yours, on your disk',
    'Each meeting is a .md file in Downloads, plus a copy in this browser that you can delete.',
    glyph(
      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h4" />',
    ),
  ],
];

/** Every store image: file name, size and the HTML that draws it. */
function storeImages(shots) {
  const shot = (png) => `<div class="card bleed"><img src="${img(png)}" alt="" /></div>`;
  return [
    [
      'screenshot-1.png',
      1280,
      800,
      `<div style="position: absolute; left: 72px; top: 235px; width: 470px">
        ${brand}
        <h1>Transcribes Google Meet to Markdown</h1>
        <p class="sub">No bot joins the call. Escriba reads the captions Meet already shows and
          writes down who said what.</p>
      </div>${callScene(shots.menu)}`,
    ],
    [
      'screenshot-2.png',
      1280,
      800,
      `<div class="top"><h1>Every meeting, searchable</h1>
        <p class="sub">Search by title, person or anything that was said. Copy or download it again.</p></div>
       ${shot(shots.search)}`,
    ],
    [
      'screenshot-3.png',
      1280,
      800,
      `<div style="position: absolute; left: 72px; top: 200px; width: 400px">
        ${brand}
        <h1>Plain Markdown, ready to use</h1>
        <p class="sub">Who spoke and when, in a file you can paste into notes, a doc or an AI
          assistant.</p>
      </div>${markdownFile(shots.file)}`,
    ],
    [
      'screenshot-4.png',
      1280,
      800,
      `<style>
        .grid { position: absolute; left: 120px; right: 120px; top: 300px; display: grid;
                grid-template-columns: 1fr 1fr; gap: 24px; }
        .grid .card { display: flex; gap: 20px; padding: 32px; box-shadow: 0 2px 8px rgba(31, 35, 40, 0.06); }
        .grid svg { flex: none; padding: 12px; border-radius: 12px; background: #e8f0fe; color: #1a73e8;
                    box-sizing: content-box; }
        .grid h2 { margin: 2px 0 6px; font-size: 24px; letter-spacing: -0.01em; }
        .grid p { margin: 0; font-size: 18px; line-height: 1.45; color: #656d76; }
      </style>
      <div class="top" style="top: 112px"><h1>Nothing leaves your computer</h1>
        <p class="sub">Your meetings are nobody else’s business, including ours.</p></div>
      <div class="grid">${PROMISES.map(
        ([title, text, svg]) =>
          `<div class="card">${svg}<div><h2>${title}</h2><p>${text}</p></div></div>`,
      ).join('')}</div>`,
    ],
    [
      'screenshot-5.png',
      1280,
      800,
      `<div class="top"><h1>Automatic, or only when you say so</h1>
        <p class="sub">Transcribe every meeting you join, or press Transcribe only in the ones you choose.</p></div>
       ${shot(shots.settings)}`,
    ],
    [
      'promo-small.png',
      440,
      280,
      `<style>body { background: #24272b; color: #fff; }</style>
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;
                  height: 280px; text-align: center">
        <img src="${icon}" alt="" style="width: 96px; height: 96px" />
        <div style="margin-top: 14px; font-size: 38px; font-weight: 700; letter-spacing: -0.02em">Escriba</div>
        <div style="margin-top: 2px; font-size: 19px; color: #c4c9cf">Google Meet to Markdown</div>
      </div>`,
    ],
    [
      'promo-marquee.png',
      1400,
      560,
      `<style>body { background: #24272b; color: #fff; }</style>
      <div style="position: absolute; left: 110px; top: 165px; width: 640px">
        <div style="display: flex; align-items: center; gap: 22px">
          <img src="${icon}" alt="" style="width: 104px; height: 104px" />
          <div style="font-size: 64px; font-weight: 700; letter-spacing: -0.025em">Escriba</div>
        </div>
        <div style="margin-top: 26px; font-size: 34px; line-height: 1.3; font-weight: 600">
          Transcribe Google Meet to Markdown</div>
        <div style="margin-top: 10px; font-size: 24px; color: #c4c9cf">No bot in the call. Nothing leaves your computer.</div>
      </div>
      <div class="card" style="position: absolute; left: 880px; top: 127px; width: 420px; border: 0">
        <img src="${img(shots.menu)}" alt="" /></div>`,
    ],
  ];
}

async function main() {
  const shots = await captureExtension();
  fs.mkdirSync(IMAGES, { recursive: true });
  fs.mkdirSync(STORE, { recursive: true });
  fs.writeFileSync(path.join(IMAGES, 'popup.png'), shots.popup);
  fs.writeFileSync(path.join(IMAGES, 'transcripts.png'), shots.transcripts);

  const browser = await chromium.launch();
  try {
    for (const [name, width, height, body] of storeImages(shots)) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${CSS}</style>${body}`);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(STORE, name) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`Written to ${path.relative(ROOT, IMAGES)} and ${path.relative(ROOT, STORE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
