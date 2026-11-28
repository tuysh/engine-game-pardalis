// Pone en fila todo lo que se dice en voz alta: las líneas del juego, las opciones, los minijuegos y lo que
// pide el host con `juego.decir()`. Envuelve al puerto `Audio` y se usa en su lugar.
//
// Por qué hace falta: el dispositivo tiene una sola voz sintetizada. Si dos frases se piden a la vez, se
// enciman o, peor, callar una calla las dos. Aquí se dice una frase a la vez, en el orden en que se pidieron.
//
// Reglas:
// - Una frase espera a que termine la que se está diciendo. Si su señal se dispara mientras espera,
//   sale de la fila y su promesa termina en ese momento.
// - Con el juego en pausa, las frases del juego esperan; las del host no, porque el host suele pausar
//   el juego justo para mostrar algo suyo (un cuaderno, una pantalla final) y decirlo.
// - Si se pausa mientras el juego dice una frase, esa frase se corta y, al reanudar, se dice otra vez
//   desde el principio. Así queda libre la voz para el host, y la niña o el niño oye la frase completa.
//   La promesa de esa frase sigue esperando hasta que se haya dicho completa.
// - El tope de tiempo de la voz sintetizada (decir-sin-esperar-de-mas.ts) se pone aquí y empieza a contar
//   cuando a la frase le toca hablar, no cuando pidió su turno: así esperar detrás de una frase larga no le
//   gasta el tiempo a la que sigue, que si no se callaría antes de terminar.
// - Lo demás (sonidos, música, volumen) pasa directo al audio.

import type { VolumenesDeAudio } from '../dominio/volumenes.ts';
import type { Audio, FrasePorDecir, OpcionesDeSonido, ResultadoDeDecir } from '../puertos/audio.ts';
import type { Reloj } from '../puertos/reloj.ts';
import { decirSinEsperarDeMas } from './decir-sin-esperar-de-mas.ts';

/** Quién pidió una frase: decide si puede decirse con el juego en pausa. */
type OrigenDeLaFrase = 'juego' | 'host';

/** Una frase que espera su turno o que se está diciendo. */
interface PedidoDeVoz {
  readonly origen: OrigenDeLaFrase;
  /** Le avisa a la frase que ya es su turno. */
  empezar: () => void;
  /** Corta la frase que se está diciendo porque el juego se pausó. `undefined` = no se está diciendo. */
  cortarPorPausa: (() => void) | undefined;
  seCortoPorPausa: boolean;
}

export class VozEnOrden implements Audio {
  private readonly audio: Audio;
  /** El reloj del juego: mide el tope de tiempo de cada frase sintetizada. */
  private readonly reloj: Reloj;
  /** Las frases que esperan su turno, en orden. */
  private readonly enEspera: PedidoDeVoz[] = [];
  /** La frase que se está diciendo. `undefined` = la voz está libre. */
  private enCurso: PedidoDeVoz | undefined;
  private estaPausado = false;
  /** Se dispara al destruir: termina las frases que esperaban. */
  private readonly destruccion = new AbortController();

  constructor(audio: Audio, reloj: Reloj) {
    this.audio = audio;
    this.reloj = reloj;
  }

