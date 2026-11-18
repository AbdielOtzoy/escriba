// @ts-check
// Runs inside meet.google.com. Detects the call, turns captions on, captures them and
// hands the finished transcript to the service worker.
//
// What knows about Meet's HTML is in meet-dom.js, the hiding of the captions in layout.js
// and the failure detection in watchdog.js; this file only coordinates them.

(() => {
  const TICK_MS = 2000;
  // Read once at load, while chrome.* still works: after a reload of the extension it throws.
  const uiLanguage = chrome.i18n.getUILanguage();

  /**
   * The meeting being transcribed, or null. `key` is its backup key in storage.
   * @type {(Meeting & { key: string }) | null}
   */
  let meeting = null;
  /** There is a call in this tab, whether or not it is being transcribed. */
  let callActive = false;
  let paused = false;
  /** There are captured changes not yet written to the backup. */
  let dirty = false;
  /** i18n key of what is preventing the transcription, or null. */
  /** @type {string | null} */
  let alertKey = null;
  /** Consecutive ticks seen outside the call. */
  let ticksOutside = 0;
  /** @type {number | null} */
  let tabId = null;
  /** @type {Element | null} */
  let region = null;
  /** @type {HTMLElement | null} */
  let box = null;
  /** @type {Settings} */
  let settings = { ...DEFAULT_SETTINGS };
  let languageNoticeShown = true;

  /** The entry each caption block is feeding. @type {WeakMap<Element, Entry>} */
  let entryByBlock = new WeakMap();
  /**
   * Caption blocks that were on screen when a pause ended, and how much to skip of them.
   * @type {WeakMap<Element, ResumeMark>}
   */
  let resumedBlocks = new WeakMap();
  const observer = new MutationObserver(scan);
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let timer;

  // ---------------------------------------------------------------------------------
  // Talking to the rest of the extension

  /**
   * Runs a chrome.* call. Once the extension is reloaded or removed, this script keeps
   * running in the page but every chrome.* call throws: in that case it shuts down
   * instead of failing on every tick.
   *
   * @template T
   * @param {() => Promise<T>} call
   * @returns {Promise<T | undefined>}
   */
  function extension(call) {
    try {
      return call().catch(() => undefined);
    } catch {
      shutDown();
      return Promise.resolve(undefined);
    }
  }

  /** @param {object} message */
  const send = (message) => extension(() => chrome.runtime.sendMessage(message));

  function shutDown() {
    clearInterval(timer);
    observer.disconnect();
    layout.showCaptions();
    meeting = null;
  }

  // ---------------------------------------------------------------------------------
  // Capture

  function scan() {
    if (!meeting || paused || !region) return;
    for (const [block, { name, text: shown }] of meetDom.readBlocks(region)) {
      let text = shown;
      const mark = resumedBlocks.get(block);
      if (mark) {
        text = transcript.sinceResume(shown, mark);
        // Meet emptied the block: from here on it is an ordinary one, in a new entry.
        if (!mark.skip) {
          resumedBlocks.delete(block);
          entryByBlock.delete(block);
        }
      }
      const previous = entryByBlock.get(block);
      const before = previous?.text;
      const entry = transcript.updateEntry(meeting.entries, previous, name, text, Date.now());
      if (entry) entryByBlock.set(block, entry);
      if (entry && entry.text !== before) dirty = true;
    }
    publishState();
  }

  /** @returns {StoredTranscript} the meeting so far, as it would be saved */
  function snapshot() {
    const current = /** @type {NonNullable<typeof meeting>} */ (meeting);
    const title = meetDom.meetingTitle();
    return {
      tabId,
      fileName: transcript.fileName(title, current.start, i18n.t('fallbackTitle')),
      md: transcript.toMarkdown({ ...current, title }, Date.now()),
    };
  }

  function start() {
    const now = Date.now();
    meeting = {
      key: STORAGE.PENDING_PREFIX + now,
      title: '',
      start: now,
      link: location.origin + location.pathname,
      entries: [],
    };
    paused = false;
    entryByBlock = new WeakMap();
    resumedBlocks = new WeakMap();
    publishState();
  }

  function finish() {
    if (!meeting) return;
    observer.disconnect();
    if (meeting.entries.length) {
      send({ type: MSG.SAVE, key: meeting.key, record: snapshot() });
    }
    meeting = null;
    region = null;
    box = null;
    alertKey = null;
    watchdog.reset();
    layout.release();
    publishState();
  }

  function tick() {
    const inside = meetDom.inCall();
    callActive = inside;
    if (!meeting) {
      if (inside && settings.autoStart) start();
      else publishState(); // lets the popup offer to start it by hand
      return;
    }
    // Two readings in a row outside the call, so a repaint by Meet does not end it.
    ticksOutside = inside ? 0 : ticksOutside + 1;
    if (ticksOutside >= 2) return finish();
    if (!inside || paused) return;

    const found = meetDom.captionRegion();
    if (!found) {
      layout.release();
      meetDom.turnCaptionsOn();
    } else {
      meetDom.closeCaptionsMenu();
      box = meetDom.captionBox(found);
      layout.hideCaptions(box);
      if (found !== region) {
        region = found;
        observer.disconnect();
        observer.observe(found, { childList: true, subtree: true, characterData: true });
        scan();
      }
      checkLanguage();
    }

    const problem = watchdog.check(found);
    if (problem && !alertKey) {
      send({ type: MSG.NOTIFY, titleKey: 'notifyNotTranscribingTitle', messageKey: problem });
    }
    alertKey = problem;
    publishState();

    // Backup: if the tab or the browser dies, the service worker recovers it.
    if (dirty) {
      dirty = false;
      const key = meeting.key;
      const record = snapshot();
      extension(() => chrome.storage.local.set({ [key]: record }));
    }
  }

  // ---------------------------------------------------------------------------------
  // Caption language
  //
  // Meet transcribes in a single language, the one the person has chosen, and there is no
  // way to know which language is being spoken. What this does: tell the user, the first
  // time, which one is active; and, if the setting is on, warn when it is not the
  // browser's language.

  function checkLanguage() {
    if (!meeting || !box) return;
    const language = meetDom.captionLanguage(box);
    if (!language || language === meeting.language) return;
    meeting.language = language;
    dirty = true;

    const code = uiLanguage.split('-')[0];
    const mismatch = !transcript.languageMatches(language, code, meetDom.uiLocale());
    if (settings.languageWarning && mismatch) {
      const mine = new Intl.DisplayNames([uiLanguage], { type: 'language' }).of(code) || code;
      send({
        type: MSG.NOTIFY,
        titleKey: 'notifyLanguageMismatchTitle',
        messageKey: 'notifyLanguageMismatch',
        substitutions: [language, mine],
      });
    } else if (!languageNoticeShown) {
      send({
        type: MSG.NOTIFY,
        titleKey: 'notifyLanguageTitle',
        messageKey: 'notifyLanguage',
        substitutions: [language],
      });
    }
    languageNoticeShown = true;
    extension(() => chrome.storage.local.set({ [STORAGE.LANGUAGE_NOTICE_SHOWN]: true }));
  }

  // ---------------------------------------------------------------------------------
  // Status, for the toolbar icon and the popup

  function status() {
    const state = !meeting
      ? callActive
        ? STATE.READY
        : STATE.IDLE
      : paused
        ? STATE.PAUSED
        : alertKey
          ? STATE.ALERT
          : STATE.RECORDING;
    return {
      state,
      count: meeting ? meeting.entries.length : 0,
      alertKey,
      language: meeting?.language || '',
    };
  }

  let lastPublished = '';
  /** Tells the service worker to repaint the icon, only when something changed. */
  function publishState() {
    const current = status();
    const signature = current.state + current.count;
    if (signature === lastPublished) return;
    lastPublished = signature;
    send({ type: MSG.STATUS, ...current });
  }

  function togglePause() {
    if (!meeting) return;
    paused = !paused;
    alertKey = null;
    watchdog.reset();
    // What was said during the pause is still on screen when resuming: skip that part,
    // and keep what the same person goes on to say in the same block, as a new entry.
    if (!paused && region) {
      for (const [block, { text }] of meetDom.readBlocks(region)) {
        resumedBlocks.set(block, transcript.resumeMark(text));
        entryByBlock.delete(block);
      }
    }
    publishState();
  }

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    switch (message.type) {
      case MSG.TOGGLE_PAUSE:
        togglePause();
        break;
      case MSG.START:
        if (!meeting && meetDom.inCall()) start();
        break;
      case MSG.OPEN_LANGUAGE_SETTINGS:
        if (box) meetDom.openLanguageSettings(box);
        break;
      case MSG.GET_STATUS:
        break;
      case MSG.GET_SKELETON:
        respond({ ...status(), skeleton: meetDom.skeleton() });
        return;
      default:
        return;
    }
    respond(status());
  });

  // ---------------------------------------------------------------------------------
  // Start-up

  /** @param {unknown} stored whatever is in storage, possibly nothing */
  const applySettings = (stored) => {
    settings = { ...DEFAULT_SETTINGS, .../** @type {Partial<Settings> | undefined} */ (stored) };
  };

  extension(() => chrome.storage.local.get([STORAGE.SETTINGS, STORAGE.LANGUAGE_NOTICE_SHOWN])).then(
    (stored) => {
      applySettings(stored?.[STORAGE.SETTINGS]);
      languageNoticeShown = !!stored?.[STORAGE.LANGUAGE_NOTICE_SHOWN];
    },
  );
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[STORAGE.SETTINGS]) applySettings(changes[STORAGE.SETTINGS].newValue);
  });

  // HELLO also makes the service worker save whatever this tab left pending.
  send({ type: MSG.HELLO }).then((id) => {
    tabId = typeof id === 'number' ? id : null;
  });
  addEventListener('pagehide', finish);
  timer = setInterval(tick, TICK_MS);
})();
