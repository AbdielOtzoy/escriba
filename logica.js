// Lógica pura, compartida por la extensión y por la prueba de Node.

const dos = (n) => String(n).padStart(2, '0');
const fecha = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const hora = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;

// Meet reescribe el texto de un bloque mientras la persona habla (corrige palabras),
// así que la intervención se reemplaza entera. Si el texto se acorta de golpe, Meet
// vació el bloque por largo y empezó de nuevo: eso abre una intervención nueva.
function actualizar(entradas, entrada, nombre, texto, ahora) {
  if (!texto) return entrada;
  if (!entrada || entrada.nombre !== nombre || texto.length < entrada.texto.length - 100) {
    entrada = { nombre, hora: ahora, texto };
    entradas.push(entrada);
  } else {
    entrada.texto = texto;
  }
  return entrada;
}

function aMarkdown({ titulo, enlace, inicio, entradas, idioma }, fin) {
  const d = new Date(inicio);
  const participantes = [...new Set(entradas.map((e) => e.nombre))];
  let md =
    `---\ntitulo: ${JSON.stringify(titulo)}\nfecha: ${fecha(d)}\ninicio: "${hora(d)}"\n` +
    `duracion_min: ${Math.round((fin - inicio) / 60000)}\n` +
    `participantes: ${JSON.stringify(participantes)}\n` +
    (idioma ? `idioma: ${JSON.stringify(idioma)}\n` : '') +
    `enlace: ${enlace}\n---\n\n# ${titulo}\n`;
  let anterior;
  for (const e of entradas) {
    md += e.nombre === anterior ? '\n' : `\n**${e.nombre}** (${hora(new Date(e.hora))})\n\n`;
    md += e.texto + '\n';
    anterior = e.nombre;
  }
  return md;
}

function nombreArchivo(titulo, inicio) {
  const d = new Date(inicio);
  const limpio = titulo.replace(/[\\/:*?"<>|~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${fecha(d)} ${dos(d.getHours())}${dos(d.getMinutes())} - ${limpio || 'reunión'}.md`;
}

// Inverso de aMarkdown: el historial guarda solo el .md, y el menú y la página de
// transcripciones lo leen de vuelta para mostrar datos y turnos con formato.
function deMarkdown(md) {
  const [, cab = '', cuerpo = md] = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || [];
  const dato = (k) => (cab.match(new RegExp(`^${k}: (.*)$`, 'm')) || [])[1];
  const json = (v, def) => {
    try {
      return JSON.parse(v);
    } catch {
      return def;
    }
  };
  const turnos = [];
  for (const linea of cuerpo.split('\n')) {
    const m = linea.match(/^\*\*(.+)\*\* \((\d\d:\d\d)\)$/);
    if (m) turnos.push({ nombre: m[1], hora: m[2], parrafos: [] });
    else if (linea.trim() && turnos.length) turnos.at(-1).parrafos.push(linea);
  }
  return {
    titulo: json(dato('titulo'), ''),
    fecha: dato('fecha') || '',
    inicio: json(dato('inicio'), ''),
    duracion: Number(dato('duracion_min')) || 0,
    participantes: json(dato('participantes'), []),
    turnos,
  };
}

// ¿El idioma de los subtítulos, como lo escribe Meet («Español (México)»), es el idioma
// `codigo` («es»)? `interfaz` es el idioma en que Meet escribe los nombres de idioma.
function idiomaCoincide(idiomaSubtitulos, codigo, interfaz) {
  const nombre = new Intl.DisplayNames([interfaz], { type: 'language' }).of(codigo);
  return idiomaSubtitulos.toLowerCase().startsWith(nombre.toLowerCase());
}

// "12 nov · 10:30 · 30 min"
function resumenReunion({ fecha, inicio, duracion }) {
  const d = new Date(`${fecha}T${inicio || '00:00'}`);
  const dia = isNaN(d) ? fecha : d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return [dia, inicio, `${duracion} min`].filter(Boolean).join(' · ');
}

if (typeof module !== 'undefined') {
  module.exports = {
    actualizar,
    aMarkdown,
    nombreArchivo,
    deMarkdown,
    resumenReunion,
    idiomaCoincide,
  };
}
