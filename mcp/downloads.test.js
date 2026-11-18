// node --test
// The Downloads folder on each system, against fake ones; and on this machine, the real one.
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { downloadsFolder } from './downloads.js';

const noFile = () => {
  throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
};

/**
 * @param {string} text contents of user-dirs.dirs
 * @param {Record<string, string>} [env]
 */
function linux(text, env = {}) {
  /** @type {string[]} */
  const read = [];
  const folder = downloadsFolder({
    platform: 'linux',
    home: '/home/ana',
    env,
    readFile: (file) => (read.push(file), text),
  });
  return { folder, read };
}

// What `reg query` prints, with Windows line endings.
/** @param {string} type @param {string} value */
const regOutput = (type, value) =>
  '\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders\r\n' +
  `    {374DE290-123F-4565-9164-39C4925E467B}    ${type}    ${value}\r\n\r\n`;

/** @param {() => string} run @param {Record<string, string>} [env] */
function windows(run, env = { USERPROFILE: 'C:\\Users\\Ana' }) {
  /** @type {string[][]} */
  const calls = [];
  const folder = downloadsFolder({
    platform: 'win32',
    home: 'C:\\Users\\Ana',
    env,
    run: (command, args) => (calls.push([command, ...args]), run()),
  });
  return { folder, calls };
}

test('macOS: always ~/Downloads, the name on disk whatever the language', () => {
  const folder = downloadsFolder({ platform: 'darwin', home: '/Users/ana', readFile: noFile });
  assert.equal(folder, '/Users/ana/Downloads');
});

test('Linux: the XDG download folder, named in the system language', () => {
  const file = `# This file is written by xdg-user-dirs-update
XDG_DESKTOP_DIR="$HOME/Escritorio"
XDG_DOWNLOAD_DIR="$HOME/Descargas"
XDG_DOCUMENTS_DIR="$HOME/Documentos"
`;
  const { folder, read } = linux(file);
  assert.equal(folder, '/home/ana/Descargas');
  assert.deepEqual(read, ['/home/ana/.config/user-dirs.dirs']);
});

test('Linux: absolute paths, escaped characters and a trailing slash', () => {
  assert.equal(
    linux('XDG_DOWNLOAD_DIR="/data/ana/Téléchargements/"').folder,
    '/data/ana/Téléchargements',
  );
  assert.equal(linux('  XDG_DOWNLOAD_DIR = "$HOME/My \\"files\\""').folder, '/home/ana/My "files"');
});

test('Linux: user-dirs.dirs is read from XDG_CONFIG_HOME when it is absolute', () => {
  const line = 'XDG_DOWNLOAD_DIR="$HOME/Baixades"';
  assert.deepEqual(linux(line, { XDG_CONFIG_HOME: '/cfg' }).read, ['/cfg/user-dirs.dirs']);
  assert.deepEqual(linux(line, { XDG_CONFIG_HOME: 'cfg' }).read, [
    '/home/ana/.config/user-dirs.dirs',
  ]);
});

test('Linux: ~/Downloads when there is no usable XDG download folder', () => {
  const missing = downloadsFolder({
    platform: 'linux',
    home: '/home/ana',
    env: {},
    readFile: noFile,
  });
  assert.equal(missing, '/home/ana/Downloads');
  for (const text of [
    '',
    '# XDG_DOWNLOAD_DIR="$HOME/Descargas"',
    'XDG_DOWNLOAD_DIR="Descargas"', // relative: not allowed by the format
    'XDG_DOWNLOAD_DIR="$HOME"', // the home folder itself
    'XDG_DOWNLOAD_DIR="$HOME/"',
    'XDG_DESKTOP_DIR="$HOME/Escritorio"\nXDG_DOWNLOAD_DIR="$HOME/Escritorio"', // the desktop
  ]) {
    assert.equal(linux(text).folder, '/home/ana/Downloads', text);
  }
});

test('Windows: the Downloads known folder from the registry, variables expanded', () => {
  const { folder, calls } = windows(() => regOutput('REG_EXPAND_SZ', '%USERPROFILE%\\Downloads'));
  assert.equal(folder, 'C:\\Users\\Ana\\Downloads');
  assert.deepEqual(calls, [
    [
      'reg',
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders',
      '/v',
      '{374DE290-123F-4565-9164-39C4925E467B}',
    ],
  ]);
});

test('Windows: a folder moved to another drive or to OneDrive', () => {
  assert.equal(windows(() => regOutput('REG_SZ', 'D:\\Descargas')).folder, 'D:\\Descargas');
  const onedrive = windows(() => regOutput('REG_EXPAND_SZ', '%OneDrive%\\Downloads'), {
    ONEDRIVE: 'C:\\Users\\Ana\\OneDrive',
  });
  assert.equal(onedrive.folder, 'C:\\Users\\Ana\\OneDrive\\Downloads');
});

test('Windows: the default folder when the registry has no answer', () => {
  const failing = () => {
    throw new Error('ERROR: The system was unable to find the specified registry key or value.');
  };
  assert.equal(windows(failing).folder, 'C:\\Users\\Ana\\Downloads');
  assert.equal(windows(() => '').folder, 'C:\\Users\\Ana\\Downloads');
  assert.equal(windows(() => regOutput('REG_EXPAND_SZ', '')).folder, 'C:\\Users\\Ana\\Downloads');
});

test('this machine: an absolute path, with no variable left unexpanded', () => {
  const folder = downloadsFolder();
  assert.ok(path.isAbsolute(folder), folder);
  assert.doesNotMatch(folder, /[%$]/);
  if (process.platform === 'darwin') assert.equal(folder, path.join(os.homedir(), 'Downloads'));
  if (process.platform === 'win32') assert.match(folder, /^[A-Za-z]:\\|^\\\\/);
});

test('Windows only: the real registry is read and its variables expanded', (t) => {
  if (process.platform !== 'win32') return t.skip('needs Windows');
  // The default value is %USERPROFILE%\Downloads, so a made-up profile shows it was expanded
  // from the registry and not taken from the fallback.
  const folder = downloadsFolder({ env: { USERPROFILE: 'X:\\Probe' } });
  assert.equal(folder, 'X:\\Probe\\Downloads');
});
