// @ts-check
// Thin wrapper over chrome.i18n. Texts live in _locales/<lang>/messages.json.

const i18n = (() => {
  /**
   * @param {string} key
   * @param {...(string | number)} substitutions fill $1, $2… in the message
   * @returns {string} the message, or the key itself when it is missing
   */
  function t(key, ...substitutions) {
    return chrome.i18n.getMessage(key, substitutions.map(String)) || key;
  }

  /**
   * Fills the static texts of an extension page from its data-i18n* attributes.
   * @param {Document} doc
   */
  function localizeDocument(doc) {
    doc.documentElement.lang = chrome.i18n.getUILanguage();
    for (const el of doc.querySelectorAll('[data-i18n]')) {
      el.textContent = t(/** @type {HTMLElement} */ (el).dataset.i18n || '');
    }
    for (const el of doc.querySelectorAll('[data-i18n-placeholder]')) {
      const input = /** @type {HTMLInputElement} */ (el);
      input.placeholder = t(input.dataset.i18nPlaceholder || '');
    }
    for (const el of doc.querySelectorAll('[data-i18n-aria-label]')) {
      el.setAttribute('aria-label', t(/** @type {HTMLElement} */ (el).dataset.i18nAriaLabel || ''));
    }
  }

  /**
   * One line describing what the extension is doing in a tab.
   * @param {{ state: string, count: number, alertKey: string | null }} status
   */
  function statusText({ state, count, alertKey }) {
    switch (state) {
      case STATE.READY:
        return t('statusReady');
      case STATE.RECORDING:
        return t('statusRecording', count);
      case STATE.PAUSED:
        return t('statusPaused', count);
      case STATE.ALERT:
        return t('statusAlert', t(alertKey || ''));
      default:
        return t('statusIdle');
    }
  }

  return { t, localizeDocument, statusText };
})();
