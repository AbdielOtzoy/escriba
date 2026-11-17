# Escriba MCP server

A local [MCP](https://modelcontextprotocol.io) server that lets Claude Code, Claude Desktop
or any other MCP client read the Google Meet transcripts that Escriba saved as Markdown
files. It runs on your computer over stdio, only reads files, never changes them and makes
no network requests.

It is a separate package so that its dependencies stay out of the extension. It reuses the
extension's parser (`../src/shared/transcript.js`), so it must stay inside this repository.

## Tools

| Tool                                                    | What it returns                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `list_meetings({from?, to?, participant?})`             | The meetings, newest first: file, title, date, start, duration, participants, language                      |
| `search_transcripts({query, from?, to?, participant?})` | The paragraphs that contain `query`, with file, title, date, speaker and time. At most 50; `capped` says so |
| `read_meeting({file})`                                  | The metadata of one meeting and its whole transcript as text                                                |

Dates are `YYYY-MM-DD`, inclusive. `participant` and `query` ignore case and accents
(`ibanez` finds `Ibáñez`).

## Settings

| Environment variable | Default                                                                                                                                | Meaning                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ESCRIBA_DIR`        | `~/Downloads/transcripciones-meet`, plus `~/Downloads/meet-transcripts` if it exists (version 2.0 used it with the browser in English) | Folder with the transcripts. Only `.md` files written by Escriba are read; subfolders are not                                         |
| `ESCRIBA_SELF_NAME`  | not set                                                                                                                                | Your name. Meet labels what you say as "Tú" or "You"; with this set, the server shows and filters by your name. Files are not changed |

## Install

Node.js 20.11 or later.

```
cd mcp
npm install
```

### Claude Code

```
claude mcp add escriba --env ESCRIBA_SELF_NAME="Your Name" -- node /absolute/path/to/escriba/mcp/server.js
```

Add `--env ESCRIBA_DIR=/some/folder` if you moved the transcripts somewhere else, and
`--scope user` to have the server in every project.

### Claude Desktop

In `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "escriba": {
      "command": "node",
      "args": ["/absolute/path/to/escriba/mcp/server.js"],
      "env": {
        "ESCRIBA_SELF_NAME": "Your Name"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

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
repository's `npm test`.
