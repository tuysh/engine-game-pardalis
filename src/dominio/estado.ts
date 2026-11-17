// Los tipos del estado de un nivel: las variables que cambian mientras se juega
// (qué objetos tiene el jugador, qué cinemáticas ya vio, qué objetivos cumplió).

/** Lo que puede guardar una variable del estado. */
export type ValorDeEstado = boolean | number | string;

/** Las variables de un nivel, por nombre. Ejemplo: `{ tortillas: true, 'vista.intro': true }`. */
export type VariablesDeEstado = Readonly<Record<string, ValorDeEstado>>;

/** Vista de solo lectura del estado. Es lo que reciben los minijuegos. */
export interface LectorDeEstado {
  /** Valor de una variable, o `undefined` si nunca se le dio valor. */
  obtener(nombre: string): ValorDeEstado | undefined;
  /** Dice si se cumple una condición escrita como en los niveles. Ejemplo: `'no vista.intro'`. */
  cumple(condicion: string): boolean;
}
