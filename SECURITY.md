# Security policy

Escriba reads what is said in your meetings, so a security problem in it matters even if it
looks small. Thank you for reporting one privately.

## Report a vulnerability

Use GitHub's private reporting: [Report a vulnerability](https://github.com/AbdielOtzoy/escriba/security/advisories/new).
Only the maintainer sees the report. Please do not open a public issue, and do not include
real transcripts.

Escriba is maintained by one person in their spare time. You will get an answer within a
week, and a fix as soon as one is ready, with credit in the advisory if you want it.

## What counts

For example:

- the extension sending anything out of the computer, or reading pages other than Google
  Meet;
- text from a meeting (a name, a sentence, a title) running as code in the extension's
  pages;
- the MCP server reading files outside the transcripts folder, or writing anything;
- a way for a website or another extension to read the saved transcripts.

## Supported versions

Only the latest version, the one in the Chrome Web Store and in the latest
[release](https://github.com/AbdielOtzoy/escriba/releases/latest), gets fixes. For the MCP
server, the latest version of [`escriba-mcp`](https://www.npmjs.com/package/escriba-mcp)
on npm.
