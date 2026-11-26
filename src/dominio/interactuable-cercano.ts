// Busca con qué puede interactuar el jugador desde donde está: el personaje u objeto más cercano
// que le quede a la mano. Sirve para la tecla de hablar y para avisarle que hay algo cerca.
//
// Quien acompaña al jugador camina pegado a él, así que casi siempre está a la mano y suele ser lo más cercano.
// Por eso cede: solo cuenta si no hay nada más a la mano.

import { distanciaEntre } from './geometria.ts';
import type { Punto } from './geometria.ts';

/** Algo del escenario con lo que se puede hablar (un personaje) o que se puede usar (un objeto del decorado). */
export interface Interactuable {
  readonly tipo: 'personaje' | 'decorado';
  readonly id: string;
  /** Dónde está, sobre el plano del lugar. */
  readonly punto: Punto;
}

/** Hasta qué distancia el jugador tiene algo «a la mano». */
export const DISTANCIA_PARA_INTERACTUAR_EN_METROS = 1.8;

/**
 * El interactuable más cercano al jugador entre los que tiene a la mano, o `undefined` si no hay ninguno.
 * `idDelQueCede` es el personaje que solo cuenta si no hay otra cosa a la mano (el acompañante).
 */
export function buscarInteractuableCercano(
  posicionDelJugador: Punto,
  interactuables: readonly Interactuable[],
  idDelQueCede?: string,
): Interactuable | undefined {
  const sinElQueCede = interactuables.filter((interactuable) => !(interactuable.tipo === 'personaje' && interactuable.id === idDelQueCede));
  return buscarElMasCercano(posicionDelJugador, sinElQueCede) ?? buscarElMasCercano(posicionDelJugador, interactuables);
}

function buscarElMasCercano(posicionDelJugador: Punto, interactuables: readonly Interactuable[]): Interactuable | undefined {
  let masCercano: Interactuable | undefined;
  let menorDistancia = DISTANCIA_PARA_INTERACTUAR_EN_METROS;

  for (const interactuable of interactuables) {
    const distancia = distanciaEntre(posicionDelJugador, interactuable.punto);
    if (distancia <= menorDistancia) {
      menorDistancia = distancia;
      masCercano = interactuable;
    }
  }
  return masCercano;
}
