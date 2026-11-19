// Vigila lo que hace EMPEZAR una cinemática (docs/DISENO-3.0.md §7.1): entrar al nivel, que el jugador entre
// a una zona, o que se cumpla un objetivo. Solo dice cuáles empiezan; reproducirlas es cosa de cinematicas.ts.
// (Las de inicio `manual` no aparecen aquí: esas las pide el host.)

import type { Contenido } from '../dominio/contenido.ts';
import { tieneValor } from '../dominio/estado.ts';
import { puntoDentroDeForma } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Zona } from '../dominio/mundo.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

export interface PiezasDeLosInicios {
  readonly contenido: Contenido;
  /** Las zonas del mapa, por nombre. */
  readonly zonas: Readonly<Record<string, Zona>>;
  readonly estado: EstadoEnJuego;
}

export class IniciosDeCinematicas {
  private readonly piezas: PiezasDeLosInicios;
  /** Los nombres de las zonas donde está el jugador ahora. */
  private readonly zonasOcupadas = new Set<string>();
  /** Los objetivos que ya estaban cumplidos la última vez que se revisó. */
  private readonly objetivosYaVistosCumplidos = new Set<string>();

  constructor(piezas: PiezasDeLosInicios) {
    this.piezas = piezas;
  }

  /** Los ids de las cinemáticas que empiezan al entrar al nivel, en el orden en que el nivel las escribe. */
  buscarLasDeEntrada(): string[] {
    const ids: string[] = [];
    const cinematicas = this.piezas.contenido.cinematicas;
    for (const id of Object.keys(cinematicas)) {
      const inicio = cinematicas[id]!.inicio; // `id` viene de `Object.keys`, así que existe
      if (inicio.tipo === 'alEntrar') {
        ids.push(id);
      }
    }
    return ids;
  }

  /** Los ids de las cinemáticas de cada zona a la que el jugador ACABA de entrar. Se llama en cada cuadro. */
  buscarLasDeZonasRecienPisadas(posicionDelJugador: Punto): string[] {
    const ids: string[] = [];
    const zonasDondeEstaAhora = new Set<string>();
    const cinematicas = this.piezas.contenido.cinematicas;

    for (const id of Object.keys(cinematicas)) {
      const inicio = cinematicas[id]!.inicio; // `id` viene de `Object.keys`, así que existe
      if (inicio.tipo !== 'zona') continue;

      const zona = this.piezas.zonas[inicio.zona]!; // la validación garantiza que la zona existe
      if (!puntoDentroDeForma(posicionDelJugador, zona.forma)) continue;

      zonasDondeEstaAhora.add(inicio.zona);
      const acabaDeEntrar = !this.zonasOcupadas.has(inicio.zona);
      if (acabaDeEntrar) {
        ids.push(id);
      }
    }

    this.zonasOcupadas.clear();
    for (const nombre of zonasDondeEstaAhora) {
      this.zonasOcupadas.add(nombre);
    }
    return ids;
  }

  /**
   * Los ids de las cinemáticas de cada objetivo que se cumplió desde la última revisión. Se llama en cada cuadro.
   * En la primera revisión cuentan los objetivos que ya venían cumplidos en la partida guardada:
   * si se guardó antes de terminar de ver su cinemática, al volver empieza de nuevo.
   */
  buscarLasDeObjetivosRecienCumplidos(): string[] {
    const ids: string[] = [];
    const estado = this.piezas.estado.actual;
    const cinematicas = this.piezas.contenido.cinematicas;

    for (const id of Object.keys(cinematicas)) {
      const inicio = cinematicas[id]!.inicio; // `id` viene de `Object.keys`, así que existe
      if (inicio.tipo !== 'objetivo') continue;

      const yaSeHabiaVistoCumplido = this.objetivosYaVistosCumplidos.has(inicio.objetivo);
      const acabaDeCumplirse = tieneValor(estado, inicio.objetivo) && !yaSeHabiaVistoCumplido;
      if (acabaDeCumplirse) {
        ids.push(id);
      }
    }

    // Se anotan al final y no dentro del ciclo: dos cinemáticas pueden empezar con el mismo objetivo.
    for (const objetivo of this.piezas.contenido.estado.objetivos) {
      if (tieneValor(estado, objetivo)) {
        this.objetivosYaVistosCumplidos.add(objetivo);
      }
    }
    return ids;
  }
}
