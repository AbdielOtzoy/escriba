const $ = (id) => document.getElementById(id);
const abrirHistorial = (clave = '') =>
  chrome.tabs.create({ url: chrome.runtime.getURL('historial.html') + (clave && '#' + clave) });

let accion = 'pausa'; // lo que hace el botón principal según el estado

function mostrar(r) {
  if (!r || r.estado === 'nada') return;
  $('idioma').hidden = !r.idioma;
  $('idiomaNombre').textContent = r.idioma;
  $('punto').className = 'punto ' + r.estado;
  accion = r.estado === 'lista' ? 'iniciar' : 'pausa';
  $('estado').textContent = {
    lista: 'Esta reunión no se está transcribiendo',
    grabando: `Transcribiendo · ${r.n} intervenciones`,
    pausa: `En pausa · ${r.n} intervenciones`,
    alerta: `No se está transcribiendo. ${r.motivo}`,
  }[r.estado];
  $('pausa').hidden = false;
  $('pausa').textContent = { lista: 'Transcribir', pausa: 'Reanudar' }[r.estado] || 'Pausar';
}

async function pedir(tipo) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Falla si la pestaña no es de Meet: se queda el texto por defecto.
  mostrar(await chrome.tabs.sendMessage(tab.id, { tipo }).catch(() => null));
}

async function pintarRecientes() {
  const todo = await chrome.storage.local.get(null);
  const claves = Object.keys(todo).filter((k) => k.startsWith('hist_')).sort().reverse().slice(0, 4);
  $('vacio').hidden = claves.length > 0;
  $('recientes').replaceChildren(
    ...claves.map((clave) => {
      const { archivo, md } = todo[clave];
      const d = deMarkdown(md);
      const titulo = document.createElement('strong');
      titulo.textContent = d.titulo || archivo.replace(/\.md$/, '');
      const meta = document.createElement('span');
      meta.className = 'tenue';
      meta.textContent = resumenReunion(d);
      const abrir = document.createElement('button');
      abrir.className = 'abrir';
      abrir.append(titulo, meta);
      abrir.onclick = () => abrirHistorial(clave);
      const copiar = document.createElement('button');
      copiar.className = 'boton';
      copiar.textContent = 'Copiar';
      copiar.setAttribute('aria-label', `Copiar la transcripción de ${titulo.textContent}`);
      copiar.onclick = async () => {
        await navigator.clipboard.writeText(md);
        copiar.textContent = 'Copiado';
        setTimeout(() => (copiar.textContent = 'Copiar'), 1500);
      };
      const li = document.createElement('li');
      li.append(abrir, copiar);
      return li;
    }),
  );
}

$('pausa').onclick = () => pedir(accion);
// Abre el ajuste de idioma de Meet en la pestaña de la reunión; el menú se cierra para verlo.
$('cambiarIdioma').onclick = async () => {
  await pedir('idioma');
  close();
};
chrome.storage.local.get('ajustes').then(({ ajustes }) => {
  $('auto').checked = ajustes?.auto ?? true;
  $('detectar').checked = ajustes?.detectar ?? false;
});
$('auto').onchange = $('detectar').onchange = () =>
  chrome.storage.local.set({ ajustes: { auto: $('auto').checked, detectar: $('detectar').checked } });
$('todas').onclick = () => abrirHistorial();
pedir('estado?');
pintarRecientes();
