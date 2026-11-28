// Dice si un objeto del decorado se ve ahora: los que llevan `visibleCuando` en el mapa solo se ven
// mientras su condición se cumple (un letrero que se quita al comprar, una flecha que aparece al final).

import { cumpleCondicion } from './condicion.ts';
import type { EstadoDeNivel } from './estado.ts';
import type { Decorado } from './mundo.ts';

export function estaVisibleElDecorado(objeto: Decorado, estado: EstadoDeNivel): boolean {
  if (objeto.visibleCuando === undefined) return true;
  return cumpleCondicion(objeto.visibleCuando, estado);
}
