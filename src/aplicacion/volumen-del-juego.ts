// Lleva el volumen que el host pidió (`juego.volumen`, `juego.silenciado`, `juego.ajustarVolumenes()`) y se lo
// pasa al audio. Los valores vienen del host, muchas veces de JavaScript sin tipos: se revisan aquí y un valor
// que no sirve se explica con un `ErrorDeEscenario` que nombra la llamada, sin cambiar nada.

import { describirValor } from '../dominio/describir-valor.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import { esVolumenValido, VOLUMENES_POR_DEFECTO } from '../dominio/volumenes.ts';
import type { CanalDeAudio, VolumenesDeAudio, VolumenesPorCanal } from '../dominio/volumenes.ts';
import type { Audio } from '../puertos/audio.ts';

/** Los canales en el orden en que se nombran en los mensajes. */
const CANALES: readonly CanalDeAudio[] = ['musica', 'voces', 'efectos'];

export class VolumenDelJuego {
  private readonly audio: Pick<Audio, 'ajustarVolumenes'>;
  private volumenes: VolumenesDeAudio = VOLUMENES_POR_DEFECTO;

  constructor(audio: Pick<Audio, 'ajustarVolumenes'>) {
    this.audio = audio;
  }

  /** El volumen general, de 0 a 1. */
  get general(): number {
    return this.volumenes.general;
  }

  get silenciado(): boolean {
    return this.volumenes.silenciado;
  }

  /** El volumen de cada canal, sin contar el general ni el silencio. */
  get porCanal(): VolumenesPorCanal {
    return { musica: this.volumenes.musica, voces: this.volumenes.voces, efectos: this.volumenes.efectos };
  }

  cambiarGeneral(volumen: unknown): void {
    if (!esVolumenValido(volumen)) {
      throw new ErrorDeEscenario([
        `juego.volumen: se esperaba un número de 0 (callado) a 1 (completo); llegó ${describirValor(volumen)}`,
      ]);
    }
    this.aplicar({ ...this.volumenes, general: volumen });
  }

  cambiarSilencio(estaSilenciado: unknown): void {
    if (typeof estaSilenciado !== 'boolean') {
      throw new ErrorDeEscenario([
        `juego.silenciado: se esperaba true (sin sonido) o false (con sonido); llegó ${describirValor(estaSilenciado)}`,
      ]);
    }
    this.aplicar({ ...this.volumenes, silenciado: estaSilenciado });
  }

  /** Cambia los canales que traiga `cambios`; los demás quedan como estaban. Si algo está mal, no cambia nada. */
  cambiarCanales(cambios: unknown): void {
    if (!esObjetoPlano(cambios)) {
      throw new ErrorDeEscenario([
        'juego.ajustarVolumenes: se esperaba un objeto como { musica: 0.3 }, con musica, voces o efectos ' +
          `de 0 a 1; llegó ${describirValor(cambios)}`,
      ]);
    }
    const problemas = revisarCanales(cambios);
    if (problemas.length > 0) {
      throw new ErrorDeEscenario(problemas);
    }

    this.aplicar({
      ...this.volumenes,
      musica: volumenNuevo(cambios, 'musica', this.volumenes.musica),
      voces: volumenNuevo(cambios, 'voces', this.volumenes.voces),
      efectos: volumenNuevo(cambios, 'efectos', this.volumenes.efectos),
    });
  }

  private aplicar(volumenes: VolumenesDeAudio): void {
    this.volumenes = volumenes;
    this.audio.ajustarVolumenes(volumenes);
  }
}

function revisarCanales(cambios: Readonly<Record<string, unknown>>): string[] {
  const problemas: string[] = [];
  for (const nombre of Object.keys(cambios)) {
    const esCanal = CANALES.some((canal) => canal === nombre);
    if (!esCanal) {
      problemas.push(`juego.ajustarVolumenes: no hay un canal "${nombre}"; los canales son musica, voces y efectos`);
      continue;
    }
    const valor = cambios[nombre];
    if (!esVolumenValido(valor)) {
      problemas.push(
        `juego.ajustarVolumenes: ${nombre} debe ser un número de 0 (callado) a 1 (completo); ` +
          `llegó ${describirValor(valor)}`,
      );
    }
  }
  return problemas;
}

/** El volumen que `cambios` trae para `canal`, o `actual` si no trae ese canal. */
function volumenNuevo(cambios: Readonly<Record<string, unknown>>, canal: CanalDeAudio, actual: number): number {
  if (!Object.hasOwn(cambios, canal)) return actual;
  const valor = cambios[canal];
  if (!esVolumenValido(valor)) return actual;
  return valor;
}
