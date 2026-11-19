// Video falso para las pruebas: no reproduce nada. Anota qué video se pidió, y la prueba decide
// cuándo «termina» con `terminarVideo()`.

import type { ResultadoDeVideo, Video } from '../../puertos/video.ts';

export class VideoDeMemoria implements Video {
  /** Las direcciones de los videos que se han pedido, en orden. */
  readonly videosPedidos: string[] = [];
  /** Lo que `reproducir` responde. Con `'no_se_pudo'` responde de inmediato, como un video que no carga. */
  resultadoAlReproducir: ResultadoDeVideo = 'visto';
  estaPausado = false;
  estaDestruido = false;

  /** Termina el video que se está viendo. `undefined` = no hay ninguno. */
  private terminarVideoActual: (() => void) | undefined;

  reproducir(direccionDelVideo: string, senal: AbortSignal): Promise<ResultadoDeVideo> {
    this.videosPedidos.push(direccionDelVideo);
    if (this.resultadoAlReproducir === 'no_se_pudo') {
      return Promise.resolve('no_se_pudo');
    }
    if (senal.aborted) {
      return Promise.resolve('visto');
    }

    return new Promise((terminar) => {
      const alCancelar = (): void => {
        this.terminarVideoActual = undefined;
        terminar('visto');
      };
      this.terminarVideoActual = () => {
        senal.removeEventListener('abort', alCancelar);
        this.terminarVideoActual = undefined;
        terminar('visto');
      };
      senal.addEventListener('abort', alCancelar, { once: true });
    });
  }

  pausar(): void {
    this.estaPausado = true;
  }

  reanudar(): void {
    this.estaPausado = false;
  }

  destruir(): void {
    this.estaDestruido = true;
  }

  get hayUnVideoEnCurso(): boolean {
    return this.terminarVideoActual !== undefined;
  }

  /** Para las pruebas: hace como si el video hubiera llegado a su final. */
  terminarVideo(): void {
    if (this.terminarVideoActual !== undefined) {
      this.terminarVideoActual();
    }
  }
}
