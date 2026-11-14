// Service worker: escribe el .md en Descargas/transcripciones-meet y recupera
// las transcripciones que quedaron sin guardar (pestaña cerrada, navegador caído).

const bajando = new Set(); // evita bajar dos veces si llegan "guardar" y el cierre de pestaña juntos

async function bajar(clave, reg) {
  if (bajando.has(clave)) return;
  bajando.add(clave);
  await chrome.downloads.download({
    url: 'data:text/markdown;charset=utf-8,' + encodeURIComponent(reg.md),
    filename: 'transcripciones-meet/' + reg.archivo,
    saveAs: false,
    conflictAction: 'uniquify',
  });
  // La copia de respaldo pasa al historial que muestra historial.html.
  await chrome.storage.local.set({ ['hist_' + clave]: { archivo: reg.archivo, md: reg.md } });
  await chrome.storage.local.remove(clave);
}

async function recuperar(filtro) {
  const todo = await chrome.storage.local.get(null);
  for (const [clave, reg] of Object.entries(todo)) {
    if (clave.startsWith('reunion_') && filtro(reg)) await bajar(clave, reg);
  }
}

chrome.runtime.onMessage.addListener((m, remitente, responder) => {
  const tabId = remitente.tab?.id;
  if (m.tipo === 'guardar') bajar(m.clave, m.registro);
  if (m.tipo === 'estado') pintarIcono(tabId, m.estado, m.n, m.motivo);
  if (m.tipo === 'avisar') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icono.png',
      title: m.titulo || 'Escriba: no se está transcribiendo',
      message: m.motivo,
    });
  }
  if (m.tipo === 'hola') {
    recuperar((r) => r.tabId === tabId).then(() => responder(tabId));
    return true; // la respuesta es asíncrona
  }
});

chrome.tabs.onRemoved.addListener((tabId) => recuperar((r) => r.tabId === tabId));
chrome.runtime.onStartup.addListener(() => recuperar(() => true));

// Indicador en el icono: REC en rojo mientras transcribe, gris en pausa, ! ámbar si falla.
function pintarIcono(tabId, estado, n, motivo) {
  const texto = { grabando: 'REC', pausa: 'II', alerta: '!' }[estado] || '';
  const color = { pausa: '#80868b', alerta: '#f9ab00' }[estado] || '#d93025';
  const titulo = {
    grabando: `Transcribiendo · ${n} intervenciones`,
    pausa: `En pausa · ${n} intervenciones`,
    alerta: `No se está transcribiendo. ${motivo}`,
  }[estado] || 'Escriba';
  chrome.action.setBadgeText({ tabId, text: texto });
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeTextColor({ tabId, color: estado === 'alerta' ? '#000000' : '#ffffff' });
  chrome.action.setTitle({ tabId, title: titulo });
}
