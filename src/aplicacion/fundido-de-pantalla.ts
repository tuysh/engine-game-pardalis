// El fundido a negro de toda la pantalla. Los pasos `fundido` la oscurecen (`cerrar`) o la aclaran (`abrir`).
//
// `abrir` siempre parte de negro: así una cinemática de entrada puede empezar con él aunque la pantalla
// estuviera clara. `cerrar` parte de lo oscura que ya esté la pantalla, para no dar un destello si ya era negra.

import type { Interfaz } from '../puertos/interfaz.ts';
import type { Reloj } from '../puertos/reloj.ts';

const OPACIDAD_DE_PANTALLA_CLARA = 0;
const OPACIDAD_DE_PANTALLA_NEGRA = 1;

/** Hacia dónde va un fundido: `abrir` aclara la pantalla y `cerrar` la oscurece. */
export type SentidoDeFundido = 'abrir' | 'cerrar';

export class FundidoDePantalla {
  private readonly interfaz: Interfaz;
  private readonly reloj: Reloj;
  private opacidad = OPACIDAD_DE_PANTALLA_CLARA;

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

    const opacidadFinal = opacidadFinalDe(sentido);
    let opacidadInicial = this.opacidad;
    if (sentido === 'abrir') {
      opacidadInicial = OPACIDAD_DE_PANTALLA_NEGRA;
    }
    if (opacidadInicial === opacidadFinal) {
      // La pantalla ya está como debe quedar (se pidió cerrar y ya estaba negra): no hay nada que esperar.
      return Promise.resolve();
    }
    this.poner(opacidadInicial);

    return new Promise((terminar) => {
      let segundosTranscurridos = 0;
      const finalizar = (): void => {
        dejarDeAvanzar();
        senal.removeEventListener('abort', finalizar);
        terminar();
      };

      const dejarDeAvanzar = this.reloj.enCadaCuadro((segundos) => {
        segundosTranscurridos += segundos;
        const avance = Math.min(1, segundosTranscurridos / duracionEnSegundos);
        this.poner(opacidadInicial + (opacidadFinal - opacidadInicial) * avance);
        if (avance >= 1) {
          finalizar();
        }
      });
      senal.addEventListener('abort', finalizar, { once: true });
    });
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
