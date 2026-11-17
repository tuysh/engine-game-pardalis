// Los pasos de un diálogo: lo que pasa, uno tras otro, cuando se habla con alguien.
//
// Quien escribe un nivel usa claves cortas, pensadas para escribirse a mano. Al leer el nivel,
// cada paso se convierte en un objeto con un campo `tipo`, para que el motor use `switch (paso.tipo)`:
//
//   En el contenido del nivel                      Dentro del motor
//   { "dice": "tortu", "texto": "Hola" }           { tipo: 'linea', hablante: 'tortu', texto: 'Hola' }
//   { "elige": "¿Cuál?", "opciones": [...] }       { tipo: 'elige', pregunta: '¿Cuál?', opciones: [...] }
//   { "efecto": "magia" }                          { tipo: 'efecto', nombre: 'magia' }
//   { "pon": { "globo": "rosa" } }                 { tipo: 'pon', valores: { globo: 'rosa' } }
//   { "juego": "Tortilleria", "config": {...} }    { tipo: 'juego', nombre: 'Tortilleria', config: {...} }
//   { "camina": "frente", "quien": "tortu" }       { tipo: 'camina', punto: 'frente', personaje: 'tortu' }
//   { "secuencia": "aun_no_item" }                 { tipo: 'secuencia', nombre: 'aun_no_item' }
//   { "cuando": "tengo x", "dice": [...] }         { tipo: 'condicional', condicion: ..., pasos: [...] }
//
// Los mensajes de error siempre usan los nombres del contenido, que son los que conoce quien lo escribe.

import type { Condicion } from './condicion.ts';
import type { VariablesDeEstado } from './estado.ts';

/** Una palabra de vocabulario: la tarjeta que se muestra junto a una línea. */
export interface PalabraDeVocabulario {
  readonly en: string;
  readonly es: string;
}

/** Alguien dice algo: se muestra un globo y se oye la voz. Termina con un toque o al acabar el audio. */
export interface PasoDeLinea {
  readonly tipo: 'linea';
  /** Id del personaje que habla (clave de `meta.personajes`). */
  readonly hablante: string;
  /** Puede llevar `{faltan}` y `{dinero}`. */
  readonly texto: string;
  /** Traducción al idioma base, cuando el personaje habla en el otro idioma. */
  readonly traduccion?: string;
  /** Si existe, la línea enseña esta palabra y el motor emite el evento `palabra`. */
  readonly palabra?: PalabraDeVocabulario;
  /** Clave de la voz grabada. `undefined` = se usa voz sintetizada. */
  readonly audio?: string;
}

/**
 * Un lugar del contenido donde se puede escribir una lista de pasos
 * o, en vez de ella, el nombre de una secuencia de `secuencias`.
 */
export type PasosOSecuencia =
  | { readonly tipo: 'pasos'; readonly pasos: readonly Paso[] }
  | { readonly tipo: 'secuencia'; readonly nombre: string };

/** Una de las respuestas de un paso `elige`. */
export interface Opcion {
  readonly texto?: string;
  readonly traduccion?: string;
  /** Clave de la imagen. Es lo que permite elegir a quien todavía no lee. */
  readonly imagen?: string;
  /** Clave de la voz que dice la opción. */
  readonly audio?: string;
  /** Si existe, la opción solo aparece cuando se cumple. */
  readonly condicion?: Condicion;
  /** Lo que pasa al elegirla. */
  readonly alElegir: PasosOSecuencia;
}

/** Se muestra una pregunta con opciones y se espera a que el jugador elija una. */
export interface PasoDeEleccion {
  readonly tipo: 'elige';
  readonly pregunta: string;
  readonly opciones: readonly Opcion[];
}

/** Un efecto visual con sonido, como `magia` o `confeti`. */
export interface PasoDeEfecto {
  readonly tipo: 'efecto';
  readonly nombre: string;
}

/** Cambia variables del estado. */
export interface PasoDeEstado {
  readonly tipo: 'pon';
  readonly valores: VariablesDeEstado;
}

/** Abre un minijuego del host y espera su resultado. */
export interface PasoDeMinijuego {
  readonly tipo: 'juego';
  /** Nombre con el que el host registró el minijuego. */
  readonly nombre: string;
  /** Lo que el nivel le pasa al minijuego. El motor no lo interpreta. */
  readonly config: unknown;
}

/** Alguien camina hasta un punto del mapa. */
export interface PasoDeCaminata {
  readonly tipo: 'camina';
  /** Nombre de un `punto` del mapa. */
  readonly punto: string;
  /** Id del personaje que camina. `undefined` = camina el jugador. */
  readonly personaje?: string;
}

/** Ejecuta una secuencia de `secuencias` por su nombre. */
export interface PasoDeSecuencia {
  readonly tipo: 'secuencia';
  readonly nombre: string;
}

/** Ejecuta sus pasos solo si se cumple la condición. */
export interface PasoCondicional {
  readonly tipo: 'condicional';
  readonly condicion: Condicion;
  readonly pasos: readonly Paso[];
}

export type Paso =
  | PasoDeLinea
  | PasoDeEleccion
  | PasoDeEfecto
  | PasoDeEstado
  | PasoDeMinijuego
  | PasoDeCaminata
  | PasoDeSecuencia
  | PasoCondicional;

/** Los efectos que existen. Un paso `efecto` con otro nombre es un error de validación. */
export const EFECTOS_DISPONIBLES: readonly string[] = ['magia', 'confeti'];
