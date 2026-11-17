// El objeto `juego` que `crearEscenario()` le entrega al host (docs/DISENO-3.0.md §4).
//
// Estado: `cargar` y `reproducir` todavía no están disponibles y rechazan diciéndolo; `interrumpir` y
// `proyeccion` aún no tienen efecto; `guardar` entrega el estado vacío porque todavía nada lo cambia.
// Cada uno se completa en su fase (§13).

import type { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import type { NivelEnJuego } from './aplicacion/jugar-nivel.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import { VERSION_DE_PARTIDA } from './dominio/partida.ts';
import type { Partida } from './dominio/partida.ts';
import { EmisorDeEventos } from './emisor-de-eventos.ts';
import type { EventosDeJuego, Juego, NombreDeEvento } from './juego.ts';
import type { Escenario } from './puertos/escenario.ts';

/** Lo que `crearEscenario()` armó y el juego necesita para funcionar y para limpiarse. */
export interface PiezasDelJuego {
  readonly idDelNivel: string;
  readonly escenario: Escenario;
  readonly reloj: RelojDelNavegador;
  readonly nivelEnJuego: NivelEnJuego;
  readonly proyeccion: boolean;
}

export class JuegoCreado implements Juego {
  proyeccion: boolean;
  private readonly piezas: PiezasDelJuego;
  private readonly emisor = new EmisorDeEventos();
  private estaDestruido = false;

  constructor(piezas: PiezasDelJuego) {
    this.piezas = piezas;
    this.proyeccion = piezas.proyeccion;
  }

  get nivel(): string {
    return this.piezas.idDelNivel;
  }

  on<Evento extends NombreDeEvento>(evento: Evento, funcion: (dato: EventosDeJuego[Evento]) => void): () => void {
    return this.emisor.on(evento, funcion);
  }

  guardar(): Partida {
    return { v: VERSION_DE_PARTIDA, nivel: this.piezas.idDelNivel, niveles: { [this.piezas.idDelNivel]: { estado: {} } } };
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
    // Todavía no hay diálogos ni cinemáticas que interrumpir.
  }

  pausar(): void {
    this.piezas.reloj.pausar();
  }

  reanudar(): void {
    this.piezas.reloj.reanudar();
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;

    this.piezas.nivelEnJuego.terminar();
    this.piezas.reloj.detener();
    this.piezas.escenario.destruir();
    this.emisor.vaciar();
  }
}
