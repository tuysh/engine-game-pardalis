// El avance de la carga de un nivel, para que el host dibuje su propia barra (docs/DISENO-3.0.md §4).

/** Cuántos archivos de imagen del nivel ya cargaron, de cuántos en total. */
export interface ProgresoDeCarga {
  readonly cargados: number;
  readonly total: number;
}
