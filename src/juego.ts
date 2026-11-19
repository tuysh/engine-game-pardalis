// El objeto `juego` que entrega `crearEscenario()` y los eventos que emite (docs/DISENO-3.0.md §4).

import type { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { Partida } from './dominio/partida.ts';

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

/** Cada evento del juego con el dato que entrega a quien lo escucha. */
export interface EventosDeJuego {
  /** Conviene guardar: objetivo cumplido, fin de cinemática o cambio de nivel. */
  readonly guardar: Partida;
  /** Se cumplió un objetivo. El dato es su id. */
  readonly objetivo: string;
  /** Se mostró una tarjeta de vocabulario. */
  readonly palabra: PalabraMostrada;
  /** Se terminó de cargar otro nivel. */
  readonly nivel: CambioDeNivel;
  /** Empezó o terminó una cinemática. Sirve para ocultar la interfaz del host. */
  readonly cinematica: AvisoDeCinematica;
  /** El jugador salió hacia un destino que no es un nivel registrado: el host decide qué hacer. */
  readonly salida: string;
  /** Falla después de arrancar, por ejemplo un nivel siguiente que no carga. */
  readonly error: ErrorDeEscenario;
}

/** Nombre de un evento del juego. */
export type NombreDeEvento = keyof EventosDeJuego;

/** El juego ya creado. Es lo único que el host necesita para controlarlo. */
export interface Juego {
  /** Escucha un evento. Devuelve una función que cancela la suscripción. */
  on<Evento extends NombreDeEvento>(evento: Evento, funcion: (dato: EventosDeJuego[Evento]) => void): () => void;
  /** Devuelve la partida actual como objeto plano. */
  guardar(): Partida;
  /**
   * Cambia de nivel reutilizando el mismo lienzo. `nivel` es un id de `niveles` o la dirección de un `nivel.json`.
   * Termina cuando el nivel ya se puede jugar. Rechaza con `ErrorDeEscenario` si el nivel no se pudo leer
   * o tiene errores; entonces se sigue jugando el nivel que estaba.
   */
  cargar(nivel: string): Promise<void>;
  /**
   * Lanza una cinemática del nivel actual, aunque ya se haya visto. Termina cuando la cinemática terminó
   * (si hay un diálogo en curso, espera a que acabe). Rechaza con `ErrorDeEscenario` si el nivel no la tiene.
   */
  reproducir(idDeCinematica: string): Promise<void>;
  /** Salta la cinemática o cierra el diálogo en curso. */
  interrumpir(): void;
  /** Congela juego, audio y video. */
  pausar(): void;
  reanudar(): void;
  /** Modo salón de clases. Se puede cambiar sin reiniciar. */
  proyeccion: boolean;
  /** Id del nivel actual. */
  readonly nivel: string;
  /** Libera todo: WebGL, audio, video, temporizadores y oyentes. Se puede llamar más de una vez. */
  destruir(): void;
}
