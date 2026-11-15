// @ts-check
// Makes sure a failure does not go unnoticed: when the transcription should be running
// but cannot, the caller turns the icon amber and shows a notification.

const watchdog = (() => {
  /** How long a problem has to last before it is reported. */
  const GRACE_MS = 20000;
  let badSince = 0;

  /**
   * @param {Element | null | undefined} region the caption list, if captions are on
   * @param {number} [now] epoch ms
   * @returns {string | null} the i18n key of the problem once it has outlasted the grace
   *   period, otherwise null
   */
  function check(region, now = Date.now()) {
    let problem = null;
    if (!region) {
      problem = 'alertCaptionsOff';
    } else if (
      region.querySelector('img') &&
      ![...meetDom.readBlocks(region).values()].some((block) => block.text)
    ) {
      // Someone is on screen as speaking but no text can be read: Meet's HTML changed.
      problem = 'alertUnreadable';
    }
    if (!problem) badSince = 0;
    else if (!badSince) badSince = now;
    return problem && now - badSince > GRACE_MS ? problem : null;
  }

  function reset() {
    badSince = 0;
  }

  return { check, reset, GRACE_MS };
})();
