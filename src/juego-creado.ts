// El objeto `juego` que `crearEscenario()` le entrega al host (docs/DISENO-3.0.md §4).
//
// Estado: `cargar` y `reproducir` todavía no están disponibles y rechazan diciéndolo.
// Cada uno se completa en su fase (§13).

import type { AudioDelNavegador } from './adaptadores/audio/audio-del-navegador.ts';
import type { ControlesDelTeclado } from './adaptadores/dom/controles-del-teclado.ts';
import type { InterfazDelNavegador } from './adaptadores/dom/interfaz-del-navegador.ts';
import type { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import type { NivelEnJuego } from './aplicacion/jugar-nivel.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import { actualizarPartida } from './dominio/partida.ts';
import type { Partida } from './dominio/partida.ts';
import type { EmisorDeEventos } from './emisor-de-eventos.ts';
import type { EventosDeJuego, Juego, NombreDeEvento } from './juego.ts';
import type { Escenario } from './puertos/escenario.ts';

/** Lo que `crearEscenario()` armó y el juego necesita para funcionar y para limpiarse. */
export interface PiezasDelJuego {
  readonly idDelNivel: string;
  /** La partida con la que empezó el juego, para conservar lo guardado de otros niveles. */
  readonly partidaInicial: Partida | undefined;
  readonly emisor: EmisorDeEventos;
  readonly escenario: Escenario;
  readonly interfaz: InterfazDelNavegador;
  readonly audio: AudioDelNavegador;
  readonly controles: ControlesDelTeclado;
  readonly reloj: RelojDelNavegador;
  readonly nivelEnJuego: NivelEnJuego;
  readonly proyeccion: boolean;
}

export class JuegoCreado implements Juego {
  private readonly piezas: PiezasDelJuego;
  private proyeccionActiva: boolean;
  private estaDestruido = false;

  constructor(piezas: PiezasDelJuego) {
    this.piezas = piezas;
    this.proyeccionActiva = piezas.proyeccion;
    piezas.interfaz.ajustarProyeccion(piezas.proyeccion);
  }

  get nivel(): string {
    return this.piezas.idDelNivel;
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
    const variables = this.piezas.nivelEnJuego.leerVariables();
    return actualizarPartida(this.piezas.partidaInicial, this.piezas.idDelNivel, variables);
  }

  async cargar(nivel: string): Promise<void> {
    throw new ErrorDeEscenario([`juego.cargar() todavía no está disponible (no se cargó el nivel "${nivel}")`]);
  }

  async reproducir(idDeCinematica: string): Promise<void> {
    throw new ErrorDeEscenario([
      `juego.reproducir() todavía no está disponible (no se reprodujo la cinemática "${idDeCinematica}")`,
    ]);
  }

  interrumpir(): void {
    this.piezas.nivelEnJuego.interrumpir();
  }

  pausar(): void {
    this.piezas.reloj.pausar();
    this.piezas.audio.pausar();
  }

  reanudar(): void {
    this.piezas.reloj.reanudar();
    this.piezas.audio.reanudar();
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;

    this.piezas.nivelEnJuego.terminar();
    this.piezas.reloj.detener();
    this.piezas.controles.destruir();
    this.piezas.audio.destruir();
    this.piezas.interfaz.destruir();
    this.piezas.escenario.destruir();
    this.piezas.emisor.vaciar();
  }
}
