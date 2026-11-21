# Chrome Web Store listing

Everything the developer dashboard asks for, ready to paste. Text inside the `text` blocks
goes into the dashboard as is: the store shows descriptions as plain text, so line breaks
and the `-` bullets are kept and nothing else is formatted.

Checked against the Chrome Web Store documentation on November 19, 2026 (sources at the
end). If the dashboard shows a field that is not here, the docs changed: check them again.

## Store listing tab

### Name and summary

They are not typed in the dashboard: the store takes them from `manifest.json`, which reads
them from `_locales/<lang>/messages.json` (`extName`, `extDescription`). Each language has
its own.

| Field                      | English                                                                                                                           | Spanish                                                                                                                           | Limit                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Name (`extName`)           | Escriba for Google Meet™                                                                                                          | Escriba para Google Meet™                                                                                                         | 75 characters (24 and 25) |
| Summary (`extDescription`) | Transcribes Google Meet calls to Markdown, with the name of each speaker. No bot joins the call and nothing leaves your computer. | Transcribe tus reuniones de Google Meet a Markdown, con el nombre de quien habla. Sin bot en la llamada y nada sale de tu equipo. | 132 characters (129 each) |

Why this name: the branding guidelines do not allow a Google trademark as the name of an
extension, but allow saying what it works with using "for", "for use with" or "compatible
with", with the ™ symbol after the Google mark, and ask for an attribution line in the
description. Their own example title is "Highlight local shops for Google Maps™". The
icon must not be or resemble Google's logo (Escriba's speech bubble is fine).

### Category and language

- **Category:** Communication. The docs describe it as "composing and templating emails,
  email management, screen sharing, video conferencing apps and enhancements". The
  alternative would be Workflow & Planning, which is about task tools; Communication is
  where people look for Meet extensions.
- **Language:** English as the default listing (`default_locale` is `en`), and a second
  listing in Spanish. Each locale can have its own description and screenshots; the promo
  tiles cannot be localized.

### Detailed description (English)

```text
Escriba writes a Markdown transcript of your Google Meet calls, with the name of each speaker. It reads the captions Meet already generates: no bot joins the call, no audio is recorded and nothing is sent anywhere.

How it works
- Join a meeting. Escriba turns Meet's captions on and hides them from the screen, so the video keeps its full size. The extension icon shows REC.
- Each turn is saved with the speaker's name, as Meet shows it, and the time.
- When you leave the call or close the tab, the transcript is saved as a .md file in your Downloads folder (Downloads/transcripciones-meet/) and in the browser.
- If the browser closes unexpectedly, the transcript is saved the next time it opens.

From the extension icon
- Pause and resume the transcript at any time.
- See the caption language and change it in Meet.
- Copy your most recent transcripts.

Transcripts page
- Search every saved transcript by title, person or text.
- Read, copy, download again or delete them.
- Settings: transcribe automatically when you join a meeting (on by default), and a warning when the caption language is not your browser's language.

Language
Escriba transcribes in the language Meet's captions are set to. Meet uses one language at a time and does not detect it by itself, so choose the language of the meeting in Meet's caption settings.

Good to know
- Only what is said after you join, and while captions are on, is captured.
- The meeting chat is not saved.
- If transcription stops for more than 20 seconds (for example, captions were turned off or Meet changed), the icon shows ! and a system notification appears.
- You are responsible for telling the other participants that the meeting is being transcribed, and for following the laws on recording and transcription where you are.

Ask your AI about your meetings (optional)
A separate, open-source MCP server lets AI apps such as Claude or Cursor list, search and read the transcripts in your Downloads folder, so you can ask what was agreed in a meeting. It is not part of this extension and is installed on its own: https://github.com/AbdielOtzoy/escriba/tree/main/mcp
It only reads those files on your computer; the AI app you connect it to receives what it reads.

Privacy
Everything stays on your computer. Escriba makes no network requests, has no analytics, ads or accounts, and loads no remote code. Transcripts kept in the browser are deleted if you remove the extension; the files in Downloads stay.

Open source (MIT license): https://github.com/AbdielOtzoy/escriba
Privacy policy: https://abdielotzoy.github.io/escriba/privacy

Escriba is not made or endorsed by Google. Google Meet is a trademark of Google LLC. Use of this trademark is subject to Google Permissions.
```

### Detailed description (Spanish)

