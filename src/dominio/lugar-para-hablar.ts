// Dónde se para el jugador para hablar con alguien o para usar un objeto del decorado.

import type { Punto, Rectangulo } from './geometria.ts';

/** Separación de lado entre el jugador y el personaje con quien habla. */
const DISTANCIA_PARA_HABLAR_EN_METROS = 0.9;

/** Cuánto más cerca de la cámara queda el jugador, para que se dibuje delante y no encimado. */
const PASO_AL_FRENTE_EN_METROS = 0.1;

/** Separación entre el jugador y el borde del frente de un objeto del decorado. */
const DISTANCIA_AL_OBJETO_EN_METROS = 0.3;

/**
 * Junto al personaje, del lado en que ya está el jugador (para no rodearlo) y un pasito al frente.
 * El resultado puede caer fuera del piso; quien manda a caminar lo ajusta a la orilla más cercana.
 */
export function lugarParaHablarCon(posicionDelPersonaje: Punto, posicionDelJugador: Punto): Punto {
  const elJugadorEstaALaIzquierda = posicionDelJugador.x < posicionDelPersonaje.x;
  let x = posicionDelPersonaje.x + DISTANCIA_PARA_HABLAR_EN_METROS;
  if (elJugadorEstaALaIzquierda) {
    x = posicionDelPersonaje.x - DISTANCIA_PARA_HABLAR_EN_METROS;
  }
  return { x, y: posicionDelPersonaje.y + PASO_AL_FRENTE_EN_METROS };
}

/** Frente a la huella del objeto, del lado de la cámara y centrado. */
export function lugarParaUsar(huellaDelObjeto: Rectangulo): Punto {
  return {
    x: huellaDelObjeto.x + huellaDelObjeto.ancho / 2,
    y: huellaDelObjeto.y + huellaDelObjeto.alto + DISTANCIA_AL_OBJETO_EN_METROS,
  };
}
