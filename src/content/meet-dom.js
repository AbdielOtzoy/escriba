// @ts-check
// Everything that depends on Google Meet's HTML lives in this file. When Google changes
// the page and the extension stops capturing, this is the only place to adjust, and
// test/meet-dom.test.js (with the samples in test/fixtures) is where to reproduce it.
//
// Elements are found by their icon name first: Meet renders icons as text ligatures
// (<i>call_end</i>) that do not change with the interface language. Labels are only a
// fallback, and CSS class names are never used because Meet regenerates them.

const meetDom = (() => {
  const ICON = Object.freeze({
    LEAVE_CALL: 'call_end',
    CAPTIONS_OFF: 'closed_caption_off',
    CAPTIONS_MENU: 'translate_cc',
    LANGUAGE: 'language',
    SETTINGS: 'settings',
  });

  const LABEL = Object.freeze({
    LEAVE_CALL: /leave call|salir de la llamada|abandonar la llamada/i,
    TURN_ON_CAPTIONS: /turn on captions|activar (los )?subt[ií]tulos/i,
    CAPTIONS_REGION: /captions|subt[ií]tulos/i,
  });

  /** @param {Element} el @param {string} name */
  const attr = (el, name) => el.getAttribute(name) || '';

  /**
   * The element inside `root` whose whole text is the icon name.
   * @param {ParentNode} root
   * @param {string} icon
   */
  function iconLeaf(root, icon) {
    return [...root.querySelectorAll('*')].find(
      (el) => !el.children.length && (el.textContent || '').trim() === icon,
    );
  }

  /**
   * @param {string} icon
   * @param {RegExp} [label] fallback, matched against aria-label
   * @returns {HTMLButtonElement | undefined}
   */
  function findButton(icon, label) {
    return [...document.querySelectorAll('button')].find(
      (b) => iconLeaf(b, icon) || (label && label.test(attr(b, 'aria-label'))),
    );
  }

  /** Is this tab inside a call (not the lobby, not the "you left" screen)? */
  const inCall = () => !!findButton(ICON.LEAVE_CALL, LABEL.LEAVE_CALL);

  /** The live caption list, present only while captions are on. */
  function captionRegion() {
    return (
      [...document.querySelectorAll('[role="region"]')].find((r) =>
        LABEL.CAPTIONS_REGION.test(attr(r, 'aria-label')),
      ) || document.querySelector('div[role="region"][tabindex="0"]')
    );
  }

  /**
   * The strip Meet reserves for captions: the caption list plus its language and style
   * controls. It is the outermost ancestor of the region that does not contain <main>.
   * @param {Element} region
   * @returns {HTMLElement}
   */
  function captionBox(region) {
    let box = region;
    while (box.parentElement && !box.parentElement.querySelector('main')) box = box.parentElement;
    return /** @type {HTMLElement} */ (box);
  }

  /**
   * Each turn is a block of [avatar + name] followed by the text. Blocks are located
   * through the avatar image: the name element is the closest ancestor of the image
   * that has text and a following sibling without an image, which is the text.
   *
   * @param {Element} region
   * @returns {Map<Element, { name: string, text: string }>} keyed by block element
   */
  function readBlocks(region) {
    const blocks = new Map();
    for (const img of region.querySelectorAll('img')) {
      let el = img.parentElement;
      while (el && el !== region) {
        const next = el.nextElementSibling;
        if ((el.textContent || '').trim() && next && !next.querySelector('img')) {
          blocks.set(el.parentElement, {
            name: (el.textContent || '').trim(),
            text: (next.textContent || '').trim(),
          });
          break;
        }
        el = el.parentElement;
      }
    }
    return blocks;
  }

  /**
   * The caption language as Meet shows it next to the globe icon, e.g. "Español (México)".
   * @param {Element} box
   * @returns {string} empty when it cannot be read
   */
  function captionLanguage(box) {
    let el = iconLeaf(box, ICON.LANGUAGE);
    while (el && el !== box && (el.textContent || '').trim() === ICON.LANGUAGE) {
      el = el.parentElement || undefined;
    }
    return el && el !== box ? (el.textContent || '').replace(ICON.LANGUAGE, '').trim() : '';
  }

  /**
   * Opens Meet's settings dialog on the captions tab, where the language is chosen.
   * @param {Element} box
   */
  function openLanguageSettings(box) {
    iconLeaf(box, ICON.SETTINGS)?.closest('button')?.click();
  }

  /** The captions menu button whose menu this script opened and still has to close. */
  /** @type {HTMLButtonElement | null} */
  let openedMenu = null;

  /**
   * Turns captions on. Safe to call repeatedly until captionRegion() appears.
   *
   * Current Meet: the toolbar button ("Captions and translation") only opens a menu, and
   * the real "Turn on captions" button is inside it. Older Meet had that button directly
   * in the toolbar. Both are handled by looking for the real button first.
   */
  function turnCaptionsOn() {
    const turnOn = () => findButton(ICON.CAPTIONS_OFF, LABEL.TURN_ON_CAPTIONS);
    const direct = turnOn();
    if (direct) return direct.click();
    const menu = [...document.querySelectorAll('button')].find(
      (b) =>
        (b.textContent || '').trim() === ICON.CAPTIONS_MENU && attr(b, 'aria-expanded') !== 'true',
    );
    if (!menu) return;
    menu.click();
    openedMenu = menu;
    setTimeout(() => turnOn()?.click(), 600);
  }

  /**
   * Closes the captions menu if turnCaptionsOn() left it open. Call it only once captions
   * are on: Escape then closes the menu and leaves them on, whereas closing the menu
   * before they turn on cancels the activation.
   */
  function closeCaptionsMenu() {
    if (openedMenu && attr(openedMenu, 'aria-expanded') === 'true') {
      (document.activeElement || document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
      );
    }
    openedMenu = null;
  }

  /** @returns {string} */
  function meetingTitle() {
    const titled = /** @type {HTMLElement | null} */ (
      document.querySelector('[data-meeting-title]')
    );
    return (
      titled?.dataset.meetingTitle ||
      document.title.replace(/^Meet\s*[-–:]\s*/, '').trim() ||
      location.pathname.slice(1)
    );
  }

  /** The locale of Meet's interface, which is also the one it writes language names in. */
  const uiLocale = () => document.documentElement.lang || 'en';

  /** Attributes whose values are structural, never a name or a sentence. */
  const SAFE_VALUES =
    /^(role|tabindex|aria-(hidden|expanded|pressed|haspopup|live|checked|selected|disabled))$/;
  /** Inline positions, which layout.js relies on. */
  const SAFE_STYLE = /^(inset|top|bottom|left|right|height)\s*:\s*[-\d.\s%a-z]+$/;

  /**
   * One line for an element: tag, structural attributes with their values, and only the
   * names of the other aria-* and data-* attributes (labels carry people's names).
   * @param {Element} el
   */
  function outlineLine(el) {
    let line = el.localName;
    for (const { name, value } of el.attributes) {
      if (SAFE_VALUES.test(name) && /^[\w-]*$/.test(value)) line += ` ${name}=${value}`;
      else if (/^(aria|data)-/.test(name)) line += ' ' + name;
      else if (name === 'style') {
        const kept = value
          .split(';')
          .map((d) => d.trim())
          .filter((d) => SAFE_STYLE.test(d));
        if (kept.length) line += ` style="${kept.join('; ')}"`;
      }
    }
    const ownText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && (n.textContent || '').trim(),
    );
    if (!ownText) return line;
    const text = (el.textContent || '').trim();
    // Icon ligatures are the only text that is kept.
    return line + (el.localName === 'i' && /^[a-z0-9_]+$/.test(text) ? ` "${text}"` : ' #text');
  }

  /**
   * @param {Element} el
   * @param {number} depth
   * @returns {string}
   */
  function outline(el, depth) {
    let out = ' '.repeat(depth) + outlineLine(el) + '\n';
    if (el.localName === 'svg') return out;
    let last = '';
    let repeats = 0;
    const flush = () => {
      if (repeats) out += ' '.repeat(depth + 1) + `(same ×${repeats})\n`;
      repeats = 0;
    };
    for (const child of el.children) {
      if (/^(script|style|link|noscript|template)$/.test(child.localName)) continue;
      const part = outline(child, depth + 1);
      if (part === last) repeats++;
      else {
        flush();
        out += last = part;
      }
    }
    flush();
    return out;
  }

  /**
   * An anonymous outline of the page for a bug report: tags, roles, ARIA states, inline
   * positions and icon names. No text, no label values, no links, no images, so it holds
   * no names, meeting codes or sentences. The first line says what this adapter finds.
   * @returns {string}
   */
  function skeleton() {
    const region = captionRegion();
    return (
      `lang=${uiLocale()} inCall=${inCall()} captionRegion=${!!region}` +
      ` blocks=${region ? readBlocks(region).size : 0}\n` +
      outline(document.body, 0)
    );
  }

  return {
    inCall,
    captionRegion,
    captionBox,
    readBlocks,
    captionLanguage,
    openLanguageSettings,
    turnCaptionsOn,
    closeCaptionsMenu,
    meetingTitle,
    uiLocale,
    skeleton,
  };
})();
