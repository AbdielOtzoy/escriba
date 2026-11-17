#!/usr/bin/env node
// MCP server (stdio) over the transcripts Escriba saved. The logic lives in meetings.js.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listMeetings, readMeeting, searchTranscripts } from './meetings.js';

// The extension saves into a subfolder of Downloads named after the browser's language
// (`downloadFolder` in _locales): read the ones that exist.
const downloads = path.join(os.homedir(), 'Downloads');
const [saved = downloads, ...also] = ['meet-transcripts', 'transcripciones-meet']
  .map((name) => path.join(downloads, name))
  .filter((dir) => fs.existsSync(dir));

const options = {
  dir: process.env.ESCRIBA_DIR || saved,
  also: process.env.ESCRIBA_DIR ? [] : also,
  selfName: process.env.ESCRIBA_SELF_NAME || undefined,
};

const day = z.string().regex(/^\d{4}-\d\d-\d\d$/, 'Expected YYYY-MM-DD');
const filter = {
  from: day.optional().describe('Earliest meeting date, YYYY-MM-DD, inclusive'),
  to: day.optional().describe('Latest meeting date, YYYY-MM-DD, inclusive'),
  participant: z
    .string()
    .optional()
    .describe('Part of a participant name; case and accents are ignored'),
};
const annotations = { readOnlyHint: true, openWorldHint: false };

/** @param {string} text */
const reply = (text) => ({ content: [{ type: /** @type {const} */ ('text'), text }] });
/** @param {unknown} value */
const json = (value) => reply(JSON.stringify(value, null, 2));

const server = new McpServer({ name: 'escriba', version: '0.1.0' });

server.registerTool(
  'list_meetings',
  {
    description:
      'Lists the Google Meet transcripts saved by Escriba, newest first: file, title, date, ' +
      'start time, duration in minutes, participants and caption language.',
    inputSchema: filter,
    annotations,
  },
  (args) => json(listMeetings(options, args)),
);

server.registerTool(
  'search_transcripts',
  {
    description:
      'Searches what was said in the saved meetings, ignoring case and accents. Returns the ' +
      'matching paragraphs with file, title, date, speaker and time. `capped` is true when ' +
      'there were more matches than the ones returned: narrow the search.',
    inputSchema: { query: z.string().trim().min(1).describe('Text to look for'), ...filter },
    annotations,
  },
  (args) => json(searchTranscripts(options, args)),
);

server.registerTool(
  'read_meeting',
  {
    description: 'Returns one meeting: its metadata, then the whole transcript as text.',
    inputSchema: {
      file: z.string().describe('File name as returned by list_meetings or search_transcripts'),
    },
    annotations,
  },
  ({ file }) => {
    const { text, ...metadata } = readMeeting(options, file);
    return reply(`${JSON.stringify(metadata, null, 2)}\n\n${text}`);
  },
);

await server.connect(new StdioServerTransport());
