// El contrato de un minijuego (docs/DISENO-3.0.md §6).
// Un minijuego es una función que escribe el host: recibe un elemento del DOM a pantalla completa,
// dibuja lo que quiera dentro y devuelve una promesa con el resultado.

import type { LectorDeEstado, ValorDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';

/** El audio del motor, visto desde un minijuego. */
export interface AudioParaMinijuego {
  /** Toca un sonido del manifiesto de assets. */
  tocar(clave: string): void;
  /**
   * Dice un texto en voz alta. Si `clave` nombra una voz grabada se usa esa;
   * si no, se usa la voz sintetizada del navegador.
   */
  decir(texto: string, idioma: Idioma, clave?: string): void;
}

/** Los assets del nivel, vistos desde un minijuego. */
export interface AssetsParaMinijuego {
  /** Dirección completa de un asset del manifiesto, lista para usarse en un `<img>`. */
  url(clave: string): string;
}

/** Lo que el motor le entrega a un minijuego al empezar. */
export interface ContextoDeMinijuego {
  /** Elemento vacío a pantalla completa. El motor lo crea antes y lo borra después. */
  readonly elemento: HTMLElement;
  /** Lo que venga en el campo `config` del paso `juego` del nivel. El minijuego debe revisarlo. */
  readonly config: unknown;
  /** Estado del nivel, solo para leer. Para cambiarlo se usa `otorgar` en el resultado. */
  readonly estado: LectorDeEstado;
  readonly audio: AudioParaMinijuego;
  readonly assets: AssetsParaMinijuego;
  /** Se dispara si el host destruye el juego. El minijuego debe limpiar lo suyo. */
  readonly senal: AbortSignal;
}

/** Lo que un minijuego devuelve al terminar. */
export interface ResultadoDeMinijuego {
  /** `false` nunca es un castigo: solo lleva al diálogo amable `siNo`. */
  readonly exito: boolean;
  /** Variables del estado que el minijuego concede. Ejemplo: `{ tortillas: true }`. */
  readonly otorgar?: Readonly<Record<string, ValorDeEstado>>;
}

/**
 * Un minijuego. Si la función lanza un error, el motor lo trata como `{ exito: false }`.
 */
export type Minijuego = (contexto: ContextoDeMinijuego) => Promise<ResultadoDeMinijuego>;
