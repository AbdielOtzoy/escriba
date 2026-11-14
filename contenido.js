// Corre dentro de meet.google.com: detecta la llamada, activa los subtítulos y los captura.

// Todo lo que depende del HTML de Meet vive en este bloque. Si Google cambia la
// página y la extensión deja de capturar, lo que hay que ajustar está aquí.
const RE_SALIR = /leave call|salir de la llamada|abandonar la llamada/i;
const RE_ACTIVAR = /turn on captions|activar (los )?subt[ií]tulos/i;
const RE_REGION = /captions|subt[ií]tulos/i;

const botones = () => [...document.querySelectorAll('button')];
const enLlamada = () =>
  botones().some((b) => RE_SALIR.test(b.ariaLabel || '') || b.textContent.includes('call_end'));
// Meet actual: el botón «Subtítulos y traducción» (icono translate_cc) solo abre un menú;
// dentro está el botón real «Activar subtítulos» (icono closed_caption_off), que en el
// Meet anterior estaba directo en la barra.
const botonActivar = () =>
  botones().find(
    (b) => RE_ACTIVAR.test(b.ariaLabel || '') || b.textContent.includes('closed_caption_off'),
  );
function activarSubtitulos() {
  const directo = botonActivar();
  if (directo) return directo.click();
  const menu = botones().find(
    (b) => b.textContent.trim() === 'translate_cc' && b.ariaExpanded !== 'true',
  );
  if (!menu) return;
  menu.click();
  menuAbierto = menu;
  setTimeout(() => botonActivar()?.click(), 600);
}
// A veces el menú queda abierto tras activar. Con los subtítulos ya encendidos, Escape lo
// cierra sin apagarlos (cerrarlo antes de que enciendan sí cancela la activación).
let menuAbierto = null;
function cerrarMenu() {
  if (menuAbierto?.ariaExpanded === 'true') {
    (document.activeElement || document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }),
    );
  }
  menuAbierto = null;
}

// La caja de los subtítulos trae, además del texto, el idioma activo (junto al icono
// `language`) y un botón (icono `settings`) que abre el ajuste de idioma de Meet. Se
// ubican por el icono y no por la etiqueta, que cambia con el idioma de la interfaz.
let caja = null;
const hojaConIcono = (icono) =>
  caja && [...caja.querySelectorAll('*')].find((e) => !e.children.length && e.textContent.trim() === icono);
function leerIdioma() {
  let el = hojaConIcono('language');
  while (el && el !== caja && el.textContent.trim() === 'language') el = el.parentElement;
  return el && el !== caja ? el.textContent.replace('language', '').trim() : '';
}
const abrirAjusteIdioma = () => hojaConIcono('settings')?.closest('button')?.click();

// Oculta los subtítulos sin sacarlos del HTML (la captura los sigue leyendo) y anota el
// alto de la franja que Meet les reserva, para que pagina.js se lo devuelva al video.
function ocultarSubtitulos(r) {
  caja = r;
  while (caja.parentElement && !caja.parentElement.querySelector('main')) caja = caja.parentElement;
  caja.style.setProperty('opacity', '0', 'important');
  caja.style.setProperty('pointer-events', 'none', 'important');
  reservar(caja.offsetHeight);
  // Meet apila avisos (por ejemplo el de un mensaje de chat) justo encima de la franja de
  // subtítulos: son hermanos de la caja anclados más arriba que ella. Se bajan lo mismo que
  // mide la franja. Se repite en cada tic porque Meet reescribe esos estilos.
  const base = parseFloat(caja.style.bottom) || 0;
  for (const h of caja.parentElement.children) {
    if (h !== caja && h.style.bottom && !h.style.top && parseFloat(h.style.bottom) > base) {
      h.style.setProperty('margin-bottom', `-${caja.offsetHeight}px`, 'important');
      bajados.add(h);
    }
  }
}
const bajados = new Set();
function reservar(alto) {
  const raiz = document.documentElement;
  if ((Number(raiz.dataset.mtExtra) || 0) === alto) return;
  if (alto) raiz.dataset.mtExtra = alto;
  else delete raiz.dataset.mtExtra;
  if (!alto) {
    for (const h of bajados) h.style.removeProperty('margin-bottom');
    bajados.clear();
  }
  // El área de video (<main>) sigue recortada por CSS aunque el video ya ocupe la franja.
  // Se estira igual, para que lo anclado a su borde inferior (las reacciones con emojis
  // que suben) salga desde abajo y no desde donde estaban los subtítulos.
  let estilo = document.getElementById('mt-estilo');
  if (!estilo) {
    estilo = document.createElement('style');
    estilo.id = 'mt-estilo';
    document.head.append(estilo);
  }
  estilo.textContent = alto ? `main { margin-bottom: -${alto}px !important; }` : '';
  dispatchEvent(new Event('resize')); // Meet recalcula el tamaño del video
}
const buscarRegion = () =>
  [...document.querySelectorAll('[role="region"]')].find((r) => RE_REGION.test(r.ariaLabel || '')) ||
  document.querySelector('div[role="region"][tabindex="0"]');

