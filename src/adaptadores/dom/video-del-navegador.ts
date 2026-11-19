// El video a pantalla completa, hecho con un elemento `<video>` encima del lienzo del escenario
// (docs/DISENO-3.0.md §7.4). Formato esperado: MP4 (H.264 + AAC), que funciona en iPad y en Chrome.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador.

import type { ResultadoDeVideo, Video } from '../../puertos/video.ts';

export class VideoDelNavegador implements Video {
  private readonly elementoDelJuego: HTMLElement;
  /** El video que se está viendo. `undefined` = ninguno. */
  private reproductor: HTMLVideoElement | undefined;
  private estaDestruido = false;

  constructor(elementoDelJuego: HTMLElement) {
    this.elementoDelJuego = elementoDelJuego;
  }

  reproducir(direccionDelVideo: string, senal: AbortSignal): Promise<ResultadoDeVideo> {
    if (this.estaDestruido || senal.aborted) {
      return Promise.resolve('visto');
    }

    return new Promise((terminar) => {
      const reproductor = this.crearReproductor();
      this.reproductor = reproductor;

      const finalizar = (resultado: ResultadoDeVideo): void => {
        reproductor.removeEventListener('ended', alTerminarDeVerse);
        reproductor.removeEventListener('error', alFallar);
        senal.removeEventListener('abort', alCancelar);
        reproductor.pause();
        reproductor.remove();
        if (this.reproductor === reproductor) {
          this.reproductor = undefined;
        }
        terminar(resultado);
      };
      const alTerminarDeVerse = (): void => finalizar('visto');
      const alFallar = (): void => finalizar('no_se_pudo');
      const alCancelar = (): void => finalizar('visto');

      reproductor.addEventListener('ended', alTerminarDeVerse);
      reproductor.addEventListener('error', alFallar);
      senal.addEventListener('abort', alCancelar, { once: true });
      reproductor.src = direccionDelVideo;
      // `play()` rechaza si el archivo no sirve o si todavía no hubo un toque que desbloquee el sonido.
      reproductor.play().catch((error: unknown) => {
        // También rechaza si se pausa el video cuando apenas está arrancando (el juego entró en pausa):
        // eso no es una falla, el video sigue ahí y continúa al reanudar.
        if (esUnaPausaAlArrancar(error)) return;
        alFallar();
      });
    });
  }

  pausar(): void {
    if (this.reproductor !== undefined) {
      this.reproductor.pause();
    }
  }

  reanudar(): void {
    if (this.reproductor === undefined) return;
    // Si el navegador no deja reanudar, el video se queda en pausa; no hay nada más que hacer.
    this.reproductor.play().catch((error: unknown) => {
      console.warn('[escenario-engine] no se pudo reanudar el video:', error);
    });
  }

  destruir(): void {
    this.estaDestruido = true;
    if (this.reproductor !== undefined) {
      this.reproductor.pause();
      this.reproductor.remove();
      this.reproductor = undefined;
    }
  }

  private crearReproductor(): HTMLVideoElement {
    const reproductor = document.createElement('video');
    // Sin esto, el iPhone abre el video en su propio reproductor a pantalla completa y tapa el botón de saltar.
    reproductor.playsInline = true;
    reproductor.style.position = 'absolute';
    reproductor.style.inset = '0';
    reproductor.style.width = '100%';
    reproductor.style.height = '100%';
    // El video se ve completo, con franjas negras si su forma no es la de la pantalla.
    reproductor.style.objectFit = 'contain';
    reproductor.style.background = '#000';
    // Va al principio del elemento del juego: así queda encima del lienzo (que no tiene posición propia)
    // y debajo de la interfaz, para que el botón de saltar se siga viendo.
    this.elementoDelJuego.prepend(reproductor);
    return reproductor;
  }
}

/**
 * El navegador avisa con un error llamado `AbortError` cuando `pause()` interrumpe a un `play()`
 * que no terminaba de empezar.
 */
function esUnaPausaAlArrancar(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
