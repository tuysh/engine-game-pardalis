// Cómo avanza quien camina hacia un destino, un pasito a la vez, respetando el terreno.
//
// Si el camino recto está libre, avanza recto. Si choca con el borde del piso o con un obstáculo,
// intenta deslizarse solo de lado o solo de fondo, para rodear esquinas sin quedarse pegado.
//
// Aquí no se buscan caminos: quien quiere rodear un obstáculo grande pide antes el camino
// (buscar-camino.ts) y luego avanza con estas funciones de un punto del camino al siguiente.
// Con el teclado no hay camino que buscar: quien camina se desliza por la orilla de lo que estorba y, si va
// de frente contra algo y le falta poco para librarlo (un arbusto, una maceta), lo rodea por el lado más cercano.

import { distanciaEntre } from './geometria.ts';
import type { Punto } from './geometria.ts';
import { esCaminable } from './terreno.ts';
import type { Terreno } from './terreno.ts';

export interface Avance {
  /** Dónde queda quien camina después de este pasito. */
  readonly posicion: Punto;
  /** `true` si ya está en el destino. */
  readonly llego: boolean;
  /** `true` si no pudo moverse nada: algo le tapa el paso. */
  readonly seAtoro: boolean;
}

/** Distancia a la que se da por alcanzado el destino. */
export const TOLERANCIA_DE_LLEGADA_EN_METROS = 0.01;

/**
 * Avanza hasta `distanciaEnMetros` desde `posicion` hacia `destino`.
 * `distanciaEnMetros` es lo que se camina en un cuadro: velocidad × tiempo del cuadro.
 */
export function avanzarHacia(posicion: Punto, destino: Punto, distanciaEnMetros: number, terreno: Terreno): Avance {
  const distanciaAlDestino = distanciaEntre(posicion, destino);
  if (distanciaAlDestino <= TOLERANCIA_DE_LLEGADA_EN_METROS) {
    return { posicion, llego: true, seAtoro: false };
  }

  // El pasito recto: todo lo que se puede caminar, sin pasarse del destino.
  const pasoRecto = acercarse(posicion, destino, distanciaEnMetros);
  if (esCaminable(pasoRecto, terreno)) {
    const llegoAlDestino = pasoRecto.x === destino.x && pasoRecto.y === destino.y;
    return { posicion: pasoRecto, llego: llegoAlDestino, seAtoro: false };
  }

  // El paso recto choca: se intenta deslizar moviendo una sola coordenada.
  const soloDeLado = { x: pasoRecto.x, y: posicion.y };
  const soloDeFondo = { x: posicion.x, y: pasoRecto.y };
  const seMueveDeLado = soloDeLado.x !== posicion.x && esCaminable(soloDeLado, terreno);
  const seMueveDeFondo = soloDeFondo.y !== posicion.y && esCaminable(soloDeFondo, terreno);

  if (seMueveDeLado) {
    return { posicion: soloDeLado, llego: false, seAtoro: false };
  }
  if (seMueveDeFondo) {
    return { posicion: soloDeFondo, llego: false, seAtoro: false };
  }
  return { posicion, llego: false, seAtoro: true };
}

/**
 * El punto al que se llega caminando `distanciaEnMetros` en una dirección (la del teclado).
 * `direccion` lleva -1, 0 o 1 en cada eje. En diagonal se avanza lo mismo que en línea recta, no más.
 * Sin dirección (los dos ejes en 0), devuelve la misma posición.
 */
export function avanzarEnDireccion(posicion: Punto, direccion: Punto, distanciaEnMetros: number): Punto {
  const largoDeLaDireccion = Math.hypot(direccion.x, direccion.y);
  if (largoDeLaDireccion === 0) return posicion;

  return {
    x: posicion.x + (direccion.x / largoDeLaDireccion) * distanciaEnMetros,
    y: posicion.y + (direccion.y / largoDeLaDireccion) * distanciaEnMetros,
  };
}

/** Hasta qué tan lejos, de lado, se busca por dónde librar lo que estorba al caminar con el teclado. */
export const ALCANCE_PARA_RODEAR_CON_EL_TECLADO_EN_METROS = 0.5;

/** Cada cuánto se revisa el piso al buscar por dónde librar lo que estorba. */
const PASO_AL_BUSCAR_POR_DONDE_RODEAR_EN_METROS = 0.05;

