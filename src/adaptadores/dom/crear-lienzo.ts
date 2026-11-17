// Crea un lienzo (`<canvas>`) suelto, que no está en la página. Sirve para dibujar una imagen
// y luego usarla como textura.

export function crearLienzo(anchoEnPixeles: number, altoEnPixeles: number): HTMLCanvasElement {
  const lienzo = document.createElement('canvas');
  lienzo.width = anchoEnPixeles;
  lienzo.height = altoEnPixeles;
  return lienzo;
}

/** Cuántos píxeles reales tiene la pantalla por cada punto de CSS: 1 en pantallas comunes, 2 o más en las finas. */
export function leerDensidadDePantalla(): number {
  return window.devicePixelRatio;
}
