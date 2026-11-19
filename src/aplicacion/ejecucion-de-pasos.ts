// Lo que acompaña a una ejecución de pasos de principio a fin, y a qué ritmo va.
//
// Una ejecución va a uno de tres ritmos:
//   - normal: cada paso dura lo que dura;
//   - rápido: la escena se saltó (solo pasa en las cinemáticas, docs/DISENO-3.0.md §7.5). El paso en curso
//     se corta y cada paso que falta se resuelve al instante dejando su resultado final: los personajes
//     en su destino y el estado cambiado; las líneas, los sonidos y los videos se omiten;
//   - terminada: la escena se interrumpió. No se ejecuta ningún paso más.

import type { AlVolver, Contenido } from '../dominio/contenido.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

export interface EjecucionDePasos {
  readonly contenido: Contenido;
  readonly estado: EstadoEnJuego;
  readonly acciones: AccionesDePaso;
  /**
   * Al dispararse, corta el paso que esté en curso. Lo que pasa después depende de `seEstaSaltando`:
   * si dice que sí, la ejecución sigue en modo rápido; si no, la ejecución termina.
   */
  readonly senal: AbortSignal;
  /**
   * Solo lo dan las cinemáticas: dice si `senal` se disparó porque el jugador saltó la escena.
   * `undefined` = la escena no se puede saltar (un diálogo): al dispararse `senal`, termina.
   */
  readonly seEstaSaltando?: () => boolean;
  /** Qué hacer al volver de un minijuego. `undefined` = nada: se sigue con el paso siguiente. */
  readonly alVolver?: AlVolver;
}

/** `true` si la escena se saltó: los pasos que faltan se resuelven al instante. */
export function estaEnModoRapido(ejecucion: EjecucionDePasos): boolean {
  return ejecucion.seEstaSaltando !== undefined && ejecucion.seEstaSaltando();
}

/** `true` si la escena se interrumpió: ya no debe ejecutarse ningún paso. */
export function yaTermino(ejecucion: EjecucionDePasos): boolean {
  return ejecucion.senal.aborted && !estaEnModoRapido(ejecucion);
}
