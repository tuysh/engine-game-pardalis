// El mundo de un nivel: el DÓNDE. Sale del mapa de Tiled, que es el plano del lugar visto desde arriba
// (docs/DISENO-3.0.md §9). El resto del motor solo conoce este modelo, no el formato de Tiled.
//
// Todas las medidas están en metros del escenario. En el plano, `x` es izquierda–derecha
// e `y` es profundidad: más grande = más cerca de la cámara. La altura no está en el plano:
// sale del tamaño de cada imagen.
//
// Cada cosa lleva una `descripcion` (por ejemplo: `objeto #12 "Doña Tortu"`) para nombrarla en un mensaje de error.

import type { Forma } from './forma.ts';
import type { Punto, Rectangulo } from './geometria.ts';

/** Hacia dónde mira un personaje. */
export type Mira = 'izquierda' | 'derecha';

/** La imagen del piso, tal como se ve desde arriba. */
export interface Suelo {
  /** Clave de la imagen. Su tamaño en el escenario sale del tamaño de la imagen. */
  readonly asset: string;
  /** Dónde va la esquina de menor `x` y menor `y` de la imagen. */
  readonly esquina: Punto;
}

/** Un fondo vertical (una fachada, el cielo) que se levanta sobre una línea del plano. */
export interface Telon {
  readonly descripcion: string;
  readonly asset: string;
  readonly desde: Punto;
  readonly hasta: Punto;
  readonly altoEnMetros: number;
}

/**
 * Cómo se dibuja un objeto del decorado:
 * - `parado`: papel vertical sobre su huella; bloquea el paso.
 * - `plano`: pintado sobre el piso, del tamaño de su huella; se puede pisar (un tapete, una flecha).
 * - `colgado`: papel vertical en lo alto; no bloquea (papel picado, una lámpara).
 */
export type ClaseDeDecorado = 'parado' | 'plano' | 'colgado';

export const CLASES_DE_DECORADO: readonly ClaseDeDecorado[] = ['parado', 'plano', 'colgado'];

export interface Decorado {
  readonly descripcion: string;
  readonly clase: ClaseDeDecorado;
  readonly asset: string;
  /** El rectángulo que el objeto ocupa en el piso. Si es `parado`, es exactamente lo que bloquea. */
  readonly huella: Rectangulo;
  /** Del piso al borde inferior del dibujo. Solo cuenta para la clase `colgado`. */
  readonly alturaEnMetros: number;
  /** Si existe, el objeto se puede tocar: su diálogo está en `interactivos` del contenido. */
  readonly id?: string;
}

/** Dónde está parado un personaje al empezar el nivel. */
export interface LugarDePersonaje {
  readonly descripcion: string;
  readonly posicion: Punto;
  readonly mira: Mira;
}

/** El área que, al tocarla, lleva al jugador a salir del nivel. */
export interface SalidaDelMapa {
  readonly descripcion: string;
  readonly forma: Forma;
}

/** Un área que hace algo cuando el jugador entra en ella. */
export interface Zona {
  readonly descripcion: string;
  readonly forma: Forma;
  /** Qué lista de `comentarios` del contenido se usa al entrar. `undefined` = la zona no comenta nada. */
  readonly grupo?: string;
  /** Segundos antes de poder repetir un comentario en esta zona. */
  readonly esperaEnSegundos: number;
}

export interface Mundo {
  readonly anchoEnMetros: number;
  readonly profundidadEnMetros: number;
  readonly suelo?: Suelo;
  readonly telones: readonly Telon[];
  readonly decorado: readonly Decorado[];
  /** Los personajes que ya están en el escenario, por id de personaje. */
  readonly npcs: Readonly<Record<string, LugarDePersonaje>>;
  /** Debe haber exactamente uno si el nivel tiene jugador; se guarda como lista para poder comprobarlo. */
  readonly iniciosDelJugador: readonly LugarDePersonaje[];
  /** Puntos con nombre: los destinos de los pasos `camina`. */
  readonly puntos: Readonly<Record<string, Punto>>;
  readonly salida?: SalidaDelMapa;
  /** Zonas por nombre. */
  readonly zonas: Readonly<Record<string, Zona>>;
  /** Los polígonos por donde se puede caminar. */
  readonly pisos: readonly (readonly Punto[])[];
}

/** Segundos que una zona espera antes de repetir un comentario, si el mapa no dice otra cosa. */
export const ESPERA_DE_ZONA_POR_DEFECTO_EN_SEGUNDOS = 20;

/** Altura a la que cuelga un objeto `colgado`, si el mapa no dice otra. */
export const ALTURA_DE_LO_COLGADO_POR_DEFECTO_EN_METROS = 2.2;
