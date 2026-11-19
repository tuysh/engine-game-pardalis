// Cómo cambia un plano de cámara cuando se encuadra a mano con la cámara libre del modo depuración
// (docs/DISENO-3.0.md §9.3): arrastrar gira y sube la cámara, y la rueda la acerca o la aleja.

import type { Plano } from './contenido.ts';

/** Cuánto gira la cámara por cada punto que se arrastra el ratón hacia un lado. */
const GRADOS_POR_PUNTO_ARRASTRADO = 0.3;
/** Cuánto sube la cámara por cada punto que se arrastra el ratón hacia abajo. */
const METROS_POR_PUNTO_ARRASTRADO = 0.02;
/** Por cuánto se multiplica la distancia con cada muesca de la rueda. */
const FACTOR_DE_DISTANCIA_POR_MUESCA = 1.1;

const ALTURA_MINIMA_EN_METROS = 0.2;
const ALTURA_MAXIMA_EN_METROS = 30;
const DISTANCIA_MINIMA_EN_METROS = 1;
const DISTANCIA_MAXIMA_EN_METROS = 60;

const GRADOS_DE_MEDIA_VUELTA = 180;
const GRADOS_DE_UNA_VUELTA = 360;

/** Lo que se arrastró el ratón, en puntos de CSS. Hacia la derecha y hacia abajo son positivos. */
export interface Arrastre {
  readonly haciaLaDerechaEnPuntos: number;
  readonly haciaAbajoEnPuntos: number;
}

/**
 * El plano después de arrastrar: hacia un lado gira la cámara alrededor de lo que mira; hacia abajo, la sube.
 * La cámara no baja del piso, y su giro se queda entre -180 y 180 grados.
 */
export function girarPlano(plano: Plano, arrastre: Arrastre): Plano {
  // Se gira al revés del arrastre, como si la mano empujara el escenario y no la cámara.
  const giro = plano.giroEnGrados - arrastre.haciaLaDerechaEnPuntos * GRADOS_POR_PUNTO_ARRASTRADO;
  const altura = plano.alturaEnMetros + arrastre.haciaAbajoEnPuntos * METROS_POR_PUNTO_ARRASTRADO;
  return {
    ...plano,
    giroEnGrados: dejarEntreMediasVueltas(giro),
    alturaEnMetros: limitar(altura, ALTURA_MINIMA_EN_METROS, ALTURA_MAXIMA_EN_METROS),
  };
}

/** El plano después de girar la rueda. `muescas` positivas alejan la cámara; negativas, la acercan. */
export function alejarPlano(plano: Plano, muescas: number): Plano {
  const distancia = plano.distanciaEnMetros * FACTOR_DE_DISTANCIA_POR_MUESCA ** muescas;
  return {
    ...plano,
    distanciaEnMetros: limitar(distancia, DISTANCIA_MINIMA_EN_METROS, DISTANCIA_MAXIMA_EN_METROS),
  };
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/** Deja un giro entre -180 y 180 grados: después de dar la vuelta completa, vuelve a empezar. */
function dejarEntreMediasVueltas(grados: number): number {
  let resultado = grados % GRADOS_DE_UNA_VUELTA;
  if (resultado > GRADOS_DE_MEDIA_VUELTA) {
    resultado -= GRADOS_DE_UNA_VUELTA;
  }
  if (resultado < -GRADOS_DE_MEDIA_VUELTA) {
    resultado += GRADOS_DE_UNA_VUELTA;
  }
  return resultado;
}
