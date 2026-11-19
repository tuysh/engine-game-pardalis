// Un encuadre de cámara y cómo se pasa con suavidad de uno a otro.
// Lo usan los pasos `camara` que traen duración: la cámara viaja del encuadre que tenía al nuevo.

import type { AjustesDeCamara } from './contenido.ts';
import type { Punto } from './geometria.ts';

/** A qué punto del piso mira la cámara y desde dónde lo mira. */
export interface Encuadre {
  readonly punto: Punto;
  readonly ajustes: AjustesDeCamara;
}

/**
 * El encuadre que queda en el camino entre dos. `avance` va de 0 (el de salida) a 1 (el de llegada).
 *
 * Limitación conocida: el giro se mezcla en línea recta, así que de 350° a 10° da la vuelta larga.
 * Para girar poco, escribe los dos giros cerca uno del otro (por ejemplo -10 y 10).
 */
export function mezclarEncuadres(salida: Encuadre, llegada: Encuadre, avance: number): Encuadre {
  return {
    punto: {
      x: mezclarNumeros(salida.punto.x, llegada.punto.x, avance),
      y: mezclarNumeros(salida.punto.y, llegada.punto.y, avance),
    },
    ajustes: {
      distanciaEnMetros: mezclarNumeros(salida.ajustes.distanciaEnMetros, llegada.ajustes.distanciaEnMetros, avance),
      alturaEnMetros: mezclarNumeros(salida.ajustes.alturaEnMetros, llegada.ajustes.alturaEnMetros, avance),
      giroEnGrados: mezclarNumeros(salida.ajustes.giroEnGrados, llegada.ajustes.giroEnGrados, avance),
    },
  };
}

/**
 * Convierte un avance parejo (de 0 a 1) en uno que arranca despacio, corre en medio y frena al llegar.
 * Así un movimiento de cámara no empieza ni termina de golpe.
 */
export function suavizarAvance(avance: number): number {
  const avanceLimitado = Math.min(1, Math.max(0, avance));
  // Esta curva vale 0 en 0, vale 1 en 1 y es plana en los dos extremos.
  return avanceLimitado * avanceLimitado * (3 - 2 * avanceLimitado);
}

function mezclarNumeros(salida: number, llegada: number, avance: number): number {
  return salida + (llegada - salida) * avance;
}

/** Qué tan pronto la cámara alcanza a lo que sigue. Más grande = más pegada; más chico = más perezosa. */
const RAPIDEZ_DE_SEGUIMIENTO = 5;

/**
 * El encuadre de una cámara que persigue a otro encuadre: en cada cuadro recorre una parte de lo que le falta,
 * así que alcanza a lo que sigue con suavidad en vez de saltar. `segundos` es el tiempo desde el cuadro anterior.
 */
export function perseguirEncuadre(actual: Encuadre, deseado: Encuadre, segundos: number): Encuadre {
  // Esta fórmula da el mismo movimiento sin importar cuántos cuadros por segundo dibuje el dispositivo.
  const parteDelCaminoQueSeRecorre = 1 - Math.exp(-RAPIDEZ_DE_SEGUIMIENTO * segundos);
  return mezclarEncuadres(actual, deseado, parteDelCaminoQueSeRecorre);
}