```text
Escriba guarda una transcripción en Markdown de tus llamadas de Google Meet, con el nombre de quien habla. Lee los subtítulos que Meet ya genera: no entra ningún bot a la llamada, no se graba audio y no se envía nada a ningún sitio.

Cómo funciona
- Entra a una reunión. Escriba activa los subtítulos de Meet y los oculta de la pantalla, para que el video conserve su tamaño. El icono de la extensión muestra REC.
- Cada intervención se guarda con el nombre de quien habla, tal como lo muestra Meet, y la hora.
- Al salir de la llamada o cerrar la pestaña, la transcripción se guarda como archivo .md en tu carpeta de Descargas (Descargas/transcripciones-meet/) y en el navegador.
- Si el navegador se cierra de golpe, la transcripción se guarda al volver a abrirlo.

Desde el icono de la extensión
- Pausa y reanuda la transcripción cuando quieras.
- Consulta el idioma de los subtítulos y cámbialo en Meet.
- Copia tus transcripciones más recientes.

Página de transcripciones
- Busca en todas las transcripciones guardadas por título, persona o texto.
- Léelas, cópialas, vuelve a descargarlas o bórralas.
- Ajustes: transcribir automáticamente al entrar a una reunión (activado por defecto) y un aviso cuando el idioma de los subtítulos no es el de tu navegador.

Idioma
Escriba transcribe en el idioma en que estén los subtítulos de Meet. Meet usa un solo idioma a la vez y no lo detecta por sí mismo, así que elige el idioma de la reunión en los ajustes de subtítulos de Meet.

A tener en cuenta
- Solo se captura lo que se dice después de que entras, y mientras los subtítulos están activos.
- El chat de la reunión no se guarda.
- Si deja de poder transcribir durante más de 20 segundos (por ejemplo, se apagaron los subtítulos o Meet cambió), el icono muestra ! y aparece una notificación del sistema.
- Eres responsable de avisar a los demás participantes de que la reunión se está transcribiendo y de cumplir las leyes sobre grabación y transcripción de tu lugar.

Pregúntale a tu IA por tus reuniones (opcional)
Un servidor MCP aparte, de código abierto, deja que apps de IA como Claude o Cursor listen, busquen y lean las transcripciones de tu carpeta de Descargas, para que preguntes qué se acordó en una reunión. No forma parte de esta extensión y se instala por separado: https://github.com/AbdielOtzoy/escriba/tree/main/mcp
Solo lee esos archivos en tu equipo; la app de IA a la que lo conectes recibe lo que lee.

Privacidad
Todo se queda en tu equipo. Escriba no hace peticiones de red, no tiene analíticas, anuncios ni cuentas, y no carga código remoto. Las transcripciones guardadas en el navegador se borran si quitas la extensión; los archivos de Descargas se quedan.

Código abierto (licencia MIT): https://github.com/AbdielOtzoy/escriba
Política de privacidad: https://abdielotzoy.github.io/escriba/privacy

Escriba no está hecha ni respaldada por Google. Google Meet es una marca de Google LLC. El uso de esta marca está sujeto a los Permisos de Google.
```

### Additional fields

| Field          | Value                                                   |
| -------------- | ------------------------------------------------------- |
| Homepage URL   | https://abdielotzoy.github.io/escriba/                  |
| Support URL    | https://github.com/AbdielOtzoy/escriba/issues           |
| Official URL   | Leave empty (needs the site verified in Search Console) |
| Mature content | Off                                                     |

## Privacy tab

### Single purpose

```text
Escriba saves a text transcript of the Google Meet calls the user joins, built from the captions Meet displays, as a Markdown file on the user's computer and in the browser's local storage. Everything else it does (turning Meet's captions on, hiding them, pausing, notifying when transcription stops, listing and searching saved transcripts) serves that one purpose.
```

### Permission justifications

The dashboard lists one box per permission in `manifest.json`. Escriba asks for nothing else:
no `tabs`, `scripting`, `activeTab` or `host_permissions`.

**downloads**

```text
Saves each finished transcript as a Markdown file in the user's Downloads folder, under transcripciones-meet/. The file is created with chrome.downloads.download from a data: URL built locally from the transcript text; nothing is downloaded from the internet. It runs when the user leaves a call or closes the Meet tab, when an unsaved transcript is recovered after the browser closed, and when the user presses Download on the transcripts page.
```

**storage**

```text
Uses chrome.storage.local, on the user's computer only, to keep: the saved transcripts that the icon menu and the transcripts page show; a backup of the meeting in progress, so the transcript is not lost if the tab or the browser closes; the user's two settings; and whether the one-time caption language notice was already shown. Nothing is synced or sent anywhere.
```

**unlimitedStorage**

```text
Saved transcripts accumulate in chrome.storage.local over months of meetings. Without this permission local storage stops at 10 MB, and from then on saving a new transcript and the backup of the meeting in progress would fail, losing the user's transcripts.
```

**notifications**

```text
Shows a system notification when transcription stops working for more than 20 seconds during a call (Meet's captions are off and could not be turned on, or they are on screen but cannot be read), so the user does not reach the end of a meeting without a transcript. It also shows a one-time notice with the caption language Meet is using and, only if the user turns that setting on, a warning when the caption language differs from the browser's language.
```