  /** Dice una frase del juego. Con el juego en pausa, espera a que se reanude. */
  decir(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir> {
    return this.decirEnSuTurno(frase, senal, 'juego');
  }

  /** Dice una frase que pidió el host. Se dice aunque el juego esté en pausa. */
  decirDelHost(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir> {
    return this.decirEnSuTurno(frase, senal, 'host');
  }

  tocar(direccionDelSonido: string, opciones?: OpcionesDeSonido): void {
    this.audio.tocar(direccionDelSonido, opciones);
  }

  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void {
    this.audio.tocarTono(frecuenciaEnHertz, duracionEnSegundos);
  }

  ponerMusica(direccionDeLaMusica: string | undefined): void {
    this.audio.ponerMusica(direccionDeLaMusica);
  }

  ajustarVolumenes(volumenes: VolumenesDeAudio): void {
    this.audio.ajustarVolumenes(volumenes);
  }

  pausar(): void {
    this.estaPausado = true;
    this.audio.pausar();
    const enCurso = this.enCurso;
    if (enCurso === undefined || enCurso.origen !== 'juego' || enCurso.cortarPorPausa === undefined) return;
    enCurso.seCortoPorPausa = true;
    enCurso.cortarPorPausa();
  }

  reanudar(): void {
    this.estaPausado = false;
    this.audio.reanudar();
    this.darElTurno();
  }

  destruir(): void {
    this.destruccion.abort();
    this.enEspera.length = 0;
    this.audio.destruir();
  }

  private async decirEnSuTurno(
    frase: FrasePorDecir,
    senal: AbortSignal,
    origen: OrigenDeLaFrase,
  ): Promise<ResultadoDeDecir> {
    const pedido: PedidoDeVoz = { origen, empezar: () => {}, cortarPorPausa: undefined, seCortoPorPausa: false };
    let vuelveAlFrente = false;
    // Una frase cortada por una pausa da otra vuelta: espera su turno otra vez y se dice desde el principio.
    while (true) {
      const esSuTurno = await this.esperarTurno(pedido, senal, { alFrente: vuelveAlFrente });
      if (!esSuTurno) return 'dicho';
      const resultado = await this.decirAhora(pedido, frase, senal);
      if (!pedido.seCortoPorPausa) return resultado;
      pedido.seCortoPorPausa = false;
      vuelveAlFrente = true;
    }
  }

  /** Dice la frase que ya tiene el turno y, al terminar, le pasa el turno a la siguiente. */
  private async decirAhora(pedido: PedidoDeVoz, frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir> {
    // `corte` se dispara con lo primero que pase: la señal de quien la pidió, una pausa o la destrucción.
    const corte = new AbortController();
    const cortar = (): void => {
      corte.abort();
    };
    senal.addEventListener('abort', cortar, { once: true });
    this.destruccion.signal.addEventListener('abort', cortar, { once: true });
    pedido.cortarPorPausa = cortar;
    // La señal pudo dispararse entre que le tocó el turno y este momento.
    if (senal.aborted || this.destruccion.signal.aborted) {
      corte.abort();
    }
    // También pudieron pausar el juego en ese instante (por ejemplo, `reanudar()` y `pausar()` seguidos):
    // entonces la frase del juego no empieza y vuelve a la fila, como si la pausa la hubiera cortado.
    if (this.estaPausado && pedido.origen === 'juego') {
      pedido.seCortoPorPausa = true;
      corte.abort();
    }
    try {
      return await decirSinEsperarDeMas(frase, corte.signal, { audio: this.audio, reloj: this.reloj });
    } finally {
      senal.removeEventListener('abort', cortar);
      this.destruccion.signal.removeEventListener('abort', cortar);
      pedido.cortarPorPausa = undefined;
      this.enCurso = undefined;
      this.darElTurno();
    }
  }

  /**
   * Espera a que le toque a `pedido`. Termina con `true` cuando ya es su turno (y entonces `pedido` queda en curso),
   * o con `false` si su señal se disparó o el audio se destruyó antes.
   */
  private esperarTurno(pedido: PedidoDeVoz, senal: AbortSignal, colocacion: { alFrente: boolean }): Promise<boolean> {
    if (senal.aborted || this.destruccion.signal.aborted) return Promise.resolve(false);

    return new Promise((terminar) => {
      const salirDeLaFila = (): void => {
        const posicion = this.enEspera.indexOf(pedido);
        if (posicion >= 0) {
          this.enEspera.splice(posicion, 1);
        }
        senal.removeEventListener('abort', salirDeLaFila);
        this.destruccion.signal.removeEventListener('abort', salirDeLaFila);
        terminar(false);
      };
      pedido.empezar = () => {
        senal.removeEventListener('abort', salirDeLaFila);
        this.destruccion.signal.removeEventListener('abort', salirDeLaFila);
        terminar(true);
      };
      senal.addEventListener('abort', salirDeLaFila, { once: true });
      this.destruccion.signal.addEventListener('abort', salirDeLaFila, { once: true });

      if (colocacion.alFrente) {
        this.enEspera.unshift(pedido);
      } else {
        this.enEspera.push(pedido);
      }
      this.darElTurno();
    });
  }

  /** Si la voz está libre, se la da a la primera frase de la fila que pueda decirse ahora. */
  private darElTurno(): void {
    if (this.enCurso !== undefined) return;
    for (let posicion = 0; posicion < this.enEspera.length; posicion++) {
      const pedido = this.enEspera[posicion]!; // la posición está dentro de la fila
      const puedeDecirseAhora = !this.estaPausado || pedido.origen === 'host';
      if (!puedeDecirseAhora) continue;
      this.enEspera.splice(posicion, 1);
      this.enCurso = pedido;
      pedido.empezar();
      return;
    }
  }
}
