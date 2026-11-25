// Cuándo camina y cuándo se queda quieto quien sigue a otro (el acompañante del jugador).
//
// Quien sigue no copia cada pasito: espera a que el otro se aleje un poco y entonces camina hasta
// quedar cerca. Las dos distancias son distintas a propósito: si fueran la misma, con cada pasito del
// jugador el acompañante daría otro, y se vería nervioso.

import { distanciaEntre } from './geometria.ts';
import type { Punto } from './geometria.ts';

/** Con el otro más lejos que esto, quien sigue empieza a caminar. */
export const DISTANCIA_PARA_EMPEZAR_A_SEGUIR_EN_METROS = 1.5;

/** Al quedar a esta distancia, quien sigue se detiene: cerca, pero sin encimarse. */
export const DISTANCIA_AL_DETENERSE_EN_METROS = 0.9;

/**
 * Dice si quien sigue debe caminar en este cuadro.
 * `yaVeniaCaminando` es si en el cuadro anterior ya caminaba hacia el otro.
 */
export function debeCaminarParaSeguir(posicion: Punto, posicionDelOtro: Punto, yaVeniaCaminando: boolean): boolean {
  const distancia = distanciaEntre(posicion, posicionDelOtro);
  if (yaVeniaCaminando) {
    return distancia > DISTANCIA_AL_DETENERSE_EN_METROS;
  }
  return distancia > DISTANCIA_PARA_EMPEZAR_A_SEGUIR_EN_METROS;
}
