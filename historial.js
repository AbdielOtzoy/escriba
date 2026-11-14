const $ = (id) => document.getElementById(id);
const crear = (etiqueta, clase, texto) => {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
};

let reuniones = []; // [{ clave, archivo, md, titulo, datos }] de más reciente a más antigua
let elegida = location.hash.slice(1);

// Un color estable por persona: el tono sale del nombre.
const tono = (nombre) => [...nombre].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 360, 7);

async function cargar() {
  const todo = await chrome.storage.local.get(null);
  // La clave lleva la hora de inicio (hist_reunion_<ms>), así que ordenar claves ordena por fecha.
  reuniones = Object.keys(todo)
    .filter((k) => k.startsWith('hist_'))
    .sort()
    .reverse()
    .map((clave) => {
      const { archivo, md } = todo[clave];
      const datos = deMarkdown(md);
      return { clave, archivo, md, datos, titulo: datos.titulo || archivo.replace(/\.md$/, '') };
    });
  pintar();
}

function pintar() {
  const q = $('buscar').value.trim().toLowerCase();
  const visibles = reuniones.filter((r) => !q || r.md.toLowerCase().includes(q));
  if (!visibles.some((r) => r.clave === elegida)) elegida = visibles[0]?.clave || '';

  $('aviso').hidden = visibles.length > 0;
  $('aviso').textContent = reuniones.length
    ? 'Nada coincide con la búsqueda.'
    : 'Todavía no hay transcripciones guardadas.';
  $('lista').replaceChildren(
    ...visibles.map((r) => {
      const b = crear('button');
      b.append(
        crear('strong', '', r.titulo),
        crear('span', 'tenue', resumenReunion(r.datos)),
        crear('span', 'tenue', r.datos.participantes.join(', ')),
      );
      b.setAttribute('aria-current', r.clave === elegida);
      b.onclick = () => {
        elegida = r.clave;
        history.replaceState(null, '', '#' + r.clave);
        pintar();
      };
      const li = crear('li');
      li.append(b);
      return li;
    }),
  );
  pintarDetalle(reuniones.find((r) => r.clave === elegida));
}

function pintarDetalle(r) {
  if (!r) return $('detalle').replaceChildren();
  const { datos, md } = r;

  const copiar = crear('button', 'boton principal', 'Copiar');
  copiar.onclick = async () => {
    await navigator.clipboard.writeText(md);
    copiar.textContent = 'Copiado';
    setTimeout(() => (copiar.textContent = 'Copiar'), 1500);
  };
  const descargar = crear('button', 'boton', 'Descargar');
  descargar.onclick = () =>
    chrome.downloads.download({
      url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(md),
      filename: 'transcripciones-meet/' + r.archivo,
      conflictAction: 'uniquify',
    });
  const borrar = crear('button', 'boton peligro', 'Borrar');
  borrar.onclick = async () => {
    if (!confirm(`¿Borrar «${r.titulo}» del navegador? El archivo de Descargas no se toca.`)) return;
    await chrome.storage.local.remove(r.clave);
    cargar();
  };
  const acciones = crear('div', 'acciones');
  acciones.append(copiar, descargar, borrar);

  const turnos = datos.turnos.map((t) => {
    const nombre = crear('span', 'nombre', t.nombre);
    nombre.style.setProperty('--tono', tono(t.nombre));
    const cab = crear('header');
    cab.append(nombre, crear('span', 'tenue', t.hora));
    const turno = crear('section', 'turno');
    turno.append(cab, ...t.parrafos.map((p) => crear('p', '', p)));
    return turno;
  });

  $('detalle').replaceChildren(
    crear('h2', '', r.titulo),
    crear('div', 'tenue', [resumenReunion(datos), datos.participantes.join(', ')].filter(Boolean).join(' · ')),
    acciones,
    // Si el texto no tiene nuestro formato, se muestra tal cual en vez de quedar vacío.
    ...(turnos.length ? turnos : [crear('p', '', md)]),
  );
}

$('buscar').oninput = pintar;
cargar();
