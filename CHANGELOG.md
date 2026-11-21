# Changelog

What changed in each version of Escriba, for the people who use it. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Changes that only affect development (tests, CI, tooling) are left out.

## [Unreleased]

### Added

- The MCP server can be installed from npm: AI apps start it with `npx -y escriba-mcp`, with no need to download the code.
- A 30-second video on the website, and an animation at the top of the README.

## [2.2.0] - 2026-11-19

### Added

- A new speech bubble icon, sharp at every size the browser uses.
- A privacy policy that explains what Escriba reads and where it keeps it.
- An optional MCP server in `mcp/`, separate from the extension, that lets AI tools on your computer list, search and read your saved transcripts. It finds the Downloads folder the way the browser does on Linux, Windows and macOS.

### Changed

- The icon menu is shorter: the two latest transcripts with a **View all** link, a ⚙ button for the settings and a one-line "Not transcribing?" shortcut.
- The settings moved to their own view on the transcripts page, as switches with a short explanation.
- The extension is called **Escriba for Google Meet** (**Escriba para Google Meet** in Spanish), the name it will have in the Chrome Web Store.
- **Report**, next to "Not transcribing?", opens a bug report form that asks for the outline.
- The icon menu opens faster with a long history, because it reads only the latest transcripts. Escriba now needs Chrome 130 or later.

### Fixed

- Transcripts are always saved to `Downloads/transcripciones-meet`. A browser in English used to save them to `meet-transcripts` instead.
- Open Meet tabs no longer throw errors when the caption language changes after the extension was reloaded.

## [2.1.0] - 2026-11-16

### Added

- **Copy outline**, next to "Not transcribing?" in the icon menu, copies an anonymous outline of the Meet page to paste into a bug report. It has the page's tags, roles and icon names, and no names, text or meeting code. Nothing is sent anywhere.

## [2.0.1] - 2026-11-16

### Fixed

- After resuming a pause, the rest of what someone was saying in the caption on screen is captured. It used to be lost.

## [2.0.0] - 2026-11-14

### Added

- The interface is available in English as well as Spanish, following the browser's language.

### Changed

- **Breaking:** transcripts are written with English field names (`title`, `date`, `start`, `participants`, `language`, `link`). Files and history saved by 1.x are still read.
- **Breaking:** the settings are stored in a new place and go back to their defaults once.
- Meet's buttons are looked up by their icon first and their label second, so finding them depends less on the language of Meet's interface.

### Fixed

- After the extension is reloaded, the copy still running in open Meet tabs stops cleanly.

## [1.6.0] - 2026-11-14

First version in this repository, in Spanish.

### Added

- Transcribes Google Meet calls from Meet's own captions, with the name of who is speaking. No bot joins the call and nothing leaves the computer.
- Turns the captions on by itself and hides them, giving their space back to the video.
- Saves each meeting as Markdown in `Downloads/transcripciones-meet` and in the browser, and recovers the meeting if the browser closes abruptly.
- Icon menu with the status (**REC**, paused, or **!** when transcription stops), pause and resume, the caption language and the latest transcripts.
- Transcripts page to search, read, copy, download again or delete transcripts.
- System notification when transcription stops for more than 20 seconds.
- Settings to transcribe automatically when joining and to warn when the caption language is not the browser's language.

[Unreleased]: https://github.com/AbdielOtzoy/escriba/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/AbdielOtzoy/escriba/compare/7973944...v2.2.0
[2.1.0]: https://github.com/AbdielOtzoy/escriba/compare/1cbe8ff...7973944
[2.0.1]: https://github.com/AbdielOtzoy/escriba/compare/fa29189...1cbe8ff
[2.0.0]: https://github.com/AbdielOtzoy/escriba/compare/9983a3f...fa29189
[1.6.0]: https://github.com/AbdielOtzoy/escriba/commit/9983a3f
