// @ts-check
// Runs in the page's own JavaScript world (not the extension's isolated one), before Meet.
//
// Meet reserves a strip for the captions and computes the video size from the window
// height, not from what it measures on screen. So that the video gets that strip back
// while the captions are hidden, Meet is told the window is taller: the real height plus
// what src/content/layout.js writes in <html data-escriba-extra>. Without that attribute
// nothing changes.
(() => {
  const extra = () => Number(document.documentElement.dataset.escribaExtra) || 0;

  const clientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')?.get;
  if (clientHeight) {
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      get() {
        return clientHeight.call(this) + extra();
      },
    });
  }

  const innerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')?.get;
  if (innerHeight) {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      get() {
        return innerHeight.call(window) + extra();
      },
    });
  }
})();