// Cada intervención es un bloque con [avatar + nombre] seguido del texto. Se ubica
// por estructura (la foto) y no por clases CSS, que Meet cambia seguido.
function leerBloques(region) {
  const bloques = new Map();
  for (const img of region.querySelectorAll('img')) {
    let el = img.parentElement;
    while (el && el !== region) {
      const sig = el.nextElementSibling;
      if (el.textContent.trim() && sig && !sig.querySelector('img')) {
        bloques.set(el.parentElement, {
          nombre: el.textContent.trim(),
          texto: sig.textContent.trim(),
        });
        break;
      }
      el = el.parentElement;
    }
  }
  return bloques;
}

const tituloReunion = () =>
  document.querySelector('[data-meeting-title]')?.dataset.meetingTitle ||
  document.title.replace(/^Meet\s*[-–:]\s*/, '').trim() ||
  location.pathname.slice(1);
// --- fin de lo que depende del HTML de Meet ---

let reunion = null; // { clave, inicio, enlace, entradas }
let tabId = null;
let pausado = false;
let sucio = false;
let region = null;
let fueraSeguidos = 0;
let enCurso = false; // hay una llamada en esta pestaña, se esté transcribiendo o no
let auto = true; // ajuste: empezar a transcribir sola al entrar a una reunión
let detectar = false; // ajuste: avisar si el idioma de los subtítulos no es el del navegador
let idiomaAvisado = true; // ya se mostró el aviso de primera vez sobre el idioma
let malDesde = 0; // desde cuándo no se está pudiendo transcribir
let alerta = null; // motivo, cuando lleva más de 20 s así
let porBloque = new WeakMap();
const observador = new MutationObserver(escanear);
const SALTAR = {}; // marca bloques que ya estaban en pantalla al reanudar una pausa

function escanear() {
  if (!reunion || pausado || !region) return;
  for (const [bloque, { nombre, texto }] of leerBloques(region)) {
    const previa = porBloque.get(bloque);
    if (previa === SALTAR) continue;
    const antes = previa?.texto;
    const entrada = actualizar(reunion.entradas, previa, nombre, texto, Date.now());
    if (entrada) porBloque.set(bloque, entrada);
    if (entrada && entrada.texto !== antes) sucio = true;
  }
  pintar();
}

function registro() {
  const datos = { ...reunion, titulo: tituloReunion() };
  return {
    tabId,
    archivo: nombreArchivo(datos.titulo, reunion.inicio),
    md: aMarkdown(datos, Date.now()),
  };
}

function iniciar() {
  reunion = {
    clave: `reunion_${Date.now()}`,
    inicio: Date.now(),
    enlace: location.origin + location.pathname,
    entradas: [],
  };
  pausado = false;
  porBloque = new WeakMap();
  pintar();
}

function finalizar() {
  if (!reunion) return;
  observador.disconnect();
  if (reunion.entradas.length) {
    chrome.runtime.sendMessage({ tipo: 'guardar', clave: reunion.clave, registro: registro() });
  }
  reunion = null;
  region = null;
  malDesde = 0;
  alerta = null;
  reservar(0);
  pintar();
}

function tic() {
  const dentro = enLlamada();
  enCurso = dentro;
  if (!reunion) {
    if (dentro && auto) iniciar();
    else pintar(); // el menú del icono ofrece empezarla a mano
    return;
  }
  // Dos lecturas seguidas fuera de la llamada, para no cortar por un repintado de Meet.
  fueraSeguidos = dentro ? 0 : fueraSeguidos + 1;
  if (fueraSeguidos >= 2) return finalizar();
  if (!dentro || pausado) return;

  const r = buscarRegion();
  if (!r) {
    reservar(0);
    activarSubtitulos();
  } else {
    cerrarMenu();
    ocultarSubtitulos(r);
    if (r !== region) {
      region = r;
      observador.disconnect();
      observador.observe(r, { childList: true, subtree: true, characterData: true });
      escanear();
    }
  }
  if (r) revisarIdioma();
  vigilar(r);
  // Copia de respaldo: si la pestaña o el navegador mueren, fondo.js la recupera.
  if (sucio) {
    sucio = false;
    chrome.storage.local.set({ [reunion.clave]: registro() });
  }
}

