// El contrato de una cinemática escrita en código (docs/DISENO-3.0.md §7.3).
// El host escribe una función que recibe `escena` y va llamando sus pasos con `await`.
//
// Cada método hace lo mismo que el paso del mismo nombre en el JSON de un nivel. El paso `cuando`
// no tiene método: en código se escribe un `if` con `escena.estado.cumple('...')`.
//
// Si un método nombra algo que no existe (un personaje, un punto del mapa, un plano), lanza un error
// que dice qué llamada fue; la cinemática termina ahí y el juego sigue.

import type { CambioDeVariable, LectorDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';

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

/** Opciones de `escena.dice`. Se llaman igual que los campos del paso `dice` de un nivel. */
export interface OpcionesDeLinea {
  /** Clave de la voz grabada en el manifiesto. Sin ella se usa voz sintetizada. */
  readonly audio?: string;
  /** Traducción al idioma base; se muestra más pequeña, debajo del texto. */
  readonly trad?: string;
  /**
   * La palabra que enseña la línea, en inglés. Va siempre junto con `es`: con las dos, el globo lleva
   * una tarjeta de vocabulario y el host recibe el evento `palabra`.
   */
  readonly en?: string;
  /** La misma palabra en español. Va siempre junto con `en`. */
  readonly es?: string;
  /** Clave del dibujo que quien habla toma mientras dura la línea. Al terminar vuelve al que tenía. */
  readonly con?: string;
  /** El dibujo que toman quienes escuchan mientras dura la línea: `{ bobby: 'bobby_feliz' }`. */
  readonly reacciona?: Readonly<Record<string, string>>;
  /** `true` si el personaje lo piensa y no lo dice: el globo es una nube. */
  readonly piensa?: boolean;
}

/** Un video que lleva voces: la clave del video de cada idioma. */
export type VideoPorIdioma = Readonly<Record<Idioma, string>>;

/** El estado del nivel, visto desde una cinemática: se puede leer y cambiar. */
export interface EstadoParaCinematica extends LectorDeEstado {
  pon(nombre: string, valor: CambioDeVariable): void;
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
  /**
   * Video a pantalla completa. Si lleva voces, se nombra uno por idioma: `{ es: 'intro_es', en: 'intro_en' }`.
   * Si no se puede reproducir, la promesa termina igual.
   */
  video(clave: string | VideoPorIdioma): Promise<void>;
  /**
   * Un personaje dice una línea, con globo y voz.
   *
   * @example
   * await escena.dice('tommy', 'Bread!', { trad: '¡Pan!', en: 'bread', es: 'pan', audio: 'vo_bread' });
   */
  dice(personaje: string, texto: string, opciones?: OpcionesDeLinea): Promise<void>;
  /** Un personaje camina hasta un punto del mapa. */
  camina(personaje: string, punto: string): Promise<void>;
  /**
   * Dice quién acompaña al jugador desde ahora: lo sigue mientras explora. Con `null`, ya nadie lo acompaña.
   * Igual que el paso `acompana` de un nivel.
   */
  acompana(personaje: string | null): void;
  /** Un efecto visual con sonido: `'magia'`, `'confeti'` o `'destello'` (un flash blanco de toda la pantalla). */
  efecto(nombre: string): Promise<void>;
  /** Ejecuta una secuencia de `secuencias` del nivel, por su nombre. */
  secuencia(nombre: string): Promise<void>;
  /**
   * Pide que el nivel termine hacia un destino (otro nivel, o uno que decide el host).
   * La salida ocurre cuando la cinemática acaba: lo que la función haga después de esta llamada todavía se ejecuta.
   */
  sale(destino: string): void;

  readonly estado: EstadoParaCinematica;
  /** Se dispara si el nivel termina a media cinemática (por ejemplo, el host destruye el juego). */
  readonly senal: AbortSignal;
}

/**
 * Una cinemática escrita en código. Se registra en `crearEscenario({ cinematicas })` con el nombre
 * que lleva el campo `codigo` de la cinemática en el nivel.
 *
 * @example
 * const intro: CinematicaEnCodigo = async (escena) => {
 *   await escena.fundido('abrir', { duracion: 1 });
 *   await escena.juntos(escena.aparece('mama', 'puerta'), escena.sonido('puerta_abre'));
 *   await escena.camina('mama', 'junto_al_sillon');
 *   await escena.dice('mama', '¿Me traes tortillas, mijo?', { audio: 'vo_mama_tortillas' });
 *   escena.sale('barrio');
 * };
 */
export type CinematicaEnCodigo = (escena: EscenaDeCinematica) => Promise<void>;
