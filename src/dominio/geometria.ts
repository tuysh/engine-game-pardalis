// Geometría del plano del lugar: puntos, rectángulos y polígonos vistos desde arriba.
// Las funciones no dependen de la unidad: sirven igual con píxeles del mapa que con metros,
// siempre que todos los valores de una llamada estén en la misma.

/** Un lugar del plano. `x` es izquierda–derecha; `y` es profundidad (más grande = más cerca de la cámara). */
export interface Punto {
  readonly x: number;
  readonly y: number;
}

/** Un rectángulo alineado con los ejes. `x` e `y` son su esquina de menor `x` y menor `y`. */
export interface Rectangulo {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

/** Distancia en línea recta entre dos puntos. */
export function distanciaEntre(desde: Punto, hasta: Punto): number {
  const diferenciaEnX = hasta.x - desde.x;
  const diferenciaEnY = hasta.y - desde.y;
  return Math.hypot(diferenciaEnX, diferenciaEnY);
}

/** Dice si un punto está dentro de un rectángulo. El borde cuenta como dentro. */
export function puntoDentroDeRectangulo(punto: Punto, rectangulo: Rectangulo): boolean {
  const estaEntreLosLados = punto.x >= rectangulo.x && punto.x <= rectangulo.x + rectangulo.ancho;
  const estaEntreElFondoYElFrente = punto.y >= rectangulo.y && punto.y <= rectangulo.y + rectangulo.alto;
  return estaEntreLosLados && estaEntreElFondoYElFrente;
}

/**
 * Dice si un punto está dentro de un polígono, dado por sus vértices en orden (en cualquier sentido).
 *
 * Cómo funciona: se traza una línea imaginaria desde el punto hacia la derecha y se cuenta
 * cuántos bordes del polígono cruza. Si cruza un número impar, el punto está dentro.
 *
 * Limitación conocida: para un punto justo sobre un borde, el resultado puede ser dentro o fuera.
 * Si eso importa, comparar antes la distancia del punto al borde.
 */
export function puntoDentroDePoligono(punto: Punto, vertices: readonly Punto[]): boolean {
  let dentro = false;

  for (let i = 0; i < vertices.length; i++) {
    const posicionDelSiguiente = (i + 1) % vertices.length;
    const inicioDelBorde = vertices[i]!; // `i` siempre es menor que el largo de la lista
    const finDelBorde = vertices[posicionDelSiguiente]!; // el resto de la división también lo es

    const elBordeCruzaLaAlturaDelPunto = inicioDelBorde.y > punto.y !== finDelBorde.y > punto.y;
    if (!elBordeCruzaLaAlturaDelPunto) continue;

    const avanceSobreElBorde = (punto.y - inicioDelBorde.y) / (finDelBorde.y - inicioDelBorde.y);
    const xDelCruce = inicioDelBorde.x + avanceSobreElBorde * (finDelBorde.x - inicioDelBorde.x);
    if (punto.x < xDelCruce) {
      dentro = !dentro;
    }
  }

  return dentro;
}