_*Host access: https://meet.google.com/\* (content scripts)_*

```text
The content scripts run only on Google Meet, which is the extension's single purpose. They read what Meet displays during a call: the captions (speaker name and text), the meeting title and the caption language. They turn Meet's captions on by pressing Meet's own buttons, and hide the caption strip so the video uses the whole window. A small script bundled with the extension runs in the page to report a taller window height to Meet, so the video also fills the space of the hidden captions. No other site is accessed and nothing is sent anywhere.
```

### Remote code

Answer: **No, I am not using remote code.**

Why it is true: Google defines remote code as JavaScript or WebAssembly loaded from
anywhere other than the extension's own files. Every script Escriba runs is in the
package: the content scripts listed in `manifest.json` (including the one in Meet's page
world), the service worker and its `importScripts`, and the `<script>` tags of the popup
and the transcripts page, all local paths. There is no `eval`, no `new Function`, no
`fetch` and no network request of any kind.

### Data usage

Google's FAQ says local handling must be declared too: "Extensions are required to disclose
how they handle user data, even when data is processed or stored locally on a user's device
and is not transmitted to external servers or third parties." So the boxes below describe
what Escriba reads and keeps on the computer, even though it never sends any of it.

| Category                            | Tick | Why                                                                                                                                                                                                                                                  |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | Yes  | Each transcript stores the names of the speakers as Meet shows them. Name is the first example in Google's definition.                                                                                                                               |
| Health information                  | No   |                                                                                                                                                                                                                                                      |
| Financial and payment information   | No   |                                                                                                                                                                                                                                                      |
| Authentication information          | No   |                                                                                                                                                                                                                                                      |
| Personal communications             | Yes  | The transcript is what the participants say to each other in the call. Google's examples are emails, texts and chat messages; a meeting conversation is the same kind of data, so declaring it is the safe reading.                                  |
| Location                            | No   | The caption language is not location; no IP, region or GPS is read.                                                                                                                                                                                  |
| Web history                         | Yes  | Each transcript records the Meet link (`meet.google.com/xxx-xxxx-xxx`) with the meeting title and start time, which matches "pages a user has visited, with page title and time of visit". Only Meet pages, and only meetings that were transcribed. |
| User activity                       | No   | No clicks, keystrokes, scrolling or network traffic are recorded. Escriba presses Meet's caption buttons itself but does not log what the user does.                                                                                                 |
| Website content                     | Yes  | The caption text, the meeting title and the caption language are read from the Meet page.                                                                                                                                                            |

Not declaring a category the extension handles is a reason for rejection; declaring one it
handles only locally costs nothing but a line on the listing. When in doubt, the table ticks.

Certifications: tick all three.

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single
  purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

All three are true because Escriba transfers nothing to anyone.

### Privacy policy URL

```text
https://abdielotzoy.github.io/escriba/privacy
```

It must be live before submitting, and must agree with the boxes above (see the checklist).

## Images

| File                           | Size      | Required           | Where it goes                                                             |
| ------------------------------ | --------- | ------------------ | ------------------------------------------------------------------------- |
| `icons/icon128.png`            | 128×128   | Yes                | Inside the zip; the store uses it as the store icon                       |
| `docs/store/screenshot-1.png`  | 1280×800  | Yes (at least one) | Store listing → Screenshots                                               |
| `docs/store/screenshot-2.png`  | 1280×800  | No                 | Screenshots (up to 5; the docs recommend using all five)                  |
| `docs/store/screenshot-3.png`  | 1280×800  | No                 | Screenshots                                                               |
| `docs/store/screenshot-4.png`  | 1280×800  | No                 | Screenshots                                                               |
| `docs/store/screenshot-5.png`  | 1280×800  | No                 | Screenshots                                                               |
| `docs/store/promo-small.png`   | 440×280   | No                 | Small promo tile; without it the item is listed after those that have one |
| `docs/store/promo-marquee.png` | 1400×560  | No                 | Marquee promo tile; only needed to be featured in the carousel            |
| `docs/video/escriba.mp4`       | 1920×1080 | No                 | Upload to YouTube, then paste the link in Promo video (see below)         |

### Promo video

Uploaded as Unlisted: <https://youtu.be/TDW777qVZMc>. Paste that link in the Promo video field.

The store takes only a YouTube link. Upload `docs/video/escriba.mp4` (33 s, no sound; the
same video as on the site) as **Unlisted** or Public, with `docs/video/escriba.jpg` as the
thumbnail. A Spanish video could go in the Spanish listing's Localized promo video field;
there is none yet.

