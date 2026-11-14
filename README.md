# Escriba

Extensión de navegador que transcribe tus reuniones de Google Meet a Markdown, con el
nombre de quien habla. No entra un bot a la reunión y nada sale de tu máquina: lee los
subtítulos que Meet ya genera.

## Instalar (Brave, Chrome o Edge)

1. Clona o descarga esta carpeta.
2. Abre `brave://extensions` (o `chrome://extensions`).
3. Activa **Modo de desarrollador**.
4. **Cargar extensión sin empaquetar** y elige esta carpeta.
5. En `brave://settings/downloads` desactiva **Preguntar dónde guardar cada archivo**;
   si queda activo, el navegador pregunta en cada reunión.

## Usar

Entra a una reunión. La extensión activa los subtítulos sola, los oculta de la pantalla
(el video recupera ese espacio; la transcripción sigue igual) y el icono de la extensión
muestra **REC** en rojo (fija el icono en la barra para verlo). Al pasar el cursor por el
icono se ve cuántas intervenciones lleva. Un clic en el icono abre un menú para pausar
(**II** en gris) o reanudar, y para ver las transcripciones guardadas.

En el menú del icono, bajo **Ajustes**, se puede apagar **Transcribir automáticamente al
entrar a una reunión**. Apagado, la extensión no hace nada al entrar: ni enciende los
subtítulos ni guarda. Para transcribir una reunión concreta, pulsa **Transcribir** en el
mismo menú.

Si deja de poder transcribir más de 20 segundos (subtítulos apagados, o Meet cambió), el
icono pasa a **!** en ámbar y sale una notificación del sistema. Para verla, Brave debe
tener permiso de notificaciones en Ajustes del Sistema de macOS.

Al salir de la llamada o cerrar la pestaña, el archivo queda en:

```
Descargas/transcripciones-meet/2026-11-12 1030 - Título de la reunión.md
```

Cada transcripción queda además guardada en el navegador. El menú del icono muestra las
últimas cuatro con un botón para copiarlas, y **Ver todas** abre la página completa, con
buscador, para leerlas, copiarlas, volver a descargarlas o borrarlas. Ese historial vive solo en este navegador y se pierde si quitas la extensión
(recargarla no lo borra); el archivo de Descargas es la copia de respaldo.

Si el navegador se cierra de golpe, la transcripción se guarda al volver a abrirlo.

## A tener en cuenta

- Meet transcribe en un solo idioma: el que tengas elegido en sus subtítulos (lo recuerda
  entre reuniones). El menú del icono muestra cuál está activo, con un botón **Cambiar**
  que abre ese ajuste de Meet, y la primera vez sale un aviso. La extensión no puede saber
  en qué idioma se habla; el ajuste opcional **Avisarme si el idioma de los subtítulos no
  es el de mi navegador** solo compara esos dos.
- Solo se captura desde que entras, y mientras los subtítulos estén activos.
- Tu propia voz aparece con la etiqueta que Meet te pone (normalmente «Tú»).
- No se guarda audio ni el chat de la reunión.

## Si deja de capturar

Google cambia el HTML de Meet cada cierto tiempo. Si el contador del icono se queda en 0
mientras alguien habla, lo que hay que ajustar está en el primer bloque de `contenido.js`.

## Probar la lógica

```
node --test
```

## Licencia

[MIT](LICENSE)
