// @ts-check
// The page with every saved transcript: a searchable list on the left and the selected
// transcript, formatted, on the right.

(() => {
  /** @param {string} id */
  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const locale = chrome.i18n.getUILanguage();

  /**
   * @param {string} tag
   * @param {string} [className]
   * @param {string} [text]
   */
  function element(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  /**
   * @param {string} className
   * @param {string} messageKey
   * @param {(button: HTMLButtonElement) => void} onClick
   */
  function button(className, messageKey, onClick) {
    const el = /** @type {HTMLButtonElement} */ (element('button', className, i18n.t(messageKey)));
    el.onclick = () => onClick(el);
    return el;
  }

  /** A stable color per person: the hue comes from the name. @param {string} name */
  const hue = (name) => [...name].reduce((h, c) => (h * 31 + (c.codePointAt(0) || 0)) % 360, 7);

  /** @type {HistoryItem[]} */
  let items = [];
  let selectedKey = location.hash.slice(1);

  async function load() {
    items = await historyStore.list();
    render();
  }

  function render() {
    const query = /** @type {HTMLInputElement} */ ($('search')).value.trim().toLowerCase();
    const visible = items.filter((item) => !query || item.md.toLowerCase().includes(query));
    if (!visible.some((item) => item.key === selectedKey)) selectedKey = visible[0]?.key || '';

    $('notice').hidden = visible.length > 0;
    $('notice').textContent = i18n.t(items.length ? 'noResults' : 'emptyHistory');
    $('list').replaceChildren(
      ...visible.map((item) => {
        const row = element('button');
        row.append(
          element('strong', '', item.title),
          element('span', 'muted', transcript.summary(item.data, locale)),
          element('span', 'muted', item.data.participants.join(', ')),
        );
        row.setAttribute('aria-current', String(item.key === selectedKey));
        row.onclick = () => {
          selectedKey = item.key;
          history.replaceState(null, '', '#' + item.key);
          render();
        };
        const li = element('li');
        li.append(row);
        return li;
      }),
    );
    renderDetail(items.find((item) => item.key === selectedKey));
  }

  /** @param {HistoryItem | undefined} item */
  function renderDetail(item) {
    if (!item) return $('detail').replaceChildren();
    const { data, md } = item;

    const actions = element('div', 'actions');
    actions.append(
      button('button primary', 'copy', (el) => historyStore.copy(el, md)),
      button('button', 'download', () => historyStore.download(item.fileName, md)),
      button('button danger', 'delete', async () => {
        if (!confirm(i18n.t('confirmDelete', item.title))) return;
        await historyStore.remove(item.key);
        load();
      }),
    );

    const turns = data.turns.map((turn) => {
      const speaker = element('span', 'speaker', turn.name);
      speaker.style.setProperty('--hue', String(hue(turn.name)));
      const head = element('header');
      head.append(speaker, element('span', 'muted', turn.time));
      const section = element('section', 'turn');
      section.append(head, ...turn.paragraphs.map((p) => element('p', '', p)));
      return section;
    });

    $('detail').replaceChildren(
      element('h2', '', item.title),
      element(
        'div',
        'muted',
        [transcript.summary(data, locale), data.participants.join(', ')]
          .filter(Boolean)
          .join(' · '),
      ),
      actions,
      // Text that is not in our format is shown as is instead of leaving this empty.
      ...(turns.length ? turns : [element('p', '', md)]),
    );
  }

  i18n.localizeDocument(document);
  $('search').oninput = render;
  load();
})();
