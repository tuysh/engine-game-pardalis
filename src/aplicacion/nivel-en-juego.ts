// Lo que se le pide a `jugarNivel` (jugar-nivel.ts), lo que necesita del exterior, cómo avisa de lo que pasa
// y lo que entrega: el nivel que se está jugando.

import type { EstadoDeNivel, VariablesDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import type { ProgresoDeCarga } from '../dominio/progreso-de-carga.ts';
import type { Audio } from '../puertos/audio.ts';
import type { Azar } from '../puertos/azar.ts';
import type { CinematicaEnCodigo } from '../puertos/cinematica-en-codigo.ts';
import type { Controles } from '../puertos/controles.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { Minijuego } from '../puertos/minijuego.ts';
import type { PanelDeDepuracion } from '../puertos/panel-de-depuracion.ts';
import type { Reloj } from '../puertos/reloj.ts';
import type { Video } from '../puertos/video.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';
import type { DialogoDelNivel } from './conversacion.ts';
import type { FundidoDePantalla } from './fundido-de-pantalla.ts';
import type { CierreDeMinijuego } from './jugar-minijuego.ts';

/** Lo que hace falta para el modo depuración (docs/DISENO-3.0.md §9.3). */
export interface HerramientasDeDepuracion {
  readonly panel: PanelDeDepuracion;
  /** Congelan y reanudan el juego: la cámara libre lo pausa mientras se encuadra un plano. */
  readonly pausarElJuego: () => void;
  readonly reanudarElJuego: () => void;
}

/** Lo que se va a jugar. */
export interface PedidoDeJuego {
  readonly nivel: Nivel;
  readonly ubicacion: UbicacionDeAssets;
  /** El idioma del sitio. */
  readonly idiomaBase: Idioma;
  /** Los minijuegos que registró el host, por nombre. */
  readonly minijuegos: Readonly<Record<string, Minijuego>>;
  /** Las cinemáticas escritas en código que registró el host, por nombre. Por defecto, ninguna. */
  readonly cinematicasEnCodigo?: Readonly<Record<string, CinematicaEnCodigo>>;
  /** Las variables del nivel en una partida guardada. `undefined` = el nivel empieza de cero. */
  readonly variablesGuardadas?: VariablesDeEstado;
  /** `true` si el sistema pide menos movimiento: los viajes de cámara se vuelven cortes. Por defecto `false`. */
  readonly conMenosMovimiento?: boolean;
  /** Si existe, se le avisa del avance mientras cargan las imágenes del nivel. */
  readonly alCargar?: (progreso: ProgresoDeCarga) => void;
  /** Con esto, el nivel dibuja sus guías y ofrece la cámara libre. `undefined` = se juega sin depuración. */
  readonly depuracion?: HerramientasDeDepuracion;
  /**
   * El fundido de la pantalla. Quien juega varios niveles entrega el mismo a todos, para que cada nivel sepa
   * si el anterior cerró a negro antes de salir. Por defecto, uno nuevo con la pantalla clara.
   */
  readonly fundido?: FundidoDePantalla;
}

export interface PuertosParaJugar {
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
  readonly audio: Audio;
  readonly video: Video;
  readonly controles: Controles;
  readonly reloj: Reloj;
  readonly azar: Azar;
}

/** Cómo el nivel le avisa de lo que pasa a quien lo puso a jugar. */
export interface AvisosDelNivel {
  alCumplirObjetivo(objetivo: string): void;
  alVerPalabra(palabra: PalabraDeVocabulario): void;
  /**
   * El nivel terminó hacia ese destino: el jugador salió por la salida del mapa,
   * o una escena lo pidió con un paso `sale`.
   */
  alSalir(destino: string): void;
  /** Un diálogo o una cinemática falló con un error inesperado y se dio por terminado. */
  alFallar(error: unknown): void;
  /** Empezó una cinemática. El dato es su id. */
  alEmpezarCinematica(id: string): void;
  /** Terminó una cinemática: completa, saltada o con error. */
  alTerminarCinematica(id: string): void;
  /** Empezó un diálogo con un NPC o un interactivo, el de una salida cerrada, o un comentario de zona. */
  alEmpezarDialogo(dialogo: DialogoDelNivel): void;
  /** Terminó ese diálogo: completo, interrumpido o con error. Nunca se enciman dos. */
  alTerminarDialogo(dialogo: DialogoDelNivel): void;
  /** Alguna variable cambió de valor. `cambios` trae solo las que cambiaron; `estado` es el estado ya cambiado. */
  alCambiarElEstado(cambios: VariablesDeEstado, estado: EstadoDeNivel): void;
  /** Se abrió un minijuego. El dato es el nombre con el que el host lo registró. */
  alEmpezarMinijuego(nombre: string): void;
  /**
   * El minijuego se cerró: terminó, falló o se interrumpió. Lo que otorgó ya está en el estado
   * (y ya se avisó con `alCambiarElEstado`); `cierre.cambios` dice qué cambió.
   */
  alTerminarMinijuego(nombre: string, cierre: CierreDeMinijuego): void;
}

/** Un nivel que se está jugando. */
export interface NivelEnJuego {
  /** Las variables del nivel en este momento. */
  leerVariables(): VariablesDeEstado;
  /** El estado del nivel en este momento: sus variables y lo que el nivel declaró de ellas. */
  leerEstado(): EstadoDeNivel;
  /** Salta la cinemática en curso o, si no hay, termina el diálogo en curso. Sin ninguno, no hace nada. */
  interrumpir(): void;
  /**
   * Reproduce una cinemática del nivel a pedido del host. Termina cuando la cinemática terminó
   * y rechaza con `ErrorDeEscenario` si el nivel no tiene una con ese id.
   */
  reproducirCinematica(id: string): Promise<void>;
  /** Deja de atender toques y de dibujar, y termina lo que esté en curso. No destruye el escenario. */
  terminar(): void;
}
