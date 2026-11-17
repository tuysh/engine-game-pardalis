// Audio falso para las pruebas: no suena. Anota lo que se le pidió decir, y la prueba decide
// cuándo «termina de hablar» con `terminarDeHablar()`.

import type { Idioma } from '../../dominio/idioma.ts';
import type { Audio, ResultadoDeDecir } from '../../puertos/audio.ts';

/** Algo que se pidió decir. */
export interface FraseDicha {
  readonly texto: string;
  readonly idioma: Idioma;
  readonly direccionDeLaVoz: string | undefined;
}

export class AudioDeMemoria implements Audio {
  /** Todo lo que se ha pedido decir, en orden. */
  readonly frasesDichas: FraseDicha[] = [];
  readonly sonidosTocados: string[] = [];
  /** Lo que `decir` responde. Con `'sin_voz'` responde de inmediato, como un dispositivo sin voz sintetizada. */
  resultadoAlDecir: ResultadoDeDecir = 'dicho';
  estaPausado = false;
  estaDestruido = false;

  /** Termina la frase que se está diciendo. `undefined` = nadie está hablando. */
  private terminarFraseActual: (() => void) | undefined;

  decir(
    texto: string,
    idioma: Idioma,
    direccionDeLaVoz: string | undefined,
    senal: AbortSignal,
  ): Promise<ResultadoDeDecir> {
    this.frasesDichas.push({ texto, idioma, direccionDeLaVoz });
    if (this.resultadoAlDecir === 'sin_voz') {
      return Promise.resolve('sin_voz');
    }
    if (senal.aborted) {
      return Promise.resolve('dicho');
    }

    return new Promise((terminar) => {
      const alCancelar = (): void => {
        this.terminarFraseActual = undefined;
        terminar('dicho');
      };
      this.terminarFraseActual = () => {
        senal.removeEventListener('abort', alCancelar);
        this.terminarFraseActual = undefined;
        terminar('dicho');
      };
      senal.addEventListener('abort', alCancelar, { once: true });
    });
  }

  tocar(direccionDelSonido: string): void {
    this.sonidosTocados.push(direccionDelSonido);
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

  get hayAlguienHablando(): boolean {
    return this.terminarFraseActual !== undefined;
  }

  /** Para las pruebas: hace como si la voz hubiera terminado de decir la frase actual. */
  terminarDeHablar(): void {
    if (this.terminarFraseActual !== undefined) {
      this.terminarFraseActual();
    }
  }
}
