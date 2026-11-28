// Audio falso para las pruebas: no suena. Anota lo que se le pidió decir, y la prueba decide
// cuándo «termina de hablar» con `terminarDeHablar()`.

import { VOLUMENES_POR_DEFECTO } from '../../dominio/volumenes.ts';
import type { VolumenesDeAudio } from '../../dominio/volumenes.ts';
import type { Audio, FrasePorDecir, OpcionesDeSonido, ResultadoDeDecir } from '../../puertos/audio.ts';

/** Un sonido que se pidió tocar, con las opciones que traía. */
export interface SonidoTocado {
  readonly direccion: string;
  /** `undefined` = se pidió sin opciones. */
  readonly opciones: OpcionesDeSonido | undefined;
}

export class AudioDeMemoria implements Audio {
  /** Todo lo que se ha pedido decir, en orden. */
  readonly frasesDichas: FrasePorDecir[] = [];
  readonly sonidosTocados: string[] = [];
  /** Los mismos sonidos de `sonidosTocados`, con sus opciones. */
  readonly sonidosConOpciones: SonidoTocado[] = [];
  /** Los últimos volúmenes que se ajustaron. */
  volumenes: VolumenesDeAudio = VOLUMENES_POR_DEFECTO;
  /** Las frecuencias de los tonos que se han tocado, en orden. */
  readonly tonosTocados: number[] = [];
  /** La música que está puesta. `undefined` = ninguna. */
  musica: string | undefined;
  /** Lo que `decir` responde. Con `'sin_voz'` responde de inmediato, como un dispositivo sin voz sintetizada. */
  resultadoAlDecir: ResultadoDeDecir = 'dicho';
  estaPausado = false;
  estaDestruido = false;

  /** Termina la frase que se está diciendo. `undefined` = nadie está hablando. */
  private terminarFraseActual: (() => void) | undefined;

  decir(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir> {
    this.frasesDichas.push(frase);
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

  tocar(direccionDelSonido: string, opciones?: OpcionesDeSonido): void {
    this.sonidosTocados.push(direccionDelSonido);
    this.sonidosConOpciones.push({ direccion: direccionDelSonido, opciones });
  }

  ajustarVolumenes(volumenes: VolumenesDeAudio): void {
    this.volumenes = volumenes;
  }

  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void {
    this.tonosTocados.push(frecuenciaEnHertz);
  }

  ponerMusica(direccionDeLaMusica: string | undefined): void {
    this.musica = direccionDeLaMusica;
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
