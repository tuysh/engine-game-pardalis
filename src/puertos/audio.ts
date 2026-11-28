// El puerto del audio: voces y sonidos. Nada del juego requiere leer, así que todo lo que se muestra se dice.

import type { AjustesDeVoz } from '../dominio/ajustes-de-voz.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { VolumenesDeAudio } from '../dominio/volumenes.ts';

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
  /** Tono y velocidad de la voz sintetizada, si quien habla tiene los suyos. `undefined` = la voz normal. */
  readonly voz?: AjustesDeVoz;
}

/** Cómo tocar un sonido corto. */
export interface OpcionesDeSonido {
  /** Qué tan fuerte, de 0 a 1, antes de aplicar el volumen de los efectos. `undefined` = 1. */
  readonly volumen?: number;
  /**
   * Qué tan rápido se reproduce, y con eso qué tan agudo suena: 2 suena una octava más agudo y la mitad de largo,
   * 0.5 una octava más grave. `undefined` = 1, como está grabado.
   */
  readonly tono?: number;
}

export interface Audio {
  /**
   * Dice una frase en voz alta. Usa la voz grabada si la frase trae su dirección; si no la trae, o si
   * no se puede reproducir, usa la voz sintetizada del dispositivo.
   * La promesa termina cuando acaba de hablar, o en cuanto `senal` se dispara (y entonces se calla).
   */
  decir(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir>;

  /** Toca un sonido corto sin esperar a que termine. */
  tocar(direccionDelSonido: string, opciones?: OpcionesDeSonido): void;

  /** Toca una nota corta hecha por el dispositivo, sin archivo. La usan los efectos. */
  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void;

  /**
   * Pone la música de fondo, que se repite sin parar. Reemplaza la que hubiera.
   * Con `undefined`, la música se detiene.
   */
  ponerMusica(direccionDeLaMusica: string | undefined): void;

  /**
   * Cambia qué tan fuerte suena cada canal. Se aplica también a lo que ya está sonando, salvo a una frase
   * de voz sintetizada que ya empezó: esa termina como empezó (el navegador no deja cambiarla a media frase).
   */
  ajustarVolumenes(volumenes: VolumenesDeAudio): void;

  /**
   * Congela y reanuda la música y los sonidos. Las voces no: una frase que se está diciendo sigue hasta terminar.
   * Quien necesite callar una frase al pausar la cancela con su señal (ver aplicacion/voz-en-orden.ts).
   */
  pausar(): void;
  reanudar(): void;

  /** Calla todo y libera lo que el audio creó. Se puede llamar más de una vez. */
  destruir(): void;
}
