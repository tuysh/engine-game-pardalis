// El puerto del audio: voces y sonidos. Nada del juego requiere leer, así que todo lo que se muestra se dice.

import type { Idioma } from '../dominio/idioma.ts';

/** Cómo terminó de decirse un texto. */
export type ResultadoDeDecir =
  /** Se oyó, con la voz grabada o con la sintetizada (o se canceló a media voz). */
  | 'dicho'
  /** No se pudo decir de ninguna forma: el dispositivo no tiene voz sintetizada. */
  | 'sin_voz';

/** Algo que se va a decir en voz alta. */
export interface FrasePorDecir {
  readonly texto: string;
  /** En qué idioma está el texto: decide el acento de la voz sintetizada. */
  readonly idioma: Idioma;
  /** Dirección completa de la voz grabada. `undefined` = no hay grabación: se usa voz sintetizada. */
  readonly direccionDeLaVoz?: string;
}

export interface Audio {
  /**
   * Dice una frase en voz alta. Usa la voz grabada si la frase trae su dirección; si no la trae, o si
   * no se puede reproducir, usa la voz sintetizada del dispositivo.
   * La promesa termina cuando acaba de hablar, o en cuanto `senal` se dispara (y entonces se calla).
   */
  decir(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir>;

  /** Toca un sonido corto sin esperar a que termine. */
  tocar(direccionDelSonido: string): void;

  /** Toca una nota corta hecha por el dispositivo, sin archivo. La usan los efectos. */
  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void;

  /**
   * Pone la música de fondo, que se repite sin parar. Reemplaza la que hubiera.
   * Con `undefined`, la música se detiene.
   */
  ponerMusica(direccionDeLaMusica: string | undefined): void;

  /** Congela y reanuda todo lo que suena. */
  pausar(): void;
  reanudar(): void;

  /** Calla todo y libera lo que el audio creó. Se puede llamar más de una vez. */
  destruir(): void;
}
