// Después de que un toque, Enter o la barra espaciadora siguen un diálogo, hablar descansa un momento.
//
// Por qué: niñas y niños tocan u oprimen dos veces muy seguido. La primera vez cierra la última línea de una
// plática o de una escena; la segunda llega cuando el diálogo ya terminó, y sin esta espera hablaría con quien
// está cerca (casi siempre el acompañante, que va junto al jugador) o con quien quedó debajo del dedo, y
// empezaría una plática que nadie pidió.
//
// La usan los controles del teclado (la tecla de hablar no pide hablar) y la interfaz (la capa de toque se queda
// un momento atrapando toques, para que el segundo no caiga en el escenario).
//
// Se mide con el reloj del navegador (`performance.now()` o el `timeStamp` de cada evento) y no con el del
// juego: lo que importa es el tiempo entre dos dedazos de verdad.

/** Cuánto descansa hablar después de seguir un diálogo. Un doble toque, con el dedo o con una tecla, cabe de sobra. */
export const MILISEGUNDOS_SIN_HABLAR_TRAS_SEGUIR_UN_DIALOGO = 500;

export class EsperaParaVolverAHablar {
  /** Cuándo una tecla de hablar siguió el diálogo por última vez. Al principio, nunca. */
  private momentoDelUltimoSeguirEnMilisegundos = Number.NEGATIVE_INFINITY;

  /** Un toque o una tecla siguió (o cerró) una línea del diálogo en ese momento. */
  anotarQueSeSiguioElDialogo(momentoEnMilisegundos: number): void {
    this.momentoDelUltimoSeguirEnMilisegundos = momentoEnMilisegundos;
  }

  /** `true` si en ese momento ya se puede empezar una plática. */
  puedeHablar(momentoEnMilisegundos: number): boolean {
    return this.milisegundosQueFaltan(momentoEnMilisegundos) <= 0;
  }

  /** Cuánto falta, desde ese momento, para que se pueda volver a hablar. `0` = ya se puede. */
  milisegundosQueFaltan(momentoEnMilisegundos: number): number {
    const transcurridos = momentoEnMilisegundos - this.momentoDelUltimoSeguirEnMilisegundos;
    return Math.max(0, MILISEGUNDOS_SIN_HABLAR_TRAS_SEGUIR_UN_DIALOGO - transcurridos);
  }
}
