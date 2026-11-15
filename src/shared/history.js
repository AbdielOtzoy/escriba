// @ts-check
// Saved transcripts: storage, download and clipboard. Used by the service worker, the
// popup and the history page, so each of those behaves the same way.

/**
 * What is kept per transcript, both as a pending backup and in the history.
 * @typedef {{ tabId?: number | null, fileName: string, md: string }} StoredTranscript
 *
 * @typedef {{ key: string, fileName: string, md: string, title: string,
 *             data: ParsedTranscript }} HistoryItem
 */

const historyStore = (() => {
  /** Start time encoded at the end of a storage key. @param {string} key */
  const stamp = (key) => Number(key.match(/\d+$/)?.[0] || 0);

  /** @returns {Promise<HistoryItem[]>} newest first */
  async function list() {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all)
      .filter((key) => key.startsWith(STORAGE.HISTORY_PREFIX))
      .sort((a, b) => stamp(b) - stamp(a))
      .map((key) => {
        const record = /** @type {StoredTranscript & { archivo?: string }} */ (all[key]);
        // `archivo` is the field name written before version 2.
        const fileName = record.fileName || record.archivo || '';
        const data = transcript.fromMarkdown(record.md);
        return {
          key,
          fileName,
          md: record.md,
          data,
          title: data.title || fileName.replace(/\.md$/, ''),
        };
      });
  }

  /**
   * @param {string} pendingKey the backup key of the meeting, `pending_<start ms>`
   * @param {StoredTranscript} record
   */
  function add(pendingKey, record) {
    const key = STORAGE.HISTORY_PREFIX + stamp(pendingKey);
    return chrome.storage.local.set({ [key]: { fileName: record.fileName, md: record.md } });
  }

  /** @param {string} key */
  const remove = (key) => chrome.storage.local.remove(key);

  /**
   * Writes the transcript under the downloads folder, without asking where.
   * @param {string} fileName
   * @param {string} md
   */
  function download(fileName, md) {
    return chrome.downloads.download({
      url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md),
      filename: `${i18n.t('downloadFolder')}/${fileName}`,
      saveAs: false,
      conflictAction: 'uniquify',
    });
  }

  /**
   * Copies the transcript and flashes "Copied" on the button that was pressed.
   * @param {HTMLButtonElement} button
   * @param {string} md
   */
  async function copy(button, md) {
    await navigator.clipboard.writeText(md);
    button.textContent = i18n.t('copied');
    setTimeout(() => (button.textContent = i18n.t('copy')), 1500);
  }

  return { list, add, remove, download, copy };
})();
