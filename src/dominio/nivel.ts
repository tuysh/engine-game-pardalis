// Un nivel ya leído y validado: lo que el motor necesita para jugarlo.
//
// Estado: falta el mundo (lo que sale del mapa de Tiled); se agrega con su fase.

import type { AssetsDeNivel } from './assets-de-nivel.ts';
import type { Contenido } from './contenido.ts';
import type { DescripcionDeNivel } from './descripcion-de-nivel.ts';

export interface Nivel {
  readonly descripcion: DescripcionDeNivel;
  readonly contenido: Contenido;
  /** Las imágenes, sonidos y videos que el nivel puede usar, por clave. */
  readonly assets: AssetsDeNivel;
}
