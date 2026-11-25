// Busca por dónde caminar de un punto a otro rodeando lo que estorba (los obstáculos y los huecos del piso).
//
// Cómo funciona, en tres pasos:
//   1. Desde la celda donde está quien camina se «inunda» la rejilla: primero sus celdas vecinas, luego
//      las vecinas de esas, y así. De cada celda se anota desde cuál se llegó. Como la inundación avanza
//      pareja en todas direcciones, la primera vez que toca una celda lo hace por un camino de los más cortos.
//   2. Desde la celda del destino se regresa, de anotación en anotación, hasta el principio: ese es el camino.
//   3. El camino sale con forma de escalera (de celda en celda), así que se endereza: se quitan los puntos
//      intermedios siempre que se pueda ir en línea recta sin chocar.
//
// Si el destino no se puede alcanzar (está dentro de un obstáculo o en un piso aparte), el camino lleva
// al lugar alcanzable más cercano a él.

import { distanciaEntre } from './geometria.ts';
import type { Punto } from './geometria.ts';
import { celdasVecinas, centroDeCelda, columnaYFilaDe, numeroDeCelda } from './rejilla-de-caminos.ts';
import type { MapaDeCaminos, RejillaDeCaminos } from './rejilla-de-caminos.ts';
import { esCaminable } from './terreno.ts';
import type { Terreno } from './terreno.ts';

export interface Camino {
  /** Los puntos por los que hay que pasar, en orden. No incluye el punto de partida. */
  readonly puntos: readonly Punto[];
  /** `false` = el destino no se puede alcanzar: el camino termina en el lugar alcanzable más cercano a él. */
  readonly llegaAlDestino: boolean;
}

/** Marca de una celda a la que la inundación no llegó. */
const SIN_ALCANZAR = -1;
/** Marca de la celda donde empieza la inundación: no se llegó a ella desde ninguna otra. */
const ES_EL_INICIO = -2;

/** Cada cuánto se revisa el piso al comprobar que un tramo recto está libre. Menos que cualquier obstáculo. */
const PASO_AL_REVISAR_UN_TRAMO_EN_METROS = 0.1;

/** Hasta cuántas celdas de distancia se busca una celda pisable para un punto que cayó en una que no lo es. */
const CELDAS_ALREDEDOR_POR_REVISAR = 2;

/**
 * El camino de `desde` a `hasta`. `undefined` si `desde` no está en un lugar donde se pueda caminar
 * (alguien que entra desde fuera del piso): entonces no hay camino que buscar.
 */
export function buscarCamino(desde: Punto, hasta: Punto, mapa: MapaDeCaminos): Camino | undefined {
  const { rejilla, terreno } = mapa;
  const celdaInicial = celdaPisableJuntoA(desde, mapa);
  if (celdaInicial === undefined) return undefined;

  const deDondeSeLlego = inundarDesde(celdaInicial, rejilla);

  const celdaDelDestino = celdaPisableJuntoA(hasta, mapa);
  const seAlcanzaElDestino = celdaDelDestino !== undefined && deDondeSeLlego[celdaDelDestino] !== SIN_ALCANZAR;
  if (seAlcanzaElDestino) {
    const centros = regresarAlInicio(celdaDelDestino, deDondeSeLlego, rejilla);
    return { puntos: enderezar(desde, [...centros, hasta], terreno), llegaAlDestino: true };
  }

  const celdaMasCercana = celdaAlcanzadaMasCercanaA(hasta, deDondeSeLlego, rejilla);
  const centros = regresarAlInicio(celdaMasCercana, deDondeSeLlego, rejilla);
  return { puntos: enderezar(desde, centros, terreno), llegaAlDestino: false };
}

/** Dice si se puede ir en línea recta de un punto a otro pisando siempre donde se puede caminar. */
export function elTramoEstaLibre(desde: Punto, hasta: Punto, terreno: Terreno): boolean {
  const largo = distanciaEntre(desde, hasta);
  const cantidadDePasos = Math.ceil(largo / PASO_AL_REVISAR_UN_TRAMO_EN_METROS);

  for (let paso = 1; paso <= cantidadDePasos; paso++) {
    const avance = paso / cantidadDePasos;
    const punto = { x: desde.x + (hasta.x - desde.x) * avance, y: desde.y + (hasta.y - desde.y) * avance };
    if (!esCaminable(punto, terreno)) return false;
  }
  return true;
}

/**
 * Paso 1: inunda la rejilla desde una celda. Devuelve, por cada celda, el número de la celda desde la
 * que se llegó a ella (o `SIN_ALCANZAR`).
 */
