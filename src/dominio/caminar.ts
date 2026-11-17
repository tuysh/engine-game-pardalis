// Cómo avanza quien camina hacia un destino, un pasito a la vez, respetando el terreno.
//
// Si el camino recto está libre, avanza recto. Si choca con el borde del piso o con un obstáculo,
// intenta deslizarse solo de lado o solo de fondo, para rodear esquinas sin quedarse pegado.
//
// Limitación conocida: no busca caminos. Ante un obstáculo grande que tapa el paso, quien camina
// se atora y se detiene. Si hace falta, usar búsqueda de caminos sobre el piso.

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
  const proporcionDelCamino = Math.min(1, distanciaEnMetros / distanciaAlDestino);
  const pasoRecto = {
    x: posicion.x + (destino.x - posicion.x) * proporcionDelCamino,
    y: posicion.y + (destino.y - posicion.y) * proporcionDelCamino,
  };
  if (esCaminable(pasoRecto, terreno)) {
    return { posicion: pasoRecto, llego: proporcionDelCamino === 1, seAtoro: false };
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
