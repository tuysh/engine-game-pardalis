// El contrato de un minijuego (docs/DISENO-3.0.md §6).
// Un minijuego es una función que escribe el host: recibe un elemento del DOM a pantalla completa,
// dibuja lo que quiera dentro y devuelve una promesa con el resultado.

import type { CambiosDeEstado, LectorDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { Azar } from './azar.ts';

/** Cómo tocar un sonido desde un minijuego. */
export interface OpcionesDeSonidoParaMinijuego {
  /** De 0 a 1, antes de aplicar el volumen de los efectos que eligió el host. `undefined` = 1. */
  readonly volumen?: number;
  /** De 0.25 a 4: qué tan rápido (y agudo) suena. `undefined` = 1, como está grabado. */
  readonly tono?: number;
}

/** El audio del motor, visto desde un minijuego. */
export interface AudioParaMinijuego {
  /**
   * Toca un sonido del manifiesto de assets sin esperar a que termine.
   * `opciones.volumen` (de 0 a 1) lo hace más bajito; `opciones.tono` lo reproduce más rápido y más agudo
   * (2 = una octava arriba) o más lento y más grave (0.5 = una octava abajo). Sirve para que un mismo
   * sonido suba de nota en cada acierto seguido. Una opción que no sirve se ignora con una advertencia.
   *
   * @example
   * audio.tocar('sfx_atrapa', { tono: 1 + aciertosSeguidos * 0.1 });
   * audio.tocar('sfx_paso', { volumen: 0.3 });
   */
  tocar(clave: string, opciones?: OpcionesDeSonidoParaMinijuego): void;
  /**
   * Toca una nota corta hecha por el dispositivo, sin archivo: sirve para un «ding» sin grabar nada.
   * Ejemplo: `tocarTono(880, 0.2)` es un la agudo de dos décimas de segundo.
   */
  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void;
  /**
   * Dice un texto en voz alta. Si `clave` nombra una voz grabada se usa esa;
   * si no, se usa la voz sintetizada del navegador (y se avisa en la consola, una vez por nivel y clave).
   * `quien` es el id de un personaje del nivel: la voz sintetizada suena con su tono y su velocidad
   * (`meta.personajes.<id>.voz`), igual que sus líneas. Sin `quien`, o con un id que el nivel no tiene
   * (se avisa una vez), suena la voz normal. Para dar `quien` sin voz grabada, `clave` va en `undefined`.
   *
   * La promesa termina cuando acaba de hablar, así que dos frases se encadenan con `await`.
   * Solo se dice una frase a la vez: llamar a `decir` mientras otra suena **la corta** (y la promesa de la
   * que se cortó termina en ese momento). También termina al cerrarse el minijuego. Nunca rechaza.
   *
   * @example
   * await audio.decir('¡Lechuga!', 'es');
   * await audio.decir('lettuce!', 'en', 'vo_bobby_lettuce', 'bobby');
   * await audio.decir('¡Muy bien!', 'es', undefined, 'tortu');
   */
  decir(texto: string, idioma: Idioma, clave?: string, quien?: string): Promise<void>;
}

/** Los cuadros de una imagen del manifiesto, con su ritmo. */
export interface CuadrosDeAsset {
  /**
   * Dirección completa de cada cuadro, en el orden en que se muestran. Ya sigue la `secuencia` de
   * `assets.config.json`, así que un cuadro puede repetirse: con `"secuencia": { "spr_tepo": [1, 1, 1, 2] }`
   * llegan cuatro direcciones, tres de ellas iguales. Una imagen fija trae una sola.
   * Vacía si la clave no es una imagen ni una animación del nivel.
   */
  readonly urls: readonly string[];
  /** Cuántos cuadros pasan por segundo (el `fps` de `assets.config.json`). `0` en una imagen fija. */
  readonly cuadrosPorSegundo: number;
}

/**
 * Lo único que `assets.animar` necesita de una imagen: poder cambiarle la dirección.
 * Un `HTMLImageElement` (`<img>`) lo cumple; también un objeto cualquiera con `src`.
 */
export interface ImagenAnimable {
  src: string;
}

/** Una imagen que `assets.animar` está animando. */
export interface AnimacionDeImagen {
  /**
   * Pasa a otra clave en la misma imagen, desde su primer cuadro. Sirve para alternar poses:
   * de `spr_tepo` (quieto, parpadea) a `tepo_habla` (mueve la boca) y de vuelta.
   * Una clave que no es imagen del nivel se ignora con una advertencia y la animación sigue como estaba.
   * Después de `detener()` ya no hace nada.
   */
  cambiar(clave: string): void;
  /** Deja de animar. La imagen se queda en el cuadro que mostraba. Llamarla dos veces no hace nada. */
  detener(): void;
}

/** Los assets del nivel, vistos desde un minijuego. */
export interface AssetsParaMinijuego {
  /**
   * Dirección completa de un asset del manifiesto, lista para usarse en un `<img>`.
   * De una animación, la de su primer cuadro: para verla moverse, `animar`.
   */
  url(clave: string): string;
  /**
   * Las direcciones de todos los cuadros de una imagen o animación, con su ritmo. Sirve para dibujar
   * la animación a mano (en un `<canvas>`, en Three.js) o para precargar sus cuadros.
   *
   * @example
   * const { urls } = assets.cuadros('tepo_habla');
   * for (const url of new Set(urls)) new Image().src = url; // precarga, para que no parpadee al cambiar
   */
  cuadros(clave: string): CuadrosDeAsset;
  /**
   * Anima una imagen con los cuadros de `clave`, al ritmo y en el orden de `assets.config.json`, igual que
   * los personajes del escenario: así parpadean y mueven la boca también dentro del minijuego.
   * Se repite sin fin hasta que se llama a `detener()`, se dispara `senal` o se cierra el minijuego.
   * Una imagen fija solo se pone, sin animar. Volver a animar la misma imagen detiene la animación anterior.
   * Con una clave que no es imagen del nivel avisa en la consola y deja la imagen como estaba, sin animar.
   * El tiempo es el del juego: si el host pausa el juego, la animación también se pausa.
   *
   * @example
   * const tepo = document.createElement('img');
   * const animacion = assets.animar(tepo, 'spr_tepo');
   * elemento.append(tepo);
   *
   * animacion.cambiar('tepo_habla');      // mueve la boca mientras habla
   * await audio.decir('¡Buenos días!', 'es');
   * animacion.cambiar('spr_tepo');        // vuelve a quedarse quieto, parpadeando
   */
  animar(imagen: ImagenAnimable, clave: string, senal?: AbortSignal): AnimacionDeImagen;
}

/** Lo que el motor le entrega a un minijuego al empezar. */
export interface ContextoDeMinijuego {
  /**
   * Elemento vacío a pantalla completa, encima del escenario. El motor lo crea antes y lo borra después.
   * El minijuego puede ponerle los estilos que quiera: seguirá ocupando toda la pantalla del juego.
   */
  readonly elemento: HTMLElement;
  /** Lo que venga en el campo `config` del paso `juego` del nivel. El minijuego debe revisarlo. */
  readonly config: unknown;
  /** Estado del nivel, solo para leer. Para cambiarlo se usa `otorgar` en el resultado. */
  readonly estado: LectorDeEstado;
  readonly audio: AudioParaMinijuego;
  readonly assets: AssetsParaMinijuego;
  /**
   * El azar del motor: cada llamada entrega un número mayor o igual a 0 y menor que 1, como `Math.random`.
   * Conviene usarlo en vez de `Math.random`: con la opción `semilla` de `crearEscenario`, el minijuego
   * también se vuelve repetible.
   */
  readonly azar: Azar;
  /** Se dispara si el host destruye el juego. El minijuego debe limpiar lo suyo. */
  readonly senal: AbortSignal;
}

/** Lo que un minijuego devuelve al terminar. */
export interface ResultadoDeMinijuego {
  /** `false` nunca es un castigo: solo lleva al diálogo amable `siNo`. */
  readonly exito: boolean;
  /**
   * Variables del estado que el minijuego concede. Ejemplo: `{ tortillas: true }`.
   * Para cobrar o premiar con números conviene `{ dinero: { resta: 15 } }` o `{ estrellas: { suma: 1 } }`:
   * así el minijuego no tiene que leer el total, y el motor hace la cuenta con el valor de ese momento.
   */
  readonly otorgar?: CambiosDeEstado;
}

/**
 * Un minijuego. Se registra en `crearEscenario({ minijuegos })` con el nombre que usan los pasos `juego`.
 * Si la función lanza un error, el motor lo trata como `{ exito: false }`.
 *
 * @example
 * const Tortilleria: Minijuego = ({ elemento, assets, senal }) =>
 *   new Promise((terminar) => {
 *     const tortilla = document.createElement('img');
 *     tortilla.src = assets.url('item_tortillas');
 *     tortilla.onclick = () => terminar({ exito: true, otorgar: { tortillas: true } });
 *     elemento.append(tortilla);
 *     // Si el host destruye el juego a medio minijuego, se termina sin premio.
 *     senal.addEventListener('abort', () => terminar({ exito: false }));
 *   });
 */
export type Minijuego = (contexto: ContextoDeMinijuego) => Promise<ResultadoDeMinijuego>;
