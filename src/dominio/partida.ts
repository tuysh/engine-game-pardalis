// La forma de una partida guardada (docs/DISENO-3.0.md §10).
// Es un objeto plano: el host lo guarda donde quiera con `JSON.stringify`.
//
// Estado: falta el campo `momento` de cada nivel (dónde quedó el jugador); se define en la fase 2.

import type { VariablesDeEstado } from './estado.ts';

/** Versión del formato de partida. Una partida con otra versión se ignora con advertencia. */
export const VERSION_DE_PARTIDA = 1;

/** Lo que se guarda de un nivel ya visitado. */
export interface PartidaDeNivel {
  readonly estado: VariablesDeEstado;
}

/** Una partida completa: el nivel actual y el estado de cada nivel visitado. */
export interface Partida {
  /** Versión del formato. Siempre `VERSION_DE_PARTIDA`. */
  readonly v: typeof VERSION_DE_PARTIDA;
  /** Id del nivel en el que estaba el jugador. */
  readonly nivel: string;
  /** Estado de cada nivel visitado, por id de nivel. */
  readonly niveles: Readonly<Record<string, PartidaDeNivel>>;
}
