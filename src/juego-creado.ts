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
import type { PausaDelJuego } from './pausa-del-juego.ts';
import type { Escenario } from './puertos/escenario.ts';
import type { PanelDeDepuracion } from './puertos/panel-de-depuracion.ts';

/** Los adaptadores del navegador que el juego usa y que, al final, hay que destruir. */
export interface AdaptadoresDelJuego {
  readonly escenario: Escenario;
  readonly interfaz: InterfazDelNavegador;
  readonly audio: AudioDelNavegador;
  readonly video: VideoDelNavegador;
  readonly controles: ControlesDelTeclado;
  readonly reloj: RelojDelNavegador;
  /** Solo existe si el juego se creó con `depurar: true`. */
  readonly panelDeDepuracion: PanelDeDepuracion | undefined;
}

/** Lo que `crearEscenario()` armó y el juego necesita para funcionar y para limpiarse. */
export interface PiezasDelJuego {
  readonly juegoEnCurso: JuegoEnCurso;
  readonly emisor: EmisorDeEventos;
  readonly pausa: PausaDelJuego;
  readonly adaptadores: AdaptadoresDelJuego;
}

export class JuegoCreado implements Juego {
  private readonly piezas: PiezasDelJuego;
  private proyeccionActiva = false;
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
    this.piezas.adaptadores.interfaz.ajustarProyeccion(estaActiva);
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
    this.piezas.pausa.pausar();
  }

  reanudar(): void {
    this.piezas.pausa.reanudar();
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;

    const adaptadores = this.piezas.adaptadores;
    this.piezas.juegoEnCurso.terminar();
    adaptadores.reloj.detener();
    adaptadores.controles.destruir();
    adaptadores.audio.destruir();
    adaptadores.video.destruir();
    if (adaptadores.panelDeDepuracion !== undefined) {
      adaptadores.panelDeDepuracion.destruir();
    }
    adaptadores.interfaz.destruir();
    adaptadores.escenario.destruir();
    this.piezas.emisor.vaciar();
  }
}
