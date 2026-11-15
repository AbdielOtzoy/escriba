// @ts-check
// Names shared by the content script, the service worker and the extension pages.
// Every file is a classic script that declares exactly one top-level name, so they
// can be listed together in the manifest or in <script> tags without colliding.

/** Message types sent with chrome.runtime.sendMessage / chrome.tabs.sendMessage. */
const MSG = Object.freeze({
  /** content → worker: flush what this tab left unsaved; replies with the tab id. */
  HELLO: 'hello',
  /** content → worker: write a finished transcript to disk and to the history. */
  SAVE: 'save',
  /** content → worker: repaint the toolbar icon badge. */
  STATUS: 'status',
  /** content → worker: show a system notification. */
  NOTIFY: 'notify',
  /** popup → content: reply with the current status. */
  GET_STATUS: 'get-status',
  /** popup → content: pause or resume the capture. */
  TOGGLE_PAUSE: 'toggle-pause',
  /** popup → content: start transcribing when auto-start is off. */
  START: 'start',
  /** popup → content: open Meet's caption language setting. */
  OPEN_LANGUAGE_SETTINGS: 'open-language-settings',
});

/** What the extension is doing in a Meet tab. */
const STATE = Object.freeze({
  /** No call in this tab. */
  IDLE: 'idle',
  /** In a call, not transcribing (auto-start is off). */
  READY: 'ready',
  RECORDING: 'recording',
  PAUSED: 'paused',
  /** Transcription should be running but something is preventing it. */
  ALERT: 'alert',
});

/** Keys and key prefixes in chrome.storage.local. */
const STORAGE = Object.freeze({
  /** Backup of a meeting in progress: `pending_<start ms>`. */
  PENDING_PREFIX: 'pending_',
  /** A saved transcript: `hist_<start ms>`. */
  HISTORY_PREFIX: 'hist_',
  SETTINGS: 'settings',
  LANGUAGE_NOTICE_SHOWN: 'languageNoticeShown',
});

/**
 * @typedef {{ autoStart: boolean, languageWarning: boolean }} Settings
 */

/** @type {Readonly<Settings>} */
const DEFAULT_SETTINGS = Object.freeze({
  /** Start transcribing as soon as a call is joined. */
  autoStart: true,
  /** Warn when the caption language differs from the browser language. */
  languageWarning: false,
});
