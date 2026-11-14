// Corre en el mundo de la página (no en el aislado de la extensión), antes que Meet.
//
// Meet reserva una franja para los subtítulos y calcula el tamaño del video a partir del
// alto de la ventana, no de lo que mide en pantalla. Para que el video recupere esa franja
// cuando los subtítulos están ocultos, se le reporta un alto mayor: el real más lo que
// contenido.js anota en <html data-mt-extra>. Sin ese atributo no cambia nada.
{
  const extra = () => Number(document.documentElement.dataset.mtExtra) || 0;
  const alto = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight').get;
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get() {
      return alto.call(this) + extra();
    },
  });
  const ventana = Object.getOwnPropertyDescriptor(window, 'innerHeight').get;
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get() {
      return ventana.call(window) + extra();
    },
  });
}
