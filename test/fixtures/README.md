# Samples of Google Meet's HTML

These files reproduce the parts of the Meet page that `src/content/meet-dom.js` reads.
They were written from dumps of the live page taken on 2026-11-14 with Meet in Spanish
(Latin America): the element nesting, roles, ARIA attributes, inline `bottom` styles and
icon names are the real ones; class names, images and everything unrelated were removed,
and the names and sentences are invented.

When Meet changes and the extension stops capturing, take a new dump of the affected
part, update the sample here, and let `test/meet-dom.test.js` show what broke.

- `call-captions-on.html`: in a call with captions on and two people having spoken.
- `call-captions-off.html`: in a call with the captions menu open and captions off.
