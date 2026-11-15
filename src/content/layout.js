// @ts-check
// Hides the captions from the screen and gives their space back to the video.
//
// The captions stay in the HTML (the capture keeps reading them); they are only made
// invisible. Meet, however, still lays everything out as if they were visible, so three
// things are corrected, all by the height of the caption strip:
//
//  1. The video size. Meet computes it from the window height, not from what it measures
//     on screen. src/page/viewport-patch.js reports a taller window, reading the extra
//     height from <html data-escriba-extra>.
//  2. The video area (<main>), which CSS still cuts short. Things anchored to its bottom
//     edge, like the emoji reactions floating up, would start from where the captions were.
//  3. Notices that Meet stacks right above the strip, like the chat message preview.

const layout = (() => {
  const STYLE_ID = 'escriba-style';
  /** Notices moved down, to put them back later. @type {Set<HTMLElement>} */
  const shifted = new Set();
  /** @type {HTMLElement | null} */
  let hiddenBox = null;

  /** @param {number} height px to give back to the video; 0 undoes it */
  function reserve(height) {
    const root = document.documentElement;
    if ((Number(root.dataset.escribaExtra) || 0) === height) return;
    if (height) root.dataset.escribaExtra = String(height);
    else delete root.dataset.escribaExtra;

    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.append(style);
    }
    style.textContent = height ? `main { margin-bottom: -${height}px !important; }` : '';

    if (!height) {
      for (const el of shifted) el.style.removeProperty('margin-bottom');
      shifted.clear();
    }
    dispatchEvent(new Event('resize')); // makes Meet recompute the video size
  }

  /**
   * Call on every tick while captions are on: Meet rewrites the inline styles involved.
   * @param {HTMLElement} box the caption strip, from meetDom.captionBox()
   */
  function hideCaptions(box) {
    hiddenBox = box;
    box.style.setProperty('opacity', '0', 'important');
    box.style.setProperty('pointer-events', 'none', 'important');
    const height = box.offsetHeight;
    reserve(height);

    // The notices are siblings of the strip anchored higher than it.
    const base = parseFloat(box.style.bottom) || 0;
    for (const sibling of box.parentElement?.children || []) {
      const el = /** @type {HTMLElement} */ (sibling);
      if (el !== box && el.style.bottom && !el.style.top && parseFloat(el.style.bottom) > base) {
        el.style.setProperty('margin-bottom', `-${height}px`, 'important');
        shifted.add(el);
      }
    }
  }

  /** Gives the space back to Meet; the captions stay hidden until showCaptions(). */
  const release = () => reserve(0);

  /** Undoes everything, leaving the page as Meet draws it. */
  function showCaptions() {
    reserve(0);
    hiddenBox?.style.removeProperty('opacity');
    hiddenBox?.style.removeProperty('pointer-events');
    hiddenBox = null;
  }

  return { hideCaptions, release, showCaptions };
})();
