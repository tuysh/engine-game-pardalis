// La forma de un área del mapa (una zona, la salida): un rectángulo o un polígono, vistos desde arriba.

import { puntoDentroDePoligono, puntoDentroDeRectangulo } from './geometria.ts';
import type { Punto, Rectangulo } from './geometria.ts';

export type Forma =
  | { readonly tipo: 'rectangulo'; readonly rectangulo: Rectangulo }
  | { readonly tipo: 'poligono'; readonly vertices: readonly Punto[] };

export function puntoDentroDeForma(punto: Punto, forma: Forma): boolean {
  switch (forma.tipo) {
    case 'rectangulo':
      return puntoDentroDeRectangulo(punto, forma.rectangulo);
    case 'poligono':
      return puntoDentroDePoligono(punto, forma.vertices);
  }
}

/** El centro de un rectángulo. */
export function centroDeRectangulo(rectangulo: Rectangulo): Punto {
  return { x: rectangulo.x + rectangulo.ancho / 2, y: rectangulo.y + rectangulo.alto / 2 };
}
