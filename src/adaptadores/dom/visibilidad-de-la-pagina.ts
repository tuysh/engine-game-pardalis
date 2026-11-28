// Avisa cuando la página deja de verse y cuando se ve otra vez: otra pestaña, la ventana minimizada,
// el teléfono bloqueado. Con esto el juego se pausa solo (la opción `pausarAlOcultar`).
//
// Se usa el evento `visibilitychange` del documento, que todos los navegadores actuales tienen.

/** Lo que hay que hacer cuando cambia la visibilidad de la página. */
export interface AlCambiarLaVisibilidad {
  readonly alOcultarse: () => void;
  readonly alMostrarse: () => void;
}

/**
 * Empieza a vigilar la visibilidad de la página. Si la página ya está oculta al llamarla
 * (por ejemplo, el juego terminó de cargar en una pestaña de fondo), avisa `alOcultarse` enseguida.
 * Devuelve una función que deja de vigilar.
 */
export function vigilarLaVisibilidadDeLaPagina(avisos: AlCambiarLaVisibilidad): () => void {
  const alCambiar = (): void => {
    if (document.visibilityState === 'hidden') {
      avisos.alOcultarse();
    } else {
      avisos.alMostrarse();
    }
  };
  const vigilancia = new AbortController();
  document.addEventListener('visibilitychange', alCambiar, { signal: vigilancia.signal });
  if (document.visibilityState === 'hidden') {
    avisos.alOcultarse();
  }
  return () => {
    vigilancia.abort();
  };
}