YouTube title (100 characters at most):

```text
Escriba for Google Meet™: transcribe your calls, then ask your AI about them
```

YouTube description:

```text
Escriba is a browser extension that transcribes Google Meet calls from the captions Meet already makes. No bot joins the call and no audio is recorded. Each meeting is saved as a Markdown file on your computer, and a transcripts page in the browser lets you search them all.

An optional MCP server, installed separately, lets AI apps such as Claude read those transcripts, so you can ask what was agreed.

Website: https://abdielotzoy.github.io/escriba/
Source code: https://github.com/AbdielOtzoy/escriba

Escriba is not made or endorsed by Google. Google Meet is a trademark of Google LLC.
```

Rules for the screenshots: square corners and no padding (full bleed), not blurry, showing
the current version. Screenshots of Meet are allowed if unmodified and illustrative, and
must not show real names, faces or meeting codes. The docs recommend that the 128×128
icon has 96×96 of artwork and 16 px of transparent padding per side.

## Before submitting

- [ ] Register the developer account at the developer dashboard: accept the developer
      agreement and pay the one-time US$5 fee. The developer email cannot be changed
      later; a separate address used only for publishing is recommended.
- [ ] Turn on 2-Step Verification in the Google account. It is required to publish or
      update.
- [ ] Account tab: set the publisher name (shown as "Offered by") and verify the contact
      email (the store sends a link).
- [ ] Declare trader or non-trader status (EU Digital Services Act). A free hobby project
      with no income is typically non-trader, but it is a legal call that only you can
      make. A trader's address and phone number are shown publicly on the listing.
- [ ] The privacy policy page is live at the URL above and includes an affirmative Limited
      Use statement, which the policy requires on the extension's site, for example: "The
      use of information received through Escriba adheres to the Chrome Web Store User
      Data Policy, including the Limited Use requirements." It should also mention that
      each transcript stores the Meet link, since the Web history box is ticked.
- [ ] Push a tag `vX.Y.Z` matching `version` in `manifest.json`; `release.yml` runs the
      checks and attaches `escriba-vX.Y.Z.zip` to the GitHub release, with
      `manifest.json` at the root of the zip.
- [ ] Dashboard → Add new item → upload that zip.
- [ ] Fill the Store listing tab (English), then add the Spanish listing (description and
      screenshots).
- [ ] Fill the Privacy tab as above.
- [ ] Distribution: Free, All regions, visibility **Unlisted** (installable only with the
      link) for the first release.
- [ ] Test instructions: no account or login is needed. If the field is used: "Open
      https://meet.new, join the call and speak; the icon shows REC and captions turn on
      by themselves. Leave the call: a .md file appears in Downloads/transcripciones-meet/
      and on the transcripts page (icon → View all)."
- [ ] Submit for review. Unticking "publish automatically after review" leaves 30 days to
      publish by hand; after that the submission returns to draft.
- [ ] Once approved, install from the store link and run the real-call checklist in
      `AGENTS.md` before switching visibility to Public.

## Sources

- Store listing fields and images: <https://developer.chrome.com/docs/webstore/cws-dashboard-listing>
- Image sizes and the icon padding: <https://developer.chrome.com/docs/webstore/images>
- Summary limit and listing advice: <https://developer.chrome.com/docs/webstore/best-listing>
- Manifest `description` (132 characters): <https://developer.chrome.com/docs/extensions/reference/manifest/description>
- Manifest `name` (75 characters): <https://developer.chrome.com/docs/extensions/reference/manifest/name>
- Categories: <https://developer.chrome.com/docs/webstore/best-practices>
- Privacy tab: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- User data FAQ (local handling must be disclosed): <https://developer.chrome.com/docs/webstore/program-policies/user-data-faq>
- Limited Use: <https://developer.chrome.com/docs/webstore/program-policies/limited-use>
- Remote code: <https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code>
- Branding guidelines (Google trademarks): <https://developer.chrome.com/docs/webstore/branding>
- Impersonation and intellectual property: <https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property>
- Distribution and visibility: <https://developer.chrome.com/docs/webstore/cws-dashboard-distribution>
- Publishing: <https://developer.chrome.com/docs/webstore/publish>
- Developer registration: <https://developer.chrome.com/docs/webstore/register>
- Account setup (contact email): <https://developer.chrome.com/docs/webstore/set-up-account>
- 2-Step Verification: <https://developer.chrome.com/docs/webstore/program-policies/two-step-verification>
- Trader / non-trader: <https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure>
- Store listing fields, promo video and localized promo video: <https://developer.chrome.com/docs/webstore/cws-dashboard-listing>
- Listing requirements (accurate, not misleading metadata): <https://developer.chrome.com/docs/webstore/program-policies/listing-requirements>
