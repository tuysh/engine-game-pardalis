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

/** El centro de una forma. El de un polígono es el promedio de sus vértices. */
export function centroDeForma(forma: Forma): Punto {
  if (forma.tipo === 'rectangulo') {
    return centroDeRectangulo(forma.rectangulo);
  }

  let sumaDeX = 0;
  let sumaDeY = 0;
  for (const vertice of forma.vertices) {
    sumaDeX += vertice.x;
    sumaDeY += vertice.y;
  }
  // Un polígono leído de un mapa tiene al menos 3 vértices; `Math.max` solo evita dividir entre cero.
  const cantidad = Math.max(1, forma.vertices.length);
  return { x: sumaDeX / cantidad, y: sumaDeY / cantidad };
}

/** El centro de un rectángulo. */
export function centroDeRectangulo(rectangulo: Rectangulo): Punto {
  return { x: rectangulo.x + rectangulo.ancho / 2, y: rectangulo.y + rectangulo.alto / 2 };
}
