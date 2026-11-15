// Loads extension source files the way the browser does: as classic scripts that each
// declare one global (`transcript`, `meetDom`…), visible to the test file afterwards.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..', '..');

function load(...files) {
  for (const file of files) {
    vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
  }
}

/**
 * Makes a saved sample of Meet's HTML the current page.
 * @param {string} html a file name in test/fixtures, or literal HTML
 * @param {{ title?: string, url?: string }} [options]
 */
function usePage(html, { title = '', url = 'https://meet.google.com/abc-defg-hij' } = {}) {
  const source = html.endsWith('.html')
    ? fs.readFileSync(path.join(__dirname, '..', 'fixtures', html), 'utf8')
    : html;
  const dom = new JSDOM(source, { url });
  dom.window.document.title = title;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  return dom.window.document;
}

module.exports = { load, usePage };