function inundarDesde(celdaInicial: number, rejilla: RejillaDeCaminos): number[] {
  const deDondeSeLlego: number[] = new Array<number>(rejilla.sePuedePisar.length).fill(SIN_ALCANZAR);
  deDondeSeLlego[celdaInicial] = ES_EL_INICIO;

  // Las celdas alcanzadas cuyas vecinas todavía no se revisan, en el orden en que se alcanzaron.
  const porRevisar: number[] = [celdaInicial];
  for (let posicion = 0; posicion < porRevisar.length; posicion++) {
    const celda = porRevisar[posicion]!; // `posicion` es menor que el largo de la lista
    for (const vecina of celdasVecinas(celda, rejilla)) {
      if (deDondeSeLlego[vecina] !== SIN_ALCANZAR) continue;
      deDondeSeLlego[vecina] = celda;
      porRevisar.push(vecina);
    }
  }
  return deDondeSeLlego;
}

/** Paso 2: los centros de las celdas del camino, del principio al final (sin la celda inicial). */
function regresarAlInicio(celdaFinal: number, deDondeSeLlego: readonly number[], rejilla: RejillaDeCaminos): Punto[] {
  const centros: Punto[] = [];
  let celda = celdaFinal;
  while (deDondeSeLlego[celda] !== ES_EL_INICIO) {
    centros.push(centroDeCelda(celda, rejilla));
    celda = deDondeSeLlego[celda]!; // toda celda alcanzada tiene anotada de dónde se llegó
  }
  return centros.reverse();
}

/**
 * Paso 3: quita los puntos intermedios que no hacen falta. Desde donde se está, se busca el punto
 * más lejano del camino al que se puede ir en línea recta; se va a él y se repite.
 */
function enderezar(desde: Punto, puntos: readonly Punto[], terreno: Terreno): Punto[] {
  const enderezado: Punto[] = [];
  let dondeEstoy = desde;
  let siguiente = 0;

  while (siguiente < puntos.length) {
    let masLejanoAlcanzable = siguiente;
    for (let candidato = puntos.length - 1; candidato > siguiente; candidato--) {
      // `candidato` es menor que el largo de la lista
      if (elTramoEstaLibre(dondeEstoy, puntos[candidato]!, terreno)) {
        masLejanoAlcanzable = candidato;
        break;
      }
    }
    dondeEstoy = puntos[masLejanoAlcanzable]!; // está entre `siguiente` y el final de la lista
    enderezado.push(dondeEstoy);
    siguiente = masLejanoAlcanzable + 1;
  }
  return enderezado;
}

/**
 * La celda pisable que le toca a un punto: la suya o, si su centro no se puede pisar (el punto está
 * pegado a una orilla), la más cercana de alrededor a la que se llega en línea recta.
 */
function celdaPisableJuntoA(punto: Punto, mapa: MapaDeCaminos): number | undefined {
  const { rejilla, terreno } = mapa;
  const { columna, fila } = columnaYFilaDe(punto, rejilla);

  let mejorCelda: number | undefined;
  let menorDistancia = Infinity;
  for (let pasoEnFila = -CELDAS_ALREDEDOR_POR_REVISAR; pasoEnFila <= CELDAS_ALREDEDOR_POR_REVISAR; pasoEnFila++) {
    for (let pasoEnColumna = -CELDAS_ALREDEDOR_POR_REVISAR; pasoEnColumna <= CELDAS_ALREDEDOR_POR_REVISAR; pasoEnColumna++) {
      const celda = numeroDeCelda(columna + pasoEnColumna, fila + pasoEnFila, rejilla);
      if (celda === undefined || rejilla.sePuedePisar[celda] !== true) continue;

      const centro = centroDeCelda(celda, rejilla);
      const distancia = distanciaEntre(punto, centro);
      if (distancia < menorDistancia && elTramoEstaLibre(punto, centro, terreno)) {
        menorDistancia = distancia;
        mejorCelda = celda;
      }
    }
  }
  return mejorCelda;
}

/** De las celdas a las que llegó la inundación, la que tiene el centro más cerca de un punto. */
function celdaAlcanzadaMasCercanaA(punto: Punto, deDondeSeLlego: readonly number[], rejilla: RejillaDeCaminos): number {
  let masCercana = 0;
  let menorDistancia = Infinity;
  for (let celda = 0; celda < deDondeSeLlego.length; celda++) {
    if (deDondeSeLlego[celda] === SIN_ALCANZAR) continue;
    const distancia = distanciaEntre(punto, centroDeCelda(celda, rejilla));
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      masCercana = celda;
    }
  }
  return masCercana;
}
