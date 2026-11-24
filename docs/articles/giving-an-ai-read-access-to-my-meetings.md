---
title: Giving an AI read access to my meetings, without sending them anywhere
description: How I built a local MCP server that lets Claude, Cursor or any MCP client search my Google Meet transcripts. Tool design for an LLM, context limits, data boundaries, one parser shared across two runtimes, and testing it on three operating systems.
date: 2026-11-23
tags: [mcp, ai, node, opensource]
canonical_url: https://abdielotzoy.github.io/escriba/articles/giving-an-ai-read-access-to-my-meetings
---

I wanted to ask my AI assistant things like _"what did we agree in Tuesday's product sync?"_
or _"what did I promise Ana last week?"_ and get an answer drawn from what was actually said.

Most tools that do this put a bot in your call, upload the audio and answer from their own
cloud. I took another route, in two parts:

1. **[Escriba](https://github.com/AbdielOtzoy/escriba)**, a Chrome extension that reads the
   captions Google Meet already generates and saves each meeting as a Markdown file on your
   computer. No bot, no audio, no network requests. It is
   [on the Chrome Web Store](https://chromewebstore.google.com/detail/escriba-for-google-meet/pefbdollankflnpigefmonogfhnehjfc).
2. **[escriba-mcp](https://www.npmjs.com/package/escriba-mcp)**, a local
   [Model Context Protocol](https://modelcontextprotocol.io) server that gives any MCP client
   (Claude Code, Claude Desktop, Cursor, VS Code...) read-only access to those files, over
   stdio, with no network involved.

```
claude mcp add escriba --env ESCRIBA_SELF_NAME="Your Name" -- npx -y escriba-mcp
```

I wrote about the extension side (automating a UI you don't own) in
[a previous article](https://abdielotzoy.github.io/escriba/articles/transcribing-google-meet-without-bots).
This one is about the AI side: what it takes to give a model good, safe access to personal
data.

## Why tools and not RAG

The usual answer to "let an LLM answer questions over my documents" is RAG: chunk the
text, embed it, store the vectors, retrieve the nearest chunks for each question.

I didn't need any of that here, and I think it's worth saying why:

- **The data is small and structured.** One person's meetings are a few hundred files a
  year, each with front matter: title, date, duration, participants, language. Most
  questions are anchored to things a filter answers exactly: a date, a person, a meeting.
- **The model is good at navigating.** Given the right tools, it does what a person would
  do: list the meetings from last week, search for a word, open the one that matters and
  read it whole. Reading the whole transcript beats reading the five chunks a similarity
  search guessed were relevant.
- **No index means nothing to keep in sync.** The extension writes a file and the next tool
  call sees it. There is no embedding step, no vector store and no model to download.

If this had to work over thousands of hours of meetings across a company, retrieval would
come back into the picture. For a personal archive, plain tools over files are simpler and
give better answers.

## Designing tools for a model, not for a person

The server exposes three tools:

| Tool                                                    | Returns                                             |
| ------------------------------------------------------- | --------------------------------------------------- |
| `list_meetings({from?, to?, participant?})`             | Meetings, newest first, with their metadata         |
| `search_transcripts({query, from?, to?, participant?})` | Matching paragraphs, with meeting, speaker and time |
| `read_meeting({file})`                                  | One meeting's metadata and its whole transcript     |

They map to how you'd look for something yourself: browse, search, read. A few decisions
made them work much better with a model.

### Descriptions are prompts

The model picks a tool and fills its arguments from the description and the schema, so
those are written for it:

```js
server.registerTool(
  'search_transcripts',
  {
    description:
      'Searches what was said in the saved meetings, ignoring case and accents. Returns the ' +
      'matching paragraphs with file, title, date, speaker and time. `capped` is true when ' +
      'there were more matches than the ones returned: narrow the search.',
    inputSchema: { query: z.string().trim().min(1).describe('Text to look for'), ...filter },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  (args) => json(searchTranscripts(options, args)),
);
```

Dates are validated with a regex in the Zod schema (`YYYY-MM-DD`), so a malformed argument
fails with a message the model can correct, instead of silently matching nothing.
`readOnlyHint` and `openWorldHint: false` tell the client these tools change nothing and
touch nothing outside the machine, so it can call them without alarming the user.

### Protect the context window, and say so

A search for a common word across a year of meetings can return thousands of paragraphs.
Dumping them all would fill the model's context and bury the answer. The search stops at
50 hits and returns `capped: true`, and the description tells the model what to do about
it: **narrow the search**. In practice it adds a date range or a participant and tries
again, which is exactly what you'd want.

A silent limit would be worse than no limit: the model would think it had seen everything.

### Match the way people (and models) type names

Meetings in Spanish are full of names like _Ibáñez_ or _Muñoz_. Users type them without
accents and models sometimes do too. Every comparison folds case and accents first:

```js
const fold = (text) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
```

so `ibanez` finds `Ibáñez`.

### Resolve "me"

Meet labels your own speech as "You" or "Tú", depending on its language. That breaks the
most useful question of all: _"what did I commit to?"_. With `ESCRIBA_SELF_NAME` set, the
server replaces those labels with your name in every result and filter, without touching
the files.

## Data boundaries

"Local" is easy to claim and easy to get wrong, so these are the rules the server keeps:

- **Read-only.** It never writes, renames or deletes anything.
- **No network.** It talks to the client over stdio and nothing else.
- **Only its own files.** It only reads `.md` files in the transcripts folder, and only
  those whose front matter looks like one Escriba wrote. Anything else in the folder is
  ignored.
- **No path traversal.** `read_meeting` takes a file name chosen by a model, which makes it
  untrusted input. A name with any directory part is refused before touching the disk:

```js
// A bare file name cannot leave the folder; anything with a directory part is refused.
const bare = path.basename(file) === file && file.endsWith('.md');
```

And one honest caveat, which is also in the README: the server keeps your data on your
machine, but **the AI app you connect it to receives what it reads**. If that app is a
cloud assistant, the transcript text goes to its provider. Giving people the full picture
matters more than a nicer-sounding privacy claim.

## Why stdio and not HTTP

MCP has two transports: **stdio**, where the client starts the server as a child process
and they talk through its standard input and output, and **Streamable HTTP**, where the
server listens on a URL. A lot of MCP examples reach for HTTP. For this server it would
have been the wrong choice:

- **Nothing listens.** A stdio server opens no port. An HTTP server on `localhost` can be
  reached by any other process on the machine and, without care, by web pages in your
  browser (DNS rebinding is the classic way). Transcripts of private meetings are exactly
  what you don't want behind a port.
- **No auth to build.** Only the client that started the process can talk to it, so there
  are no tokens, no OAuth flow and no TLS certificates to get right. The most secure auth
  code is the one that doesn't need to exist.
- **Nothing to keep running.** The client starts the server when it needs it and ends it
  when it closes. There's no daemon, no service to install and no port conflict to debug.
- **The permissions are already right.** The process runs as you and can read what you can
  read, which is precisely your own transcripts.

HTTP is the right transport when the server is **shared or remote**: one server for a team,
a hosted product, or a web client like claude.ai that can't start local processes. Each of
those means the transcripts live on, or travel to, someone else's machine, which is the
thing this project exists to avoid. The cost of stdio is that each user needs Node.js
installed, and `npx` keeps that to one line of configuration.

## One parser, two runtimes

The extension has a strict rule: no build step and no runtime dependencies. Every file is a
classic browser script that declares one global. The transcript parser (`transcript.js`,
Markdown in and out, including the Spanish field names older versions wrote) lives there.

The MCP server is a Node ES module with real dependencies (the MCP SDK and Zod). I didn't
want a second parser that could drift from the first, and I didn't want to add a bundler to
the extension to share one.

So the server loads the extension's parser the same way the browser does, as a classic
script, with Node's `vm` module:

```js
const transcript = vm.runInThisContext(fs.readFileSync(parserFile, 'utf8') + '\ntranscript', {
  filename: parserFile,
});
```

In the repository it reads `../src/shared/transcript.js` directly. For npm, a `prepack`
script copies the file into the package. One source of truth, no build step on either side,
and the server's dependencies stay out of the extension.

## Finding the Downloads folder is harder than it sounds

The extension saves into the browser's Downloads folder, and the server has to find it with
no help from the browser. "`~/Downloads`" is wrong more often than you'd think:

- **Windows** lets you move the folder (often to OneDrive). The real location is in the
  registry, under `User Shell Folders`, keyed by the Downloads known-folder GUID, sometimes
  with `%USERPROFILE%`-style variables to expand.
- **Linux** names it in the system's language: on a Spanish desktop it's `~/Descargas`. The
  truth is in `~/.config/user-dirs.dirs`, as `XDG_DOWNLOAD_DIR`, honoring `XDG_CONFIG_HOME`.
- **macOS** keeps it in `~/Downloads`.

The lookup takes the system as a parameter (`platform`, `home`, `env`, `readFile`, `run`),
so unit tests can feed it a fake registry or a fake `user-dirs.dirs` for each case, and
anything that can't be detected falls back to the default and can be overridden with
`ESCRIBA_DIR`.

## Testing what users actually install

The server has three layers of tests:

1. **Unit tests** for the search, filters and folder lookup, using only `node:` modules, so
   they run without installing anything.
2. **An end-to-end test** that starts the real server as a child process and talks to it
   through the MCP SDK's own client over stdio, against a folder of sample transcripts, the
   same way Claude or Cursor would.
3. **The published package.** CI runs `npm pack`, installs the tarball in a temporary folder
   away from the repository, and runs the end-to-end test against that installed copy. That
   catches the classic mistake of a package that works in the repo but is missing a file
   once published (like the copied parser).

All of it runs on Ubuntu, Windows and macOS in GitHub Actions, since the folder lookup is
different on each.

## The part underneath: making the data reliable

An AI layer is only as good as the data it reads, and here the data comes from scraping a
UI I don't control. A few things on the extension side exist so the transcripts can be
trusted:

- **Capture survives background tabs.** Browsers throttle timers in hidden tabs to as little
  as once a minute, so capture is driven by a `MutationObserver`, not a timer.
- **Text that rewrites itself.** Meet rewrites a caption block while the person talks and
  empties it when it gets long; entries are replaced, not appended, so there are no
  duplicated sentences.
- **Crash recovery.** The meeting so far is backed up on every tick, and the service worker
  turns leftover backups into transcripts when the tab closes or the browser restarts.
- **A watchdog.** If captions are off, or speakers are on screen but no text can be read
  (Meet changed its HTML), for more than 20 seconds, the icon turns amber and a notification
  appears. A tool that fails silently is worse than none.
- **Contained fragility.** Everything that knows Meet's HTML is in one module, tested
  against HTML samples, so when Google changes the page, one file and its tests show what
  broke.

Escriba is about 1,500 lines of plain JavaScript for the extension and about 350 for the
server, with type checking from JSDoc, unit tests, Playwright end-to-end tests against a
fake Meet page, and CI on every push.

## What I'd do next

- **Summaries and action items as a prompt, not a feature.** MCP supports prompts as well
  as tools; a "summarize this meeting" prompt would keep the logic in the client's model,
  where it belongs, instead of shipping my own.
- **Semantic search, if the archive grows.** If keyword search stops being enough, local
  embeddings could sit behind the same `search_transcripts` tool without changing the
  contract the model already knows.

## Try it

- Extension: [Chrome Web Store](https://chromewebstore.google.com/detail/escriba-for-google-meet/pefbdollankflnpigefmonogfhnehjfc)
- MCP server: `npx -y escriba-mcp` ([setup for each client](https://github.com/AbdielOtzoy/escriba/tree/main/mcp))
- Code (MIT): [github.com/AbdielOtzoy/escriba](https://github.com/AbdielOtzoy/escriba)

I'm a software engineer in Guatemala, building backend and AI integration work. If you're
working on something similar, or hiring for it, I'd like to hear from you.
