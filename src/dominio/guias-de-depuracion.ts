// Las guías del modo depuración (docs/DISENO-3.0.md §9.3): los dibujos que dejan ver lo que normalmente
// no se ve del mapa (el piso, las huellas, las zonas, la salida y los puntos con nombre), cada uno con su etiqueta.
// Sirven a quien arma un nivel para comprobar que el mapa dice lo que quiso decir.

import type { Forma } from './forma.ts';
import type { Punto, Rectangulo } from './geometria.ts';
import type { Mundo } from './mundo.ts';

/** Una guía: el contorno de un área del piso, o la marca de un lugar. */
export type GuiaDeDepuracion =
  | { readonly tipo: 'contorno'; readonly vertices: readonly Punto[]; readonly color: string; readonly etiqueta?: string }
  | { readonly tipo: 'marca'; readonly punto: Punto; readonly color: string; readonly etiqueta: string };

const COLOR_DEL_PISO = '#2e9e4f';
const COLOR_DE_LO_QUE_BLOQUEA = '#d93025';
const COLOR_DE_LO_QUE_NO_BLOQUEA = '#f29900';
const COLOR_DE_LAS_ZONAS = '#1a73e8';
const COLOR_DE_LA_SALIDA = '#b000b5';
const COLOR_DE_LOS_PUNTOS = '#202124';

/** Todas las guías de un mundo: una por cada cosa del mapa que no se ve al jugar. */
export function crearGuiasDelMundo(mundo: Mundo): GuiaDeDepuracion[] {
  const guias: GuiaDeDepuracion[] = [];

  for (const piso of mundo.pisos) {
    guias.push({ tipo: 'contorno', vertices: piso, color: COLOR_DEL_PISO });
  }
  for (const objeto of mundo.decorado) {
    // Solo lo `parado` bloquea el paso: su huella se pinta de otro color que lo pintado en el piso y lo colgado.
    const color = objeto.clase === 'parado' ? COLOR_DE_LO_QUE_BLOQUEA : COLOR_DE_LO_QUE_NO_BLOQUEA;
    guias.push({ tipo: 'contorno', vertices: verticesDeRectangulo(objeto.huella), color, etiqueta: objeto.id });
  }
  for (const nombre of Object.keys(mundo.zonas)) {
    const zona = mundo.zonas[nombre]!; // `nombre` viene de `Object.keys`, así que existe
    guias.push({ tipo: 'contorno', vertices: verticesDeForma(zona.forma), color: COLOR_DE_LAS_ZONAS, etiqueta: nombre });
  }
  if (mundo.salida !== undefined) {
    const vertices = verticesDeForma(mundo.salida.forma);
    guias.push({ tipo: 'contorno', vertices, color: COLOR_DE_LA_SALIDA, etiqueta: 'salida' });
  }

  for (const nombre of Object.keys(mundo.puntos)) {
    const punto = mundo.puntos[nombre]!; // `nombre` viene de `Object.keys`, así que existe
    guias.push({ tipo: 'marca', punto, color: COLOR_DE_LOS_PUNTOS, etiqueta: nombre });
  }
  for (const inicio of mundo.iniciosDelJugador) {
    guias.push({ tipo: 'marca', punto: inicio.posicion, color: COLOR_DE_LOS_PUNTOS, etiqueta: 'inicioJugador' });
  }
  return guias;
}

function verticesDeForma(forma: Forma): readonly Punto[] {
  if (forma.tipo === 'poligono') return forma.vertices;
  return verticesDeRectangulo(forma.rectangulo);
}

/** Las cuatro esquinas de un rectángulo, en orden. */
function verticesDeRectangulo(rectangulo: Rectangulo): Punto[] {
  const izquierda = rectangulo.x;
  const derecha = rectangulo.x + rectangulo.ancho;
  const fondo = rectangulo.y;
  const frente = rectangulo.y + rectangulo.alto;
  return [
    { x: izquierda, y: fondo },
    { x: derecha, y: fondo },
    { x: derecha, y: frente },
    { x: izquierda, y: frente },
  ];
}
