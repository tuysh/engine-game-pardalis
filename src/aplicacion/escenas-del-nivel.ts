// Las escenas de un nivel: sus diálogos y sus cinemáticas, que nunca ocurren a la vez, y lo que pasa
// cuando una termina.
//
// Al terminar una escena:
//   - si pidió salir con un paso `sale`, el nivel termina hacia ese destino;
//   - si otra cinemática empieza enseguida, la pantalla y la cámara se quedan como las dejó;
//   - si no, la cámara vuelve al jugador y la pantalla se aclara: el jugador nunca se queda sin ver.

import type { Punto } from '../dominio/geometria.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { CinematicaEnCodigo } from '../puertos/cinematica-en-codigo.ts';
import type { Video } from '../puertos/video.ts';
import type { CamaraDeEscena } from './camara-de-escena.ts';
import { Cinematicas } from './cinematicas.ts';
import { Conversacion } from './conversacion.ts';
import { crearAccionesDePaso } from './crear-acciones-de-paso.ts';
import type { FundidoDePantalla } from './fundido-de-pantalla.ts';
import type { AvisosDelNivel } from './nivel-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** Lo que tarda en aclararse la pantalla al empezar un nivel, si el anterior la dejó en negro. */
const DURACION_AL_ABRIR_EL_NIVEL_EN_SEGUNDOS = 0.5;

export interface PiezasDeLasEscenas {
  readonly escena: PiezasDeEscena;
  readonly nivel: Nivel;
  readonly camara: CamaraDeEscena;
  readonly fundido: FundidoDePantalla;
  readonly video: Video;
  /** Las cinemáticas escritas en código que registró el host, por nombre. */
  readonly cinematicasEnCodigo: Readonly<Record<string, CinematicaEnCodigo>>;
  readonly avisos: AvisosDelNivel;
  /** Se llama justo antes de que empiece un diálogo o una cinemática. */
  readonly alEmpezarUnaEscena: () => void;
}

export class EscenasDelNivel {
  /** Los diálogos del nivel. Una cinemática ocupa su mismo turno: mientras dura, cuenta como diálogo. */
  readonly conversacion: Conversacion;
  private readonly cinematicas: Cinematicas;
  private readonly piezas: PiezasDeLasEscenas;
  /** A dónde pidió salir la escena en curso con un paso `sale`. `undefined` = no lo ha pedido. */
  private destinoPedido: string | undefined;
  private elNivelTermino = false;

  constructor(piezas: PiezasDeLasEscenas) {
    this.piezas = piezas;
    const { escena, nivel, avisos } = piezas;

    const acciones = crearAccionesDePaso({
      escena,
      camara: piezas.camara,
      fundido: piezas.fundido,
      video: piezas.video,
      pedirSalida: (destino) => {
        this.destinoPedido = destino;
      },
    });
    this.conversacion = new Conversacion({
      contenido: escena.contenido,
      estado: escena.estado,
      acciones,
      alFallar: (error) => avisos.alFallar(error),
      alEmpezar: piezas.alEmpezarUnaEscena,
      alTerminar: () => this.alTerminarUnaEscena(),
    });
    this.cinematicas = new Cinematicas({
      contenido: escena.contenido,
      zonas: nivel.mundo.zonas,
      estado: escena.estado,
      acciones,
      conversacion: this.conversacion,
      interfaz: escena.interfaz,
      cinematicasEnCodigo: piezas.cinematicasEnCodigo,
      lugares: { puntos: nivel.mundo.puntos, assets: nivel.assets },
      alEmpezar: (id) => avisos.alEmpezarCinematica(id),
      alTerminar: (id) => avisos.alTerminarCinematica(id),
    });
  }

  /** `true` mientras hay un diálogo, una cinemática o un minijuego: entonces el jugador no controla nada. */
  get hayUnaEnCurso(): boolean {
    return this.conversacion.hayDialogoEnCurso;
  }

  get hayUnaCinematicaEnCurso(): boolean {
    return this.cinematicas.hayUnaEnCurso;
  }

  /** Se llama en cada cuadro, antes de mover al jugador. La posición es `undefined` en un nivel sin jugador. */
  avanzar(posicionDelJugador: Punto | undefined): void {
    this.cinematicas.avanzar(posicionDelJugador);
  }

  /**
   * Se llama al empezar el nivel. Si el nivel anterior cerró a negro antes de salir y aquí no hay
   * una cinemática de entrada que abra la pantalla, se abre sola.
   */
  abrirLaPantallaSiQuedoEnNegro(): void {
    const fundido = this.piezas.fundido;
    if (!fundido.estaOscura || this.cinematicas.hayAlgoPorReproducir) return;
    // Nadie espera a que este fundido termine, así que su señal nunca se dispara.
    const sinCortar = new AbortController().signal;
    void fundido.fundir('abrir', DURACION_AL_ABRIR_EL_NIVEL_EN_SEGUNDOS, sinCortar);
  }

  /** Salta la cinemática en curso o, si no hay, termina el diálogo en curso. Sin ninguno, no hace nada. */
  interrumpir(): void {
    if (this.cinematicas.hayUnaEnCurso) {
      this.cinematicas.saltar();
    } else {
      this.conversacion.interrumpir();
    }
  }

  /** Reproduce una cinemática a pedido del host. Termina cuando la cinemática terminó. */
  reproducirCinematica(id: string): Promise<void> {
    return this.cinematicas.reproducir(id);
  }

  /** El nivel termina: se corta lo que esté en curso y ya no se avisa de ninguna salida. */
  terminar(): void {
    this.elNivelTermino = true;
    this.cinematicas.descartarTodo();
    this.conversacion.interrumpir();
  }

  private alTerminarUnaEscena(): void {
    if (this.elNivelTermino) return;

    if (this.destinoPedido !== undefined) {
      const destino = this.destinoPedido;
      this.destinoPedido = undefined;
      this.piezas.avisos.alSalir(destino);
      return;
    }
    // Acomodar la pantalla y la cámara ahora daría un destello entre esta escena y la cinemática que sigue.
    // Se acomodan cuando termine la última.
    if (this.cinematicas.hayOtraPorEmpezar) return;

    this.piezas.camara.volverAlJugador();
    this.piezas.fundido.dejar('abrir');
  }
}
