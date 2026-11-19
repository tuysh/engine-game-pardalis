// El fundido a negro de toda la pantalla. Los pasos `fundido` la oscurecen (`cerrar`) o la aclaran (`abrir`).
//
// `abrir` siempre parte de negro: así una cinemática de entrada puede empezar con él aunque la pantalla
// estuviera clara. `cerrar` parte de lo oscura que ya esté la pantalla, para no dar un destello si ya era negra.
// Solo hay un fundido a la vez: uno nuevo detiene al que estuviera en curso.

import type { Interfaz } from '../puertos/interfaz.ts';
import type { Reloj } from '../puertos/reloj.ts';

const OPACIDAD_DE_PANTALLA_CLARA = 0;
const OPACIDAD_DE_PANTALLA_NEGRA = 1;

/** Hacia dónde va un fundido: `abrir` aclara la pantalla y `cerrar` la oscurece. */
export type SentidoDeFundido = 'abrir' | 'cerrar';

/** De qué opacidad a cuál va la pantalla, y en cuánto tiempo. 0 = clara, 1 = negra. */
interface CambioDeOpacidad {
  readonly desde: number;
  readonly hasta: number;
  readonly duracionEnSegundos: number;
}

export class FundidoDePantalla {
  private readonly interfaz: Interfaz;
  private readonly reloj: Reloj;
  private opacidad = OPACIDAD_DE_PANTALLA_CLARA;
  /** Detiene el fundido que está en curso y termina su promesa. `undefined` = no hay ninguno. */
  private detenerElFundidoEnCurso: (() => void) | undefined;

  constructor(interfaz: Interfaz, reloj: Reloj) {
    this.interfaz = interfaz;
    this.reloj = reloj;
  }

  /** `true` si la pantalla está oscurecida, aunque sea un poco. */
  get estaOscura(): boolean {
    return this.opacidad > OPACIDAD_DE_PANTALLA_CLARA;
  }

  /** Deja la pantalla de una vez como queda al terminar un fundido: clara (`abrir`) o negra (`cerrar`). */
  dejar(sentido: SentidoDeFundido): void {
    this.detenerElQueEsteEnCurso();
    this.poner(opacidadFinalDe(sentido));
  }

  /**
   * Aclara u oscurece la pantalla poco a poco. La promesa termina cuando acaba el fundido.
   * Si `senal` se dispara antes, termina en ese momento y la pantalla se queda como iba.
   */
  fundir(sentido: SentidoDeFundido, duracionEnSegundos: number, senal: AbortSignal): Promise<void> {
    if (duracionEnSegundos <= 0) {
      this.dejar(sentido);
      return Promise.resolve();
    }
    if (senal.aborted) {
      return Promise.resolve();
    }
    this.detenerElQueEsteEnCurso();

    const opacidadFinal = opacidadFinalDe(sentido);
    let opacidadInicial = this.opacidad;
    if (sentido === 'abrir') {
      opacidadInicial = OPACIDAD_DE_PANTALLA_NEGRA;
    }
    if (opacidadInicial === opacidadFinal) {
      // La pantalla ya está como debe quedar (se pidió cerrar y ya estaba negra): no hay nada que esperar.
      return Promise.resolve();
    }
    return this.llevarLaOpacidad({ desde: opacidadInicial, hasta: opacidadFinal, duracionEnSegundos }, senal);
  }

  /** Lleva la opacidad de un valor a otro, cuadro a cuadro. Termina al llegar o cuando `senal` se dispara. */
  private llevarLaOpacidad(cambio: CambioDeOpacidad, senal: AbortSignal): Promise<void> {
    this.poner(cambio.desde);

    return new Promise((terminar) => {
      let segundosTranscurridos = 0;
      const finalizar = (): void => {
        dejarDeAvanzar();
        senal.removeEventListener('abort', finalizar);
        if (this.detenerElFundidoEnCurso === finalizar) {
          this.detenerElFundidoEnCurso = undefined;
        }
        terminar();
      };
      this.detenerElFundidoEnCurso = finalizar;

      const dejarDeAvanzar = this.reloj.enCadaCuadro((segundos) => {
        segundosTranscurridos += segundos;
        const avance = Math.min(1, segundosTranscurridos / cambio.duracionEnSegundos);
        this.poner(cambio.desde + (cambio.hasta - cambio.desde) * avance);
        if (avance >= 1) {
          finalizar();
        }
      });
      senal.addEventListener('abort', finalizar, { once: true });
    });
  }

  private detenerElQueEsteEnCurso(): void {
    if (this.detenerElFundidoEnCurso !== undefined) {
      this.detenerElFundidoEnCurso();
    }
  }

  private poner(opacidad: number): void {
    this.opacidad = opacidad;
    this.interfaz.ponerFundido(opacidad);
  }
}

function opacidadFinalDe(sentido: SentidoDeFundido): number {
  if (sentido === 'cerrar') return OPACIDAD_DE_PANTALLA_NEGRA;
  return OPACIDAD_DE_PANTALLA_CLARA;
}
