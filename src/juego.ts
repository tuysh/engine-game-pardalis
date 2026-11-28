// El objeto `juego` que entrega `crearEscenario()` y los eventos que emite (docs/DISENO-3.0.md §4).

import type { OrigenDeDialogo } from './aplicacion/conversacion.ts';
import type { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { LectorDeEstado, VariablesDeEstado } from './dominio/estado.ts';
import type { Idioma } from './dominio/idioma.ts';
import type { Partida } from './dominio/partida.ts';
import type { VolumenesPorCanal } from './dominio/volumenes.ts';

/** Lo que cambia `juego.ajustarVolumenes()`: solo los canales que se escriben. Cada uno va de 0 a 1. */
export interface CambiosDeVolumen {
  /** La música de fondo. */
  readonly musica?: number;
  /** Las voces: las grabadas y la sintetizada, del juego, de los minijuegos y de `juego.decir()`. */
  readonly voces?: number;
  /** Los sonidos cortos y los tonos. */
  readonly efectos?: number;
}

/** Cómo dice algo el host con `juego.decir()`. */
export interface OpcionesDeVoz {
  /** En qué idioma está el texto: decide el acento y la voz del dispositivo. */
  readonly idioma: Idioma;
  /** Clave de una voz grabada del nivel actual. Si falta o el nivel no la tiene, se usa la voz sintetizada. */
  readonly clave?: string;
  /**
   * Tono y velocidad de la voz sintetizada, de 0.5 a 2 (1 = normal), como la `voz` de `meta.personajes`.
   * Si también llega `quien`, gana `voz`.
   */
  readonly voz?: { readonly tono?: number; readonly velocidad?: number };
  /**
   * Id de un personaje del nivel actual: la frase suena con su voz de `meta.personajes.<id>.voz`, como sus líneas.
   * Así el host no tiene que copiar la tabla de voces. Si el nivel no tiene ese personaje, se avisa en la consola
   * (una vez por nivel) y se usa la voz normal. Si también llega `voz`, gana `voz`.
   */
  readonly quien?: string;
}

/** Una palabra de vocabulario, en inglés y en español. */
export interface PalabraMostrada {
  readonly en: string;
  readonly es: string;
}

/** Dato del evento `nivel`: el id del nivel que ya se puede jugar y el del que se dejó. */
export interface CambioDeNivel {
  readonly id: string;
  readonly anterior: string;
}

/** Dato del evento `cinematica`. */
export interface AvisoDeCinematica {
  readonly id: string;
  readonly fase: 'inicio' | 'fin';
}

/**
 * Dato del evento `dialogo`: empezó o terminó una conversación con globos que no es una cinemática.
 * Sirve para esconder o achicar lo que el host dibuja encima del juego y que taparía los globos.
 * Nunca se enciman dos: el `'fin'` de uno siempre llega antes que el `'inicio'` del siguiente.
 *
 * @example
 * juego.on('dialogo', ({ fase, origen }) => {
 *   if (origen === 'comentario') return; // los comentarios de zona son cortos: aquí no se esconde nada
 *   achicarLista(fase === 'inicio');
 * });
 */
export interface AvisoDeDialogo {
  readonly fase: 'inicio' | 'fin';
  /**
   * Qué lo empezó: `'npc'` (tocar a un personaje), `'interactivo'` (tocar un objeto del decorado),
   * `'salida'` (intentar salir por una salida cerrada, `salida.siBloqueada`) o `'comentario'`
   * (el jugador entró a una zona con comentarios; mientras se oye, se puede seguir caminando).
   */
  readonly origen: OrigenDeDialogo;
  /** El id del NPC o del interactivo, o el nombre de la zona del comentario. `undefined` en una salida. */
  readonly id: string | undefined;
}

/** Dato del evento `minijuego` cuando se abre. */
export interface InicioDeMinijuego {
  /** El nombre con el que el host registró el minijuego. */
  readonly nombre: string;
  readonly fase: 'inicio';
}

/**
 * Dato del evento `minijuego` cuando se cierra. Llega **después** de aplicar al estado lo que el minijuego
 * otorgó (y del evento `estado` de ese cambio): al recibirlo, `juego.estado` ya tiene los valores nuevos.
 */
export interface FinDeMinijuego {
  /** El nombre con el que el host registró el minijuego. */
  readonly nombre: string;
  readonly fase: 'fin';
  /** `true` si el minijuego dijo que se logró. Un error, la ✕ o una interrupción cuentan como `false`. */
  readonly exito: boolean;
  /** Las variables que cambiaron por lo que otorgó, con su valor nuevo. Ejemplo: `{ dinero: 85, tortillas: true }`. */
  readonly cambios: VariablesDeEstado;
}

/**
 * Dato del evento `minijuego`: se abrió (`fase: 'inicio'`) o se cerró (`fase: 'fin'`) un minijuego.
 *
 * @example
 * juego.on('minijuego', (aviso) => {
 *   if (aviso.fase === 'inicio') return ocultarMenu();
 *   mostrarMenu();
 *   if (Object.hasOwn(aviso.cambios, 'dinero')) animarMonedero(aviso.cambios.dinero);
 * });
 */
export type AvisoDeMinijuego = InicioDeMinijuego | FinDeMinijuego;

/** Dato del evento `estado`: qué variables del nivel cambiaron. */
export interface CambioDeEstado {
  /** Id del nivel que se está jugando. */
  readonly nivel: string;
  /** Solo las variables que cambiaron, con su valor nuevo. Ejemplo: `{ dinero: 90 }`. */
  readonly cambios: VariablesDeEstado;
  /** Todas las variables del nivel, ya con el cambio. */
  readonly variables: VariablesDeEstado;
}

/** Cada evento del juego con el dato que entrega a quien lo escucha. */
export interface EventosDeJuego {
  /**
   * Conviene guardar: objetivo cumplido, fin de cinemática, cambio de nivel o un minijuego que cambió el estado
   * con lo que otorgó (un premio, el dinero de un antojo), aunque no haya cumplido ningún objetivo.
   */
  readonly guardar: Partida;
  /** Se cumplió un objetivo. El dato es su id. */
  readonly objetivo: string;
  /** Se mostró una tarjeta de vocabulario. */
  readonly palabra: PalabraMostrada;
  /** Se terminó de cargar otro nivel. */
  readonly nivel: CambioDeNivel;
  /** Empezó o terminó una cinemática. Sirve para ocultar la interfaz del host. */
  readonly cinematica: AvisoDeCinematica;
  /**
   * Empezó o terminó un diálogo: con un NPC, con un interactivo, el de una salida cerrada o un comentario de zona.
   * Sirve para que lo que el host dibuja encima no tape los globos. Las cinemáticas avisan con `cinematica`.
   */
  readonly dialogo: AvisoDeDialogo;
  /** Se abrió o se cerró un minijuego. Sirve para ocultar lo que el host dibuja encima del juego. */
  readonly minijuego: AvisoDeMinijuego;
  /** Cambió alguna variable del nivel: el dinero, un objetivo, lo que hizo un `pon`. */
  readonly estado: CambioDeEstado;
  /** El jugador salió hacia un destino que no es un nivel registrado: el host decide qué hacer. */
  readonly salida: string;
  /** Falla después de arrancar, por ejemplo un nivel siguiente que no carga. */
  readonly error: ErrorDeEscenario;
}

/** Nombre de un evento del juego. */
export type NombreDeEvento = keyof EventosDeJuego;

/** El juego ya creado. Es lo único que el host necesita para controlarlo. */
export interface Juego {
  /**
   * Escucha un evento. Devuelve una función que cancela la suscripción.
   *
   * @example
   * const dejarDeEscuchar = juego.on('objetivo', (id) => console.log('objetivo cumplido:', id));
   * dejarDeEscuchar();
   */
  on<Evento extends NombreDeEvento>(evento: Evento, funcion: (dato: EventosDeJuego[Evento]) => void): () => void;
  /** Devuelve la partida actual como objeto plano. */
  guardar(): Partida;
  /**
   * Cambia de nivel reutilizando el mismo lienzo. `nivel` es un id de `niveles` o la dirección de un `nivel.json`.
   * Termina cuando el nivel ya se puede jugar. Rechaza con `ErrorDeEscenario` si el nivel no se pudo leer,
   * tiene errores o no cargó alguna de sus imágenes; entonces se sigue jugando el nivel que estaba.
   */
  cargar(nivel: string): Promise<void>;
  /**
   * Lanza una cinemática del nivel actual, aunque ya se haya visto. Termina cuando la cinemática terminó
   * (si hay un diálogo en curso, espera a que acabe). Rechaza con `ErrorDeEscenario` si el nivel no la tiene.
   */
  reproducir(idDeCinematica: string): Promise<void>;
  /** Salta la cinemática o cierra el diálogo en curso. */
  interrumpir(): void;
  /**
   * Congela juego, audio y video. Si el juego estaba diciendo una frase, se corta y al reanudar se dice
   * otra vez desde el principio. Lo que diga el host con `decir()` sí se oye durante la pausa.
   * Un minijuego abierto se entera con `contexto.pausado` y `contexto.alPausarOReanudar`, y su
   * `contexto.enCadaCuadro` deja de avanzar (docs/DISENO-3.0.md §6, «Pausa en un minijuego»).
   */
  pausar(): void;
  /** Sigue desde donde `pausar()` lo dejó. */
  reanudar(): void;
  /**
   * El volumen general, de 0 (callado) a 1 (completo). Empieza en 1. Multiplica a la música, las voces y los
   * efectos. Un valor fuera de 0 a 1 lanza `ErrorDeEscenario` y no cambia nada.
   *
   * @example
   * juego.volumen = 0.5;
   */
  volumen: number;
  /**
   * `true` = no se oye nada, sin olvidar los volúmenes: al volver a `false` todo suena como antes.
   * Empieza en `false`. A diferencia de `pausar()`, el juego sigue avanzando.
   *
   * @example
   * botonDeBocina.onclick = () => { juego.silenciado = !juego.silenciado; };
   */
  silenciado: boolean;
  /** El volumen de cada canal, de 0 a 1, sin contar el general ni el silencio. Para cambiarlo: `ajustarVolumenes`. */
  readonly volumenes: VolumenesPorCanal;
  /**
   * Cambia el volumen de los canales que se escriban; los demás quedan igual. Lanza `ErrorDeEscenario`
   * (sin cambiar nada) si un canal no existe o su volumen no va de 0 a 1.
   *
   * @example
   * juego.ajustarVolumenes({ musica: 0.3 });
   */
  ajustarVolumenes(cambios: CambiosDeVolumen): void;
  /**
   * Dice un texto en voz alta con la voz del motor. Espera su turno: no se encima con lo que dice el juego
   * ni lo corta. Se oye aunque el juego esté en pausa. Una frase nueva de `juego.decir` corta la anterior.
   * La promesa termina cuando acaba de hablar (o cuando la corta otra, `juego.callar()` o la destrucción del
   * juego) y rechaza con `ErrorDeEscenario` solo si los argumentos no sirven.
   * Una `clave` que el nivel no tiene se avisa en la consola una sola vez por nivel.
   *
   * @example
   * await juego.decir('maíz', { idioma: 'es' });
   * await juego.decir('corn', { idioma: 'en', clave: 'vo_bobby_corn', quien: 'bobby' });
   * await juego.decir('corn', { idioma: 'en', voz: { tono: 1.3 } });
   */
  decir(texto: string, opciones: OpcionesDeVoz): Promise<void>;
  /**
   * Calla lo que el host está diciendo con `juego.decir()`, y también la frase del host que esperaba su turno;
   * sus promesas terminan en ese momento. Nunca corta las líneas del juego. Sin nada del host, no hace nada.
   *
   * @example
   * botonCerrarCuaderno.addEventListener('click', () => juego.callar());
   */
  callar(): void;
  /** Modo salón de clases. Se puede cambiar sin reiniciar. */
  proyeccion: boolean;
  /** Id del nivel actual. */
  readonly nivel: string;
  /**
   * El estado del nivel actual, solo para leer. Es el mismo lector que reciben los minijuegos.
   * Mientras se carga un nivel no hay estado: `obtener` entrega `undefined` y `cumple`, `false`.
   *
   * @example
   * pintarMonedero(juego.estado.obtener('dinero'));
   * if (juego.estado.cumple('tengo maiz')) tacharDeLaLista('maiz');
   */
  readonly estado: LectorDeEstado;
  /** Libera todo: WebGL, audio, video, temporizadores y oyentes. Se puede llamar más de una vez. */
  destruir(): void;
}
