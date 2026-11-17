// A temporary folder that looks like a Downloads folder with Escriba transcripts in it.
// Invented names and sentences only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const daily = `---
title: "Daily"
date: 2026-11-12
start: "10:30"
duration_min: 15
participants: ["Tú","Marta Ibáñez"]
language: "Español (México)"
link: https://meet.google.com/abc-defg-hij
---

# Daily

**Tú** (10:30)

Hoy termino la migración del catálogo.

**Marta Ibáñez** (10:31)

El informe de facturación sale mañana.

Después reviso los permisos del almacén.
`;

const planning = `---
title: "Planning"
date: 2026-11-10
start: "09:00"
duration_min: 45
participants: ["Oskar Lindqvist","You"]
language: "English"
link: https://meet.google.com/klm-nopq-rst
---

# Planning

**Oskar Lindqvist** (09:00)

The warehouse permissions need another review.

**You** (09:02)

I will take the catalog migration.
`;

// Written before version 2: Spanish front-matter keys.
const retro = `---
titulo: "Retro"
fecha: 2026-10-03
inicio: "16:00"
duracion_min: 30
participantes: ["Íñigo Peña","Tú"]
idioma: "Español (México)"
enlace: https://meet.google.com/uvw-xyza-bcd
---

# Retro

**Íñigo Peña** (16:00)

La facturación falló dos veces este mes.

**Tú** (16:05)

Propongo una alerta para el almacén.
`;

const notes = `---
title: "Shopping list"
---

**Someone** (10:00)

Facturación, catálogo and other words a search must not find here.
`;

const long =
  `---\ntitle: "Long"\ndate: 2026-09-01\nstart: "08:00"\nduration_min: 60\n` +
  `participants: ["Ravi Anand"]\nlink: https://meet.google.com/efg-hijk-lmn\n---\n\n# Long\n\n` +
  `**Ravi Anand** (08:00)\n\n` +
  Array.from({ length: 60 }, (_, i) => `Zebra number ${i}.\n`).join('\n');

/** @returns {string} the folder; the caller removes it */
export function createSampleFolder() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'escriba-mcp-'));
  /** @type {Record<string, string>} */
  const files = {
    '2026-11-12 1030 - Daily.md': daily,
    '2026-11-10 0900 - Planning.md': planning,
    '2026-10-03 1600 - Retro.md': retro,
    '2026-09-01 0800 - Long.md': long,
    'notes.md': notes,
    'report.txt': daily,
    'old/2026-11-12 1030 - Daily.md': daily, // subfolders are not read
    '2026-01-01 0000 - Folder.md/inside.txt': 'a folder named like a transcript cannot be read',
  };
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  fs.writeFileSync(path.join(dir, '..', path.basename(dir) + '-outside.md'), daily);
  return dir;
}

/** @param {string} dir */
export function removeSampleFolder(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir + '-outside.md', { force: true });
}
