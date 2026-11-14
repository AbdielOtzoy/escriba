// node --test
const test = require('node:test');
const assert = require('node:assert');
const { actualizar, aMarkdown, nombreArchivo, deMarkdown, idiomaCoincide } = require('./logica.js');

const t = (h, m) => new Date(2026, 10, 12, h, m).getTime();

test('una intervención se reescribe mientras la persona habla', () => {
  const entradas = [];
  let e = actualizar(entradas, undefined, 'Ana', 'hola a', t(10, 30));
  e = actualizar(entradas, e, 'Ana', 'Hola a todos.', t(10, 30));
  assert.deepStrictEqual(entradas, [{ nombre: 'Ana', hora: t(10, 30), texto: 'Hola a todos.' }]);
});

test('el texto vacío no crea intervención', () => {
  const entradas = [];
  assert.strictEqual(actualizar(entradas, undefined, 'Ana', '', 1), undefined);
  assert.strictEqual(entradas.length, 0);
});

test('si Meet vacía un bloque largo, lo anterior se conserva', () => {
  const entradas = [];
  const largo = 'x'.repeat(500);
  let e = actualizar(entradas, undefined, 'Ana', largo, 1);
  e = actualizar(entradas, e, 'Ana', 'Sigo hablando', 2);
  assert.deepStrictEqual(entradas.map((x) => x.texto), [largo, 'Sigo hablando']);
});

test('markdown agrupa por hablante y lista participantes', () => {
  const md = aMarkdown(
    {
      titulo: 'Daily',
      enlace: 'https://meet.google.com/abc-defg-hij',
      inicio: t(10, 30),
      entradas: [
        { nombre: 'Ana', hora: t(10, 31), texto: 'Hola.' },
        { nombre: 'Ana', hora: t(10, 32), texto: 'Empiezo yo.' },
        { nombre: 'Luis', hora: t(10, 33), texto: 'Dale.' },
      ],
    },
    t(11, 0),
  );
  assert.match(md, /fecha: 2026-11-12\ninicio: "10:30"\nduracion_min: 30\nparticipantes: \["Ana","Luis"\]/);
  assert.ok(md.endsWith('# Daily\n\n**Ana** (10:31)\n\nHola.\n\nEmpiezo yo.\n\n**Luis** (10:33)\n\nDale.\n'));
});

test('nombre de archivo sin caracteres inválidos', () => {
  assert.strictEqual(nombreArchivo('Daily: equipo/dev?', t(9, 5)), '2026-11-12 0905 - Daily equipo dev.md');
  assert.strictEqual(nombreArchivo('', t(9, 5)), '2026-11-12 0905 - reunión.md');
});

test('deMarkdown recupera lo que escribió aMarkdown', () => {
  const md = aMarkdown(
    {
      titulo: 'Daily: "equipo"',
      enlace: 'https://meet.google.com/abc-defg-hij',
      inicio: t(10, 30),
      entradas: [
        { nombre: 'Ana', hora: t(10, 31), texto: 'Hola.' },
        { nombre: 'Ana', hora: t(10, 32), texto: 'Empiezo yo.' },
        { nombre: 'Luis', hora: t(10, 33), texto: 'Dale.' },
      ],
    },
    t(11, 0),
  );
  assert.deepStrictEqual(deMarkdown(md), {
    titulo: 'Daily: "equipo"',
    fecha: '2026-11-12',
    inicio: '10:30',
    duracion: 30,
    participantes: ['Ana', 'Luis'],
    turnos: [
      { nombre: 'Ana', hora: '10:31', parrafos: ['Hola.', 'Empiezo yo.'] },
      { nombre: 'Luis', hora: '10:33', parrafos: ['Dale.'] },
    ],
  });
});

test('deMarkdown no falla con texto que no es nuestro formato', () => {
  assert.deepStrictEqual(deMarkdown('hola').turnos, []);
});

test('idiomaCoincide compara con el nombre que usa Meet en su interfaz', () => {
  assert.ok(idiomaCoincide('Español (México)', 'es', 'es-419'));
  assert.ok(idiomaCoincide('Spanish (Mexico)', 'es', 'en'));
  assert.ok(!idiomaCoincide('Inglés', 'es', 'es-419'));
});

test('el idioma de los subtítulos queda en el encabezado solo si se conoce', () => {
  const base = { titulo: 'Daily', enlace: 'x', inicio: t(10, 30), entradas: [] };
  assert.match(aMarkdown({ ...base, idioma: 'Español (México)' }, t(10, 31)), /\nidioma: "Español \(México\)"\n/);
  assert.doesNotMatch(aMarkdown(base, t(10, 31)), /idioma:/);
});
