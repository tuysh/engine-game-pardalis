// Cuándo camina quien sigue a otro (el acompañante del jugador) y en qué lugar se queda.
//
// Quien sigue no copia cada pasito: espera a que el otro se aleje un poco y entonces camina hasta su lugar.
// Las dos distancias son distintas a propósito: si fueran la misma, con cada pasito del jugador el acompañante
// daría otro, y se vería nervioso.
//
// Su lugar está a un lado del otro y **un poco atrás** (más lejos de la cámara, con `y` menor). Así, al caminar
// de lado, no queda delante del jugador tapándolo: el dibujo de quien sigue queda detrás del suyo.

import { distanciaEntre } from './geometria.ts';
import type { Punto } from './geometria.ts';
import { esCaminable } from './terreno.ts';
import type { Terreno } from './terreno.ts';

/** A qué distancia del otro se queda quien sigue, si el nivel no dice otra (`jugador.distanciaDelAcompanante`). */
export const DISTANCIA_DEL_ACOMPANANTE_POR_DEFECTO_EN_METROS = 0.9;

/**
 * Cuánto más que su distancia debe alejarse el otro para que quien sigue empiece a caminar.
 * Con la distancia por defecto, empieza a caminar cuando el otro está a más de metro y medio.
 */
export const MARGEN_PARA_EMPEZAR_A_SEGUIR_EN_METROS = 0.6;

/**
 * Qué tan atrás del otro se para quien sigue: el ángulo entre «justo a su lado» y su lugar.
 * 0 = a la misma altura; 90 = justo detrás, tapado por completo.
 */
const ANGULO_HACIA_ATRAS_EN_GRADOS = 35;

/**
 * Si quien sigue está delante del otro (más cerca de la cámara) y a menos de esto de lado,
 * su dibujo tapa al otro: aunque esté cerca, se mueve a su lugar.
 */
const SEPARACION_DE_LADO_QUE_TAPA_EN_METROS = 0.6;

const GRADOS_POR_MEDIA_VUELTA = 180;

/** De qué lado del otro va quien sigue: -1 = a su izquierda (`x` menor), 1 = a su derecha. */
export type Lado = -1 | 1;

/** Cómo sigue quien sigue. */
export interface ManeraDeSeguir {
  /** A qué distancia del otro se queda, en metros. */
  readonly distanciaEnMetros: number;
  /** De qué lado del otro va. */
  readonly lado: Lado;
}

/**
 * Dice si quien sigue, que está quieto, debe empezar a caminar: porque el otro se alejó
 * o porque quedó delante de él tapándolo.
 */
export function debeEmpezarASeguir(posicion: Punto, posicionDelOtro: Punto, distanciaEnMetros: number): boolean {
  const distancia = distanciaEntre(posicion, posicionDelOtro);
  if (distancia > distanciaEnMetros + MARGEN_PARA_EMPEZAR_A_SEGUIR_EN_METROS) return true;
  return tapaAlOtro(posicion, posicionDelOtro);
}

/** `true` si quien sigue está delante del otro, tan pegado de lado que su dibujo lo tapa. */
export function tapaAlOtro(posicion: Punto, posicionDelOtro: Punto): boolean {
  const estaMasCercaDeLaCamara = posicion.y > posicionDelOtro.y;
  const separacionDeLado = Math.abs(posicion.x - posicionDelOtro.x);
  return estaMasCercaDeLaCamara && separacionDeLado < SEPARACION_DE_LADO_QUE_TAPA_EN_METROS;
}

/**
 * El lugar donde se queda quien sigue: a su distancia del otro, de su lado y un poco atrás.
 * Si ahí no se puede pisar (una pared, un puesto), prueba atrás del otro lado, luego a la misma altura
 * de cada lado y, si nada sirve, el punto a su distancia en línea recta desde donde viene `posicion`.
 */
export function lugarParaSeguir(
  posicion: Punto,
  posicionDelOtro: Punto,
  manera: ManeraDeSeguir,
  terreno: Terreno,
): Punto {
  const { distanciaEnMetros, lado } = manera;
  const angulo = (ANGULO_HACIA_ATRAS_EN_GRADOS * Math.PI) / GRADOS_POR_MEDIA_VUELTA;
  const deLado = Math.cos(angulo) * distanciaEnMetros;
  const haciaAtras = Math.sin(angulo) * distanciaEnMetros;

  const candidatos: Punto[] = [
    { x: posicionDelOtro.x + lado * deLado, y: posicionDelOtro.y - haciaAtras },
    { x: posicionDelOtro.x - lado * deLado, y: posicionDelOtro.y - haciaAtras },
    { x: posicionDelOtro.x + lado * distanciaEnMetros, y: posicionDelOtro.y },
    { x: posicionDelOtro.x - lado * distanciaEnMetros, y: posicionDelOtro.y },
  ];
  for (const candidato of candidatos) {
    if (esCaminable(candidato, terreno)) return candidato;
  }
  return puntoADistanciaDesde(posicionDelOtro, posicion, distanciaEnMetros);
}

/** El punto que queda a `distanciaEnMetros` de `centro`, en la línea que va hacia `haciaDonde`. */
function puntoADistanciaDesde(centro: Punto, haciaDonde: Punto, distanciaEnMetros: number): Punto {
  const distancia = distanciaEntre(centro, haciaDonde);
  if (distancia <= distanciaEnMetros) return haciaDonde;
  const proporcion = distanciaEnMetros / distancia;
  return {
    x: centro.x + (haciaDonde.x - centro.x) * proporcion,
    y: centro.y + (haciaDonde.y - centro.y) * proporcion,
  };
}
