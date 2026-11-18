// Finds the folder the browser saves downloads into by default, the way Chromium does on
// each system. A folder chosen in the browser's own settings cannot be known from here:
// that case needs ESCRIBA_DIR.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

// Windows keeps the place of its Downloads known folder (FOLDERID_Downloads) here.
const SHELL_FOLDERS =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders';
const DOWNLOADS_ID = '{374DE290-123F-4565-9164-39C4925E467B}';

/**
 * What the lookup needs from the system; tests pass a fake one.
 * @typedef {{
 *   platform: string,
 *   home: string,
 *   env: Record<string, string | undefined>,
 *   readFile: (file: string) => string,
 *   run: (command: string, args: string[]) => string,
 * }} System
 */

/** @type {System} */
const real = {
  platform: process.platform,
  home: os.homedir(),
  env: process.env,
  readFile: (file) => fs.readFileSync(file, 'utf8'),
  run: (command, args) =>
    execFileSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 5000 }),
};

/**
 * @param {Partial<System>} [system]
 * @returns {string} absolute path of the Downloads folder
 */
export function downloadsFolder(system = {}) {
  const sys = { ...real, ...system };
  const fallback = (sys.platform === 'win32' ? path.win32 : path.posix).join(sys.home, 'Downloads');
  try {
    if (sys.platform === 'win32') return fromRegistry(sys) || fallback;
    if (sys.platform === 'darwin') return fallback;
    return fromUserDirs(sys) || fallback;
  } catch {
    return fallback; // no registry value or no user-dirs.dirs: the default name is used
  }
}

/**
 * Windows: the folder can be moved (Properties → Location, or to OneDrive).
 * shortcut: `reg` prints in the console code page, so a moved folder whose path has
 * accents comes out garbled; if that is reported, ask PowerShell with UTF-8 output.
 * @param {System} sys
 */
function fromRegistry({ run, env }) {
  const out = run('reg', ['query', SHELL_FOLDERS, '/v', DOWNLOADS_ID]);
  const value = out.match(/REG_(?:EXPAND_)?SZ[ \t]+([^\r\n]*?)[ \t]*\r?$/m)?.[1];
  // %USERPROFILE% and the like; Windows variable names ignore case.
  const lookup = (/** @type {string} */ name) =>
    Object.entries(env).find(([key]) => key.toUpperCase() === name.toUpperCase())?.[1];
  return value?.replace(/%([^%]+)%/g, (whole, name) => lookup(name) ?? whole);
}

/**
 * Linux and other Unix: the XDG user directory, named in the system's language when it was
 * installed (~/Descargas, ~/Téléchargements…).
 * @param {System} sys
 */
function fromUserDirs({ home, env, readFile }) {
  const configHome = env.XDG_CONFIG_HOME?.startsWith('/')
    ? env.XDG_CONFIG_HOME
    : path.posix.join(home, '.config');
  const text = readFile(path.posix.join(configHome, 'user-dirs.dirs'));
  /** @param {string} name */
  const dir = (name) => {
    const raw = text.match(new RegExp(`^\\s*XDG_${name}_DIR\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'));
    const value = raw?.[1].replace(/\\(.)/g, '$1');
    if (value === '$HOME' || value?.startsWith('$HOME/')) return home + value.slice(5);
    return value?.startsWith('/') ? value : undefined; // the format allows nothing else
  };
  const downloads = dir('DOWNLOAD')?.replace(/\/+$/, '');
  // Like Chromium: the home folder or the desktop are not taken as the downloads folder.
  if (!downloads || downloads === home.replace(/\/+$/, '') || downloads === dir('DESKTOP')) {
    return undefined;
  }
  return downloads;
}
