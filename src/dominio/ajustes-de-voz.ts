// Cómo suena la voz sintetizada de un personaje: más aguda o más grave, más rápida o más lenta.
// Mientras no hay voces grabadas, esto es lo que hace que mamá, el protagonista y su primo no suenen igual.
// Se escribe en `meta.personajes.<id>.voz` del contenido (docs/NIVELES.md §3).

/** Los ajustes de la voz sintetizada de alguien. 1 = como suena el dispositivo. */
export interface AjustesDeVoz {
  /** Qué tan aguda suena: menos de 1 es más grave, más de 1 es más aguda. */
  readonly tono: number;
  /** Qué tan rápido habla: menos de 1 es más despacio, más de 1 es más rápido. */
  readonly velocidad: number;
}

/** La voz tal como la trae el dispositivo. */
export const VOZ_NORMAL: AjustesDeVoz = { tono: 1, velocidad: 1 };

/**
 * Límites del tono. La voz sintetizada acepta de 0 a 2, pero muy grave ya no se entiende:
 * con 0.5 todavía se oyen bien las palabras.
 */
export const TONO_MINIMO = 0.5;
export const TONO_MAXIMO = 2;

/**
 * Límites de la velocidad. Quien escucha está aprendiendo a leer y, a veces, otro idioma:
 * más del doble de rápido ya no se entiende, y menos de la mitad suena como un disco lento.
 */
export const VELOCIDAD_MINIMA = 0.5;
export const VELOCIDAD_MAXIMA = 2;
