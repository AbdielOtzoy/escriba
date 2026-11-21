# Escriba MCP server

A local [MCP](https://modelcontextprotocol.io) server that lets Claude Code, Claude Desktop
or any other MCP client read the Google Meet transcripts that Escriba saved as Markdown
files. It runs on your computer over stdio, only reads files, never changes them and makes
no network requests.

It works with [Escriba](https://abdielotzoy.github.io/escriba/), the browser extension that
transcribes Google Meet calls from the captions, with no bot in the call.

It is a separate package so that its dependencies stay out of the extension. It reuses the
extension's parser (`../src/shared/transcript.js`); the npm package carries a copy of it.

## Tools

| Tool                                                    | What it returns                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `list_meetings({from?, to?, participant?})`             | The meetings, newest first: file, title, date, start, duration, participants, language                      |
| `search_transcripts({query, from?, to?, participant?})` | The paragraphs that contain `query`, with file, title, date, speaker and time. At most 50; `capped` says so |
| `read_meeting({file})`                                  | The metadata of one meeting and its whole transcript as text                                                |

Dates are `YYYY-MM-DD`, inclusive. `participant` and `query` ignore case and accents
(`ibanez` finds `Ibáñez`).

## Settings

| Environment variable | Default                                                                                                                                                                                              | Meaning                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ESCRIBA_DIR`        | `transcripciones-meet` in your Downloads folder, plus `meet-transcripts` if it exists (version 2.0 used it with the browser in English). See [Where the transcripts are](#where-the-transcripts-are) | Folder with the transcripts. Only `.md` files written by Escriba are read; subfolders are not                                         |
| `ESCRIBA_SELF_NAME`  | not set                                                                                                                                                                                              | Your name. Meet labels what you say as "Tú" or "You"; with this set, the server shows and filters by your name. Files are not changed |

## Install

You need Node.js 20.11 or later. There is nothing else to install: your AI app starts the
server with `npx`, which downloads it the first time.

### Claude Code

```
claude mcp add escriba --env ESCRIBA_SELF_NAME="Your Name" -- npx -y escriba-mcp
```

Add `--env ESCRIBA_DIR=/some/folder` if the transcripts are somewhere else, and
`--scope user` to have the server in every project.

### Claude Desktop

In `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "escriba": {
      "command": "npx",
      "args": ["-y", "escriba-mcp"],
      "env": {
        "ESCRIBA_SELF_NAME": "Your Name"
      }
    }
  }
}
```

Restart Claude Desktop afterwards. If it says it cannot find `npx`, put the full path that
`which npx` prints (`where npx` on Windows) in `command`.

### Other apps

Any app that supports local MCP servers (Cursor, VS Code, Windsurf…) takes the same command:
`npx -y escriba-mcp`, with the settings above as environment variables.

### From a clone of this repository

Run `npm install` in `mcp/` and use `node /absolute/path/to/escriba/mcp/server.js` as the
command instead of `npx -y escriba-mcp`.

### Where the transcripts are

The extension saves into the browser's downloads folder, and the server looks for it the
way the browser does:

- **Windows:** the Downloads folder, also when it was moved to another drive or to
  OneDrive (Properties → Location).
- **Linux:** the folder named in `~/.config/user-dirs.dirs`, which depends on the system's
  language (`~/Descargas`, `~/Téléchargements`…); `~/Downloads` if there is none.
- **macOS:** `~/Downloads`.

If you chose another folder in the browser's download settings, set `ESCRIBA_DIR` to its
`transcripciones-meet` subfolder.

### macOS: permission to read Downloads

macOS protects the Downloads folder. The server is started by the app that uses it (your
terminal for Claude Code, or Claude Desktop), and it is that app that needs the permission:
allow it when macOS asks, or turn it on in System Settings → Privacy & Security → Files and
Folders → _the app_ → Downloads Folder. Without it, the tools answer with an
`EPERM: operation not permitted` error. Moving the transcripts to another folder and
pointing `ESCRIBA_DIR` at it also works.

## Tests

```
npm test
```

runs the unit tests of `meetings.js` and `e2e.js`, which starts the real server as a child
process and calls every tool through the SDK's client, against a temporary folder of
invented transcripts. The unit tests need no dependencies and also run with the
repository's `npm test`. With `ESCRIBA_SERVER=/path/to/server.js`, `e2e.js` tests another copy
of the server, such as the one installed from the npm package; CI does that on every push.

## Publishing

Bump `version` in `package.json`, then from `mcp/`:

```
npm publish
```

`prepack` copies the extension's parser and the license into the package, and `postpack`
removes them. `npm pack --dry-run` lists what would be published.
