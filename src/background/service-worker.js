// @ts-check
// Service worker: writes finished transcripts to disk and to the history, recovers the
// ones left unsaved (closed tab, crashed browser), and paints the toolbar icon.

importScripts(
  '../shared/constants.js',
  '../shared/i18n.js',
  '../shared/transcript.js',
  '../shared/history.js',
);

(() => {
  /** @type {Readonly<Record<string, { text: string, color: string, textColor: string }>>} */
  const BADGE = Object.freeze({
    [STATE.RECORDING]: { text: 'REC', color: '#d93025', textColor: '#ffffff' },
    [STATE.PAUSED]: { text: 'II', color: '#80868b', textColor: '#ffffff' },
    [STATE.ALERT]: { text: '!', color: '#f9ab00', textColor: '#000000' },
  });

  /** Keys being saved, so a SAVE and a tab close arriving together do not save twice. */
  const saving = new Set();

  /**
   * @param {string} key the meeting's backup key
   * @param {StoredTranscript} record
   */
  async function save(key, record) {
    if (saving.has(key)) return;
    saving.add(key);
    await historyStore.download(record.fileName, record.md);
    await historyStore.add(key, record);
    await chrome.storage.local.remove(key);
  }

  /**
   * Saves the backups of meetings that never got to send SAVE.
   * @param {(record: StoredTranscript) => boolean} filter
   */
  async function recover(filter) {
    const all = await chrome.storage.local.get(null);
    for (const [key, value] of Object.entries(all)) {
      const record = /** @type {StoredTranscript} */ (value);
      if (key.startsWith(STORAGE.PENDING_PREFIX) && filter(record)) await save(key, record);
    }
  }

  /**
   * @param {number} tabId
   * @param {{ state: string, count: number, alertKey: string | null }} status
   */
  function paintIcon(tabId, status) {
    const badge = BADGE[status.state] || { text: '', color: '#d93025', textColor: '#ffffff' };
    const active = status.state !== STATE.IDLE && status.state !== STATE.READY;
    chrome.action.setBadgeText({ tabId, text: badge.text });
    chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
    chrome.action.setBadgeTextColor({ tabId, color: badge.textColor });
    chrome.action.setTitle({
      tabId,
      title: active ? i18n.statusText(status) : i18n.t('extName'),
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    const tabId = sender.tab?.id;
    switch (message.type) {
      case MSG.SAVE:
        save(message.key, message.record);
        break;
      case MSG.STATUS:
        if (tabId != null) paintIcon(tabId, message);
        break;
      case MSG.NOTIFY:
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: i18n.t(message.titleKey),
          message: i18n.t(message.messageKey, ...(message.substitutions || [])),
        });
        break;
      case MSG.HELLO:
        // A page load in a tab that had a meeting: save what the previous page left.
        recover((record) => record.tabId === tabId).then(() => respond(tabId));
        return true; // the reply is asynchronous
    }
    return undefined;
  });

  chrome.tabs.onRemoved.addListener((tabId) => recover((record) => record.tabId === tabId));
  chrome.runtime.onStartup.addListener(() => recover(() => true));
})();
