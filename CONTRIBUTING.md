# Contributing to Escriba

Thanks for wanting to help. Escriba is small on purpose: a browser extension with no build
step and no runtime dependencies, and an optional MCP server. Bug reports, fixes for when
Meet changes, translations and small features are all welcome.

## Before you start

- **Bugs:** open an issue with the form. If Escriba stopped capturing, use the "Escriba stopped
  transcribing" form and paste the outline from **Copy outline** in the icon menu.
- **Features:** open an issue first and describe what you want to do, so we can agree on
  the approach before you write code. Issues labelled
  [good first issue](https://github.com/AbdielOtzoy/escriba/labels/good%20first%20issue)
  are a good place to start.
- **Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Set up

You need Node.js 22 (CI uses it) and a Chromium browser: Chrome, Brave or Edge.

```
git clone https://github.com/AbdielOtzoy/escriba.git
cd escriba
npm install     # development tools only; the extension has no dependencies
npm run check   # lint, format check, type check and tests
```

Load the extension from the folder: open `chrome://extensions`, turn on **Developer mode**,
press **Load unpacked** and pick the repository folder. After changing a file, press the
reload button on the extension's card and reload the Meet tab.

The MCP server is a separate package:

```
cd mcp
npm install
npm test
```

## How the code works

[AGENTS.md](AGENTS.md) is the guide to the code. It was written for AI coding agents, but
it is the same guide for people: how the files load each other, the rules every change
follows, and things that were learned the hard way about Meet. Read it before changing
anything under `src/`. In short:

- No bundler, framework, TypeScript sources or runtime libraries. Every file in `src/` is a
  classic script that the browser loads as it is.
- Meet's HTML is read only in `src/content/meet-dom.js`. A change there comes with an
  updated sample in `test/fixtures/` and a test.
- Every text the user sees lives in `_locales/en/messages.json` and
  `_locales/es/messages.json`.
- Build DOM with `createElement` and `textContent`, never `innerHTML`.
- **Privacy is the product.** No network requests, analytics or remote code. A new
  permission in `manifest.json` needs a good reason and the maintainer's approval.

## Testing

- `npm run check` must pass. CI runs it on every pull request.
- `npm run test:e2e` loads the real extension in Chromium against a fake Meet page (once:
  `npx playwright install chromium`).
- Neither covers the real Meet. If you change anything under `src/content/` or `src/page/`,
  try it in a real call ([meet.new](https://meet.new) creates one) with the checklist in
  [AGENTS.md](AGENTS.md#testing), and say in the pull request that you did.

## Translations

To add a language, copy `_locales/en` to `_locales/<code>` (for example `_locales/pt_BR`)
and translate the `message` values. Leave the keys as they are.

## Pull requests

- One change per pull request, with its tests.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) in
  English: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- If the change is something a user would notice, add a line under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md). Leave the version number to the maintainer.

By contributing you agree that your contribution is licensed under the project's
[MIT license](LICENSE).
