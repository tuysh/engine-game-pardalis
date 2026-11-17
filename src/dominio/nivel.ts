// Un nivel ya leído y validado: lo que el motor necesita para jugarlo.
//
import type { AssetsDeNivel } from './assets-de-nivel.ts';
import type { Contenido } from './contenido.ts';
import type { DescripcionDeNivel } from './descripcion-de-nivel.ts';
import type { Mundo } from './mundo.ts';

export interface Nivel {
  readonly descripcion: DescripcionDeNivel;
  readonly contenido: Contenido;
  /** El DÓNDE: lo que sale del mapa. */
  readonly mundo: Mundo;
  /** Las imágenes, sonidos y videos que el nivel puede usar, por clave. */
  readonly assets: AssetsDeNivel;
}
