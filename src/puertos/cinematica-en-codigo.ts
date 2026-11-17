// El contrato de una cinemática escrita en código (docs/DISENO-3.0.md §7.3).
// El host escribe una función que recibe `escena` y va llamando sus pasos con `await`.
//
// Estado: aquí están los pasos que el diseño ya define con su firma. Los pasos `efecto`,
// `secuencia` y `cuando` se agregan en la fase 7, cuando exista el ejecutor de pasos.

import type { LectorDeEstado, ValorDeEstado } from '../dominio/estado.ts';

/** Opción común de los pasos que pueden durar. */
export interface OpcionesDeDuracion {
  /** Duración en segundos. Sin ella, el cambio es inmediato. */
  readonly duracion?: number;
}

/** Opciones de `escena.anima`. */
export interface OpcionesDeAnimacion {
  /** `true` para que la animación se repita hasta que otra la reemplace. */
  readonly repite?: boolean;
}

/** Opciones de `escena.dice`. */
export interface OpcionesDeLinea {
  /** Clave de la voz grabada en el manifiesto. Sin ella se usa voz sintetizada. */
  readonly audio?: string;
}

/** El estado del nivel, visto desde una cinemática: se puede leer y cambiar. */
export interface EstadoParaCinematica extends LectorDeEstado {
  pon(nombre: string, valor: ValorDeEstado): void;
}

/**
 * Lo que una cinemática en código puede hacer. Cada método devuelve una promesa
 * que termina cuando el paso terminó (o al instante, si la cinemática se saltó).
 */
export interface EscenaDeCinematica {
  /** Ejecuta varios pasos a la vez y sigue cuando todos terminan. */
  juntos(...pasos: readonly Promise<void>[]): Promise<void>;
  /** Pausa. Usar esto y no `setTimeout`, para que la cinemática se pueda saltar. */
  espera(segundos: number): Promise<void>;
  /** Mueve la cámara a un plano de `mundo.planos`, a un personaje o a `'jugador'`. */
  camara(destino: string, opciones?: OpcionesDeDuracion): Promise<void>;
  /** Voltea a un personaje hacia otro personaje o punto del mapa. */
  mira(personaje: string, hacia: string): Promise<void>;
  /** Reproduce una animación del manifiesto sobre un personaje. */
  anima(personaje: string, clave: string, opciones?: OpcionesDeAnimacion): Promise<void>;
  /** Mete un personaje en un punto del mapa. */
  aparece(personaje: string, punto: string): Promise<void>;
  /** Saca un personaje del escenario. */
  desaparece(personaje: string): Promise<void>;
  /** Cambia la música de fondo. */
  musica(clave: string): Promise<void>;
  /** Toca un sonido. */
  sonido(clave: string): Promise<void>;
  /** Abre desde negro (`'abrir'`) o cierra a negro (`'cerrar'`). */
  fundido(sentido: 'abrir' | 'cerrar', opciones?: OpcionesDeDuracion): Promise<void>;
  /** Video a pantalla completa. Si no se puede reproducir, la promesa termina igual. */
  video(clave: string): Promise<void>;
  /** Un personaje dice una línea, con globo y voz. */
  dice(personaje: string, texto: string, opciones?: OpcionesDeLinea): Promise<void>;
  /** Un personaje camina hasta un punto del mapa. */
  camina(personaje: string, punto: string): Promise<void>;
  /** Termina el nivel hacia un destino: otro nivel o un destino que decide el host. */
  sale(destino: string): void;

  readonly estado: EstadoParaCinematica;
  /** Se dispara si el host destruye el juego a media cinemática. */
  readonly senal: AbortSignal;
}

/** Una cinemática escrita en código. Se registra en `crearEscenario({ cinematicas })`. */
export type CinematicaEnCodigo = (escena: EscenaDeCinematica) => Promise<void>;
