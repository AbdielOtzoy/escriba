// Starts the real server as a child process and talks to it with the SDK's client.
// Not named *.test.js on purpose: the root `npm test` runs without the SDK installed.
import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createSampleFolder, removeSampleFolder } from './samples.js';

/** @type {string} */
let dir;
/** @type {Client} */
let client;

before(async () => {
  dir = createSampleFolder();
  client = new Client({ name: 'escriba-e2e', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      // ESCRIBA_SERVER: the server of an installed npm package instead (CI tests the tarball).
      args: [process.env.ESCRIBA_SERVER || path.join(import.meta.dirname, 'server.js')],
      env: { ESCRIBA_DIR: dir, ESCRIBA_SELF_NAME: 'Lucía Ferrer' },
    }),
  );
});
after(async () => {
  await client.close();
  removeSampleFolder(dir);
});

/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @returns {Promise<{ isError: boolean, text: string }>}
 */
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  const content = /** @type {{ type: string, text: string }[]} */ (result.content);
  return { isError: Boolean(result.isError), text: content.map((c) => c.text).join('\n') };
}

test('initializes and offers exactly the three read-only tools', async () => {
  assert.equal(client.getServerVersion()?.name, 'escriba');
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), [
    'list_meetings',
    'read_meeting',
    'search_transcripts',
  ]);
  for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
  const search = tools.find((t) => t.name === 'search_transcripts');
  assert.deepEqual(search?.inputSchema.required, ['query']);
});

test('list_meetings', async () => {
  const all = JSON.parse((await call('list_meetings', {})).text);
  assert.deepEqual(
    all.map((/** @type {{ title: string }} */ m) => m.title),
    ['Daily', 'Planning', 'Retro', 'Long'],
  );
  assert.deepEqual(all[0].participants, ['Lucía Ferrer', 'Marta Ibáñez']);

  const mine = await call('list_meetings', { participant: 'lucia', from: '2026-11-01' });
  assert.deepEqual(
    JSON.parse(mine.text).map((/** @type {{ title: string }} */ m) => m.title),
    ['Daily', 'Planning'],
  );
});

test('search_transcripts', async () => {
  const found = JSON.parse((await call('search_transcripts', { query: 'facturacion' })).text);
  assert.equal(found.capped, false);
  assert.deepEqual(
    found.hits.map((/** @type {{ speaker: string }} */ h) => h.speaker),
    ['Marta Ibáñez', 'Íñigo Peña'],
  );
  const many = JSON.parse((await call('search_transcripts', { query: 'zebra' })).text);
  assert.equal(many.hits.length, 50);
  assert.equal(many.capped, true);
});

test('read_meeting', async () => {
  const { isError, text } = await call('read_meeting', { file: '2026-10-03 1600 - Retro.md' });
  assert.equal(isError, false);
  assert.match(text, /"title": "Retro"/);
  assert.match(text, /"link": "https:\/\/meet\.google\.com\/uvw-xyza-bcd"/);
  assert.match(text, /Lucía Ferrer \(16:05\):\nPropongo una alerta para el almacén\./);
});

test('errors come back as tool errors and the server keeps running', async () => {
  const traversal = await call('read_meeting', { file: `../${path.basename(dir)}-outside.md` });
  assert.equal(traversal.isError, true);
  assert.match(traversal.text, /Not an Escriba transcript/);

  // Depending on the SDK version, invalid arguments are a tool error or a protocol error.
  const badDate = await call('list_meetings', { from: 'yesterday' }).catch((error) => ({
    isError: true,
    text: String(error),
  }));
  assert.equal(badDate.isError, true);
  assert.match(badDate.text, /YYYY-MM-DD/);

  assert.equal((await call('list_meetings', {})).isError, false);
});
