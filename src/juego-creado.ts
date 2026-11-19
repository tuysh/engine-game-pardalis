// El objeto `juego` que `crearEscenario()` le entrega al host (docs/DISENO-3.0.md §4).
// Junta el juego en curso (aplicacion/juego-en-curso.ts) con los adaptadores del navegador que hay que
// pausar, ajustar y, al final, destruir.

import type { AudioDelNavegador } from './adaptadores/audio/audio-del-navegador.ts';
import type { ControlesDelTeclado } from './adaptadores/dom/controles-del-teclado.ts';
import type { InterfazDelNavegador } from './adaptadores/dom/interfaz-del-navegador.ts';
import type { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import type { VideoDelNavegador } from './adaptadores/dom/video-del-navegador.ts';
import type { JuegoEnCurso } from './aplicacion/juego-en-curso.ts';
import type { Partida } from './dominio/partida.ts';
import type { EmisorDeEventos } from './emisor-de-eventos.ts';
import type { EventosDeJuego, Juego, NombreDeEvento } from './juego.ts';
import type { Escenario } from './puertos/escenario.ts';
import type { PanelDeDepuracion } from './puertos/panel-de-depuracion.ts';

/** Lo que `crearEscenario()` armó y el juego necesita para funcionar y para limpiarse. */
export interface PiezasDelJuego {
  readonly juegoEnCurso: JuegoEnCurso;
  readonly emisor: EmisorDeEventos;
  readonly escenario: Escenario;
  readonly interfaz: InterfazDelNavegador;
  readonly audio: AudioDelNavegador;
  readonly video: VideoDelNavegador;
  readonly controles: ControlesDelTeclado;
  readonly reloj: RelojDelNavegador;
  /** Solo existe si el juego se creó con `depurar: true`. */
  readonly panelDeDepuracion?: PanelDeDepuracion;
}

export class JuegoCreado implements Juego {
  private readonly piezas: PiezasDelJuego;
  private proyeccionActiva = false;
  /** `true` desde que se muestra el botón de inicio hasta que lo tocan: mientras tanto, el tiempo no pasa. */
  private estaEsperandoElInicio = false;
  private loPausoElHost = false;
  private estaDestruido = false;

  constructor(piezas: PiezasDelJuego) {
    this.piezas = piezas;
  }

  get nivel(): string {
    return this.piezas.juegoEnCurso.idDelNivel;
  }

  get proyeccion(): boolean {
    return this.proyeccionActiva;
  }

  set proyeccion(estaActiva: boolean) {
    this.proyeccionActiva = estaActiva;
    this.piezas.interfaz.ajustarProyeccion(estaActiva);
  }

  on<Evento extends NombreDeEvento>(evento: Evento, funcion: (dato: EventosDeJuego[Evento]) => void): () => void {
    return this.piezas.emisor.on(evento, funcion);
  }

  guardar(): Partida {
    return this.piezas.juegoEnCurso.leerPartida();
  }

  async cargar(nivel: string): Promise<void> {
    await this.piezas.juegoEnCurso.cargar(nivel);
  }

  async reproducir(idDeCinematica: string): Promise<void> {
    await this.piezas.juegoEnCurso.reproducir(idDeCinematica);
  }

  interrumpir(): void {
    this.piezas.juegoEnCurso.interrumpir();
  }

  pausar(): void {
    this.loPausoElHost = true;
    this.piezas.reloj.pausar();
    this.piezas.audio.pausar();
    this.piezas.video.pausar();
  }

  reanudar(): void {
    this.loPausoElHost = false;
    this.piezas.audio.reanudar();
    this.piezas.video.reanudar();
    // Si todavía no tocan el botón de inicio, el tiempo sigue detenido hasta ese toque.
    if (!this.estaEsperandoElInicio) {
      this.piezas.reloj.reanudar();
    }
  }

  /** Detiene el tiempo hasta que se llame a `empezar()`: lo usa `crearEscenario()` con el botón de inicio. */
  esperarElInicio(): void {
    this.estaEsperandoElInicio = true;
    this.piezas.reloj.pausar();
  }

  /** El jugador tocó el botón de inicio: el tiempo empieza a pasar (salvo que el host tenga el juego en pausa). */
  empezar(): void {
    this.estaEsperandoElInicio = false;
    if (!this.loPausoElHost) {
      this.piezas.reloj.reanudar();
    }
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;

    this.piezas.juegoEnCurso.terminar();
    this.piezas.reloj.detener();
    this.piezas.controles.destruir();
    this.piezas.audio.destruir();
    this.piezas.video.destruir();
    if (this.piezas.panelDeDepuracion !== undefined) {
      this.piezas.panelDeDepuracion.destruir();
    }
    this.piezas.interfaz.destruir();
    this.piezas.escenario.destruir();
    this.piezas.emisor.vaciar();
  }
}
