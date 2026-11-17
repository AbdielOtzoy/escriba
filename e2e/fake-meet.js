// A fake Google Meet call, built from the samples in test/fixtures plus the little
// behavior the extension depends on: the two-click captions menu, caption blocks that are
// rewritten while someone talks, and leaving. Served in place of meet.google.com.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const fixture = (name) =>
  fs.readFileSync(path.join(__dirname, '..', 'test', 'fixtures', name), 'utf8');

/** Runs in the page. Exposes `window.fakeMeet` for the tests to drive the call. */
function pageScript() {
  const main = /** @type {HTMLElement} */ (document.querySelector('main'));
  const strip = /** @type {HTMLElement} */ (document.querySelector('[style*="bottom: 80px"]'));
  const region = /** @type {HTMLElement} */ (strip.querySelector('[role="region"]'));
  const menu = /** @type {HTMLElement} */ (
    document.querySelector('[aria-label="Subtítulos y traducción"]')
  );
  const dialog = /** @type {HTMLTemplateElement} */ (document.getElementById('fake-menu')).content
    .firstElementChild;

  // The sample has no stylesheet: give the strip a height, as in Meet.
  strip.style.position = 'absolute';
  strip.style.height = '216px';

  // The call starts with captions off and nobody having spoken.
  const spoken = [...region.querySelectorAll('img')].map((img) => img.parentElement.parentElement);
  const blockTemplate = spoken[0];
  for (const block of spoken) block.remove();
  const tail = region.firstElementChild;
  strip.remove();
  menu.setAttribute('aria-pressed', 'false');

  const closeMenu = () => {
    dialog?.remove();
    menu.setAttribute('aria-expanded', 'false');
  };
  // The toolbar button only opens a menu; pressing it again closes the menu.
  menu.addEventListener('click', () => {
    if (menu.getAttribute('aria-expanded') === 'true') return closeMenu();
    menu.after(/** @type {Element} */ (dialog));
    menu.setAttribute('aria-expanded', 'true');
  });
  // The real button is inside the menu, which stays open after captions turn on.
  dialog?.querySelector('#turn-on')?.addEventListener('click', () => {
    main.after(strip);
    menu.setAttribute('aria-pressed', 'true');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  /** @type {Map<string, Element>} */
  const blocks = new Map();
  Object.assign(window, {
    fakeMeet: {
      /**
       * Shows `text` as what `name` is saying in caption block `id`; the same id again
       * rewrites that block, as Meet does while the person keeps talking.
       * @param {string} id @param {string} name @param {string} text
       */
      say(id, name, text) {
        let block = blocks.get(id);
        if (!block) {
          block = /** @type {Element} */ (blockTemplate?.cloneNode(true));
          /** @type {Element} */ (block.querySelector('span')).textContent = name;
          blocks.set(id, block);
          region.insertBefore(block, tail);
        }
        /** @type {Element} */ (block.lastElementChild).textContent = text;
      },
      leave() {
        document.querySelector('[aria-label="Abandonar la llamada"]')?.remove();
        strip.remove();
      },
    },
  });
}

/** @returns {string} the HTML of the fake call */
function fakeMeetHtml() {
  const menu = new JSDOM(fixture('call-captions-off.html')).window.document.querySelector(
    '[role="dialog"]',
  );
  return fixture('call-captions-on.html').replace(
    '</body>',
    `<title>Meet: Weekly sync</title>
     <template id="fake-menu">${menu?.outerHTML}</template>
     <script>(${pageScript})()</script></body>`,
  );
}

module.exports = { fakeMeetHtml };
