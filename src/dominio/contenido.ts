// El contenido de un nivel: el QUÉ PASA (personajes, diálogos, estado, salida).
// El DÓNDE (posiciones, piso, puntos) viene del mapa de Tiled.
//
// Estos tipos son el contenido ya leído y revisado. Su forma sigue de cerca la del archivo
// `contenido.json`, que se explica en docs/NIVELES.md.

import type { Condicion } from './condicion.ts';
import type { DeclaracionDeEstado } from './estado.ts';
import type { Idioma } from './idioma.ts';
import type { Paso, PasoDeLinea, PasosOSecuencia } from './paso.ts';

/** Alguien que puede hablar o aparecer en el escenario. */
export interface Personaje {
  /** Idioma en el que habla. Si no es el idioma base, sus líneas pueden llevar traducción. */
  readonly idioma: Idioma;
  /** Clave de su imagen en el manifiesto de assets. */
  readonly sprite: string;
}

/** Los datos generales del nivel. */
export interface MetaDeNivel {
  readonly id: string;
  readonly titulo: string;
  /** Personajes por id. */
  readonly personajes: Readonly<Record<string, Personaje>>;
}

/** Quien el jugador controla. Un nivel sin jugador no tiene control libre. */
export interface Jugador {
  /** Id del personaje (clave de `meta.personajes`). */
  readonly personaje: string;
  readonly velocidadEnMetrosPorSegundo: number;
}

/** Desde dónde mira la cámara a lo que sigue. Son los mismos campos que un plano de cinemática. */
export interface AjustesDeCamara {
  readonly distanciaEnMetros: number;
  readonly alturaEnMetros: number;
  /** Giro alrededor de lo que mira, en grados. 0 = de frente. */
  readonly giroEnGrados: number;
}

/** Los ajustes generales del escenario de un nivel. */
export interface AjustesDelMundo {
  /** Cuántos píxeles del mapa y de los sprites equivalen a un metro del escenario. */
  readonly pixelesPorMetro: number;
  /** Cómo sigue la cámara al jugador. */
  readonly camara: AjustesDeCamara;
}

export const VELOCIDAD_DEL_JUGADOR_POR_DEFECTO = 2.4; // metros por segundo: el paso de alguien que camina sin prisa

export const AJUSTES_DEL_MUNDO_POR_DEFECTO: AjustesDelMundo = {
  pixelesPorMetro: 100,
  camara: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 },
};

/** Una rama del diálogo de alguien: se usa la primera cuya condición se cumple. */
export interface Rama {
  /** `undefined` = siempre se cumple. */
  readonly condicion?: Condicion;
  readonly pasos: readonly Paso[];
}

/** Qué pasa al volver de un minijuego abierto desde el diálogo de alguien. */
export interface AlVolver {
  /** Si el minijuego terminó con éxito. */
  readonly siLogrado: PasosOSecuencia;
  /** Si no. Debe ser amable («¡Otro día lo intentamos!»): nunca es un castigo. */
  readonly siNo: PasosOSecuencia;
}

/** Algo con lo que se puede hablar: un NPC o un objeto interactivo del decorado. */
export interface Interlocutor {
  readonly dialogo: readonly Rama[];
  readonly alVolver?: AlVolver;
}

/** La flecha que señala la salida. */
export interface FlechaDeSalida {
  /** `undefined` = siempre visible. */
  readonly visibleCuando?: Condicion;
  readonly texto?: string;
}

/** Por dónde se termina el nivel. */
export interface Salida {
  /** Id de otro nivel, o un destino que decide el host (por ejemplo `"Selector"`). */
  readonly destino: string;
  /** `undefined` = se puede salir siempre. */
  readonly requiere?: Condicion;
  /** Lo que pasa si se intenta salir sin cumplir `requiere`. */
  readonly siBloqueada?: PasosOSecuencia;
  readonly flecha?: FlechaDeSalida;
}

/** El contenido completo de un nivel. */
export interface Contenido {
  readonly meta: MetaDeNivel;
  readonly jugador?: Jugador;
  readonly mundo: AjustesDelMundo;
  readonly estado: DeclaracionDeEstado;
  /** Listas de pasos con nombre, para usarlas desde varios lugares. */
  readonly secuencias: Readonly<Record<string, readonly Paso[]>>;
  /** Diálogo de cada NPC del mapa, por id. */
  readonly npcs: Readonly<Record<string, Interlocutor>>;
  /** Diálogo de cada objeto interactivo del decorado, por id. */
  readonly interactivos: Readonly<Record<string, Interlocutor>>;
  /** Frases que el jugador dice al entrar a una zona del mapa, por grupo. */
  readonly comentarios: Readonly<Record<string, readonly PasoDeLinea[]>>;
  readonly salida?: Salida;
}

/** Prefijo de la variable que el motor marca solo al hablar con alguien: `charlas.<id>`. */
export const PREFIJO_DE_CHARLAS = 'charlas.';
