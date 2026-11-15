// @ts-check
// The menu that opens from the toolbar icon: status of the meeting in the current tab,
// the latest transcripts and the settings.

(() => {
  /** @param {string} id */
  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  /** @param {string} id */
  const checkbox = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id));
  const RECENT_COUNT = 4;

  /** What the main button does in the current state: one of MSG. */
  /** @type {string} */
  let action = MSG.TOGGLE_PAUSE;

  /** @param {string} [key] the transcript to open on, if any */
  const openHistory = (key = '') =>
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/history/history.html') + (key && '#' + key),
    });

  /**
   * @param {{ state: string, count: number, alertKey: string | null, language: string }
   *         | null | undefined} status
   */
  function render(status) {
    if (!status || status.state === STATE.IDLE) return;
    $('dot').className = 'dot ' + status.state;
    $('status').textContent = i18n.statusText(status);
    $('language').hidden = !status.language;
    $('languageName').textContent = status.language;
    action = status.state === STATE.READY ? MSG.START : MSG.TOGGLE_PAUSE;
    $('action').hidden = false;
    $('action').textContent = i18n.t(
      status.state === STATE.READY
        ? 'transcribe'
        : status.state === STATE.PAUSED
          ? 'resume'
          : 'pause',
    );
  }

  /**
   * Sends a message to the Meet tab and renders the status it replies with.
   * @param {string} type one of MSG
   */
  async function ask(type) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return;
    // Fails when the tab is not a Meet tab: the default text stays.
    render(await chrome.tabs.sendMessage(tab.id, { type }).catch(() => null));
  }

  async function renderRecent() {
    const items = (await historyStore.list()).slice(0, RECENT_COUNT);
    $('empty').hidden = items.length > 0;
    $('recent').replaceChildren(
      ...items.map((item) => {
        const title = document.createElement('strong');
        title.textContent = item.title;
        const meta = document.createElement('span');
        meta.className = 'muted';
        meta.textContent = transcript.summary(item.data, chrome.i18n.getUILanguage());
        const open = document.createElement('button');
        open.className = 'open';
        open.append(title, meta);
        open.onclick = () => openHistory(item.key);
        const copy = document.createElement('button');
        copy.className = 'button';
        copy.textContent = i18n.t('copy');
        copy.setAttribute('aria-label', i18n.t('copyTranscriptOf', item.title));
        copy.onclick = () => historyStore.copy(copy, item.md);
        const li = document.createElement('li');
        li.append(open, copy);
        return li;
      }),
    );
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(STORAGE.SETTINGS);
    const saved = /** @type {Partial<Settings> | undefined} */ (stored[STORAGE.SETTINGS]);
    const settings = { ...DEFAULT_SETTINGS, ...saved };
    checkbox('autoStart').checked = settings.autoStart;
    checkbox('languageWarning').checked = settings.languageWarning;
  }

  const saveSettings = () =>
    chrome.storage.local.set({
      [STORAGE.SETTINGS]: {
        autoStart: checkbox('autoStart').checked,
        languageWarning: checkbox('languageWarning').checked,
      },
    });

  i18n.localizeDocument(document);
  $('action').onclick = () => ask(action);
  $('viewAll').onclick = () => openHistory();
  // Opens Meet's language setting in the meeting tab; the popup closes to reveal it.
  $('changeLanguage').onclick = async () => {
    await ask(MSG.OPEN_LANGUAGE_SETTINGS);
    close();
  };
  checkbox('autoStart').onchange = checkbox('languageWarning').onchange = saveSettings;
  ask(MSG.GET_STATUS);
  renderRecent();
  loadSettings();
})();