// Meet transcribe en un solo idioma, el que la persona tenga elegido, y la extensión no
// puede saber en qué idioma se está hablando. Lo que sí hace: avisar la primera vez cuál
// está activo y, si el ajuste está encendido, avisar cuando no es el del navegador.
function revisarIdioma() {
  const idioma = leerIdioma();
  if (!idioma || idioma === reunion.idioma) return;
  reunion.idioma = idioma;
  sucio = true;
  const codigo = chrome.i18n.getUILanguage().split('-')[0];
  const mio = new Intl.DisplayNames(['es'], { type: 'language' }).of(codigo);
  if (detectar && !idiomaCoincide(idioma, codigo, document.documentElement.lang || 'es')) {
    chrome.runtime.sendMessage({
      tipo: 'avisar',
      titulo: 'Escriba: revisa el idioma',
      motivo: `Los subtítulos están en ${idioma} y tu navegador está en ${mio}. Si la reunión es en ${mio}, cámbialo desde el icono de la extensión.`,
    });
  } else if (!idiomaAvisado) {
    chrome.runtime.sendMessage({
      tipo: 'avisar',
      titulo: 'Escriba: idioma de la transcripción',
      motivo: `Se transcribe en ${idioma}. Si la reunión es en otro idioma, cámbialo desde el icono de la extensión.`,
    });
  }
  idiomaAvisado = true;
  chrome.storage.local.set({ idiomaAvisado: true });
}

// Que un fallo no pase en silencio: si los subtítulos llevan 20 s apagados, o hay alguien
// hablando en pantalla y no se le puede leer el texto, el icono cambia y sale un aviso.
function vigilar(r) {
  const problema = !r
    ? 'Los subtítulos están apagados y no se pudieron encender.'
    : r.querySelector('img') && ![...leerBloques(r).values()].some((b) => b.texto)
      ? 'Hay subtítulos en pantalla pero no se pueden leer. Puede que Meet haya cambiado.'
      : null;
  if (!problema) malDesde = 0;
  else if (!malDesde) malDesde = Date.now();
  const nueva = problema && Date.now() - malDesde > 20000 ? problema : null;
  if (nueva && !alerta) chrome.runtime.sendMessage({ tipo: 'avisar', motivo: nueva });
  alerta = nueva;
  pintar();
}

// --- Indicador: va en el icono de la extensión (lo pinta fondo.js) ---
let ultimoEstado = '';
// 'lista': hay llamada pero no se transcribe (ajuste automático apagado).
const estadoActual = () =>
  !reunion ? (enCurso ? 'lista' : 'nada') : pausado ? 'pausa' : alerta ? 'alerta' : 'grabando';
function pintar() {
  const estado = estadoActual();
  const n = reunion ? reunion.entradas.length : 0;
  if (estado + n === ultimoEstado) return;
  ultimoEstado = estado + n;
  chrome.runtime.sendMessage({ tipo: 'estado', estado, n, motivo: alerta });
}

// El menú del icono pregunta el estado ('estado?'), pide pausar o reanudar ('pausa') y,
// con el ajuste automático apagado, empezar la transcripción a mano ('iniciar').
chrome.runtime.onMessage.addListener((m, _remitente, responder) => {
  if (m.tipo === 'iniciar' && !reunion && enLlamada()) iniciar();
  if (m.tipo === 'idioma') abrirAjusteIdioma();
  if (m.tipo === 'pausa' && reunion) {
    pausado = !pausado;
    malDesde = 0;
    alerta = null;
    // Lo dicho durante la pausa sigue en pantalla al reanudar: se marca para no capturarlo.
    if (!pausado && region) for (const b of leerBloques(region).keys()) porBloque.set(b, SALTAR);
    pintar();
  }
  if (m.tipo === 'pausa' || m.tipo === 'iniciar' || m.tipo === 'estado?') {
    responder({
      estado: estadoActual(),
      n: reunion ? reunion.entradas.length : 0,
      motivo: alerta,
      idioma: reunion?.idioma || '',
    });
  }
});

// 'hola' también hace que fondo.js guarde lo que quedó pendiente de esta pestaña.
chrome.runtime.sendMessage({ tipo: 'hola' }, (id) => {
  tabId = id;
});
function aplicarAjustes(ajustes) {
  auto = ajustes?.auto ?? true;
  detectar = ajustes?.detectar ?? false;
}
chrome.storage.local.get(['ajustes', 'idiomaAvisado']).then((g) => {
  aplicarAjustes(g.ajustes);
  idiomaAvisado = !!g.idiomaAvisado;
});
chrome.storage.onChanged.addListener((cambios) => {
  if (cambios.ajustes) aplicarAjustes(cambios.ajustes.newValue);
});
addEventListener('pagehide', finalizar);
setInterval(tic, 2000);
