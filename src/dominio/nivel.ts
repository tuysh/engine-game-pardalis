// Un nivel ya leído y validado: lo que el motor necesita para jugarlo.
//
// Estado: por ahora lleva la descripción y el contenido. El mundo (lo que sale del mapa de Tiled)
// y el manifiesto de assets se agregan cuando existan sus fases.

import type { Contenido } from './contenido.ts';
import type { DescripcionDeNivel } from './descripcion-de-nivel.ts';

export interface Nivel {
  readonly descripcion: DescripcionDeNivel;
  readonly contenido: Contenido;
}
