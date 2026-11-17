// El puerto del audio: voces y sonidos. Nada del juego requiere leer, así que todo lo que se muestra se dice.

import type { Idioma } from '../dominio/idioma.ts';

/** Cómo terminó de decirse un texto. */
export type ResultadoDeDecir =
  /** Se oyó, con la voz grabada o con la sintetizada (o se canceló a media voz). */
  | 'dicho'
  /** No se pudo decir de ninguna forma: el dispositivo no tiene voz sintetizada. */
  | 'sin_voz';

export interface Audio {
  /**
   * Dice un texto en voz alta. Usa la voz grabada si se da su dirección; si no hay, o si no se puede
   * reproducir, usa la voz sintetizada del dispositivo en ese idioma.
   * La promesa termina cuando acaba de hablar, o en cuanto `senal` se dispara (y entonces se calla).
   */
  decir(texto: string, idioma: Idioma, direccionDeLaVoz: string | undefined, senal: AbortSignal): Promise<ResultadoDeDecir>;

  /** Toca un sonido corto sin esperar a que termine. */
  tocar(direccionDelSonido: string): void;

  /** Congela y reanuda todo lo que suena. */
  pausar(): void;
  reanudar(): void;

  /** Calla todo y libera lo que el audio creó. Se puede llamar más de una vez. */
  destruir(): void;
}
