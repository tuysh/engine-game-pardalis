// Los pasos de un diálogo: lo que pasa, uno tras otro, cuando se habla con alguien.
//
// Quien escribe un nivel usa claves cortas, pensadas para escribirse a mano. Al leer el nivel,
// cada paso se convierte en un objeto con un campo `tipo`, para que el motor use `switch (paso.tipo)`:
//
//   En el contenido del nivel                      Dentro del motor
//   { "dice": "tortu", "texto": "Hola" }           { tipo: 'linea', hablante: 'tortu', texto: 'Hola' }
//   { "dice": "pardi", "texto": "¡Oh!", "con": "pardi_sorpresa", "reacciona": { "bobby": "bobby_feliz" }, "piensa": true }
//                                                  { tipo: 'linea', hablante: 'pardi', texto: '¡Oh!', pose: 'pardi_sorpresa',
//                                                    reacciones: { bobby: 'bobby_feliz' }, esPensamiento: true }
//   { "elige": "¿Cuál?", "opciones": [...] }       { tipo: 'elige', pregunta: '¿Cuál?', opciones: [...] }
//   { "efecto": "magia" }                          { tipo: 'efecto', nombre: 'magia' }
//   { "efecto": "destello", "sonido": "sfx_foto" } { tipo: 'efecto', nombre: 'destello', sonido: 'sfx_foto' }
//   { "pon": { "globo": "rosa" } }                 { tipo: 'pon', valores: { globo: 'rosa' } }
//   { "pon": { "dinero": { "resta": 10 } } }       { tipo: 'pon', valores: { dinero: { resta: 10 } } }
//   { "juego": "Tortilleria", "config": {...} }    { tipo: 'juego', nombre: 'Tortilleria', config: {...} }
//   { "camina": "frente", "quien": "tortu" }       { tipo: 'camina', punto: 'frente', personaje: 'tortu' }
//   { "secuencia": "aun_no_item" }                 { tipo: 'secuencia', nombre: 'aun_no_item' }
//   { "cuando": "tengo x", "dice": [...] }         { tipo: 'condicional', condicion: ..., pasos: [...] }
//
//
// Los pasos de escena (los de abajo) nacieron para las cinemáticas, pero sirven en cualquier diálogo:
//
//   { "juntos": [ ...pasos ] }                     { tipo: 'juntos', pasos: [...] }
//   { "espera": 2 }                                { tipo: 'espera', esperaEnSegundos: 2 }
//   { "camara": "plano_sala", "duracion": 2 }      { tipo: 'camara', destino: 'plano_sala', duracionEnSegundos: 2 }
//   { "mira": "tommy", "hacia": "mama" }           { tipo: 'mira', personaje: 'tommy', hacia: 'mama' }
//   { "anima": "tommy", "con": "tommy_tele" }      { tipo: 'anima', personaje: 'tommy', clave: 'tommy_tele', repite: false }
//   { "aparece": "mama", "en": "puerta" }          { tipo: 'aparece', personaje: 'mama', punto: 'puerta' }
//   { "desaparece": "mama" }                       { tipo: 'desaparece', personaje: 'mama' }
//   { "musica": "mus_casa" }                       { tipo: 'musica', clave: 'mus_casa' }
//   { "sonido": "puerta_abre" }                    { tipo: 'sonido', clave: 'puerta_abre' }
//   { "fundido": "abrir", "duracion": 1 }          { tipo: 'fundido', sentido: 'abrir', duracionEnSegundos: 1 }
//   { "video": "intro_tele" }                      { tipo: 'video', clavePorIdioma: { es: 'intro_tele', en: 'intro_tele' } }
//   { "sale": "barrio" }                           { tipo: 'sale', destino: 'barrio' }
//   { "acompana": "bobby" }                        { tipo: 'acompana', personaje: 'bobby' }
//   { "acompana": null }                           { tipo: 'acompana', personaje: undefined }
//
// Los mensajes de error siempre usan los nombres del contenido, que son los que conoce quien lo escribe.

import type { Condicion } from './condicion.ts';
import type { CambiosDeEstado } from './estado.ts';
import type { Idioma } from './idioma.ts';

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
  /**
   * Clave del dibujo (imagen o animación) que quien habla toma mientras dura la línea: una cara de sorpresa,
   * de duda. Al terminar la línea vuelve al dibujo que tenía. `undefined` = no cambia de dibujo.
   */
  readonly pose?: string;
  /**
   * El dibujo que toman quienes escuchan mientras dura la línea, por id de personaje.
   * Ejemplo: `{ bobby: 'bobby_feliz' }`. Al terminar, cada quien vuelve al dibujo que tenía.
   */
  readonly reacciones?: Readonly<Record<string, string>>;
  /** `true` = el personaje no lo dice: lo piensa. El globo se dibuja como una nube. Por defecto, lo dice. */
  readonly esPensamiento?: boolean;
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