/**
 * Avanza un pasito con el teclado: `direccion` es la que se mantiene oprimida (como en `avanzarEnDireccion`).
 *
 * - Si el paso está libre, avanza.
 * - Si choca pero la dirección tiene una parte libre (en diagonal contra una pared), se desliza por la orilla.
 * - Si va de frente contra algo, busca de lado, hasta `ALCANCE_PARA_RODEAR_CON_EL_TECLADO_EN_METROS`, un lugar
 *   desde donde ya se pueda seguir derecho, y se hace hacia ese lado. Así una niña que mantiene oprimida
 *   la flecha contra un arbusto lo rodea en vez de quedarse pegada.
 * - Si no hay por dónde, se atora.
 */
export function avanzarConElTeclado(
  posicion: Punto,
  direccion: Punto,
  distanciaEnMetros: number,
  terreno: Terreno,
): Avance {
  const destino = avanzarEnDireccion(posicion, direccion, distanciaEnMetros);
  const avance = avanzarHacia(posicion, destino, distanciaEnMetros, terreno);
  if (!avance.seAtoro) return avance;

  const lugarDeLado = buscarPorDondeRodear(posicion, direccion, distanciaEnMetros, terreno);
  if (lugarDeLado === undefined) return avance;
  return { posicion: acercarse(posicion, lugarDeLado, distanciaEnMetros), llego: false, seAtoro: false };
}

/**
 * El lugar de lado más cercano (a izquierda o derecha de la dirección) desde donde ya se puede dar el paso
 * derecho, sin pasar por nada que estorbe para llegar a él. `undefined` si no hay ninguno al alcance.
 */
function buscarPorDondeRodear(
  posicion: Punto,
  direccion: Punto,
  distanciaEnMetros: number,
  terreno: Terreno,
): Punto | undefined {
  const largo = Math.hypot(direccion.x, direccion.y);
  if (largo === 0) return undefined;
  // De lado es la dirección girada un cuarto de vuelta; el otro lado es su contraria.
  const unLado = { x: -direccion.y / largo, y: direccion.x / largo };
  const otroLado = { x: -unLado.x, y: -unLado.y };

  const pasito = { direccion, distanciaEnMetros, terreno };
  const porUnLado = buscarDeUnLado(posicion, unLado, pasito);
  const porElOtroLado = buscarDeUnLado(posicion, otroLado, pasito);
  if (porUnLado === undefined) return porElOtroLado;
  if (porElOtroLado === undefined) return porUnLado;

  const unLadoEstaMasCerca = distanciaEntre(posicion, porUnLado) <= distanciaEntre(posicion, porElOtroLado);
  if (unLadoEstaMasCerca) return porUnLado;
  return porElOtroLado;
}

/** El pasito que se quiere dar con el teclado. */
interface PasitoDelTeclado {
  readonly direccion: Punto;
  readonly distanciaEnMetros: number;
  readonly terreno: Terreno;
}

/**
 * Recorre de lado (`haciaElLado` mide un metro) hasta encontrar desde dónde ya se puede dar el pasito derecho.
 * Se detiene si de ese lado también estorba algo o si se pasa del alcance.
 */
function buscarDeUnLado(posicion: Punto, haciaElLado: Punto, pasito: PasitoDelTeclado): Punto | undefined {
  for (
    let corrimiento = PASO_AL_BUSCAR_POR_DONDE_RODEAR_EN_METROS;
    corrimiento <= ALCANCE_PARA_RODEAR_CON_EL_TECLADO_EN_METROS;
    corrimiento += PASO_AL_BUSCAR_POR_DONDE_RODEAR_EN_METROS
  ) {
    const lugar = { x: posicion.x + haciaElLado.x * corrimiento, y: posicion.y + haciaElLado.y * corrimiento };
    if (!esCaminable(lugar, pasito.terreno)) return undefined;

    const pasoDerecho = avanzarEnDireccion(lugar, pasito.direccion, pasito.distanciaEnMetros);
    if (esCaminable(pasoDerecho, pasito.terreno)) return lugar;
  }
  return undefined;
}

/**
 * El punto que queda al acercarse en línea recta hasta `distanciaEnMetros` hacia el destino, sin pasarse de él.
 * No mira el terreno: lo usan las caminatas de un diálogo, que ya traen su camino resuelto.
 */
export function acercarse(posicion: Punto, destino: Punto, distanciaEnMetros: number): Punto {
  const distanciaAlDestino = distanciaEntre(posicion, destino);
  if (distanciaAlDestino <= distanciaEnMetros) return destino;

  const proporcionDelCamino = distanciaEnMetros / distanciaAlDestino;
  return {
    x: posicion.x + (destino.x - posicion.x) * proporcionDelCamino,
    y: posicion.y + (destino.y - posicion.y) * proporcionDelCamino,
  };
}
