// La rejilla de caminos: el terreno de un nivel cortado en celdas cuadradas, cada una marcada como
// «se puede pisar» o «no». Se calcula una vez, al cargar el nivel, y con ella se buscan caminos
// que rodean los obstáculos (buscar-camino.ts).
//
// Una celda se puede pisar si su centro se puede pisar. Las celdas se numeran de corrido, fila por fila:
// la celda de la columna 2 de la fila 1, en una rejilla de 10 columnas, es la número 12.

import type { Punto } from './geometria.ts';
import { esCaminable } from './terreno.ts';
import type { Terreno } from './terreno.ts';

/**
 * Lado de cada celda. Más chico rodea mejor los rincones pero hace más celdas;
 * un cuarto de metro deja pasar a un personaje por cualquier pasillo que se vea como tal.
 */
export const LADO_DE_CELDA_EN_METROS = 0.25;

export interface RejillaDeCaminos {
  /** La esquina de menor `x` y menor `y` de la rejilla. */
  readonly origen: Punto;
  readonly columnas: number;
  readonly filas: number;
  /** Por cada celda, en su orden de numeración, si se puede pisar. */
  readonly sePuedePisar: readonly boolean[];
}

/** El terreno junto con su rejilla: lo que hace falta para buscar un camino. */
export interface MapaDeCaminos {
  readonly terreno: Terreno;
  readonly rejilla: RejillaDeCaminos;
}

/** Corta en celdas el rectángulo que encierra a todos los pisos del terreno. */
export function crearMapaDeCaminos(terreno: Terreno): MapaDeCaminos {
  let menorX = Infinity;
  let menorY = Infinity;
  let mayorX = -Infinity;
  let mayorY = -Infinity;
  for (const piso of terreno.pisos) {
    for (const vertice of piso) {
      menorX = Math.min(menorX, vertice.x);
      menorY = Math.min(menorY, vertice.y);
      mayorX = Math.max(mayorX, vertice.x);
      mayorY = Math.max(mayorY, vertice.y);
    }
  }
  // Un terreno sin pisos no tiene dónde caminar: su rejilla no tiene celdas.
  if (menorX === Infinity) {
    return { terreno, rejilla: { origen: { x: 0, y: 0 }, columnas: 0, filas: 0, sePuedePisar: [] } };
  }

  const origen = { x: menorX, y: menorY };
  const columnas = Math.ceil((mayorX - menorX) / LADO_DE_CELDA_EN_METROS);
  const filas = Math.ceil((mayorY - menorY) / LADO_DE_CELDA_EN_METROS);

  const sePuedePisar: boolean[] = [];
  for (let fila = 0; fila < filas; fila++) {
    for (let columna = 0; columna < columnas; columna++) {
      const centro = {
        x: origen.x + (columna + 0.5) * LADO_DE_CELDA_EN_METROS,
        y: origen.y + (fila + 0.5) * LADO_DE_CELDA_EN_METROS,
      };
      sePuedePisar.push(esCaminable(centro, terreno));
    }
  }
  return { terreno, rejilla: { origen, columnas, filas, sePuedePisar } };
}

/** El centro de una celda, por su número. */
export function centroDeCelda(celda: number, rejilla: RejillaDeCaminos): Punto {
  const columna = celda % rejilla.columnas;
  const fila = Math.floor(celda / rejilla.columnas);
  return {
    x: rejilla.origen.x + (columna + 0.5) * LADO_DE_CELDA_EN_METROS,
    y: rejilla.origen.y + (fila + 0.5) * LADO_DE_CELDA_EN_METROS,
  };
}

/** El número de la celda de esa columna y esa fila, o `undefined` si queda fuera de la rejilla. */
export function numeroDeCelda(columna: number, fila: number, rejilla: RejillaDeCaminos): number | undefined {
  const estaDentro = columna >= 0 && columna < rejilla.columnas && fila >= 0 && fila < rejilla.filas;
  if (!estaDentro) return undefined;
  return fila * rejilla.columnas + columna;
}

/** La columna y la fila de la celda donde cae un punto. Pueden quedar fuera de la rejilla. */
export function columnaYFilaDe(punto: Punto, rejilla: RejillaDeCaminos): { columna: number; fila: number } {
  return {
    columna: Math.floor((punto.x - rejilla.origen.x) / LADO_DE_CELDA_EN_METROS),
    fila: Math.floor((punto.y - rejilla.origen.y) / LADO_DE_CELDA_EN_METROS),
  };
}

/** Las celdas que se pueden pisar junto a una celda: las cuatro de los lados y las cuatro de las esquinas. */
export function celdasVecinas(celda: number, rejilla: RejillaDeCaminos): number[] {
  const columna = celda % rejilla.columnas;
  const fila = Math.floor(celda / rejilla.columnas);
  const vecinas: number[] = [];

  for (let pasoEnFila = -1; pasoEnFila <= 1; pasoEnFila++) {
    for (let pasoEnColumna = -1; pasoEnColumna <= 1; pasoEnColumna++) {
      if (pasoEnFila === 0 && pasoEnColumna === 0) continue;

      const vecina = numeroDeCelda(columna + pasoEnColumna, fila + pasoEnFila, rejilla);
      if (vecina === undefined || rejilla.sePuedePisar[vecina] !== true) continue;

      // En diagonal solo se pasa si las dos celdas de los lados están libres: así no se corta
      // la esquina de un obstáculo.
      const esDiagonal = pasoEnFila !== 0 && pasoEnColumna !== 0;
      if (esDiagonal) {
        const deLado = numeroDeCelda(columna + pasoEnColumna, fila, rejilla);
        const deFondo = numeroDeCelda(columna, fila + pasoEnFila, rejilla);
        const lasDosEstanLibres =
          deLado !== undefined &&
          deFondo !== undefined &&
          rejilla.sePuedePisar[deLado] === true &&
          rejilla.sePuedePisar[deFondo] === true;
        if (!lasDosEstanLibres) continue;
      }
      vecinas.push(vecina);
    }
  }
  return vecinas;
}