/** Un efecto visual con sonido, como `magia`, `confeti` o `destello`. */
export interface PasoDeEfecto {
  readonly tipo: 'efecto';
  readonly nombre: string;
  /** Clave del sonido que acompaña al efecto (un obturador de cámara). `undefined` = suenan las notas del efecto. */
  readonly sonido?: string;
}

/** Cambia variables del estado: les da un valor fijo, o le suma o le resta a su número. */
export interface PasoDeEstado {
  readonly tipo: 'pon';
  readonly valores: CambiosDeEstado;
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

/** Varios pasos a la vez; el diálogo sigue cuando todos terminaron. */
export interface PasoDeJuntos {
  readonly tipo: 'juntos';
  readonly pasos: readonly Paso[];
}

/** Una pausa. */
export interface PasoDeEspera {
  readonly tipo: 'espera';
  readonly esperaEnSegundos: number;
}

/** Mueve la cámara. */
export interface PasoDeCamara {
  readonly tipo: 'camara';
  /** Nombre de un plano de `mundo.planos`, id de un personaje, o `'jugador'` para volver a seguirlo. */
  readonly destino: string;
  /** Cuánto tarda en llegar. 0 = corte directo. */
  readonly duracionEnSegundos: number;
}

/** Voltea a un personaje hacia otro personaje o hacia un punto del mapa. */
export interface PasoDeMirada {
  readonly tipo: 'mira';
  readonly personaje: string;
  /** Id de un personaje o nombre de un punto del mapa. */
  readonly hacia: string;
}

/** Cambia el dibujo de un personaje, o de un objeto del decorado, por una animación (o una imagen) de los assets. */
export interface PasoDeAnimacion {
  readonly tipo: 'anima';
  /**
   * Id de un personaje o, si ningún personaje se llama así, el `id` de un objeto del decorado del mapa
   * (una familia sentada a la mesa que levanta los platos).
   */
  readonly personaje: string;
  /** Clave de una animación o de una imagen. */
  readonly clave: string;
  /**
   * `true`: la animación se repite sin parar y el diálogo sigue de inmediato.
   * `false`: se reproduce una vez, el diálogo espera a que termine y el personaje vuelve a su dibujo normal.
   */
  readonly repite: boolean;
}

/** Mete a un personaje al escenario, parado en un punto del mapa. */
export interface PasoDeAparicion {
  readonly tipo: 'aparece';
  readonly personaje: string;
  readonly punto: string;
}

/** Saca a un personaje del escenario. */
export interface PasoDeDesaparicion {
  readonly tipo: 'desaparece';
  readonly personaje: string;
}

/** Cambia la música de fondo. */
export interface PasoDeMusica {
  readonly tipo: 'musica';
  readonly clave: string;
}

/** Toca un sonido corto. */
export interface PasoDeSonido {
  readonly tipo: 'sonido';
  readonly clave: string;
}

/** Aclara la pantalla desde negro (`abrir`) o la oscurece hasta negro (`cerrar`). */
export interface PasoDeFundido {
  readonly tipo: 'fundido';
  readonly sentido: 'abrir' | 'cerrar';
  /** Cuánto tarda. 0 = de golpe. */
  readonly duracionEnSegundos: number;
}

/** Reproduce un video a pantalla completa. Si el video lleva voces, hay uno por idioma. */
export interface PasoDeVideo {
  readonly tipo: 'video';
  /** La clave del video para cada idioma del sitio. Si el video no lleva voces, es la misma clave en los dos. */
  readonly clavePorIdioma: Readonly<Record<Idioma, string>>;
}

/** Termina el nivel hacia un destino: otro nivel, o un destino que decide el host. */
export interface PasoDeSalida {
  readonly tipo: 'sale';
  readonly destino: string;
}

/**
 * Dice quién acompaña al jugador desde ahora: lo sigue a corta distancia mientras explora.
 * Sirve para historias donde el acompañante llega o se va a media aventura.
 */
export interface PasoDeAcompanante {
  readonly tipo: 'acompana';
  /** Id del personaje que acompaña. `undefined` = desde ahora nadie acompaña al jugador. */
  readonly personaje?: string;
}

export type Paso =
  | PasoDeLinea
  | PasoDeEleccion
  | PasoDeEfecto
  | PasoDeEstado
  | PasoDeMinijuego
  | PasoDeCaminata
  | PasoDeSecuencia
  | PasoCondicional
  | PasoDeJuntos
  | PasoDeEspera
  | PasoDeCamara
  | PasoDeMirada
  | PasoDeAnimacion
  | PasoDeAparicion
  | PasoDeDesaparicion
  | PasoDeMusica
  | PasoDeSonido
  | PasoDeFundido
  | PasoDeVideo
  | PasoDeSalida
  | PasoDeAcompanante;

/** Lo que se escribe en un paso `camara` para que la cámara vuelva a seguir al jugador. */
export const CAMARA_AL_JUGADOR = 'jugador';

/** Los efectos que existen. Un paso `efecto` con otro nombre es un error de validación. */
export const EFECTOS_DISPONIBLES: readonly string[] = ['magia', 'confeti', 'destello'];
